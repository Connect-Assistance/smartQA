/**
 * Referencia: endpoint de backend para enviar el correo de trazabilidad por Gmail.
 *
 * Esto NO corre en el navegador — va en el backend (Cloud Run / Node.js) del
 * brief original, junto al endpoint /generar. El demo en HTML nunca puede
 * hacer esto directo porque expondría credenciales SMTP a cualquiera que
 * abra el archivo.
 *
 * Dos formas de autenticar contra Gmail. Elegí una:
 *
 *  A) App Password de una cuenta de Google Workspace (más simple, rápido de
 *     montar, pero es una contraseña de aplicación viviendo en Secret Manager).
 *  B) OAuth2 (más trabajo inicial, pero es lo recomendado para una cuenta de
 *     Workspace administrada como @connect.inc — no depende de una password).
 *
 * Ambas usan SMTP de Gmail vía nodemailer. Instalación:
 *   npm install nodemailer
 */

const nodemailer = require('nodemailer');

/* ---------- Opción A: App Password ---------- */
function buildTransportAppPassword() {
  // GMAIL_USER y GMAIL_APP_PASSWORD deben venir de Secret Manager, nunca de .env commiteado
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,          // ej. trazabilidad@connect.inc
      pass: process.env.GMAIL_APP_PASSWORD,  // App Password de 16 caracteres, no la password normal
    },
  });
}

/* ---------- Opción B: OAuth2 (recomendada para Workspace) ---------- */
function buildTransportOAuth2() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
      clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
    },
  });
}

/**
 * Handler del endpoint POST /enviar
 * Se llama después de /generar, una vez el analista revisó el correo generado.
 */
async function handleEnviar(req, res) {
  const { dirigido, copiaSupervisor, po, operador, cuerpo } = req.body || {};

  if (!dirigido || !cuerpo) {
    return res.status(400).json({ error: 'Falta destinatario o cuerpo del correo.' });
  }

  const transporter = buildTransportOAuth2(); // o buildTransportAppPassword()

  try {
    const info = await transporter.sendMail({
      from: `"Equipo de Calidad y Formación Regional" <${process.env.GMAIL_USER}>`,
      to: dirigido,
      cc: copiaSupervisor || undefined,
      subject: `Trazabilidad de calidad – Caso ${po} – ${operador}`,
      text: cuerpo,
    });

    // Registrar el envío en el log (Google Sheets / Supabase / la tabla que usen)
    // await registrarEnvio({ po, dirigido, messageId: info.messageId, fecha: new Date() });

    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error('Error enviando correo:', err);
    return res.status(500).json({ error: 'No se pudo enviar el correo.', detail: err.message });
  }
}

module.exports = { handleEnviar, buildTransportAppPassword, buildTransportOAuth2 };
