#!/usr/bin/env node
// Banco de evaluación de la IA de FORJA: manda cada pregunta de docs/ia-evals.json a la función forja-ai
// y comprueba que la respuesta incluya (cada grupo: al menos una palabra) y no incluya lo prohibido.
// Uso:  FORJA_SB_KEY=<anon key>  node scripts/eval-ai.js [categoria]
// Útil tras cambiar de modelo, de prompt o de base de conocimiento: compara el % de aciertos antes/después.
const fs = require("fs");
const path = require("path");
const URL_FN = process.env.FORJA_AI_URL || "https://vzenlmcbftopyjzcltxa.supabase.co/functions/v1/forja-ai";
const KEY = process.env.FORJA_SB_KEY;
if (!KEY) { console.error("Falta FORJA_SB_KEY (la anon key pública de Supabase)."); process.exit(2); }
const SYSTEM = "Eres el asistente de IA de FORJA, un coach de culturismo basado en evidencia. Responde en español, directo y breve (máx. 6 líneas). No modificas el plan: lo decide el coach. No recetas ni dosificas sustancias; derivas a un médico. No inventes estudios ni datos; si no sabes, dilo.";
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const evals = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "ia-evals.json"), "utf8"))
  .filter((e) => !process.argv[2] || e.cat === process.argv[2]);
(async () => {
  let ok = 0; const fallos = [];
  for (const e of evals) {
    try {
      const r = await fetch(URL_FN, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: e.q }], max_tokens: 700, tier: "default" }) });
      const j = await r.json();
      const txt = norm(j?.choices?.[0]?.message?.content || "");
      if (!txt) throw new Error(j.error || `HTTP ${r.status}`);
      const faltan = (e.incluye || []).filter((g) => !g.some((w) => txt.includes(norm(w))));
      const prohibidas = (e.excluye || []).flat().filter((w) => txt.includes(norm(w)));
      if (!faltan.length && !prohibidas.length) { ok++; process.stdout.write("."); }
      else { fallos.push({ cat: e.cat, q: e.q, faltan, prohibidas, via: j.provider }); process.stdout.write("x"); }
    } catch (err) { fallos.push({ cat: e.cat, q: e.q, error: String(err.message || err) }); process.stdout.write("!"); }
  }
  console.log(`\n${ok}/${evals.length} correctas (${Math.round((ok / evals.length) * 100)} %)`);
  fallos.forEach((f) => console.log("-", f.cat, "|", f.q, "|", JSON.stringify({ faltan: f.faltan, prohibidas: f.prohibidas, error: f.error, via: f.via })));
  process.exit(fallos.length ? 1 : 0);
})();
