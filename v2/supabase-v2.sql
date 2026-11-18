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

-- ---------- Métricas de uso (administración) ----------
-- Totales, evolución por día y por semana, y detalle por comprador y por vendedor.
create or replace function metricas_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hoy0 bigint := (extract(epoch from date_trunc('day', now())) * 1000)::bigint;
        d30 bigint; d7 bigint; d112 bigint; r jsonb;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  d30 := hoy0 - 30::bigint * 86400000; d7 := hoy0 - 7::bigint * 86400000; d112 := hoy0 - 112::bigint * 86400000;
  with
  dd as materialized (
    select placa, vendedor, estado, creado, data->'verif'->>'metodo' metodo,
           (data->'t'->>'entregado')::numeric ent, coalesce((data->>'bultos')::numeric, 0) bultos
    from despachos),
  tot as (
    select count(*) total, count(*) filter (where creado >= hoy0) hoy, count(*) filter (where creado >= d7) d7n, count(*) filter (where creado >= d30) d30n,
           coalesce(sum(bultos) filter (where creado >= d30), 0) bultos30,
           count(*) filter (where creado >= d30 and estado = 'entregado') ok30,
           count(*) filter (where creado >= d30 and metodo = 'carnet') carnet30,
           count(*) filter (where creado >= d30 and metodo = 'boton') boton30,
           count(*) filter (where creado >= d30 and metodo = 'vendedor') vend30,
           count(*) filter (where creado >= d30 and estado = 'reclamo') recl30,
           coalesce(round(avg((ent - creado) / 60000) filter (where creado >= d30 and estado = 'entregado' and ent is not null)), 0) prom30,
           count(distinct placa) filter (where creado >= d30) compr30, count(distinct placa) compr_tot,
           count(distinct vendedor) filter (where creado >= d7) vend7, count(distinct vendedor) filter (where creado >= d30) vend30d
    from dd),
  pc as (select placa, count(*) n, count(*) filter (where creado >= d30) n30, count(*) filter (where creado >= d7) n7,
                count(*) filter (where estado = 'entregado') ok, count(*) filter (where estado = 'reclamo') rc,
                count(distinct vendedor) nv, max(creado) ult, count(distinct (creado / 86400000)) dias from dd group by placa),
  pv as (select vendedor, count(*) n, count(*) filter (where creado >= d30) n30, count(*) filter (where creado >= d7) n7, count(*) filter (where creado >= hoy0) nh,
                count(*) filter (where estado = 'reclamo') rc, count(distinct placa) nc, max(creado) ult, count(distinct (creado / 86400000)) dias from dd group by vendedor),
  kv as (select vendedor, count(*) n from carretilleros where coalesce((data->>'baja')::boolean, false) = false group by vendedor),
  iv as (select data->>'invitadoPor' v, count(*) n from compradores where data->>'invitadoPor' is not null group by 1),
  cm as (select count(*) total, count(*) filter (where activo) activos,
                count(*) filter (where coalesce((data->>'creado')::numeric, 0) >= d7) n7, count(*) filter (where coalesce((data->>'creado')::numeric, 0) >= d30) n30,
                count(*) filter (where coalesce((data->>'llegada')::numeric, 0) >= d7) vin7,
                count(*) filter (where data->>'invitadoPor' is not null) inv_v, count(*) filter (where data->>'referidoPor' is not null) inv_a,
                count(*) filter (where jsonb_array_length(coalesce(data->'favoritos', '[]')) > 0) fav from compradores),
  vm as (select count(*) total, count(*) filter (where coalesce((data->>'creado')::numeric, 0) >= d30) n30,
                count(*) filter (where puede_despachar(id)) al_dia, count(*) filter (where data ? 'pagadoHasta') pagaron from vendedores)
  select jsonb_build_object(
    'generado', ahora_ms(),
    'compradores', (select jsonb_build_object('total', total, 'activos_ahora', activos, 'nuevos_7d', n7, 'nuevos_30d', n30, 'vinieron_7d', vin7,
        'invitados_vendedor', inv_v, 'invitados_amigo', inv_a, 'con_favoritos', fav,
        'con_despacho_30d', (select compr30 from tot), 'con_despacho_total', (select compr_tot from tot)) from cm),
    'vendedores', (select jsonb_build_object('total', total, 'nuevos_30d', n30, 'al_dia', al_dia, 'pagaron_alguna_vez', pagaron,
        'con_despacho_7d', (select vend7 from tot), 'con_despacho_30d', (select vend30d from tot),
        'carretilleros_activos', (select coalesce(sum(n), 0) from kv)) from vm),
    'despachos', (select jsonb_build_object('total', total, 'hoy', hoy, 'd7', d7n, 'd30', d30n, 'bultos_30d', bultos30, 'confirmados_30d', ok30,
        'por_carnet_30d', carnet30, 'por_boton_30d', boton30, 'por_vendedor_30d', vend30, 'reclamos_30d', recl30, 'prom_min_30d', prom30) from tot),
    'pagos', jsonb_build_object(
       'aprobados_30d', (select count(*) from pagos where estado = 'aprobado' and coalesce((data->>'t')::numeric, 0) >= d30),
       'monto_usd_30d', (select coalesce(sum((data->>'montoUSD')::numeric), 0) from pagos where estado = 'aprobado' and coalesce((data->>'t')::numeric, 0) >= d30),
       'pendientes', (select count(*) from pagos where estado = 'pendiente')),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('d', dia, 'despachos', n, 'compradores', c, 'vendedores', v, 'reclamos', rc) order by dia), '[]') from (
        select to_char(to_timestamp(creado / 1000) at time zone 'America/Caracas', 'YYYY-MM-DD') dia,
               count(*) n, count(distinct placa) c, count(distinct vendedor) v, count(*) filter (where estado = 'reclamo') rc
        from dd where creado >= d30 group by 1) t),
    'por_semana', (select coalesce(jsonb_agg(x order by x->>'s'), '[]') from (
        select jsonb_build_object('s', s, 'despachos', coalesce(dn, 0), 'compradores_activos', coalesce(dc, 0), 'vendedores_activos', coalesce(dv, 0),
                                  'nuevos_compradores', coalesce(nc, 0), 'nuevos_vendedores', coalesce(nv, 0)) x
        from (select to_char(generate_series(date_trunc('week', now()) - interval '15 weeks', date_trunc('week', now()), '1 week'), 'YYYY-MM-DD') s) sem
        left join (select to_char(date_trunc('week', to_timestamp(creado / 1000) at time zone 'America/Caracas'), 'YYYY-MM-DD') s, count(*) dn, count(distinct placa) dc, count(distinct vendedor) dv
                   from dd where creado >= d112 group by 1) a using (s)
        left join (select to_char(date_trunc('week', to_timestamp((data->>'creado')::numeric / 1000) at time zone 'America/Caracas'), 'YYYY-MM-DD') s, count(*) nc
                   from compradores where data->>'creado' is not null group by 1) b using (s)
        left join (select to_char(date_trunc('week', to_timestamp((data->>'creado')::numeric / 1000) at time zone 'America/Caracas'), 'YYYY-MM-DD') s, count(*) nv
                   from vendedores where data->>'creado' is not null group by 1) c using (s)) t),
    'compradores_det', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', c.id, 'nombre', c.data->>'nombre', 'tel', c.data->>'tel', 'zona', c.data->>'zona', 'activo', c.activo,
                 'creado', c.data->'creado', 'llegada', c.data->'llegada', 'favoritos', jsonb_array_length(coalesce(c.data->'favoritos', '[]')),
                 'invitado', case when c.data->>'invitadoPor' is not null then 'vendedor' when c.data->>'referidoPor' is not null then 'amigo' else '' end,
                 'total', coalesce(d.n, 0), 'd30', coalesce(d.n30, 0), 'd7', coalesce(d.n7, 0), 'confirmados', coalesce(d.ok, 0), 'reclamos', coalesce(d.rc, 0),
                 'vendedores', coalesce(d.nv, 0), 'ultimo', d.ult, 'dias_activo', coalesce(d.dias, 0)) x
        from compradores c left join pc d on d.placa = c.id
        order by coalesce(d.ult, (c.data->>'llegada')::numeric, 0) desc limit 500) t),
    'vendedores_det', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', v.id, 'nombre', v.data->>'nombre', 'tel', v.data->>'tel', 'sector', v.data->>'sector', 'productos', v.data->>'productos',
                 'creado', v.data->'creado', 'al_dia', puede_despachar(v.id), 'pagado_hasta', v.data->'pagadoHasta',
                 'carretilleros', coalesce(k.n, 0), 'invitados', coalesce(i.n, 0),
                 'total', coalesce(d.n, 0), 'd30', coalesce(d.n30, 0), 'd7', coalesce(d.n7, 0), 'hoy', coalesce(d.nh, 0), 'reclamos', coalesce(d.rc, 0),
                 'compradores', coalesce(d.nc, 0), 'ultimo', d.ult, 'dias_activo', coalesce(d.dias, 0)) x
        from vendedores v left join pv d on d.vendedor = v.id left join kv k on k.vendedor = v.id left join iv i on i.v = v.id
        order by coalesce(d.ult, 0) desc) t))
  into r;
  return r;
