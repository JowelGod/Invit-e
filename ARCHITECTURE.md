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
`events`, `guest_parties`, `invitees`, `invitation_links`, `rsvp_events` y `audit_log`.

`invitees.public_key` es un identificador público no secuencial distinto del PK interno. El
endpoint público jamás devuelve PK, organización, correo o teléfono. En esta fase ni siquiera
se almacenan datos de contacto de invitados.

## Realtime

Sólo `invitees` se agrega a `supabase_realtime`. El detalle se suscribe filtrando `event_id` y
vuelve a consultar datos sujetos a RLS. Realtime mejora frescura, pero la consulta PostgreSQL
sigue siendo la fuente de verdad.

## Entornos

- Local: Supabase CLI + Docker, Vite y bandeja de correo local.
- CI: servicios Supabase efímeros, pgTAP, lint, tests y build.
- Producción: deliberadamente no configurada en esta fase; requerirá un proyecto Supabase,
  secretos del host y URLs de Auth aprobadas.
