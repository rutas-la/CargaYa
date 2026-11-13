-- Datos simulados: :nv vendedores, :nc compradores, 40 despachos por vendedor por día, :dias días
alter table despachos disable trigger zz_notify; alter table compradores disable trigger zz_notify; alter table vendedores disable trigger zz_notify; alter table carretilleros disable trigger zz_notify;
truncate despachos,pagos,compradores,carretilleros,vendedores,actividad; delete from admins; delete from auth.users;
insert into auth.users(id,email,encrypted_password,raw_user_meta_data)
  select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid, '58412'||lpad(i::text,7,'0')||'@cargaya.app', crypt('123456',gen_salt('bf',4)),
         jsonb_build_object('rol','vendedor','nombre','Vendedor '||i,'tel','0412'||lpad(i::text,7,'0'))
  from generate_series(1,3) i;
insert into auth.users(id,email,encrypted_password,raw_user_meta_data)
  select ('00000000-0000-0000-0001-'||lpad(i::text,12,'0'))::uuid, '58414'||lpad(i::text,7,'0')||'@cargaya.app', crypt('654321',gen_salt('bf',4)),
         jsonb_build_object('rol','comprador','nombre','Comprador '||i,'tel','0414'||lpad(i::text,7,'0'),'placa','P'||lpad(i::text,6,'0'))
  from generate_series(1,3) i;
insert into auth.users(id,email,encrypted_password) values('00000000-0000-0000-0002-000000000001','584141111111@cargaya.app',crypt('999999',gen_salt('bf',4)));
insert into admins values('00000000-0000-0000-0002-000000000001');
insert into vendedores(id,data) select '00000000-0000-0000-0000-'||lpad(i::text,12,'0'),
  jsonb_build_object('id','00000000-0000-0000-0000-'||lpad(i::text,12,'0'),'nombre','Vendedor '||i,'tel','0412'||lpad(i::text,7,'0'),'productos','Papa, Cebolla','sector','La Bomba','creado',(extract(epoch from now())*1000)::bigint,'pagadoHasta',(extract(epoch from now()+interval '20 days')*1000)::bigint)
  from generate_series(1,:nv) i;
insert into carretilleros(id,data) select 'K'||lpad(i::text,6,'0'), jsonb_build_object('id','K'||lpad(i::text,6,'0'),'vendedor','00000000-0000-0000-0000-'||lpad(((i-1)/3+1)::text,12,'0'),'num',lpad(((i-1)%3+1)::text,2,'0'),'nombre','Carretillero '||i)
  from generate_series(1,:nv*3) i;
insert into compradores(id,data) select 'P'||lpad(i::text,6,'0'), jsonb_build_object('id','P'||lpad(i::text,6,'0'),'owner','00000000-0000-0000-0001-'||lpad(i::text,12,'0'),'nombre','Comprador '||i,'tel','0414'||lpad(i::text,7,'0'),'vehiculo','Camión blanco','zona','La Bomba','activo',true,'foto','https://example.com/fotos/'||md5(i::text)||'.jpg')
  from generate_series(1,:nc) i;
insert into despachos(id,data)
  select 'D'||n, jsonb_build_object('id','D'||n,'vendedor','00000000-0000-0000-0000-'||lpad(v::text,12,'0'),'placa','P'||lpad((1+(n*7919)%:nc)::text,6,'0'),
    'items',jsonb_build_array(jsonb_build_object('desc','Papa','bultos',2),jsonb_build_object('desc','Tomate','bultos',1)),'desc','Papa, Tomate','bultos',3,
    'carretillero','K'||lpad(((v-1)*3+1+n%3)::text,6,'0'),'ficha',null,
    'estado',case when d=0 and n%5=0 then 'en_ruta' when n%37=0 then 'reclamo' else 'entregado' end,
    't',jsonb_build_object('creado',t,'entregado',t+900000),'verif',jsonb_build_object('metodo','boton'),
    'archivado',d>0,'pagoK',case when d>0 or n%3=0 then jsonb_build_object('monto',50,'moneda','Bs','metodo','efectivo','ref','','t',t+1800000) else null end)
  from (select n, 1+(n%:nv) v, (n/(:nv*40)) d,
          (extract(epoch from date_trunc('day',now()) - make_interval(days=>(n/(:nv*40))::int) + interval '6 hours')*1000)::bigint + (n%(:nv*40))*1000 t
        from generate_series(0,:nv*40*:dias-1) n) x;
alter table despachos enable trigger zz_notify; alter table compradores enable trigger zz_notify; alter table vendedores enable trigger zz_notify; alter table carretilleros enable trigger zz_notify;
analyze;
select (select count(*) from vendedores) v,(select count(*) from compradores) c,(select count(*) from despachos) d, pg_size_pretty(pg_total_relation_size('despachos')) tam;
