# Arquitectura

## Vista general

```text
React/Vite SPA
  ├─ Supabase Auth (sesiones de organizadores)
  ├─ PostgREST + RLS (lecturas privadas)
  ├─ RPC PostgreSQL SECURITY DEFINER (mutaciones con invariantes)
  ├─ Realtime (cambios en invitees)
  └─ Storage privado event-media (preparado, sin UI aún)
             │
        PostgreSQL único
```

No existe un backend Node separado. PostgreSQL es la autoridad de autorización, capacidad,
idempotencia y transacciones. Las configuraciones flexibles futuras viven en
`events.public_content JSONB`; las relaciones e identidades permanecen normalizadas.

## Fronteras de seguridad

- Las tablas públicas tienen RLS forzada y no conceden mutaciones a `anon` ni `authenticated`.
- Usuarios autenticados sólo leen filas de organizaciones a las que pertenecen.
- `owner`, `admin` y `planner` pueden mutar mediante RPC; `viewer` es sólo lectura.
- El cliente anónimo no tiene `SELECT` sobre tablas. Sólo ejecuta `get_public_invitation` y
  `respond_to_invitation`.
- Los tokens contienen 256 bits aleatorios, viajan en la URL una vez y se persiste únicamente
  SHA-256. Regenerar revoca el anterior.
- RSVP bloquea el enlace y los lugares, usa clave idempotente y acepta exclusivamente
  `invitee_key` público + `status` (`confirmed` o `rejected`).
- `rsvp_events` no tiene políticas de escritura/actualización/borrado para clientes y conserva
  el historial append-only.

## Modelo

Las migraciones versionadas definen: `profiles`, `organizations`, `organization_members`,
`events`, `event_schedule_items`, `guest_parties`, `invitees`, `invitation_links`,
`rsvp_events` y `audit_log`.

`invitees.public_key` es un identificador público no secuencial distinto del PK interno. El
endpoint público jamás devuelve PK internos, organización, correo o teléfono. El contacto
operativo del grupo se almacena en `guest_parties`, queda aislado por organización y sólo lo
leen miembros autenticados. El invitado público recibe únicamente claves públicas aleatorias,
contenido del evento, agenda y lugares de su grupo.

`guest_parties.assigned_capacity` expresa el cupo administrativo del grupo. Cada uno de esos
lugares existe también como fila activa en `invitees`; el valor sólo puede cambiar mediante RPC,
que crea lugares anónimos o retira lugares elegibles en la misma transacción. Los conteos del
evento nunca se leen de esta columna: siempre se derivan de `invitees`.

## Fechas y zonas horarias

- Instantes (`starts_at`, `ends_at`, `responded_at`) usan `timestamptz` y se transmiten en UTC.
- Cada evento conserva una zona IANA en `events.timezone`; el cliente muestra fechas con
  `Intl.DateTimeFormat` y esa zona explícita.
- Los controles `datetime-local` se convierten a ISO antes de llamar RPC. En esta beta se asume
  la zona del navegador al capturar; una fase posterior añadirá conversión explícita para
  organizar eventos en otra zona.
- Fechas sin hora futuras (aniversarios o vencimientos civiles) deben usar `date`, no medianoche
  en UTC.

## Realtime

`invitees` y `event_schedule_items` se agregan a `supabase_realtime`. El detalle actualmente se
suscribe a RSVP en `invitees` y vuelve a consultar datos sujetos a RLS; las mutaciones de agenda
refrescan explícitamente. Realtime mejora frescura, pero PostgreSQL sigue siendo la autoridad.

## Entornos

- Local completo: Supabase CLI + Docker, Vite y bandeja de correo local.
- Local sin hipervisor: Vite contra el proyecto de desarrollo remoto; las pruebas SQL se delegan
  a GitHub Actions.
- CI: servicios Supabase efímeros, pgTAP, lint, tests y build.
- Producción: deliberadamente no configurada en esta fase; requerirá un proyecto Supabase,
  secretos del host y URLs de Auth aprobadas.
