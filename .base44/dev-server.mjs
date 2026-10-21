#!/usr/bin/env node
/* Base44 · servidor de desarrollo del preview de FORJA.
   ---------------------------------------------------------------------------
   El proyecto no trae servidor propio: en producción lo sirve Netlify
   (`publish = "."`, con `/*` → `/index.html`) y el bundle se genera con
   `scripts/build.sh`. Este archivo cumple ese mismo papel en el sandbox:

     1. sirve el repo tal cual (index.html, bundle.js, íconos…) en el 3000,
        con el fallback de SPA que declara netlify.toml;
     2. escribe `config.js` (lo ignora git) para apuntar a la base local de
        pruebas — o a la base real del usuario si hay FORJA_SB_URL/KEY;
     3. proxea `/rest/v1/*` al servicio local de datos: mismo origen, sin
        CORS, y sin clavar el host público en ningún archivo;
     4. al cambiar `src/`, recompila con `scripts/build.sh` y recarga el
        preview por SSE.

   No valida Host ni Origin (es un servidor estático propio), así que no
   necesita ningún allowlist del sandbox.
*/
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, watch, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = process.env.REPO_DIR || "/app";
const PORT = Number(process.env.PORT || 3000);
const API_URL = process.env.API_URL || "http://api:3001";
const BUILD_DIR = process.env.FORJA_BUILD_DIR || "/build";
const INJECT = "</body>";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

/* 1 · config.js: qué base usa la app.
   Con las claves del usuario, el archivo lo escribe el propio
   `scripts/gen-config.js` del repo (valida el formato y calcula el prefijo
   de localStorage). Sin claves, apunta a la base local de pruebas con una
   URL RELATIVA: el navegador la resuelve contra el mismo origen del
   preview, así que no hay host que clavar ni CORS que abrir. */
function writeConfig() {
  const sbUrl = (process.env.FORJA_SB_URL || "").trim();
  const sbKey = (process.env.FORJA_SB_KEY || "").trim();
  if (sbUrl && sbKey) {
    const r = spawnSync("node", [join(ROOT, "scripts/gen-config.js")], { cwd: ROOT, stdio: "inherit", env: process.env });
    if (r.status === 0) {
      console.log("[dev] config.js → base real del usuario (FORJA_SB_URL/FORJA_SB_KEY)");
      return;
    }
    console.error(`[dev] gen-config.js falló (status ${r.status}); sigo con la base local para que el preview funcione`);
  } else {
    console.log("[dev] sin FORJA_SB_URL/FORJA_SB_KEY → config.js apunta a la base local de pruebas");
  }
  writeFileSync(
    join(ROOT, "config.js"),
    "/* Generado por .base44/dev-server.mjs. No editar a mano. */\n" +
      `window.FORJA_CONFIG = ${JSON.stringify({ sbUrl: "/rest/v1/forja_kv", sbKey: "local-dev-anon", lsPrefix: "fjkv:local:" }, null, 2)};\n`
  );
}

/* 2 · recarga en vivo: los clientes se suscriben por SSE y reciben un
   "reload" cuando termina una recompilación. El script inyectado borra
   además la caché del service worker antes de recargar: `bundle.js` se
   pide siempre con el mismo `?v=` en desarrollo, y el service worker lo
   sirve caché-primero, así que sin eso seguiría apareciendo la versión
   vieja. (En producción el `?v=` cambia en cada entrega y no hace falta.) */
const clientes = new Set();
let ultimoBuild = { ok: null, at: null, salida: "" };

function broadcast() {
  for (const res of clientes) res.write("data: reload\n\n");
}

const SCRIPT_DEV = `<script>/* Base44 dev: recarga al recompilar */ (function () {
  try {
    var es = new EventSource("/__base44/reload");
    es.onmessage = function () {
      (async function () {
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            var rs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(rs.map(function (r) { return r.unregister(); }));
          }
          if (window.caches && caches.keys) {
            var ks = await caches.keys();
            await Promise.all(ks.map(function (k) { return caches.delete(k); }));
          }
        } catch (e) {}
        location.reload();
      })();
    };
  } catch (e) {}
})();</script>`;

/* 3 · recompilación: la app vive entera en src/App.jsx; el build es el
   script del propio repo, sin duplicar configuración de esbuild. */
