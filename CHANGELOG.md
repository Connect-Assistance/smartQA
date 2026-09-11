# Changelog — SMART QA

Formato: `vMAJOR.MINOR.PATCH` — visible en la pantalla de login.
Cada entrada resume el cambio, no el detalle línea por línea (eso vive en los commits de `daya`/`main`).

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
