const SUPABASE_URL = "https://tagpacbeosktddomudqu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qJJiBuGFJ-LGEOx5JkVIyg_OWOSA8qb";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let ultimoResultado = "";
let ultimoTipo = "";

async function enviarLinkMagico() {
  const correo = document.getElementById("input-correo").value.trim();
  if (!correo) return;
  const { error } = await supabase.auth.signInWithOtp({ email: correo });
  const msg = document.getElementById("mensaje-login");
  msg.textContent = error
    ? "Hubo un error, intenta de nuevo."
    : "Te enviamos un link a tu correo. Ábrelo para entrar.";
}

async function revisarSesion() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    usuarioActual = session.user;
    document.getElementById("usuario-info").textContent = usuarioActual.email;
    document.getElementById("link-historial").style.display = "inline";
    document.getElementById("pantalla-login").style.display = "none";

    const
