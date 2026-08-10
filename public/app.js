// ======================================================
// CONFIGURACIÓN de Supabase
// Estos dos valores son públicos por diseño: viven en el navegador del
// docente. Lo que protege los datos es la política RLS de la base
// (ver supabase-schema.sql), no el ocultamiento de estas claves.
// ======================================================
const SUPABASE_URL = "https://tagpacbeosktddomudqu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qJJiBuGFJ-LGEOx5JkVIyg_OWOSA8qb";

// Ojo: la librería que se carga desde el CDN ya ocupa el nombre global
// "supabase" (window.supabase). Por eso el cliente se llama "db" aquí:
// usar "const supabase" choca con ese global y rompe todo el archivo.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let ultimoResultado = "";
let ultimoTipo = "";
// Datos de lo último que se mostró en pantalla, para poder enviarlo por
// correo con su encabezado correcto (sirve igual si viene del historial).
let ultimoContexto = { asignatura: "", grado: "", tema: "" };

// ---------- LOGIN CON LINK MÁGICO (sin contraseñas que recordar) ----------
async function enviarLinkMagico() {
  const correo = document.getElementById("input-correo").value.trim();
  if (!correo) return;
  const { error } = await db.auth.signInWithOtp({ email: correo });
  const msg = document.getElementById("mensaje-login");
  msg.textContent = error
    ? "Hubo un error, intenta de nuevo."
    : "Te enviamos un link a tu correo. Ábrelo para entrar.";
}

// ---------- REVISAR SESIÓN AL CARGAR ----------
async function revisarSesion() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    usuarioActual = session.user;
    document.getElementById("usuario-info").textContent = usuarioActual.email;
    document.getElementById("link-historial").style.display = "inline";
    document.getElementById("pantalla-login").style.display = "none";

    const yaVioBienvenida = localStorage.getItem("profeia_bienvenida_" + usuarioActual.id);
    if (!yaVioBienvenida) {
      document.getElementById("modal-bienvenida").style.display = "block";
    } else {
      document.getElementById("pantalla-app").style.display = "block";
    }
  }
}

function cerrarBienvenida() {
  localStorage.setItem("profeia_bienvenida_" + usuarioActual.id, "true");
  document.getElementById("modal-bienvenida").style.display = "none";
  document.getElementById("pantalla-app").style.display = "block";
}
revisarSesion();
db.auth.onAuthStateChange(() => revisarSesion());

// ---------- LÍMITE DIARIO POR DOCENTE ----------
// Durante el piloto con un solo usuario de prueba, lo dejamos alto para
// que pruebe sin restricciones. Cuando actives planes de pago con más
// usuarios, baja este número según lo que defina cada plan.
const LIMITE_DIARIO = 999;

async function generacionesDeHoy() {
  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const { count } = await db
    .from("clases_generadas")
    .select("*", { count: "exact", head: true })
    .eq("docente_id", usuarioActual.id)
    .gte("created_at", inicioDelDia.toISOString());

  return count || 0;
}

