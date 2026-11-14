-- =====================================================================
-- CargaYa v2 · base de datos escalable
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- Se puede volver a ejecutar: no borra datos.
--
-- Qué cambia respecto del piloto:
--  * Una tabla por tipo de dato, con columnas indexadas (vendedor, placa,
--    fecha, estado) para que cada teléfono descargue solo lo suyo.
--  * Privacidad: cada uno ve solo lo que le corresponde.
--  * El servidor controla la mensualidad (no se puede despachar vencido).
--  * Fotos en Storage (no dentro de la base).
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists admins (uid uuid primary key);

create table if not exists vendedores (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists compradores (
  id text primary key,                                         -- placa
  data jsonb not null,
  updated_at timestamptz not null default now(),
  owner  text,
  activo boolean not null default true
);

create table if not exists carretilleros (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  vendedor text
);

create table if not exists despachos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  vendedor     text,
  placa        text,
  carretillero text,
  estado       text,
  creado       bigint,
  archivado    boolean not null default false,
  pagado       boolean not null default false
);

create table if not exists pagos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  vendedor text,
  estado   text
);

create table if not exists zonas       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists config      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists calibracion (id text primary key, data jsonb not null, updated_at timestamptz not null default now());

create table if not exists actividad (
  id bigserial primary key,
  t timestamptz not null default now(),
  m text not null,
  autor uuid default auth.uid()
);

-- ---------- Índices ----------
create index if not exists despachos_vendedor_creado on despachos (vendedor, creado desc);
create index if not exists despachos_placa_creado    on despachos (placa, creado desc);
create index if not exists despachos_carr_creado     on despachos (carretillero, creado desc);
create index if not exists despachos_creado          on despachos (creado desc);
create index if not exists compradores_owner         on compradores (owner);
create index if not exists compradores_activo        on compradores (activo) where activo;
create index if not exists carretilleros_vendedor    on carretilleros (vendedor);
create index if not exists pagos_vendedor            on pagos (vendedor);
create index if not exists pagos_estado              on pagos (estado);
create index if not exists actividad_t               on actividad (t desc);

-- ---------- Funciones de ayuda ----------
create or replace function yo() returns text
language sql stable as $$ select (select auth.uid())::text $$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where uid = (select auth.uid())) $$;

create or replace function es_vendedor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vendedores where id = yo()) $$;

create or replace function es_duenio_placa(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compradores where id = p and owner = yo()) $$;

-- Placas del usuario (se calcula una sola vez por consulta)
create or replace function mis_placas() returns setof text
language sql stable security definer set search_path = public as $$
  select id from compradores where owner = yo() $$;

create or replace function ahora_ms() returns bigint
language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- Mensualidad: misma regla que la app (prueba gratis, días de gracia, pago pendiente)
create or replace function puede_despachar(vid text) returns boolean
language sql stable security definer set search_path = public as $$
  with c as (select coalesce((select data from config where id = 'cobro'), '{}'::jsonb) d),
       v as (select data from vendedores where id = vid)
  select exists (select 1 from v) and (
    ahora_ms() <= coalesce(
        ((select data from v)->>'pagadoHasta')::numeric,
        coalesce(((select data from v)->>'creado')::numeric, ahora_ms())
          + coalesce(((select d from c)->>'pruebaDias')::numeric, 30) * 86400000)
      + coalesce(((select d from c)->>'graciaDias')::numeric, 3) * 86400000
    or exists (select 1 from pagos where vendedor = vid and estado = 'pendiente'))
$$;

-- ---------- Seguridad por fila (RLS) ----------
alter table admins        enable row level security;
alter table vendedores    enable row level security;
alter table compradores   enable row level security;
alter table carretilleros enable row level security;
alter table despachos     enable row level security;
alter table pagos         enable row level security;
alter table zonas         enable row level security;
alter table config        enable row level security;
alter table calibracion   enable row level security;
alter table actividad     enable row level security;

