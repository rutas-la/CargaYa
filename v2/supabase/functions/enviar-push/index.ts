// CargaYa v2 · Edge Function "enviar-push"
// La llama la base de datos (disparador con pg_net) cuando pasa algo importante.
// Recibe: {msgs:[{subs:[{endpoint,keys:{p256dh,auth}}], titulo, texto, url, tag, urgente}]}
// Secretos (Supabase → Edge Functions → Secrets): VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRETO
// Desplegar con "Verify JWT" DESACTIVADO (la protege PUSH_SECRETO).
import webpush from "npm:web-push@3.6.7";

const PUB = Deno.env.get("VAPID_PUBLIC") ?? "";
const PRIV = Deno.env.get("VAPID_PRIVATE") ?? "";
const SECRETO = Deno.env.get("PUSH_SECRETO") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
if (PUB && PRIV) webpush.setVapidDetails("https://rutas-la.github.io/CargaYa/", PUB, PRIV);

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Msg = { subs: Sub[]; titulo: string; texto: string; url?: string; tag?: string; urgente?: boolean };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("no", { status: 405 });
  if (!SECRETO || req.headers.get("x-cargaya-secreto") !== SECRETO) return new Response("no autorizado", { status: 401 });
  if (!PUB || !PRIV) return new Response("faltan las claves VAPID", { status: 500 });
  let body: { msgs?: Msg[] } = {};
  try { body = await req.json(); } catch { return new Response("json inválido", { status: 400 }); }
  const muertos: string[] = [];
  let enviados = 0, fallidos = 0;
  await Promise.all((body.msgs ?? []).flatMap((m) => (m.subs ?? []).map(async (s) => {
    const datos = JSON.stringify({ titulo: m.titulo, texto: m.texto, url: m.url ?? "", tag: m.tag ?? "", urgente: !!m.urgente });
    try {
      await webpush.sendNotification(s, datos, { TTL: m.urgente ? 86400 : 3600, urgency: m.urgente ? "high" : "normal" });
      enviados++;
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) muertos.push(s.endpoint); else { fallidos++; console.error("push", st, (e as Error).message); }
    }
  })));
  // Teléfonos que ya no aceptan avisos (desinstalaron o quitaron el permiso): se borran
  if (muertos.length && SB_URL && SB_KEY) {
    const h: Record<string, string> = { "Content-Type": "application/json", apikey: SB_KEY };
    if (!SB_KEY.startsWith("sb_")) h.Authorization = "Bearer " + SB_KEY;
    await fetch(`${SB_URL}/rest/v1/rpc/push_limpiar`, { method: "POST", headers: h, body: JSON.stringify({ endpoints: muertos, secreto: SECRETO }) }).catch(() => {});
  }
  return new Response(JSON.stringify({ enviados, fallidos, borrados: muertos.length }), { headers: { "Content-Type": "application/json" } });
});
