-- ============================================================
-- CargaYa v2 · Avisos push (suenan aunque la app esté cerrada)
-- 1) Pegar este archivo en Supabase → SQL Editor → Run (se puede repetir).
-- 2) Después, ejecutar la línea con la dirección, el secreto y la clave pública (push_configurar).
-- ============================================================
create extension if not exists pg_net;

-- Teléfonos que aceptaron avisos
create table if not exists push_subs (
  endpoint text primary key,
  uid uuid not null references auth.users(id) on delete cascade,
  modulo text,
  sub jsonb not null,
  creado timestamptz not null default now()
);
create index if not exists push_subs_uid on push_subs(uid);
-- Dirección de la función y secreto compartido (nadie de la app la puede leer)
create table if not exists push_conf (
  id int primary key default 1 check (id = 1),
  url text not null,
  secreto text not null
);
alter table push_subs enable row level security;
alter table push_conf enable row level security;
revoke all on push_subs, push_conf from anon, authenticated;

-- Supabase ahora pide la clave pública (publishable) para llamar a las funciones
alter table push_conf add column if not exists apikey text;
drop function if exists push_configurar(text, text);
create or replace function push_configurar(url_in text, secreto_in text, apikey_in text default null) returns text
language sql security definer set search_path = public as $$
  insert into push_conf (id, url, secreto, apikey) values (1, url_in, secreto_in, apikey_in)
  on conflict (id) do update set url = excluded.url, secreto = excluded.secreto, apikey = excluded.apikey
  returning 'ok' $$;
revoke all on function push_configurar(text, text, text) from anon, authenticated, public;

-- ¿Están configurados los avisos? (la app muestra el botón solo si es así)
create or replace function push_listo() returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from push_conf) $$;

-- El teléfono se anota para recibir avisos de esta cuenta
create or replace function push_alta(sub_in jsonb, modulo_in text) returns text
language plpgsql security definer set search_path = public as $$
declare ep text := sub_in->>'endpoint';
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if ep is null or ep !~ '^https://' or sub_in->'keys'->>'p256dh' is null or sub_in->'keys'->>'auth' is null then
    raise exception 'Suscripción inválida';
  end if;
  delete from push_subs where endpoint = ep;
  insert into push_subs (endpoint, uid, modulo, sub) values (ep, auth.uid(), left(modulo_in, 20), sub_in);
  -- máximo 10 teléfonos por cuenta
  delete from push_subs where uid = auth.uid() and endpoint in
    (select endpoint from push_subs where uid = auth.uid() order by creado desc offset 10);
  return 'ok';
end $$;

-- Al salir de la cuenta, el teléfono deja de recibir sus avisos
create or replace function push_baja(endpoint_in text) returns text
language sql security definer set search_path = public as $$
  delete from push_subs where endpoint = endpoint_in and uid = auth.uid() returning 'ok' $$;

-- La función borra los teléfonos que ya no aceptan avisos
create or replace function push_limpiar(endpoints text[], secreto text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from push_conf c where c.secreto = push_limpiar.secreto) then return false; end if;
  delete from push_subs where endpoint = any(endpoints);
  return true;
end $$;

revoke all on function push_alta(jsonb, text), push_baja(text), push_listo() from anon, public;
grant execute on function push_alta(jsonb, text), push_baja(text), push_listo() to authenticated;
grant execute on function push_limpiar(text[], text) to anon, authenticated;

