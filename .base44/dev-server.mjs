/* Servidor de desarrollo del sandbox de Base44 — NO forma parte del sitio.

   FORJA es un sitio estático: el repo publica index.html + bundle.js ya
   compilados (netlify.toml hace `publish = "."`), y el bundle se genera con
   scripts/build.sh (esbuild sobre src/App.jsx). Acá no hay servidor de
   desarrollo propio, así que este archivo hace los dos trabajos que faltan
   para poder editar y ver el resultado sin reconstruir a mano:

     1. Recompila src/App.jsx con esbuild (las mismas opciones de
        scripts/build.sh) cuando cambia, y sirve el resultado desde un
        directorio FUERA del repo — así un rebuild del sandbox nunca ensucia
        el árbol de trabajo con artefactos generados.
     2. Sirve el repo por HTTP en el puerto 3000 (index.html, config.js, sw.js,
        manifest, íconos, catálogo), con la misma caída a index.html que hace
        netlify.toml para las rutas sin archivo.

   Dos cosas se comportan distinto SOLO cuando BASE44_PREVIEW_MODE === "1",
   porque pelean con un servidor de desarrollo (ver AGENTS.md):
     - sw.js se sirve vacío: el service worker real guarda /bundle.js
       "cache-first" (es inmutable por ?v=), así que después de la primera
       carga serviría el bundle viejo y no se vería ningún cambio.
     - se inyecta un script de recarga automática al final de index.html
       (EventSource), para que el navegador se refresque cuando el bundle
       termina de recompilarse.

   Sin BASE44_PREVIEW_MODE (o con otro valor) sirve el sw.js real y el HTML
   tal cual está en el repo. */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";

const REPO = process.env.FORJA_REPO || "/repo";
const OUT = process.env.FORJA_DEV_OUT || "/tmp/forja-dev-out";
const PORT = Number(process.env.PORT || 3000);
const PREVIEW = process.env.BASE44_PREVIEW_MODE === "1";
const FUENTES = ["src/App.jsx", "src/main.jsx"];

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
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

let estado = { ok: false, error: "compilando…", ms: 0, at: 0 };

// ---------- recarga automática (solo en preview) ----------
const clientes = new Set();
const avisar = () => {
  for (const res of clientes) {
    try { res.write("data: reload\n\n"); } catch { clientes.delete(res); }
  }
};

// ---------- compilación ----------
async function compilar() {
  const t0 = Date.now();
  try {
    await fsp.rm(OUT, { recursive: true, force: true });
    await fsp.mkdir(OUT, { recursive: true });
    await esbuild.build({
      entryPoints: [path.join(REPO, "src/main.jsx")],
      bundle: true,
      minify: true,
      format: "esm",
      splitting: true,
      jsx: "automatic",
      loader: { ".jsx": "jsx" },
      outdir: OUT,
      entryNames: "bundle",
      chunkNames: "chunk-[hash]",
      legalComments: "none",
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    estado = { ok: true, error: null, ms: Date.now() - t0, at: Date.now() };
    console.log(`[dev] bundle compilado en ${estado.ms} ms`);
  } catch (e) {
    const detalle = (e.errors || []).map((x) => {
      const u = x.location ? `${x.location.file}:${x.location.line}:${x.location.column}: ` : "";
      return u + x.text;
    }).join("\n");
    estado = { ok: false, error: detalle || String(e.message || e), ms: Date.now() - t0, at: Date.now() };
    console.error("[dev] LA COMPILACIÓN FALLÓ:\n" + estado.error);
  }
  avisar();
}

// El bind mount a veces no dispara inotify: se sondea mtime/tamaño.
let huellas = {};
const huella = (rel) => {
  try {
    const s = fs.statSync(path.join(REPO, rel));
    return `${s.mtimeMs}:${s.size}`;
  } catch { return "falta"; }
};
const leerHuellas = () => Object.fromEntries(FUENTES.map((f) => [f, huella(f)]));
let compilando = false;
async function ciclo() {
  const ahora = leerHuellas();
  if (JSON.stringify(ahora) === JSON.stringify(huellas)) return;
  huellas = ahora;
  if (compilando) return;
  compilando = true;
  try { await compilar(); } finally { compilando = false; huellas = leerHuellas(); }
}

// ---------- archivos ----------
function resolver(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const abs = path.resolve(REPO, rel);
  if (!abs.startsWith(REPO + path.sep) && abs !== REPO) return null;
  const candidatos = [];
  if (rel === "" ) candidatos.push(path.join(REPO, "index.html"));
  candidatos.push(abs, path.join(abs, "index.html"));
  for (const c of candidatos) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* sigue */ }
  }
  return null;
}

const inyectar = (html) =>
  html.replace("</body>",
    `<script>try{var s=new EventSource("/__base44_reload");s.onmessage=function(){location.reload()};}catch(e){}</script>\n</body>`);

function responder(res, cuerpo, tipo) {
  res.writeHead(200, {
    "Content-Type": tipo,
    "Cache-Control": "no-store",
    "Service-Worker-Allowed": "/",
  });
  res.end(cuerpo);
}

// config.js está en .gitignore: lo genera el propio repo en cada despliegue.
function generarConfig() {
  try {
    execFileSync(process.execPath, [path.join(REPO, "scripts/gen-config.js")], { cwd: REPO, stdio: "inherit" });
  } catch (e) {
    console.error("[dev] gen-config.js falló (" + e.message + ") — /config.js se sirve vacío");
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  if (p === "/__base44_reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    clientes.add(res);
    req.on("close", () => clientes.delete(res));
    return;
  }

  if (p === "/__base44_status") {
    responder(res, JSON.stringify(estado), "application/json; charset=utf-8");
    return;
  }

  // El bundle servido es SIEMPRE el recién compilado, nunca el del repo.
  if (p === "/bundle.js" || /^\/chunk-[^/]+\.js$/.test(p)) {
    const archivo = path.join(OUT, path.basename(p));
    try {
      responder(res, await fsp.readFile(archivo), "text/javascript; charset=utf-8");
    } catch {
      res.writeHead(estado.ok ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(estado.ok ? "chunk no encontrado" : "el bundle no compila:\n" + estado.error);
    }
    return;
  }

  if (p === "/sw.js" && PREVIEW) {
    responder(res, "/* Vacío a propósito en el sandbox: ver .base44/dev-server.mjs */\n", "text/javascript; charset=utf-8");
    return;
  }

  if (p === "/config.js" && !fs.existsSync(path.join(REPO, "config.js"))) {
    responder(res, "window.FORJA_CONFIG = null;\n", "text/javascript; charset=utf-8");
    return;
  }

  const archivo = resolver(p);
  if (!archivo) {
    // Igual que netlify.toml: cualquier ruta sin archivo cae en index.html.
    try {
      responder(res, inyectar(await fsp.readFile(path.join(REPO, "index.html"), "utf8")), TIPOS[".html"]);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("no encontrado: " + p);
    }
    return;
  }

  const ext = path.extname(archivo).toLowerCase();
  let cuerpo = await fsp.readFile(archivo);
  if (ext === ".html" && PREVIEW) cuerpo = inyectar(cuerpo.toString("utf8"));
  responder(res, cuerpo, TIPOS[ext] || "application/octet-stream");
});

generarConfig();
await compilar();
huellas = leerHuellas();
setInterval(ciclo, 700);
servidor.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev] FORJA en http://0.0.0.0:${PORT} (repo=${REPO}, bundle=${OUT}, preview=${PREVIEW})`);
});
