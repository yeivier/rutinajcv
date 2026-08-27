// Genera config.js en el despliegue, a partir de variables de entorno.
//
// Existe para poder tener DOS sitios con el MISMO repo apuntando a bases
// distintas: el de siempre, y uno aparte para alguien que tiene que
// arrancar en blanco sin ver ni un dato del otro. Sin esto la URL y la
// clave de Supabase van fijas dentro del bundle, así que cualquier copia
// del sitio lee y escribe exactamente las mismas filas.
//
// Netlify lo corre como build command. Si no hay variables definidas no
// escribe nada y la app usa los valores por defecto que trae el bundle —
// así el sitio original sigue funcionando igual sin tocar nada.
//
// Variables (se configuran en Netlify → Site settings → Environment):
//   FORJA_SB_URL     https://XXXX.supabase.co/rest/v1/forja_kv
//   FORJA_SB_KEY     la clave anon del proyecto
//   FORJA_LS_PREFIX  opcional; prefijo de localStorage (por defecto uno
//                    derivado de la URL, para que dos sitios abiertos en
//                    el mismo teléfono no se pisen el respaldo local)

const fs = require("fs");
const path = require("path");

const url = (process.env.FORJA_SB_URL || "").trim();
const key = (process.env.FORJA_SB_KEY || "").trim();
const destino = path.join(__dirname, "..", "config.js");

function escribir(sbUrl, sbKey, lsPrefix) {
  fs.writeFileSync(destino,
    `/* Generado por scripts/gen-config.js en cada despliegue. No editar a mano. */\n` +
    `window.FORJA_CONFIG = ${JSON.stringify({ sbUrl, sbKey, lsPrefix }, null, 2)};\n`);
}

// La base de siempre, para cuando el despliegue no define variables.
const POR_DEFECTO = {
  url: "https://vzenlmcbftopyjzcltxa.supabase.co/rest/v1/forja_kv",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5sbWNiZnRvcHlqemNsdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjQ5NDksImV4cCI6MjA5ODI0MDk0OX0.CWCrsDVuFEsq3QiAYHRYmsRrD6AI2M7o6ofRUQJXUyY",
  lsPrefix: "fjkv:",
};

// El archivo se escribe SIEMPRE, aunque no haya variables. Si faltara,
// netlify.toml manda cualquier ruta sin archivo a index.html con un 200,
// así que <script src="/config.js"> recibiría HTML y reventaría con un
// error de sintaxis en la consola.
if (!url && !key) {
  escribir(POR_DEFECTO.url, POR_DEFECTO.key, POR_DEFECTO.lsPrefix);
  console.log("[forja] sin FORJA_SB_URL/FORJA_SB_KEY — config.js apunta a la base de siempre");
  process.exit(0);
}

// Media configuración es peor que ninguna: apuntaría a una base con la
// clave de la otra y fallaría en silencio, cayendo al respaldo local.
if (!url || !key) {
  console.error("[forja] ERROR: hay que definir FORJA_SB_URL y FORJA_SB_KEY, no solo una.");
  process.exit(1);
}
if (!/^https:\/\/[^/]+\/rest\/v1\/[A-Za-z0-9_]+$/.test(url)) {
  console.error(`[forja] ERROR: FORJA_SB_URL no tiene la forma esperada.\n` +
    `  esperado: https://XXXX.supabase.co/rest/v1/forja_kv\n  recibido: ${url}`);
  process.exit(1);
}

// Prefijo propio por base, para que dos sitios en el mismo navegador no
// compartan el respaldo de localStorage.
const host = url.split("/")[2].split(".")[0];
const lsPrefix = (process.env.FORJA_LS_PREFIX || `fjkv-${host.slice(0, 8)}:`).trim();

escribir(url, key, lsPrefix);
console.log(`[forja] config.js escrito → base ${host}, prefijo local "${lsPrefix}"`);