-- Sin sesión no se ve nada
revoke all on admins, vendedores, compradores, carretilleros, despachos, pagos, zonas, config, calibracion, actividad from anon;
grant select, insert, update on vendedores, compradores, carretilleros, despachos, pagos, zonas, config, calibracion, actividad to authenticated;
grant select on admins to authenticated;
grant usage, select on sequence actividad_id_seq to authenticated;

do $$ declare t text; p text; begin
  foreach t in array array['admins','vendedores','compradores','carretilleros','despachos','pagos','zonas','config','calibracion','actividad'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p, t);
    end loop;
  end loop;
end $$;

create policy ver on admins for select to authenticated using (uid = (select auth.uid()));

-- Vendedores: cada uno su ficha; la administración, todas.
-- (Los compradores ven el directorio por la vista vendedores_publico.)
create policy ver    on vendedores for select to authenticated using (id = (select yo()) or (select es_admin()));
create policy crear  on vendedores for insert to authenticated with check (id = (select yo()) or (select es_admin()));
create policy editar on vendedores for update to authenticated using (id = (select yo()) or (select es_admin())) with check (id = (select yo()) or (select es_admin()));

-- Compradores: el dueño de la placa, los vendedores (para despachar) y la administración.
create policy ver    on compradores for select to authenticated using ((select es_admin()) or (select es_vendedor()) or owner = (select yo()));
create policy crear  on compradores for insert to authenticated with check (owner = (select yo()) or (select es_admin()));
create policy editar on compradores for update to authenticated using (owner = (select yo()) or (select es_admin())) with check (owner = (select yo()) or (select es_admin()));

-- Carretilleros: todos ven número y nombre (para leer credenciales); cada vendedor gestiona los suyos.
create policy ver    on carretilleros for select to authenticated using (true);
create policy crear  on carretilleros for insert to authenticated with check ((vendedor = (select yo()) and (select es_vendedor())) or (select es_admin()));
create policy editar on carretilleros for update to authenticated using (vendedor = (select yo()) or (select es_admin())) with check (vendedor = (select yo()) or (select es_admin()));

-- Despachos: el vendedor que despachó, el dueño de la placa y la administración.
create policy ver    on despachos for select to authenticated using ((select es_admin()) or vendedor = (select yo()) or placa in (select mis_placas()));
create policy crear  on despachos for insert to authenticated with check ((vendedor = (select yo()) and (select puede_despachar((select yo())))) or (select es_admin()));
create policy editar on despachos for update to authenticated using ((select es_admin()) or vendedor = (select yo()) or placa in (select mis_placas())) with check ((select es_admin()) or vendedor = (select yo()) or placa in (select mis_placas()));

-- Pagos de la mensualidad: el vendedor carga los suyos; solo la administración los aprueba.
create policy ver    on pagos for select to authenticated using (vendedor = (select yo()) or (select es_admin()));
create policy crear  on pagos for insert to authenticated with check ((vendedor = (select yo()) and estado = 'pendiente') or (select es_admin()));
create policy editar on pagos for update to authenticated using ((select es_admin())) with check ((select es_admin()));

-- Zonas y configuración: todos leen; solo la administración cambia.
create policy ver    on zonas for select to authenticated using (true);
create policy crear  on zonas for insert to authenticated with check ((select es_admin()));
create policy editar on zonas for update to authenticated using ((select es_admin())) with check ((select es_admin()));
-- los datos de Pago Móvil (config 'cobro') solo los ven vendedores y administración
create policy ver    on config for select to authenticated using (id <> 'cobro' or (select es_vendedor()) or (select es_admin()));
create policy crear  on config for insert to authenticated with check ((select es_admin()));
create policy editar on config for update to authenticated using ((select es_admin())) with check ((select es_admin()));
create policy ver    on calibracion for select to authenticated using ((select es_admin()));
create policy crear  on calibracion for insert to authenticated with check ((select es_admin()));
create policy editar on calibracion for update to authenticated using ((select es_admin())) with check ((select es_admin()));

