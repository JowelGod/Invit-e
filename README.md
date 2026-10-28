# Invitara

Aplicación React/Vite + Supabase (Auth, PostgreSQL, RLS, RPC y Realtime).
Repositorio: `JowelGod/Invit-e`; el remoto mantiene ese nombre.
La copia de desarrollo única está en **`~/projects/Invitara` dentro de Ubuntu-24.04/WSL2**.
El código actual usa Supabase como único backend. El historial antiguo permanece en Git.

## Inicio desde Windows

En **PowerShell**, inicia Docker Desktop y entra en Ubuntu:

```powershell
Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
wsl -d Ubuntu-24.04
```

Espera a que Docker Desktop esté listo. En **Ubuntu**:

```bash
cd ~/projects/Invitara
source ~/.profile
node --version
pnpm --version
docker version
pnpm supabase:start
pnpm env:local
pnpm dev
```

Abre <http://localhost:5173>. Studio: <http://127.0.0.1:54323>.
Correo de pruebas: <http://127.0.0.1:54324>. El frontend se ejecuta con Vite en Linux;
no necesita un contenedor ni otro Docker Engine.

## Herramientas e instalación

Comprobado el 26/10/2026: Ubuntu-24.04 en WSL2, Node **24.22.1** Linux,
pnpm **11.19.0**, Supabase CLI **2.117.0**, Docker cliente/servidor **29.9.2**.
`package.json` exige Node >=22 y fija pnpm; `.node-version` registra la versión usada.
Node y pnpm locales viven bajo `~/.local/bin`; esa ruta está al inicio de PATH.

Sólo tras clonar o cambiar dependencias, ejecuta en Ubuntu:

```bash
pnpm install --frozen-lockfile
node -p 'process.platform + " " + process.execPath'
command -v node pnpm
```

El resultado debe ser Linux y rutas bajo `/home/joeel`, nunca `node.exe`, npm o pnpm
bajo `/mnt/c`. No copies `node_modules` desde Windows. Si pnpm detecta dependencias desalineadas, detiene el
comando para que ejecutes la instalación anterior explícitamente, sin reinstalaciones implícitas.
La opción está documentada en [pnpm](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/settings/build.md#verifydepsbeforerun).

La extensión oficial **WSL** (`ms-vscode-remote.remote-wsl`, versión 1.104.6) ya está instalada
en VS Code para Windows. Ejecuta en Ubuntu:

```bash
cd ~/projects/Invitara
code .
```

Comprueba que la esquina inferior izquierda indique **WSL: Ubuntu-24.04** y que la terminal
abra `/home/joeel/projects/Invitara`. La instalación del servidor VS Code puede tardar la primera vez.

## Local y Cloud

El cliente usa exactamente:

- `VITE_SUPABASE_URL`: URL de la instancia elegida.
- `VITE_SUPABASE_ANON_KEY`: clave pública `anon` de esa misma instancia.
- `VITE_APP_URL`: opcional; por defecto usa el origen del navegador para los enlaces.

`VITE_SUPABASE_PUBLISHABLE_KEY` no se lee actualmente. Nunca pongas claves `service_role`,
`sb_secret_`, tokens de gestión ni contraseñas de base de datos en `VITE_*`.

`pnpm env:local` obtiene sólo URL y anon de la CLI local y escribe `.env.local` con permisos
privados. Rechaza sobrescribir una configuración no local. No imprime claves y no copia la
salida completa de `supabase status`.

La pareja pública Cloud recuperada se conserva aparte en `.env.cloud.local` (ignorada por Git).
Para seleccionarla explícitamente, detén Vite y ejecuta `pnpm dev:cloud`. Para volver a local,
detén Vite, ejecuta `pnpm env:local` y `pnpm dev`. No uses Cloud para los datos de prueba.
No ejecutes simultáneamente ambos modos ni mezcles claves y URL. Las variables exportadas
en el shell tienen prioridad sobre los archivos: elimínalas antes de cambiar de entorno.

Esta consolidación no ejecutó escrituras, migraciones ni resets en Supabase Cloud. Su esquema
no se ha certificado; los pasos remotos pendientes están en [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Comprobaciones

En Ubuntu, desde la raíz:

```bash
pnpm check
pnpm exec supabase db lint --local
pnpm test:rls
pnpm test:local
```

`check` incluye formato, lint, Vitest, TypeScript y build: no hace falta repetirlos por separado.
`test:rls` ejecuta pgTAP con fixtures transaccionales. `test:local` comprueba Auth, recuperación
por correo local, eventos, consultas reales, enlaces anónimos, edición, RSVP, papelera y
restauración; crea datos sintéticos nuevos y los deja en la instancia local. Rechaza cualquier
API distinta de `http://127.0.0.1:54321`. No usa claves administrativas.

Para detener: Ctrl+C en Vite y `pnpm supabase:stop`. Los datos locales se conservan.
**`pnpm supabase:reset` borra datos locales**: no forma parte del inicio ni de estas comprobaciones.
Pide autorización antes de resetear una instancia que ya tenga datos.

## Estado y arquitectura

Rama actual de correcciones: `fix/invitation-event-flow-20261028` (parte de
`integration/invitara-wsl-consolidation-20261026`).
Consulta [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) para fuentes recuperadas,
respaldos, verificación y límites; [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md),
[DESIGN.md](DESIGN.md), [DECISIONS.md](DECISIONS.md) y [ROADMAP.md](ROADMAP.md) para el modelo.

## Próximo recorrido de plantillas

Elegir plantilla → completar datos → personalizar → invitados y compartir. Actualmente la creación
comienza en datos esenciales y usa el renderizador `InvitationTemplate` para la vista previa
general; no hay selector de plantillas aún. La siguiente entrega introducirá esa selección sin
duplicar el renderizado.

## Invitaciones y edición actual

En el editor del evento, **Agregar invitados** crea una invitación nueva. Tras guardarla, el
formulario se limpia y su enlace aparece en la tarjeta guardada correspondiente. Cada tarjeta
permite consultar o editar sus propios invitados y contactos. Los enlaces sólo se conservan
durante la sesión de la página: la base guarda únicamente un hash. Si cierras la página y
pierdes un enlace, usa **Revocar enlace y crear uno nuevo** en esa tarjeta; el anterior dejará
de funcionar. Una edición conserva el enlace activo y no limpia el formulario de creación.

**Pegar una lista** crea un invitado por cada línea no vacía. Se quitan espacios exteriores;
guiones, barras, comas, punto y coma y tabuladores dentro de una línea permanecen como parte
del nombre. Cada invitación necesita al menos un contacto válido entre sus invitados, pero
ninguna persona está obligada a tener teléfono. Se admiten como máximo dos teléfonos por
persona. El límite también se valida en PostgreSQL desde la migración
`202610280001_limit_invitee_phones.sql`, aplicada y probada sólo en local. Los registros previos
con más de dos teléfonos no se borran automáticamente.

La vista previa del evento y la de cada invitación usan `InvitationTemplate` con datos aún no
guardados. La vista previa general no incluye contactos privados ni crea enlaces. En escritorio
ancho aparece a la izquierda; en móvil, el formulario precede a la vista previa. El listado de
invitaciones guardadas puede plegarse y limita su altura con desplazamiento interior.

El cambio de contraseña desde **Cuenta** y el restablecimiento por correo comparten
`/restablecer`: piden confirmación, permiten pegar y, tras actualizar, cierran la sesión local
y regresan a **Inicia sesión**. La bandeja de correo local está en
<http://127.0.0.1:54324>. Ningún correo de estas pruebas se envía fuera de Supabase local.
