# Invitame

Base beta del nuevo Invitame: React + Vite en el cliente y Supabase para PostgreSQL, Auth,
Storage, Realtime y RPC. Incluye agenda, edición transaccional de grupos/personas/+1, destinatarios separados, RSVP y ciclo de vida. El
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
4. Agrega personas una por una o pega una lista; activa +1 junto a quien corresponda.
5. Agrega emails o teléfonos como destinatarios, sin convertirlos en invitados.
6. Guarda el grupo una sola vez. La misma transacción persiste personas, orden y destinatarios,
   y crea automáticamente el primer enlace.
7. Copia el enlace, ábrelo en una ventana privada y responde.
8. Edita un nombre y comprueba que el mismo enlace muestra el cambio sin regenerarse.
9. Usa “Revocar enlace y crear uno nuevo” sólo para invalidar el token anterior.
10. Realtime actualiza estados, capacidad y porcentaje de respuesta.
11. Elimina borradores sin historial o archiva eventos que deban conservar información.

## Migraciones beta

- `202610020001_beta_schema.sql`: agenda, contactos/cupo, tipos de invitado, retiro lógico y
  ciclo de vida.
- `202610020002_beta_rpcs.sql`: mutaciones transaccionales, validaciones, payload público y
  métricas derivadas.
- `202610100001_beta_ux_fixes.sql`: destinatarios, guardado atómico de grupos, enlace
  automático, reinicio auditado, fechas futuras y eliminación lógica segura.

Las dos migraciones beta de octubre 2 ya están aplicadas en `invitame-development`. La
migración UX de octubre 10 se entrega para revisión y aplicación manual; esta rama no ejecuta
`db push`, deployment ni cambios en Firebase.

Consulta [PRODUCT.md](./PRODUCT.md), [ARCHITECTURE.md](./ARCHITECTURE.md),
[DESIGN.md](./DESIGN.md), [DECISIONS.md](./DECISIONS.md) y [ROADMAP.md](./ROADMAP.md).
El cierre manual del servicio anterior está en [FIREBASE_SHUTDOWN.md](./FIREBASE_SHUTDOWN.md).