create policy ver   on actividad for select to authenticated using ((select es_admin()));
create policy crear on actividad for insert to authenticated with check (length(m) <= 400);

-- ---------- Directorio de vendedores para compradores (sin datos de cobro) ----------
create or replace view vendedores_publico as
  select id,
         data->>'nombre'    as nombre,
         data->>'tel'       as tel,
         data->>'productos' as productos,
         data->>'sector'    as sector,
         data->>'refPuesto' as "refPuesto",
         data->'px'         as px,
         data->'py'         as py,
         puede_despachar(id) as "alDia",           -- con la mensualidad vencida no aparece en el directorio
         data->'pv'         as pv                  -- versión del plano en que marcó su lugar
  from vendedores;
revoke all on vendedores_publico from anon;
grant select on vendedores_publico to authenticated;

-- ---------- Protección de campos (nadie se regala meses, ni roba placas, etc.) ----------
create or replace function proteger_campos() returns trigger
language plpgsql security definer set search_path = public as $$
declare ahora bigint := ahora_ms();
begin
  new.updated_at := now();
  -- administración, o cambios hechos desde el SQL Editor (sin usuario de la app)
  if es_admin() or auth.uid() is null then return new; end if;

  if tg_table_name = 'vendedores' then
    if tg_op = 'INSERT' then
      new.data := (new.data - 'pagadoHasta') || jsonb_build_object('creado', ahora);
    else
      new.data := (new.data - 'pagadoHasta' - 'creado')
        || jsonb_build_object('creado', coalesce(old.data->'creado', to_jsonb(ahora)))
        || case when old.data ? 'pagadoHasta' then jsonb_build_object('pagadoHasta', old.data->'pagadoHasta') else '{}'::jsonb end;
    end if;

  elsif tg_table_name = 'carretilleros' and tg_op = 'UPDATE' then
    new.data := jsonb_set(new.data, '{vendedor}', old.data->'vendedor');

  elsif tg_table_name = 'compradores' and tg_op = 'UPDATE' then
    new.data := jsonb_set(new.data, '{owner}', old.data->'owner');

  elsif tg_table_name = 'despachos' and tg_op = 'UPDATE' then
    if old.data->>'vendedor' is distinct from yo() then
      -- el comprador solo confirma o reclama; todo lo demás se conserva
      if new.data->>'estado' not in ('entregado','reclamo') then
        raise exception 'El comprador solo puede confirmar o reclamar';
      end if;
      new.data := (old.data - 'estado' - 't' - 'verif' - 'reclamo')
        || jsonb_strip_nulls(jsonb_build_object('estado', new.data->'estado', 't', new.data->'t',
                                                'verif', new.data->'verif', 'reclamo', new.data->'reclamo'));
      -- la fecha de creación no la cambia el comprador
      if old.data->'t' ? 'creado' then
        new.data := jsonb_set(new.data, '{t,creado}', old.data->'t'->'creado');
      end if;
    else
      new.data := jsonb_set(new.data, '{vendedor}', old.data->'vendedor');
      if old.data->>'estado' in ('entregado','reclamo') and new.data->>'estado' = 'en_ruta' then
        new.data := new.data || jsonb_strip_nulls(jsonb_build_object('estado', old.data->'estado', 't', old.data->'t',
                                                  'verif', old.data->'verif', 'reclamo', old.data->'reclamo'));
      end if;
    end if;
    if old.data ? 'pagoK' and jsonb_typeof(old.data->'pagoK') = 'object' and jsonb_typeof(new.data->'pagoK') is distinct from 'object' then
      new.data := new.data || jsonb_build_object('pagoK', old.data->'pagoK');
    end if;

  elsif tg_table_name = 'pagos' and tg_op = 'INSERT' then
    -- un solo pago pendiente por vendedor (evita "pagos" falsos para seguir despachando)
    if exists (select 1 from pagos where vendedor = new.data->>'vendedor' and estado = 'pendiente') then
      raise exception 'Ya tienes un pago pendiente de revisión';
    end if;
    new.data := new.data || jsonb_build_object('estado', 'pendiente', 't', ahora);
  end if;

  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['vendedores','compradores','carretilleros','despachos','pagos','zonas','config','calibracion'] loop
    execute format('drop trigger if exists proteger_campos on %I', t);
    execute format('create trigger proteger_campos before insert or update on %I for each row execute function proteger_campos()', t);
  end loop;
