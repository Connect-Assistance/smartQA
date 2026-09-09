# SMART QA — Demo

Demo funcional del sistema de trazabilidad de calidad con IA para el equipo de
Calidad y Formación Regional (Connect Asistencias Extraordinarias).

## Contenido

- `smart-qa-demo.html` — demo standalone (HTML + JS), corre directo en el
  navegador. Genera correos de trazabilidad reales llamando a la API de
  Claude, con datos de ejemplo para caso, casos y métricas. El envío de
  correo por el botón "Enviar correo" es **simulado** — no manda correo real.
- `backend-referencia/enviar-correo-backend-referencia.js` — referencia de
  cómo se conectaría el envío real por Gmail/SMTP desde un backend (Cloud
  Run / Node.js), para cuando se trabaje la fase de seguridad y producción.
  No corre desde el navegador.

## Estado

Demo para presentación interna. Pendiente: integración real con el sistema
de casos, envío de correo real, y persistencia de casos/métricas.
