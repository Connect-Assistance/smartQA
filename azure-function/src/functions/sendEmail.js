const { app } = require('@azure/functions');
const nodemailer = require('nodemailer');

/**
 * POST /api/sendEmail
 *
 * Body esperado:
 * {
 *   "dirigido": "equipo@ejemplo.com",   // destinatario (requerido)
 *   "copiaSupervisor": "sup@ejemplo.com", // opcional, va en CC
 *   "po": "45210",
 *   "operador": "Movistar Home",
 *   "cuerpo": "texto completo del correo generado"
 * }
 *
 * Variables de entorno (App Settings en Azure, nunca hardcodeadas):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_APP_PASSWORD, ALLOWED_ORIGIN
 */

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

    const { dirigido, copiaSupervisor, po, operador, cuerpo } = body || {};

    if (!dirigido || !cuerpo) {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'Falta "dirigido" o "cuerpo".' } };
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
      context.error('Faltan SMTP_USER / SMTP_APP_PASSWORD en la configuración de la Function App.');
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'Configuración SMTP incompleta en el servidor.' } };
    }

    try {
      const transporter = buildTransport();
      const info = await transporter.sendMail({
        from: `"Equipo de Calidad y Formación Regional" <${process.env.SMTP_USER}>`,
        to: dirigido,
        cc: copiaSupervisor || undefined,
        subject: `Trazabilidad de calidad – Caso ${po || ''} – ${operador || ''}`,
        text: cuerpo,
      });

      context.log(`Correo enviado. messageId=${info.messageId} para PO=${po}`);
      return { status: 200, headers: corsHeaders(), jsonBody: { ok: true, messageId: info.messageId } };
    } catch (err) {
      context.error('Error enviando correo por SMTP:', err);
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'No se pudo enviar el correo.', detail: err.message } };
    }
  },
});
