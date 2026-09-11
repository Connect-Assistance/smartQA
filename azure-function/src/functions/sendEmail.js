const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/sendEmail
 *
 * Body esperado (viene directo del JSON que devuelve generateEmail, más la
 * evidencia Helios si se adjuntó una en el formulario):
 * {
 *   "dirigido": "equipo@ejemplo.com",     // destinatario (requerido)
 *   "asunto": "Trazabilidad de calidad – Caso 45210 – Movistar Home",
 *   "alerta": "VERDE" | "AMARILLO" | "ROJO",
 *   "alerta_razon": "razón corta",
 *   "cuerpo": "texto plano completo del correo generado",
 *   "heliosBase64": "...",   // opcional, base64 de la captura de Helios
 *   "heliosMime": "image/png" // opcional
 * }
 *
 * Esta función es un PUENTE hacia la Send Mail API real de Connect
 * (documentación: docs/SendMail-API-Connect.pdf, v1.1 sep 2026), que corre
 * sobre el mismo Function App que usa AuditQA:
 *   https://audit-qa-bceva8a6byeyehgx.eastus2-01.azurewebsites.net/api/sendMail
 *
 * El navegador nunca llama a esa API directo — le pega a ESTA función (con
 * su propia function key), y esta función hace la llamada del lado del
 * servidor con el Bearer token real, que solo vive acá como variable de
 * entorno. Así el token de la Send Mail API nunca queda expuesto en el
 * navegador ni en el repo.
 *
 * Variables de entorno requeridas (App Settings en Azure):
 *   SEND_MAIL_API_TOKEN  — el Bearer token de la Send Mail API (nunca hardcodeado)
 *   ALLOWED_ORIGIN        — https://quality-sendemail.connectlabs.tech
 *
 * Nota sobre la evidencia Helios (v1.1 del PDF): la API ya soporta adjuntos
 * reales (content base64 + filename + type, límite 25MB), pero la
 * disposición SIEMPRE es "attachment" (archivo descargable) — no hay forma
 * de que la imagen se vea inline dentro del cuerpo del correo sin hablar con
 * el equipo de TI que administra la Send Mail API. Por eso acá va como
 * adjunto real, no incrustada en el HTML.
 *
 * IMPORTANTE — límite de la Send Mail API: 10 solicitudes por hora POR IP.
 * Como esta función llama del lado del servidor, todas las llamadas salen
 * con la misma IP del Function App — ese límite de 10/hora se comparte entre
 * TODO el equipo que use "Enviar correo" en SMART QA, no es 10 por persona.
 * Si el equipo crece, esto va a haber que revisarlo con quien administre la
 * Send Mail API.
 */

const SEND_MAIL_API_URL = 'https://audit-qa-bceva8a6byeyehgx.eastus2-01.azurewebsites.net/api/sendMail';

const SEMAFORO_COLORS = {
  VERDE:    { bg: '#E4F5EC', fg: '#1E8E5A', label: 'Verde' },
  AMARILLO: { bg: '#FDF1DD', fg: '#B9720C', label: 'Amarillo' },
  ROJO:     { bg: '#FBE7E2', fg: '#C5432A', label: 'Rojo' },
};

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'correo-trazabilidad.html');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// El cuerpo usa **texto** para marcar títulos importantes en negrita (estilo Markdown liviano).
function aplicarNegritas(escapedHtml) {
  return escapedHtml.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Convierte el texto plano del cuerpo (con \n\n entre párrafos) a HTML seguro para correo.
function plainTextToHtml(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map(paragraph =>
      `<p style="margin:0 0 14px;">${aplicarNegritas(escapeHtml(paragraph)).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n');
}

function buildEmailHtml({ asunto, alerta, alerta_razon, cuerpo }) {
  const sem = SEMAFORO_COLORS[(alerta || 'AMARILLO').toUpperCase()] || SEMAFORO_COLORS.AMARILLO;
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  html = html
    .replaceAll('{{ASUNTO}}', escapeHtml(asunto || ''))
    .replaceAll('{{SEMAFORO_BG}}', sem.bg)
    .replaceAll('{{SEMAFORO_FG}}', sem.fg)
    .replaceAll('{{SEMAFORO_LABEL}}', sem.label)
    .replaceAll('{{SEMAFORO_RAZON}}', escapeHtml(alerta_razon || ''))
    .replaceAll('{{CUERPO_HTML}}', plainTextToHtml(cuerpo || ''));

  return html;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

app.http('sendEmail', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'function', // requiere la function key en la URL o header x-functions-key
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'Body inválido, se esperaba JSON.' } };
    }

    const { dirigido, asunto, alerta, alerta_razon, cuerpo, heliosBase64, heliosMime } = body || {};

    if (!dirigido || !cuerpo) {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'Falta "dirigido" o "cuerpo".' } };
    }
    if (!process.env.SEND_MAIL_API_TOKEN) {
      context.error('Falta SEND_MAIL_API_TOKEN en la configuración de la Function App.');
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'Configuración de envío incompleta en el servidor.' } };
    }

    try {
      const htmlBody = buildEmailHtml({ asunto, alerta, alerta_razon, cuerpo });

      const payload = {
        dest: dirigido,
        subject: asunto || 'Trazabilidad de calidad',
        message: htmlBody,
      };

      if (heliosBase64) {
        const ext = MIME_TO_EXT[heliosMime] || 'png';
        payload.attachment = {
          content: heliosBase64,
          filename: `evidencia-helios.${ext}`,
          type: heliosMime || 'image/png',
        };
      }

      const response = await fetch(SEND_MAIL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SEND_MAIL_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        context.error('Send Mail API respondió con error:', response.status, data);
        // 429 = límite de 10/hora superado — se lo pasamos al front tal cual para que lo muestre.
        return { status: response.status, headers: corsHeaders(), jsonBody: { error: 'La Send Mail API rechazó el envío.', detail: data } };
      }

      context.log(`Correo enviado. messageId=${data?.mailersend?.messageId || 'desconocido'}`);
      return { status: 200, headers: corsHeaders(), jsonBody: { ok: true, messageId: data?.mailersend?.messageId } };
    } catch (err) {
      context.error('Error llamando a la Send Mail API:', err);
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'No se pudo enviar el correo.', detail: err.message } };
    }
  },
});
