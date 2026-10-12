# Roadmap

## Completado — Fundamentos verticales

- Auth, organización personal y aislamiento RLS.
- Evento, agenda, grupos, lugares individuales, acompañantes y capacidad derivada.
- Enlace seguro, RSVP transaccional, historial e idempotencia.
- Ciclo borrador/publicado/archivado, pruebas unitarias, pgTAP y CI.
- Migraciones beta aplicadas al proyecto `invitame-development`.

## Completado — Editor foundation

- Contactos por invitado nominal con guardado atómico y validación de un canal mínimo.
- Boletos `unnamed_extra` independientes, RSVP individual y backfill compatible de +1.
- Una sola línea de tiempo cronológica; `events.starts_at` queda como proyección legada.
- Papelera con retención de 30 días, restauración, revocación pública y purga exclusiva auditada.
- Modo lectura/edición y preview vivo compartido con la invitación pública.
- Fecha visible `dd/mm/aaaa`, header sticky, menús fuera de flujo y rutas Cuenta/Papelera.

## Siguiente fase recomendada — Hardening operativo de la beta

- Automatizar E2E de navegador para creación, edición, RSVP, papelera y restauración.
- Programar la RPC de purga con un job autenticado y alertas, primero en desarrollo/staging.
- Incorporar rate limiting público, observabilidad sin PII y revisión de planes/índices con volumen.
- Resolver conversión explícita entre zona del navegador y zona del evento.
- Preparar un entorno staging aislado antes de integrar cualquier canal real.

## Después

- Integración aislada de Places/Maps con cuotas y clave restringida.
- Sistema visual, contrato de plantillas y primera invitación premium.
- Importación/exportación CSV y envío manual asistido.
- Publicación y cobro por evento.

## Post-MVP

Colaboración avanzada, planes profesionales, recordatorios, QR/check-in, mesas, analytics,
dominios personalizados y white-label. IA permanece como exploración futura.