-- Arma un aviso para una persona (null si no tiene teléfonos anotados)
create or replace function push_msg(u uuid, titulo text, texto text, url text, tag text, urgente boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when count(*) = 0 then null else jsonb_build_object('subs', jsonb_agg(sub), 'titulo', titulo,
    'texto', left(texto, 180), 'url', url, 'tag', tag, 'urgente', urgente) end
  from push_subs where uid = u $$;

-- Envía (sin esperar respuesta: nunca frena el guardado)
create or replace function push_enviar(msgs jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c push_conf;
begin
  if msgs is null or jsonb_array_length(msgs) = 0 then return; end if;
  select * into c from push_conf where id = 1;
  if not found then return; end if;
  perform net.http_post(url := c.url, body := jsonb_build_object('msgs', msgs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cargaya-secreto', c.secreto)
               || case when c.apikey is not null then jsonb_build_object('apikey', c.apikey) else '{}'::jsonb end,
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'push_enviar: %', sqlerrm;
end $$;
revoke all on function push_msg(uuid, text, text, text, text, boolean), push_enviar(jsonb) from anon, authenticated, public;

-- Qué avisa cada cambio de un despacho
create or replace function push_despacho() returns trigger
language plpgsql security definer set search_path = public as $$
declare n jsonb := new.data; o jsonb := case when tg_op = 'UPDATE' then old.data else null end;
  msgs jsonb := '[]'::jsonb; m jsonb; cu uuid; ku uuid; vu uuid; vn text; res text;
begin
  select (data->>'owner')::uuid into cu from compradores where id = n->>'placa';
  if movil_activo() then select uid into ku from carretilleros_movil where carr = n->>'carretillero'; end if;
  vu := (n->>'vendedor')::uuid;
  select coalesce(data->>'nombre', 'Tu vendedor') into vn from vendedores where id = n->>'vendedor';
  vn := coalesce(vn, 'Tu vendedor');
  if tg_op = 'INSERT' then
    m := push_msg(cu, '📦 Te despacharon mercancía', vn || ' despachó ' || coalesce(n->>'bultos', '') || ' bultos a tu vehículo ' || coalesce(n->>'placa', ''), 'comprador.html', 'd-' || new.id, false);
    if m is not null then msgs := msgs || m; end if;
    m := push_msg(ku, '📦 Nueva entrega', coalesce(n->>'bultos', '') || ' bultos para ' || coalesce(n->>'placa', '') || ' · ' || vn, 'carretillero.html', 'k-' || new.id, true);
    if m is not null then msgs := msgs || m; end if;
  else
    if o->>'estado' = 'en_ruta' and n->>'estado' = 'entregado' then
      m := push_msg(vu, '✅ Mercancía recibida', coalesce(n->>'placa', '') || ' confirmó que recibió ' || coalesce(n->>'bultos', '') || ' bultos', 'vendedor.html', 'e-' || new.id, false);
      if m is not null then msgs := msgs || m; end if;
      m := push_msg(ku, '✅ Entrega confirmada', coalesce(n->>'placa', '') || ' confirmó que recibió la carga', 'carretillero.html', 'k-' || new.id, false);
      if m is not null then msgs := msgs || m; end if;
    end if;
    if n->>'estado' = 'reclamo' and n->'resol' is null
       and (o->>'estado' is distinct from 'reclamo' or o->'reclamo' is distinct from n->'reclamo') then
      m := push_msg(vu, '⚠ RECLAMO de ' || coalesce(n->>'placa', ''), coalesce(n->>'reclamo', 'Falta mercancía') || ' · Toca para atenderlo', 'vendedor.html', 'r-' || new.id, true);
      if m is not null then msgs := msgs || m; end if;
    end if;
    if n->'resol' is not null and o->'resol' is null then
      res := case n->'resol'->>'tipo' when 'repuesto' then 'Repuso lo que faltaba' when 'descuento' then 'Descuento acordado'
             when 'no_corresponde' then 'No corresponde' else n->'resol'->>'tipo' end;
      m := push_msg(cu, '✓ Respondieron tu reclamo', vn || ': ' || res || coalesce(' · ' || nullif(n->'resol'->>'nota', ''), ''), 'comprador.html', 'r-' || new.id, false);
      if m is not null then msgs := msgs || m; end if;
    end if;
  end if;
  perform push_enviar(msgs);
  return null;
exception when others then
  raise warning 'push_despacho: %', sqlerrm;
  return null;
end $$;
drop trigger if exists push_despacho on despachos;
create trigger push_despacho after insert or update on despachos for each row execute function push_despacho();

-- Mensualidad aprobada o rechazada
create or replace function push_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if old.data->>'estado' = 'pendiente' and new.data->>'estado' in ('aprobado', 'rechazado') then
    m := push_msg((new.data->>'vendedor')::uuid,
      case when new.data->>'estado' = 'aprobado' then '✓ Tu pago fue aprobado' else '✗ Tu pago fue rechazado' end,
      case when new.data->>'estado' = 'aprobado' then 'Ya puedes seguir despachando.' else coalesce(new.data->>'motivo', 'Revisa el motivo en Mensualidad.') end,
      'vendedor.html', 'p-' || new.id, false);
    if m is not null then perform push_enviar(jsonb_build_array(m)); end if;
  end if;
  return null;
exception when others then
  raise warning 'push_pago: %', sqlerrm;
  return null;
end $$;
drop trigger if exists push_pago on pagos;
create trigger push_pago after update on pagos for each row execute function push_pago();

notify pgrst, 'reload schema';
