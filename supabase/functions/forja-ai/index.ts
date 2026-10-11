// forja-ai v5: gateway de IA de FORJA.
//  1) Si hay clave de Anthropic (secreto ANTHROPIC_API_KEY o fila 'anthropic' en forja_ai_secrets)
//     usa Claude, con nivel de modelo según body.tier: fast | default | deep.
//  2) Si no hay clave o Claude falla, cae a la cadena gratuita (Gemini → Groq → OpenRouter → Pollinations).
//  3) RAG: busca en forja_knowledge (criterios curados por el coach) y los inyecta en el system.
// La app habla formato OpenAI (messages con system/user/assistant, partes text/image_url).
// No se guarda el contenido de las conversaciones.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAILY_PER_IP = 80;
const DAILY_PER_IP_CLAUDE = 300; // con Claude pago el cupo es mayor, pero acotado
const MODELS: Record<string, string> = {
  fast: Deno.env.get("FORJA_MODEL_FAST") || "claude-haiku-5-5",
  default: Deno.env.get("FORJA_MODEL_DEFAULT") || "claude-sonnet-5-5",
  deep: Deno.env.get("FORJA_MODEL_DEEP") || "claude-opus-5-5",
};

type Prov = { id: string; url: string; model: string; key?: string; vision: boolean };
const DEFAULTS: Record<string, { url: string; model: string; vision: boolean }> = {
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-flash-latest", vision: true },
  gemini_lite: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-flash-lite-latest", vision: true },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", vision: false },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-chat-v3-0324:free", vision: false },
};
const hasImages = (msgs: any[]) => msgs.some((m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url"));

/* ---------- RAG ---------- */
// forja_kb_search usa websearch_to_tsquery (AND por defecto): se arma una consulta con "or" entre
// las palabras significativas para que una pregunta larga igual encuentre entradas relevantes.
const STOP = new Set(["para","como","cual","cuales","cuanto","cuanta","porque","pero","esta","este","estos","estas","tengo","tiene","quiero","puedo","hacer","hoy","sobre","entre","desde","hasta","donde","cuando","algo","todo","toda","mucho","poco","unas","unos","segun","debo","debería","deberia","puede","pueden","necesito"]);
const toOrQuery = (q: string) => {
  const words = [...new Set(q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 14);
  return words.join(" or ");
};
async function retrieveKnowledge(query: string, n = 6): Promise<{ ids: string[]; text: string }> {
  const q = toOrQuery((query || "").slice(0, 800));
  if (!q) return { ids: [], text: "" };
  try {
    const { data } = await sb.rpc("forja_kb_search", { q, n });
    const rows = (data || []) as any[];
    if (!rows.length) return { ids: [], text: "" };
    return {
      ids: rows.map((r) => r.title),
      text: rows.map((r) => `- ${r.title}${r.source && r.source !== "consenso general" ? ` (${r.source})` : ""}: ${r.content}`).join("\n"),
    };
  } catch { return { ids: [], text: "" }; }
}
const lastUserText = (messages: any[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) return m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ");
  }
  return "";
};

const KB_RULES = `\n\nBASE DE CONOCIMIENTO FORJA (criterios curados por el coach; tienen PRIORIDAD sobre tu memoria general cuando aplican; si los usas, menciona brevemente su título):\n`;

/* ---------- Claude ---------- */
function toAnthropic(messages: any[]) {
  const sys = messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n\n");
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    let content: any;
    if (typeof m.content === "string") content = m.content;
    else {
      content = [];
      for (const p of m.content || []) {
        if (p.type === "text") content.push({ type: "text", text: p.text });
        else if (p.type === "image_url" && p.image_url?.url?.startsWith("data:")) {
          const u = p.image_url.url; const semi = u.indexOf(";"); const comma = u.indexOf(",");
          content.push({ type: "image", source: { type: "base64", media_type: u.slice(5, semi), data: u.slice(comma + 1) } });
        }
      }
      if (!content.length) continue;
    }
    // Anthropic exige alternar roles: se fusionan consecutivos del mismo rol.
    const prev = out[out.length - 1];
    if (prev && prev.role === role && typeof prev.content === "string" && typeof content === "string") prev.content += "\n\n" + content;
    else out.push({ role, content });
  }
  if (out.length && out[0].role !== "user") out.unshift({ role: "user", content: "(inicio)" });
  return { system: sys, messages: out };
}

async function callClaude(key: string, model: string, messages: any[], maxTokens: number, extraSystem: string) {
  const { system, messages: msgs } = toAnthropic(messages);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 140000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, system: system + extraSystem, messages: msgs }),
    });
    if (!r.ok) return { ok: false as const, status: r.status };
    const j = await r.json();
    const text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n\n");
    if (!text) return { ok: false as const, status: 204 };
    return { ok: true as const, text, finish: j.stop_reason === "max_tokens" ? "length" : "stop" };
  } catch { return { ok: false as const, status: 599 }; } finally { clearTimeout(t); }
}

