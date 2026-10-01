// whoop: puente entre FORJA y la API de WHOOP (v2).
//
// Qué hace, en una sola función:
//   · action "start"      → arma la URL de autorización de WHOOP para un alumno
//   · action "callback"   → canjea el código que WHOOP devuelve a la app y guarda los tokens
//   · action "sync"       → trae recuperación, sueño, esfuerzo y entrenamientos
//   · action "status"     → ¿está conectado? ¿cuándo se sincronizó por última vez?
//   · action "disconnect" → desvincula la cuenta
//   · webhook de WHOOP    → (cabecera X-WHOOP-Signature) sincroniza al alumno afectado
//
// Los tokens viven en `forja_whoop_accounts` (RLS sin políticas: la clave anónima
// de la app no los ve). Lo que se sincroniza se deja en `forja_kv`, clave
// `forja-whoop:<alumno>`, y la app lo mezcla en su historial al abrirse — mismo
// patrón que el reloj Garmin (`forja-watchlog`).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   WHOOP_CLIENT_SECRET   (obligatorio; NUNCA va en el código ni en la app)
//   WHOOP_CLIENT_ID       (opcional; por defecto el de la app "Forja")
//   WHOOP_REDIRECT_URI    (opcional; por defecto https://forjabodybuilding.com/whoop)
import { createClient } from "npm:@supabase/supabase-js@2";
import { mapear, firmaWebhook, igualesSeguro } from "./map.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID") || "fd5751f8-f83b-466a-a0ca-9cc248ce65f4";
// Al pegar el secreto en Supabase suelen colarse espacios, saltos de línea o comillas. Se prueban
// variantes limpias, en este orden: tal cual (sin espacios), sin comillas envolventes y el primer
// bloque de 64 caracteres hexadecimales (el formato de los secretos de WHOOP).
const SECRETO_CRUDO = Deno.env.get("WHOOP_CLIENT_SECRET") || "";
const CANDIDATOS: string[] = [...new Set([
  SECRETO_CRUDO.trim(),
  SECRETO_CRUDO.trim().replace(/^["'`]+|["'`]+$/g, "").trim(),
  (SECRETO_CRUDO.match(/[0-9a-fA-F]{64}/) || [""])[0],
].filter(Boolean))];
const CLIENT_SECRET = CANDIDATOS[0] || "";
let secretoActivo = 0; // el que ya funcionó, para probarlo primero la próxima vez
const REDIRECT_URI = Deno.env.get("WHOOP_REDIRECT_URI") || "https://forjabodybuilding.com/whoop";

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer/v2";
const SCOPES = "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const DIA = 86400000;
const MAX_DIAS_GUARDADOS = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

type Cuenta = {
  student_id: string; whoop_user_id: string | null; access_token: string; refresh_token: string;
  expires_at: string; scope: string | null; last_sync_at: string | null;
};

// ---------- tokens ----------
async function pedirToken(params: Record<string, string>) {
  const form = { "Content-Type": "application/x-www-form-urlencoded" };
  const fallos: string[] = [];
  // 1) Credenciales en el cuerpo (client_secret_post), con cada variante del secreto.
  const orden = CANDIDATOS.map((_, i) => i).sort((x, y) => (x === secretoActivo ? -1 : y === secretoActivo ? 1 : x - y));
  for (const i of orden) {
    const res = await fetch(TOKEN_URL, { method: "POST", headers: form,
      body: new URLSearchParams({ ...params, client_id: CLIENT_ID, client_secret: CANDIDATOS[i] }) });
    if (res.ok) { secretoActivo = i; return await res.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }; }
    fallos.push(`[cuerpo#${i} largo ${CANDIDATOS[i].length} → ${res.status}] ${(await res.text()).slice(0, 160)}`);
    if (res.status !== 401) throw new Error(fallos.join(" || "));
  }
  // 2) Cabecera Basic (client_secret_basic), por si la app estuviera registrada así.
  const res = await fetch(TOKEN_URL, { method: "POST",
    headers: { ...form, Authorization: "Basic " + btoa(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`) },
    body: new URLSearchParams(params) });
  if (res.ok) return await res.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  fallos.push(`[basic → ${res.status}] ${(await res.text()).slice(0, 160)}`);
  throw new Error(fallos.join(" || "));
}

// WHOOP rota el refresh token en cada uso: el nuevo se guarda ANTES de seguir.
// Si dos sincronizaciones coinciden y una pierde la carrera, relee la fila y
// usa el token que la otra ya guardó.
async function vigente(acc: Cuenta, reintento = false): Promise<Cuenta> {
  if (new Date(acc.expires_at).getTime() - Date.now() > 120000) return acc;
  try {
    const t = await pedirToken({ grant_type: "refresh_token", refresh_token: acc.refresh_token, scope: "offline" });
    const nuevo = {
      access_token: t.access_token,
      refresh_token: t.refresh_token || acc.refresh_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      scope: t.scope || acc.scope,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("forja_whoop_accounts").update(nuevo).eq("student_id", acc.student_id);
    if (error) throw error;
    return { ...acc, ...nuevo };
  } catch (e) {
    if (reintento) throw e;
    const { data } = await sb.from("forja_whoop_accounts").select("*").eq("student_id", acc.student_id).maybeSingle();
    if (data && data.refresh_token !== acc.refresh_token) return vigente(data as Cuenta, true);
    throw e;
  }
}

// ---------- API de WHOOP ----------
async function coleccion(acc: Cuenta, ruta: string, desde: string, hasta: string) {
  const out: any[] = [];
  let next = "";
  for (let i = 0; i < 12; i++) {
    const q = new URLSearchParams({ limit: "25", start: desde, end: hasta });
    if (next) q.set("nextToken", next);
    const res = await fetch(`${API}${ruta}?${q}`, { headers: { Authorization: `Bearer ${acc.access_token}` } });
    if (!res.ok) throw new Error(`whoop ${ruta} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    out.push(...(j.records || []));
    next = j.next_token || "";
    if (!next) break;
  }
  return out;
}

const unir = (prev: any[], nuevo: any[], clave: (x: any) => string) => {
  const m = new Map<string, any>();
  (prev || []).forEach((x) => m.set(clave(x), x));
  nuevo.forEach((x) => m.set(clave(x), { ...(m.get(clave(x)) || {}), ...x }));
  const corte = new Date(Date.now() - MAX_DIAS_GUARDADOS * DIA).toISOString();
  return [...m.values()].filter((x) => x.date >= corte).sort((a, b) => (a.date < b.date ? -1 : 1));
};

async function sincronizar(acc0: Cuenta, dias: number) {
  const acc = await vigente(acc0);
  const hasta = new Date().toISOString();
  // +2 días: el ciclo de "ayer" empieza antes de la ventana y la recuperación cuelga de él.
  const desde = new Date(Date.now() - (dias + 2) * DIA).toISOString();
  const [cycles, recoveries, sleeps, workouts] = await Promise.all([
    coleccion(acc, "/cycle", desde, hasta),
    coleccion(acc, "/recovery", desde, hasta),
    coleccion(acc, "/activity/sleep", desde, hasta),
    coleccion(acc, "/activity/workout", desde, hasta),
  ]);
  const nuevo = mapear(cycles, recoveries, sleeps, workouts);
  const key = `forja-whoop:${acc.student_id}`;
  const { data: fila } = await sb.from("forja_kv").select("value").eq("key", key).maybeSingle();
  const prev = fila?.value || {};
  const valor = {
    v: 1, u: Date.now(),
    physio: unir(prev.physio, nuevo.physio, (x) => x.date.slice(0, 10)),
    sleep: unir(prev.sleep, nuevo.sleep, (x) => x.date.slice(0, 10)),
    activities: unir(prev.activities, nuevo.activities, (x) => `${x.date}|${x.name}`),
  };
  await sb.from("forja_kv").upsert({ key, value: valor });
  await sb.from("forja_whoop_accounts").update({ last_sync_at: new Date().toISOString() }).eq("student_id", acc.student_id);
  return { physio: nuevo.physio.length, sleep: nuevo.sleep.length, activities: nuevo.activities.length };
}

async function cuentaDe(studentId: string): Promise<Cuenta | null> {
  const { data } = await sb.from("forja_whoop_accounts").select("*").eq("student_id", studentId).maybeSingle();
  return (data as Cuenta) || null;
}

async function existeAlumno(studentId: string) {
  const { data } = await sb.from("forja_kv").select("value").eq("key", "forja-roster").maybeSingle();
  const alumnos = (data?.value?.students || []) as { id: string }[];
  return alumnos.some((a) => a.id === studentId);
}

// ---------- webhook ----------
async function webhook(req: Request) {
  if (!CLIENT_SECRET) return json({ error: "sin secreto" }, 500);
  const cuerpo = await req.text();
  const ts = req.headers.get("x-whoop-signature-timestamp") || "";
  const firma = req.headers.get("x-whoop-signature") || "";
  // Repetir un mensaje viejo no sirve: se rechaza todo lo que tenga más de 5 minutos.
  if (!ts || Math.abs(Date.now() - Number(ts)) > 300000) return json({ error: "timestamp" }, 401);
  let valida = false;
  for (const sec of CANDIDATOS) { if (firma && igualesSeguro(await firmaWebhook(ts, cuerpo, sec), firma)) { valida = true; break; } }
  if (!valida) return json({ error: "firma" }, 401);

  let ev: any; try { ev = JSON.parse(cuerpo); } catch { return json({ error: "json" }, 400); }
  const whoopId = ev?.user_id != null ? String(ev.user_id) : "";
  if (!whoopId) return json({ ok: true });
  const { data } = await sb.from("forja_whoop_accounts").select("*").eq("whoop_user_id", whoopId).maybeSingle();
  if (!data) return json({ ok: true });
  // Se responde ya (WHOOP reintenta si tarda) y se sincroniza en segundo plano.
  const trabajo = sincronizar(data as Cuenta, 3).catch((e) => console.error("webhook sync", e));
  // @ts-ignore EdgeRuntime es global en el runtime de Supabase.
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(trabajo); else await trabajo;
  return json({ ok: true });
}

// ---------- entrada ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.headers.get("x-whoop-signature")) return webhook(req);
  if (req.method !== "POST") return json({ error: "método" }, 405);
  if (!CLIENT_SECRET) return json({ error: "Falta el secreto WHOOP_CLIENT_SECRET en Supabase." }, 500);

  let b: any; try { b = await req.json(); } catch { return json({ error: "json" }, 400); }
  const studentId = String(b?.studentId || "");

  try {
    if (b.action === "start") {
      if (!studentId || !(await existeAlumno(studentId))) return json({ error: "alumno desconocido" }, 404);
      const state = crypto.randomUUID().replace(/-/g, "");
      await sb.from("forja_whoop_states").delete().lt("expires_at", new Date().toISOString());
      await sb.from("forja_whoop_states").insert({ state, student_id: studentId, expires_at: new Date(Date.now() + 15 * 60000).toISOString() });
      const q = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, scope: SCOPES, state });
      return json({ url: `${AUTH_URL}?${q}` });
    }

    if (b.action === "callback") {
      const state = String(b?.state || ""), code = String(b?.code || "");
      if (!state || !code) return json({ error: "faltan code/state" }, 400);
      // Un solo uso: se borra al leerlo.
      const { data: st } = await sb.from("forja_whoop_states").delete().eq("state", state).select("*").maybeSingle();
      if (!st || new Date(st.expires_at).getTime() < Date.now()) return json({ error: "El enlace venció. Vuelve a conectar desde Dispositivos." }, 400);
      const t = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
      if (!t.refresh_token) return json({ error: "WHOOP no devolvió refresh token (falta el permiso offline)." }, 502);
      const pr = await fetch(`${API}/user/profile/basic`, { headers: { Authorization: `Bearer ${t.access_token}` } });
      const perfil = pr.ok ? await pr.json() : {};
      const whoopId = perfil?.user_id != null ? String(perfil.user_id) : null;
      // Una cuenta de WHOOP pertenece a un solo alumno.
      if (whoopId) await sb.from("forja_whoop_accounts").delete().eq("whoop_user_id", whoopId).neq("student_id", st.student_id);
      const fila = {
        student_id: st.student_id, whoop_user_id: whoopId, access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), scope: t.scope || SCOPES,
        connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("forja_whoop_accounts").upsert(fila, { onConflict: "student_id" });
      if (error) throw error;
      let resumen = null;
      try { resumen = await sincronizar(fila as Cuenta, 30); } catch (e) { console.error("sync inicial", e); }
      return json({ ok: true, studentId: st.student_id, resumen });
    }

    if (!studentId) return json({ error: "falta studentId" }, 400);

    if (b.action === "status") {
      const a = await cuentaDe(studentId);
      return json({ connected: !!a, lastSyncAt: a?.last_sync_at || null });
    }
    if (b.action === "sync") {
      const a = await cuentaDe(studentId);
      if (!a) return json({ connected: false });
      return json({ connected: true, ...(await sincronizar(a, Math.min(Math.max(Number(b.days) || 7, 1), 60))) });
    }
    if (b.action === "disconnect") {
      const a = await cuentaDe(studentId);
      if (a) {
        try { const v = await vigente(a); await fetch(`${API}/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${v.access_token}` } }); } catch { /* ya estaba revocado */ }
        await sb.from("forja_whoop_accounts").delete().eq("student_id", studentId);
      }
      return json({ ok: true });
    }
    return json({ error: "acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e).slice(0, 1200) }, 500);
  }
});
