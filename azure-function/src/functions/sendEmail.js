const { app } = require('@azure/functions');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/sendEmail
 *
 * Body esperado (viene directo del JSON que devuelve generateEmail):
 * {
 *   "dirigido": "equipo@ejemplo.com",     // destinatario (requerido)
 *   "copiaSupervisor": "sup@ejemplo.com", // opcional, va en CC
 *   "asunto": "Trazabilidad de calidad – Caso 45210 – Movistar Home",
 *   "alerta": "VERDE" | "AMARILLO" | "ROJO",
 *   "alerta_razon": "razón corta",
 *   "cuerpo": "texto plano completo del correo generado"
 * }
 *
 * Variables de entorno (App Settings en Azure, nunca hardcodeadas):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_APP_PASSWORD, ALLOWED_ORIGIN
 */

const SEMAFORO_COLORS = {
  VERDE:    { bg: '#E4F5EC', fg: '#1E8E5A', label: 'Verde' },
  AMARILLO: { bg: '#FDF1DD', fg: '#B9720C', label: 'Amarillo' },
  ROJO:     { bg: '#FBE7E2', fg: '#C5432A', label: 'Rojo' },
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

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true, // true para el puerto 465 (SSL)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD, // App Password de 16 caracteres, no la password normal de la cuenta
    },
  });
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

    const { dirigido, copiaSupervisor, asunto, alerta, alerta_razon, cuerpo } = body || {};

    if (!dirigido || !cuerpo) {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'Falta "dirigido" o "cuerpo".' } };
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
      context.error('Faltan SMTP_USER / SMTP_APP_PASSWORD en la configuración de la Function App.');
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'Configuración SMTP incompleta en el servidor.' } };
    }

    try {
      const htmlBody = buildEmailHtml({ asunto, alerta, alerta_razon, cuerpo });
      const transporter = buildTransport();
      const info = await transporter.sendMail({
        from: `"Equipo de Calidad y Formación Regional" <${process.env.SMTP_USER}>`,
        to: dirigido,
        cc: copiaSupervisor || undefined,
        subject: asunto || 'Trazabilidad de calidad',
        text: cuerpo,   // fallback en texto plano, por si el cliente de correo no muestra HTML
        html: htmlBody,
      });

      context.log(`Correo enviado. messageId=${info.messageId}`);
      return { status: 200, headers: corsHeaders(), jsonBody: { ok: true, messageId: info.messageId } };
    } catch (err) {
      context.error('Error enviando correo por SMTP:', err);
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'No se pudo enviar el correo.', detail: err.message } };
    }
  },
});