/* ---------- cadena gratuita ---------- */
async function callProv(p: Prov, messages: any[], maxTokens: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 110000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (p.key) headers.Authorization = `Bearer ${p.key}`;
    const r = await fetch(p.url, { method: "POST", headers, signal: ctrl.signal,
      body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature: 0.3 }) });
    if (!r.ok) return { ok: false as const, status: r.status };
    const j = await r.json();
    const c = j?.choices?.[0];
    const text = c?.message?.content || "";
    if (!text) return { ok: false as const, status: 204 };
    return { ok: true as const, text, finish: c?.finish_reason || "stop" };
  } catch { return { ok: false as const, status: 599 }; } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  if (JSON.stringify(body).length > 8_000_000) return json({ error: "Mensaje demasiado grande." }, 413);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json({ error: "sin mensajes" }, 400);
  const maxTokens = Math.min(+body.max_tokens || 2000, 8000);
  const tier = ["fast", "default", "deep"].includes(body.tier) ? body.tier : "default";

  const { data: rows } = await sb.from("forja_ai_secrets").select("provider, api_key, model");
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY") || (rows || []).find((r: any) => r.provider === "anthropic")?.api_key || "";

  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  const { data: okQuota } = await sb.rpc("forja_ai_bump", { p_ident: ip, p_max: claudeKey ? DAILY_PER_IP_CLAUDE : DAILY_PER_IP });
  if (okQuota === false) return json({ error: "Llegaste al límite diario de consultas. Vuelve mañana." }, 429);

  // RAG (se puede apagar con rag:false; la consulta puede venir explícita en ragQuery)
  let kb = { ids: [] as string[], text: "" };
  if (body.rag !== false) kb = await retrieveKnowledge(body.ragQuery || lastUserText(messages));
  const extraSystem = kb.text ? KB_RULES + kb.text : "";

  const tried: string[] = [];
  const imgs = hasImages(messages);

  if (claudeKey) {
    const model = MODELS[tier];
    let r = await callClaude(claudeKey, model, messages, maxTokens, extraSystem);
    if (!r.ok && (r.status === 529 || r.status === 503 || r.status === 500)) { await new Promise((res) => setTimeout(res, 1500)); r = await callClaude(claudeKey, model, messages, maxTokens, extraSystem); }
    tried.push(`claude:${tier}:${r.ok ? "ok" : r.status}`);
    if (r.ok) return json({ choices: [{ finish_reason: r.finish, message: { role: "assistant", content: r.text } }], provider: "claude", model, sources: kb.ids, tried });
  }

  // Respaldo gratuito: el contexto del KB va como mensaje de sistema extra.
  const fbMessages = extraSystem ? [...messages, { role: "system", content: extraSystem }] : messages;
  const chain: Prov[] = [];
  for (const id of ["gemini", "gemini_lite", "groq", "openrouter"]) {
    const row = (rows || []).find((r: any) => r.provider === (id === "gemini_lite" ? "gemini" : id));
    if (row?.api_key) chain.push({ id, url: DEFAULTS[id].url, model: id === "gemini_lite" ? DEFAULTS[id].model : (row.model || DEFAULTS[id].model), key: row.api_key, vision: DEFAULTS[id].vision });
  }
  chain.push({ id: "pollinations", url: "https://text.pollinations.ai/openai", model: "openai", vision: false });

  for (const p of chain) {
    if (imgs && !p.vision) continue;
    let r = await callProv(p, fbMessages, maxTokens);
    if (!r.ok && (r.status === 503 || r.status === 500)) { await new Promise((res) => setTimeout(res, 1500)); r = await callProv(p, fbMessages, maxTokens); }
    tried.push(`${p.id}:${r.ok ? "ok" : r.status}`);
    if (r.ok) return json({ choices: [{ finish_reason: r.finish, message: { role: "assistant", content: r.text } }], provider: p.id, sources: kb.ids, tried });
  }
  const imgMsg = imgs && !tried.some((t) => t.startsWith("gemini") || t.startsWith("claude"));
  return json({ error: imgMsg ? "El análisis de fotos necesita Claude o Gemini activos, y todavía no están configurados." : "La IA está saturada en este momento. Intenta de nuevo en un minuto.", tried }, 503);
});
