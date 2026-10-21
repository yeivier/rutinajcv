#!/usr/bin/env node
/* Base44 · servicio de datos local para el preview.
   ---------------------------------------------------------------------------
   La app (PWA estática) guarda todo en una tabla clave-valor de Supabase
   (`forja_kv`) leída y escrita por REST con tres llamadas: GET con
   `key=eq.…&select=…`, POST con `Prefer: resolution=merge-duplicates` y
   DELETE con `key=eq.…`. Este servicio responde exactamente esas llamadas
   con la misma forma (mismo JSON de vuelta, mismos códigos) para que el
   preview funcione sin las credenciales del proyecto real.

   Es INFRAESTRUCTURA DE SANDBOX, no código de la app: no se toca ninguna
   parte de src/. Si el usuario carga FORJA_SB_URL/FORJA_SB_KEY (sus claves
   reales), el servidor de desarrollo deja de usar esto y la app escribe en
   su Supabase de verdad. El almacén vive en un volumen (DATA_DIR), así que
   sobrevive a recrear los contenedores.
*/
import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || "/data";
const TABLE = "forja_kv";
const FILE = join(DATA_DIR, `${TABLE}.json`);

mkdirSync(DATA_DIR, { recursive: true });
let store = {};
try {
  const raw = JSON.parse(readFileSync(FILE, "utf8"));
  if (raw && typeof raw === "object") store = raw;
} catch {
  store = {}; // primer arranque: base vacía — la app la siembra sola
}

// Escritura diferida y atómica: el archivo nunca queda a medio escribir.
let pending = null;
function persist() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try {
      const tmp = `${FILE}.tmp`;
      writeFileSync(tmp, JSON.stringify(store));
      renameSync(tmp, FILE);
    } catch (e) {
      console.error("[kv] no se pudo escribir el almacén:", e.message);
    }
  }, 120);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function empty(res, status) {
  res.writeHead(status);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* PostgREST: `key=eq.<valor>` o `key=like.<patrón>*` (el `*` es el comodín).
   La app usa las dos, además de `select=value`, `select=key` y
   `select=key,value`. */
function matchKeys(params) {
  const keys = Object.keys(store);
  const raw = params.get("key");
  if (!raw) return keys;
  const dot = raw.indexOf(".");
  if (dot < 0) return keys;
  const op = raw.slice(0, dot);
  const val = raw.slice(dot + 1);
  if (op === "eq") return keys.filter((k) => k === val);
  if (op === "like") {
    const source = val
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    const rx = new RegExp(`^${source}$`);
    return keys.filter((k) => rx.test(k));
  }
  return [];
}

function project(key, select) {
  const cols = (select || "key,value").split(",").map((c) => c.trim()).filter(Boolean);
  const out = {};
  if (cols.includes("key")) out.key = key;
  if (cols.includes("value")) out.value = store[key];
  return out;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    return json(res, 200, { ok: true, keys: Object.keys(store).length, file: FILE });
  }
  if (url.pathname !== `/rest/v1/${TABLE}`) {
    return json(res, 404, { message: `tabla inexistente: ${url.pathname}` });
  }

  try {
    const params = url.searchParams;

    if (req.method === "GET" || req.method === "HEAD") {
      let rows = matchKeys(params).map((k) => project(k, params.get("select")));
      const limit = Number(params.get("limit") || 0);
      if (limit > 0) rows = rows.slice(0, limit);
      return json(res, 200, rows);
    }

    if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
      const raw = await readBody(req);
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        return json(res, 400, { message: "JSON inválido" });
      }
      const rows = Array.isArray(body) ? body : [body];
      let wrote = 0;
      for (const row of rows) {
        if (!row || typeof row.key !== "string") continue;
        store[row.key] = row.value;
        wrote++;
      }
      if (wrote) persist();
      // Supabase contesta 201 con cuerpo vacío cuando se pide return=minimal.
      return empty(res, 201);
    }

    if (req.method === "DELETE") {
      const keys = matchKeys(params);
      for (const k of keys) delete store[k];
      if (keys.length) persist();
      return empty(res, 204);
    }

    return json(res, 405, { message: `${req.method} no soportado` });
  } catch (e) {
    console.error("[kv] error:", e);
    return json(res, 500, { message: String((e && e.message) || e) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[kv] ${TABLE} en 0.0.0.0:${PORT} · ${Object.keys(store).length} claves · ${FILE}`);
});
