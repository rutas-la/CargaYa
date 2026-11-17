-- CargaYa · base de datos para la prueba piloto
-- Pegá todo esto en Supabase > SQL Editor > New query y tocá "Run".

create table if not exists registros (
  tipo text not null,            -- vendedor | comprador | carretillero | despacho
  id   text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tipo, id)
);

create table if not exists actividad (
  id bigserial primary key,
  t  timestamptz not null default now(),
  m  text not null
);

alter table registros enable row level security;
alter table actividad enable row level security;

-- Piloto: cualquiera con el link de la app puede leer y escribir.
-- Antes de abrirla a más gente hay que agregar usuarios con contraseña.
drop policy if exists piloto_leer on registros;
drop policy if exists piloto_crear on registros;
drop policy if exists piloto_editar on registros;
drop policy if exists piloto_leer_act on actividad;
drop policy if exists piloto_crear_act on actividad;
create policy piloto_leer   on registros for select using (true);
create policy piloto_crear  on registros for insert with check (true);
create policy piloto_editar on registros for update using (true) with check (true);
create policy piloto_leer_act  on actividad for select using (true);
create policy piloto_crear_act on actividad for insert with check (true);

-- Permisos para la app (clave pública)
grant usage on schema public to anon;
grant select, insert, update on registros to anon;
grant select, insert on actividad to anon;
grant usage, select on sequence actividad_id_seq to anon;

-- Avisos en tiempo real entre teléfonos
alter publication supabase_realtime add table registros;
alter publication supabase_realtime add table actividad;

-- Para reiniciar el piloto (borra todo), ejecutá solo estas dos líneas:
-- delete from registros;
-- delete from actividad;
