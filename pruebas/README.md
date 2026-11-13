# Pruebas de CargaYa v2

Entorno local que imita Supabase con las reglas de seguridad reales:

- **Postgres 16** con `bootstrap.sql` (roles y esquemas de Supabase) + `../v2/supabase-v2.sql` + `notify.sql`.
- **PostgREST 12** (`pgrst.conf`) como API.
- **fakesb.py**: auth (teléfono + PIN), proxy a PostgREST, Storage en disco y Realtime (protocolo Phoenix) con filtros y RLS.

| Archivo | Qué prueba |
|---|---|
| `rls2.py` | 54 reglas de seguridad por rol (vendedor, comprador, admin) |
| `e2e_recorrido.py` | Recorrido completo de los 3 módulos en el navegador |
| `e2e_casos_limite.py` | Privacidad, carretillero ajeno, sin conexión, mensualidad vencida, invitación |
| `carga.sql` + `e2e_carga.py` | Volumen: 100 o 1000 vendedores (`psql -v nv=1000 -v nc=5000 -v dias=3 -f carga.sql`) |

Arranque:
```
createdb cy2 && psql -d cy2 -f bootstrap.sql -f ../v2/supabase-v2.sql -f notify.sql
postgrest pgrst.conf &
python3 fakesb.py .. 8780 &
python3 rls2.py && python3 e2e_recorrido.py && python3 e2e_casos_limite.py
```
