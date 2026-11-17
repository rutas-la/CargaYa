// CargaYa v2 · Edge Function "recuperar-pin"
// Recupera el PIN con un código por SMS (Twilio Verify). Autogestión: sin la administración.
//   POST {accion:"enviar",  tel:"58412..."}                       → manda el código por SMS
//   POST {accion:"cambiar", tel:"58412...", codigo:"123456", pin:"654321"} → verifica y cambia el PIN
// Responde siempre 200 con {ok:true} o {error:"mensaje para el usuario"}.
// Secretos (Supabase → Edge Functions → Secrets): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
// IMPORTANTE: desplegar con "Verify JWT" DESACTIVADO (la usan personas que todavía no pueden entrar).

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("CARGAYA_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const VSID = Deno.env.get("TWILIO_VERIFY_SID") ?? "";
const TW = Deno.env.get("TWILIO_BASE") ?? "https://verify.twilio.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...CORS, "Content-Type": "application/json" } });
const fallo = (m: string) => resp({ error: m });

async function rpc(fn: string, args: Record<string, unknown>): Promise<string> {
  const h: Record<string, string> = { "Content-Type": "application/json", apikey: SB_KEY };
  if (!SB_KEY.startsWith("sb_")) h.Authorization = "Bearer " + SB_KEY; // clave antigua (JWT)
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  return await r.json();
}

async function twilio(ruta: string, datos: Record<string, string>) {
  const r = await fetch(`${TW}/v2/Services/${VSID}/${ruta}`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${SID}:${TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(datos),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fallo("Método no permitido");
  if (!SB_URL || !SB_KEY || !SID || !TOKEN || !VSID) return fallo("La recuperación por SMS todavía no está configurada. Pide a la administración que cambie tu PIN.");
  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { return fallo("Datos inválidos"); }
  const tel = String(b.tel ?? "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(tel)) return fallo("Revisa el teléfono (ej: 0414-123-4567).");
  const to = "+" + tel;
  try {
    if (b.accion === "enviar") {
      const p = await rpc("recup_puede_enviar", { tel_digitos: tel });
      if (p === "no_existe") return fallo("No hay ninguna cuenta con ese teléfono. Revisa el número o toca \"Soy nuevo\".");
      if (p === "muy_seguido") return fallo("Espera un minuto antes de pedir otro código.");
      if (p === "espera") return fallo("Ya pediste 3 códigos. Espera una hora y prueba de nuevo.");
      if (p === "limite_dia") return fallo("Hoy no se pueden enviar más códigos. Pide a la administración que cambie tu PIN.");
      const t = await twilio("Verifications", { To: to, Channel: "sms", Locale: "es" });
      if (!t.ok) {
        console.error("twilio enviar", t.status, JSON.stringify(t.j));
        if ((t.j as { code?: number }).code === 60200 || (t.j as { code?: number }).code === 60205)
          return fallo("Ese número no puede recibir SMS. Pide a la administración que cambie tu PIN.");
        return fallo("No se pudo enviar el SMS. Prueba de nuevo en unos minutos.");
      }
      return resp({ ok: true });
    }
    if (b.accion === "cambiar") {
      const codigo = String(b.codigo ?? "").replace(/\D/g, ""), pin = String(b.pin ?? "");
      if (!/^\d{4,10}$/.test(codigo)) return fallo("Escribe el código que te llegó por SMS.");
      if (!/^\d{6}$/.test(pin)) return fallo("El PIN nuevo debe tener 6 números.");
      const t = await twilio("VerificationCheck", { To: to, Code: codigo });
      if (t.status === 404) return fallo("El código venció o ya se usó. Pide uno nuevo.");
      if (t.status === 429) return fallo("Demasiados intentos. Pide un código nuevo.");
      if (!t.ok) { console.error("twilio check", t.status, JSON.stringify(t.j)); return fallo("No se pudo verificar el código. Prueba de nuevo."); }
      if ((t.j as { status?: string }).status !== "approved") return fallo("El código no es correcto.");
      const r = await rpc("recup_fijar_pin", { tel_digitos: tel, pin_nuevo: pin });
      if (r !== "ok") return fallo("No se pudo cambiar el PIN. Pide ayuda a la administración.");
      return resp({ ok: true });
    }
    return fallo("Acción desconocida");
  } catch (e) {
    console.error(e);
    return fallo("Error del servidor. Prueba de nuevo en unos minutos.");
  }
});
