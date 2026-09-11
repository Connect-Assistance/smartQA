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

## v0.2.2 — 2026-09-11

- Actualiza a la Send Mail API v1.1: ahora soporta adjuntos reales (`attachment.content/filename/type`, hasta 25MB). La evidencia Helios pasa de estar incrustada en el HTML a mandarse como adjunto real de la API.
- Nota importante documentada: la disposición del adjunto siempre es "attachment" (descargable) — no hay inline sin coordinar con el equipo de TI que administra la API. La Vista previa del demo lo deja explícito.
- Actualiza `docs/SendMail-API-Connect.pdf` a la v1.1.

## v0.2.2.1 — 2026-09-11 (fix)

- Corrige el número de versión visible en el login, que se había quedado en v0.1.0 por un error mío en el proceso de deploy anterior (bumpeaba la copia del clon temporal, no el archivo fuente, así que el próximo deploy volvía a pisarlo). El contenido funcional ya estaba correcto desde v0.2.2 — este fix es solo del número mostrado.

## v0.3.0 — 2026-09-11

- Elimina por completo el modo simulado de "Enviar correo". El botón ahora siempre hace el request real contra `sendEmail` (nuestra Function App), que a su vez llama a la Send Mail API del lado del servidor. Si la URL todavía no está configurada, muestra un error claro en vez de fingir un envío exitoso.

## v0.3.1 — 2026-09-11

- El demo pasa a llamar directo al proxy real `sendMailProxy` (`audit-qa-bceva8a6byeyehgx.eastus2-01.azurewebsites.net/api/sendMailProxy`), que maneja el Bearer token del lado de Azure. Ya no depende de una Function App propia deployada por separado para enviar — el HTML del correo y el adjunto (si hay evidencia Helios) se arman en el navegador y se mandan directo con el formato documentado (`dest`, `subject`, `message`, `attachment`).

## v0.3.2 — 2026-09-11

- Saca la data de ejemplo que quedaba precargada al abrir "Generar correo" (dos llamadas de muestra). Ahora el formulario arranca vacío del todo — solo queda orientación como placeholder en cada campo (ID, hora, agente, resumen), sin ningún valor real cargado por defecto.

## v0.4.0 — 2026-09-11

- Validaciones nuevas en el formulario: Fecha del evento (obligatoria, no puede ser futura), Placa del vehículo (formato válido o "N/A"), y Dirigido a (debe ser un email válido) — con borde rojo en el campo y un aviso consolidado si falta algo al tocar "Generar correo de trazabilidad".
- El HTML del correo ahora se puede editar directo en la Vista previa (botón "Editar" hace el cuerpo `contenteditable`, sin una caja de texto plano aparte) — lo que se escribe o formatea ahí es literalmente lo que se copia, se abre en Gmail o se manda por la API.
- Fix: la imagen de evidencia Helios ya no se duplicaba entre el cuerpo editable y el adjunto real — ahora la vista previa de la imagen queda fuera de la zona editable/enviada, y el adjunto real sigue viajando aparte.

## v0.4.1 — 2026-09-11

- Reemplaza el botón "Abrir en Gmail" (ya no hace falta) por "Editar" en la fila de acciones, con su contraparte "Guardar" cuando está en modo edición — flujo explícito de dos pasos en vez de un toggle chico que era fácil de no notar.
- Agrega timeout de 25s al envío por la API — si no responde en ese tiempo, muestra un error claro en vez de quedar colgado indefinidamente en "Enviando...".

## v0.5.0 — 2026-09-11

- Persistencia real de casos: cada correo enviado con éxito se guarda en la tabla `smartqa_casos` de Supabase (mismo proyecto RBAC compartido). SQL de creación en `supabase/casos-table.sql`.
- Overview, Casos y Métricas ahora leen de esa tabla en vez de mostrar ceros fijos — casos por país, distribución del semáforo, casos por semana, y los filtros de Métricas (país/cuenta/fecha/estado) ya calculan sobre datos reales.
- "Tiempo promedio por caso" queda en "—" hasta que haya una forma real de medir duración por caso — no se inventa ese número.
