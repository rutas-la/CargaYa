-- ============================================================
-- CargaYa v2 · Recuperar el PIN con una PALABRA SECRETA (autogestión)
-- Pegar UNA vez en Supabase → SQL Editor → Run. Se puede repetir sin problema.
-- La palabra se guarda cifrada (como el PIN): nadie la puede leer, ni la administración.
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- Limpia la prueba anterior por SMS (si se llegó a instalar)
drop function if exists recup_puede_enviar(text);
drop function if exists recup_fijar_pin(text, text);
drop table if exists recuperacion;

create table if not exists palabras_secretas (
  uid uuid primary key references auth.users(id) on delete cascade,
  hash text not null,
  fallos int not null default 0,
  bloqueado_hasta timestamptz,
  actualizado timestamptz not null default now()
);
alter table palabras_secretas enable row level security;   -- sin políticas: solo por las funciones de abajo
revoke all on palabras_secretas from anon, authenticated;

-- Normaliza: minúsculas, sin acentos, sin espacios ni signos ("Firulais " = "firuláis")
create or replace function palabra_normal(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select regexp_replace(lower(translate(coalesce(p, ''), 'áéíóúüàèìòùâêîôûñÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÑ', 'aeiouuaeiouaeiounAEIOUUAEIOUAEIOUN')), '[^a-z0-9]', '', 'g') $$;

-- La persona (ya dentro de su cuenta) crea o cambia su palabra secreta
create or replace function fijar_palabra(palabra text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare n text := palabra_normal(palabra);
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if length(n) < 4 then return 'corta'; end if;
  insert into palabras_secretas (uid, hash) values (auth.uid(), crypt(n, gen_salt('bf')))
  on conflict (uid) do update set hash = excluded.hash, fallos = 0, bloqueado_hasta = null, actualizado = now();
  return 'ok';
end $$;

-- ¿Ya tengo palabra secreta?
create or replace function tengo_palabra() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from palabras_secretas where uid = auth.uid()) $$;

-- Recuperar el PIN SIN entrar: teléfono + palabra secreta + PIN nuevo.
-- Devuelve: ok | no_existe | sin_palabra | bloqueado | pin_invalido | incorrecta:<intentos que quedan>
-- 5 intentos fallidos bloquean la recuperación de esa cuenta por 1 hora.
create or replace function recuperar_con_palabra(tel_digitos text, palabra text, pin_nuevo text) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare u uuid; p palabras_secretas;
begin
  if pin_nuevo !~ '^\d{6}$' then return 'pin_invalido'; end if;
  if tel_digitos !~ '^\d{10,15}$' then return 'no_existe'; end if;
  select id into u from auth.users where split_part(email, '@', 1) = tel_digitos;
  if u is null then return 'no_existe'; end if;
  select * into p from palabras_secretas where uid = u for update;
  if not found then return 'sin_palabra'; end if;
  if p.bloqueado_hasta > now() then return 'bloqueado'; end if;
  if p.hash <> crypt(palabra_normal(palabra), p.hash) then
    update palabras_secretas set fallos = fallos + 1,
      bloqueado_hasta = case when fallos + 1 >= 5 then now() + interval '1 hour' end
     where uid = u returning * into p;
    if p.fallos >= 5 then
      update palabras_secretas set fallos = 0 where uid = u;
      insert into actividad (m, autor) values ('⚠️ Recuperación de PIN bloqueada 1 hora por intentos fallidos (teléfono terminado en ' || right(tel_digitos, 4) || ')', null);
      return 'bloqueado';
    end if;
    return 'incorrecta:' || (5 - p.fallos);
  end if;
  update auth.users set encrypted_password = crypt(pin_nuevo, gen_salt('bf')), updated_at = now() where id = u;
  update palabras_secretas set fallos = 0, bloqueado_hasta = null where uid = u;
  insert into actividad (m, autor) values ('🔑 Un usuario recuperó su PIN con su palabra secreta (teléfono terminado en ' || right(tel_digitos, 4) || ')', null);
  return 'ok';
end $$;

revoke all on function fijar_palabra(text) from anon, public;
revoke all on function tengo_palabra() from anon, public;
revoke all on function recuperar_con_palabra(text, text, text) from public;
grant execute on function fijar_palabra(text) to authenticated;
grant execute on function tengo_palabra() to authenticated;
grant execute on function recuperar_con_palabra(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
