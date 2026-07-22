import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Flame, Dumbbell, TrendingUp, BookOpen, Utensils, ClipboardList, MessageSquare,
  Camera, Check, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  X, Info, Timer, PencilLine, Copy, Award, Scale, Video, History, Play,
  ArrowUp, ArrowDown, AlertTriangle, RotateCcw, Home, Users, StickyNote, Pause,
  Undo2, Redo2, Calendar, Sparkles, Upload, ArrowRight, Zap, Send, Bell, Paperclip
} from "lucide-react";

/* ============================================================
   FORJA — plataforma coach ↔ alumno
   Diseño: hierro caliente. Tema oscuro cálido, acento brasa.
   Persistencia: Supabase (PostgreSQL, compartido coach/alumnos).
   ============================================================ */

const P = {
  bg: "#12100E",
  s1: "#1B1815",
  s2: "#241F19",
  s3: "#2E2820",
  line: "#3A3226",
  text: "#F2E9DC",
  dim: "#A2957F",
  faint: "#6E6350",
  ember: "#FF6B2C",
  ember2: "#FFB86B",
  green: "#63D68C",
  red: "#E5484D",
  blue: "#5FA8C7",
};

const SET_TYPES = {
  warmup:   { label: "Aproximación", short: "APR", color: "#6E8CA0", g: "warmup" },
  normal:   { label: "Efectiva",     short: "EF",  color: "#A2957F", g: "efectiva" },
  top:      { label: "Top set",      short: "TOP", color: "#FF6B2C", g: "topset" },
  backoff:  { label: "Back-off",     short: "B-O", color: "#E8A54B", g: "backoff" },
  drop:     { label: "Drop set",     short: "DROP",color: "#E5484D", g: "dropset" },
  restpause:{ label: "Rest-pause",   short: "R-P", color: "#B583F0", g: "restpause" },
  amrap:    { label: "AMRAP",        short: "AMR", color: "#4CC9E8", g: "amrap" },
};

const MUSCLES = ["Espalda","Pecho","Hombro","Bíceps","Tríceps","Cuádriceps","Femoral","Glúteo","Gemelo","Core","Antebrazo","Otro"];

/* ---------------- Glosario ---------------- */
const GLOSSARY = [
  { id:"rir", term:"RIR (Reps In Reserve)", def:"Repeticiones que te quedan «en reserva» al terminar la serie. RIR 2 significa que paraste pudiendo hacer 2 repeticiones más con técnica correcta. Es la forma más práctica de regular el esfuerzo sin llegar siempre al fallo.", ej:"Objetivo: 8–10 reps @ RIR 2 → eliges un peso con el que llegarías al fallo alrededor de las 10–12 reps y paras en 8–10." },
  { id:"rpe", term:"RPE (esfuerzo percibido)", def:"Escala de 1 a 10 que mide qué tan dura fue la serie. Es el espejo del RIR: RPE 8 = RIR 2, RPE 9 = RIR 1, RPE 10 = fallo (RIR 0).", ej:"Si tu coach pide RPE 8, es lo mismo que dejar 2 repeticiones en reserva." },
  { id:"topset", term:"Top set", def:"La serie más pesada del ejercicio en el día: una sola serie con el peso máximo planificado, normalmente cerca del fallo (RIR 0–2). Sirve para empujar la progresión de fuerza y como referencia para calcular las series siguientes.", ej:"Top set: 1 × 6–8 @ RIR 1 con 100 kg, y desde ahí se calculan los back-offs." },
  { id:"backoff", term:"Back-off set", def:"Series que se hacen después del top set bajando el peso (típicamente entre 10 % y 20 % menos) para acumular volumen de calidad con menos fatiga y mejor técnica.", ej:"Top set 100 kg → back-offs 2 × 8–10 con 85 kg (−15 %). FORJA te sugiere el peso automáticamente." },
  { id:"dropset", term:"Drop set", def:"Al terminar la serie cerca del fallo, bajas el peso de inmediato (20–30 % menos) y sigues repitiendo sin descanso. Puede tener una o varias «caídas». Genera mucho estímulo y mucha fatiga: se usa con moderación, normalmente en la última serie de ejercicios de aislamiento.", ej:"Elevaciones laterales: 12 reps con 10 kg → sin descansar, 10 reps con 7 kg → 8 reps con 5 kg." },
  { id:"restpause", term:"Rest-pause", def:"Haces la serie hasta cerca del fallo, descansas 10–20 segundos y, con el mismo peso, sacas un mini-bloque más de repeticiones. Se puede repetir 1–2 veces. Permite acumular repeticiones efectivas en poco tiempo.", ej:"12 reps → 15 s de pausa → 4 reps → 15 s → 3 reps, todo con el mismo peso." },
  { id:"amrap", term:"AMRAP", def:"«As Many Reps As Possible»: haces todas las repeticiones posibles con técnica correcta (según el RIR indicado). Sirve para medir progreso y ajustar cargas.", ej:"Última serie AMRAP @ RIR 1: anota cuántas salieron; si superas el rango, la próxima semana sube el peso." },
  { id:"warmup", term:"Serie de aproximación", def:"Series ligeras previas a las series efectivas para preparar articulaciones, activar la musculatura y practicar la técnica sin generar fatiga. No cuentan como volumen efectivo.", ej:"Antes de un top set de 100 kg: 8 reps con 40 kg, 5 con 60 kg, 3 con 80 kg." },
  { id:"efectiva", term:"Serie efectiva", def:"Serie de trabajo real, hecha lo bastante cerca del fallo (RIR 0–4) como para estimular hipertrofia. Es la unidad con la que se cuenta el volumen semanal por grupo muscular.", ej:"3 series efectivas de 8–10 @ RIR 2 en remo = 3 series que suman al volumen de espalda." },
  { id:"superset", term:"Superserie", def:"Dos ejercicios realizados uno inmediatamente después del otro, descansando recién al terminar el segundo. Ahorra tiempo y funciona mejor con músculos antagonistas o que no compiten entre sí.", ej:"Curl de bíceps + extensión de tríceps en polea, descanso de 90 s al completar ambos." },
  { id:"tempo", term:"Tempo", def:"Velocidad de cada fase de la repetición escrita en 4 números: excéntrica – pausa abajo – concéntrica – pausa arriba (en segundos). Controlar la bajada suele ser lo más relevante para hipertrofia.", ej:"Tempo 3-1-1-0: bajas en 3 s, pausa de 1 s, subes en 1 s, sin pausa arriba." },
  { id:"fallo", term:"Fallo muscular / fallo técnico", def:"Fallo muscular: no puedes completar otra repetición aunque lo intentes. Fallo técnico: aún podrías moverla, pero ya no con técnica correcta. Para hipertrofia se entrena cerca del fallo; llegar siempre al fallo absoluto aumenta la fatiga más que el estímulo.", ej:"Si en la rep 9 la espalda se despega del respaldo, esa fue tu última rep útil: fallo técnico." },
  { id:"volumen", term:"Volumen de entrenamiento", def:"Cantidad total de trabajo. La forma más usada de medirlo es el número de series efectivas por grupo muscular por semana; también se mide en kilos totales (peso × reps × series).", ej:"Espalda: 14 series efectivas/semana. FORJA calcula el tonelaje de cada sesión automáticamente." },
  { id:"sobrecarga", term:"Sobrecarga progresiva", def:"Principio central del progreso: hacer más con el tiempo — más peso, más repeticiones o más series con la misma técnica. Por eso registrar cada serie importa: sin historial no hay progresión medible.", ej:"Semana 1: 80 kg × 8. Semana 3: 80 kg × 10. Semana 4: 82,5 kg × 8." },
  { id:"mesociclo", term:"Mesociclo", def:"Bloque de entrenamiento de 4 a 8 semanas con una progresión planificada (subiendo volumen o intensidad), que normalmente termina en una descarga.", ej:"Mesociclo de 5 semanas: RIR 3 → 2 → 2 → 1 → deload." },
  { id:"deload", term:"Deload (descarga)", def:"Semana de trabajo reducido (menos series y/o menos peso, RIR alto) para disipar fatiga acumulada y llegar fresco al siguiente bloque. No es perder el tiempo: es parte del plan.", ej:"Deload: mitad de las series, 10–20 % menos de peso, todo @ RIR 4–5." },
];

/* ---------------- Supabase storage ---------------- */
const SB_URL = "https://vzenlmcbftopyjzcltxa.supabase.co/rest/v1/forja_kv";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5sbWNiZnRvcHlqemNsdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjQ5NDksImV4cCI6MjA5ODI0MDk0OX0.CWCrsDVuFEsq3QiAYHRYmsRrD6AI2M7o6ofRUQJXUyY";
const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const localCache = new Map();   // shared=false → solo esta pestaña (no persiste al refrescar)
const remoteCache = new Map();  // cache de lecturas Supabase
let storageOK = true;

async function sGet(key, shared = true) {
  if (!shared) return localCache.get(key) ?? null;
  if (remoteCache.has(key)) return remoteCache.get(key);
  try {
    const r = await fetch(`${SB_URL}?key=eq.${encodeURIComponent(key)}&select=value`, { headers: SB_H });
    if (!r.ok) throw new Error(r.statusText);
    const rows = await r.json();
    const val = rows.length ? rows[0].value : null;
    if (val !== null) remoteCache.set(key, val);
    return val;
  } catch (e) {
    storageOK = false;
    return remoteCache.get(key) ?? null;
  }
}

async function sSet(key, value, shared = true) {
  if (!shared) { localCache.set(key, value); return true; }
  if (value === null || value === undefined) return sDel(key, true);
  remoteCache.set(key, value);
  try {
    const r = await fetch(SB_URL, {
      method: "POST",
      headers: { ...SB_H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, value }),
    });
    if (!r.ok) throw new Error(r.statusText);
    storageOK = true;
    return true;
  } catch (e) {
    storageOK = false;
    return false;
  }
}

async function sDel(key, shared = true) {
  if (!shared) { localCache.delete(key); return; }
  remoteCache.delete(key);
  try {
    await fetch(`${SB_URL}?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: SB_H });
  } catch (e) { /* fire-and-forget */ }
}

/* ---------------- Utilidades ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const todayISO = () => new Date().toISOString();
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
};
const fmtDateFull = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const kg = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ","));
const weekKey = (iso) => {
  const d = new Date(iso); const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day); mon.setHours(0,0,0,0);
  return mon.getTime();
};

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
  try { navigator.vibrate && navigator.vibrate([220, 90, 220]); } catch {}
}

function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("Por ahora solo se pueden adjuntar fotos (el almacenamiento de la app tiene un límite de 5 MB por archivo; los videos lo superan). Los videos estarán disponibles cuando pasemos la app a un servidor propio."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length > 3_800_000) reject(new Error("La foto quedó demasiado pesada incluso comprimida. Intenta con otra."));
        else resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- Programa del alumno ---------------- */
const SEED_VERSION = 2;
const ROSTER_VERSION = 1;
const sets = (arr) => arr.map(([type, repsT, rirT, pct]) => ({ id: uid(), type, repsT, rirT: rirT ?? "", pct: pct ?? 15 }));
const emptyPlan = () => ({ days: [], nutrition: { kcal: 0, p: 0, c: 0, f: 0, notes: "", meals: [] }, instructions: [], schedule: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }, events: [], updatedAt: todayISO() });
function seedPlan() {
  const ex = (name, muscle, rest, ss, notes, video, s) => ({ id: uid(), name, muscle, rest, superset: ss || "", notes: notes || "", video: video || "", sets: s });
  const n = (reps, rir) => ["normal", reps, rir];
  return {
    seedVersion: SEED_VERSION,
    days: [
      { id: uid(), name: "Entrenamiento A", exs: [
        ex("Aperturas en Máquinas (peck deck)", "Pecho", 90, "", "Siéntate más adelante en el banco, con el tronco inclinado hacia atrás y el pecho arriba para dirigir el movimiento hacia abajo.", "", sets([n("10-12","0"), n("8-10","0"), n("6-8","0")])),
        ex("Press Inclinado en Smith/Máquina (banco a 15°)", "Pecho", 120, "", "El «/» son opciones: elige Smith o máquina, la que prefieras.", "", sets([n("10-12","1"), n("8-10","1"), n("6-8","1")])),
        ex("Press Plano con Mancuernas", "Pecho", 120, "", "Bajada controlada, escápulas retraídas.", "", sets([n("10-12","1"), n("8-10","1")])),
        ex("Press de hombros en Smith o en máquina", "Hombro", 120, "", "El «/» son opciones: Smith o máquina.", "", sets([n("8-10","1"), n("6-8","1")])),
        ex("Aperturas Inclinadas en Polea", "Pecho", 90, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Elevación Lateral Cable/Máquina", "Hombro", 90, "", "El «/» son opciones: cable o máquina.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Elevación Lateral Mancuernas", "Hombro", 90, "", "Sube con el codo, no con la mano.", "", sets([n("8-10","0"), n("8-10","0")])),
        ex("Extensión de Tríceps en Poleas Cruzadas", "Tríceps", 90, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
      ]},
      { id: uid(), name: "Entrenamiento B", exs: [
        ex("Jalón Prono", "Espalda", 120, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Jalón Unilateral Neutro/Supino", "Espalda", 120, "", "El «/» son opciones: agarre neutro o supino.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Remo en máquina tipo T con apoyo en el pecho", "Espalda", 120, "", "Sin impulso lumbar; pausa de 1 s atrás.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Pullover en Polea", "Espalda", 90, "", "Brazos casi rectos, siente el estiramiento del dorsal.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Remo Bajo con Triángulo", "Espalda", 120, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Aperturas inversas en polea", "Hombro", 90, "", "Deltoides posterior.", "", sets([n("10-12","0"), n("10-12","0"), n("10-12","0")])),
        ex("Curl Scott en Máquina", "Bíceps", 90, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
      ]},
      { id: uid(), name: "Entrenamiento C", exs: [
        ex("Máquina Abductora", "Glúteo", 90, "", "", "", sets([n("12-15","0"), n("10-12","0"), n("8-10","0")])),
        ex("Peso Muerto Piernas Rígidas", "Femoral", 120, "", "Cadera atrás, espalda neutra, barra/mancuernas pegadas a las piernas.", "", sets([n("8-10","1"), n("6-8","1")])),
        ex("Prensa de Piernas", "Cuádriceps", 120, "", "", "", sets([n("12-15","1"), n("10-12","1")])),
        ex("Prensa de Piernas Unilateral", "Cuádriceps", 120, "", "", "", sets([n("10-12","1"), n("8-10","1")])),
        ex("Extensión de Piernas", "Cuádriceps", 90, "", "", "", sets([n("12-15","0"), n("10-12","0")])),
        ex("Flexión de Piernas", "Femoral", 90, "", "Pausa de 1 s en la contracción.", "", sets([n("12-15","0"), n("10-12","0"), n("8-10","0"), n("8-10","0")])),
        ex("Elevación Lateral con Mancuernas Sentado", "Hombro", 90, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
      ]},
      { id: uid(), name: "Entrenamiento D", exs: [
        ex("Cruce de poleas en banco plano", "Pecho", 90, "", "", "", sets([n("10-12","0"), n("8-10","0"), n("6-8","0")])),
        ex("Press Inclinado con Mancuernas (15°)", "Pecho", 120, "", "", "", sets([n("10-12","0"), n("8-10","0"), n("6-8","0")])),
        ex("Press Reto en Máquina o Smith", "Pecho", 120, "", "Press recto. El «/» son opciones: máquina o Smith.", "", sets([n("8-10","0"), n("6-8","0")])),
        ex("Press Declinado en Máquina o Smith", "Pecho", 120, "", "El «/» son opciones: máquina o Smith.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Elevación frontal en banco inclinado", "Hombro", 90, "", "", "", sets([n("10-12","0"), n("8-10","0"), n("8-10","0")])),
        ex("Elevación Lateral Cable/Máquina", "Hombro", 90, "", "El «/» son opciones: cable o máquina.", "", sets([n("10-12","0"), n("8-10","0"), n("8-10","0"), n("8-10","0")])),
        ex("Extensión de Tríceps Francés Poleas/Manc", "Tríceps", 90, "", "El «/» son opciones: poleas o mancuernas.", "", sets([n("10-12","0"), n("10-12","0")])),
      ]},
      { id: uid(), name: "Entrenamiento E", exs: [
        ex("Jalón Supino Bilateral", "Espalda", 120, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Remo Prono", "Espalda", 120, "", "", "", sets([n("10-12","0"), n("8-10","0"), n("6-8","0")])),
        ex("Remo Neutro o Supino Unilateral en Máquina", "Espalda", 120, "", "El «/» son opciones: agarre neutro o supino.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Jalón Neutro", "Espalda", 120, "", "", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Aperturas inversas en Máquina", "Hombro", 90, "", "Deltoides posterior.", "", sets([n("10-12","0"), n("10-12","0")])),
        ex("Curl en Banco Inclinado (45°)", "Bíceps", 90, "", "Codos atrás del torso, estiramiento completo.", "", sets([n("10-12","0"), n("8-10","0")])),
        ex("Hiperextensión en banco romano", "Glúteo", 90, "", "Sostén un peso contra el pecho.", "", sets([n("10-12","0"), n("10-12","0"), n("10-12","0")])),
      ]},
    ],
    nutrition: {
      kcal: 0, p: 0, c: 0, f: 0,
      notes: "Este plan no incluye pauta de alimentación (no venía en el documento). Tu coach puede cargarla desde el modo Coach → Nutrición.",
      meals: [],
    },
    instructions: [
      { id: uid(), title: "Datos y cronograma", body: "Leandro Pereira · 27 años · 1,77 m · categoría Mens Physique. Peso inicial 83 → peso actual 90. Bloque de 4 semanas. Cronograma: Lunes A · Martes B · Miércoles C · Viernes D · Sábado E (jueves y domingo, descanso). Cardio suave ~120 bpm según indique el coach." },
      { id: uid(), title: "Foco: progresión de carga", body: "El foco del plan es la progresión de carga. Anota SIEMPRE tus cargas para mantener el control (esta app lo hace por ti). El progreso no depende solo del plan, sino de la ejecución correcta, la técnica y la conciencia corporal: siente el músculo que trabaja. Si el entrenamiento se siente muy fácil, probablemente no estás dando tu máximo: progresa la carga con buena amplitud y cadencia. No agregues ejercicios ni series extra: más volumen puede perjudicar la recuperación." },
      { id: uid(), title: "Intensidad del Esfuerzo (IE) y RIR", body: "El IE mide el esfuerzo de cada serie en escala 1 a 10. 1–5: muy fácil (calentamiento). 6–7: medio, terminarías con 3–4 reps en reserva. 8: desafiante, ~2 reps en reserva. 9: muy exigente, queda 1 rep en reserva. 10: fallo total. En FORJA cada serie muestra el RIR equivalente: IE 10 = RIR 0, IE 9 = RIR 1, IE 8 = RIR 2. Respeta el IE de cada ejercicio como parámetro." },
      { id: uid(), title: "Series y calentamiento", body: "Las series que aparecen en cada ejercicio son las series efectivas (cerca o hasta el fallo, según el IE). Antes, calienta en el propio ejercicio: empieza con cargas bajas y súbelas de forma progresiva con pocas repeticiones, sin fatigarte. Ejemplo Leg Press: 40 kg (10) → 100 kg (6) → 140 kg (3) → serie principal. Regla del «/»: en el nombre = opciones (elige la que prefieras); en las repeticiones = las reps de cada serie (Serie 1 / Serie 2 / Serie 3)." },
      { id: uid(), title: "Descanso", body: "Depende del esfuerzo de la serie. Ejercicios libres/compuestos: 2 a 5 minutos. Ejercicios aislados: 1 a 2:30 minutos. Los descansos precargados en cada ejercicio son una referencia (120 s compuestos, 90 s aislados); ajústalos con el temporizador o desde el modo Coach." },
      { id: uid(), title: "Cadencia / velocidad de ejecución", body: "Contrae rápido en la fase concéntrica (~1–1,5 s) y alarga de forma controlada la excéntrica (2–3 s). La técnica y la amplitud no son negociables: no uses cargas que no te permitan mantenerlas. Las repeticiones «robadas» rara vez son efectivas." },
      { id: uid(), title: "Técnicas avanzadas", body: "Rest-Pause: al finalizar la última serie, descansa 15 s, ve al fallo, descansa otros 15 s y vuelve al fallo, sin cambiar la carga. Drop-Set: ejecuta la serie de la planilla; al terminar, baja la carga ~20 % (1–2 placas en máquinas) y haz otra serie de inmediato, sin descanso; repite el proceso una vez más." },
      { id: uid(), title: "Abdomen y pantorrillas", body: "Pantorrillas: gemelos de pie o en prensa/hack (rodilla extendida), 4 series en pirámide (15–20 / 12–15 / 8–10 / 12–15) al fallo, amplitud completa y control, 2–3 veces por semana. Abdomen: plancha frontal 2×60 s (10 s de descanso entre ellas); abdomen inferior 3 series al fallo, 3 veces por semana. Vacío abdominal 10 min en ayunas, todos los días." },
      { id: uid(), title: "Movilidad, estiramientos y bracing", body: "Mantén la movilidad al día, siempre antes de entrenar o en un horario aparte. Bracing: inhala por la boca dirigiendo el aire al abdomen inferior y oblicuos, cerrando costillas y fijando el abdomen para proteger la columna en ejercicios libres. Isquiotibiales dinámico 2×10 por pierna. Aductores 2×40 s. Pantorrilla en step 40 s + 20 s por pierna. Pectoral 2×40 s por lado. Glúteos 2×40 s por lado. Flexores de cadera 2×30 s por lado. Flexores de cadera / recto femoral 2×30 s por lado." },
    ],
    // Cronograma semanal por defecto (según el PDF de Boretti Squad)
    // Los IDs de días se rellenan en seedPlanWithSchedule más abajo.
    schedule: null,
    events: [],
    updatedAt: todayISO(),
  };
}

// Envuelve seedPlan asignando el schedule con los IDs reales de los días A-E
function seedPlanWithSchedule() {
  const p = seedPlan();
  const [A, B, C, D, E] = p.days.map((d) => d.id);
  p.schedule = { mon: A, tue: B, wed: C, thu: null, fri: D, sat: E, sun: null };
  return p;
}
const emptyHistory = () => ({ byEx: {}, sessions: [], bodyweight: [], bodyPhotos: [] });

/* ============================================================
   Átomos de interfaz
   ============================================================ */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; }
    .fj { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; color: ${P.text}; font-variant-numeric: tabular-nums; }
    .fj h1,.fj h2,.fj .disp { font-family: 'Barlow Condensed','Inter',ui-sans-serif,sans-serif; letter-spacing: .04em; }
    .fj input, .fj textarea, .fj select {
      background: ${P.s3}; border: 1px solid ${P.line}; color: ${P.text};
      border-radius: 10px; font-family: inherit; font-size: 15px; outline: none;
    }
    .fj input:focus-visible, .fj textarea:focus-visible, .fj select:focus-visible, .fj button:focus-visible {
      outline: 2px solid ${P.ember}; outline-offset: 1px;
    }
    .fj input::placeholder, .fj textarea::placeholder { color: ${P.faint}; }
    .fj button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
    .fj ::-webkit-scrollbar { width: 6px; height: 6px; }
    .fj ::-webkit-scrollbar-thumb { background: ${P.line}; border-radius: 3px; }
    @keyframes fjQuench { 0% { background-color: rgba(255,107,44,.35); } 100% { background-color: rgba(99,214,140,.10); } }
    .fj .quench { animation: fjQuench .9s ease forwards; }
    @keyframes fjPulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    .fj .pulse { animation: fjPulse 1.6s ease-in-out infinite; }
    @keyframes fjUp { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
    .fj .sheetIn { animation: fjUp .22s ease; }
    @media (prefers-reduced-motion: reduce) { .fj * { animation: none !important; transition: none !important; } }
  `}</style>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: P.s1, border: `1px solid ${P.line}`, borderRadius: 16, ...style }}>{children}</div>
);

