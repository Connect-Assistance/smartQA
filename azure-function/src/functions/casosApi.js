const { app } = require('@azure/functions');
const admin = require('firebase-admin');

/**
 * GET  /api/casosApi        -> lista los casos (requiere sesión de Firebase válida)
 * POST /api/casosApi        -> guarda un caso enviado (requiere sesión de Firebase válida)
 *
 * Reemplaza el acceso directo del navegador a la tabla smartqa_casos con la
 * anon key de Supabase. Ese acceso directo quedó demasiado abierto: cualquiera
 * con la anon key (visible en el HTML del demo) podía leer TODOS los casos
 * — nombres de clientes, correos de destinatarios, cuerpo de las quejas —
 * sin pasar por ningún login. Con esto:
 *
 *   1. El navegador manda el ID token de Firebase (Authorization: Bearer <idToken>).
 *   2. Esta función lo verifica con el Admin SDK — si no es válido o no es
 *      @connect.inc, corta ahí.
 *   3. Solo si el token es válido, usa la SERVICE ROLE KEY de Supabase (que
 *      nunca sale del servidor) para leer/escribir en smartqa_casos.
 *
 * La tabla en Supabase queda sin ninguna política abierta para "anon" — la
 * única forma de tocarla es a través de esta función.
 *
 * Variables de entorno requeridas (App Settings en Azure):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — el JSON completo de la cuenta de servicio
 *                                    de Firebase (Project Settings → Service
 *                                    accounts → Generate new private key),
 *                                    pegado como un solo string.
 *   SUPABASE_SERVICE_ROLE_KEY      — Supabase → Project Settings → API →
 *                                    "service_role" (NO la anon key — esta sí
 *                                    es secreta, nunca va al navegador).
 *   SUPABASE_URL                   — https://dednkgonnirybnpktbzp.supabase.co
 *   ALLOWED_ORIGIN                 — https://quality-sendemail.connectlabs.tech
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dednkgonnirybnpktbzp.supabase.co';
const DOMINIOS_PERMITIDOS = ['connect.inc'];

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

async function verificarUsuario(request) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) throw new Error('Falta el token de sesión.');

  const decoded = await admin.auth().verifyIdToken(idToken);
  const email = decoded.email || '';
  const dominio = email.split('@')[1] || '';
  if (!DOMINIOS_PERMITIDOS.includes(dominio.toLowerCase())) {
    throw new Error('La cuenta no pertenece a Connect.');
  }
  return email;
}

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase respondió ${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

app.http('casosApi', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous', // la autorización real la hace verificarUsuario() con el token de Firebase
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders() };
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      context.error('Faltan FIREBASE_SERVICE_ACCOUNT_JSON o SUPABASE_SERVICE_ROLE_KEY en la Function App.');
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'Configuración incompleta en el servidor.' } };
    }

    let email;
    try {
      email = await verificarUsuario(request);
    } catch (err) {
      return { status: 401, headers: corsHeaders(), jsonBody: { error: 'No autorizado: ' + err.message } };
    }

    try {
      if (request.method === 'GET') {
        const data = await supabaseRequest('smartqa_casos?select=*&order=enviado_at.desc&limit=200');
        return { status: 200, headers: corsHeaders(), jsonBody: { data } };
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const fila = { ...body, enviado_por: email }; // el email sale del token verificado, no de lo que mande el cliente
        await supabaseRequest('smartqa_casos', {
          method: 'POST',
          body: JSON.stringify(fila),
          headers: { Prefer: 'return=minimal' },
        });
        return { status: 200, headers: corsHeaders(), jsonBody: { ok: true } };
      }

      return { status: 405, headers: corsHeaders(), jsonBody: { error: 'Método no permitido.' } };
    } catch (err) {
      context.error('Error en casosApi:', err);
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'No se pudo completar la operación.', detail: err.message } };
    }
  },
});