let buildEnCurso = false;
let buildPendiente = false;
function runBuild() {
  if (buildEnCurso) {
    buildPendiente = true;
    return;
  }
  buildEnCurso = true;
  console.log("[dev] cambio en src/ → recompilando con scripts/build.sh");
  const p = spawn("sh", [join(ROOT, "scripts/build.sh")], {
    cwd: ROOT,
    env: { ...process.env, FORJA_BUILD_DIR: BUILD_DIR },
  });
  let salida = "";
  const sumar = (d) => {
    salida += d.toString();
  };
  p.stdout.on("data", sumar);
  p.stderr.on("data", sumar);
  p.on("close", (code) => {
    buildEnCurso = false;
    ultimoBuild = { ok: code === 0, at: new Date().toISOString(), salida: salida.slice(-4000) };
    if (code === 0) {
      console.log("[dev] build OK → recargando el preview");
      broadcast();
    } else {
      // Sin recarga: se sigue viendo la última versión buena en pantalla.
      console.error("[dev] build FALLÓ (código " + code + "); no se recarga\n" + salida);
    }
    if (buildPendiente) {
      buildPendiente = false;
      runBuild();
    }
  });
}

let timer = null;
function alCambiarSrc() {
  clearTimeout(timer);
  timer = setTimeout(runBuild, 400);
}

/* 4 · proxy de datos: /rest/v1/* → servicio local (mismo origen). */
async function proxy(req, res) {
  const partes = [];
  for await (const c of req) partes.push(c);
  const body = Buffer.concat(partes);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  try {
    const r = await fetch(API_URL + req.url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const out = {};
    for (const [k, v] of r.headers) out[k] = v;
    res.writeHead(r.status, out);
    res.end(buf);
  } catch (e) {
    console.error("[dev] proxy a la base local falló:", e.message);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ message: `base local inaccesible: ${e.message}` }));
  }
}

/* 5 · archivos estáticos + SSE + estado. */
function servirArchivo(ruta, res) {
  const tipo = TIPOS[extname(ruta).toLowerCase()] || "application/octet-stream";
  const esHtml = ruta.endsWith(".html");
  // Nada se cachea en desarrollo: cada recarga ve el código actual.
  const cabeceras = { "Content-Type": tipo, "Cache-Control": "no-store" };
  if (!esHtml) {
    res.writeHead(200, cabeceras);
    createReadStream(ruta).pipe(res);
    return;
  }
  let html = readFileSync(ruta, "utf8");
  if (html.includes(INJECT)) html = html.replace(INJECT, `${SCRIPT_DEV}\n${INJECT}`);
  const body = Buffer.from(html, "utf8");
  res.writeHead(200, { ...cabeceras, "Content-Length": body.length });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const rutaUrl = decodeURIComponent(url.pathname);

  if (rutaUrl.startsWith("/rest/v1/")) return proxy(req, res);

  if (rutaUrl === "/__base44/reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("retry: 1000\n\n");
    clientes.add(res);
    const latido = setInterval(() => res.write(": latido\n\n"), 15000);
    req.on("close", () => {
      clearInterval(latido);
      clientes.delete(res);
    });
    return;
  }

  if (rutaUrl === "/__base44/status") {
    const body = JSON.stringify({ ...ultimoBuild, clientes: clientes.size, config: !!(process.env.FORJA_SB_URL && process.env.FORJA_SB_KEY) }, null, 2);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
    return;
  }

  // Fuera del repo no se sirve nada (mismo espíritu que el `publish = "."`).
  const rel = normalize(rutaUrl).replace(/^(\.\.[/\\])+/, "").replace(/^\/+/, "");
  let ruta = join(ROOT, rel);
  if (!ruta.startsWith(ROOT)) ruta = join(ROOT, "index.html");
  if (!existsSync(ruta) || statSync(ruta).isDirectory()) {
    // Fallback de SPA: como el redirect /* → /index.html de netlify.toml.
    ruta = join(ROOT, "index.html");
  }
  try {
    servirArchivo(ruta, res);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`error sirviendo ${rel}: ${e.message}`);
  }
});

writeConfig();
try {
  watch(join(ROOT, "src"), { recursive: true }, alCambiarSrc);
  watch(join(ROOT, "index.html"), () => broadcast());
} catch (e) {
  console.error("[dev] no se pudo vigilar src/:", e.message);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev] FORJA en http://0.0.0.0:${PORT} · repo ${ROOT} · datos ${API_URL}`);
});
