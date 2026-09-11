# Changelog — SMART QA

Formato: `vMAJOR.MINOR.PATCH` — visible en la pantalla de login.
Cada entrada resume el cambio, no el detalle línea por línea (eso vive en los commits de `daya`/`main`).

## v0.2.0 — 2026-09-11

- `sendEmail` deja de usar SMTP/Gmail directo y pasa a ser un puente seguro hacia la Send Mail API real de Connect (documentación en `docs/SendMail-API-Connect.pdf`), que corre sobre el mismo Function App que AuditQA. El Bearer token vive solo del lado del servidor.
- Botón "Enviar correo" del demo queda conectado a `sendEmail` (activo en cuanto se cargue `SEND_EMAIL_ENDPOINT` con la URL real; sigue simulado mientras esté vacío).
- Documentado el límite real de la Send Mail API: 10 solicitudes/hora compartidas entre todo el equipo (la IP es la del Function App, no la de cada persona).

## v0.1.0 — 2026-09-11

Versión base del demo, con todo lo construido hasta ahora:

- Panel con sidebar responsive (drawer en mobile), 5 secciones: Overview, Generar correo, Casos, Métricas, Configuración.
- Generación del correo de trazabilidad 100% local (sin API ni key), con reglas de tono y detección de patrones en las llamadas.
- Vista previa del correo como HTML real (plantilla email-safe) con modo edición.
- Envío de correo simulado (pendiente de conectar a la Azure Function real).
- Login con Firebase Auth (Google SSO, dominio @connect.inc), reutilizando el proyecto `kai-academy-connect`.
- RBAC real vía Supabase (proyecto compartido `dednkgonnirybnpktbzp`) — roles admin / configurador / analista.
- Datos de ejemplo de Overview/Casos/Métricas limpiados a cero, listos para operación real.
- Azure Function de referencia (`azure-function/`) con `generateEmail` y `sendEmail`, no conectada todavía al demo en producción.

## v0.2.1 — 2026-09-11

- La evidencia Helios (imagen adjunta) ahora se incrusta como base64 directo dentro del HTML del correo (`<img src="data:...;base64,...">`), tanto en la Vista previa del demo como en el envío real vía `sendEmail`. La Send Mail API no tiene campo de adjuntos (ver `docs/SendMail-API-Connect.pdf`), así que viaja como parte del `message`, no como attachment aparte.
