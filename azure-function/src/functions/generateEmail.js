const { app } = require('@azure/functions');

/**
 * POST /api/generateEmail
 *
 * Body esperado:
 * {
 *   "promptText": "texto con los datos del caso y las llamadas (armado por el demo)",
 *   "heliosBase64": "opcional, imagen en base64 si se adjuntó evidencia Helios",
 *   "heliosMime": "opcional, ej. image/png"
 * }
 *
 * Variable de entorno requerida: ANTHROPIC_API_KEY (App Setting en Azure, nunca hardcodeada).
 *
 * El SYSTEM_PROMPT vive acá, del lado del servidor — no viaja desde el navegador.
 * Eso evita que alguien manipule las reglas de tono/estructura desde el cliente.
 */

const SYSTEM_PROMPT = `Sos analista de calidad senior de Connect Asistencias Extraordinarias. Código corporativo: AYUDAMOS PERSONAS.
Redactá un correo de trazabilidad de calidad en español: profesional pero cercano, claro y directo.

Reglas de escritura obligatorias:
- Frases cortas. Si una oración supera 20 palabras, partila en dos.
- Nunca encadenes gerundios.
- Palabras prohibidas: expeditar, procurar, brindar, concretar la gestión, minimizar la percepción, se identifica la oportunidad, diligenciar, evidenciar, robustecer, implementar mejoras.
- Usá en cambio: agilizar, buscar, dar, resolver, evitar que el cliente sienta, hay una oportunidad, completar, mostrar, fortalecer, aplicar.

Estructura obligatoria del correo (en este orden):
1. Saludo fijo: "Cordial saludo equipo,"
2. Descripción del caso: PO, cliente, fecha del evento, país, aseguradora/cuenta, tipo de servicio, placa del vehículo (si aplica) y resumen breve del motivo.
3. Análisis de interacciones: por cada llamada, ID exacto, hora, agente, resumen y una oportunidad de mejora con tres partes: (a) qué pasó en la llamada, (b) por qué afecta al cliente, (c) qué debe mejorar el asesor de forma concreta.
4. Evidencia Helios, solo si se adjuntó una imagen.
5. Hallazgos de calidad: máximo 3 puntos, patrones generales, sin repetir las oportunidades de mejora ya mencionadas. Si el analista aportó hallazgos adicionales, incorporalos ahí.
6. Cierre fijo: "AYUDAMOS PERSONAS"
7. Firma fija: "Equipo de Calidad y Formación Regional - Connect"

Además, antes que nada, generá una primera línea con este formato exacto:
SEMAFORO: <VERDE|AMARILLO|ROJO> - <razón en máximo 12 palabras>
Después de esa línea dejá una línea en blanco y continuá con el correo completo empezando por el saludo.`;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

app.http('generateEmail', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'function',
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

    const { promptText, heliosBase64, heliosMime } = body || {};
    if (!promptText) {
      return { status: 400, headers: corsHeaders(), jsonBody: { error: 'Falta "promptText".' } };
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      context.error('Falta ANTHROPIC_API_KEY en la configuración de la Function App.');
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'Configuración de IA incompleta en el servidor.' } };
    }

    const userContent = heliosBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: heliosMime || 'image/png', data: heliosBase64 } },
          { type: 'text', text: promptText },
        ]
      : promptText;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5', // modelo real de la API pública — "claude-sonnet-4-6" solo existe dentro del entorno de artifacts de Claude
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        context.error('Anthropic API error:', response.status, errText);
        return { status: 502, headers: corsHeaders(), jsonBody: { error: 'La API de Claude respondió con error.', detail: errText } };
      }

      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text);
      const full = textBlocks.join('\n').trim();

      return { status: 200, headers: corsHeaders(), jsonBody: { text: full } };
    } catch (err) {
      context.error('Error generando el correo:', err);
      return { status: 500, headers: corsHeaders(), jsonBody: { error: 'No se pudo generar el correo.', detail: err.message } };
    }
  },
});
