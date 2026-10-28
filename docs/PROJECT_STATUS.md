# Estado verificado de Invitara

## Actualización del 28/10/2026: eventos e invitaciones

Rama: `fix/invitation-event-flow-20261028`, creada sobre la integración anterior. Respaldo
recuperable previo: `/home/joeel/invitara-recovery/2026-10-28-before-flow.bundle`. Las copias
originales de Windows permanecen intactas. La carpeta de trabajo sigue siendo
`/home/joeel/projects/Invitara` dentro de WSL.

El bloqueo reportado al crear una segunda invitación correspondía al formulario que conservaba
su estado y un enlace recién generado bajo el panel de creación. Ahora cada guardado
correcto remonta un borrador vacío y añade la tarjeta guardada; los enlaces se asocian por ID de
grupo y se actualizan también tras regenerarlos. En una misma página se crearon tres invitaciones
consecutivas, se comprobaron invitados y enlaces distintos en sus tarjetas, se editó una y se
creó una cuarta sin recargar. Los fallos de guardado mantienen el borrador. La limitación de
recuperación de tokens (sólo hash en la base) se explica en cada tarjeta.

El formulario señala correos y teléfonos tras salir del campo, mantiene los avisos al contraer
tarjetas y enfoca el primer error al intentar guardar. Admite dos teléfonos opcionales por persona;
la migración local `202610280001_limit_invitee_phones.sql` añade un trigger que rechaza el tercero
sin alterar registros existentes. La importación pega una persona por línea. Se simplificó la
creación de eventos retirando sólo el campo visible Lugar; las columnas y lugares de actividades
anteriores permanecen. Fecha y hora son campos separados; la fecha añade separadores y el valor
se guarda como hora local, sin desplazar el día. La vista previa de evento y de invitación usa el
renderizador actual con borradores locales. Las tarjetas guardadas están en un panel plegable y
con altura limitada.

Se añadió confirmación de contraseña al flujo compartido de cambio y recuperación, con cierre
de sesión y vuelta al login tras éxito. No se deshabilitó el pegado ni los gestores. Se retiraron
la configuración y el documento operativo restantes del backend histórico; Supabase es el único
backend activo. La caché local histórica se respaldó en
`/home/joeel/invitara-recovery/2026-10-28-firebase-cache.tar.gz` antes de retirarla. El historial
anterior sigue disponible en Git.

Verificación: `pnpm check` aprobó 26 pruebas Vitest, lint, TypeScript y build; SQL lint local
aprobado; `pnpm test:rls` aprobó 103 casos; `pnpm test:local` aprobó Auth, recuperación, eventos,
enlaces, RSVP y papelera con datos sintéticos. En navegador se comprobó la creación seguida,
edición, aislamiento de enlaces, errores por campo, foco, tarjetas plegables, fecha y vista previa
sin guardar. El navegador integrado no ofreció cambio de tamaño para comprobar el punto de corte
móvil; las reglas responsive se revisaron en CSS y esa comprobación visual sigue pendiente.
El cambio de contraseña mediante enlace se comprobó por API local y pruebas de interfaz
automatizadas, no completando la contraseña en el navegador integrado.

La migración del límite de teléfonos sólo se aplicó a Supabase local. Antes de promover esta rama
a un entorno remoto, revisar el esquema Cloud de sólo lectura, probarla en staging y planificar
su aplicación allí por separado. No se hizo ninguna escritura, reset ni cambio de esquema Cloud.
La siguiente tarea de producto es implementar el primer paso de elección de plantilla real dentro
del recorrido documentado, sin duplicar `InvitationTemplate`.

Revisión iniciada: 26/10/2026. Validación final: 27/10/2026. Remoto único: `https://github.com/JowelGod/Invit-e.git`.
Rama: `integration/invitara-wsl-consolidation-20261026`. Base: `0ada240`.

## Recuperación y comparación

