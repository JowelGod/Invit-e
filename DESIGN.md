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
