// Genera una ilustración decorativa relacionada con el tema de la clase,
// usando la API de generación de imágenes de OpenAI (DALL-E).
// Esta ilustración se usa como acompañamiento visual de la infografía;
// el texto se sigue generando aparte para que siempre quede legible.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { asignatura, tema, grado } = req.body;

  const promptImagen = `Ilustración educativa plana, estilo infografía escolar colombiana, colores vivos (azul petróleo y coral), sin texto ni letras, tema: "${tema}" de la asignatura ${asignatura}, para estudiantes de ${grado}. Estilo caricatura simple, amigable, plano (flat design), fondo transparente o blanco.`;

  try {
    const respuesta = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: promptImagen,
        size: "1024x1024",
        n: 1
      })
    });

    if (respuesta.status === 429) {
      return res.status(429).json({ error: "Mucha demanda en este momento, intenta de nuevo." });
    }
    if (!respuesta.ok) {
      return res.status(502).json({ error: "No se pudo generar la ilustración." });
    }

    const data = await respuesta.json();
    // La API devuelve la imagen en base64
    const imagenBase64 = data.data?.[0]?.b64_json;

    res.status(200).json({ imagen: imagenBase64 });
  } catch (e) {
    res.status(500).json({ error: "Error generando la ilustración" });
  }
}
