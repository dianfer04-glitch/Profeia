# ProfeIA — Guía para ponerla en línea

Esta guía asume que no sabes programar. Son 4 pasos, todos gratis para empezar.

## Paso 1: Crea tu base de datos privada (Supabase)

1. Ve a https://supabase.com y crea una cuenta gratis.
2. Crea un "nuevo proyecto" (ponle el nombre "profeia").
3. Cuando esté listo, ve a la sección **SQL Editor** y pega todo el contenido
   del archivo `supabase-schema.sql` de esta carpeta. Dale "Run".
   Esto crea la tabla donde se guarda el historial de cada docente, ya con
   la privacidad activada.
4. Ve a **Project Settings > API**. Ahí vas a ver dos datos que necesitas:
   - "Project URL"
   - "anon public key"
5. Abre el archivo `public/app.js` y reemplaza las dos líneas de arriba
   (`TU_SUPABASE_URL_AQUI` y `TU_SUPABASE_ANON_KEY_AQUI`) con esos valores.
6. Activa el login por correo: en Supabase ve a **Authentication > Providers**
   y confirma que "Email" esté activo (viene activo por defecto).

## Paso 2: Consigue tu clave de la API de Claude

1. Ve a https://console.anthropic.com y crea una cuenta (es una cuenta
   distinta a tu Claude.ai / Claude Pro, es para desarrolladores).
2. Ve a **API Keys** y crea una nueva. Cópiala, la vas a necesitar en el
   Paso 3. Guárdala en un lugar seguro, no la compartas con nadie.

## Paso 2.5 (opcional): Ilustraciones para la infografía

Esto es OPCIONAL — si no lo configuras, la infografía se ve igual de bien
pero sin la imagen ilustrada arriba, solo con los bloques de texto y color.

1. Ve a https://platform.openai.com y crea una cuenta (otra cuenta más,
   independiente de las anteriores).
2. Ve a **API Keys**, crea una nueva y cópiala.
3. Este servicio cobra por imagen generada (revisa el precio actual en su
   página antes de activarlo, para que lo tengas en tu cálculo de costos
   junto con Claude y Templated.io).
4. La agregas como variable de entorno en Vercel en el Paso 3, junto a la
   de Claude, con el nombre `OPENAI_API_KEY`.

## Paso 3: Sube el proyecto a Vercel (así queda en línea)

1. Ve a https://vercel.com y crea una cuenta gratis (puedes usar tu cuenta
   de GitHub para entrar más rápido).
2. Sube esta carpeta completa a un repositorio nuevo en GitHub
   (Vercel te guía en esto con arrastrar y soltar si no conoces GitHub).
3. En Vercel, dale "Import Project" y selecciona ese repositorio.
4. Antes de darle "Deploy", ve a **Environment Variables** y agrega:
   - Nombre: `ANTHROPIC_API_KEY`
   - Valor: la clave que copiaste en el Paso 2
   - (Opcional) Nombre: `OPENAI_API_KEY`
   - (Opcional) Valor: la clave que copiaste en el Paso 2.5, si activaste
     las ilustraciones
5. Dale "Deploy". En 1-2 minutos tendrás una dirección web real
   (algo como `profeia.vercel.app`) que puedes compartir con los docentes.

## Paso 4: Pruébala

1. Abre la dirección que te dio Vercel.
2. Ingresa tu correo, revisa tu bandeja de entrada, haz clic en el link.
3. Genera una clase de prueba y verifica que el PDF se descargue bien.

---

## ¿Qué pasa si mañana quieres más funciones?

- **Cambiar el nombre o los colores:** todo el diseño está en
  `public/style.css`, en la parte de arriba (`:root`). Cambia los colores
  ahí y se actualiza en toda la app.
- **Agregar un cuarto botón:** copia el patrón del archivo
  `api/generate.js` (agrega un nuevo bloque en `PROMPTS`) y agrega el
  botón correspondiente en `public/index.html`.
- **Cobrar suscripciones:** el siguiente paso natural es conectar Stripe
  (otra herramienta gratis para empezar) para que solo los docentes que
  pagan puedan generar contenido ilimitado. Cuando llegues a ese punto,
  pídele a Claude Code que te ayude a integrarlo — el código ya está
  organizado para que sea un cambio simple.

## Resumen de por qué esta base es sólida

- **Privacidad real, no prometida:** la base de datos está configurada
  para que sea *técnicamente imposible* que un docente vea el historial
  de otro, incluso si alguien comete un error de programación después.
- **Tu cuenta de negocio protegida:** hay un límite diario por docente
  (15 generaciones por defecto, editable en `public/app.js` buscando
  `LIMITE_DIARIO`). Así ningún docente individual puede agotar la
  capacidad compartida y afectar a los demás. Además, si tu cuenta llega
  a su tope de capacidad en un momento de mucha demanda, la app le
  muestra al docente un mensaje amable en vez de un error técnico.
- **Escala sin que tengas que hacer nada:** tanto Vercel como Supabase
  crecen automáticamente si tienes 10 o 10,000 docentes usando la
  herramienta al mismo tiempo.
- **Cero costo para empezar:** los tres servicios (Vercel, Supabase,
  y la API de Claude solo se cobra por uso) tienen planes gratuitos
  generosos — vas a poder validar la idea con tus primeros docentes
  sin gastar nada.
- **Tu cuenta de API es independiente de tu Claude Pro personal:** la
  cuenta que usa esta herramienta (console.anthropic.com) es distinta
  a tu suscripción de Claude.ai. Nunca comparten límites ni facturación.
