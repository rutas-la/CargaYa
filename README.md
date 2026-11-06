# CargaYa · prueba piloto

App para el Mercado Mayor de Coche (Caracas). Conecta a vendedores, compradores y carretilleros para que cada entrega llegue al vehículo correcto y quede verificada. Funciona desde el celular, en el navegador, sin instalar nada.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa |
| `config.js` | Los datos de conexión a Supabase y los ajustes (clave del panel, geocerca) |
| `supabase.sql` | Crea la base de datos (se ejecuta una sola vez) |
| `manifest.webmanifest`, `icon.svg` | Permiten agregar la app a la pantalla de inicio del teléfono |

## Puesta en marcha (unos 20 minutos)

### 1. Base de datos en Supabase (gratis)
1. Entrá a https://supabase.com y creá una cuenta.
2. **New project**: ponele de nombre `cargaya`, elegí una contraseña y la región **East US** (la más cercana a Caracas).
3. Cuando termine de crearse, abrí **SQL Editor → New query**, pegá todo el contenido de `supabase.sql` y tocá **Run**.
4. Andá a **Project Settings → API** y copiá dos datos:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public key** (un texto largo que empieza con `eyJ...`)

### 2. Configurar la app
Abrí `config.js` y pegá esos dos datos en `SUPABASE_URL` y `SUPABASE_KEY`. Cambiá también `CLAVE_ADMIN`, que es la clave del panel del mercado.

> La clave "anon" es pública: se puede ver dentro de la página y está bien que así sea. **Nunca** pegues la clave `service_role`.

### 3. Publicar en GitHub Pages
1. Creá un repositorio público llamado `CargaYa` y subí todos los archivos.
2. En el repositorio, entrá a **Settings → Pages**. En **Source** elegí `Deploy from a branch`, después la rama `main` y la carpeta `/ (root)`, y guardá.
3. Al minuto, la app queda en `https://<tu-usuario>.github.io/cargaya/`.

### 4. Probar antes de ir al mercado
Si vas a probar desde fuera del mercado, poné `GEOCERCA_ACTIVA: false` en `config.js`. Abrí el link en tres teléfonos (o en tres navegadores distintos) y hacé el recorrido completo. **Antes de la prueba real**, volvé a ponerlo en `true` y borrá los datos de prueba: en el SQL Editor ejecutá `delete from registros; delete from actividad;`.

## La prueba piloto: 1 vendedor, 1 carretillero, 1 comprador

**Antes del día de la prueba**
- A cada participante mandale el link por WhatsApp. Pedile que lo abra, que **acepte el permiso de ubicación** y que use "Agregar a pantalla de inicio".
- Cada uno elige su rol una sola vez. El comprador escribe la placa de su vehículo.

**El día de la prueba**
1. **Vendedor:** al llegar toca "Guardar ubicación de mi camión".
2. **Comprador:** estaciona, y **antes de alejarse del vehículo** toca "Estoy junto a mi vehículo: guardar GPS". Pone tipo y color del vehículo y saca una foto.
3. **Comprador → vendedor:** compra y le dice su placa.
4. **Vendedor:** crea el despacho y elige al carretillero.
5. **Carretillero:** le suena el aviso. Carga, toca "Salir" y sigue la flecha con la distancia. Cuando está cerca, escribe la placa, saca una foto de la mercancía en el vehículo y toca "Dejé la mercancía".
6. **Comprador:** le llega el aviso y confirma "Recibí", o da su PIN si está presente.
7. **Vos:** seguís todo en vivo desde el panel, entrando con la clave de administración.

**Qué medir**
- Minutos desde "Salir" hasta "Dejé la mercancía". Compararlo con cuánto tarda hoy un carretillero en encontrar un vehículo.
- La precisión del GPS de cada marca (aparece como "±X m").
- Si el carretillero encontró el vehículo con la distancia, la foto y la referencia.
- Qué le costó a cada uno y qué pediría que cambie.

## Limitaciones de esta versión piloto
- **Sin contraseñas:** quien tenga el link puede entrar. Alcanza para el piloto, pero no para abrirla a todo el mercado.
- **Avisos con la app abierta:** el teléfono suena y vibra solo si CargaYa está abierta en pantalla. Como respaldo están los botones de WhatsApp.
- **El plano es aproximado:** está trazado sobre una foto satelital. Las distancias que ve el carretillero salen del GPS real y no dependen del plano.
- **Sin señal:** las acciones se guardan en el teléfono y se envían cuando vuelve la conexión.
