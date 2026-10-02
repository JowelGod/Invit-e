# Invitame

Base beta del nuevo Invitame: React + Vite en el cliente y Supabase para PostgreSQL, Auth,
Storage, Realtime y RPC. Incluye agenda, grupos/cupos, acompañantes, RSVP y ciclo de vida. El
prototipo Firebase permanece intacto en `master` y en el tag `eventide-prototype-2025-06-30`.

## Requisitos

- Node.js 22 o posterior y pnpm 11.
- Docker Desktop en ejecución (necesario para Supabase local y las pruebas RLS).
- Supabase CLI, instalada como dependencia de desarrollo.

Docker sólo es necesario para levantar Supabase completo. Si el equipo no soporta el
hipervisor, se puede ejecutar Vite contra `invitame-development` con sus credenciales públicas y
dejar pgTAP a GitHub Actions.

## Puesta en marcha local

```bash
pnpm install --frozen-lockfile
pnpm supabase:start
pnpm exec supabase status -o env
```

Copia `.env.example` a `.env.local`. Del resultado anterior usa `API_URL` como
`VITE_SUPABASE_URL` y `ANON_KEY` como `VITE_SUPABASE_ANON_KEY`. Después ejecuta:

```bash
pnpm dev
```

- Aplicación: <http://localhost:5173>
- Supabase Studio: <http://127.0.0.1:54323>
- Bandeja de correo local: <http://127.0.0.1:54324>

La primera ejecución aplica automáticamente todas las migraciones. Para reconstruir la base
local:

```bash
pnpm supabase:reset
```

## Comprobaciones

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm test:rls
```

`pnpm test:rls` exige que Supabase local esté iniciado. CI ejecuta todas las comprobaciones.
No uses `supabase db push` para probar cambios: primero publica la rama y espera el job
`database`, que reconstruye un entorno efímero desde cero.

## Flujo vertical comprobable

1. Regístrate en `/registro` e inicia sesión.
2. Crea un evento y define capacidad.
3. Agrega actividades a la agenda y ordénalas.
4. Agrega un grupo con contacto, cupo y nombres opcionales.
5. Edita un lugar para convertirlo en acompañante y vincularlo a una persona nominal.
6. Genera el enlace; se copia al portapapeles y sólo se muestra durante esa sesión de pantalla.
7. Abre el enlace en una ventana privada, revisa la agenda y responde.
8. Realtime actualiza estados, capacidad y porcentaje de respuesta.
9. Publica, vuelve a borrador o archiva. Archivar es terminal y deshabilita el acceso público.

## Migraciones beta

- `202610020001_beta_schema.sql`: agenda, contactos/cupo, tipos de invitado, retiro lógico y
  ciclo de vida.
- `202610020002_beta_rpcs.sql`: mutaciones transaccionales, validaciones, payload público y
  métricas derivadas.

Estas migraciones todavía deben aplicarse manualmente al proyecto de desarrollo después de que
CI pase. Esta rama no realiza deployment ni modifica Firebase.

Consulta [PRODUCT.md](./PRODUCT.md), [ARCHITECTURE.md](./ARCHITECTURE.md),
[DESIGN.md](./DESIGN.md), [DECISIONS.md](./DECISIONS.md) y [ROADMAP.md](./ROADMAP.md).
El cierre manual del servicio anterior está en [FIREBASE_SHUTDOWN.md](./FIREBASE_SHUTDOWN.md).