const Btn = ({ children, kind = "ghost", onClick, style, disabled, small }) => {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 12, fontWeight: 600, fontSize: small ? 13 : 15,
    padding: small ? "7px 12px" : "12px 18px", opacity: disabled ? 0.45 : 1, transition: "filter .15s" };
  const kinds = {
    ember: { background: `linear-gradient(135deg, ${P.ember}, #E1531A)`, color: "#1A0D05" },
    ghost: { background: P.s2, border: `1px solid ${P.line}`, color: P.text },
    line:  { background: "transparent", border: `1px solid ${P.line}`, color: P.dim },
    green: { background: "rgba(99,214,140,.14)", border: `1px solid rgba(99,214,140,.4)`, color: P.green },
    red:   { background: "rgba(229,72,77,.12)", border: `1px solid rgba(229,72,77,.4)`, color: P.red },
  };
  return <button disabled={disabled} onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>;
};

const TypeBadge = ({ type, onInfo, big }) => {
  const t = SET_TYPES[type] || SET_TYPES.normal;
  return (
    <button onClick={onInfo} title={t.label}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${t.color}22`,
        color: t.color, border: `1px solid ${t.color}55`, borderRadius: 7, padding: big ? "4px 9px" : "2px 7px",
        fontSize: big ? 12 : 10.5, fontWeight: 700, letterSpacing: ".05em" }}>
      {t.short}{onInfo && <Info size={big ? 12 : 10} strokeWidth={2.5} />}
    </button>
  );
};

const Sheet = ({ open, onClose, title, children, tall }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.62)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="sheetIn" onClick={(e) => e.stopPropagation()}
        style={{ background: P.s1, borderTop: `1px solid ${P.line}`, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520,
          maxHeight: tall ? "95vh" : "82vh", minHeight: "60vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: `1px solid ${P.line}`, flexShrink: 0 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 20, textTransform: "uppercase" }}>{title}</h2>
          <button onClick={onClose} style={{ color: P.dim, padding: 6 }}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 18px 28px", flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
};

const Confirm = ({ open, title, body, okLabel, danger, onOk, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card style={{ padding: 20, maxWidth: 360, width: "100%", background: P.s2 }}>
        <div className="disp" style={{ fontSize: 19, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
        <div style={{ color: P.dim, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn kind="line" onClick={onCancel}>Cancelar</Btn>
          <Btn kind={danger ? "red" : "ember"} onClick={onOk}>{okLabel}</Btn>
        </div>
      </Card>
    </div>
  );
};

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: P.dim, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 12, color: P.faint, marginTop: 4 }}>{hint}</div>}
  </div>
);

const Inp = (props) => <input {...props} style={{ width: "100%", padding: "10px 12px", ...props.style }} />;
const Txt = (props) => <textarea rows={props.rows || 3} {...props} style={{ width: "100%", padding: "10px 12px", resize: "vertical", ...props.style }} />;

const Empty = ({ icon: Icon, title, body }) => (
  <div style={{ textAlign: "center", padding: "42px 24px", color: P.faint }}>
    <Icon size={34} style={{ marginBottom: 10, opacity: .6 }} />
    <div style={{ fontWeight: 600, color: P.dim, marginBottom: 5 }}>{title}</div>
    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
  </div>
);

const Logo = ({ size = 26 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ width: size + 8, height: size + 8, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(140deg, ${P.ember}, #C23E0E)`, boxShadow: "0 2px 12px rgba(255,107,44,.35)" }}>
      <Flame size={size * 0.68} color="#1A0D05" strokeWidth={2.6} />
    </div>
    <div className="disp" style={{ fontSize: size, fontWeight: 700, letterSpacing: ".14em" }}>FORJA</div>
  </div>
);

