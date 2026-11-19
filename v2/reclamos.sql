-- ============================================================
-- CargaYa v2 · Reclamos por faltantes: foto del comprador y resolución del vendedor
-- Pegar UNA vez en Supabase → SQL Editor → Run. Se puede repetir sin problema.
-- ============================================================
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
      new.data := (old.data - 'estado' - 't' - 'verif' - 'reclamo' - 'reclamoFoto')
        || jsonb_strip_nulls(jsonb_build_object('estado', new.data->'estado', 't', new.data->'t',
                                                'verif', new.data->'verif', 'reclamo', new.data->'reclamo',
                                                'reclamoFoto', new.data->'reclamoFoto'));
      -- la fecha de creación no la cambia el comprador
      if old.data->'t' ? 'creado' then
        new.data := jsonb_set(new.data, '{t,creado}', old.data->'t'->'creado');
      end if;
      -- un reclamo nuevo (o con otro texto) vuelve a quedar abierto
      if new.data->>'estado' = 'reclamo' and (old.data->>'estado' is distinct from 'reclamo'
          or old.data->'reclamo' is distinct from new.data->'reclamo') then
        new.data := new.data - 'resol';
      end if;
    else
      new.data := jsonb_set(new.data, '{vendedor}', old.data->'vendedor');
      -- el vendedor no cambia lo que escribió el comprador en su reclamo
      new.data := (new.data - 'reclamo' - 'reclamoFoto')
        || jsonb_strip_nulls(jsonb_build_object('reclamo', old.data->'reclamo', 'reclamoFoto', old.data->'reclamoFoto'));
      if old.data->'t' ? 'reclamo' then
        new.data := jsonb_set(new.data, '{t,reclamo}', old.data->'t'->'reclamo');
      end if;
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

notify pgrst, 'reload schema';