end $$;
revoke all on function metricas_admin() from anon, public;
grant execute on function metricas_admin() to authenticated;

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
  -- Busca la cuenta por los últimos 10 dígitos (sirve con o sin código de país, con 0 o con +58 / +54)
  select count(*) into n from auth.users where email like '%' || right(tel_digitos, 10) || '@%';
  if n = 0 then return 'No existe una cuenta con ese teléfono'; end if;
  if n > 1 then return 'Hay ' || n || ' cuentas que terminan en esos números. Escribe el teléfono completo con el código de país.'; end if;
  update auth.users set encrypted_password = crypt(pin_nuevo, gen_salt('bf')), updated_at = now()
   where email like '%' || right(tel_digitos, 10) || '@%';
  insert into actividad (m) values ('🔑 La administración cambió el PIN del teléfono ' || tel_digitos);
  return 'ok';
end $$;
revoke all on function cambiar_pin(text, text) from anon, public;
grant execute on function cambiar_pin(text, text) to authenticated;

-- ---------- Administradores: ver, agregar y quitar desde la app ----------
create or replace function admins_lista() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select coalesce(jsonb_agg(jsonb_build_object('uid', a.uid, 'tel', split_part(u.email, '@', 1),
           'nombre', coalesce(u.raw_user_meta_data->>'nombre', ''), 'soy', a.uid = auth.uid()) order by u.created_at), '[]')
  from admins a join auth.users u on u.id = a.uid where es_admin() $$;

