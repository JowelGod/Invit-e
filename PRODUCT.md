# Producto

## Objetivo de la beta foundation

Validar un único recorrido de extremo a extremo: una persona organizadora crea su cuenta y un
evento, asigna lugares a una familia o grupo, genera un enlace opaco y el grupo responde sin
cuenta. El panel refleja la respuesta y la capacidad disponible. La base beta añade agenda,
edición segura, acompañantes, búsqueda y ciclo de vida sin entrar aún en diseño final.

No forman parte de esta fase: pagos, WhatsApp, QR/check-in, seating plans, IA, editor visual
libre, plantillas definitivas, dominio personalizado o white-label.

## Conceptos

- **Organización:** frontera de propiedad y autorización. Cada alta crea una organización
  personal.
- **Evento:** contiene fecha, zona horaria, ubicación, capacidad, estado y contenido público
  flexible en JSONB.
- **Actividad:** elemento ordenado de agenda con horario, lugar, dirección y descripción.
- **Grupo invitado:** familia, pareja o grupo que comparte una invitación y una lista ordenada de personas.
- **Lugar:** una fila activa de `invitees`; en el flujo nuevo siempre representa a una persona
  nominal o a su acompañante vinculado. Su cantidad deriva el total de boletos del grupo.
- **Destinatario:** email o teléfono administrativo que podrá recibir el enlace; no consume un
  boleto y nunca forma parte del payload público.
- **Enlace:** token público revocable asociado a un solo grupo.
- **RSVP:** cambio transaccional del estado actual de uno o más lugares y registro append-only.

## Capacidad

- `capacity`: límite total del evento.
- `assigned`: lugares no retirados, incluso los rechazados.
- `unassigned`: `max(capacity - assigned, 0)`.
- `pending`, `confirmed`, `rejected`: conteos derivados de la columna `invitees.response`.
- `available_to_reassign`: `max(capacity - pending - confirmed, 0)`. Incluye lugares nunca
  asignados y lugares liberados por rechazo.

Un rechazo no elimina ni recicla la fila: conserva su identidad y el historial RSVP. Al asignar
de nuevo esa capacidad puede crearse otra fila. Por eso el total histórico puede superar la
capacidad, mientras que `pending + confirmed` nunca puede hacerlo. Reducir el cupo de un grupo
sólo retira lógicamente lugares pendientes sin historial; nunca borra respuestas.

Si una persona previamente rechazada intenta confirmar después de que su capacidad fue
reasignada, la transacción rechaza el cambio cuando produciría sobrecupo. El organizador deberá
liberar o ampliar capacidad antes de aceptar ese cambio.

## Criterios de aceptación

- No hay cuenta para invitados ni header administrativo en la ruta pública.
- Un token sólo devuelve título/fecha/lugar/contenido del evento, nombre del grupo y sus lugares.
- Los conteos cambian al responder y un rechazo incrementa la capacidad disponible.
- Ningún conteo agregado se persiste manualmente.
- Un evento archivado conserva su historial, pero sus enlaces ya no muestran información ni
  aceptan RSVP.
- La plantilla queda bloqueada al publicar o generar el primer enlace.

## Edición y enlaces

El alta y la edición de un grupo son una sola operación transaccional: nombre, personas, +1,
orden y destinatarios se confirman juntos o no cambia nada. El primer guardado crea un enlace
automáticamente. Editar contenido no cambia el token; la invitación existente lee los datos
vigentes. Revocar y crear un token nuevo conserva personas, RSVP e historial.

“Reiniciar respuestas” es una acción distinta, explícita y auditada. Cambia el estado operativo
a pendiente, pero no borra `rsvp_events`. Los borradores sin enlaces ni historial pueden
eliminarse lógicamente; los demás eventos se archivan.
