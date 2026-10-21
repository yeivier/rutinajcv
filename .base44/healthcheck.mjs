/* Healthcheck del sandbox: comprueba los DOS componentes del contenedor de
   desarrollo y dice cuál falló — el servidor HTTP (sirve index.html) y el
   compilador (esbuild terminó bien y el bundle se entrega). */

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;

try {
  const html = await (await fetch(BASE + "/")).text();
  if (!html.includes('id="root"')) {
    console.log("FALLA: / no es el index.html de la app");
    process.exit(1);
  }

  const estado = await (await fetch(BASE + "/__base44_status")).json();
  if (!estado.ok) {
    console.log("FALLA: la compilación del bundle no está bien:\n" + estado.error);
    process.exit(1);
  }

  const bundle = await fetch(BASE + "/bundle.js");
  const cuerpo = await bundle.text();
  if (!bundle.ok || cuerpo.length < 10000) {
    console.log(`FALLA: /bundle.js devolvió ${bundle.status} con ${cuerpo.length} bytes`);
    process.exit(1);
  }

  console.log(`OK: app servida, bundle compilado (${estado.ms} ms, ${cuerpo.length} bytes)`);
} catch (e) {
  console.log("FALLA: el servidor de desarrollo no responde — " + e.message);
  process.exit(1);
}