| Fuente                                                | Hallazgo                                                                                                                      | Decisión                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `C:\Users\joeel\OneDrive\Documentos\ChatGPT\Invitame` | Git limpio en `codex/invitame-editor-foundation`, `0ada240`; sin cambios preparados, sin preparar o archivos nuevos de código | Base recuperada con todo su historial; carpeta Windows conservada              |
| `C:\Users\joeel\Proyectos_Joel\Invitara`              | Sin `.git`; sus 65 archivos de código/configuración coinciden con `c9edfa1` (`beta-foundation`), normalizando CRLF            | Sin código único que añadir; entorno respaldado por separado                   |
| `/home/joeel/projects/Invit-e`                        | Clon limpio en `master`, `7e46757`; sin avance local exclusivo                                                                | Respaldado y renombrado a `/home/joeel/projects/Invitara`; se reutilizó `.git` |
| `/projects/Invit-e` y anterior `~/projects/Invitara`  | No existían                                                                                                                   | No se creó otro clon                                                           |

Se actualizaron las referencias de ambos repositorios y se comprobaron las cinco ramas remotas.
`master` → `rebuild` → `beta-foundation` → `beta-ux-fixes` → `editor-foundation` forman una cadena
ancestral. No existía una rama remota adicional sin el prefijo `codex/`. No hubo commits locales
exclusivos en ramas. Los snapshots internos de Codex quedaron en el bundle: uno coincidía con
el árbol del editor y otro sólo difería en el ejemplo de entorno respecto a beta. No aportaban
funcionalidad adicional. No se encontraron AGENTS.md aplicables ni submódulos.

Se revisó `INVITARA_CONTEXTO_DESARROLLO.md` de Downloads: acertaba en requisitos, pero la base más
completa era editor-foundation; la copia WSL sí existía; `.env.local` existía en ambas copias de
Windows. Invitara ya es el nombre del producto; Invit-e permanece como repositorio.

## Respaldos y restauración

Raíz privada: `/home/joeel/invitara-recovery/2026-10-26`, fuera de Git y con acceso restringido.
Contiene `onedrive/`, `windows/`, `ubuntu/`, archivos `source.tar.gz`, bundles completos para
las dos copias Git, parches preparados/sin preparar, estado, reflog, ejemplos de entorno,
contexto original y `SHA256SUMS`. Los bundles se verificaron con `git bundle verify`.
Credenciales: `private/<fuente>/.env.local`, separadas de los archivos de código.
No se copiaron node_modules, compilados ni cachés. Las carpetas originales Windows permanecen.

Para recuperar, crea un directorio vacío fuera de la copia definitiva, clona el bundle de la
fuente correspondiente y selecciona su rama; aplica sus parches y extrae su archivo de fuente
sólo en ese directorio de recuperación. No extraigas archivos encima del proyecto actual.
Para la fuente sin Git, extrae su archivo en un directorio vacío. Los entornos se recuperan
manualmente desde `private/`, nunca se añaden a Git. Los respaldos en WSL no sustituyen una
copia externa ante pérdida del disco o desinstalación de la distribución.

## Error del editor

Causa exacta: `src/services/api.ts`, `getEventDetail`, ordenaba `invitees` por `starts_at`.
Fue introducido por `c70c7c4`. Las migraciones y el esquema local sólo tienen `starts_at` en
`events` y `event_schedule_items`; los invitados tienen `display_order`.
Corrección aislada en `a62e9b3`: invitados por `display_order`, agenda por `starts_at`.
La corrección se hizo en el clon Linux del mismo commit que OneDrive para continuar en el
entorno definitivo, conservando OneDrive intacto como fuente. No requiere migración.

Regresión: `src/services/api.test.ts` usa el constructor real de Supabase/PostgREST, verifica
los parámetros de consulta y que se propaguen errores. Falló antes del arreglo con el mensaje
reportado y pasó después. `pnpm test:local` también reproduce la consulta errónea contra
PostgreSQL real antes de comprobar las corregidas. El editor abrió y mostró contenido en el navegador.