// ---------- BUSCAR SI YA EXISTE ALGO PARECIDO EN EL HISTORIAL ----------
async function buscarSimilarEnHistorial(asignatura, tema, tipo) {
  const { data } = await db
    .from("clases_generadas")
    .select("*")
    .eq("docente_id", usuarioActual.id)
    .eq("asignatura", asignatura)
    .eq("tipo", tipo)
    .ilike("tema", `%${tema}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  return data && data.length > 0 ? data[0] : null;
}

// ---------- GENERAR CONTENIDO ----------
async function generar(tipo) {
  const asignatura = document.getElementById("asignatura").value;
  const grado = document.getElementById("grado").value;
  const tema = document.getElementById("tema").value.trim();

  if (!tema) { alert("Escribe el tema de la clase primero."); return; }

  const usadas = await generacionesDeHoy();
  if (usadas >= LIMITE_DIARIO) {
    alert(`Ya usaste tus ${LIMITE_DIARIO} generaciones de hoy. Vuelve mañana o contáctanos para un plan con más capacidad.`);
    return;
  }

  // Retroalimentación: si ya generó algo parecido, se lo hacemos saber
  // antes de gastar una generación nueva
  const parecido = await buscarSimilarEnHistorial(asignatura, tema, tipo);
  if (parecido) {
    const fecha = new Date(parecido.created_at).toLocaleDateString();
    const continuar = confirm(
      `Ya generaste algo sobre "${parecido.tema}" en ${asignatura} el ${fecha}.\n\n` +
      `Presiona Aceptar para verlo en tu historial, o Cancelar para generar contenido nuevo de todas formas.`
    );
    if (continuar) {
      verHistorial();
      return;
    }
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("resultado").style.display = "none";
  document.getElementById("btn-descargar").style.display = "none";
  document.getElementById("btn-correo").style.display = "none";

  try {
    const respuesta = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, asignatura, grado, tema })
    });

    if (respuesta.status === 429) {
      document.getElementById("resultado").textContent = "Estamos con mucha demanda en este momento. Intenta de nuevo en unos segundos.";
      document.getElementById("resultado").style.display = "block";
      return;
    }

    const data = await respuesta.json();

    ultimoResultado = data.contenido;
    ultimoTipo = tipo;
    ultimoContexto = { asignatura, grado, tema };

    if (tipo === "infografia") {
      await renderizarInfografia(data.contenido, asignatura, tema, grado);
    } else {
      document.getElementById("resultado").textContent = data.contenido;
      document.getElementById("resultado").style.display = "block";
      document.getElementById("infografia-visual").style.display = "none";
    }
    document.getElementById("btn-descargar").style.display = "block";
  document.getElementById("btn-correo").style.display = "block";

    // Guardar en el historial PRIVADO del docente (aislado por RLS en Supabase)
    await db.from("clases_generadas").insert({
      docente_id: usuarioActual.id,
      asignatura, grado, tema, tipo,
      contenido: data.contenido
    });

  } catch (e) {
    document.getElementById("resultado").textContent = "Ocurrió un error generando el contenido. Intenta de nuevo.";
    document.getElementById("resultado").style.display = "block";
  } finally {
    document.getElementById("loading").style.display = "none";
  }
}

// ---------- RENDERIZAR INFOGRAFÍA COMO TARJETA VISUAL ----------
async function renderizarInfografia(contenidoJSON, asignatura, tema, grado) {
  const contenedor = document.getElementById("infografia-visual");
  document.getElementById("resultado").style.display = "none";

  try {
    const limpio = contenidoJSON.replace(/```json|```/g, "").trim();
    const info = JSON.parse(limpio);

    // Pide la ilustración en paralelo; si falla o tarda, la infografía
    // se muestra igual, solo sin imagen (degradación elegante)
    let imagenHTML = "";
    try {
      const respImg = await fetch("/api/generar-ilustracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asignatura, tema, grado })
      });
      if (respImg.ok) {
        const dataImg = await respImg.json();
        if (dataImg.imagen) {
          imagenHTML = `<img src="data:image/png;base64,${dataImg.imagen}" class="info-ilustracion" alt="${tema}">`;
        }
      }
    } catch (e) { /* sin ilustración, seguimos sin bloquear */ }

    contenedor.innerHTML = `
      ${imagenHTML}
      <div class="info-titulo">${info.titulo}</div>
      <div class="info-subtitulo">${info.subtitulo}</div>
      <div class="info-bloques">
        ${info.bloques.map(b => `
          <div class="info-bloque">
            <div class="info-bloque-encabezado">${b.encabezado}</div>
            <div class="info-bloque-contenido">${b.contenido}</div>
          </div>
        `).join("")}
      </div>
      ${info.dato_clave ? `<div class="info-dato-clave">💡 ${info.dato_clave}</div>` : ""}
    `;
    contenedor.style.display = "block";
  } catch (e) {
    document.getElementById("resultado").textContent = contenidoJSON;
    document.getElementById("resultado").style.display = "block";
    contenedor.style.display = "none";
  }
}

// ---------- DESCARGAR PDF ----------
function descargarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const titulos = {
    preparacion: "Preparación de Clase",
    infografia: "Infografía del Tema",
    cuestionario: "Cuestionario tipo Pruebas Saber"
  };

  if (ultimoTipo === "infografia") {
    try {
      const info = JSON.parse(ultimoResultado.replace(/```json|```/g, "").trim());
      doc.setFontSize(18);
      doc.text(info.titulo, 15, 20);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(info.subtitulo, 15, 28);
      let y = 42;
      doc.setTextColor(30);
      info.bloques.forEach(b => {
        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.text(b.encabezado, 15, y);
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        const texto = doc.splitTextToSize(b.contenido, 180);
        doc.text(texto, 15, y + 6);
        y += 6 + (texto.length * 5) + 6;
      });
      if (info.dato_clave) {
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("Dato clave: " + info.dato_clave, 15, y + 4);
      }
      doc.save(`infografia_profeia.pdf`);
      return;
    } catch (e) {
      // si el JSON no es válido, cae al formato de texto plano de abajo
    }
  }

  doc.setFontSize(16);
  doc.text(titulos[ultimoTipo] || "ProfeIA", 15, 20);
  doc.setFontSize(11);
  const texto = doc.splitTextToSize(ultimoResultado, 180);
  doc.text(texto, 15, 32);
  doc.save(`${ultimoTipo}_profeia.pdf`);
}

// ---------- ENVIAR POR CORREO ----------
// No le mandamos al servidor a qué correo enviar: le mandamos la credencial
// de la sesión y él resuelve el destinatario. Ver api/enviar-correo.js
async function enviarPorCorreo() {
  const boton = document.getElementById("btn-correo");
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Enviando...";

  try {
    const { data: { session } } = await db.auth.getSession();

    const respuesta = await fetch("/api/enviar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: session?.access_token,
        tipo: ultimoTipo,
        asignatura: ultimoContexto.asignatura,
        grado: ultimoContexto.grado,
        tema: ultimoContexto.tema,
        contenido: ultimoResultado
      })
    });

    const data = await respuesta.json();

    if (respuesta.ok) {
      boton.textContent = `✅ Enviado a ${data.destinatario}`;
    } else {
      boton.textContent = "❌ No se pudo enviar";
      alert(data.error || "No se pudo enviar el correo.");
    }
  } catch (e) {
    boton.textContent = "❌ No se pudo enviar";
    alert("No se pudo enviar el correo. Revisa tu conexión.");
  } finally {
    // Se deja leer el resultado un momento y luego vuelve a quedar disponible.
    setTimeout(() => { boton.textContent = original; boton.disabled = false; }, 4000);
  }
}

// ---------- HISTORIAL (solo trae registros del docente logueado) ----------
async function verHistorial() {
  const panel = document.getElementById("panel-historial");
  panel.style.display = "block";
  panel.scrollIntoView({ behavior: "smooth" });
  const lista = document.getElementById("lista-historial");
  lista.innerHTML = "Cargando...";

  // La política de seguridad (RLS) en Supabase garantiza que esta consulta
  // SOLO devuelve filas donde docente_id = usuarioActual.id, sin importar
  // qué parámetros se envíen. Ver supabase-schema.sql
  const { data, error } = await db
    .from("clases_generadas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    document.getElementById("resumen-historial").innerHTML = "";
    lista.innerHTML = "<p>Aún no has generado nada. ¡Empieza arriba!</p>";
    return;
  }

  // Resumen para tomar decisiones: qué asignatura y qué tipo usa más
  const porAsignatura = {};
  const porTipo = {};
  data.forEach(item => {
    porAsignatura[item.asignatura] = (porAsignatura[item.asignatura] || 0) + 1;
    porTipo[item.tipo] = (porTipo[item.tipo] || 0) + 1;
  });
  const asignaturaTop = Object.entries(porAsignatura).sort((a, b) => b[1] - a[1])[0];
  const tipoTop = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];
  const nombresTipo = { preparacion: "Preparación de clase", infografia: "Infografía", cuestionario: "Cuestionario" };

  document.getElementById("resumen-historial").innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
      <div style="background:#F3F6F5; border-radius:8px; padding:10px 14px; font-size:13px;">
        <strong>${data.length}</strong> generadas en total
      </div>
      <div style="background:#F3F6F5; border-radius:8px; padding:10px 14px; font-size:13px;">
        Asignatura más usada: <strong>${asignaturaTop[0]}</strong> (${asignaturaTop[1]})
      </div>
      <div style="background:#F3F6F5; border-radius:8px; padding:10px 14px; font-size:13px;">
        Más usas: <strong>${nombresTipo[tipoTop[0]]}</strong>
      </div>
    </div>
  `;

  const nombresTipoCorto = { preparacion: "📋", infografia: "🎨", cuestionario: "📝" };
  lista.innerHTML = data.map((item, i) => `
    <div class="historial-item" onclick="verDetalleHistorial(${i})">
      ${nombresTipoCorto[item.tipo] || ""} <strong>${item.tema}</strong> <span class="badge">${item.asignatura}</span>
      <div style="color:var(--color-texto-suave); font-size:12px;">${new Date(item.created_at).toLocaleDateString()}</div>
    </div>
  `).join("");

  window.historialCompleto = data;
}

function verDetalleHistorial(indice) {
  const item = window.historialCompleto[indice];
  ultimoResultado = item.contenido;
  ultimoTipo = item.tipo;
  ultimoContexto = { asignatura: item.asignatura, grado: item.grado, tema: item.tema };

  if (item.tipo === "infografia") {
    renderizarInfografia(item.contenido, item.asignatura, item.tema, item.grado);
  } else {
    document.getElementById("resultado").textContent = item.contenido;
    document.getElementById("resultado").style.display = "block";
    document.getElementById("infografia-visual").style.display = "none";
  }
  document.getElementById("btn-descargar").style.display = "block";
  document.getElementById("btn-correo").style.display = "block";
  document.getElementById("resultado").scrollIntoView({ behavior: "smooth" });
}
