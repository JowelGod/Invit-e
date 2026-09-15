# Invitame

Fundamentos del nuevo Invitame: React + Vite en el cliente y Supabase para PostgreSQL, Auth,
Storage, Realtime y RPC. El prototipo Firebase permanece intacto en `master` y en el tag
`eventide-prototype-2025-06-30`.

## Requisitos

- Node.js 22 o posterior y pnpm 11.
- Docker Desktop en ejecución (necesario para Supabase local y las pruebas RLS).
- Supabase CLI, instalada como dependencia de desarrollo.

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

La primera ejecución aplica automáticamente las migraciones. Para reconstruir la base local:

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

## Flujo vertical comprobable

1. Regístrate en `/registro` e inicia sesión.
2. Crea un evento y define capacidad.
3. Agrega un grupo con uno o varios lugares.
4. Genera el enlace; se copia al portapapeles y sólo se muestra durante esa sesión de pantalla.
5. Abre el enlace en una ventana privada, responde y vuelve al detalle del evento.
6. Realtime actualiza los estados y los conteos derivados.

Consulta [PRODUCT.md](./PRODUCT.md), [ARCHITECTURE.md](./ARCHITECTURE.md),
[DESIGN.md](./DESIGN.md), [DECISIONS.md](./DECISIONS.md) y [ROADMAP.md](./ROADMAP.md).
El cierre manual del servicio anterior está en [FIREBASE_SHUTDOWN.md](./FIREBASE_SHUTDOWN.md).
