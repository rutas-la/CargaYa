-- Solo para pruebas locales: imita pg_net guardando las llamadas en net.log
create schema if not exists net;
create table if not exists net.log(id serial primary key, url text, body jsonb, headers jsonb, t timestamptz default now());
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.log(url, body, headers) values (url, body, headers) returning id::bigint $$;
