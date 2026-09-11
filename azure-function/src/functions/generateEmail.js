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
Redactá un correo de trazabilidad de calidad en español: profesional pero cercano, claro y directo, como lo escribiría una persona experta hablando con un colega.

Reglas de escritura obligatorias:
- Frases cortas. Si una oración supera 20 palabras, partila en dos.
- Nunca encadenes gerundios.
- Palabras prohibidas: expeditar, procurar, brindar, concretar la gestión, minimizar la percepción, incrementar, se identifica la oportunidad, burocracia, diligenciar, evidenciar, robustecer, implementar mejoras.
- Usá en cambio: agilizar, buscar, dar, resolver, evitar que el cliente sienta, aumentar, hay una oportunidad, completar, mostrar, fortalecer, aplicar.
- Las oportunidades de mejora van siempre en tres partes: (1) qué pasó en la llamada, (2) por qué afecta al cliente, (3) qué debe mejorar el asesor de forma concreta.
- Nunca incluyas secciones "Acciones Recomendadas" ni "Punto de Falla".

Estructura obligatoria del cuerpo del correo (en este orden):
1. Saludo fijo: "Cordial saludo equipo,"
2. Descripción del caso: PO, cliente, fecha del evento, país, aseguradora/cuenta, tipo de servicio, placa del vehículo (si aplica), y 1-2 líneas resumiendo el motivo. Omití los campos vacíos.
3. Análisis de interacciones — por cada llamada, con este formato exacto de encabezado:
   Llamada [N] | ID: [exacto] | Hora: [valor] | Agente: [valor]
   Resumen: [1-2 líneas, tono cercano]
   Oportunidad de mejora: [las tres partes de arriba]
4. Evidencia Helios, solo si se adjuntó una imagen.
5. Hallazgos de calidad: máximo 3 puntos con guion (—), patrones generales, sin repetir las oportunidades de mejora ya mencionadas. Si el analista aportó hallazgos adicionales, incorporalos ahí.
6. Cierre fijo: "AYUDAMOS PERSONAS"
7. Firma fija: "Equipo de Calidad y Formación Regional - Connect"

Marcá los títulos importantes en negrita usando **texto** (por ejemplo **Llamada 1 | ID: ... | Hora: ... | Agente: ...**, **Resumen:**, **Oportunidad de mejora:**, **Hallazgos de calidad:**, **AYUDAMOS PERSONAS**) para que el correo sea más fácil de leer.

Respondé ÚNICAMENTE con JSON puro, sin markdown ni texto fuera del JSON:
{"asunto":"...", "alerta":"VERDE|AMARILLO|ROJO", "alerta_razon":"razón en máximo 12 palabras", "cuerpo":"el correo completo, empezando por el saludo"}
Usá \\n para los saltos de línea dentro de "cuerpo". No uses comillas dobles dentro del texto.`;

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
          max_tokens: 1500,
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