## Entorno y autenticación

Ubuntu-24.04, WSL2; Docker Desktop cliente/servidor 29.9.2. No se instaló Docker Engine en Linux.
Node 24.22.1 Linux, pnpm 11.19.0 y Supabase CLI 2.117.0 del proyecto.
Extensión oficial VS Code WSL 1.104.6 instalada y verificada por la CLI; la primera conexión
puede instalar el servidor de VS Code en Ubuntu. Dependencias instaladas con
lockfile congelado en Linux. La verificación implícita de pnpm quedó en `error` para evitar
reinstalaciones automáticas al ejecutar scripts; si avisa de dependencias desalineadas, ejecutar
`pnpm install --frozen-lockfile` explícitamente. Durante la recuperación una reinstalación
implícita quedó bloqueada; se detuvo sólo ese proceso y la instalación explícita finalizó bien. Se conserva `project_id = "invitame-local"` para mantener estable
la identidad de contenedores/volúmenes; no depende del nombre de la carpeta ni de la marca.

`.env.local` selecciona local; `.env.cloud.local` conserva la pareja pública recuperada de
OneDrive y sólo se carga con `pnpm dev:cloud`. Ambos se ignoran en Git. Se verificó offline que
las claves de Windows eran `anon` y correspondían al proyecto de su URL. El endpoint Cloud
respondió HTTP 401 a una petición sin credenciales: DNS/TLS/HTTP disponibles en ese momento.
Esto no demuestra que el login Cloud funcione ni descarta un fallo de red anterior o del navegador.
No se hicieron escrituras ni cambios de esquema Cloud; su esquema no fue inspeccionado.

El antiguo `NetworkError` no apareció en registro, login ni solicitud de recuperación locales.
El smoke test verificó correo de recuperación, sesión de recuperación, cambio de contraseña y
login de una cuenta ficticia exclusivamente por API local. No se envió correo real.

## Validación

- SQL lint local: sin errores de esquema.
- pgTAP/RLS: 101 pruebas en cuatro archivos, todas aprobadas.
- Smoke test local: registro/login/logout, creación/edición/listado, reproducción del error,
  enlaces anónimos, edición con enlace estable, RSVP/métricas, papelera/restauración y recuperación.
- Navegador: registro/login, creación y edición, editor sin error, invitación, RSVP y actualización
  Realtime a un confirmado/un rechazado; papelera, enlace revocado y restauración comprobados.
  La confirmación nativa de papelera requirió que el usuario cerrara el diálogo bloqueado del navegador integrado.
- Formulario de recuperación local: solicitud aceptada; cambio final comprobado por API.
- `pnpm check`: aprobado (Prettier, ESLint, 19 pruebas Vitest en 10 archivos, TypeScript y build).
- Build: advertencia no bloqueante de un chunk de 529.79 kB; optimización de carga pendiente.
- Los datos sintéticos se conservan en Supabase local. No se ejecutó reset ni purga destructiva.

## Pendientes reales y siguiente tarea

1. Automatizar el recorrido E2E de navegador ya comprobado manualmente, incluyendo apertura del
   editor, enlaces estables, Realtime y papelera, contra Supabase local en CI.
2. Auditoría de sólo lectura del esquema/migraciones de Cloud antes de cualquier promoción;
   el arreglo de la consulta no necesita agregar columnas. Resolver diferencias por separado.
3. Verificación del login Cloud desde el navegador elegido con su configuración explícita;
   el problema histórico de red no se declara resuelto en Cloud.
4. Conversión explícita entre la zona del navegador y la del evento; staging aislado, rate limiting,
   observabilidad sin PII y programación de purga siguen pendientes según el roadmap.

No se hizo merge a `master`, force push ni modificación de otras ramas remotas.
