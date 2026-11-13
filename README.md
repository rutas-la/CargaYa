# CargaYa · prueba piloto

Tres módulos, cada uno con su link: **comprador.html**, **vendedor.html** y **admin.html** (la portada `index.html` lleva a los tres).

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

## Inicio de sesión: activar una sola vez en Supabase
Las cuentas se crean con **teléfono + PIN de 6 números**, sin emails ni SMS. La seguridad está en la base de datos: cada vendedor solo toca sus despachos y no puede cambiar su fecha de pago; el comprador solo confirma o reclama lo de su placa; los pagos, las zonas y los ajustes de cobro son de Administración.

1. **Desactivar la confirmación por email:** Supabase → **Authentication** → **Sign In / Providers** → **Email** → apaga **Confirm email** → **Save**.
2. **Reglas de seguridad:** SQL Editor → New query → pega `supabase-seguridad.sql` → **Run**. (Borra los datos de prueba anteriores.)
3. **Tu cuenta de administración:** Authentication → **Users** → **Add user** → **Create new user**:
   - Email: tu teléfono solo con números y código de país + `@cargaya.app` (ej: `584141234567@cargaya.app`)
   - Password: tu PIN de 6 números
   - Marca **Auto Confirm User** → **Create user**
4. **Márcate como administrador:** en el SQL Editor (cambia el email por el tuyo):
   ```sql
   insert into admins (uid) select id from auth.users where email = '584141234567@cargaya.app';
   ```
5. Entra a **admin.html** → tu teléfono y PIN.

**Cambiar el PIN de alguien que lo olvidó** (SQL Editor; cambia teléfono y PIN nuevo):
```sql
update auth.users set encrypted_password = extensions.crypt('654321', extensions.gen_salt('bf'))
where email = '584121234567@cargaya.app';
```

## Cobro mensual (Pago Móvil)
- **Administración → Cobros → Ajustes:** precio mensual en US$, tasa del día (Bs por US$), tus datos de Pago Móvil (banco, teléfono, cédula o RIF), días de prueba gratis, días de gracia y tu WhatsApp para recibir avisos.
- **Vendedor:** en la pestaña *Mensualidad* ve su estado (prueba, al día, vencida). Con **Pagar mes** ve tus datos con botones para copiarlos y el monto en Bs. Después de pagar carga la referencia, el banco, el teléfono, el monto y la captura, y te avisa por WhatsApp.
- **Administración → Cobros → Por revisar:** compara con tu banco y toca **Aprobar** (+1 mes desde el vencimiento o desde hoy) o **Rechazar** con el motivo. En **Vendedores** se puede dar un mes sin pago.
- Si la suscripción vence y pasan los días de gracia, el vendedor **no puede despachar**, salvo que tenga un pago en revisión.
- Una referencia ya cargada no se puede volver a cargar.
- La tasa no se actualiza sola: cárgala en Ajustes cuando cambie.


## Cómo funciona (versión sin teléfono para el carretillero)
1. **Comprador:** al estacionar, elige de una lista la **zona** donde dejó el vehículo, con los nombres que usan en el mercado (ej: "Detrás del Barco"), y registra tipo, color, referencia y foto. Opcionalmente toca en el plano dónde quedó el vehículo. **No se usa GPS.**
2. **Vendedor:** en la pestaña *Mi ubicación* indica qué vende y su sector (sin GPS); opcionalmente marca su lugar exacto en el plano. En la misma pestaña tiene **Invita a tus compradores**: un QR y un enlace propios (`comprador.html?v=<id>`); el comprador que entra con ellos queda con ese vendedor en sus favoritos automáticamente. Crea y administra sus carretilleros (pestaña *Mis carretilleros*: agregar, imprimir credencial, dar de baja). Al despachar escribe la placa, toca el carretillero y *Despachar*. También puede usar un carretillero de otro vendedor escaneando su credencial. Cuando el carretillero vuelve, el vendedor registra el pago del viaje (efectivo o Pago Móvil) y en *Pagos* ve lo pendiente por carretillero, con el monto que acuerden en cada viaje y pago de varios viajes juntos. Puede quitar despachos de su lista (quedan archivados) y ver todo en *Historial*, con filtros y descarga a Excel. Nada se borra de la base de datos. La pantalla muestra el nombre de la zona en grande para el carretillero.
3. **Carretillero (sin teléfono):** va a la zona y busca el vehículo por la descripción, la placa y la referencia, y deja la mercancía.
4. **Comprador:** en la pestaña *Vendedores* busca por producto o sector, marca favoritos y, con *¿Dónde estoy?* (GPS del comprador, opcional), ve la distancia aproximada y la dirección a cada vendedor, ordenados por cercanía. Solo aparecen vendedores con la suscripción al día o en prueba.
   **Al recibir:** en la app toca *Ya me llegó* y **escanea el carnet del carretillero**. Si es el asignado, la entrega queda verificada. Si no está presente, puede confirmar sin escanear, y queda registrado así.
5. **Administración:** cobros, zonas (nombre y ubicación en el plano), carretilleros de todos los vendedores (agregar e imprimir credenciales) y panel.

La guía para la persona en el mercado está en `guia.html`.
