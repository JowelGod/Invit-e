# Invitara

Aplicación React/Vite + Supabase (Auth, PostgreSQL, RLS, RPC y Realtime).
Repositorio: `JowelGod/Invit-e`; el remoto mantiene ese nombre.
La copia de desarrollo única está en **`~/projects/Invitara` dentro de Ubuntu-24.04/WSL2**.
El prototipo Firebase permanece en `master` y en el tag histórico.

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

Rama de integración: `integration/invitara-wsl-consolidation-20261026`.
Consulta [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) para fuentes recuperadas,
respaldos, verificación y límites; [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT.md](PRODUCT.md),
[DESIGN.md](DESIGN.md), [DECISIONS.md](DECISIONS.md) y [ROADMAP.md](ROADMAP.md) para el modelo.
El cierre manual del antiguo servicio Firebase está en [FIREBASE_SHUTDOWN.md](FIREBASE_SHUTDOWN.md).
