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
derivan de filas, nunca de contadores sincronizados manualmente. Un enlace activo no bloquea por
sí solo una reducción segura: sigue apuntando al grupo y su payload refleja los lugares activos;
una respuesta o historial sí bloquea el retiro del lugar afectado.

## ADR-009 — Boletos extra anónimos

**Estado:** reemplazada. Un boleto extra es un `invitee` de tipo `unnamed_extra`, no tiene nombre,
contacto ni vínculo obligatorio con otra persona. Cada boleto conserva fila, clave pública,
orden y RSVP propios. Los `plus_one` anteriores se convierten de forma compatible y su etiqueta
histórica queda preservada en un campo no público.

## ADR-010 — Agenda y retiros con historial

**Estado:** reemplazada parcialmente. Actividades y lugares se retiran con timestamp, no se
borran durante la operación normal. La agenda se ordena cronológicamente y la primera actividad
sincroniza la proyección legada del evento. El orden manual queda reservado a invitados y módulos.
`audit_log` registra las mutaciones administrativas.

## ADR-011 — Ciclo de vida y plantilla

**Estado:** aceptada. Se permite borrador ↔ publicado y archivar desde un estado activo. El
archivado es terminal, conserva datos y vuelve inaccesibles los enlaces públicos. La plantilla
es un slug (`basic` por defecto) y queda bloqueada después de publicar o emitir un enlace.

## ADR-012 — Semántica temporal

**Estado:** aceptada. Instantes se guardan como `timestamptz`; la zona IANA del evento controla
la presentación. Las fechas civiles futuras usarán `date`. La beta no añade una librería de
fechas: usa APIs estándar y documenta la limitación al editar eventos en una zona distinta de la
del navegador.

## ADR-013 — Borrador transaccional de grupo

**Estado:** aceptada. La edición administrativa de un grupo se confirma con una única RPC. La
capacidad del grupo se deriva de invitados y +1 activos; no se captura manualmente. Omitir una
persona equivale a solicitar retiro lógico y se rechaza si existe respuesta o historial.

## ADR-014 — Destinatarios separados de invitados

**Estado:** aceptada. `party_delivery_recipients` modela emails y teléfonos que recibirán el
enlace. No consumen boletos, no aparecen en la invitación pública y todavía no disparan envíos.

## ADR-015 — Enlace estable y reinicio separado

**Estado:** aceptada. El contenido guardado aparece en el mismo enlace activo. Regenerar se usa
sólo para revocar un token comprometido y conserva RSVP. Reiniciar respuestas es otra acción,
requiere confirmación, conserva el historial append-only y genera auditoría.

## ADR-016 — Eliminación lógica restringida

**Estado:** aceptada. Sólo un borrador sin enlaces ni historial puede marcarse como eliminado.
Los eventos con trazabilidad se archivan. RLS y funciones de acceso excluyen eventos eliminados
y sus entidades hijas.

## ADR-017 — Papelera con retención

**Estado:** aceptada. Toda retirada visible se llama “Mover a papelera”. Conserva el evento 30
días, revoca acceso público y permite restaurar sin reactivar enlaces. Sólo el creador puede
purgar tras `purge_after`; la auditoría mínima sobrevive sin PII. La programación automática no
forma parte de esta entrega y se conectará a la RPC segura.

## ADR-018 — Preview compartido y módulos extensibles

**Estado:** aceptada. Editor y ruta pública renderizan `InvitationTemplate`. El editor le entrega
estado local no guardado; la plantilla normaliza un orden de módulos (`cover`, `information`,
`schedule`, `location`, `guests`, `closing`) sin convertirse todavía en page builder.
