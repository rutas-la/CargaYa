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

## Cómo funciona (versión sin teléfono para el carretillero)
1. **Comprador:** al estacionar, marca su vehículo con el GPS del teléfono, con tipo, color y foto. La app le asigna la **zona** del cartel más cercano (A1, B3…).
2. **Vendedor:** escribe la placa, escanea el **carnet** del carretillero y una **ficha** en blanco, y toca *Despachar*. La pantalla muestra la ZONA en grande para el carretillero.
3. **Carretillero (sin teléfono):** busca el cartel de la zona y el vehículo por la descripción y la placa, y deja la mercancía con la ficha.
4. **Comprador:** escanea la ficha y confirma, o reporta un faltante.
5. **Administración:** registra las zonas parándose junto a cada cartel, administra los carretilleros, imprime fichas, carnets y carteles, y sigue todo en el panel.

La guía para la persona en el mercado está en `guia.html`.
