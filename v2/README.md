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
- **Administradores desde la app** (Panel → Administradores): agregar por teléfono a alguien que ya tiene cuenta, o crear la cuenta con un PIN; quitar administradores.
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

## Recuperar el PIN con la palabra secreta (autogestión) — desde v2.12
Al crear la cuenta, vendedores y compradores eligen una **palabra secreta** (se guarda cifrada, nadie la puede leer).
Si olvidan el PIN: **Ya tengo cuenta → 🔑 ¿Olvidaste tu PIN?** → teléfono + palabra secreta + PIN nuevo.
No importan mayúsculas ni acentos. 5 intentos fallidos bloquean la recuperación de esa cuenta por 1 hora (queda en Actividad).
Las cuentas que ya existían reciben un aviso al entrar para crear su palabra; se cambia tocando **🔑 palabra** en el encabezado.
Puesta en marcha: Supabase → SQL Editor → pegar y ejecutar `palabra-secreta.sql` (una sola vez).

## Carretilleros con teléfono (app CargaYa Carretillero) — desde v2.14
Cuarto módulo: `carretillero.html`. Queda **apagado** hasta que la administración lo enciende.
- Puesta en marcha (una sola vez): Supabase → SQL Editor → pegar y ejecutar `carretillero-movil.sql`.
- Encender: Administración → Carretilleros → **📱 Carretilleros con teléfono → Activar**.
- El vendedor, en Mis carretilleros, toca **📱 Activar su teléfono**: sale un QR/código de 6 letras (vence en 48 h, un solo uso).
- El carretillero lo escanea, crea su cuenta (teléfono + PIN + palabra secreta) y queda vinculado a su número de siempre.
- Ve sus entregas en vivo (con aviso), y **📍 Llévame** muestra su GPS y el vehículo del comprador en el plano, con la ruta por los pasillos, los metros que faltan, la foto, WhatsApp al comprador y Google Maps.
- Muestra su credencial en pantalla para que el comprador la escanee. La credencial impresa y la papeleta siguen funcionando.
- Permisos: el carretillero solo ve sus despachos y los vehículos a los que lleva carga en ese momento; no edita nada.

## Reclamos por faltantes — desde v2.18
- Comprador: al recibir (o hasta 24 h después de confirmar) reporta qué faltó, con foto opcional. WhatsApp al vendedor con el mensaje ya escrito.
- Vendedor: alarma (sonido x3 + vibración), aviso rojo fijo en todas las pestañas y tarjeta "Reclamos por atender" en Despachar; WhatsApp al comprador ya escrito; cierra con Repuse / Descuento / No corresponde + nota. El comprador recibe el aviso.
- Administración → Panel: reclamos de 30 días, sin resolver, tiempo promedio, por vendedor y por carretillero.
- Excel: la columna Reclamo incluye la resolución.
- Base de datos: pegar `reclamos.sql` una vez (foto del reclamo, el vendedor no puede cambiar lo que escribió el comprador, un reclamo nuevo se reabre).

## Avisos push — desde v2.19
Suenan aunque la app esté cerrada (Android; iPhone con iOS 16.4+ y la app instalada en inicio).
- App: tarjeta "🔔 Activa los avisos" (vendedor, comprador, carretillero); al salir de la cuenta el teléfono se da de baja.
- Base de datos: `push.sql` (tabla push_subs, disparadores en despachos y pagos que llaman con pg_net a la función).
- Función: `supabase/functions/enviar-push` (web-push + VAPID). Secretos: VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRETO. Verify JWT desactivado.
- Configurar la dirección y el secreto: `select push_configurar('https://<proyecto>.supabase.co/functions/v1/enviar-push','<PUSH_SECRETO>');`
- La clave pública VAPID va en config.js (VAPID_PUBLIC).