end $$;

-- ---------- Columnas de búsqueda: se copian del dato (no se pueden falsear) ----------
-- Son columnas normales (no "generadas") para que los avisos en vivo puedan filtrarlas.
create or replace function z_columnas() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'compradores' then
    new.owner := new.data->>'owner';
    new.activo := coalesce((new.data->>'activo')::boolean, true);
  elsif tg_table_name = 'carretilleros' then
    new.vendedor := new.data->>'vendedor';
  elsif tg_table_name = 'despachos' then
    new.vendedor := new.data->>'vendedor';
    new.placa := new.data->>'placa';
    new.carretillero := new.data->>'carretillero';
    new.estado := new.data->>'estado';
    new.creado := ((new.data->'t'->>'creado')::numeric)::bigint;
    new.archivado := coalesce((new.data->>'archivado')::boolean, false);
    new.pagado := coalesce(jsonb_typeof(new.data->'pagoK') = 'object', false);
  elsif tg_table_name = 'pagos' then
    new.vendedor := new.data->>'vendedor';
    new.estado := new.data->>'estado';
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['compradores','carretilleros','despachos','pagos'] loop
    execute format('drop trigger if exists z_columnas on %I', t);
    execute format('create trigger z_columnas before insert or update on %I for each row execute function z_columnas()', t);
  end loop;
end $$;

-- ---------- Avisos en vivo (Realtime) ----------
do $$ declare t text; begin
  foreach t in array array['vendedores','compradores','carretilleros','despachos','pagos','zonas','config','actividad'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ---------- Fotos (Storage) ----------
-- fotos:        fotos de vehículos (lectura pública con nombre al azar)
-- comprobantes: capturas de Pago Móvil (privadas: el vendedor y la administración)
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;
    insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false) on conflict (id) do nothing;

    drop policy if exists cargaya_fotos_subir on storage.objects;
    drop policy if exists cargaya_comp_subir  on storage.objects;
    drop policy if exists cargaya_comp_ver    on storage.objects;
    create policy cargaya_fotos_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy cargaya_comp_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy cargaya_comp_ver on storage.objects for select to authenticated
      using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = (select auth.uid())::text or es_admin()));
  end if;
end $$;

