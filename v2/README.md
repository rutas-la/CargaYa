# CargaYa v2 · versión escalable

Misma app que el piloto, con la base de datos rehecha para cientos o miles de vendedores.

Dirección: https://rutas-la.github.io/CargaYa/v2/

| Módulo | Enlace |
|---|---|
| Vendedor | https://rutas-la.github.io/CargaYa/v2/vendedor.html |
| Comprador | https://rutas-la.github.io/CargaYa/v2/comprador.html |
| Administración | https://rutas-la.github.io/CargaYa/v2/admin.html |

## Qué cambia respecto del piloto

- **Cada teléfono descarga solo lo suyo.** El vendedor, sus despachos del último mes que siguen abiertos o sin pagar; el comprador, los de su placa de la última semana; la administración, lo del día en curso. El historial y el Excel se piden al servidor cuando se abren.
- **Avisos en vivo filtrados.** Cada vendedor escucha solo sus despachos y cada comprador solo su placa.
- **Privacidad.** Un comprador no ve a otros compradores ni despachos ajenos. Un vendedor no ve despachos ni pagos de otros vendedores. El directorio de vendedores no muestra datos de cobro.
- **La mensualidad la controla el servidor.** Un vendedor vencido no puede despachar aunque tenga la app vieja abierta.
- **Fotos en Storage.** Fotos de vehículos y capturas de Pago Móvil ya no van dentro de la base de datos. Las capturas son privadas.
- **Pestaña Uso** en administración: métricas de uso real (compradores y vendedores registrados y activos, despachos por día y por semana, confirmaciones, reclamos, cobros) con detalle por comprador y por vendedor y descarga en Excel.
- **Panel de administración con números calculados en el servidor**, botón de **respaldo** y botón para **cambiar el PIN** de un usuario.
- Librería de Supabase incluida en la app (no depende de un CDN externo).

## Instalación en Supabase (proyecto cargaya-v2)

1. **Authentication → Sign In / Providers → Email**: desactivar **Confirm email** y guardar.
2. **Authentication → Users → Add user → Create new user**:
   email `5491124629918@cargaya.app`, contraseña = tu PIN de administración (6 números), marcar **Auto Confirm User**.
3. **SQL Editor → New query**: pegar todo el contenido de `supabase-v2.sql` y tocar **Run**. Debe decir *Success*.
4. Abrir el módulo de administración y entrar con tu teléfono y PIN.
5. En **Cobros → Ajustes** cargar los datos de Pago Móvil, y en **Zonas** las zonas del mercado.

El archivo SQL se puede volver a ejecutar cuando haya cambios: no borra datos.

## Capacidad medida (pruebas con datos simulados)

| Escenario | Vendedor abre la app | Comprador | Administración |
|---|---|---|---|
| 100 vendedores · 500 compradores · 120.000 despachos | 0,3 s · 167 KB | 0,2 s · 47 KB | — |
| 1000 vendedores · 5000 compradores · 40.000 despachos por día | 0,3 s · 1,3 MB | 0,2 s · 185 KB | 0,8 s · 5,8 MB |

Espacio: unos 1 KB por despacho (100 vendedores ≈ 4 MB por día).

## Cuándo pasar a Supabase Pro

- Más de ~150 personas conectadas a la vez en la hora pico (el plan gratis permite 200).
- La base pasa de ~300 MB (límite gratis: 500 MB).
- Antes de abrir a los vendedores de forma masiva (Pro incluye copias de seguridad diarias y no se pausa).
