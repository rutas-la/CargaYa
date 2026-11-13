-- Solo pruebas locales: emula el flujo de cambios de Supabase Realtime
create or replace function cy_notify() returns trigger language plpgsql as $$
begin perform pg_notify('cy_changes', json_build_object('table',tg_table_name,'type',tg_op,'id',new.id)::text); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['vendedores','compradores','carretilleros','despachos','pagos','zonas','config','actividad'] loop
    execute format('drop trigger if exists zz_notify on %I', t);
    execute format('create trigger zz_notify after insert or update on %I for each row execute function cy_notify()', t);
  end loop; end $$;
