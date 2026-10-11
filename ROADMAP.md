# Roadmap

## Completado — Fundamentos verticales

- Auth, organización personal y aislamiento RLS.
- Evento, agenda, grupos, lugares individuales, acompañantes y capacidad derivada.
- Enlace seguro, RSVP transaccional, historial e idempotencia.
- Ciclo borrador/publicado/archivado, pruebas unitarias, pgTAP y CI.
- Migraciones beta aplicadas al proyecto `invitame-development`.

## Fase actual — Corrección funcional y UX beta

- Guardado atómico de grupo, personas, +1, orden y destinatarios.
- Capacidad de grupo derivada; sin “usuario/contacto principal” en la interfaz.
- Tarjetas en lectura con modo de edición explícito y un solo guardado.
- Primer enlace automático, copia accesible y revocación separada de RSVP.
- Reinicio de respuestas auditado, fechas futuras y eliminación lógica segura.
- Breadcrumbs, navegación móvil y menú de cuenta.

## Siguiente fase recomendada — Cerrar la beta operativa

- Revisar y aplicar manualmente `202610100001_beta_ux_fixes.sql` en desarrollo.
- Ejecutar el recorrido manual completo contra `invitame-development`.
- Añadir E2E de navegador para persistencia, enlace público y errores de RPC.
- Incorporar rate limiting público, observabilidad sin PII y revisión de planes/índices con
  volumen sintético.
- Configurar SMTP exclusivamente en staging.

## Después

- Integración aislada de Places/Maps con cuotas y clave restringida.
- Sistema visual, contrato de plantillas y primera invitación premium.
- Importación/exportación CSV y envío manual asistido.
- Publicación y cobro por evento.

## Post-MVP

Colaboración avanzada, planes profesionales, recordatorios, QR/check-in, mesas, analytics,
dominios personalizados y white-label. IA permanece como exploración futura.
