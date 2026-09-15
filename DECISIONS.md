# Decisiones

## ADR-001 — Reconstrucción limpia

**Estado:** aceptada. `master` y `eventide-prototype-2025-06-30` conservan el prototipo; el
desarrollo ocurre en `codex/invitame-rebuild`. Firebase, datos, media y plantillas no se migran.

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
