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
`events`, `event_schedule_items`, `guest_parties`, `invitees`, `invitee_contacts`,
`party_delivery_recipients`, `invitation_links`, `rsvp_events` y `audit_log`.

`invitees.public_key` es un identificador público no secuencial distinto del PK interno. El
endpoint público jamás devuelve PK internos, organización, correo o teléfono. Los contactos
nuevos se normalizan por invitado nominal en `invitee_contacts`; `party_delivery_recipients`
se sincroniza como proyección compatible para clientes anteriores. Ambos quedan aislados por
organización y sólo los leen miembros autenticados. El invitado público recibe únicamente claves públicas aleatorias,
contenido del evento, agenda y lugares de su grupo.

`guest_parties.assigned_capacity` se conserva por compatibilidad, pero el flujo UX lo deriva de
las filas activas de `invitees`. `save_guest_party_v4` bloquea evento y grupo, valida capacidad,
persiste título, invitados nominales, boletos extra, orden y contactos, y crea el primer enlace dentro de una
única transacción. Los conteos del
evento nunca se leen de esta columna: siempre se derivan de `invitees`.

## Fechas y zonas horarias

- Instantes (`starts_at`, `ends_at`, `responded_at`) usan `timestamptz` y se transmiten en UTC.
- Cada evento conserva una zona IANA en `events.timezone`; el cliente muestra fechas con
  `Intl.DateTimeFormat` y esa zona explícita.
- La entrada visible usa `dd/mm/aaaa` con parsing estricto y se convierte a ISO local antes de
  llamar RPC. En esta beta se asume
  la zona del navegador al capturar; una fase posterior añadirá conversión explícita para
  organizar eventos en otra zona.
- Fechas sin hora futuras (aniversarios o vencimientos civiles) deben usar `date`, no medianoche
  en UTC.

## Realtime

`invitees` y `event_schedule_items` se agregan a `supabase_realtime`. El detalle actualmente se
suscribe a RSVP en `invitees` y vuelve a consultar datos sujetos a RLS; las mutaciones de agenda
refrescan explícitamente. Realtime mejora frescura, pero PostgreSQL sigue siendo la autoridad.

## Preparación para mapas

El proveedor recomendado para una fase posterior es Google Maps Platform (Places API para
autocompletado y Maps JavaScript API para la vista previa), porque el modelo ya conserva
`place_id`, coordenadas y dirección sin hacer depender los datos del proveedor.

- Variable futura de navegador: `VITE_GOOGLE_MAPS_BROWSER_KEY`. No se agrega todavía a
  `.env.example` porque no existe integración activa.
- La clave debe restringirse por HTTP referrer a los dominios exactos de desarrollo, staging y
  producción, y permitir únicamente las APIs necesarias. Nunca debe ser una clave de servidor.
- Deben configurarse cuotas y alertas de presupuesto antes de habilitar facturación. Places y
  mapas son servicios por uso; el costo puede cambiar y una clave sin restricciones tiene riesgo
  de abuso y consumo inesperado. También existe dependencia del formato y licencia del
  proveedor.
- El flujo posterior será: autocompletar lugar, persistir texto + `place_id` + coordenadas,
  construir un enlace de navegación desde las coordenadas y cargar la vista previa sólo cuando
  sea visible. La invitación seguirá funcionando con dirección textual si Maps falla o se retira.

## Compatibilidad y backfill

Las migraciones son aditivas. Para filas anteriores: `template_id` se vuelve `basic`; el contacto
principal hereda el nombre del grupo; el cupo toma `max(cantidad de invitees, 1)`; todos los
lugares se clasifican como `named_guest`; el orden se deriva de `created_at, id`; y los eventos
publicados o archivados reciben timestamps a partir de `updated_at`. No se alteran tokens,
hashes, respuestas ni eventos RSVP existentes.

## Entornos

- Local completo: Supabase CLI + Docker, Vite y bandeja de correo local.
- Entorno principal: Ubuntu-24.04/WSL2 en `~/projects/Invitara`, con Docker Desktop integrado.
- Cloud opcional: `pnpm dev:cloud` selecciona explícitamente `.env.cloud.local`; no se usa para pruebas sintéticas.
- CI: servicios Supabase efímeros, pgTAP, lint, tests y build.
- Producción: deliberadamente no configurada en esta fase; requerirá un proyecto Supabase,
  secretos del host y URLs de Auth aprobadas.

## Persistencia de administración

La interfaz no encadena formularios independientes para una misma invitación. Construye un borrador
local y llama una vez a `save_guest_party_v4`. La RPC sólo devuelve éxito después del commit; un
error mantiene el modo edición y no se anuncia como guardado. `get_public_invitation` consulta
las filas actuales, por lo que un enlace activo refleja cambios guardados sin regenerarse.

El token en claro no es recuperable después de la sesión que lo creó. Esa limitación es
intencional: la base conserva únicamente SHA-256. Si se pierde el enlace, el flujo explícito
revoca el anterior y emite otro.

## Línea de tiempo y papelera

La primera actividad activa es la fuente de `events.starts_at` y `events.location_name`; esas
columnas permanecen como proyección legada sincronizada. La agenda pública y administrativa se
ordena por `starts_at`, por lo que no se ofrece reordenamiento manual contradictorio.

Mover a Papelera establece `deleted_at` y `purge_after`, revoca enlaces y conserva datos durante
30 días. Restaurar no reactiva tokens revocados. `purge_trashed_event` sólo permite al creador
del evento purgar después del vencimiento, limpia dependencias y conserva una auditoría mínima
sin PII. La ejecución automática queda preparada pero no programada: deberá invocarse mediante
un job autenticado de `pg_cron` o una Edge Function programada en el entorno que se elija.

## Corrección del detalle de eventos (26/10/2026)

`getEventDetail` consultaba `invitees` con `order=starts_at`, introducido en `c70c7c4`.
La tabla no tiene esa columna: los invitados se ordenan por `display_order` y las actividades
por `event_schedule_items.starts_at`. Se corrigieron ambos ordenamientos, sin migración.
Los tipos del cliente ya reflejaban estas columnas; son tipos mantenidos manualmente y no una
prueba del esquema Cloud. PostgreSQL local y una regresión del constructor PostgREST confirman
la causa. Una consulta directa reprodujo el error y las consultas corregidas pasaron.
