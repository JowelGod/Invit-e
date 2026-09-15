# Producto

## Objetivo de esta fase

Validar un único recorrido de extremo a extremo: una persona organizadora crea su cuenta y un
evento, asigna lugares a una familia o grupo, genera un enlace opaco y el grupo responde sin
cuenta. El panel refleja la respuesta y la capacidad disponible.

No forman parte de esta fase: pagos, WhatsApp, QR/check-in, seating plans, IA, editor visual
libre, plantillas definitivas, dominio personalizado o white-label.

## Conceptos

- **Organización:** frontera de propiedad y autorización. Cada alta crea una organización
  personal.
- **Evento:** contiene fecha, ubicación, capacidad y contenido público flexible en JSONB.
- **Grupo invitado:** familia, pareja o grupo que comparte una invitación.
- **Lugar:** una fila de `invitees`; puede tener nombre o quedar anónimo.
- **Enlace:** token público revocable asociado a un solo grupo.
- **RSVP:** cambio transaccional del estado actual de uno o más lugares y registro append-only.

## Capacidad

- `capacity`: límite total del evento.
- `unassigned`: `max(capacity - filas históricas de lugares, 0)`. Mide lugares nunca emitidos.
- `pending`, `confirmed`, `rejected`: conteos derivados de la columna `invitees.response`.
- `available_to_reassign`: `max(capacity - pending - confirmed, 0)`. Incluye lugares nunca
  asignados y lugares liberados por rechazo.

Un rechazo no elimina ni recicla la fila: conserva su identidad y el historial RSVP. Al asignar
de nuevo esa capacidad se crea una fila nueva. Por eso el total histórico puede superar la
capacidad, mientras que `pending + confirmed` nunca puede hacerlo.

Si una persona previamente rechazada intenta confirmar después de que su capacidad fue
reasignada, la transacción rechaza el cambio cuando produciría sobrecupo. El organizador deberá
liberar o ampliar capacidad antes de aceptar ese cambio.

## Criterios de aceptación

- No hay cuenta para invitados ni header administrativo en la ruta pública.
- Un token sólo devuelve título/fecha/lugar/contenido del evento, nombre del grupo y sus lugares.
- Los conteos cambian al responder y un rechazo incrementa la capacidad disponible.
- Ningún conteo agregado se persiste manualmente.
