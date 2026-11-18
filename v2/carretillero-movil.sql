-- ============================================================
-- CargaYa v2 · Carretilleros con teléfono (app "CargaYa Carretillero")
-- Pegar UNA vez en Supabase → SQL Editor → Run. Se puede repetir sin problema.
-- Queda APAGADO: se enciende en Administración → Carretilleros → "Carretilleros con teléfono".
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- Qué cuenta (teléfono) usa cada carretillero
create table if not exists carretilleros_movil (
  carr text primary key references carretilleros(id) on delete cascade,
  uid uuid not null unique references auth.users(id) on delete cascade,
  desde timestamptz not null default now()
);
-- Códigos de activación que genera el vendedor (vencen a las 48 h, se usan una vez)
create table if not exists activaciones (
  codigo text primary key,
  carr text not null references carretilleros(id) on delete cascade,
  creado_por text,
  vence timestamptz not null
);
alter table carretilleros_movil enable row level security;
alter table activaciones enable row level security;          -- sin políticas: solo por funciones
revoke all on activaciones from anon, authenticated;

-- ¿Está encendido? (interruptor de la administración)
create or replace function movil_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'activo')::boolean from config where id = 'movil'), false) $$;

-- El carretillero de esta cuenta (o null)
create or replace function mi_carretillero() returns text
language sql stable security definer set search_path = public as $$
  select carr from carretilleros_movil where uid = (select auth.uid()) $$;

create or replace function mis_carrs() returns setof text
language sql stable security definer set search_path = public as $$
  select carr from carretilleros_movil where uid = (select auth.uid()) $$;

-- Placas a las que este carretillero lleva mercancía ahora
create or replace function placas_de_mis_entregas() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct placa from despachos
   where estado = 'en_ruta' and carretillero in (select carr from carretilleros_movil where uid = (select auth.uid())) $$;

-- Quién ve qué vínculo: el propio carretillero, su vendedor y la administración
drop policy if exists ver on carretilleros_movil;
create policy ver on carretilleros_movil for select to authenticated using (
  uid = (select auth.uid()) or (select es_admin())
  or exists (select 1 from carretilleros k where k.id = carr and k.vendedor = (select yo())));
revoke insert, update, delete on carretilleros_movil from anon, authenticated;
grant select on carretilleros_movil to authenticated;

-- El carretillero ve sus despachos y los vehículos a los que lleva carga
drop policy if exists ver on despachos;
create policy ver on despachos for select to authenticated using (
  (select es_admin()) or vendedor = (select yo()) or placa in (select mis_placas())
  or carretillero in (select mis_carrs()));
drop policy if exists ver on compradores;
create policy ver on compradores for select to authenticated using (
  (select es_admin()) or (select es_vendedor()) or owner = (select yo())
  or id in (select placas_de_mis_entregas()));

-- Vendedor (o admin): genera el código para activar el teléfono de su carretillero
create or replace function crear_activacion(carr_id text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k carretilleros; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not movil_activo() then raise exception 'La administración todavía no activó los carretilleros con teléfono'; end if;
  select * into k from carretilleros where id = carr_id;
  if not found or coalesce((k.data->>'baja')::boolean, false) then raise exception 'Ese carretillero no existe'; end if;
  if k.vendedor is distinct from yo() and not es_admin() then raise exception 'Solo su vendedor puede activar a este carretillero'; end if;
  delete from activaciones where carr = carr_id or vence < now();
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1); end loop;
    exit when not exists (select 1 from activaciones where codigo = c);
  end loop;
  insert into activaciones (codigo, carr, creado_por, vence) values (c, carr_id, yo(), now() + interval '48 hours');
  return c;
end $$;

-- Sin entrar: ¿qué carretillero activa este código? (para mostrarlo antes de crear la cuenta)
create or replace function ver_activacion(codigo_in text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a activaciones; k carretilleros;
begin
  if not movil_activo() then return jsonb_build_object('error', 'apagado'); end if;
  select * into a from activaciones where codigo = upper(trim(codigo_in)) and vence > now();
  if not found then return jsonb_build_object('error', 'no_existe'); end if;
  select * into k from carretilleros where id = a.carr;
  return jsonb_build_object('num', k.data->'num', 'nombre', coalesce(k.data->>'nombre', ''),
    'vendedor', coalesce((select data->>'nombre' from vendedores where id = k.vendedor), ''));
end $$;

-- Ya con su cuenta: el carretillero usa el código y queda vinculado (reemplaza un teléfono anterior)
create or replace function activar_carretillero(codigo_in text) returns text
language plpgsql security definer set search_path = public as $$
declare a activaciones; k carretilleros;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not movil_activo() then raise exception 'La administración todavía no activó los carretilleros con teléfono'; end if;
  select * into a from activaciones where codigo = upper(trim(codigo_in)) and vence > now() for update;
  if not found then raise exception 'El código no existe o ya venció. Pide uno nuevo a tu vendedor.'; end if;
  delete from carretilleros_movil where carr = a.carr or uid = auth.uid();
  insert into carretilleros_movil (carr, uid) values (a.carr, auth.uid());
  delete from activaciones where codigo = a.codigo;
  select * into k from carretilleros where id = a.carr;
  insert into actividad (m) values ('📱 El carretillero #' || coalesce(k.data->>'num', '?') || ' ' || coalesce(k.data->>'nombre', '') || ' activó su teléfono');
  return a.carr;
end $$;

-- Vendedor (o admin): quita el teléfono de un carretillero
create or replace function desactivar_movil(carr_id text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from carretilleros where id = carr_id and (vendedor = yo() or es_admin())) then
    raise exception 'Solo su vendedor puede hacerlo';
  end if;
  delete from carretilleros_movil where carr = carr_id;
  delete from activaciones where carr = carr_id;
  return 'ok';
end $$;

revoke all on function crear_activacion(text) from anon, public;
revoke all on function activar_carretillero(text) from anon, public;
revoke all on function desactivar_movil(text) from anon, public;
revoke all on function mi_carretillero() from anon, public;
revoke all on function ver_activacion(text) from public;
grant execute on function crear_activacion(text), activar_carretillero(text), desactivar_movil(text), mi_carretillero() to authenticated;
grant execute on function ver_activacion(text) to anon, authenticated;
grant execute on function movil_activo(), mis_carrs(), placas_de_mis_entregas() to authenticated;

-- Avisos en vivo del vínculo (para el vendedor)
do $$ begin
  begin alter publication supabase_realtime add table carretilleros_movil; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