/* ---------------- Glosario UI ---------------- */
const GlossaryBody = ({ focusId }) => {
  const ref = useRef(null);
  useEffect(() => { if (focusId && ref.current) { const el = ref.current.querySelector(`[data-g="${focusId}"]`); el && el.scrollIntoView({ block: "start" }); } }, [focusId]);
  return (
    <div ref={ref}>
      {GLOSSARY.map((g) => (
        <div key={g.id} data-g={g.id} style={{ padding: "14px 0", borderBottom: `1px solid ${P.line}`,
          background: focusId === g.id ? "rgba(255,107,44,.06)" : "transparent", borderRadius: 8, scrollMarginTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 5, color: focusId === g.id ? P.ember2 : P.text }}>{g.term}</div>
          <div style={{ fontSize: 14, color: P.dim, lineHeight: 1.55 }}>{g.def}</div>
          <div style={{ fontSize: 13, color: P.faint, lineHeight: 1.5, marginTop: 7, paddingLeft: 10, borderLeft: `2px solid ${P.line}` }}>
            <span style={{ color: P.ember2, fontWeight: 600 }}>Ejemplo · </span>{g.ej}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ============================================================
   Adjuntos
   ============================================================ */
const MAX_VIDEO_BYTES = 9 * 1024 * 1024; // ~9 MB por video

function readFileDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

// Captura un fotograma del video para usarlo como miniatura
function videoPoster(dataUrl) {
  return new Promise((res) => {
    try {
      const v = document.createElement("video");
      v.preload = "metadata"; v.muted = true; v.playsInline = true; v.src = dataUrl;
      const done = (out) => { v.removeAttribute("src"); res(out); };
      v.onloadeddata = () => {
        try { v.currentTime = Math.min(0.6, (v.duration || 1) / 3); } catch (e) { done(null); }
      };
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 320 / (v.videoWidth || 320));
          c.width = Math.max(1, Math.round((v.videoWidth || 320) * scale));
          c.height = Math.max(1, Math.round((v.videoHeight || 240) * scale));
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          done(c.toDataURL("image/jpeg", 0.6));
        } catch (e) { done(null); }
      };
      v.onerror = () => done(null);
      setTimeout(() => done(null), 5000);
    } catch (e) { res(null); }
  });
}

const AttachThumb = ({ id, onOpen, onRemove, size = 64 }) => {
  const [m, setM] = useState(null);
  useEffect(() => { let on = true; sGet(`attach:${id}`).then((v) => on && setM(v || null)); return () => { on = false; }; }, [id]);
  const isVideo = m && m.kind === "video";
  const thumb = m ? (isVideo ? m.poster : m.dataUrl) : null;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <button onClick={() => m && onOpen && onOpen(m)} style={{ width: size, height: size, borderRadius: 10, overflow: "hidden",
        background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {thumb ? <img src={thumb} alt="Adjunto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
               : (isVideo ? <Video size={18} color={P.ember2} /> : <Camera size={18} color={P.faint} />)}
        {isVideo && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.28)" }}>
            <span style={{ width: Math.round(size * 0.36), height: Math.round(size * 0.36), borderRadius: 999, background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={Math.max(10, Math.round(size * 0.2))} color="#fff" />
            </span>
          </span>
        )}
      </button>
      {onRemove && (
        <button onClick={onRemove} style={{ position: "absolute", top: -5, right: -5, width: 20, height: 20, borderRadius: 999, background: P.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
};

// Acepta tanto un objeto {dataUrl, kind} como una URL suelta (compatibilidad)
const ImageViewer = ({ src, onClose }) => {
  if (!src) return null;
  const media = typeof src === "string" ? { dataUrl: src, kind: "image" } : src;
  const isVideo = media.kind === "video";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {isVideo
        ? <video src={media.dataUrl} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "88vh", borderRadius: 12, background: "#000" }} />
        : <img src={media.dataUrl} alt="Foto" style={{ maxWidth: "100%", maxHeight: "92vh", borderRadius: 12 }} />}
      <button onClick={onClose} style={{ position: "fixed", top: 18, right: 18, color: "#fff", background: "rgba(0,0,0,.5)", borderRadius: 999, padding: 8 }}><X size={20} /></button>
    </div>
  );
};

// mode: "photo" | "video" | "both"
const AttachButton = ({ onAttached, onAdd, onError, label, mode = "photo" }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const cb = onAttached || onAdd;
  const accept = mode === "video" ? "video/*" : mode === "both" ? "image/*,video/*" : "image/*";
  const Icon = mode === "video" ? Video : Camera;
  const text = label || (mode === "video" ? "Video" : mode === "both" ? "Foto/video" : "Foto");
  return (
    <>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const id = uid();
            if (f.type && f.type.startsWith("video")) {
              if (f.size > MAX_VIDEO_BYTES) {
                throw new Error(`El video pesa ${(f.size / 1048576).toFixed(1)} MB. Máximo 9 MB: recórtalo o baja la calidad de grabación.`);
              }
              const dataUrl = await readFileDataUrl(f);
              const poster = await videoPoster(dataUrl);
              const ok = await sSet(`attach:${id}`, { dataUrl, poster, kind: "video", date: todayISO() });
              if (!ok) throw new Error("No se pudo guardar el video en el servidor. Revisa la conexión.");
            } else {
              const dataUrl = await compressImage(f);
              const ok = await sSet(`attach:${id}`, { dataUrl, kind: "image", date: todayISO() });
              if (!ok) throw new Error("No se pudo guardar la foto en el servidor. Revisa la conexión.");
            }
            cb && cb(id);
          } catch (err) { onError && onError(err.message); }
          finally { setBusy(false); }
        }} />
      <Btn kind="line" small disabled={busy} onClick={() => ref.current && ref.current.click()}>
        <Icon size={14} /> {busy ? "Subiendo…" : text}
      </Btn>
    </>
  );
};

/* ============================================================
   Historial por ejercicio (la ficha que Harbiz no tiene)
   ============================================================ */
const ExHistorySheet = ({ open, onClose, exName, entries, onOpenImg }) => (
  <Sheet open={open} onClose={onClose} title={`Historial · ${exName}`} tall>
    {(!entries || entries.length === 0) ? (
      <Empty icon={History} title="Sin registros todavía" body="Cuando completes este ejercicio en una sesión, acá verás tus pesos, repeticiones, RIR y todos tus comentarios anteriores." />
    ) : (
      [...entries].reverse().map((en, i) => (
        <div key={i} style={{ padding: "13px 0", borderBottom: `1px solid ${P.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDateFull(en.date)}</div>
            <div style={{ fontSize: 12, color: P.faint }}>{en.dayName}</div>
          </div>
          {en.sets.filter((s) => s.done).map((s, j) => (
            <div key={j} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14, padding: "3px 0" }}>
              <TypeBadge type={s.type} />
              <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
              {s.rir !== "" && <span style={{ color: P.dim, fontSize: 12.5 }}>RIR {s.rir}</span>}
              {s.drops && s.drops.length > 0 && (
                <span style={{ color: SET_TYPES.drop.color, fontSize: 12.5 }}>
                  {s.drops.map((d) => `→ ${d.weight || "?"}×${d.reps || "?"}`).join(" ")}
                </span>
              )}
              {s.comment && <span style={{ color: P.ember2, fontSize: 12.5 }}>“{s.comment}”</span>}
            </div>
          ))}
          {en.comment && (
            <div style={{ marginTop: 7, fontSize: 13.5, color: P.ember2, background: "rgba(255,107,44,.07)",
              border: `1px solid rgba(255,107,44,.2)`, borderRadius: 10, padding: "8px 11px", lineHeight: 1.45 }}>
              <MessageSquare size={12} style={{ marginRight: 5, verticalAlign: -1 }} />{en.comment}
            </div>
          )}
          {en.attachIds && en.attachIds.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 9, overflowX: "auto" }}>
              {en.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={58} />)}
            </div>
          )}
        </div>
      ))
    )}
  </Sheet>
);

/* ============================================================
   Cronómetro de descanso, dentro de la propia serie
   ============================================================ */
const InlineRest = ({ timer, onAdjust, onDismiss }) => {
  const [, force] = useState(0);
  useEffect(() => { const iv = setInterval(() => force((x) => x + 1), 300); return () => clearInterval(iv); }, []);
  const firedRef = useRef(false);
  const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
  useEffect(() => {
    if (left <= 0 && !firedRef.current) { firedRef.current = true; beep(); }
  }, [left]);
  const frac = timer.total ? Math.min(1, Math.max(0, 1 - left / timer.total)) : 0;
  const over = left <= 0;
  const col = over ? P.green : P.ember;
  return (
    <div style={{ marginTop: 8, padding: "8px 9px", borderRadius: 10,
      background: over ? "rgba(99,214,140,.10)" : `${P.ember}12`, border: `1px solid ${over ? "rgba(99,214,140,.45)" : `${P.ember}44`}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Timer size={16} color={col} className={over ? "" : "pulse"} />
        <span style={{ fontSize: 11.5, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
          {over ? "Listo para la siguiente" : "Descanso"}
        </span>
        <div style={{ flex: 1 }} />
        <span className="disp" style={{ fontSize: 22, fontWeight: 700, color: col }}>{fmtClock(left)}</span>
      </div>
      <div style={{ height: 4, background: P.s3, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${frac * 100}%`, background: `linear-gradient(90deg, ${P.ember}, ${P.ember2})`, transition: "width .3s linear" }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
        <Btn kind="line" small onClick={() => onAdjust(-15)} style={{ flex: 1 }}>−15 s</Btn>
        <Btn kind="line" small onClick={() => onAdjust(15)} style={{ flex: 1 }}>+15 s</Btn>
        <Btn kind="line" small onClick={() => onAdjust(30)} style={{ flex: 1 }}>+30 s</Btn>
        <Btn kind={over ? "green" : "line"} small onClick={onDismiss} style={{ flex: 1 }}>{over ? "Ok" : "Saltar"}</Btn>
      </div>
    </div>
  );
};

/* ============================================================
   Fila de serie — la pieza central
   ============================================================ */
const SetRow = ({ set, idx, last, suggest, onPatch, onToggleDone, onInfo, onOpenImg, restSec, timer, onStartRest, onAdjustRest, onDismissRest }) => {
  const [showCmt, setShowCmt] = useState(false);
  const done = set.done;
  const inp = (field, ph, w) => (
    <input type="number" inputMode="decimal" step="any" placeholder={ph} value={set[field]}
      onChange={(e) => onPatch({ [field]: e.target.value })}
      style={{ width: w, padding: "9px 4px", textAlign: "center", fontWeight: 600, fontSize: 15,
        background: done ? "rgba(99,214,140,.07)" : P.s3, borderColor: done ? "rgba(99,214,140,.35)" : P.line }} />
  );
  const coachNote = set.coachNote || "";
  const coachAttachIds = set.coachAttachIds || [];
  return (
    <div className={done ? "quench" : ""} style={{ borderRadius: 12, padding: "8px 8px 8px 10px", marginBottom: 6,
      background: done ? "rgba(99,214,140,.10)" : P.s2, border: `1px solid ${done ? "rgba(99,214,140,.3)" : P.line}` }}>
      {(coachNote || coachAttachIds.length > 0 || set.coachVideo) && (
        <div style={{ marginBottom: 7, padding: "7px 9px", background: `${P.ember}12`, border: `1px solid ${P.ember}33`, borderRadius: 8 }}>
          {coachNote && <div style={{ fontSize: 12.5, color: P.ember2, lineHeight: 1.4 }}>{coachNote}</div>}
          {set.coachVideo && (
            <a href={set.coachVideo} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: P.blue, fontWeight: 600, marginTop: coachNote ? 5 : 0 }}>
              <Video size={13} /> Ver técnica de esta serie
            </a>
          )}
          {coachAttachIds.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: (coachNote || set.coachVideo) ? 6 : 0, overflowX: "auto" }}>
              {coachAttachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={44} />)}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 11, color: P.faint, fontWeight: 700 }}>{idx + 1}</span>
          <TypeBadge type={set.type} onInfo={() => onInfo(SET_TYPES[set.type]?.g)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {inp("weight", "kg", "31%")}
            <span style={{ color: P.faint, fontSize: 12 }}>×</span>
            {inp("reps", set.repsT || "reps", "27%")}
            {inp("rir", set.rirT !== "" ? `RIR ${set.rirT}` : "RIR", "27%")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11.5, color: P.faint, flexWrap: "wrap" }}>
            <span>Meta: {set.repsT || "—"} reps{set.rirT !== "" ? ` @ RIR ${set.rirT}` : ""}</span>
            {last && (
              <button onClick={() => onPatch({ weight: last.weight, reps: last.reps, rir: last.rir })}
                style={{ color: P.blue, fontWeight: 600 }}>
                Anterior: {last.weight !== "" ? `${kg(+last.weight)} kg` : "—"} × {last.reps || "—"}{last.rir !== "" ? ` @${last.rir}` : ""} ⟲
              </button>
            )}
            {suggest != null && set.weight === "" && (
              <button onClick={() => onPatch({ weight: String(suggest) })} style={{ color: P.ember2, fontWeight: 600 }}>
                Sugerido: {kg(suggest)} kg (−{set.pct || 15} %)
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={() => setShowCmt((v) => !v)} title="Comentario de la serie"
            style={{ padding: 5, color: set.comment ? P.ember2 : P.faint }}>
            <MessageSquare size={16} fill={set.comment ? "rgba(255,184,107,.25)" : "none"} />
          </button>
          <button onClick={() => onStartRest && onStartRest()} title={`Iniciar descanso de ${restSec}s`}
            style={{ padding: 5, color: timer ? P.ember : P.faint }}>
            <Timer size={16} />
          </button>
        </div>
        <button onClick={onToggleDone} title={done ? "Desmarcar" : "Serie completada"}
          style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
            background: done ? P.green : P.s3, color: done ? "#0D2415" : P.dim,
            border: `1px solid ${done ? P.green : P.line}` }}>
          <Check size={19} strokeWidth={3} />
        </button>
      </div>
      {set.type === "drop" && (
        <div style={{ marginTop: 7, paddingLeft: 37 }}>
          {(set.drops || []).map((d, di) => (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: SET_TYPES.drop.color, fontWeight: 700 }}>↓{di + 1}</span>
              <input type="number" inputMode="decimal" step="any" placeholder="kg" value={d.weight}
                onChange={(e) => onPatch({ drops: set.drops.map((x, xi) => xi === di ? { ...x, weight: e.target.value } : x) })}
                style={{ width: 74, padding: "7px 4px", textAlign: "center", fontSize: 14 }} />
              <span style={{ color: P.faint, fontSize: 12 }}>×</span>
              <input type="number" inputMode="numeric" placeholder="reps" value={d.reps}
                onChange={(e) => onPatch({ drops: set.drops.map((x, xi) => xi === di ? { ...x, reps: e.target.value } : x) })}
                style={{ width: 66, padding: "7px 4px", textAlign: "center", fontSize: 14 }} />
              <button onClick={() => onPatch({ drops: set.drops.filter((_, xi) => xi !== di) })} style={{ color: P.faint, padding: 5 }}><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => onPatch({ drops: [...(set.drops || []), { weight: "", reps: "" }] })}
            style={{ color: SET_TYPES.drop.color, fontSize: 12.5, fontWeight: 600 }}>+ Añadir caída</button>
        </div>
      )}
      {showCmt && (
        <div style={{ marginTop: 7, paddingLeft: 37 }}>
          <Inp placeholder={`Comentario de la serie ${idx + 1} (queda en tu historial)`} value={set.comment}
            onChange={(e) => onPatch({ comment: e.target.value })} style={{ fontSize: 13.5 }} />
        </div>
      )}
      {timer && <InlineRest timer={timer} onAdjust={onAdjustRest} onDismiss={onDismissRest} />}
    </div>
  );
};

/* ============================================================
   Tarjeta de ejercicio en sesión
   ============================================================ */
const SessionExercise = ({ ex, exIdx, history, onPatchEx, onPatchSet, onSetDone, onInfo, onError, onOpenImg, timer, onStartRest, onAdjustRest, onDismissRest }) => {
  const [open, setOpen] = useState(exIdx === 0);
  const [hist, setHist] = useState(false);
  const entries = (history.byEx[ex.id] || []);
  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  const doneCount = ex.sets.filter((s) => s.done).length;
  const complete = doneCount === ex.sets.length && ex.sets.length > 0;

  const topWeight = useMemo(() => {
    const tops = ex.sets.filter((s) => s.type === "top" && s.weight !== "");
    return tops.length ? Math.max(...tops.map((s) => +s.weight)) : null;
  }, [ex.sets]);
  const suggestFor = (s) => {
    if (s.type !== "backoff" || topWeight == null) return null;
    const v = topWeight * (1 - (s.pct || 15) / 100);
    return Math.round(v / 0.5) * 0.5;
  };
  const lastNote = lastEntry && (lastEntry.comment || (lastEntry.sets || []).some((s) => s.comment));

  return (
    <Card style={{ marginBottom: 12, overflow: "hidden", borderColor: complete ? "rgba(99,214,140,.35)" : P.line }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: complete ? "rgba(99,214,140,.15)" : P.s2, color: complete ? P.green : P.dim, border: `1px solid ${complete ? "rgba(99,214,140,.4)" : P.line}`, fontWeight: 700, fontSize: 14 }}>
          {complete ? <Check size={17} strokeWidth={3} /> : exIdx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25 }}>{ex.name}</div>
          <div style={{ fontSize: 12, color: P.faint, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{ex.muscle}</span><span>· {ex.sets.length} series</span><span>· descanso {fmtClock(ex.rest || 120)}</span>
            {ex.superset && <span style={{ color: P.blue }}>· superserie</span>}
          </div>
        </div>
        <span style={{ fontSize: 12.5, color: P.dim, fontWeight: 600 }}>{doneCount}/{ex.sets.length}</span>
        {open ? <ChevronUp size={17} color={P.faint} /> : <ChevronDown size={17} color={P.faint} />}
      </button>

      {open && (
        <div style={{ padding: "0 12px 13px" }}>
          {ex.notes && (
            <div style={{ fontSize: 13.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, padding: "9px 12px", marginBottom: 9, lineHeight: 1.45 }}>
              <span style={{ color: P.ember2, fontWeight: 700 }}>Coach · </span>{ex.notes}
            </div>
          )}
          {ex.superset && (
            <div style={{ fontSize: 12.5, color: P.blue, marginBottom: 9 }}>⇄ En superserie con <b>{ex.superset}</b> (descansa al terminar ambos) <button onClick={() => onInfo("superset")} style={{ color: P.blue, textDecoration: "underline" }}>¿qué es?</button></div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <Btn kind={lastNote ? "ghost" : "line"} small onClick={() => setHist(true)}
              style={lastNote ? { borderColor: "rgba(255,184,107,.5)", color: P.ember2 } : {}}>
              <History size={14} /> Historial y notas{entries.length ? ` (${entries.length})` : ""}
            </Btn>
            {ex.video && <Btn kind="line" small onClick={() => window.open(ex.video, "_blank")}><Video size={14} /> Ver técnica</Btn>}
            <AttachButton mode="both" onAttached={(id) => onPatchEx({ attachIds: [...(ex.attachIds || []), id] })} onError={onError} />
          </div>

          {(ex.coachAttachIds || []).length > 0 && (
            <div style={{ marginBottom: 10, padding: "8px 10px", background: `${P.ember}12`, border: `1px solid ${P.ember}33`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Demostración del coach</div>
              <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
                {(ex.coachAttachIds || []).map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={62} />)}
              </div>
            </div>
          )}

          {ex.sets.map((s, si) => (
            <SetRow key={s.id} set={s} idx={si}
              restSec={(s.rest != null && s.rest !== "" ? +s.rest : (ex.rest || 90))}
              timer={timer && timer.exIdx === exIdx && timer.setIdx === si ? timer : null}
              onStartRest={() => onStartRest(exIdx, si)}
              onAdjustRest={onAdjustRest}
              onDismissRest={onDismissRest}
              last={lastEntry && lastEntry.sets[si] && lastEntry.sets[si].done ? lastEntry.sets[si] : null}
              suggest={suggestFor(s)}
              onPatch={(patch) => onPatchSet(si, patch)}
              onToggleDone={() => onSetDone(si)}
              onInfo={onInfo} onOpenImg={onOpenImg} />
          ))}

          {(ex.attachIds || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 8, overflowX: "auto" }}>
              {ex.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={56} />)}
            </div>
          )}
          <Txt rows={2} placeholder="Comentario del ejercicio (sensaciones, molestias, ajustes…) — lo verás la próxima vez y lo verá tu coach"
            value={ex.comment} onChange={(e) => onPatchEx({ comment: e.target.value })} style={{ fontSize: 13.5, marginTop: 4 }} />
        </div>
      )}
      <ExHistorySheet open={hist} onClose={() => setHist(false)} exName={ex.name} entries={entries} onOpenImg={onOpenImg} />
    </Card>
  );
};

/* ============================================================
   Temporizador de descanso flotante
   ============================================================ */
const TrainTab = ({ plan, history, active, setActive, saveActive, finishSession, discardSession, onInfo, toast, savedAt }) => {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timer, setTimer] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const [previewDay, setPreviewDay] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);

  const startSession = (day) => {
    const snap = {
      id: uid(), dayId: day.id, dayName: day.name, startedAt: todayISO(),
      exs: day.exs.map((ex) => ({ ...ex, comment: "", attachIds: [],
        sets: ex.sets.map((s) => ({ ...s, weight: "", reps: "", rir: "", done: false, comment: "", drops: [] })) })),
    };
    setActive(snap); saveActive(snap);
    setPreviewDay(null);
  };

  if (!active && previewDay) {
    const d = previewDay;
    const totalSeries = d.exs.reduce((a, e) => a + e.sets.length, 0);
    return (
      <div style={{ padding: "16px 16px 30px" }}>
        <button onClick={() => setPreviewDay(null)} style={{ display: "flex", alignItems: "center", gap: 6, color: P.faint, fontSize: 13.5, marginBottom: 12, padding: "4px 0" }}>
          <ChevronLeft size={17} /> Volver a la lista
        </button>
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "0 0 4px" }}>{d.name}</h1>
        <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>{d.exs.length} ejercicios · {totalSeries} series efectivas. Aún no se ha creado sesión: revisa lo que toca y arranca cuando estés listo.</div>
        {d.exs.map((e, ei) => (
          <Card key={e.id} style={{ padding: "12px 13px", marginBottom: 9 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div className="disp" style={{ width: 26, height: 26, borderRadius: 7, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: P.ember2, flexShrink: 0, marginTop: 1 }}>{ei + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{e.name}</div>
                <div style={{ fontSize: 11.5, color: P.faint, marginTop: 2 }}>{e.muscle} · descanso {e.rest}s · {e.sets.length} series</div>
                {e.superset && <div style={{ fontSize: 11.5, color: P.ember2, marginTop: 3 }}>Superserie con {e.superset}</div>}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                  {e.sets.map((s, si) => (
                    <div key={s.id} style={{ fontSize: 11.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 7, padding: "3px 7px" }}>
                      S{si + 1}: {s.repsT} reps{s.rirT !== "" ? ` · RIR ${s.rirT}` : ""}
                    </div>
                  ))}
                </div>
                {e.notes && <div style={{ fontSize: 12.5, color: P.dim, marginTop: 7, lineHeight: 1.4, fontStyle: "italic" }}>{e.notes}</div>}
              </div>
            </div>
          </Card>
        ))}
        <div style={{ position: "sticky", bottom: 96, marginTop: 18, display: "flex", gap: 8 }}>
          <Btn kind="line" onClick={() => setPreviewDay(null)} style={{ flex: 1 }}><X size={16} /> Salir sin iniciar</Btn>
          <Btn kind="ember" onClick={() => startSession(d)} style={{ flex: 2 }}><Play size={16} /> Iniciar entrenamiento</Btn>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div style={{ padding: "18px 16px 30px" }}>
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Entrenar</h1>
        <div style={{ color: P.dim, fontSize: 14, marginBottom: 16 }}>Toca un día para ver los ejercicios. Solo cuando aprietes «Iniciar entrenamiento» se creará la sesión y empezarán los cronómetros.</div>
        {plan.days.length === 0 ? (
          <Empty icon={Dumbbell} title="Aún no hay rutina" body="Tu coach todavía no carga días de entrenamiento. Pídele que entre en modo Coach y arme el plan." />
        ) : plan.days.map((d, i) => {
          const lastDone = [...history.sessions].reverse().find((s) => s.dayId === d.id);
          return (
            <Card key={d.id} style={{ marginBottom: 10 }}>
              <button onClick={() => setPreviewDay(d)} style={{ width: "100%", textAlign: "left", padding: "15px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                <div className="disp" style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(140deg, ${P.ember}22, ${P.ember}0A)`, border: `1px solid ${P.ember}44`, color: P.ember, fontSize: 18, fontWeight: 700 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{d.name}</div>
                  <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>
                    {d.exs.length} ejercicios · {d.exs.reduce((a, e) => a + e.sets.length, 0)} series
                    {lastDone ? ` · última vez ${fmtDate(lastDone.date)}` : " · nunca realizada"}
                  </div>
                </div>
                <ChevronRight size={18} color={P.faint} />
              </button>
            </Card>
          );
        })}
      </div>
    );
  }

  const totalSets = active.exs.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = active.exs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const elapsedMin = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 60000);

  const patch = (fn) => { const next = fn(structuredClone(active)); setActive(next); saveActive(next); };
  const patchEx = (ei, p) => patch((a) => { Object.assign(a.exs[ei], p); return a; });
  const patchSet = (ei, si, p) => patch((a) => { Object.assign(a.exs[ei].sets[si], p); return a; });
  const restOf = (ei, si) => {
    const st = active.exs[ei].sets[si];
    return (st.rest != null && st.rest !== "" ? +st.rest : (active.exs[ei].rest || 90));
  };
  const startRest = (ei, si) => {
    const rest = restOf(ei, si) || 90;
    setTimer({ exIdx: ei, setIdx: si, endsAt: Date.now() + rest * 1000, total: rest });
  };
  const adjustRest = (d) => setTimer((t) => {
    if (!t) return t;
    const endsAt = Math.max(Date.now() + 1000, t.endsAt + d * 1000);
    return { ...t, endsAt, total: Math.max(5, t.total + d) };
  });
  const toggleDone = (ei, si) => {
    const willDone = !active.exs[ei].sets[si].done;
    patch((a) => { a.exs[ei].sets[si].done = willDone; return a; });
    if (willDone) {
      const rest = restOf(ei, si);
      const lastSet = si === active.exs[ei].sets.length - 1;
      if (rest > 0 && (!lastSet || !active.exs[ei].superset)) startRest(ei, si);
    } else if (timer && timer.exIdx === ei && timer.setIdx === si) {
      setTimer(null);
    }
  };

  const doFinish = () => {
    setConfirmFinish(false);
    const res = finishSession(active);
    setTimer(null);
    setSummary(res);
  };

  return (
    <div style={{ paddingBottom: 30 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: `${P.bg}F2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${P.line}`, padding: "10px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.dayName}</div>
            <div style={{ fontSize: 12, color: P.dim, display: "flex", gap: 10, alignItems: "center" }}>
              <span>{elapsedMin} min</span><span>{doneSets}/{totalSets} series</span>
              <span style={{ color: storageOK ? P.green : P.red, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: storageOK ? P.green : P.red }} />
                {storageOK ? (savedAt ? `Guardado ${savedAt}` : "Guardado") : "Sin guardado"}
              </span>
            </div>
          </div>
          <Btn kind="ember" small onClick={() => setConfirmFinish(true)}>Terminar</Btn>
        </div>
        <div style={{ height: 5, background: P.s2, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
            background: `linear-gradient(90deg, ${P.ember}, ${P.ember2})`, transition: "width .35s ease", borderRadius: 3 }} />
        </div>
      </div>

      <div style={{ padding: "14px 14px 0" }}>
        {active.exs.map((ex, ei) => (
          <SessionExercise key={ex.id} ex={ex} exIdx={ei} history={history}
            onPatchEx={(p) => patchEx(ei, p)} onPatchSet={(si, p) => patchSet(ei, si, p)}
            onSetDone={(si) => toggleDone(ei, si)} onInfo={onInfo} onError={toast} onOpenImg={setViewImg}
            timer={timer} onStartRest={startRest} onAdjustRest={adjustRest} onDismissRest={() => setTimer(null)} />
        ))}
        <Btn kind="line" onClick={() => setConfirmDiscard(true)} style={{ width: "100%", marginTop: 8, color: P.faint }}>
          <Trash2 size={15} /> Descartar sesión (no guarda nada)
        </Btn>
      </div>

      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />

      <Confirm open={confirmFinish} title="Terminar sesión"
        body={doneSets < totalSets ? `Llevas ${doneSets} de ${totalSets} series marcadas. Se guardará todo lo registrado hasta ahora en tu historial.` : "¡Sesión completa! Se guardará todo en tu historial."}
        okLabel="Terminar y guardar" onOk={doFinish} onCancel={() => setConfirmFinish(false)} />
      <Confirm open={confirmDiscard} danger title="Descartar sesión"
        body="Se borrará todo lo registrado en esta sesión y no quedará en el historial. Esta acción no se puede deshacer."
        okLabel="Descartar" onOk={() => { setConfirmDiscard(false); setTimer(null); discardSession(); }} onCancel={() => setConfirmDiscard(false)} />

      <Sheet open={!!summary} onClose={() => setSummary(null)} title="Sesión guardada">
        {summary && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["Duración", `${summary.durationMin} min`], ["Series", `${summary.setsDone}/${summary.setsTotal}`], ["Tonelaje", `${Math.round(summary.volume).toLocaleString("es-CL")} kg`]].map(([l, v]) => (
                <Card key={l} style={{ padding: "12px 8px", textAlign: "center", background: P.s2 }}>
                  <div className="disp" style={{ fontSize: 21, fontWeight: 700, color: P.ember2 }}>{v}</div>
                  <div style={{ fontSize: 11.5, color: P.dim, marginTop: 2 }}>{l}</div>
                </Card>
              ))}
            </div>
            {summary.prs.length > 0 && (
              <div style={{ background: "rgba(255,107,44,.08)", border: `1px solid ${P.ember}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: P.ember2, marginBottom: 6 }}><Award size={15} style={{ verticalAlign: -2, marginRight: 5 }} />Récords personales de peso</div>
                {summary.prs.map((p) => <div key={p} style={{ fontSize: 14, color: P.text, padding: "2px 0" }}>• {p}</div>)}
              </div>
            )}
            <div style={{ fontSize: 13.5, color: P.dim, lineHeight: 1.5 }}>Todo quedó en tu historial: pesos, repeticiones, RIR, comentarios y fotos. La próxima vez que hagas estos ejercicios los verás como referencia.</div>
            <Btn kind="ember" onClick={() => setSummary(null)} style={{ width: "100%", marginTop: 16 }}>Listo</Btn>
          </div>
        )}
      </Sheet>
    </div>
  );
};

/* ============================================================
   Hoy (inicio del alumno)
   ============================================================ */
const TodayTab = ({ plan, history, active, goTrain, role }) => {
  const [showInstr, setShowInstr] = useState(false);
  const wk = weekKey(todayISO());
  const weekSessions = history.sessions.filter((s) => weekKey(s.date) === wk);
  const weekVol = weekSessions.reduce((a, s) => a + s.volume, 0);
  const lastSession = history.sessions[history.sessions.length - 1];
  let suggested = plan.days[0];
  if (lastSession) {
    const i = plan.days.findIndex((d) => d.id === lastSession.dayId);
    suggested = plan.days[(i + 1) % Math.max(plan.days.length, 1)] || plan.days[0];
  }
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Logo />
        <div style={{ fontSize: 12, color: P.faint, textAlign: "right" }}>{fmtDateFull(todayISO())}</div>
      </div>

      {active ? (
        <Card style={{ padding: 16, marginBottom: 14, borderColor: `${P.ember}66`, background: `linear-gradient(160deg, rgba(255,107,44,.10), ${P.s1})` }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 4 }}>Tienes una sesión en curso</div>
          <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 12 }}>{active.dayName} — todos tus datos están guardados. Puedes retomarla exactamente donde quedaste, aunque cierres la app.</div>
          <Btn kind="ember" onClick={goTrain} style={{ width: "100%" }}><Play size={16} /> Continuar sesión</Btn>
        </Card>
      ) : suggested ? (
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Te toca</div>
          <div className="disp" style={{ fontSize: 21, fontWeight: 700, marginBottom: 3 }}>{suggested.name}</div>
          <div style={{ fontSize: 13, color: P.faint, marginBottom: 12 }}>{suggested.exs.length} ejercicios · {suggested.exs.reduce((a, e) => a + e.sets.length, 0)} series</div>
          <Btn kind="ember" onClick={goTrain} style={{ width: "100%" }}><Play size={16} /> Empezar a entrenar</Btn>
        </Card>
      ) : (
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <Empty icon={Dumbbell} title="Sin rutina cargada" body={role === "coach" ? "Entra a la pestaña Rutina para armar el plan." : "Tu coach aún no carga la rutina."} />
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Sesiones esta semana", weekSessions.length], ["Tonelaje semanal", `${Math.round(weekVol / 1000 * 10) / 10} t`], ["Sesiones totales", history.sessions.length]].map(([l, v]) => (
          <Card key={l} style={{ padding: "12px 8px", textAlign: "center" }}>
            <div className="disp" style={{ fontSize: 20, fontWeight: 700, color: P.ember2 }}>{v}</div>
            <div style={{ fontSize: 10.5, color: P.dim, marginTop: 3, lineHeight: 1.3 }}>{l}</div>
          </Card>
        ))}
      </div>

      {plan.instructions.length > 0 && (
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <button onClick={() => setShowInstr(true)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardList size={18} color={P.ember2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Indicaciones del coach</div>
              <div style={{ fontSize: 12.5, color: P.faint }}>{plan.instructions.length} indicaciones generales del plan</div>
            </div>
            <ChevronRight size={16} color={P.faint} />
          </button>
        </Card>
      )}

      {lastSession && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Última sesión</div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{lastSession.dayName}</div>
          <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>
            {fmtDateFull(lastSession.date)} · {lastSession.durationMin} min · {Math.round(lastSession.volume).toLocaleString("es-CL")} kg
            {lastSession.prs.length > 0 && <span style={{ color: P.ember2 }}> · {lastSession.prs.length} PR</span>}
          </div>
        </Card>
      )}

      <Sheet open={showInstr} onClose={() => setShowInstr(false)} title="Indicaciones del coach">
        {plan.instructions.map((it) => (
          <div key={it.id} style={{ padding: "12px 0", borderBottom: `1px solid ${P.line}` }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.title}</div>
            <div style={{ fontSize: 14, color: P.dim, lineHeight: 1.55 }}>{it.body}</div>
          </div>
        ))}
      </Sheet>
    </div>
  );
};

/* ============================================================
   Progreso: sesiones, por ejercicio, cuerpo
   ============================================================ */
const ChartBox = ({ data, unit }) => (
  <div style={{ width: "100%", height: 210 }}>
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={P.line} strokeDasharray="3 3" />
        <XAxis dataKey="d" tick={{ fill: P.faint, fontSize: 11 }} stroke={P.line} />
        <YAxis tick={{ fill: P.faint, fontSize: 11 }} stroke={P.line} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, fontSize: 13 }}
          labelStyle={{ color: P.dim }} itemStyle={{ color: P.ember2 }} formatter={(v) => [`${v} ${unit}`, ""]} />
        <Line type="monotone" dataKey="v" stroke={P.ember} strokeWidth={2.5} dot={{ r: 3, fill: P.ember2, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const SessionDetailSheet = ({ session, onClose, history, onOpenImg }) => (
  <Sheet open={!!session} onClose={onClose} title={session ? session.dayName : ""} tall>
    {session && (
      <div>
        <div style={{ fontSize: 13, color: P.dim, marginBottom: 12 }}>
          {fmtDateFull(session.date)} · {session.durationMin} min · {Math.round(session.volume).toLocaleString("es-CL")} kg totales
        </div>
        {session.exs.map((e) => {
          const entry = (history.byEx[e.exId] || []).find((en) => en.sessionId === session.id);
          if (!entry) return null;
          return (
            <div key={e.exId} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 5 }}>{e.name}</div>
              {entry.sets.filter((s) => s.done).map((s, j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13.5, padding: "2px 0" }}>
                  <TypeBadge type={s.type} />
                  <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
                  {s.rir !== "" && <span style={{ color: P.dim, fontSize: 12 }}>RIR {s.rir}</span>}
                  {s.comment && <span style={{ color: P.ember2, fontSize: 12 }}>“{s.comment}”</span>}
                </div>
              ))}
              {entry.comment && <div style={{ fontSize: 13, color: P.ember2, marginTop: 4 }}>💬 {entry.comment}</div>}
              {entry.attachIds && entry.attachIds.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 6, overflowX: "auto" }}>
                  {entry.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={52} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </Sheet>
);

const ProgressTab = ({ plan, history, saveHistory }) => {
  const [sub, setSub] = useState("ex");
  const [exId, setExId] = useState("");
  const [openSession, setOpenSession] = useState(null);
  const [bw, setBw] = useState("");
  const [viewImg, setViewImg] = useState(null);
  const [err, setErr] = useState("");

  const allEx = useMemo(() => {
    const m = new Map();
    plan.days.forEach((d) => d.exs.forEach((e) => m.set(e.id, e.name)));
    Object.keys(history.byEx).forEach((id) => {
      if (!m.has(id) && history.byEx[id].length) m.set(id, history.byEx[id][history.byEx[id].length - 1].exName || "Ejercicio");
    });
    return [...m.entries()];
  }, [plan, history]);
  useEffect(() => { if (!exId && allEx.length) setExId(allEx[0][0]); }, [allEx, exId]);

  const exData = (history.byEx[exId] || []).map((en) => {
    const done = en.sets.filter((s) => s.done && s.weight !== "");
    const best = done.length ? Math.max(...done.map((s) => +s.weight)) : null;
    return best != null ? { d: fmtDate(en.date), v: best } : null;
  }).filter(Boolean);

  const bwData = history.bodyweight.map((b) => ({ d: fmtDate(b.date), v: b.kg }));

  const addBW = () => {
    const v = parseFloat(String(bw).replace(",", "."));
    if (!v || v <= 0) { setErr("Ingresa un peso válido en kg."); return; }
    setErr("");
    const h = structuredClone(history);
    h.bodyweight.push({ date: todayISO(), kg: v });
    saveHistory(h); setBw("");
  };

  const subBtn = (id, label) => (
    <button onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
      background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{label}</button>
  );

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Progreso</h1>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {subBtn("ex", "Ejercicios")}{subBtn("ses", "Sesiones")}{subBtn("body", "Cuerpo")}
      </div>

      {sub === "ex" && (
        <div>
          <select value={exId} onChange={(e) => setExId(e.target.value)} style={{ width: "100%", padding: "11px 12px", marginBottom: 12 }}>
            {allEx.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {exData.length === 0 ? (
            <Empty icon={TrendingUp} title="Sin datos aún" body="Cuando registres este ejercicio en una sesión, acá verás la curva de tu mejor peso por día." />
          ) : (
            <Card style={{ padding: "14px 8px 6px" }}>
              <div style={{ fontSize: 12.5, color: P.dim, padding: "0 10px 6px" }}>Mejor peso por sesión (kg)</div>
              <ChartBox data={exData} unit="kg" />
            </Card>
          )}
          {(history.byEx[exId] || []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Registro completo</div>
              <ExHistorySheetInline entries={history.byEx[exId]} onOpenImg={setViewImg} />
            </div>
          )}
        </div>
      )}

      {sub === "ses" && (
        history.sessions.length === 0 ? (
          <Empty icon={History} title="Sin sesiones guardadas" body="Termina tu primera sesión en la pestaña Entrenar y aparecerá acá con todo el detalle." />
        ) : (
          [...history.sessions].reverse().map((s) => (
            <Card key={s.id} style={{ marginBottom: 10 }}>
              <button onClick={() => setOpenSession(s)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.dayName}</div>
                  <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>
                    {fmtDateFull(s.date)} · {s.durationMin} min · {s.setsDone}/{s.setsTotal} series · {Math.round(s.volume).toLocaleString("es-CL")} kg
                  </div>
                </div>
                {s.prs.length > 0 && <Award size={16} color={P.ember2} />}
                <ChevronRight size={16} color={P.faint} />
              </button>
            </Card>
          ))
        )
      )}

      {sub === "body" && (
        <div>
          <Card style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Peso corporal</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Inp type="number" inputMode="decimal" step="any" placeholder="kg de hoy" value={bw} onChange={(e) => setBw(e.target.value)} />
              <Btn kind="ember" onClick={addBW}><Plus size={16} /> Registrar</Btn>
            </div>
            {err && <div style={{ color: P.red, fontSize: 12.5, marginTop: 6 }}>{err}</div>}
            {bwData.length > 1 && <div style={{ marginTop: 10 }}><ChartBox data={bwData} unit="kg" /></div>}
            {bwData.length === 1 && <div style={{ fontSize: 13, color: P.faint, marginTop: 10 }}>Último registro: {bwData[0].v} kg ({bwData[0].d}). Con dos o más registros verás la curva.</div>}
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>Fotos de progreso ({history.bodyPhotos.length})</div>
              <AttachButton onError={setErr} label="Subir" onAttached={(id) => { const h = structuredClone(history); h.bodyPhotos.push({ id, date: todayISO() }); saveHistory(h); }} />
            </div>
            {history.bodyPhotos.length === 0 ? (
              <div style={{ fontSize: 13, color: P.faint }}>Sube una foto cada 2–4 semanas, con la misma luz y pose, para comparar tu recomposición. Puedes subir todas las que necesites.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[...history.bodyPhotos].reverse().map((p) => (
                  <div key={p.id} style={{ textAlign: "center" }}>
                    <AttachThumb id={p.id} onOpen={setViewImg} size={96}
                      onRemove={() => { const h = structuredClone(history); h.bodyPhotos = h.bodyPhotos.filter((x) => x.id !== p.id); saveHistory(h); }} />
                    <div style={{ fontSize: 11, color: P.faint, marginTop: 3 }}>{fmtDate(p.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <SessionDetailSheet session={openSession} onClose={() => setOpenSession(null)} history={history} onOpenImg={setViewImg} />
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

// Versión inline (no sheet) del historial por ejercicio, reutilizada en Progreso y Actividad
const ExHistorySheetInline = ({ entries, onOpenImg }) => (
  <div>
    {[...entries].reverse().map((en, i) => (
      <Card key={i} style={{ padding: "11px 13px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{fmtDateFull(en.date)}</span>
          <span style={{ fontSize: 11.5, color: P.faint }}>{en.dayName}</span>
        </div>
        {en.sets.filter((s) => s.done).map((s, j) => (
          <div key={j} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 13.5, padding: "2px 0" }}>
            <TypeBadge type={s.type} />
            <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
            {s.rir !== "" && <span style={{ color: P.dim, fontSize: 12 }}>RIR {s.rir}</span>}
            {s.comment && <span style={{ color: P.ember2, fontSize: 12 }}>“{s.comment}”</span>}
          </div>
        ))}
        {en.comment && <div style={{ fontSize: 12.5, color: P.ember2, marginTop: 4 }}>💬 {en.comment}</div>}
        {en.attachIds && en.attachIds.length > 0 && (
          <div style={{ display: "flex", gap: 7, marginTop: 6, overflowX: "auto" }}>
            {en.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={48} />)}
          </div>
        )}
      </Card>
    ))}
  </div>
);

/* ============================================================
   Nutrición (vista alumno)
   ============================================================ */
const NutritionView = ({ n }) => {
  const hasMacros = (+n.kcal || 0) > 0 || (+n.p || 0) > 0 || (+n.c || 0) > 0 || (+n.f || 0) > 0;
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Nutrición</h1>
      {hasMacros && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {[["kcal", n.kcal, P.ember2], ["Proteína", n.p ? `${n.p} g` : "—", P.green], ["Carbos", n.c ? `${n.c} g` : "—", P.blue], ["Grasas", n.f ? `${n.f} g` : "—", "#E8A54B"]].map(([l, v, c]) => (
            <Card key={l} style={{ padding: "11px 6px", textAlign: "center" }}>
              <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: c }}>{v || "—"}</div>
              <div style={{ fontSize: 10.5, color: P.dim, marginTop: 2 }}>{l}</div>
            </Card>
          ))}
        </div>
      )}
      {n.notes && <div style={{ fontSize: 13.5, color: P.dim, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: "11px 14px", lineHeight: 1.5, marginBottom: 14 }}>{n.notes}</div>}
      {n.meals.length === 0 ? (
        <Empty icon={Utensils} title="Sin plan de comidas" body="Tu coach aún no carga las comidas del plan." />
      ) : n.meals.map((m) => (
        <Card key={m.id} style={{ padding: "13px 15px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
            {m.time && <div style={{ fontSize: 12, color: P.faint }}>{m.time}</div>}
          </div>
          {m.items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderBottom: `1px dashed ${P.line}` }}>
              <span>{it.food}</span><span style={{ color: P.dim, fontWeight: 600 }}>{it.qty}</span>
            </div>
          ))}
          {m.notes && <div style={{ fontSize: 12.5, color: P.ember2, marginTop: 7 }}>{m.notes}</div>}
        </Card>
      ))}
    </div>
  );
};

/* ============================================================
   MODO COACH — constructor de rutina
   ============================================================ */
const SetsEditor = ({ sets, onChange, onInfo, exRest }) => {
  const [expanded, setExpanded] = useState(null);
  const [attachErr, setAttachErr] = useState("");
  const [preview, setPreview] = useState(null);
  const upd = (i, p) => onChange(sets.map((s, si) => (si === i ? { ...s, ...p } : s)));
  const toggleAttach = async (i, id) => {
    const s = sets[i]; const arr = s.coachAttachIds || [];
    upd(i, { coachAttachIds: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] });
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 5, fontSize: 10.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", padding: "0 2px 4px" }}>
        <span style={{ width: 88 }}>Tipo</span><span style={{ flex: 1, minWidth: 60 }}>Reps</span><span style={{ width: 42 }}>RIR</span><span style={{ width: 46 }}>Desc</span><span style={{ width: 42 }}>−%</span><span style={{ width: 26 }} />
      </div>
      {sets.map((s, i) => {
        const hasExtras = (s.coachNote || "").length > 0 || (s.coachAttachIds || []).length > 0;
        return (
          <div key={s.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <select value={s.type} onChange={(e) => upd(i, { type: e.target.value })} style={{ width: 88, padding: "8px 4px", fontSize: 12.5 }}>
                {Object.entries(SET_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
              <input placeholder="8-10" value={s.repsT} onChange={(e) => upd(i, { repsT: e.target.value })} style={{ flex: 1, minWidth: 60, padding: "8px 6px", fontSize: 14 }} />
              <input placeholder="2" value={s.rirT} onChange={(e) => upd(i, { rirT: e.target.value })} style={{ width: 42, padding: "8px 4px", fontSize: 14, textAlign: "center" }} />
              <input type="number" inputMode="numeric" placeholder={String(exRest ?? 90)} value={s.rest ?? ""} title="Descanso de esta serie en segundos (vacío = usa el del ejercicio)"
                onChange={(e) => upd(i, { rest: e.target.value === "" ? undefined : (+e.target.value || 0) })}
                style={{ width: 46, padding: "8px 4px", fontSize: 13, textAlign: "center" }} />
              <input type="number" inputMode="numeric" placeholder="15" disabled={s.type !== "backoff"} value={s.type === "backoff" ? (s.pct ?? 15) : ""}
                onChange={(e) => upd(i, { pct: +e.target.value || 15 })}
                style={{ width: 42, padding: "8px 4px", fontSize: 13, textAlign: "center", opacity: s.type === "backoff" ? 1 : 0.35 }} />
              <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ color: hasExtras ? P.ember : P.faint, padding: 4 }} title="Nota y adjuntos de esta serie">
                <MessageSquare size={15} />
              </button>
              <button onClick={() => onChange(sets.filter((_, si) => si !== i))} style={{ color: P.faint, padding: 4 }}><Trash2 size={15} /></button>
            </div>
            {expanded === i && (
              <div style={{ marginTop: 6, padding: "10px 11px", background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Nota específica de la serie {i + 1}</div>
                <Txt rows={2} placeholder="Ej: solo en esta serie usa banco a 30°" value={s.coachNote || ""}
                  onChange={(e) => upd(i, { coachNote: e.target.value })} />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Enlace de video (YouTube, Drive, Instagram…)</div>
                  <Inp placeholder="https://…" value={s.coachVideo || ""} onChange={(e) => upd(i, { coachVideo: e.target.value })} style={{ fontSize: 13 }} />
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <AttachButton mode="photo" onAdd={(id) => toggleAttach(i, id)} onError={setAttachErr} />
                  <AttachButton mode="video" onAdd={(id) => toggleAttach(i, id)} onError={setAttachErr} />
                  {(s.coachAttachIds || []).length > 0 && (
                    <div style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1, minWidth: 0 }}>
                      {(s.coachAttachIds || []).map((id) => <AttachThumb key={id} id={id} onOpen={setPreview} onRemove={() => toggleAttach(i, id)} size={40} />)}
                    </div>
                  )}
                </div>
                {attachErr && <div style={{ fontSize: 11.5, color: P.red, marginTop: 6, lineHeight: 1.4 }}>{attachErr}</div>}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        <Btn kind="line" small onClick={() => onChange([...sets, { id: uid(), type: "normal", repsT: "8-10", rirT: "2", pct: 15 }])}><Plus size={14} /> Serie</Btn>
        {sets.length > 0 && <Btn kind="line" small onClick={() => onChange([...sets, { ...sets[sets.length - 1], id: uid() }])}><Copy size={14} /> Duplicar última</Btn>}
        <Btn kind="line" small onClick={() => onInfo("topset")}><Info size={14} /> Tipos</Btn>
      </div>
      <div style={{ fontSize: 11.5, color: P.faint, marginTop: 6, lineHeight: 1.4 }}>
        <b>Desc</b>: segundos de descanso de esa serie (déjalo vacío para usar el del ejercicio). <b>−%</b> solo aplica a back-offs: la app sugiere el peso desde el top set. Icono 💬: nota, video y adjuntos específicos de esa serie.
      </div>
      <ImageViewer src={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

const ExerciseEditorSheet = ({ ex, onSave, onClose, onInfo }) => {
  const [d, setD] = useState(ex);
  const [attachErr, setAttachErr] = useState("");
  const [preview, setPreview] = useState(null);
  useEffect(() => { setD(ex); setAttachErr(""); }, [ex]);
  if (!ex) return null;
  const set = (p) => setD((x) => ({ ...x, ...p }));
  return (
    <Sheet open={!!ex} onClose={onClose} title={ex.isNew ? "Nuevo ejercicio" : "Editar ejercicio"} tall>
      <Field label="Nombre del ejercicio"><Inp value={d.name} placeholder="Ej: Jalón al pecho bilateral en polea" onChange={(e) => set({ name: e.target.value })} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Grupo muscular">
          <select value={d.muscle} onChange={(e) => set({ muscle: e.target.value })} style={{ width: "100%", padding: "10px 10px" }}>
            {MUSCLES.map((m) => <option key={m}>{m}</option>)}
          </select></Field></div>
        <div style={{ width: 130 }}><Field label="Descanso ejercicio (seg)"><Inp type="number" inputMode="numeric" value={d.rest} onChange={(e) => set({ rest: +e.target.value || 0 })} /></Field></div>
      </div>
      <Field label="Series"><SetsEditor sets={d.sets} onChange={(sets) => set({ sets })} onInfo={onInfo} exRest={d.rest} /></Field>
      <Field label="Indicaciones técnicas (las verá el alumno en cada sesión)"><Txt value={d.notes} placeholder="Ej: agarre neutro, controla 3 s la bajada, pausa de 1 s abajo…" onChange={(e) => set({ notes: e.target.value })} /></Field>
      <Field label="Video de técnica (link opcional)"><Inp value={d.video} placeholder="https://youtube.com/…" onChange={(e) => set({ video: e.target.value })} /></Field>
      <Field label="Videos y fotos de demostración" hint="Se suben a la plataforma y el alumno los ve dentro del ejercicio. Videos hasta 9 MB.">
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <AttachButton mode="photo" onError={setAttachErr} onAdd={(id) => set({ coachAttachIds: [...(d.coachAttachIds || []), id] })} />
          <AttachButton mode="video" onError={setAttachErr} onAdd={(id) => set({ coachAttachIds: [...(d.coachAttachIds || []), id] })} />
        </div>
        {(d.coachAttachIds || []).length > 0 && (
          <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 9 }}>
            {(d.coachAttachIds || []).map((id) => (
              <AttachThumb key={id} id={id} size={58} onOpen={setPreview}
                onRemove={() => set({ coachAttachIds: (d.coachAttachIds || []).filter((x) => x !== id) })} />
            ))}
          </div>
        )}
        {attachErr && <div style={{ fontSize: 11.5, color: P.red, marginTop: 7, lineHeight: 1.4 }}>{attachErr}</div>}
      </Field>
      <Field label="En superserie con (opcional)" hint="Escribe el nombre del otro ejercicio; el descanso corre al terminar ambos.">
        <Inp value={d.superset} placeholder="Ej: Curl martillo con mancuernas" onChange={(e) => set({ superset: e.target.value })} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn kind="line" onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn kind="ember" disabled={!d.name.trim()} onClick={() => onSave(d)} style={{ flex: 2 }}>Guardar ejercicio</Btn>
      </div>
      <ImageViewer src={preview} onClose={() => setPreview(null)} />
    </Sheet>
  );
};

const RoutineTab = ({ plan, savePlan, onInfo }) => {
  const [openDay, setOpenDay] = useState(null);
  const [editEx, setEditEx] = useState(null); // {dayId, ex}
  const [del, setDel] = useState(null); // {type:'day'|'ex', dayId, exId, name}
  const mut = (fn) => { const p = structuredClone(plan); fn(p); p.updatedAt = todayISO(); savePlan(p); };
  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Rutina</h1>
      <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>Arma los días y ejercicios. Cada cambio se guarda solo y el alumno lo ve al instante.</div>

      {plan.days.map((d, di) => (
        <Card key={d.id} style={{ marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 12px" }}>
            <button onClick={() => setOpenDay(openDay === d.id ? null : d.id)} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
              <div style={{ fontSize: 12, color: P.faint }}>{d.exs.length} ejercicios · {d.exs.reduce((a, e) => a + e.sets.length, 0)} series</div>
            </button>
            <button onClick={() => move && mut((p) => move(p.days, di, -1))} style={{ padding: 6, color: P.faint }}><ArrowUp size={15} /></button>
            <button onClick={() => mut((p) => move(p.days, di, +1))} style={{ padding: 6, color: P.faint }}><ArrowDown size={15} /></button>
            <button onClick={() => { const name = prompt("Nombre del día:", d.name); if (name) mut((p) => { p.days[di].name = name; }); }} style={{ padding: 6, color: P.faint }}><PencilLine size={15} /></button>
            <button onClick={() => setDel({ type: "day", dayId: d.id, name: d.name })} style={{ padding: 6, color: P.faint }}><Trash2 size={15} /></button>
            <button onClick={() => setOpenDay(openDay === d.id ? null : d.id)} style={{ padding: 6, color: P.faint }}>{openDay === d.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
          {openDay === d.id && (
            <div style={{ padding: "0 12px 12px" }}>
              {d.exs.map((e, ei) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 11, padding: "9px 10px", marginBottom: 6 }}>
                  <button onClick={() => setEditEx({ dayId: d.id, ex: structuredClone(e) })} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: P.faint, display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                      {e.sets.map((s) => <TypeBadge key={s.id} type={s.type} />)}
                    </div>
                  </button>
                  <button onClick={() => mut((p) => move(p.days[di].exs, ei, -1))} style={{ padding: 5, color: P.faint }}><ArrowUp size={14} /></button>
                  <button onClick={() => mut((p) => move(p.days[di].exs, ei, +1))} style={{ padding: 5, color: P.faint }}><ArrowDown size={14} /></button>
                  <button onClick={() => mut((p) => { const c = structuredClone(e); c.id = uid(); c.sets.forEach((s) => (s.id = uid())); p.days[di].exs.splice(ei + 1, 0, c); })} style={{ padding: 5, color: P.faint }}><Copy size={14} /></button>
                  <button onClick={() => setDel({ type: "ex", dayId: d.id, exId: e.id, name: e.name })} style={{ padding: 5, color: P.faint }}><Trash2 size={14} /></button>
                </div>
              ))}
              <Btn kind="ghost" small onClick={() => setEditEx({ dayId: d.id, ex: { id: uid(), isNew: true, name: "", muscle: MUSCLES[0], rest: 120, video: "", superset: "", notes: "", sets: [{ id: uid(), type: "normal", repsT: "8-10", rirT: "2", pct: 15 }] } })} style={{ width: "100%" }}>
                <Plus size={15} /> Añadir ejercicio
              </Btn>
            </div>
          )}
        </Card>
      ))}
      <Btn kind="ember" onClick={() => mut((p) => p.days.push({ id: uid(), name: `Día ${p.days.length + 1}`, exs: [] }))} style={{ width: "100%" }}>
        <Plus size={16} /> Añadir día de entrenamiento
      </Btn>

      <ExerciseEditorSheet ex={editEx ? editEx.ex : null} onClose={() => setEditEx(null)} onInfo={onInfo}
        onSave={(exd) => { const { isNew, ...clean } = exd; mut((p) => { const day = p.days.find((x) => x.id === editEx.dayId);
          const i = day.exs.findIndex((x) => x.id === clean.id);
          if (i >= 0) day.exs[i] = clean; else day.exs.push(clean); }); setEditEx(null); }} />

      <Confirm open={!!del} danger title={del && del.type === "day" ? "Eliminar día" : "Eliminar ejercicio"}
        body={del ? `¿Eliminar «${del.name}» de la rutina? El historial del alumno no se borra.` : ""} okLabel="Eliminar"
        onCancel={() => setDel(null)}
        onOk={() => { mut((p) => { if (del.type === "day") p.days = p.days.filter((x) => x.id !== del.dayId);
          else { const day = p.days.find((x) => x.id === del.dayId); day.exs = day.exs.filter((x) => x.id !== del.exId); } }); setDel(null); }} />
    </div>
  );
};

/* ============================================================
   MODO COACH — nutrición e indicaciones
   ============================================================ */
const NutritionEditor = ({ plan, savePlan }) => {
  const n = plan.nutrition;
  const mut = (fn) => { const p = structuredClone(plan); fn(p.nutrition); p.updatedAt = todayISO(); savePlan(p); };
  const macro = (label, key, ph) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: P.dim, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>{label}</div>
      <Inp type="number" inputMode="numeric" placeholder={ph} value={n[key] || ""} onChange={(e) => mut((x) => (x[key] = e.target.value === "" ? "" : (+e.target.value || 0)))} style={{ textAlign: "center" }} />
    </div>
  );
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Nutrición</h1>
      <Card style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>{macro("KCAL", "kcal", "2500")}{macro("PROT (g)", "p", "180")}{macro("CARB (g)", "c", "280")}{macro("GRASA (g)", "f", "70")}</div>
        <div style={{ marginTop: 10 }}><Txt rows={2} placeholder="Notas generales del plan nutricional…" value={n.notes} onChange={(e) => mut((x) => (x.notes = e.target.value))} /></div>
      </Card>
      {n.meals.map((m, mi) => (
        <Card key={m.id} style={{ padding: 13, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Inp value={m.name} placeholder="Nombre de la comida" onChange={(e) => mut((x) => (x.meals[mi].name = e.target.value))} />
            <Inp value={m.time} placeholder="Hora" onChange={(e) => mut((x) => (x.meals[mi].time = e.target.value))} style={{ width: 90 }} />
            <button onClick={() => mut((x) => x.meals.splice(mi, 1))} style={{ color: P.faint }}><Trash2 size={16} /></button>
          </div>
          {m.items.map((it, ii) => (
            <div key={it.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <Inp value={it.food} placeholder="Alimento" onChange={(e) => mut((x) => (x.meals[mi].items[ii].food = e.target.value))} />
              <Inp value={it.qty} placeholder="Cantidad" onChange={(e) => mut((x) => (x.meals[mi].items[ii].qty = e.target.value))} style={{ width: 110 }} />
              <button onClick={() => mut((x) => x.meals[mi].items.splice(ii, 1))} style={{ color: P.faint }}><X size={15} /></button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn kind="line" small onClick={() => mut((x) => x.meals[mi].items.push({ id: uid(), food: "", qty: "" }))}><Plus size={13} /> Alimento</Btn>
            <Inp value={m.notes} placeholder="Nota de esta comida (opcional)" onChange={(e) => mut((x) => (x.meals[mi].notes = e.target.value))} style={{ fontSize: 13 }} />
          </div>
        </Card>
      ))}
      <Btn kind="ember" style={{ width: "100%" }} onClick={() => mut((x) => x.meals.push({ id: uid(), name: `Comida ${n.meals.length + 1}`, time: "", items: [{ id: uid(), food: "", qty: "" }], notes: "" }))}>
        <Plus size={16} /> Añadir comida
      </Btn>
    </div>
  );
};

const InstructionsEditor = ({ plan, savePlan }) => {
  const mut = (fn) => { const p = structuredClone(plan); fn(p); p.updatedAt = todayISO(); savePlan(p); };
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Indicaciones</h1>
      <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>Instrucciones generales del plan (cardio, pasos, sueño, suplementos…). El alumno las ve en su inicio.</div>
      {plan.instructions.map((it, i) => (
        <Card key={it.id} style={{ padding: 13, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 7 }}>
            <Inp value={it.title} placeholder="Título" onChange={(e) => mut((p) => (p.instructions[i].title = e.target.value))} style={{ fontWeight: 700 }} />
            <button onClick={() => mut((p) => p.instructions.splice(i, 1))} style={{ color: P.faint }}><Trash2 size={16} /></button>
          </div>
          <Txt value={it.body} placeholder="Detalle de la indicación…" onChange={(e) => mut((p) => (p.instructions[i].body = e.target.value))} />
        </Card>
      ))}
      <Btn kind="ember" style={{ width: "100%" }} onClick={() => mut((p) => p.instructions.push({ id: uid(), title: "", body: "" }))}>
        <Plus size={16} /> Añadir indicación
      </Btn>
    </div>
  );
};

/* ============================================================
   MODO COACH — actividad del alumno
   ============================================================ */
const ActivityTab = ({ plan, history }) => {
  const [sub, setSub] = useState("ses");
  const [openSession, setOpenSession] = useState(null);
  const [exId, setExId] = useState("");
  const [viewImg, setViewImg] = useState(null);
  const allEx = useMemo(() => {
    const m = new Map();
    plan.days.forEach((d) => d.exs.forEach((e) => m.set(e.id, e.name)));
    Object.keys(history.byEx).forEach((id) => { if (!m.has(id) && history.byEx[id].length) m.set(id, history.byEx[id][history.byEx[id].length - 1].exName || "Ejercicio"); });
    return [...m.entries()];
  }, [plan, history]);
  useEffect(() => { if (!exId && allEx.length) setExId(allEx[0][0]); }, [allEx, exId]);
  const commented = history.sessions.filter((s) => s.hasComments).length;

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Actividad del alumno</h1>
      <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>{history.sessions.length} sesiones registradas{commented ? ` · ${commented} con comentarios` : ""}. Revisa pesos, RIR, notas y fotos de cada entrenamiento.</div>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {[["ses", "Por sesión"], ["ex", "Por ejercicio"]].map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
            background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{l}</button>
        ))}
      </div>
      {sub === "ses" && (history.sessions.length === 0 ? (
        <Empty icon={Users} title="Aún no hay sesiones" body="Cuando el alumno termine su primera sesión, acá verás todo el detalle: series, comentarios y adjuntos." />
      ) : [...history.sessions].reverse().map((s) => (
        <Card key={s.id} style={{ marginBottom: 10 }}>
          <button onClick={() => setOpenSession(s)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.dayName}</div>
              <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>{fmtDateFull(s.date)} · {s.setsDone}/{s.setsTotal} series · {Math.round(s.volume).toLocaleString("es-CL")} kg</div>
            </div>
            {s.hasComments && <MessageSquare size={15} color={P.ember2} />}
            {s.prs.length > 0 && <Award size={15} color={P.ember2} />}
            <ChevronRight size={16} color={P.faint} />
          </button>
        </Card>
      )))}
      {sub === "ex" && (
        <div>
          <select value={exId} onChange={(e) => setExId(e.target.value)} style={{ width: "100%", padding: "11px 12px", marginBottom: 12 }}>
            {allEx.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {(history.byEx[exId] || []).length === 0
            ? <Empty icon={History} title="Sin registros" body="Este ejercicio aún no tiene sesiones registradas." />
            : <ExHistorySheetInline entries={history.byEx[exId]} onOpenImg={setViewImg} />}
        </div>
      )}
      <SessionDetailSheet session={openSession} onClose={() => setOpenSession(null)} history={history} onOpenImg={setViewImg} />
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

/* ============================================================
   Chrome global: banner de storage, toast, tabs y App raíz
   ============================================================ */
/* ============================================================
   Timer: cronómetro, temporizador e intervalos
   ============================================================ */
const bigTime = (s) => { const m = Math.floor(s / 60); const ss = s % 60; return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`; };

const Stopwatch = () => {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - ms;
    const iv = setInterval(() => setMs(Date.now() - startRef.current), 87);
    return () => clearInterval(iv);
  }, [running]);
  const total = Math.floor(ms / 1000);
  const dec = Math.floor((ms % 1000) / 100);
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div className="disp" style={{ fontSize: 68, fontWeight: 700, letterSpacing: ".02em", lineHeight: 1 }}>
        {bigTime(total)}<span style={{ fontSize: 30, color: P.dim }}>.{dec}</span>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <Btn kind={running ? "line" : "ember"} onClick={() => setRunning((r) => !r)} style={{ minWidth: 130 }}>
          {running ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> {ms > 0 ? "Reanudar" : "Iniciar"}</>}
        </Btn>
        <Btn kind="line" onClick={() => { setRunning(false); setMs(0); }} disabled={ms === 0}><RotateCcw size={16} /> Reiniciar</Btn>
      </div>
    </div>
  );
};

const Countdown = () => {
  const [min, setMin] = useState(1);
  const [sec, setSec] = useState(0);
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setLeft((l) => { if (l <= 1) { beep(); setRunning(false); return 0; } return l - 1; }), 1000);
    return () => clearInterval(iv);
  }, [running]);
  const armed = left > 0 || running;
  const start = () => { const t = (+min || 0) * 60 + (+sec || 0); if (t <= 0) return; setTotal(t); setLeft(t); setRunning(true); };
  return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      {!armed ? (
        <div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-end", marginBottom: 18 }}>
            <div><div style={{ fontSize: 11, color: P.faint, marginBottom: 4 }}>MIN</div>
              <input type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 90, padding: "12px", fontSize: 26, textAlign: "center", fontWeight: 700 }} /></div>
            <div style={{ fontSize: 26, paddingBottom: 12 }}>:</div>
            <div><div style={{ fontSize: 11, color: P.faint, marginBottom: 4 }}>SEG</div>
              <input type="number" inputMode="numeric" value={sec} onChange={(e) => setSec(e.target.value)} style={{ width: 90, padding: "12px", fontSize: 26, textAlign: "center", fontWeight: 700 }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
            {[[1, 0], [2, 0], [3, 0], [5, 0], [0, 30], [0, 90]].map(([m, s], i) => (
              <Btn key={i} kind="line" small onClick={() => { setMin(m); setSec(s); }}>{m ? `${m} min` : `${s} s`}</Btn>
            ))}
          </div>
          <Btn kind="ember" onClick={start} style={{ minWidth: 150 }}><Play size={16} /> Iniciar</Btn>
        </div>
      ) : (
        <div>
          <div className="disp" style={{ fontSize: 74, fontWeight: 700, lineHeight: 1, color: left <= 5 ? P.green : P.text }}>{bigTime(left)}</div>
          <div style={{ height: 6, background: P.s2, borderRadius: 3, margin: "16px auto 0", maxWidth: 320, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total ? (left / total) * 100 : 0}%`, background: `linear-gradient(90deg, ${P.ember2}, ${P.ember})`, transition: "width 1s linear" }} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <Btn kind={running ? "line" : "ember"} onClick={() => setRunning((r) => !r)} style={{ minWidth: 120 }}>{running ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Reanudar</>}</Btn>
            <Btn kind="line" onClick={() => { setRunning(false); setLeft(0); }}><X size={16} /> Cancelar</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

const IntervalTimer = () => {
  const [cfg, setCfg] = useState({ work: 40, rest: 20, rounds: 8, prep: 10 });
  const [run, setRun] = useState(null); // { phase: prep|work|rest|done, round, left }
  const [paused, setPaused] = useState(false);
  useEffect(() => { (async () => { const c = await sGet("forja-intervals", false); if (c) setCfg((x) => ({ ...x, ...c })); })(); }, []);
  const saveCfg = (patch) => { const c = { ...cfg, ...patch }; setCfg(c); sSet("forja-intervals", c, false); };
  useEffect(() => {
    if (!run || paused || run.phase === "done") return;
    const iv = setInterval(() => {
      setRun((r) => {
        if (!r) return r;
        if (r.left > 1) return { ...r, left: r.left - 1 };
        beep();
        if (r.phase === "prep") return { phase: "work", round: 1, left: cfg.work };
        if (r.phase === "work") {
          if (cfg.rest > 0) return { phase: "rest", round: r.round, left: cfg.rest };
          if (r.round >= cfg.rounds) return { phase: "done", round: cfg.rounds, left: 0 };
          return { phase: "work", round: r.round + 1, left: cfg.work };
        }
        if (r.phase === "rest") {
          if (r.round >= cfg.rounds) return { phase: "done", round: cfg.rounds, left: 0 };
          return { phase: "work", round: r.round + 1, left: cfg.work };
        }
        return r;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [run, paused, cfg]);

  const start = () => {
    if ((+cfg.work || 0) <= 0 || (+cfg.rounds || 0) <= 0) return;
    setPaused(false);
    setRun(cfg.prep > 0 ? { phase: "prep", round: 0, left: cfg.prep } : { phase: "work", round: 1, left: cfg.work });
  };
  const meta = { prep: ["Prepárate", P.ember2], work: ["Trabajo", P.ember], rest: ["Descanso", P.blue], done: ["¡Completado!", P.green] };
  const totalSec = cfg.prep + cfg.rounds * cfg.work + Math.max(0, cfg.rounds - (cfg.rest > 0 ? 0 : 0)) * cfg.rest;

  if (run) {
    const [label, color] = meta[run.phase];
    return (
      <div style={{ textAlign: "center", padding: "6px 0" }}>
        <div className="disp" style={{ fontSize: 22, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color }}>{label}</div>
        {run.phase !== "done" && <div style={{ fontSize: 13, color: P.dim, marginBottom: 6 }}>Ronda {Math.max(1, run.round)} de {cfg.rounds}</div>}
        <div className="disp" style={{ fontSize: 86, fontWeight: 700, lineHeight: 1, color }}>{run.phase === "done" ? "✓" : bigTime(run.left)}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
          {Array.from({ length: cfg.rounds }).map((_, i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: 5, background: i < (run.phase === "done" ? cfg.rounds : run.round - (run.phase === "work" ? 1 : 0)) ? P.ember : P.s3, border: `1px solid ${P.line}` }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          {run.phase !== "done" && <Btn kind={paused ? "ember" : "line"} onClick={() => setPaused((p) => !p)} style={{ minWidth: 120 }}>{paused ? <><Play size={16} /> Reanudar</> : <><Pause size={16} /> Pausar</>}</Btn>}
          <Btn kind="line" onClick={() => { setRun(null); setPaused(false); }}>{run.phase === "done" ? <><RotateCcw size={16} /> Volver</> : <><X size={16} /> Terminar</>}</Btn>
        </div>
      </div>
    );
  }

  const numField = (label, key, step) => (
    <div style={{ flex: 1, minWidth: 92 }}>
      <div style={{ fontSize: 11, color: P.faint, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: P.s3, border: `1px solid ${P.line}`, borderRadius: 10, padding: "4px 6px" }}>
        <button onClick={() => saveCfg({ [key]: Math.max(0, (+cfg[key] || 0) - step) })} style={{ color: P.ember, padding: "4px 8px", fontSize: 18, fontWeight: 700 }}>−</button>
        <input type="number" inputMode="numeric" value={cfg[key]} onChange={(e) => saveCfg({ [key]: +e.target.value || 0 })} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 700, border: "none", background: "transparent", padding: "6px 0", minWidth: 0 }} />
        <button onClick={() => saveCfg({ [key]: (+cfg[key] || 0) + step })} style={{ color: P.ember, padding: "4px 8px", fontSize: 18, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {numField("Trabajo (s)", "work", 5)}
        {numField("Descanso (s)", "rest", 5)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {numField("Rondas", "rounds", 1)}
        {numField("Preparación (s)", "prep", 5)}
      </div>
      <div style={{ fontSize: 12.5, color: P.dim, textAlign: "center", marginBottom: 14 }}>
        {cfg.rounds} rondas · {cfg.work}s trabajo / {cfg.rest}s descanso · total aprox. {bigTime(totalSec)}
      </div>
      <Btn kind="ember" onClick={start} style={{ width: "100%" }}><Play size={16} /> Iniciar intervalos</Btn>
    </div>
  );
};

/* ============================================================
   IA Nutricional (usa la API de Anthropic con la API key del coach)
   ============================================================ */
const NutriAITab = ({ plan, savePlan, currentStudent }) => {
  const [apiKey, setApiKey] = useState("");
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [showKeyEdit, setShowKeyEdit] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const k = await sGet("forja-ai-key");
      if (k) setApiKey(k);
      setKeyLoaded(true);
    })();
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const saveKey = async () => {
    await sSet("forja-ai-key", apiKey.trim());
    setShowKeyEdit(false);
  };

  const systemPrompt = `Eres una IA experta en nutrición deportiva y asesoría en fitness, integrada en FORJA, una plataforma de entrenamiento. Estás asesorando al coach sobre el alumno actual.

DATOS DEL ALUMNO ACTUAL:
- Nombre: ${currentStudent?.name || "sin especificar"}
- Plan actual (kcal/proteína/carbos/grasas): ${plan.nutrition.kcal || "?"} / ${plan.nutrition.p || "?"}g / ${plan.nutrition.c || "?"}g / ${plan.nutrition.f || "?"}g
- Notas del plan: ${plan.nutrition.notes || "sin notas"}
- Comidas configuradas: ${(plan.nutrition.meals || []).length}
- Rutina: ${plan.days.length} días de entrenamiento, ${plan.days.reduce((a, d) => a + d.exs.length, 0)} ejercicios totales.

TU ROL:
- Ayudar al coach a diseñar planes nutricionales adaptados al objetivo del alumno (volumen, definición, mantención, recomposición).
- Sugerir macros según peso corporal, nivel de actividad y objetivo cuando el coach te dé esa información.
- Proponer estructuras de comidas concretas (ejemplo: 4 comidas + 1 pre-entreno).
- Explicar el razonamiento fisiológico cuando sea relevante.
- Advertir cuando algo requiera evaluación médica (déficits agresivos, patologías, embarazo, menores).

REGLAS:
- Respuestas concisas y prácticas (máx 4-6 párrafos cortos).
- Usa gramos, kilocalorías y horarios concretos.
- Nunca inventes datos del alumno que no te dieron. Si falta info clave (peso, edad, objetivo, alergias, horario de entrenamiento) PÍDELA antes de dar un plan.
- No eres médico. Deriva a profesional para patologías, medicamentos, embarazo, alteraciones metabólicas.
- Idioma: español (Chile).`;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!apiKey) { setErr("Configura primero tu API key de Anthropic."); return; }
    setErr("");
    const nextMsgs = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs); setInput(""); setBusy(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1200,
          system: systemPrompt,
          messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Error ${r.status}: ${t.slice(0, 200)}`);
      }
      const data = await r.json();
      const answer = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n") || "(sin respuesta)";
      setMessages([...nextMsgs, { role: "assistant", content: answer }]);
    } catch (e) {
      setErr(e.message || "Error de conexión");
    } finally { setBusy(false); }
  };

  const applyPlan = (kcal, p, c, f, notes) => {
    const np = structuredClone(plan);
    if (kcal != null) np.nutrition.kcal = kcal;
    if (p != null) np.nutrition.p = p;
    if (c != null) np.nutrition.c = c;
    if (f != null) np.nutrition.f = f;
    if (notes) np.nutrition.notes = notes;
    np.updatedAt = todayISO();
    savePlan(np);
  };

  const suggestions = [
    "Necesito un plan para volumen limpio, hombre 27 años, 90 kg, 1,77 m, 5 entrenamientos/semana.",
    "Cambiar el plan a definición gradual manteniendo masa muscular.",
    "Propón la distribución de comidas del día para 2800 kcal.",
    "¿Cuánta proteína realmente necesita para hipertrofia?",
  ];

  if (!keyLoaded) return <div style={{ padding: 40, textAlign: "center", color: P.faint }}>Cargando…</div>;

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Sparkles size={22} color={P.ember} />
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0" }}>IA Nutrición</h1>
      </div>
      <div style={{ color: P.dim, fontSize: 13.5, marginBottom: 12, lineHeight: 1.5 }}>
        Chat con Claude (Anthropic) para diseñar y ajustar planes nutricionales del alumno. La IA ya conoce el plan actual y los datos que has cargado.
      </div>

      {!apiKey || showKeyEdit ? (
        <Card style={{ padding: 14, marginBottom: 14, borderColor: `${P.ember}66` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <AlertTriangle size={16} color={P.ember2} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Configura tu API key de Anthropic</div>
          </div>
          <div style={{ fontSize: 12.5, color: P.dim, lineHeight: 1.5, marginBottom: 10 }}>
            Consigue una API key en <b>console.anthropic.com</b> → Settings → API Keys. Es tuya (gratis para probar, luego con crédito). Se guarda cifrada en tu Supabase, no se envía a nadie más.
            <br /><br />
            <b>Aviso técnico:</b> por limitaciones del navegador la key viaja desde tu equipo hacia la API de Anthropic. Úsala solo para este uso y revócala si sospechas filtración.
          </div>
          <Inp type="password" placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {showKeyEdit && <Btn kind="line" onClick={() => setShowKeyEdit(false)} style={{ flex: 1 }}>Cancelar</Btn>}
            <Btn kind="ember" disabled={!apiKey.trim()} onClick={saveKey} style={{ flex: 2 }}>Guardar API key</Btn>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: P.faint }}>
          <Check size={14} color={P.green} /> API key configurada
          <button onClick={() => setShowKeyEdit(true)} style={{ color: P.ember, marginLeft: 6, fontSize: 12 }}>cambiar</button>
        </div>
      )}

      {messages.length === 0 && apiKey && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Sugerencias para empezar</div>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
              background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, marginBottom: 6, fontSize: 13, color: P.dim, lineHeight: 1.4 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ maxHeight: "50vh", overflowY: "auto", marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 13px", borderRadius: 14,
              background: m.role === "user" ? `${P.ember}22` : P.s2,
              border: `1px solid ${m.role === "user" ? `${P.ember}55` : P.line}`,
              fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ marginBottom: 10, display: "flex" }}>
            <div style={{ padding: "10px 13px", borderRadius: 14, background: P.s2, border: `1px solid ${P.line}`, fontSize: 13.5, color: P.dim }}>
              <span className="pulse">Pensando…</span>
            </div>
          </div>
        )}
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: `${P.red}22`, border: `1px solid ${P.red}55`, fontSize: 12.5, color: P.red, marginBottom: 8 }}>{err}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea rows={2} placeholder={apiKey ? "Escribe tu consulta…" : "Configura la API key primero"} disabled={!apiKey || busy}
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, padding: "10px 12px", fontSize: 14, minWidth: 0, resize: "none" }} />
        <Btn kind="ember" disabled={!input.trim() || !apiKey || busy} onClick={send} style={{ padding: "12px 14px", minWidth: 0 }}>
          <Send size={16} />
        </Btn>
      </div>

      {messages.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn kind="line" small onClick={() => setMessages([])}><Trash2 size={12} /> Reiniciar chat</Btn>
        </div>
      )}
    </div>
  );
};


