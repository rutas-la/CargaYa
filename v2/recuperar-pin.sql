-- ============================================================
-- CargaYa v2 · Recuperar el PIN con un código por SMS (autogestión)
-- Se pega UNA vez en Supabase → SQL Editor → Run. Se puede repetir sin problema.
-- Lo usa solo la función "recuperar-pin" (Edge Function) con la clave de servicio:
-- nadie desde el teléfono puede llamar estas funciones directamente.
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- Control de envíos (evita abusos y gastos de SMS)
create table if not exists recuperacion (
  tel text primary key,
  envios int not null default 0,
  desde timestamptz not null default now(),
  ultimo timestamptz
);
alter table recuperacion enable row level security;   -- sin políticas: solo la clave de servicio
revoke all on recuperacion from anon, authenticated;

-- ¿Se puede mandar un código a este teléfono? Devuelve: ok | no_existe | espera | muy_seguido | limite_dia
create or replace function recup_puede_enviar(tel_digitos text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare r recuperacion; total int;
begin
  if tel_digitos !~ '^\d{10,15}$' then return 'no_existe'; end if;
  if not exists (select 1 from auth.users where split_part(email, '@', 1) = tel_digitos) then return 'no_existe'; end if;
  -- tope general por día (protege la cuenta de SMS)
  select coalesce(sum(envios), 0) into total from recuperacion where desde > now() - interval '1 day';
  if total >= 300 then return 'limite_dia'; end if;
  select * into r from recuperacion where tel = tel_digitos for update;
  if not found then
    insert into recuperacion (tel, envios, desde, ultimo) values (tel_digitos, 1, now(), now()); return 'ok';
  end if;
  if r.ultimo > now() - interval '60 seconds' then return 'muy_seguido'; end if;
  if r.desde < now() - interval '1 hour' then
    update recuperacion set envios = 1, desde = now(), ultimo = now() where tel = tel_digitos; return 'ok';
  end if;
  if r.envios >= 3 then return 'espera'; end if;
  update recuperacion set envios = envios + 1, ultimo = now() where tel = tel_digitos;
  return 'ok';
end $$;

-- Pone el PIN nuevo (solo después de que Twilio aprobó el código)
create or replace function recup_fijar_pin(tel_digitos text, pin_nuevo text) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare n int;
begin
  if pin_nuevo !~ '^\d{6}$' then return 'pin_invalido'; end if;
  update auth.users set encrypted_password = crypt(pin_nuevo, gen_salt('bf')), updated_at = now()
   where split_part(email, '@', 1) = tel_digitos;
  get diagnostics n = row_count;
  if n = 0 then return 'no_existe'; end if;
  delete from recuperacion where tel = tel_digitos;
  insert into actividad (m) values ('🔑 Un usuario recuperó su PIN por SMS (teléfono terminado en ' || right(tel_digitos, 4) || ')');
  return 'ok';
end $$;

revoke all on function recup_puede_enviar(text) from anon, authenticated, public;
revoke all on function recup_fijar_pin(text, text) from anon, authenticated, public;
grant execute on function recup_puede_enviar(text) to service_role;
grant execute on function recup_fijar_pin(text, text) to service_role;
grant all on recuperacion to service_role;

notify pgrst, 'reload schema';
