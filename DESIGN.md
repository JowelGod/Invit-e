# Diseño

Esta fase usa una interfaz neutral y reemplazable. No intenta definir la identidad visual ni
reutiliza plantillas del prototipo.

## Principios actuales

- Mobile-first con referencia de 390 × 844 px y ancho mínimo de 320 px.
- Controles interactivos de al menos 44 px, sin depender de hover.
- HTML semántico, labels explícitos, teclado y foco visible.
- Colores con contraste legible y estados que también incluyen texto.
- `prefers-reduced-motion` reduce animaciones y transiciones.
- La aplicación administrativa y la invitación pública son layouts distintos.
- Los grupos usan `details/summary` nativo para colapsar contenido sin JavaScript adicional.
- Agenda, edición y filtros funcionan con teclado y sin gestos ni hover obligatorio.

## Preparación para la identidad futura

Los valores visuales están centralizados como custom properties en `src/styles.css`. La futura
fase de diseño debe sustituir tokens, tipografía y componentes sin cambiar flujos ni lógica.
Antes de construir plantillas se definirá un contrato de contenido y un prototipo de motion con
audio opt-in, rendimiento móvil y alternativa de movimiento reducido.


## Corrección UX beta

- Las tarjetas de grupo abren en lectura y muestran un único botón “Editar”.
- Nombre, personas, +1, orden y destinatarios comparten un solo “Guardar cambios”.
- “Agregar uno por uno” es el flujo principal y “Pegar una lista” es la alternativa.
- La cantidad de boletos se presenta como resultado de personas y acompañantes.
- Los emails y teléfonos aparecen como destinatarios, no como “contacto principal”.
- Escritorio usa breadcrumbs; móvil usa “← Eventos”.
- El email de sesión vive dentro del menú de cuenta y no permanece expuesto en el encabezado.
- Copiar enlace confirma el resultado mediante una región accesible.