const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LABELS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_LABELS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDate = (s) => { const [y, m, d] = s.split("-").map((x) => +x); return new Date(y, m - 1, d); };

const CalendarTab = ({ plan, history, onGoTrain }) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState("month"); // week | month
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(isoDate(today));

  const dayFor = (dateObj) => {
    const key = DAY_KEYS[dateObj.getDay()];
    const dayId = plan.schedule && plan.schedule[key];
    return dayId ? plan.days.find((d) => d.id === dayId) : null;
  };
  const eventsFor = (iso) => (plan.events || []).filter((e) => e.date === iso);
  const sessionsOnDate = (iso) => history.sessions.filter((s) => s.date === iso);

  // Generar celdas del mes
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const gridStart = new Date(monthStart); gridStart.setDate(1 - monthStart.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    cells.push(d);
    if (i >= 34 && d >= monthEnd) break;
  }

  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
  const weekCells = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  const goPrev = () => setCursor((c) => view === "month" ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : new Date(c.getTime() - 7 * 86400000));
  const goNext = () => setCursor((c) => view === "month" ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : new Date(c.getTime() + 7 * 86400000));

  const selDate = parseDate(selected);
  const selDay = dayFor(selDate);
  const selEvents = eventsFor(selected);
  const selSessions = sessionsOnDate(selected);
  const isToday = selected === isoDate(today);

  const cell = (d) => {
    const iso = isoDate(d);
    const isCurMonth = d.getMonth() === cursor.getMonth();
    const isSel = iso === selected;
    const isTodayCell = iso === isoDate(today);
    const day = dayFor(d);
    const evs = eventsFor(iso);
    const sess = sessionsOnDate(iso);
    const hasSession = sess.length > 0;
    return (
      <button key={iso} onClick={() => setSelected(iso)}
        style={{ position: "relative", aspectRatio: "1", padding: 3, borderRadius: 8,
          background: isSel ? `${P.ember}22` : isTodayCell ? P.s3 : "transparent",
          border: `1px solid ${isSel ? P.ember : isTodayCell ? P.ember2 + "55" : "transparent"}`,
          opacity: isCurMonth || view === "week" ? 1 : 0.35, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-start", gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: isTodayCell ? 700 : 500, color: isSel ? P.ember : P.text }}>{d.getDate()}</span>
        {day && <div style={{ width: "80%", height: 3, borderRadius: 2, background: hasSession ? P.green : P.ember }} />}
        {!day && !hasSession && evs.length === 0 && <div style={{ width: 3, height: 3, borderRadius: 999, background: P.faint, opacity: 0.5 }} />}
        {evs.length > 0 && <div style={{ position: "absolute", top: 2, right: 3, width: 6, height: 6, borderRadius: 999, background: P.blue }} />}
      </button>
    );
  };

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0" }}>Agenda</h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", background: P.s1, border: `1px solid ${P.line}`, borderRadius: 8, padding: 3 }}>
          {[["week", "Sem"], ["month", "Mes"]].map(([id, l]) => (
            <button key={id} onClick={() => setView(id)} style={{ padding: "5px 11px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: view === id ? P.s3 : "transparent", color: view === id ? P.text : P.faint }}>{l}</button>
          ))}
        </div>
      </div>

      <Card style={{ padding: "10px 12px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={goPrev} style={{ padding: 6, color: P.dim }}><ChevronLeft size={18} /></button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>
            {view === "month" ? `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semana del ${weekCells[0].getDate()} ${MONTH_LABELS[weekCells[0].getMonth()].slice(0, 3)}`}
          </div>
          <button onClick={goNext} style={{ padding: 6, color: P.dim }}><ChevronRight size={18} /></button>
          <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(isoDate(today)); }}
            style={{ padding: "4px 8px", fontSize: 11, color: P.ember, fontWeight: 700, borderRadius: 6, border: `1px solid ${P.ember}55`, marginLeft: 4 }}>HOY</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {DAY_LABELS.map((l) => <div key={l} style={{ textAlign: "center", fontSize: 10, color: P.faint, fontWeight: 700, textTransform: "uppercase", padding: "2px 0" }}>{l}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {view === "month" ? cells.map(cell) : weekCells.map(cell)}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: P.faint, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, background: P.ember, borderRadius: 2 }} />Entrenamiento</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, background: P.green, borderRadius: 2 }} />Realizado</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, background: P.blue, borderRadius: 999 }} />Recordatorio</span>
        </div>
      </Card>

      <Card style={{ padding: "13px 15px" }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>
          {isToday ? "Hoy · " : ""}{DAY_LABELS_LONG[selDate.getDay()]} {selDate.getDate()} {MONTH_LABELS[selDate.getMonth()].slice(0, 3)}
        </div>
        {selDay ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{selDay.name}</div>
            <div style={{ fontSize: 13, color: P.dim, marginTop: 2 }}>
              {selDay.exs.length} ejercicios · {selDay.exs.reduce((a, e) => a + e.sets.length, 0)} series
              {selSessions.length > 0 && ` · realizado ${selSessions.length}×`}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {selDay.exs.slice(0, 6).map((e) => (
                <span key={e.id} style={{ fontSize: 11.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 6, padding: "3px 7px" }}>{e.name}</span>
              ))}
              {selDay.exs.length > 6 && <span style={{ fontSize: 11.5, color: P.faint }}>+{selDay.exs.length - 6} más</span>}
            </div>
            {isToday && onGoTrain && (
              <Btn kind="ember" onClick={onGoTrain} style={{ width: "100%", marginTop: 12 }}>
                <Play size={15} /> Ir a entrenar
              </Btn>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 14, color: P.dim }}>Día de descanso · sin entrenamiento programado</div>
        )}

        {selEvents.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.line}` }}>
            <div style={{ fontSize: 11, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Recordatorios del coach</div>
            {selEvents.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 9, padding: "8px 10px", background: `${P.blue}15`, border: `1px solid ${P.blue}44`, borderRadius: 9, marginBottom: 6 }}>
                <Bell size={15} color={P.blue} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.title}</div>
                  {e.note && <div style={{ fontSize: 12.5, color: P.dim, marginTop: 2 }}>{e.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* Configuración del calendario en modo coach */
const ScheduleEditor = ({ plan, savePlan }) => {
  const mut = (fn) => { const p = structuredClone(plan); fn(p); p.updatedAt = todayISO(); savePlan(p); };
  const [addingEvent, setAddingEvent] = useState(false);
  const [ev, setEv] = useState({ date: isoDate(new Date()), title: "", note: "" });
  const today = new Date();
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Agenda</h1>
      <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>Asigna qué entrenamiento toca cada día de la semana. Los días sin asignar quedan como descanso. También puedes añadir recordatorios en fechas específicas (fotos de progreso, chequeos, etc.).</div>

      <Card style={{ padding: "13px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Semana tipo</div>
        {[["mon", "Lunes"], ["tue", "Martes"], ["wed", "Miércoles"], ["thu", "Jueves"], ["fri", "Viernes"], ["sat", "Sábado"], ["sun", "Domingo"]].map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 90, fontSize: 13.5, fontWeight: 600 }}>{label}</div>
            <select value={plan.schedule?.[k] || ""} onChange={(e) => mut((p) => { if (!p.schedule) p.schedule = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }; p.schedule[k] = e.target.value || null; })}
              style={{ flex: 1, padding: "9px 8px", fontSize: 13.5 }}>
              <option value="">Descanso</option>
              {plan.days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase" }}>Recordatorios en fechas específicas</div>
        <div style={{ flex: 1 }} />
        <Btn kind="line" small onClick={() => { setEv({ date: isoDate(new Date()), title: "", note: "" }); setAddingEvent(true); }}>
          <Plus size={13} /> Nuevo
        </Btn>
      </div>

      {(plan.events || []).length === 0 ? (
        <Empty icon={Bell} title="Sin recordatorios" body="Toca «Nuevo» para agregar recordatorios (ej: subir fotos de progreso el 1 de cada mes)." />
      ) : (
        [...(plan.events || [])].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
          <Card key={e.id} style={{ padding: "11px 13px", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Bell size={15} color={P.blue} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: P.faint }}>{fmtDateFull(e.date)}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1 }}>{e.title}</div>
                {e.note && <div style={{ fontSize: 12.5, color: P.dim, marginTop: 2 }}>{e.note}</div>}
              </div>
              <button onClick={() => mut((p) => { p.events = p.events.filter((x) => x.id !== e.id); })} style={{ color: P.faint, padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))
      )}

      <Sheet open={addingEvent} onClose={() => setAddingEvent(false)} title="Nuevo recordatorio">
        <Field label="Fecha"><Inp type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} /></Field>
        <Field label="Título"><Inp placeholder="Ej: Subir fotos de progreso" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} /></Field>
        <Field label="Nota (opcional)"><Txt rows={2} placeholder="Detalles adicionales…" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn kind="line" onClick={() => setAddingEvent(false)} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn kind="ember" disabled={!ev.title.trim()} onClick={() => { mut((p) => { if (!p.events) p.events = []; p.events.push({ id: uid(), ...ev }); }); setAddingEvent(false); }} style={{ flex: 2 }}>Guardar</Btn>
        </div>
      </Sheet>
    </div>
  );
};

const TimerTab = () => {
  const [sub, setSub] = useState("interval");
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Timer</h1>
      <div style={{ color: P.dim, fontSize: 14, marginBottom: 14 }}>Cronómetro, temporizador e intervalos de trabajo/descanso. Suena y vibra en cada cambio.</div>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 18 }}>
        {[["interval", "Intervalos"], ["count", "Temporizador"], ["stop", "Cronómetro"]].map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding: "18px 16px" }}>
        {sub === "stop" && <Stopwatch />}
        {sub === "count" && <Countdown />}
        {sub === "interval" && <IntervalTimer />}
      </Card>
    </div>
  );
};

const StorageBanner = () => storageOK ? null : (
  <div style={{ background: "rgba(229,72,77,.12)", border: `1px solid rgba(229,72,77,.4)`, borderRadius: 12,
    margin: "10px 16px 0", padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-start" }}>
    <AlertTriangle size={16} color={P.red} style={{ flexShrink: 0, marginTop: 1 }} />
    <div style={{ fontSize: 12.5, color: P.red, lineHeight: 1.45 }}>
      No se pudo conectar con el servidor. Los datos se mantienen en memoria pero pueden perderse al cerrar la app. Se reintentará automáticamente.
    </div>
  </div>
);

const Toast = ({ msg }) => !msg ? null : (
  <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 86, zIndex: 80,
    width: "calc(100% - 32px)", maxWidth: 488 }}>
    <div className="sheetIn" style={{ background: "#2A1214", border: `1px solid rgba(229,72,77,.5)`, color: "#F5B8BA",
      borderRadius: 12, padding: "11px 14px", fontSize: 13.5, lineHeight: 1.4, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>{msg}</div>
  </div>
);

const TABS = {
  alumno: [
    { id: "hoy", label: "Hoy", Icon: Home },
    { id: "agenda", label: "Agenda", Icon: Calendar },
    { id: "entrenar", label: "Entrenar", Icon: Dumbbell },
    { id: "progreso", label: "Progreso", Icon: TrendingUp },
    { id: "nutricion", label: "Nutric.", Icon: Utensils },
    { id: "timer", label: "Timer", Icon: Timer },
    { id: "guia", label: "Guía", Icon: BookOpen },
  ],
  coach: [
    { id: "rutina", label: "Rutina", Icon: ClipboardList },
    { id: "agenda", label: "Agenda", Icon: Calendar },
    { id: "nutricion", label: "Nutric.", Icon: Utensils },
    { id: "ia", label: "IA", Icon: Sparkles },
    { id: "indicaciones", label: "Indicac.", Icon: StickyNote },
    { id: "actividad", label: "Activ.", Icon: Users },
    { id: "timer", label: "Timer", Icon: Timer },
    { id: "guia", label: "Guía", Icon: BookOpen },
  ],
};

const TabBar = ({ tabs, tab, setTab }) => (
  <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center",
    background: `${P.s1}F5`, backdropFilter: "blur(10px)", borderTop: `1px solid ${P.line}` }}>
    <div style={{ display: "flex", width: "100%", maxWidth: 520, padding: "6px 2px calc(8px + env(safe-area-inset-bottom))" }}>
      {tabs.map(({ id, label, Icon }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2, padding: "7px 1px 4px", color: on ? P.ember : P.faint, minWidth: 0 }}>
            <Icon size={19} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ---- Selección de identidad (por dispositivo) ---- */
const Gate = ({ roster, onEnter, onAdd }) => (
  <div className="fj" style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <GlobalStyle />
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}><Logo size={34} /></div>
      <h1 style={{ fontSize: 24, textTransform: "uppercase", textAlign: "center", margin: "0 0 4px" }}>¿Quién entra?</h1>
      <div style={{ color: P.dim, fontSize: 13.5, textAlign: "center", marginBottom: 20, lineHeight: 1.45 }}>
        Este dispositivo recordará tu elección. Podrás cambiarla cuando quieras desde el encabezado.
      </div>
      <Card onClick={() => onEnter("coach", roster.students[0]?.id)} style={{ padding: "15px 16px", marginBottom: 16, borderColor: `${P.ember}55`, cursor: "pointer",
        background: `linear-gradient(150deg, rgba(255,107,44,.10), ${P.s1})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${P.ember}22`, border: `1px solid ${P.ember}55`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={20} color={P.ember} /></div>
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>Soy el coach</div><div style={{ fontSize: 12.5, color: P.dim }}>Crear y editar rutinas, ver la actividad de todos</div></div>
        </div>
      </Card>
      <div style={{ fontSize: 11, color: P.faint, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, margin: "4px 2px 8px" }}>Entrar como alumno</div>
      {roster.students.map((s) => (
        <Card key={s.id} onClick={() => onEnter("alumno", s.id)} style={{ padding: "13px 15px", marginBottom: 9, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="disp" style={{ width: 36, height: 36, borderRadius: 10, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2 }}>{s.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{s.name}</div>
            <ChevronRight size={17} color={P.faint} />
          </div>
        </Card>
      ))}
      <Btn kind="line" onClick={onAdd} style={{ width: "100%", marginTop: 6 }}><Plus size={15} /> Agregar alumno</Btn>
    </div>
  </div>
);

/* ---- Gestión de alumnos (coach) ---- */
const RosterSheet = ({ open, onClose, roster, sid, onEnter, onAdd, onRename, onRemove }) => (
  <Sheet open={open} onClose={onClose} title="Alumnos" tall>
    <div style={{ color: P.dim, fontSize: 13.5, marginBottom: 14 }}>Cada alumno tiene su propia rutina, historial y progreso, guardados por separado y sincronizados en todos los dispositivos que abran esta plataforma.</div>
    {roster.students.map((s) => (
      <Card key={s.id} style={{ padding: "12px 14px", marginBottom: 10, borderColor: s.id === sid ? `${P.ember}66` : P.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div className="disp" style={{ width: 34, height: 34, borderRadius: 9, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2 }}>{s.name.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{s.name}{s.id === sid && <span style={{ fontSize: 11, color: P.ember2, marginLeft: 8 }}>· gestionando</span>}</div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <Btn kind="ember" small onClick={() => onEnter("coach", s.id)}><ClipboardList size={13} /> Gestionar</Btn>
          <Btn kind="line" small onClick={() => onEnter("alumno", s.id)}><Dumbbell size={13} /> Entrar como alumno</Btn>
          <Btn kind="line" small onClick={() => onRename(s)}><PencilLine size={13} /> Renombrar</Btn>
          {roster.students.length > 1 && <Btn kind="line" small onClick={() => onRemove(s)} style={{ color: P.red }}><Trash2 size={13} /></Btn>}
        </div>
      </Card>
    ))}
    <Btn kind="line" onClick={onAdd} style={{ width: "100%", marginTop: 4 }}><Plus size={15} /> Agregar alumno</Btn>
  </Sheet>
);

const App = () => {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [roster, setRoster] = useState({ v: ROSTER_VERSION, students: [] });
  const [mode, setMode] = useState("coach");
  const [sid, setSid] = useState(null);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState(emptyHistory);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("rutina");
  const [savedAt, setSavedAt] = useState("");
  const [gloss, setGloss] = useState({ open: false, focus: null });
  const [rosterOpen, setRosterOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [, force] = useState(0);
  const planTimer = useRef(null);
  const activeTimer = useRef(null);
  const toastTimer = useRef(null);
  const sidRef = useRef(null);
  const activeRef = useRef(null);

  const loadStudent = async (id) => {
    let p = await sGet(`forja-plan:${id}`); if (!p) p = emptyPlan();
    // Migración: planes viejos sin schedule/events
    if (!p.schedule) p.schedule = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    if (!p.events) p.events = [];
    let h = await sGet(`forja-history:${id}`); if (!h) h = emptyHistory();
    const a = await sGet(`forja-active:${id}`);
    return { p, h, a: a || null };
  };

  const openIdentity = async (m, id, rosterArg) => {
    const r = rosterArg || roster;
    if (!id) id = r.students[0]?.id;
    if (!id) { setLoading(false); return; }
    const { p, h, a } = await loadStudent(id);
    sidRef.current = id; activeRef.current = a;
    setMode(m); setSid(id); setPlan(p); setHistory(h); setActive(a); setSavedAt("");
    setTab(m === "coach" ? "rutina" : "hoy");
    setReady(true); setLoading(false);
    sSet("forja-device", { mode: m, sid: id }, false);
    force((x) => x + 1);
  };

  useEffect(() => {
    (async () => {
      let r = await sGet("forja-roster");
      if (!r || r.v !== ROSTER_VERSION || !r.students || r.students.length === 0) {
        const id = uid();
        r = { v: ROSTER_VERSION, students: [{ id, name: "Leandro Pereira", createdAt: todayISO() }] };
        await sSet(`forja-plan:${id}`, seedPlanWithSchedule());
        const legacyH = await sGet("forja-history");
        await sSet(`forja-history:${id}`, (legacyH && legacyH.sessions) ? legacyH : emptyHistory());
        const legacyA = await sGet("forja-active");
        if (legacyA) await sSet(`forja-active:${id}`, legacyA);
        await sSet("forja-roster", r);
      }
      setRoster(r);
      const dev = await sGet("forja-device", false);
      const known = dev && dev.sid && r.students.some((s) => s.id === dev.sid);
      if (dev && dev.mode && known) await openIdentity(dev.mode, dev.sid, r);
      else setLoading(false);
    })();
    return () => { clearTimeout(planTimer.current); clearTimeout(activeTimer.current); clearTimeout(toastTimer.current); };
  }, []);

  // Respaldo automático de la sesión activa al minimizar o cerrar
  useEffect(() => {
    const flush = () => { if (activeRef.current && sidRef.current) sSet(`forja-active:${sidRef.current}`, activeRef.current); };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flush); };
  }, []);

  const applyActive = useCallback((a) => { activeRef.current = a; setActive(a); }, []);

  const planHistoryRef = useRef({ past: [], future: [] });
  const savePlan = useCallback((p, opts = {}) => {
    setPlan((prev) => {
      if (prev && !opts.skipHistory) {
        planHistoryRef.current.past.push(prev);
        if (planHistoryRef.current.past.length > 40) planHistoryRef.current.past.shift();
        planHistoryRef.current.future = [];
      }
      return p;
    });
    clearTimeout(planTimer.current);
    const id = sidRef.current;
    planTimer.current = setTimeout(() => { sSet(`forja-plan:${id}`, p).then(() => force((x) => x + 1)); }, 500);
  }, []);

  const undoPlan = useCallback(() => {
    const h = planHistoryRef.current;
    if (h.past.length === 0) return;
    setPlan((cur) => {
      const prev = h.past.pop();
      if (cur) h.future.push(cur);
      const id = sidRef.current;
      clearTimeout(planTimer.current);
      planTimer.current = setTimeout(() => { sSet(`forja-plan:${id}`, prev).then(() => force((x) => x + 1)); }, 500);
      return prev;
    });
    force((x) => x + 1);
  }, []);

  const redoPlan = useCallback(() => {
    const h = planHistoryRef.current;
    if (h.future.length === 0) return;
    setPlan((cur) => {
      const next = h.future.pop();
      if (cur) h.past.push(cur);
      const id = sidRef.current;
      clearTimeout(planTimer.current);
      planTimer.current = setTimeout(() => { sSet(`forja-plan:${id}`, next).then(() => force((x) => x + 1)); }, 500);
      return next;
    });
    force((x) => x + 1);
  }, []);

  const resetPlan = useCallback((reseed) => {
    const p = reseed ? seedPlanWithSchedule() : emptyPlan();
    savePlan(p);
  }, [savePlan]);

  const saveHistory = useCallback((h) => {
    setHistory(h);
    sSet(`forja-history:${sidRef.current}`, h).then(() => force((x) => x + 1));
  }, []);

  const saveActive = useCallback((a) => {
    activeRef.current = a;
    clearTimeout(activeTimer.current);
    const id = sidRef.current;
    activeTimer.current = setTimeout(async () => {
      const ok = await sSet(`forja-active:${id}`, a);
      if (ok) setSavedAt(new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      force((x) => x + 1);
    }, 400);
  }, []);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4200);
  }, []);

  const onInfo = useCallback((gId) => setGloss({ open: true, focus: gId || null }), []);

  const finishSession = useCallback((aIn) => {
    clearTimeout(activeTimer.current);
    const a = structuredClone(aIn);
    // Guardar toda serie con datos aunque el alumno no haya marcado el check
    a.exs.forEach((ex) => ex.sets.forEach((s) => {
      const hasData = (s.weight !== "" && s.weight != null) || (s.reps !== "" && s.reps != null);
      if (hasData) s.done = true;
    }));
    const h = structuredClone(history);
    const date = todayISO();
    const durationMin = Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000));
    const setsTotal = a.exs.reduce((acc, e) => acc + e.sets.length, 0);
    let volume = 0, setsDone = 0, hasComments = false;
    const prs = [];
    const recordedExs = [];
    a.exs.forEach((ex) => {
      const doneSets = ex.sets.filter((s) => s.done);
      doneSets.forEach((s) => {
        setsDone += 1;
        volume += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
        (s.drops || []).forEach((d) => { volume += (parseFloat(d.weight) || 0) * (parseFloat(d.reps) || 0); });
        if (s.comment) hasComments = true;
      });
      if (ex.comment || (ex.attachIds || []).length > 0) hasComments = true;
      if (doneSets.length === 0 && !ex.comment && (ex.attachIds || []).length === 0) return;
      const prevMax = (h.byEx[ex.id] || []).reduce(
        (m, en) => Math.max(m, ...en.sets.filter((s) => s.done).map((s) => parseFloat(s.weight) || 0), 0), 0);
      const nowMax = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
      if (nowMax > 0 && nowMax > prevMax) prs.push(`${ex.name}: ${kg(nowMax)} kg`);
      if (!h.byEx[ex.id]) h.byEx[ex.id] = [];
      h.byEx[ex.id].push({ sessionId: a.id, date, dayId: a.dayId, dayName: a.dayName, exName: ex.name,
        sets: ex.sets, comment: ex.comment || "", attachIds: ex.attachIds || [] });
      recordedExs.push({ exId: ex.id, name: ex.name });
    });
    h.sessions.push({ id: a.id, date, dayId: a.dayId, dayName: a.dayName, durationMin, volume, setsDone, setsTotal, prs, hasComments, exs: recordedExs });
    setHistory(h);
    sSet(`forja-history:${sidRef.current}`, h).then(() => force((x) => x + 1));
    activeRef.current = null; setActive(null); setSavedAt("");
    sDel(`forja-active:${sidRef.current}`);
    return { durationMin, setsDone, setsTotal, volume, prs };
  }, [history]);

  const discardSession = useCallback(() => {
    clearTimeout(activeTimer.current);
    activeRef.current = null; setActive(null); setSavedAt("");
    sDel(`forja-active:${sidRef.current}`);
  }, []);

  const addStudent = async (enterAsAlumno) => {
    const name = (typeof window !== "undefined" && window.prompt ? window.prompt("Nombre del nuevo alumno:") : "") || "";
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = uid();
    const r = { ...roster, students: [...roster.students, { id, name: trimmed, createdAt: todayISO() }] };
    await sSet(`forja-plan:${id}`, emptyPlan());
    await sSet(`forja-history:${id}`, emptyHistory());
    await sSet("forja-roster", r);
    setRoster(r);
    if (enterAsAlumno) openIdentity("alumno", id, r);
    else { setRosterOpen(false); openIdentity("coach", id, r); }
  };

  const renameStudent = async (s) => {
    const name = (window.prompt ? window.prompt("Nuevo nombre:", s.name) : s.name) || "";
    const trimmed = name.trim();
    if (!trimmed) return;
    const r = { ...roster, students: roster.students.map((x) => (x.id === s.id ? { ...x, name: trimmed } : x)) };
    await sSet("forja-roster", r); setRoster(r); force((x) => x + 1);
  };

  const removeStudent = async (s) => {
    if (roster.students.length <= 1) { setConfirmDel(null); toast("Debe quedar al menos un alumno. Agrega otro antes de eliminar este."); return; }
    const r = { ...roster, students: roster.students.filter((x) => x.id !== s.id) };
    await sDel(`forja-plan:${s.id}`); await sDel(`forja-history:${s.id}`); await sDel(`forja-active:${s.id}`);
    await sSet("forja-roster", r); setRoster(r); setConfirmDel(null);
    if (s.id === sidRef.current) {
      if (r.students.length) openIdentity(mode, r.students[0].id, r);
      else { setReady(false); setRosterOpen(false); }
    }
  };

  const switchMode = (m) => openIdentity(m, sidRef.current);
  const currentStudent = roster.students.find((s) => s.id === sid);
  const tabs = TABS[mode];

  if (loading) {
    return (
      <div className="fj" style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GlobalStyle />
        <div className="pulse"><Logo size={34} /></div>
      </div>
    );
  }

  if (!ready) {
    return <Gate roster={roster} onEnter={(m, id) => openIdentity(m, id)} onAdd={() => addStudent(false)} />;
  }

  return (
    <div className="fj" style={{ minHeight: "100vh", background: P.bg }}>
      <GlobalStyle />
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 96 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px 0" }}>
          <button onClick={() => setReady(false)} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div className="disp" style={{ width: 30, height: 30, borderRadius: 9, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2, fontSize: 15, flexShrink: 0 }}>
              {(currentStudent?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{currentStudent?.name || "—"}</div>
              <div style={{ fontSize: 10.5, color: P.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>modo {mode} · cambiar</div>
            </div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "coach" && <Btn kind="line" small onClick={() => setRosterOpen(true)}><Users size={14} /> Alumnos</Btn>}
            <div style={{ display: "flex", background: P.s1, border: `1px solid ${P.line}`, borderRadius: 10, padding: 3, gap: 3 }}>
              {[["alumno", "Alumno"], ["coach", "Coach"]].map(([id, l]) => (
                <button key={id} onClick={() => switchMode(id)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: mode === id ? P.s3 : "transparent", color: mode === id ? P.text : P.faint, border: `1px solid ${mode === id ? P.line : "transparent"}` }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <StorageBanner />

        {mode === "alumno" && tab === "hoy" && (
          <TodayTab plan={plan} history={history} active={active} role={mode} goTrain={() => setTab("entrenar")} />
        )}
        {mode === "alumno" && tab === "agenda" && (
          <CalendarTab plan={plan} history={history} onGoTrain={() => setTab("entrenar")} />
        )}
        {mode === "alumno" && tab === "entrenar" && (
          <TrainTab plan={plan} history={history} active={active} setActive={applyActive} saveActive={saveActive}
            finishSession={finishSession} discardSession={discardSession} onInfo={onInfo} toast={toast} savedAt={savedAt} />
        )}
        {mode === "alumno" && tab === "progreso" && <ProgressTab plan={plan} history={history} saveHistory={saveHistory} />}
        {mode === "alumno" && tab === "nutricion" && <NutritionView n={plan.nutrition} />}
        {mode === "coach" && (tab === "rutina" || tab === "nutricion" || tab === "indicaciones" || tab === "agenda") && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 14px 0" }}>
            <Btn kind="line" small onClick={undoPlan} disabled={planHistoryRef.current.past.length === 0}><Undo2 size={14} /> Deshacer</Btn>
            <Btn kind="line" small onClick={redoPlan} disabled={planHistoryRef.current.future.length === 0}><Redo2 size={14} /> Rehacer</Btn>
            <div style={{ flex: 1 }} />
            <Btn kind="line" small onClick={() => setConfirmReset(true)} style={{ color: P.red }}><Trash2 size={13} /> Vaciar plan</Btn>
          </div>
        )}
        {mode === "coach" && tab === "rutina" && <RoutineTab plan={plan} savePlan={savePlan} onInfo={onInfo} />}
        {mode === "coach" && tab === "agenda" && <ScheduleEditor plan={plan} savePlan={savePlan} />}
        {mode === "coach" && tab === "nutricion" && <NutritionEditor plan={plan} savePlan={savePlan} />}
        {mode === "coach" && tab === "ia" && <NutriAITab plan={plan} savePlan={savePlan} currentStudent={currentStudent} />}
        {mode === "coach" && tab === "indicaciones" && <InstructionsEditor plan={plan} savePlan={savePlan} />}
        {mode === "coach" && tab === "actividad" && <ActivityTab plan={plan} history={history} />}
        {tab === "timer" && <TimerTab />}
        {tab === "guia" && (
          <div style={{ padding: "18px 16px 30px" }}>
            <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Guía de términos</h1>
            <div style={{ color: P.dim, fontSize: 14, marginBottom: 6 }}>
              Todo lo que aparece en la rutina, explicado en simple. Durante el entrenamiento también puedes tocar cualquier etiqueta (TOP, B-O, DROP…) para abrir esta guía.
            </div>
            <GlossaryBody />
          </div>
        )}
      </div>

      <TabBar tabs={tabs} tab={tab} setTab={setTab} />
      <RosterSheet open={rosterOpen} onClose={() => setRosterOpen(false)} roster={roster} sid={sid}
        onEnter={(m, id) => { setRosterOpen(false); openIdentity(m, id); }}
        onAdd={() => addStudent(false)} onRename={renameStudent} onRemove={(s) => setConfirmDel(s)} />
      <Confirm open={!!confirmDel} danger title="Eliminar alumno"
        body={confirmDel ? `Se borrará ${confirmDel.name} junto con su rutina, historial y progreso. Esta acción no se puede deshacer.` : ""}
        okLabel="Eliminar" onOk={() => removeStudent(confirmDel)} onCancel={() => setConfirmDel(null)} />
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Vaciar plan y volver a empezar">
        <div style={{ color: P.dim, fontSize: 13.5, marginBottom: 14, lineHeight: 1.5 }}>
          Esta acción reemplaza el plan actual. El historial del alumno (sesiones, pesos, fotos) NO se borra. Puedes deshacer con el botón «Deshacer» si te arrepientes.
        </div>
        <Btn kind="ember" onClick={() => { resetPlan(true); setConfirmReset(false); }} style={{ width: "100%", marginBottom: 8 }}>
          <RotateCcw size={15} /> Restaurar plan de ejemplo (Leandro)
        </Btn>
        <Btn kind="line" onClick={() => { resetPlan(false); setConfirmReset(false); }} style={{ width: "100%", color: P.red }}>
          <Trash2 size={15} /> Vaciar completamente (empezar desde cero)
        </Btn>
      </Sheet>
      <Sheet open={gloss.open} onClose={() => setGloss({ open: false, focus: null })} title="Guía rápida" tall>
        <GlossaryBody focusId={gloss.focus} />
      </Sheet>
      <Toast msg={toastMsg} />
    </div>
  );
};

export default App;
