// Envía al docente, por correo, el contenido que acaba de generar.
//
// Nota de seguridad importante: el destinatario NO lo elige el navegador.
// El navegador solo manda su credencial de sesión; este servidor le pregunta
// a Supabase de quién es esa credencial y le envía el correo a esa persona.
// Así, aunque alguien manipule la página, no puede usar esto para mandarle
// correos a terceros.

const SUPABASE_URL = "https://tagpacbeosktddomudqu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qJJiBuGFJ-LGEOx5JkVIyg_OWOSA8qb";

// Para pasar a dominio propio, basta con configurar CORREO_REMITENTE en
// Vercel (ej: "ProfeIA <hola@tudominio.co>"). Sin esa variable se usa la
// dirección de pruebas de Resend, que solo entrega al dueño de la cuenta.
const REMITENTE = process.env.CORREO_REMITENTE || "ProfeIA <onboarding@resend.dev>";

const TITULOS = {
  preparacion: "Preparación de clase",
  infografia: "Infografía del tema",
  cuestionario: "Cuestionario tipo Pruebas Saber"
};

// Convierte el contenido en HTML legible dentro del correo.
function armarCuerpo({ tipo, asignatura, grado, tema, contenido }) {
  let interior;

  if (tipo === "infografia") {
    try {
      const info = JSON.parse(contenido.replace(/```json|```/g, "").trim());
      interior = `
        <h2 style="margin:0 0 4px; font-size:20px; color:#1F5C6E;">${info.titulo}</h2>
        <p style="margin:0 0 20px; color:#6B6B6B;">${info.subtitulo}</p>
        ${info.bloques.map(b => `
          <div style="border-left:3px solid #FF6B4A; padding-left:12px; margin-bottom:16px;">
            <strong style="color:#1F5C6E;">${b.encabezado}</strong><br>
            <span style="color:#2B2B2B;">${b.contenido}</span>
          </div>
        `).join("")}
        ${info.dato_clave ? `<p style="background:#F3F6F5; padding:12px; border-radius:8px;"><strong>Dato clave:</strong> ${info.dato_clave}</p>` : ""}
      `;
    } catch (e) {
      // Si el JSON viene mal formado, se envía como texto plano igual.
      interior = null;
    }
  }

  if (!interior) {
    // Escapamos el texto: el contenido viene de la IA y va dentro de HTML.
    const seguro = contenido
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    interior = `<pre style="white-space:pre-wrap; font-family:Georgia,serif; font-size:15px; line-height:1.6; color:#2B2B2B; margin:0;">${seguro}</pre>`;
  }

  return `
  <div style="max-width:640px; margin:0 auto; padding:24px; font-family:Helvetica,Arial,sans-serif; background:#FAF9F6;">
    <div style="font-size:18px; font-weight:700; color:#1F5C6E; margin-bottom:20px;">ProfeIA</div>
    <div style="background:#FFFFFF; border:1px solid #E3E0D8; border-radius:12px; padding:24px;">
      <p style="margin:0 0 4px; font-size:13px; color:#6B6B6B; text-transform:uppercase; letter-spacing:0.5px;">
        ${TITULOS[tipo] || "Contenido generado"}
      </p>
      <h1 style="margin:0 0 4px; font-size:22px; color:#2B2B2B;">${tema}</h1>
      <p style="margin:0 0 24px; font-size:14px; color:#6B6B6B;">${asignatura} &middot; ${grado}</p>
      <hr style="border:none; border-top:1px solid #E3E0D8; margin:0 0 24px;">
      ${interior}
    </div>
    <p style="font-size:12px; color:#6B6B6B; margin-top:20px; text-align:center;">
      Este contenido también quedó guardado en tu historial dentro de ProfeIA.
    </p>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { token, tipo, asignatura, grado, tema, contenido } = req.body || {};

  if (!token) {
    return res.status(401).json({ error: "Necesitas iniciar sesión para enviarte el correo." });
  }
  if (!contenido || !tema) {
    return res.status(400).json({ error: "Falta el contenido que se quiere enviar." });
  }

  try {
    // 1. Preguntarle a Supabase quién es el dueño de esta sesión.
    const perfil = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });

    if (!perfil.ok) {
      return res.status(401).json({ error: "Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo." });
    }

    const usuario = await perfil.json();
    const destinatario = usuario.email;

    if (!destinatario) {
      return res.status(401).json({ error: "No pudimos identificar tu correo." });
    }

    // 2. Enviarle el correo a esa persona, y solo a esa persona.
    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [destinatario],
        subject: `${TITULOS[tipo] || "ProfeIA"}: ${tema}`,
        html: armarCuerpo({ tipo, asignatura, grado, tema, contenido })
      })
    });

    if (!envio.ok) {
      const detalle = await envio.text();
      // El caso más común en modo de pruebas: Resend solo entrega correos
      // al dueño de la cuenta mientras no haya un dominio verificado.
      console.error("Resend rechazó el envío:", detalle);
      return res.status(502).json({
        error: "No se pudo enviar el correo. Revisa la configuración de envío."
      });
    }

    res.status(200).json({ ok: true, destinatario });
  } catch (e) {
    console.error("Error enviando el correo:", e);
    res.status(500).json({ error: "Ocurrió un error enviando el correo." });
  }
}
