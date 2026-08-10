// Esta función corre en el servidor de Vercel, nunca en el navegador del docente.
// Por eso aquí SÍ es seguro tener la API key (se configura como variable de entorno).

// Vercel corta las funciones a los 10 segundos por defecto. Generar un
// cuestionario completo toma más que eso, así que subimos el margen.
export const config = { maxDuration: 60 };

const PROMPTS = {
  preparacion: ({ asignatura, tema, grado }) => `
Eres un asesor pedagógico experto en diseño instruccional para docentes colombianos.

Con base en:
- Asignatura: ${asignatura}
- Tema: ${tema}
- Grado/nivel: ${grado}

Genera una guía de preparación de clase completa y lista para usar en el aula, con esta estructura exacta:

1. IMPORTANCIA DEL TEMA (2-3 párrafos)
2. ENFOQUE PEDAGÓGICO SUGERIDO
3. GUION DE CLASE PASO A PASO (Apertura, Desarrollo, Cierre)
4. EJEMPLOS CONCRETOS (mínimo 3, aplicados al contexto colombiano)
5. MATERIALES NECESARIOS
6. PREGUNTAS DE VERIFICACIÓN EN VIVO (3 preguntas)

Formato: texto claro, con títulos en mayúsculas. Extensión: 600-900 palabras. Ve directo al contenido, sin introducciones.
`,

  infografia: ({ asignatura, tema, grado }) => `
Eres un diseñador instruccional experto en comunicación visual educativa.

Con base en:
- Asignatura: ${asignatura}
- Tema: ${tema}
- Grado/nivel: ${grado}

Genera el contenido de una infografía educativa de una sola página, en este formato JSON exacto (responde SOLO el JSON, sin texto antes o después, sin marcadores de código):

{
  "titulo": "string, máximo 8 palabras",
  "subtitulo": "string, una frase que resuma el tema",
  "bloques": [
    {"encabezado": "string corto, 2-4 palabras", "contenido": "string, máximo 25 palabras, lenguaje simple"}
  ],
  "dato_clave": "una cifra, definición o dato memorable destacado"
}

Genera entre 4 y 6 bloques. El contenido debe ser visual y directo, no párrafos largos.
`,

  cuestionario: ({ asignatura, tema, grado }) => `
Eres un experto en evaluación educativa alineado a las Pruebas Saber del ICFES colombiano.

Con base en:
- Asignatura: ${asignatura}
- Tema: ${tema}
- Grado/nivel: ${grado}

Genera un cuestionario de 10 preguntas tipo Pruebas Saber (opción múltiple, 4 opciones A-D), con contexto/situación breve en cada enunciado. Varía la dificultad: 3 básicas, 4 intermedias, 3 avanzadas. Para cada pregunta incluye la respuesta correcta y una justificación breve. Preséntalo en texto claro y numerado.
`
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { tipo, asignatura, grado, tema } = req.body;

  if (!PROMPTS[tipo]) {
    return res.status(400).json({ error: "Tipo de contenido inválido" });
  }

  try {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // El límite real aquí no es el modelo, es el reloj de Vercel: la
        // función se corta a los 60 s. Con 2000 el cuestionario se cortaba en
        // la pregunta 8; con 8000 el modelo se extendía tanto que pasaba de
        // los 60 s y devolvía 504. 4000 es el punto medio verificado.
        max_tokens: 4000,
        messages: [{ role: "user", content: PROMPTS[tipo]({ asignatura, grado, tema }) }]
      })
    });

    // Si tu cuenta llega a su límite de capacidad (esto es normal cuando
    // muchos docentes usan la herramienta a la vez), Anthropic responde con
    // un código 429. En vez de que el docente vea un error técnico feo,
    // le damos un mensaje claro y le pedimos reintentar en un momento.
    if (respuesta.status === 429) {
      return res.status(429).json({
        error: "Estamos con mucha demanda en este momento. Intenta de nuevo en unos segundos."
      });
    }

    if (!respuesta.ok) {
      return res.status(502).json({ error: "No se pudo generar el contenido. Intenta de nuevo." });
    }

    const data = await respuesta.json();
    const contenido = data.content?.[0]?.text || "No se pudo generar el contenido.";

    res.status(200).json({ contenido });
  } catch (e) {
    res.status(500).json({ error: "Error generando contenido" });
  }
}
