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
- Título, invitados, boletos extra, orden y contactos comparten un solo “Guardar cambios”.
- “Agregar uno por uno” es el flujo principal y “Pegar una lista” es la alternativa.
- La cantidad de boletos se presenta como resultado de invitados nominales y extras anónimos.
- Los emails y teléfonos aparecen dentro de cada invitado nominal, nunca en boletos extra.
- Escritorio usa breadcrumbs; móvil usa “← Eventos”.
- El encabezado sticky muestra contexto centrado; el perfil ofrece Cuenta, Mis eventos,
  opciones próximas y cierre de sesión sin exponer el email como texto suelto.
- Copiar enlace confirma el resultado mediante una región accesible.
- Editor y preview comparten plantilla; escritorio puede mostrarlos lado a lado y móvil alterna
  entre “Editar” y “Vista previa”.
