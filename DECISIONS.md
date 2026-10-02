# Decisiones

## ADR-001 — Reconstrucción limpia

**Estado:** aceptada. `master` y `eventide-prototype-2025-06-30` conservan el prototipo. La base
se construyó en `codex/invitame-rebuild` y la beta en `codex/invitame-beta-foundation`.
Firebase, datos, media y plantillas no se migran.

## ADR-002 — Un PostgreSQL con JSONB

**Estado:** aceptada. Identidad, autorización, lugares y RSVP son relacionales. Sólo contenido
visual flexible usa JSONB. Una segunda base NoSQL no aporta valor al MVP.

## ADR-003 — Mutaciones mediante RPC

**Estado:** aceptada. Crear eventos, grupos, enlaces y RSVP requiere invariantes transaccionales.
Las tablas sólo exponen lectura con RLS; RPC concentra permisos y validación.

## ADR-004 — Lugar individual e historial

**Estado:** aceptada. Cada lugar es una fila. Rechazar no elimina la fila. La capacidad activa es
`pending + confirmed`; una reasignación crea otra fila y `rsvp_events` conserva cada envío.
El RSVP bloquea el evento y rechaza una reconfirmación tardía si causaría sobrecupo.

## ADR-005 — Token opaco con hash

**Estado:** aceptada. Se generan 32 bytes aleatorios codificados en hex. Sólo se guarda SHA-256.
No puede recuperarse; regenerar crea un token y revoca el anterior.

## ADR-006 — UI deliberadamente neutral

**Estado:** aceptada. CSS propio con tokens, sin librería de componentes ni plantillas heredadas.
Esto reduce dependencias y permite sustituir la dirección visual más adelante.

## ADR-007 — Sin servidor adicional

**Estado:** aceptada para MVP. Supabase Auth/PostgREST/RPC/Realtime/Storage cubre el flujo. Una
Edge Function se añadirá sólo si rate limiting, webhooks o integraciones lo justifican.

## ADR-008 — Cupo de grupo respaldado por lugares

**Estado:** aceptada. `assigned_capacity` es el cupo administrativo, pero cada lugar activo es
una fila de `invitees`, incluso sin nombre. Aumentar cupo crea filas anónimas. Reducirlo sólo
retira lógicamente lugares pendientes sin historial ni dependencias. Los conteos del evento se
derivan de filas, nunca de contadores sincronizados manualmente.

## ADR-009 — Acompañantes explícitos en el mismo grupo

**Estado:** aceptada. Un acompañante es un `invitee` de tipo `plus_one` y referencia a un
`named_guest` del mismo grupo mediante clave foránea compuesta. Consume un lugar normal y tiene
su propio estado RSVP; no existe una entidad de boleto separada en esta fase.

## ADR-010 — Agenda y retiros con historial

**Estado:** aceptada. Actividades y lugares se retiran con timestamp, no se borran durante la
operación normal. El orden es entero, único entre filas activas, y se cambia mediante RPC
transaccional. `audit_log` registra las mutaciones administrativas.

## ADR-011 — Ciclo de vida y plantilla

**Estado:** aceptada. Se permite borrador ↔ publicado y archivar desde un estado activo. El
archivado es terminal, conserva datos y vuelve inaccesibles los enlaces públicos. La plantilla
es un slug (`basic` por defecto) y queda bloqueada después de publicar o emitir un enlace.

## ADR-012 — Semántica temporal

**Estado:** aceptada. Instantes se guardan como `timestamptz`; la zona IANA del evento controla
la presentación. Las fechas civiles futuras usarán `date`. La beta no añade una librería de
fechas: usa APIs estándar y documenta la limitación al editar eventos en una zona distinta de la
del navegador.