-- Agrega como administrador a una cuenta que ya existe (la persona crea su cuenta en cualquier módulo).
-- Si la cuenta no existe y se pasa un PIN, la crea.
create or replace function agregar_admin(tel_digitos text, pin_nuevo text default null) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare u uuid; n int; email_nuevo text;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if tel_digitos !~ '^\d{8,15}$' then raise exception 'Teléfono inválido'; end if;
  select count(*), (array_agg(id))[1] into n, u from auth.users where email like '%' || right(tel_digitos, 10) || '@%';
  if n > 1 then return 'Hay varias cuentas que terminan en esos números. Escribe el teléfono completo con código de país.'; end if;
  if n = 0 then
    if pin_nuevo is null or pin_nuevo !~ '^\d{6}$' then return 'No existe una cuenta con ese teléfono. Escribe un PIN de 6 números para crearla.'; end if;
    email_nuevo := tel_digitos || '@cargaya.app';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', email_nuevo, crypt(pin_nuevo, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('rol', 'admin', 'tel', tel_digitos), now(), now(), '', '', '', '')
    returning id into u;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u, u::text, jsonb_build_object('sub', u::text, 'email', email_nuevo, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into admins (uid) values (u) on conflict do nothing;
  insert into actividad (m) values ('👤 La administración agregó un administrador: teléfono ' || tel_digitos);
  return 'ok';
end $$;

create or replace function quitar_admin(uid_quitar uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if uid_quitar = auth.uid() then return 'No puedes quitarte a ti mismo. Pídeselo a otro administrador.'; end if;
  if (select count(*) from admins) <= 1 then return 'Debe quedar al menos un administrador.'; end if;
  delete from admins where uid = uid_quitar;
  insert into actividad (m) values ('👤 La administración quitó un administrador');
  return 'ok';
end $$;
revoke all on function admins_lista() from anon, public;
revoke all on function agregar_admin(text, text) from anon, public;
revoke all on function quitar_admin(uuid) from anon, public;
grant execute on function admins_lista() to authenticated;
grant execute on function agregar_admin(text, text) to authenticated;
grant execute on function quitar_admin(uuid) to authenticated;

-- ---------- Tu cuenta de administración ----------
-- 1) Crea tu usuario en Authentication → Users → Add user (ver guía).
-- 2) Esta línea lo marca como administrador (cambia el teléfono si hace falta):
insert into admins (uid) select id from auth.users where email = '5491124629918@cargaya.app' on conflict do nothing;

-- Que la API vea las funciones nuevas enseguida
notify pgrst, 'reload schema';

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
