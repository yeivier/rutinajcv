// Conversión de lo que devuelve la API v2 de WHOOP a los registros que ya
// entiende FORJA (history.physio / history.sleep / history.activities).
// Sin red ni Deno: funciona igual en pruebas con Node.

const MIN = 60000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const num = (x: unknown): number | null => (typeof x === "number" && isFinite(x) ? x : null);

// "2026-08-01T05:10:00.000Z" + "-04:00" → "2026-08-01" (día LOCAL del atleta).
export function diaLocal(iso: string, offset?: string | null): string {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "";
  let off = 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset || "");
  if (m) off = (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) * MIN;
  return new Date(t + off).toISOString().slice(0, 10);
}
// FORJA deduplica por los 10 primeros caracteres de `date`: mediodía UTC
// deja el día intacto en cualquier huso horario.
const fechaDia = (dia: string) => `${dia}T12:00:00.000Z`;

type Fila = Record<string, any>;

export function mapear(cycles: Fila[], recoveries: Fila[], sleeps: Fila[], workouts: Fila[]) {
  const diaDeCiclo = new Map<string, string>();
  const physio = new Map<string, Fila>();
  const reg = (dia: string) => {
    let p = physio.get(dia);
    if (!p) { p = { date: fechaDia(dia), source: "whoop" }; physio.set(dia, p); }
    return p;
  };

  for (const c of cycles) {
    if (!c || c.id == null || !c.start) continue;
    const dia = diaLocal(c.start, c.timezone_offset);
    if (!dia) continue;
    diaDeCiclo.set(String(c.id), dia);
    const s = c.score;
    if (c.score_state === "SCORED" && s) {
      const p = reg(dia);
      const strain = num(s.strain), kj = num(s.kilojoule), avg = num(s.average_heart_rate), mx = num(s.max_heart_rate);
      if (strain != null) p.strain = r2(strain);
      if (kj != null) p.calories = Math.round(kj / 4.184);
      if (avg != null) p.avgHr = avg;
      if (mx != null) p.maxHr = mx;
    }
  }

  for (const r of recoveries) {
    if (!r || r.score_state !== "SCORED" || !r.score) continue;
    const dia = diaDeCiclo.get(String(r.cycle_id));
    if (!dia) continue;
    const s = r.score, p = reg(dia);
    const rec = num(s.recovery_score), rhr = num(s.resting_heart_rate), hrv = num(s.hrv_rmssd_milli),
      spo2 = num(s.spo2_percentage), skin = num(s.skin_temp_celsius);
    if (rec != null) p.recovery = Math.round(rec);
    if (rhr != null) p.restingHr = Math.round(rhr);
    if (hrv != null) p.hrv = r2(hrv);
    if (spo2 != null) p.spo2 = r2(spo2);
    if (skin != null) p.skinTemp = r2(skin);
  }

  const sleep = new Map<string, Fila>();
  for (const s of sleeps) {
    if (!s || s.nap || s.score_state !== "SCORED" || !s.score) continue;
    const dia = diaDeCiclo.get(String(s.cycle_id)) || diaLocal(s.end || s.start, s.timezone_offset);
    if (!dia) continue;
    const st = s.score.stage_summary || {};
    const light = num(st.total_light_sleep_time_milli) || 0, deep = num(st.total_slow_wave_sleep_time_milli) || 0, rem = num(st.total_rem_sleep_time_milli) || 0;
    const asleep = light + deep + rem;
    if (!asleep) continue;
    const rec: Fila = { date: fechaDia(dia), source: "whoop", hours: r2(asleep / 3600000),
      lightMin: Math.round(light / MIN), deepMin: Math.round(deep / MIN), remMin: Math.round(rem / MIN) };
    const awake = num(st.total_awake_time_milli), inBed = num(st.total_in_bed_time_milli);
    if (awake != null) rec.awakeMin = Math.round(awake / MIN);
    if (inBed != null) rec.inBedMin = Math.round(inBed / MIN);
    const ef = num(s.score.sleep_efficiency_percentage), sp = num(s.score.sleep_performance_percentage),
      co = num(s.score.sleep_consistency_percentage), rr = num(s.score.respiratory_rate);
    if (ef != null) rec.efficiencyPct = Math.round(ef);
    if (sp != null) rec.scorePct = Math.round(sp);
    if (co != null) rec.consistencyPct = Math.round(co);
    if (rr != null) rec.respRate = r2(rr);
    const need = s.score.sleep_needed;
    if (need) {
      const total = (num(need.baseline_milli) || 0) + (num(need.need_from_sleep_debt_milli) || 0) + (num(need.need_from_recent_strain_milli) || 0) - (num(need.need_from_recent_nap_milli) || 0);
      if (total > 0) rec.needMin = Math.round(total / MIN);
      const debt = num(need.need_from_sleep_debt_milli);
      if (debt != null && debt > 0) rec.debtMin = Math.round(debt / MIN);
    }
    // Una noche por día: si hubo dos registros, gana el más largo.
    const prev = sleep.get(dia);
    if (!prev || rec.hours > prev.hours) sleep.set(dia, rec);
  }

  const activities: Fila[] = [];
  for (const w of workouts) {
    if (!w || w.score_state !== "SCORED" || !w.score || !w.start || !w.end) continue;
    const dur = (new Date(w.end).getTime() - new Date(w.start).getTime()) / MIN;
    if (!(dur > 0)) continue;
    const s = w.score;
    const a: Fila = { date: new Date(w.start).toISOString(), name: String(w.sport_name || "Entrenamiento").replace(/-/g, " ").replace(/^./, (c: string) => c.toUpperCase()),
      source: "whoop", durationMin: r2(dur) };
    const strain = num(s.strain), kj = num(s.kilojoule), avg = num(s.average_heart_rate), mx = num(s.max_heart_rate), dist = num(s.distance_meter);
    if (strain != null) a.strain = r2(strain);
    if (kj != null) a.kcal = Math.round(kj / 4.184);
    if (avg != null) a.avgHr = avg;
    if (mx != null) a.maxHr = mx;
    if (dist != null && dist > 0) a.distanceKm = r2(dist / 1000);
    const z = s.zone_durations;
    if (z) {
      const ms = [z.zone_one_milli, z.zone_two_milli, z.zone_three_milli, z.zone_four_milli, z.zone_five_milli].map((v: unknown) => num(v) || 0);
      const tot = (num(z.zone_zero_milli) || 0) + ms.reduce((x: number, y: number) => x + y, 0);
      if (tot > 0) ms.forEach((v: number, i: number) => { if (v > 0) a[`z${i + 1}`] = r2((v / tot) * 100); });
    }
    activities.push(a);
  }

  const orden = (a: Fila, b: Fila) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return {
    physio: [...physio.values()].sort(orden),
    sleep: [...sleep.values()].sort(orden),
    activities: activities.sort(orden),
  };
}

// Firma de los webhooks: base64( HMAC-SHA256( timestamp + cuerpo crudo, client_secret ) ).
export async function firmaWebhook(timestamp: string, cuerpo: string, secreto: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(timestamp + cuerpo)));
  let bin = "";
  mac.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
export function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