-- ---------- Resumen del día para la administración (calculado en el servidor) ----------
create or replace function resumen_admin(desde bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  select jsonb_build_object(
    'total', count(*),
    'entregados', count(*) filter (where estado = 'entregado' and data->'t'->>'entregado' is not null),
    'en_ruta', count(*) filter (where estado = 'en_ruta'),
    'reclamos', count(*) filter (where estado = 'reclamo'),
    'prom_min', coalesce(round(avg(((data->'t'->>'entregado')::numeric - creado) / 60000)
                  filter (where estado = 'entregado' and data->'t'->>'entregado' is not null)), 0))
    into r from despachos where creado >= desde;
  r := r || jsonb_build_object(
    'zonas', (select coalesce(jsonb_object_agg(z, x), '{}') from (
        select coalesce(nullif(c.data->>'zona', ''), 'Sin zona') z,
               jsonb_build_object('en_ruta', count(*) filter (where d.estado = 'en_ruta'),
                                  'entregados', count(*) filter (where d.estado = 'entregado'),
                                  'reclamos', count(*) filter (where d.estado = 'reclamo')) x
        from despachos d left join compradores c on c.id = d.placa
        where d.creado >= desde group by 1) t),
    'carr', (select coalesce(jsonb_object_agg(carretillero, x), '{}') from (
        select carretillero, jsonb_build_object('hoy', count(*), 'ok', count(*) filter (where estado = 'entregado'),
                                                'recl', count(*) filter (where estado = 'reclamo')) x
        from despachos where creado >= desde and carretillero is not null group by 1) t),
    'por_cobrar', (select coalesce(jsonb_object_agg(carretillero, n), '{}') from (
        select carretillero, count(*) n from despachos
        where creado >= desde - 30::bigint * 86400000 and not pagado and estado <> 'en_ruta' and carretillero is not null group by 1) t),
    'placas_en_ruta', (select coalesce(jsonb_agg(distinct placa), '[]') from despachos where creado >= desde and estado = 'en_ruta'));
  return r;
end $$;
revoke all on function resumen_admin(bigint) from anon, public;
grant execute on function resumen_admin(bigint) to authenticated;

-- ---------- Invitación entre compradores ----------
-- El amigo invitado recibe el primer nombre y los vendedores favoritos de quien lo invitó (nada más).
create or replace function invitacion_amigo(codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nombre', split_part(coalesce(data->>'nombre', ''), ' ', 1),
                            'favoritos', coalesce(data->'favoritos', '[]'::jsonb))
  from compradores where owner = codigo and codigo is distinct from yo() limit 1 $$;
-- Cuántos amigos entraron con mi invitación
create or replace function amigos_invitados() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from compradores where data->>'referidoPor' = yo() $$;
revoke all on function invitacion_amigo(text) from anon, public;
revoke all on function amigos_invitados() from anon, public;
grant execute on function invitacion_amigo(text) to authenticated;
grant execute on function amigos_invitados() to authenticated;

-- ---------- Respaldo: descarga completa solo para la administración ----------
create or replace function respaldo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  return jsonb_build_object(
    'fecha', now(),
    'vendedores',    (select coalesce(jsonb_agg(data), '[]') from vendedores),
    'compradores',   (select coalesce(jsonb_agg(data), '[]') from compradores),
    'carretilleros', (select coalesce(jsonb_agg(data), '[]') from carretilleros),
    'pagos',         (select coalesce(jsonb_agg(data), '[]') from pagos),
    'zonas',         (select coalesce(jsonb_agg(data), '[]') from zonas),
    'config',        (select coalesce(jsonb_agg(data), '[]') from config));
end $$;
revoke all on function respaldo() from anon, public;
grant execute on function respaldo() to authenticated;

-- ---------- Administración: cambiar el PIN de un usuario sin entrar a Supabase ----------
create or replace function cambiar_pin(tel_digitos text, pin_nuevo text) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare n int;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if pin_nuevo !~ '^\d{6}$' then raise exception 'El PIN debe tener 6 números'; end if;
  if tel_digitos !~ '^\d{8,15}$' then raise exception 'Teléfono inválido'; end if;
  update auth.users set encrypted_password = crypt(pin_nuevo, gen_salt('bf')), updated_at = now()
   where email like tel_digitos || '@%';   -- tel_digitos ya validado: solo dígitos
  get diagnostics n = row_count;
  if n = 0 then return 'No existe una cuenta con ese teléfono'; end if;
  insert into actividad (m) values ('🔑 La administración cambió el PIN del teléfono ' || tel_digitos);
  return 'ok';
end $$;
revoke all on function cambiar_pin(text, text) from anon, public;
grant execute on function cambiar_pin(text, text) to authenticated;

-- ---------- Tu cuenta de administración ----------
-- 1) Crea tu usuario en Authentication → Users → Add user (ver guía).
-- 2) Esta línea lo marca como administrador (cambia el teléfono si hace falta):
insert into admins (uid) select id from auth.users where email = '5491124629918@cargaya.app' on conflict do nothing;

-- Que la API vea las funciones nuevas enseguida
notify pgrst, 'reload schema';
