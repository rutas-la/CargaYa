-- CargaYa · seguridad con inicio de sesión
-- Ejecutar en Supabase > SQL Editor > New query > Run, después de supabase.sql.
-- Se puede volver a ejecutar sin perder datos (actualiza las reglas).
-- Para borrar todos los datos de prueba, ejecuta aparte:
--   delete from registros; delete from actividad;

-- 1) Administradores
create table if not exists admins (uid uuid primary key);
alter table admins enable row level security;
drop policy if exists admins_ver_propio on admins;
create policy admins_ver_propio on admins for select to authenticated using (uid = auth.uid());
grant select on admins to authenticated;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where uid = auth.uid())
$$;

create or replace function es_vendedor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from registros where tipo = 'vendedor' and id = auth.uid()::text)
$$;

create or replace function es_duenio_placa(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from registros where tipo = 'comprador' and id = p and data->>'owner' = auth.uid()::text)
$$;

-- 2) Quitar el acceso abierto del piloto
drop policy if exists piloto_leer on registros;
drop policy if exists piloto_crear on registros;
drop policy if exists piloto_editar on registros;
drop policy if exists piloto_leer_act on actividad;
drop policy if exists piloto_crear_act on actividad;
revoke all on registros from anon;
revoke all on actividad from anon;
revoke all on sequence actividad_id_seq from anon;

grant select, insert, update on registros to authenticated;
grant select, insert on actividad to authenticated;
grant usage, select on sequence actividad_id_seq to authenticated;

-- 3) Quién puede ver
drop policy if exists ver on registros;
create policy ver on registros for select to authenticated using (
  tipo <> 'pago'
  or data->>'vendedor' = auth.uid()::text
  or es_admin()
);

-- 4) Quién puede crear
drop policy if exists crear on registros;
create policy crear on registros for insert to authenticated with check (
  es_admin()
  or (tipo = 'vendedor'     and id = auth.uid()::text)
  or (tipo = 'comprador'    and data->>'owner' = auth.uid()::text)
  or (tipo = 'despacho'     and data->>'vendedor' = auth.uid()::text and es_vendedor())
  or (tipo = 'carretillero' and data->>'vendedor' = auth.uid()::text and es_vendedor())
  or (tipo = 'pago'         and data->>'vendedor' = auth.uid()::text and data->>'estado' = 'pendiente' and es_vendedor())
);

-- 5) Quién puede modificar
drop policy if exists editar on registros;
create policy editar on registros for update to authenticated
using (
  es_admin()
  or (tipo = 'vendedor'     and id = auth.uid()::text)
  or (tipo = 'comprador'    and data->>'owner' = auth.uid()::text)
  or (tipo = 'despacho'     and (data->>'vendedor' = auth.uid()::text or es_duenio_placa(data->>'placa')))
  or (tipo = 'carretillero' and data->>'vendedor' = auth.uid()::text)
)
with check (
  es_admin()
  or (tipo = 'vendedor'     and id = auth.uid()::text)
  or (tipo = 'comprador'    and data->>'owner' = auth.uid()::text)
  or (tipo = 'despacho'     and (data->>'vendedor' = auth.uid()::text or es_duenio_placa(data->>'placa')))
  or (tipo = 'carretillero' and data->>'vendedor' = auth.uid()::text)
);

-- 6) Protecciones de campos (las reglas no ven el valor anterior; un trigger sí)
create or replace function proteger_campos() returns trigger
language plpgsql security definer set search_path = public as $$
declare ahora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if es_admin() then return new; end if;

  if new.tipo = 'vendedor' then
    if tg_op = 'INSERT' then
      -- la prueba gratis empieza al registrarse; nadie se regala meses
      new.data := (new.data - 'pagadoHasta') || jsonb_build_object('creado', ahora);
    else
      new.data := (new.data - 'pagadoHasta' - 'creado')
        || jsonb_build_object('creado', coalesce(old.data->'creado', to_jsonb(ahora)))
        || case when old.data ? 'pagadoHasta' then jsonb_build_object('pagadoHasta', old.data->'pagadoHasta') else '{}'::jsonb end;
    end if;
  end if;

  if new.tipo = 'carretillero' and tg_op = 'UPDATE' then
    -- un carretillero no se pasa a otro vendedor
    new.data := jsonb_set(new.data, '{vendedor}', old.data->'vendedor');
  end if;

  if new.tipo = 'comprador' and tg_op = 'UPDATE' then
    -- el dueño de la placa no cambia
    new.data := jsonb_set(new.data, '{owner}', old.data->'owner');
  end if;

  if new.tipo = 'despacho' and tg_op = 'UPDATE' and old.data->>'vendedor' <> auth.uid()::text then
    -- el comprador solo puede confirmar o reclamar
    if (new.data - array['estado','t','verif','reclamo']) is distinct from (old.data - array['estado','t','verif','reclamo'])
       or new.data->>'estado' not in ('entregado','reclamo') then
      raise exception 'El comprador solo puede confirmar o reclamar';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists proteger_campos on registros;
create trigger proteger_campos before insert or update on registros
for each row execute function proteger_campos();

-- 7) Actividad: todos registran, solo administración la lee
drop policy if exists act_ver on actividad;
drop policy if exists act_crear on actividad;
create policy act_ver   on actividad for select to authenticated using (es_admin());
create policy act_crear on actividad for insert to authenticated with check (true);

-- 8) Para marcarte como administrador (después de crear tu cuenta), ejecuta,
--    cambiando el teléfono por el tuyo (solo números, con código de país):
-- insert into admins (uid) select id from auth.users where email = '584141234567@cargaya.app';
