import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Flame, Dumbbell, TrendingUp, BookOpen, Utensils, ClipboardList, MessageSquare,
  Camera, Check, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  X, Info, Timer, PencilLine, Copy, Award, Scale, Video, History, Play,
  ArrowUp, ArrowDown, AlertTriangle, RotateCcw, Home, Users, StickyNote, Pause,
  Undo2, Redo2, Calendar, Sparkles, Upload, ArrowRight, Zap, Send, Bell, Paperclip, GripVertical, Layers, Search, Library, Mic, MicOff,
  Trophy, Medal, Gift, Lock, Eye, EyeOff
} from "lucide-react";

/* ============================================================
   FORJA — plataforma coach ↔ alumno
   Diseño: hierro caliente. Tema oscuro cálido, acento brasa.
   Persistencia: Supabase (PostgreSQL, compartido coach/alumnos).
   ============================================================ */

const BUILD = "v42";   // sube al cambiar el bundle: sirve para saber qué versión está corriendo

// Paleta FORJA: negro, rojo sangre y blanco intenso — en capas, no en
// bloques planos: superficies con calidez rojiza para dar profundidad
// (nada de negro neutro plano), el borde de cada tarjeta ya lleva ese
// tinte rojo para que las "cajas" se destaquen, y el rojo de acento es
// un rojo sangre profundo (no rosado) reservado a degradados/CTA — nunca
// como relleno plano de texto completo, para que no se vea "parchado".
// "green"/"blue" son nombres heredados de una paleta anterior; hoy
// funcionan como matices de blanco (positivo/informativo).
const P = {
  bg: "#0C0708",
  s1: "#1A1214",
  s2: "#241619",
  s3: "#301B1F",
  s4: "#3D1F24",
  line: "#7A2A33",
  text: "#FFFFFF",
  dim: "#D9D4D6",
  faint: "#9C9296",
  ember: "#E01A1A",
  ember2: "#FF3B3B",
  green: "#FFFFFF",
  red: "#E01A1A",
  blue: "#DAD4D6",
  glow: "rgba(224,26,26,.5)",
  // Fondo general de pantalla completa: ya no negro plano. Diagonal oscuro
  // a rojo sangre con dos brillos radiales (arriba-derecha y abajo-
  // izquierda), igual que una imagen de portada — pero con el rojo tope
  // acotado (nunca pasa de un rojo profundo) para que el texto blanco y
  // las tarjetas sigan leyéndose con contraste alto encima.
  bgGrad: "radial-gradient(130% 85% at 88% -4%, rgba(255,70,70,.38), rgba(122,16,16,.16) 42%, rgba(0,0,0,0) 68%), " +
    "radial-gradient(110% 80% at 6% 106%, rgba(224,26,26,.20), rgba(0,0,0,0) 55%), " +
    "linear-gradient(158deg, #050203 0%, #170608 30%, #310A0C 54%, #591010 76%, #7A1414 100%)",
};

// Cada tipo de serie con su propio color fuerte y distinto, para que se
// reconozcan de un vistazo durante el entrenamiento (el resto de la app
// se mantiene en blanco y negro; esto es la única excepción a propósito).
const SET_TYPES = {
  warmup:   { label: "Calentamiento (Warm-up set)", short: "WRM", color: "#7DA6C7", g: "warmup" },
  normal:   { label: "Serie de trabajo (Working set)", short: "WRK", color: "#34D399", g: "efectiva" },
  top:      { label: "Top set",      short: "TOP", color: "#FF6B2C", g: "topset" },
  backoff:  { label: "Back-off",     short: "B-O", color: "#F2B84B", g: "backoff" },
  drop:     { label: "Drop set",     short: "DROP",color: "#F0555F", g: "dropset" },
  restpause:{ label: "Rest-pause",   short: "R-P", color: "#B583F0", g: "restpause" },
  amrap:    { label: "AMRAP",        short: "AMR", color: "#38D9E8", g: "amrap" },
  cluster:  { label: "Cluster set",  short: "CLU", color: "#2DD4BF", g: "cluster" },
  vma:      { label: "VMA (iso final)", short: "VMA", color: "#F472B6", g: "vma" },
  midiso:   { label: "Iso media + reps", short: "ISO", color: "#818CF8", g: "midiso" },
  pfi:      { label: "Pre-fatiga iso", short: "PFI", color: "#FB8A5C", g: "pfi" },
  density:  { label: "Serie de densidad (Density set)", short: "DNS", color: "#A3E635", g: "density" },
};

const MUSCLES = ["Espalda","Pecho","Hombro","Bíceps","Tríceps","Cuádriceps","Femoral","Glúteo","Gemelo","Core","Antebrazo","Trapecio","Otro"];
// Equipo usado por un ejercicio de la biblioteca — sirve para filtrar la búsqueda.
const EQUIPMENT = ["Barra","Barra EZ","Mancuernas","Máquina","Polea","Smith","Peso corporal","Kettlebell","Banda elástica","Otro"];
// Porcentaje de crédito que se le puede asignar a un músculo secundario
// (el ejercicio también lo trabaja, pero no es el músculo principal).
const SECONDARY_PCTS = [25, 50, 75];

// Tipos de serie que admiten porcentaje de bajada de carga
const PCT_TYPES = ["top", "backoff", "drop", "amrap"];
const PCT_HINT = {
  top: "Porcentaje por debajo del máximo de referencia para esta serie",
  backoff: "Porcentaje por debajo del top set",
  drop: "Porcentaje que se baja en cada caída del drop set",
  amrap: "Porcentaje de bajada de carga para el AMRAP respecto a la serie previa",
};

/* Agrupación de ejercicios: superserie (2), triserie (3) y serie gigante (4+).
   Los ejercicios consecutivos con el mismo `group` se ejecutan seguidos, sin
   descanso entre ellos, y se repiten tantas veces como diga `groupRounds`. */
const GROUP_KINDS = {
  superset: { label: "Superserie", short: "SS", min: 2, color: "#FFFFFF" },
  triset:   { label: "Triserie",   short: "TRI", min: 3, color: "#CFCFD5" },
  giant:    { label: "Serie gigante", short: "GIG", min: 4, color: "#A6A6AD" },
};
// Nombre según cuántos ejercicios acabaron en el grupo (2 = superserie, 3 = triserie, 4+ = gigante)
const groupKindFor = (n) => (n >= 4 ? "giant" : n === 3 ? "triset" : "superset");

// FORJA no tiene un campo de tempo propio: se anota como texto al principio
// de las notas del ejercicio ("Tempo 3/0/1/0 (excéntrico/pausa/…)."). Esta
// función lo extrae para poder mostrarlo como insignia compacta en la lista
// de la rutina, en vez de que quede escondido dentro de las notas y solo
// visible al abrir el ejercicio.
const TEMPO_RE = /^Tempo\s+([\d.]+\/[\d.]+\/[\d.]+\/[\d.]+)/i;
const parseTempo = (notes) => {
  const m = TEMPO_RE.exec((notes || "").trim());
  return m ? m[1] : null;
};

// Índice de bloque (A=0, B=1, C=2…) en la posición `idx` de `exs`: cuenta
// cuántos bloques hay ANTES de esa posición, tratando cada grupo contiguo
// (superserie/triserie/gigante) como UN solo bloque y cada ejercicio suelto
// como otro. Así la letra avanza por bloque, no por cada ejercicio individual
// (un A solo seguido de un B1/B2/B3 no debe hacer que el siguiente bloque
// arranque en "E" solo porque ocupó 4 posiciones del arreglo).
function blockIndexAt(exs, idx) {
  let count = 0, i = 0;
  while (i < idx) {
    const g = exs[i] && exs[i].group;
    if (g) {
      let end = i;
      while (end < exs.length - 1 && exs[end + 1].group === g) end++;
      i = end + 1;
    } else {
      i++;
    }
    count++;
  }
  return count;
}

// Letra sola del bloque en la posición `idx` (sin número): la usan tanto el
// ejercicio suelto (series tradicionales, un solo "bloque" de un ejercicio)
// como el primer miembro de un grupo real.
const blockLetter = (exs, idx) => String.fromCharCode(65 + (blockIndexAt(exs, idx) % 26));

/* Datos del grupo al que pertenece exs[i]: tamaño, tipo, si es el primero y
   qué letra le toca dentro del bloque (A1, A2, A3…). Un ejercicio suelto
   (series tradicionales, sin superserie/triserie/gigante) es su propio
   bloque de un solo ejercicio: recibe la letra pero sin número, porque no
   hay secuencia que numerar — se completan todas sus series antes de pasar
   al siguiente ejercicio. */
function exGroupInfo(exs, i) {
  const g = exs[i] && exs[i].group;
  const solo = { kind: null, first: true, size: 1, rounds: 1, roundsRaw: "", linkedToNext: false, posLabel: blockLetter(exs, i) };
  if (!g) return solo;
  let start = i, end = i;
  while (start > 0 && exs[start - 1].group === g) start--;
  while (end < exs.length - 1 && exs[end + 1].group === g) end++;
  const size = end - start + 1;
  if (size < 2) return solo;   // grupo huérfano: no es un bloque real, se trata como suelto
  const raw = exs[start].groupRounds;
  const roundsRaw = raw === undefined || raw === null ? "" : String(raw);
  return {
    kind: groupKindFor(size),
    first: i === start,
    size,
    roundsRaw,                          // lo que se ve en la casilla (puede quedar vacío)
    rounds: Math.max(1, parseInt(roundsRaw, 10) || 1),  // el valor real que se usa
    linkedToNext: i < end,
    posLabel: `${blockLetter(exs, start)}${i - start + 1}`,
  };
}

/* Los bloques de un día: cada superserie/triserie/gigante cuenta como UN
   bloque (todos sus ejercicios seguidos) y cada ejercicio suelto es un
   bloque de uno. Se usa para arrastrar y reordenar de a bloque completo,
   nunca separando un superserie/triserie a la mitad. */
function exBlocks(exs) {
  const out = [];
  let i = 0;
  while (i < exs.length) {
    const g = exs[i].group;
    let j = i + 1;
    if (g) { while (j < exs.length && exs[j].group === g) j++; }
    out.push({ start: i, end: j, key: exs[i].id });
    i = j;
  }
  return out;
}

// Mueve el bloque completo que empieza en `fromKey` justo antes/después del
// bloque `toKey`, preservando el orden interno de cada bloque. Muta `exs`.
function moveBlock(exs, fromKey, toKey) {
  const blocks = exBlocks(exs);
  const fromB = blocks.find((b) => b.key === fromKey);
  const toB = blocks.find((b) => b.key === toKey);
  if (!fromB || !toB || fromB.key === toB.key) return;
  const wasBefore = fromB.start < toB.start;
  const moved = exs.splice(fromB.start, fromB.end - fromB.start);
  const newToB = exBlocks(exs).find((b) => b.key === toKey);
  const insertAt = wasBefore ? newToB.end : newToB.start;
  exs.splice(insertAt, 0, ...moved);
}

// Auto-scroll durante un arrastre (día/ejercicio/rutina): si el dedo se
// acerca al borde superior o inferior de la pantalla, la página se
// desplaza sola. Sin esto, mover un bloque de superserie/triserie (que
// ocupa mucho alto) a un punto que no entra en la pantalla es imposible:
// no hay forma de soltar sobre algo que nunca llega a verse.
function autoScrollNearEdge(clientY) {
  const EDGE = 90;
  const h = window.innerHeight;
  if (clientY < EDGE) window.scrollBy(0, -(EDGE - clientY) * 0.6);
  else if (clientY > h - EDGE) window.scrollBy(0, (clientY - (h - EDGE)) * 0.6);
}

// Durante un arrastre, encuentra cuál de los elementos candidatos está bajo
// la coordenada Y dada — comparando directamente sus rects
// (getBoundingClientRect), NO vía document.elementFromPoint(). Es clave para
// que el arrastre funcione en todos los navegadores: en algunos (Safari de
// iOS incluido) elementFromPoint puede devolver un resultado obsoleto o nulo
// durante un gesto de touch ya en curso, y ahí un arrastre "más o menos
// funciona en Chrome pero no en el celular real" es justo ese síntoma.
function elementUnderY(elements, y) {
  let best = null, bestDist = Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (y >= r.top && y <= r.bottom) return el;
    const dist = y < r.top ? r.top - y : y - r.bottom;
    if (dist < bestDist) { bestDist = dist; best = el; }
  }
  return best;
}

/* Une o separa exs[i] de exs[i+1]. Si alguno ya pertenece a un bloque, se
   fusionan en el mismo; al separar, el resto del bloque pasa a uno nuevo. */
// Limpia grupos que quedaron con un solo ejercicio (huérfanos)
function normalizeGroups(exs) {
  const count = {};
  exs.forEach((x) => { if (x.group) count[x.group] = (count[x.group] || 0) + 1; });
  exs.forEach((x) => { if (x.group && count[x.group] < 2) { delete x.group; delete x.groupRounds; } });
}

function toggleLink(exs, i) {
  const a = exs[i], b = exs[i + 1];
  if (!b) return;
  if (a.group && a.group === b.group) {
    // Separar: lo que va de b en adelante estrena grupo (o se queda suelto)
    const g = a.group;
    const tail = [];
    for (let k = i + 1; k < exs.length && exs[k].group === g; k++) tail.push(k);
    const rounds = exs.find((x) => x.group === g).groupRounds || 1;
    if (tail.length >= 2) { const ng = uid(); tail.forEach((k) => { exs[k].group = ng; exs[k].groupRounds = rounds; }); }
    else tail.forEach((k) => { delete exs[k].group; delete exs[k].groupRounds; });
    // Si delante queda un solo ejercicio, deja de ser bloque
    const head = exs.filter((x) => x.group === g);
    if (head.length < 2) head.forEach((x) => { delete x.group; delete x.groupRounds; });
    normalizeGroups(exs);
    return;
  }
  const g = a.group || b.group || uid();
  const rounds = a.groupRounds || b.groupRounds || 3;
  [a, b].forEach((x) => { x.group = g; });
  exs.forEach((x) => { if (x.group === g) x.groupRounds = rounds; });
  normalizeGroups(exs);
}

/* ---------------- Glosario ---------------- */
const GLOSSARY = [
  { id:"rir", term:"RIR (Reps In Reserve)", def:"Repeticiones que te quedan «en reserva» al terminar la serie. RIR 2 significa que paraste pudiendo hacer 2 repeticiones más con técnica correcta. Es la forma más práctica de regular el esfuerzo sin llegar siempre al fallo.", ej:"Objetivo: 8–10 reps @ RIR 2 → eliges un peso con el que llegarías al fallo alrededor de las 10–12 reps y paras en 8–10." },
  { id:"rpe", term:"RPE (esfuerzo percibido)", def:"Escala de 1 a 10 que mide qué tan dura fue la serie. Es el espejo del RIR: RPE 8 = RIR 2, RPE 9 = RIR 1, RPE 10 = fallo (RIR 0).", ej:"Si tu coach pide RPE 8, es lo mismo que dejar 2 repeticiones en reserva." },
  { id:"abreviaturas", term:"Abreviaturas de la app (A1, A2, SS, TOP…)", def:"Cómo se leen las etiquetas cortas que aparecen en la rutina y al entrenar:\n\n• A1, A2, A3 · B1, B2…: ejercicios encadenados de un bloque. La LETRA identifica el bloque (superserie, triserie o serie gigante) y el NÚMERO el orden dentro de él. A1 → A2 → A3 se hacen seguidos, sin descanso entre ellos.\n• Ronda: una vuelta completa al bloque (hacer A1, A2 y A3 una vez). El bloque se repite tantas rondas como diga el plan; el descanso llega recién al terminar cada ronda.\n• SS = superserie (2 ejercicios) · TRI = triserie (3) · GIG = serie gigante (4 o más).\n• Tipos de serie: APR = aproximación · EF = efectiva · TOP = top set · B-O = back-off · DROP = drop set · R-P = rest-pause · AMR = AMRAP · CLU = cluster · VMA = iso final · ISO = iso media + reps · PFI = pre-fatiga iso · DNS = serie de densidad.\n• RIR = repeticiones en reserva · RPE = esfuerzo percibido · −% = porcentaje de bajada de carga de esa serie.", ej:"«B2 · Ronda 2/3 · DROP» = segundo ejercicio del bloque B, vas en la segunda de tres rondas, y esa serie es un drop set." },
  { id:"topset", term:"Top set", def:"La serie más pesada del ejercicio en el día: una sola serie con el peso máximo planificado, normalmente cerca del fallo (RIR 0–2). Sirve para empujar la progresión de fuerza y como referencia para calcular las series siguientes.", ej:"Top set: 1 × 6–8 @ RIR 1 con 100 kg, y desde ahí se calculan los back-offs." },
  { id:"backoff", term:"Back-off set", def:"Series que se hacen después del top set bajando el peso (típicamente entre 10 % y 20 % menos) para acumular volumen de calidad con menos fatiga y mejor técnica.", ej:"Top set 100 kg → back-offs 2 × 8–10 con 85 kg (−15 %). FORJA te sugiere el peso automáticamente." },
  { id:"dropset", term:"Drop set", def:"Al terminar la serie cerca del fallo, bajas el peso de inmediato (20–30 % menos) y sigues repitiendo sin descanso. Puede tener una o varias «caídas». Genera mucho estímulo y mucha fatiga: se usa con moderación, normalmente en la última serie de ejercicios de aislamiento.", ej:"Elevaciones laterales: 12 reps con 10 kg → sin descansar, 10 reps con 7 kg → 8 reps con 5 kg." },
  { id:"restpause", term:"Rest-pause", def:"Haces la serie hasta cerca del fallo, descansas 10–20 segundos y, con el mismo peso, sacas un mini-bloque más de repeticiones. Se puede repetir 1–2 veces. Permite acumular repeticiones efectivas en poco tiempo.", ej:"12 reps → 15 s de pausa → 4 reps → 15 s → 3 reps, todo con el mismo peso." },
  { id:"amrap", term:"AMRAP", def:"«As Many Reps As Possible»: haces todas las repeticiones posibles con técnica correcta (según el RIR indicado). Sirve para medir progreso y ajustar cargas.", ej:"Última serie AMRAP @ RIR 1: anota cuántas salieron; si superas el rango, la próxima semana sube el peso." },
  { id:"warmup", term:"Serie de calentamiento (Warm-up set, WRM)", def:"Series ligeras previas a las series de trabajo para preparar articulaciones, activar la musculatura y practicar la técnica sin generar fatiga. No cuentan como volumen efectivo.", ej:"Antes de un top set de 100 kg: 8 reps con 40 kg, 5 con 60 kg, 3 con 80 kg." },
  { id:"efectiva", term:"Serie de trabajo (Working set, WRK)", def:"Serie de trabajo real, hecha lo bastante cerca del fallo (RIR 0–4) como para estimular hipertrofia. Es la unidad con la que se cuenta el volumen semanal por grupo muscular.", ej:"3 series de trabajo de 8–10 @ RIR 2 en remo = 3 series que suman al volumen de espalda." },
  { id:"superset", term:"Superserie", def:"Dos ejercicios realizados uno inmediatamente después del otro, descansando recién al terminar el segundo. Ahorra tiempo y funciona mejor con músculos antagonistas o que no compiten entre sí.", ej:"Curl de bíceps + extensión de tríceps en polea, descanso de 90 s al completar ambos." },
  { id:"tempo", term:"Tempo", def:"Velocidad de cada fase de la repetición escrita en 4 números: excéntrica – pausa abajo – concéntrica – pausa arriba (en segundos). Controlar la bajada suele ser lo más relevante para hipertrofia.", ej:"Tempo 3-1-1-0: bajas en 3 s, pausa de 1 s, subes en 1 s, sin pausa arriba." },
  { id:"fallo", term:"Fallo muscular / fallo técnico", def:"Fallo muscular: no puedes completar otra repetición aunque lo intentes. Fallo técnico: aún podrías moverla, pero ya no con técnica correcta. Para hipertrofia se entrena cerca del fallo; llegar siempre al fallo absoluto aumenta la fatiga más que el estímulo.", ej:"Si en la rep 9 la espalda se despega del respaldo, esa fue tu última rep útil: fallo técnico." },
  { id:"volumen", term:"Volumen de entrenamiento", def:"Cantidad total de trabajo. La forma más usada de medirlo es el número de series efectivas por grupo muscular por semana; también se mide en kilos totales (peso × reps × series).", ej:"Espalda: 14 series efectivas/semana. FORJA calcula el tonelaje de cada sesión automáticamente." },
  { id:"mev", term:"MEV (Volumen Mínimo Efectivo)", def:"El número de series efectivas por semana, para un grupo muscular, por debajo del cual prácticamente no hay progreso: es el mínimo que hay que hacer para que el músculo crezca. Menos que el MEV es «bajo» en FORJA.", ej:"Si el MEV de pecho es 8 series/semana, con solo 4 series estás muy por debajo del estímulo mínimo: hay que sumar más volumen para progresar." },
  { id:"mav", term:"MAV (rango de Máxima Adaptación de Volumen)", def:"Rango de series efectivas por semana donde el músculo progresa mejor: ya se pasó el mínimo (MEV) pero todavía no se llega al techo recuperable (MRV). Es la «zona óptima» que FORJA destaca en cada tabla de volumen. La mayor parte del entrenamiento debería vivir en este rango.", ej:"Si el rango óptimo de espalda es 14–22 series/semana, entrenar con 18 series está justo en la zona donde más se progresa." },
  { id:"mrv", term:"MRV (Volumen Máximo Recuperable)", def:"El techo de series efectivas por semana que el cuerpo puede recuperar en esa fase. Pasarse de este número no da más músculo: solo suma fatiga que no alcanzas a disipar entre sesiones, y el rendimiento empieza a bajar. Sirve como límite superior, no como meta.", ej:"Si el MRV de bíceps es 20 series/semana y programas 26, probablemente estés sobre-entrenando ese grupo: toca bajar volumen o meter un deload." },
  { id:"landmarks", term:"MEV / zona óptima (MAV) / MRV, todos juntos", def:"Son tres marcas en la misma escala de series semanales, de menor a mayor: MEV (mínimo para estimular) → zona óptima o MAV (donde más se progresa) → MRV (techo recuperable). FORJA los muestra en ese orden, separados por «/»: por ejemplo «8 / 12–20 / 22» significa MEV 8, zona óptima entre 12 y 20, MRV 22 series por semana.", ej:"Pecho: 8 / 12–20 / 22 · 2×/sem → con menos de 8 series vas bajo, entre 12 y 20 estás en la zona ideal, y pasar de 22 es entrenar más de lo que puedes recuperar. El «2×/sem» es la frecuencia semanal sugerida para ese grupo." },
  { id:"sobrecarga", term:"Sobrecarga progresiva", def:"Principio central del progreso: hacer más con el tiempo — más peso, más repeticiones o más series con la misma técnica. Por eso registrar cada serie importa: sin historial no hay progresión medible.", ej:"Semana 1: 80 kg × 8. Semana 3: 80 kg × 10. Semana 4: 82,5 kg × 8." },
  { id:"mesociclo", term:"Mesociclo", def:"Bloque de entrenamiento de 4 a 8 semanas con una progresión planificada (subiendo volumen o intensidad), que normalmente termina en una descarga.", ej:"Mesociclo de 5 semanas: RIR 3 → 2 → 2 → 1 → deload." },
  { id:"cluster", term:"Cluster set (serie en racimo)", def:"Serie partida en mini-bloques con pausas muy cortas dentro de la propia serie, para acumular repeticiones de calidad con una carga alta que en continuo no aguantarías. La pausa deja recuperar fosfocreatina sin perder la tensión del ejercicio.", ej:"Cluster 3/1/1/1 con tu peso de 5RM: 3 reps → 10-15 s de pausa (la barra descansa) → 1 rep → 10-15 s → 1 rep → 10-15 s → 1 rep. Eso es UNA serie: 6 reps con un peso de 5RM. Descanso entre clusters: 3-5 min. Úsalo en básicos (sentadilla, press, remo), 2-4 clusters por ejercicio." },
  { id:"vma", term:"Serie de acción muscular variable (VMA)", def:"Series de trabajo en las que, nada más terminar las repeticiones, mantienes el peso quieto en el punto de mayor tensión durante un tiempo fijo. No hay descanso entre la serie y la isometría, ni entre los elementos del bloque: combina fase concéntrica, excéntrica e isométrica en un solo esfuerzo continuo.", ej:"Curl en polea: 10 reps controladas → sin soltar, aguantas a 90° durante 10 s → recién ahí descansas 90-120 s. Repite 3 rondas. Como la isometría suma mucha fatiga, baja un 10-15 % el peso que usarías normalmente." },
  { id:"midiso", term:"Isometría en rango medio + repeticiones", def:"Empiezas la serie aguantando el peso en el punto medio del recorrido, que es donde el músculo está en máxima tensión y donde suele estar el punto de estancamiento. Cuando terminas la pausa, pasas directo a repeticiones completas hasta acabar la serie. Sube el tiempo bajo tensión y ataca justo la zona más débil.", ej:"Press inclinado: aguanta con los codos a 90° durante 15-20 s → sin soltar, 8-10 reps completas → descansa 2-3 min. 3 series. Empieza con un 60-70 % del peso habitual: la isometría inicial deja el músculo muy fatigado." },
  { id:"pfi", term:"Isometría de pre-fatiga + máximas repeticiones", def:"Método muy exigente: primero agotas el músculo con una isometría en rango medio resistiendo el peso todo lo que puedas, hasta que ya no puedes sostener la posición; en ese momento pasas de inmediato a repeticiones completas hasta el fallo. La pre-fatiga hace que las repeticiones siguientes sean mucho más duras con menos carga.", ej:"Extensión de cuádriceps: aguanta a mitad de recorrido hasta que la pierna cede (suele caer entre 20 y 45 s) → sin soltar, repeticiones completas hasta el fallo (salen 5-10) → descansa 2-3 min. Máximo 1-2 series por ejercicio y solo al final de la sesión: la fatiga que deja es enorme." },
  { id:"superserie2", term:"Superserie, triserie y serie gigante", def:"Bloque de 2 (superserie), 3 (triserie) o 4 o más ejercicios (serie gigante) que se hacen uno detrás de otro sin descanso entre ellos. El descanso llega solo al terminar la ronda completa, y el bloque se repite tantas rondas como indique el plan. Ahorra tiempo y sube la densidad del entrenamiento.", ej:"Triserie de hombro, 3 rondas: elevación lateral 12 reps → pájaro 12 reps → press militar 10 reps, encadenados sin parar; al terminar los tres, descansas 2 min y arrancas la siguiente ronda. Si los ejercicios comparten músculo, baja un 10-20 % la carga respecto a hacerlos sueltos." },
  { id:"density", term:"Serie de densidad (Density set, DNS)", def:"Una sola serie con un objetivo alto de repeticiones totales (por ejemplo 100) usando una carga moderada (20-30RM). Al llegar al fallo, descansas el menor tiempo posible y sigues sumando repeticiones hasta completar el total. Es una sola serie en el registro, aunque en la práctica se hagan varios «tramos» cortos dentro de ella.", ej:"100 reps objetivo con una carga 20RM: 22 reps al fallo → pausa breve → 15 reps → pausa breve → … hasta sumar 100. Se suele usar como ejercicio finisher, al cierre de la sesión." },
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

/* ---------------- Claude API (llamada directa desde el navegador) ----------------
   Usamos streaming (SSE): la respuesta llega por partes, así un análisis largo
   (por ej. un plan de 12 meses) no se corta por un timeout fijo. El timeout es
   "por inactividad": solo salta si dejan de llegar datos durante idleMs.

   "Load failed" / "Failed to fetch" son errores de red del propio navegador (no
   llegó a haber respuesta HTTP): caídas de wifi/datos, un bloqueador de anuncios,
   una VPN o un DNS privado interceptando api.anthropic.com. Reintentamos una vez
   esos casos y damos un mensaje claro en vez del texto crudo del navegador. */
async function callClaudeAPI(apiKey, body, { idleMs = 90000, retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), idleMs);
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), idleMs); };
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!r.ok) {
        clearTimeout(timer);
        const txt = await r.text().catch(() => "");
        let msg = `Error ${r.status}: ${txt.slice(0, 300)}`;
        try { const j = JSON.parse(txt); if (j && j.error && j.error.message) msg = j.error.message; } catch {}
        if (r.status === 401) msg = "La API key de Anthropic es inválida o fue revocada. Revísala en la pestaña IA.";
        else if (r.status === 429) msg = "Se alcanzó el límite de uso de tu cuenta de Anthropic. Intenta de nuevo en unos minutos.";
        else if (r.status >= 500 && attempt < retries) continue; // error del servidor: reintenta una vez
        throw new Error(msg);
      }
      // Lee el stream SSE y arma el texto de la respuesta a partir de los deltas.
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", text = "", stopReason = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bump();
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // deja la última línea (posiblemente incompleta) en el buffer
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const payload = l.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let ev;
          try { ev = JSON.parse(payload); } catch { continue; }
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") text += ev.delta.text;
          else if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
          else if (ev.type === "error") throw new Error(ev.error && ev.error.message ? ev.error.message : "La IA devolvió un error durante el análisis.");
        }
      }
      clearTimeout(timer);
      return { content: [{ type: "text", text }], stop_reason: stopReason };
    } catch (e) {
      clearTimeout(timer);
      if (e && e.message && e.message.startsWith("Error ")) throw e; // errores HTTP/API ya formateados
      const isAbort = e.name === "AbortError";
      const isNetwork = isAbort || e instanceof TypeError; // fetch nunca llegó a tener respuesta
      if (isNetwork && attempt < retries) continue;
      if (isAbort) throw new Error("La IA tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo (los archivos muy grandes pueden tardar).");
      if (isNetwork) throw new Error("No se pudo conectar con la IA de Anthropic. Revisa tu conexión a internet; si usas un bloqueador de anuncios, VPN o DNS privado, puede estar bloqueando api.anthropic.com.");
      throw e;
    }
  }
}

/* Recupera un objeto de rutina de un texto que quizá venga truncado (respuesta
   cortada por límite de tokens). Primero intenta el JSON completo; si falla,
   rescata todos los días completos que alcanzaron a cerrarse. */
function parseRoutineJSON(rawText) {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try { return { data: JSON.parse(match[0]), truncated: false }; } catch {}
  }
  // Recuperación: junta los objetos de día ({...}) completos y bien formados.
  const start = rawText.indexOf('"days"');
  if (start === -1) return null;
  const arrStart = rawText.indexOf("[", start);
  if (arrStart === -1) return null;
  const days = [];
  let i = arrStart + 1;
  while (i < rawText.length) {
    while (i < rawText.length && rawText[i] !== "{") i++;
    if (i >= rawText.length) break;
    let depth = 0, inStr = false, esc = false, objStart = i;
    for (; i < rawText.length; i++) {
      const c = rawText[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
    }
    if (depth !== 0) break; // objeto incompleto: se cortó acá
    try { days.push(JSON.parse(rawText.slice(objStart, i))); } catch {}
  }
  if (!days.length) return null;
  return { data: { days }, truncated: true };
}

/* ---------------- Utilidades ---------------- */
/* Los campos numéricos aceptan coma o punto como separador decimal: ambos
   significan lo mismo. `num` normaliza a número para cálculos (0 si no hay
   nada válido) y `stepNumeric` sube o baja el valor respetando los decimales
   que ya tiene escritos: 2,5 → 2,6 · 2.89 → 2.90 · 2,9 → 3,0 · 10 → 11. */
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

function stepNumeric(raw, dir) {
  const s = String(raw ?? "").trim();
  if (s === "") return dir > 0 ? "1" : "0";
  const sep = s.includes(",") ? "," : ".";
  const norm = s.replace(",", ".");
  const n = parseFloat(norm);
  if (!isFinite(n)) return dir > 0 ? "1" : "0";
  const dot = norm.indexOf(".");
  const decimals = dot === -1 ? 0 : norm.length - dot - 1;
  const factor = Math.pow(10, decimals);
  // Se opera con enteros para no arrastrar el error de coma flotante (0.1 + 0.2)
  const next = Math.max(0, Math.round(n * factor) + dir);
  const out = (next / factor).toFixed(decimals);
  return sep === "," ? out.replace(".", ",") : out;
}

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
// Formatea series que pueden salir fraccionadas por el crédito de músculos
// secundarios (ej: 8.5 series).
const fmtSets = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1));
const weekKey = (iso) => {
  const d = new Date(iso); const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day); mon.setHours(0,0,0,0);
  return mon.getTime();
};

// Racha de entrenamiento: cuenta semanas consecutivas con al menos una
// sesión terminada, contando hacia atrás desde la semana actual. Si esta
// semana todavía no tiene sesión no se corta la racha de inmediato (el
// alumno puede estar a mitad de semana); recién se corta cuando pasa una
// semana entera en blanco.
function weekStreak(sessions) {
  if (!sessions || !sessions.length) return 0;
  const weeks = new Set(sessions.map((s) => weekKey(s.date)));
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const curWk = weekKey(todayISO());
  let cursor = weeks.has(curWk) ? curWk : curWk - oneWeekMs;
  if (!weeks.has(cursor)) return 0;
  let n = 0;
  while (weeks.has(cursor)) { n++; cursor -= oneWeekMs; }
  return n;
}

/* ============================================================
   LOGROS — medallas por avance del alumno (constancia, sesiones,
   récords personales, tonelaje acumulado y antigüedad entrenando).
   Se calculan siempre en vivo a partir del historial — no se guardan
   como "ya desbloqueado", así nunca quedan desincronizados.
   ============================================================ */
const ACHIEVEMENTS = [
  { id: "racha_4", group: "Constancia", label: "Racha de 4 semanas", need: 4, Icon: Flame,
    metric: (m) => m.streak, fmt: (v) => `${v} semana${v !== 1 ? "s" : ""} seguidas` },
  { id: "racha_8", group: "Constancia", label: "Racha de 8 semanas", need: 8, Icon: Flame,
    metric: (m) => m.streak, fmt: (v) => `${v} semanas seguidas` },
  { id: "racha_12", group: "Constancia", label: "Racha de 12 semanas", need: 12, Icon: Flame,
    metric: (m) => m.streak, fmt: (v) => `${v} semanas seguidas` },
  { id: "ses_10", group: "Sesiones", label: "10 sesiones completadas", need: 10, Icon: Dumbbell,
    metric: (m) => m.sessions, fmt: (v) => `${v} sesiones` },
  { id: "ses_50", group: "Sesiones", label: "50 sesiones completadas", need: 50, Icon: Dumbbell,
    metric: (m) => m.sessions, fmt: (v) => `${v} sesiones` },
  { id: "ses_100", group: "Sesiones", label: "100 sesiones completadas", need: 100, Icon: Dumbbell,
    metric: (m) => m.sessions, fmt: (v) => `${v} sesiones` },
  { id: "ses_200", group: "Sesiones", label: "200 sesiones completadas", need: 200, Icon: Dumbbell,
    metric: (m) => m.sessions, fmt: (v) => `${v} sesiones` },
  { id: "pr_1", group: "Récords", label: "Primer récord personal", need: 1, Icon: Award,
    metric: (m) => m.prs, fmt: (v) => `${v} PR${v !== 1 ? "s" : ""}` },
  { id: "pr_10", group: "Récords", label: "10 récords personales", need: 10, Icon: Award,
    metric: (m) => m.prs, fmt: (v) => `${v} PRs` },
  { id: "pr_25", group: "Récords", label: "25 récords personales", need: 25, Icon: Award,
    metric: (m) => m.prs, fmt: (v) => `${v} PRs` },
  { id: "ton_10", group: "Tonelaje", label: "10 toneladas levantadas", need: 10000, Icon: TrendingUp,
    metric: (m) => m.tonnage, fmt: (v) => `${Math.round(v / 1000 * 10) / 10} t` },
  { id: "ton_50", group: "Tonelaje", label: "50 toneladas levantadas", need: 50000, Icon: TrendingUp,
    metric: (m) => m.tonnage, fmt: (v) => `${Math.round(v / 1000 * 10) / 10} t` },
  { id: "ton_100", group: "Tonelaje", label: "100 toneladas levantadas", need: 100000, Icon: TrendingUp,
    metric: (m) => m.tonnage, fmt: (v) => `${Math.round(v / 1000 * 10) / 10} t` },
  { id: "dias_30", group: "Antigüedad", label: "1 mes entrenando en FORJA", need: 30, Icon: Calendar,
    metric: (m) => m.daysActive, fmt: (v) => `${v} días` },
  { id: "dias_90", group: "Antigüedad", label: "3 meses entrenando en FORJA", need: 90, Icon: Calendar,
    metric: (m) => m.daysActive, fmt: (v) => `${v} días` },
  { id: "dias_180", group: "Antigüedad", label: "6 meses entrenando en FORJA", need: 180, Icon: Calendar,
    metric: (m) => m.daysActive, fmt: (v) => `${v} días` },
  { id: "dias_365", group: "Antigüedad", label: "1 año entrenando en FORJA", need: 365, Icon: Calendar,
    metric: (m) => m.daysActive, fmt: (v) => `${v} días` },
];

// Resume el historial de un alumno en las métricas base que alimentan
// logros y rankings, para no recorrer `sessions` una vez por cada cosa.
function progressMetrics(history) {
  const sessions = (history && history.sessions) || [];
  const tonnage = sessions.reduce((a, s) => a + (s.volume || 0), 0);
  const prs = sessions.reduce((a, s) => a + (s.prs ? s.prs.length : 0), 0);
  const minutes = sessions.reduce((a, s) => a + (s.durationMin || 0), 0);
  const dates = sessions.map((s) => new Date(s.date).getTime()).filter((t) => !isNaN(t));
  const daysActive = dates.length ? Math.floor((Date.now() - Math.min(...dates)) / 86400000) : 0;
  return { sessions: sessions.length, tonnage, prs, minutes, streak: weekStreak(sessions), daysActive };
}

function computeAchievements(history) {
  const m = progressMetrics(history);
  return ACHIEVEMENTS.map((a) => {
    const value = a.metric(m);
    return { ...a, value, earned: value >= a.need, pct: Math.min(100, Math.round((value / a.need) * 100)) };
  });
}

// Estimación de calorías quemadas — FORJA no mide gasto energético real
// (haría falta un sensor), así que se calcula con una fórmula estándar de
// entrenamiento de fuerza (~MET 6) según minutos entrenados y peso
// corporal. Se etiqueta como "estimado" en toda la interfaz.
function estimateKcal(minutes, weightKg) {
  const w = weightKg > 0 ? weightKg : 75;
  return Math.round(minutes * w * 0.1);
}

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
const SEED_VERSION = 4;
const ROSTER_VERSION = 1;
const TRAINING_B_VIDEOS = [
  "https://youtu.be/PkdWebUdlbE",
  "https://youtu.be/jUKNrZoG0v4",
  "https://youtu.be/ft2qWxrJyYA",
  "https://youtu.be/5BYEIP_KBY8",
  "https://youtu.be/uMO6qc4wyQw",
  "https://youtu.be/5pEG7Cj0-0Y",
];
const sets = (arr) => arr.map(([type, repsT, rirT, pct]) => ({ id: uid(), type, repsT, rirT: rirT ?? "", pct: pct ?? 15 }));

/* ---------------- Rutinas (agrupación de los días) ----------------
   Cada día del plan lleva una etiqueta `routine`. Los días que ya estaban
   cargados quedan en la Rutina A (no se toca nada de su contenido) y la
   Rutina B es el bloque nuevo del documento «Entrenamiento Jose Miguel Posada».
   Un día sin etiqueta se considera Rutina A. */
const ROUTINE_A = "A";
const ROUTINE_B = "B";
const ROUTINE_META = {
  A: { note: "Todo lo que ya estaba cargado, tal cual" },
  B: { note: "Empujes · Tirones · Pierna, dos vueltas" },
};
const routineOf = (day) => (day && day.routine) || ROUTINE_A;
const routineLabel = (key) => `Rutina ${key}`;
const routineNote = (key) => (ROUTINE_META[key] ? ROUTINE_META[key].note : "");

// Agrupa los días respetando el orden en que aparecen en el plan
const groupDaysByRoutine = (days) => {
  const order = [];
  const byKey = new Map();
  (days || []).forEach((d, i) => {
    const key = routineOf(d);
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key).push({ day: d, index: i });
  });
  return order.map((key) => {
    const items = byKey.get(key);
    return {
      key,
      label: routineLabel(key),
      note: routineNote(key),
      days: items.map((it) => it.day),
      items,
      exCount: items.reduce((a, it) => a + it.day.exs.length, 0),
      setCount: items.reduce((a, it) => a + it.day.exs.reduce((b, e) => b + e.sets.length, 0), 0),
    };
  });
};

// Siguiente letra libre para una rutina nueva (A, B, C…)
const nextRoutineKey = (days) => {
  const used = new Set((days || []).map(routineOf));
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i);
    if (!used.has(k)) return k;
  }
  return String((days || []).length + 1);
};

/* ---- Restricción de rutinas visibles por alumno ----
   El coach puede ocultarle a un alumno algunas rutinas (una fase anterior,
   un borrador que aún no le toca, etc.) para que solo vea/entrene las que
   corresponden. Se guarda en `student.allowedRoutines`: una lista de claves
   de rutina (["A","C"]). Sin restricción (undefined o lista vacía) el
   alumno ve todo — el comportamiento de siempre, cero fricción. */
const isRoutineVisible = (allowedRoutines, key) =>
  !allowedRoutines || allowedRoutines.length === 0 || allowedRoutines.includes(key);
const visibleRoutineGroups = (days, allowedRoutines) =>
  groupDaysByRoutine(days).filter((g) => isRoutineVisible(allowedRoutines, g.key));
const visibleDays = (days, allowedRoutines) =>
  (days || []).filter((d) => isRoutineVisible(allowedRoutines, routineOf(d)));

// Mueve TODOS los días de una rutina (bloque completo) justo antes/después
// del bloque de otra rutina, sin alterar el orden interno de los días de
// cada una. Muta p.days.
function moveRoutineGroup(p, fromKey, toKey) {
  if (fromKey === toKey) return;
  const order = groupDaysByRoutine(p.days).map((g) => g.key);
  const fromIdx = order.indexOf(fromKey), toIdx = order.indexOf(toKey);
  if (fromIdx < 0 || toIdx < 0) return;
  const movedDays = p.days.filter((d) => routineOf(d) === fromKey);
  const rest = p.days.filter((d) => routineOf(d) !== fromKey);
  const wasBefore = fromIdx < toIdx;
  let insertAt;
  if (wasBefore) insertAt = rest.reduce((last, d, i) => (routineOf(d) === toKey ? i + 1 : last), rest.length);
  else { insertAt = rest.findIndex((d) => routineOf(d) === toKey); if (insertAt === -1) insertAt = rest.length; }
  rest.splice(insertAt, 0, ...movedDays);
  p.days = rest;
}

/* Rutina B — transcripción literal del documento J2 («Entrenamiento Jose Miguel Posada») */
function routineBDays() {
  const ex = (name, muscle, rest, ss, notes, s) => ({ id: uid(), name, muscle, rest, superset: ss || "", notes: notes || "", video: "", sets: s });
  const n = (reps, rir) => ["normal", reps, rir];
  const rp = (reps, rir) => ["restpause", reps, rir];
  const dr = (reps, rir) => ["drop", reps, rir];
  const am = (reps, rir) => ["amrap", reps, rir];
  const day = (name, exs) => ({ id: uid(), name, routine: ROUTINE_B, exs });
  return [
    day("Empujes 1", [
      ex("Press Inclinado con Agarre Neutro", "Pecho", 120, "", "Tras la última serie, un rest-pause: descansa 10 s y vuelve al fallo con el mismo peso.", sets([n("6-10", "1"), n("11-14", "0"), rp("Al fallo", "0")])),
      ex("Press de Banca Plano con Barra", "Pecho", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Crucifix Lateral", "Pecho", 90, "", "", sets([n("6-9", "0"), n("10-14", "0"), n("10-14", "0")])),
      ex("Cruce de Polea Ascendente Bilateral", "Pecho", 90, "", "Después de las dos series, dos drop-sets: el primero con concéntricas de 5 s hasta RIR 0; el segundo con concéntricas explosivas y excéntricas de 5 s, hasta el fallo concéntrico.", sets([n("6-10", "1"), n("11-14", "0"), dr("Al fallo", "0"), dr("Al fallo", "0")])),
      ex("Elevación Lateral con Mancuernas en Banco Inclinado", "Hombro", 90, "", "Después de la última serie, repeticiones parciales hasta el fallo.", sets([n("10-12", ""), am("12-16", "0")])),
      ex("Press Militar en Máquina", "Hombro", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Extensión de Tríceps Unilateral en Polea (hombro en flexión)", "Tríceps", 90, "", "Deja la polea detrás de tu espalda, a la altura de la oreja, con el hombro en flexión. Una mano por vez.", sets([n("10-12", "0"), n("10-12", "0"), n("10-12", "0")])),
    ]),
    day("Tirones 1", [
      ex("Jansen Row con Mancuernas en Banco Inclinado", "Espalda", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Remo con Barra en Multipower Dead Stop", "Espalda", 120, "", "Cada repetición arranca desde el suelo, sin rebote.", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Máquina Pull Down", "Espalda", 120, "", "", sets([n("6-10", "1"), n("11-14", "1-0"), n("11-14", "1-0")])),
      ex("Remo en Polea Sentado con Agarre Supino", "Espalda", 120, "", "", sets([n("6-10", "1"), n("11-14", "1-0"), n("11-14", "1-0")])),
      ex("Rack Pull", "Espalda", 120, "", "", sets([n("8-10", "2"), n("8-10", "2")])),
      ex("Encogimiento con Mancuernas en Banco Ligeramente Inclinado", "Espalda", 90, "", "", sets([n("8", "1-0"), n("8", "1-0")])),
      ex("Curl Bayesian con Cuerda y Agarre Neutro", "Bíceps", 90, "", "", sets([n("8-10", "0"), n("11-14", "0")])),
      ex("Curl Predicador", "Bíceps", 90, "", "", sets([n("6-9", "0"), n("10-14", "0")])),
    ]),
    day("Pierna 1", [
      ex("Aductor en Máquina", "Glúteo", 90, "", "", sets([n("6-10", "0"), n("11-14", "0")])),
      ex("Extensión de Cuádriceps", "Cuádriceps", 90, "", "", sets([n("6-10", "0"), n("11-14", "0")])),
      ex("Prensa Inclinada", "Cuádriceps", 120, "", "", sets([n("6-10", "1"), n("11-16", "0")])),
      ex("Sentadilla Pendular o Frontal", "Cuádriceps", 120, "", "El «o» son opciones: pendular o frontal, la que prefieras.", sets([n("8-10", "1"), n("6-8", "")])),
      ex("Femoral Sentado", "Femoral", 120, "Peso Muerto Rumano", "Superserie con peso muerto rumano: al terminar, pasa al rumano sin descanso.", sets([n("6-10", "1"), n("11-16", "0")])),
      ex("Peso Muerto Rumano", "Femoral", 120, "Femoral Sentado", "Segunda parte de la superserie con femoral sentado.", sets([n("10-12", ""), n("10-12", "")])),
      ex("Gemelo de Pie", "Gemelo", 90, "", "", sets([n("12-15", "0"), n("12-15", "0"), n("12-15", "0")])),
    ]),
    day("Empujes 2", [
      ex("Press Tras Nuca en Multipower", "Hombro", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Elevación Lateral en Polea con Muñequera", "Hombro", 90, "", "Coloca la polea a la altura de donde cae la mano y trabaja con muñequera.", sets([n("11-14", "0"), n("11-14", "0")])),
      ex("Contractora", "Pecho", 90, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Fondos", "Pecho", 120, "", "La segunda serie es con peso corporal hasta el fallo.", sets([n("6-9", ""), am("Al fallo", "0")])),
      ex("Press Neutro Inclinado Convergente", "Pecho", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Elevación Lateral Parcial Sentado con Mancuernas", "Hombro", 90, "", "Repeticiones parciales hasta el fallo total en las dos series.", sets([am("Fallo total", "0"), am("Fallo total", "0")])),
      ex("Press de Tríceps con Dead Stop en Multipower", "Tríceps", 120, "", "Cada repetición arranca desde los topes, sin rebote.", sets([n("6-10", "1"), n("11-14", "1")])),
      ex("Extensión de Tríceps con Polea por Encima de la Cabeza", "Tríceps", 90, "", "", sets([n("6-10", "1"), n("11-14", "0"), n("11-14", "0")])),
    ]),
    day("Tirones 2", [
      ex("Remo T con Agarre Prono", "Espalda", 120, "", "", sets([n("6-10", "1"), n("11-14", "")])),
      ex("Seal Row", "Espalda", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Jalón al Pecho con Agarre Neutro Amplio", "Espalda", 120, "", "Agarre más amplio que el ancho biacromial y cadera en anteversión.", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Pull Over de Pie con Polea", "Espalda", 90, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Pájaro en Máquina Contractora", "Hombro", 90, "", "Deltoides posterior.", sets([n("6-10", "1"), n("11-14", "0"), n("11-14", "0")])),
      ex("Curl de Bíceps Alterno con Mancuernas", "Bíceps", 90, "", "", sets([n("6-10", "1"), n("11-14", "0"), n("11-14", "0")])),
      ex("Curl de Bíceps Concentrado a un Brazo", "Bíceps", 90, "", "", sets([n("11-14", "0"), n("11-14", "0"), n("11-14", "0")])),
    ]),
    day("Pierna 2", [
      ex("Peso Muerto Rumano con Barra", "Femoral", 120, "", "", sets([n("6-10", "1"), n("11-14", "1")])),
      ex("Zancadas en Multipower", "Cuádriceps", 120, "", "", sets([n("6-10", "1"), n("11-14", "0")])),
      ex("Hip Thrust", "Glúteo", 120, "", "", sets([n("6-8", "1"), n("6-8", "1")])),
      ex("Femoral Sentado", "Femoral", 90, "", "", sets([n("6-10", "0"), n("11-14", "0")])),
      ex("Prensa con Pies Arriba de la Plataforma y Abiertos", "Glúteo", 120, "", "", sets([n("6-10", "1"), n("11-14", "1")])),
      ex("Extensión de Cuádriceps", "Cuádriceps", 90, "Sentadilla Sissy", "Superserie con sentadilla sissy: al terminar, pasa a la sissy sin descanso.", sets([n("15+", "0"), n("15+", "0")])),
      ex("Sentadilla Sissy", "Cuádriceps", 90, "Extensión de Cuádriceps", "Peso corporal hasta el fallo, con la cadera en extensión. Segunda parte de la superserie.", sets([am("Al fallo", "0"), am("Al fallo", "0")])),
      ex("Gemelo de Pie", "Gemelo", 90, "", "", sets([n("12-14", "0"), n("12-14", "0"), n("12-14", "0")])),
    ]),
  ];
}

/* ============================================================
   Mesociclos: el plan puede tener VARIOS mesociclos (fases del año,
   bloques distintos), cada uno con su propio nombre y su propia lista
   de semanas. Solo uno está "en curso" a la vez — de ahí sale la semana
   activa que ve el alumno. Cada semana puede fijar reps y RIR distintos
   por ejercicio (eso se edita dentro del ejercicio, sin tocar acá); si
   no los fija, se usan los del ejercicio. Una semana puede marcarse como
   descarga (deload).
   Migración: los planes viejos tenían un solo `plan.meso = {weeks, current}`
   plano (sin agrupar en mesociclos) — `mesoStateOf` lo envuelve en un
   único "Mesociclo 1" sin tocar los IDs de semana, así los objetivos por
   semana ya cargados en cada ejercicio (`ex.weekly[weekId]`) se preservan
   intactos, sin necesidad de migrar esos datos también.
   ============================================================ */
const emptyMeso = () => ({
  weeks: [{ id: uid(), name: "Semana 1", deload: false }],
  current: 0,
});
const mesoOf = (plan) => (plan && plan.meso && Array.isArray(plan.meso.weeks) && plan.meso.weeks.length ? plan.meso : emptyMeso());
const emptyMesociclo = (name) => ({ id: uid(), name: name || "Mesociclo 1", notes: "", weeks: [{ id: uid(), name: "Semana 1", deload: false }], current: 0 });
const emptyMesoState = () => { const m = emptyMesociclo("Mesociclo 1"); return { mesociclos: [m], currentMesoId: m.id }; };
const mesoStateOf = (plan) => {
  if (plan && plan.mesoState && Array.isArray(plan.mesoState.mesociclos) && plan.mesoState.mesociclos.length) return plan.mesoState;
  if (plan && plan.meso && Array.isArray(plan.meso.weeks) && plan.meso.weeks.length) {
    const m = { id: uid(), name: "Mesociclo 1", notes: "", weeks: plan.meso.weeks, current: plan.meso.current || 0 };
    return { mesociclos: [m], currentMesoId: m.id };
  }
  return emptyMesoState();
};
const currentMesociclo = (plan) => {
  const st = mesoStateOf(plan);
  return st.mesociclos.find((m) => m.id === st.currentMesoId) || st.mesociclos[0];
};
const currentWeek = (plan) => {
  const m = currentMesociclo(plan);
  return m.weeks[Math.min(m.current || 0, m.weeks.length - 1)];
};
/* Reps y RIR objetivo de una serie para la semana activa: si la semana tiene
   valores propios para ese ejercicio manda la semana; si no, el del ejercicio. */
function setTargets(ex, setIdx, week) {
  const s = ex.sets[setIdx] || {};
  const w = week && ex.weekly && ex.weekly[week.id];
  const row = w && w[setIdx];
  return {
    repsT: row && row.repsT !== undefined && row.repsT !== "" ? row.repsT : s.repsT,
    rirT: row && row.rirT !== undefined && row.rirT !== "" ? row.rirT : s.rirT,
    overridden: !!(row && ((row.repsT ?? "") !== "" || (row.rirT ?? "") !== "")),
  };
}

const emptyPlan = () => ({ days: [], library: [], nutrition: { kcal: 0, p: 0, c: 0, f: 0, notes: "", meals: [] }, instructions: [], schedule: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }, events: [], athlete: emptyAthlete(), meso: emptyMeso(), mesoState: emptyMesoState(), updatedAt: todayISO() });
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
        ex("Jalón Prono", "Espalda", 120, "", "", TRAINING_B_VIDEOS[0], sets([n("10-12","0"), n("8-10","0")])),
        ex("Jalón Unilateral Neutro/Supino", "Espalda", 120, "", "El «/» son opciones: agarre neutro o supino.", TRAINING_B_VIDEOS[1], sets([n("10-12","0"), n("8-10","0")])),
        ex("Remo en máquina tipo T con apoyo en el pecho", "Espalda", 120, "", "Sin impulso lumbar; pausa de 1 s atrás.", TRAINING_B_VIDEOS[2], sets([n("10-12","0"), n("8-10","0")])),
        ex("Pullover en Polea", "Espalda", 90, "", "Brazos casi rectos, siente el estiramiento del dorsal.", TRAINING_B_VIDEOS[3], sets([n("10-12","0"), n("8-10","0")])),
        ex("Remo Bajo con Triángulo", "Espalda", 120, "", "", TRAINING_B_VIDEOS[4], sets([n("10-12","0"), n("8-10","0")])),
        ex("Aperturas inversas en polea", "Hombro", 90, "", "Deltoides posterior.", TRAINING_B_VIDEOS[5], sets([n("10-12","0"), n("10-12","0"), n("10-12","0")])),
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
      { id: uid(), title: "Datos y cronograma", body: "27 años · 1,77 m · categoría Mens Physique. Peso inicial 83 → peso actual 90. Bloque de 4 semanas. Cronograma: Lunes A · Martes B · Miércoles C · Viernes D · Sábado E (jueves y domingo, descanso). Cardio suave ~120 bpm según indique el coach." },
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
// y añade la Rutina B (documento J2) a continuación de la Rutina A.
function seedPlanWithSchedule() {
  const p = seedPlan();
  const [A, B, C, D, E] = p.days.map((d) => d.id);
  p.schedule = { mon: A, tue: B, wed: C, thu: null, fri: D, sat: E, sun: null };
  p.days = p.days.map((d) => ({ ...d, routine: routineOf(d) })).concat(routineBDays());
  return p;
}
const emptyHistory = () => ({ byEx: {}, sessions: [], bodyweight: [], bodyPhotos: [] });

/* ============================================================
   Base de conocimiento de culturismo
   Datos de referencia que usa el agente de IA y que también se
   muestran en pantalla (sirven aunque no haya API key configurada).
   Son rangos orientativos de la literatura de hipertrofia, no dogma:
   el punto de partida se ajusta siempre con la respuesta del atleta.
   ============================================================ */

// Series efectivas por grupo muscular y semana.
// MEV = mínimo para estimular · MAV = rango donde se progresa mejor · MRV = techo recuperable.
const BB_VOLUME_REF = {
  Pecho:      { mev: 8,  mav: [12, 20], mrv: 22, freq: "2×/sem" },
  Espalda:    { mev: 10, mav: [14, 22], mrv: 25, freq: "2-3×/sem" },
  Hombro:     { mev: 8,  mav: [16, 24], mrv: 26, freq: "2-3×/sem" },
  Bíceps:     { mev: 6,  mav: [10, 18], mrv: 20, freq: "2-3×/sem" },
  Tríceps:    { mev: 6,  mav: [10, 18], mrv: 20, freq: "2-3×/sem" },
  Cuádriceps: { mev: 8,  mav: [12, 18], mrv: 20, freq: "2×/sem" },
  Femoral:    { mev: 6,  mav: [10, 16], mrv: 18, freq: "2×/sem" },
  Glúteo:     { mev: 4,  mav: [8, 16],  mrv: 18, freq: "2×/sem" },
  Gemelo:     { mev: 6,  mav: [10, 16], mrv: 20, freq: "2-3×/sem" },
  Core:       { mev: 4,  mav: [8, 16],  mrv: 20, freq: "2-3×/sem" },
  Antebrazo:  { mev: 2,  mav: [6, 12],  mrv: 16, freq: "2×/sem" },
};

// Fases de un ciclo de culturismo
const BB_PHASES = [
  { id: "volumen", label: "Volumen (lean bulk)", kcal: "+10 a +20 % sobre mantención",
    rate: "+0,25 a +0,5 % del peso corporal por semana", prot: "1,6–2,2 g/kg",
    note: "Ganar más rápido no da más músculo: solo más grasa que después hay que perder. Progresión de carga como métrica principal." },
  { id: "definicion", label: "Definición (cutting)", kcal: "−15 a −25 % bajo mantención",
    rate: "−0,5 a −1 % del peso corporal por semana", prot: "2,0–2,6 g/kg",
    note: "Mantener la intensidad (kg en barra) y recortar volumen antes que intensidad. Cardio como herramienta, no como castigo." },
  { id: "mantencion", label: "Mantención / recomposición", kcal: "≈ mantención (±5 %)",
    rate: "Peso estable ±0,25 %", prot: "1,8–2,4 g/kg",
    note: "Fase útil tras una definición larga: restaurar hormonas, rendimiento y adherencia antes del siguiente bloque." },
  { id: "prep", label: "Preparación a competencia", kcal: "Déficit escalonado, ajustado semanalmente",
    rate: "−0,5 a −0,7 % semanal, más lento al final", prot: "2,2–2,8 g/kg",
    note: "16–24 semanas según el punto de partida. Nunca dejar la puesta a punto para las últimas 4 semanas." },
];

// Categorías de competencia (federaciones tipo IFBB/NPC)
const BB_CATEGORIES = [
  { id: "bikini", label: "Bikini", focus: "Glúteo y deltoide redondeado, cintura estrecha, espalda con forma pero sin densidad excesiva." },
  { id: "wellness", label: "Wellness", focus: "Tren inferior dominante (cuádriceps y glúteo) sobre un tren superior más contenido." },
  { id: "figure", label: "Figure", focus: "Forma en V: dorsal ancho, hombro redondo, cintura marcada, piernas trabajadas sin exceso." },
  { id: "wphysique", label: "Women's Physique", focus: "Más densidad y separación muscular que Figure, con poses de culturismo." },
  { id: "mensphysique", label: "Men's Physique", focus: "Hombro-dorsal-cintura. No se juzgan piernas: prioridad a deltoide lateral, dorsal ancho y abdomen." },
  { id: "classic", label: "Classic Physique", focus: "Estética clásica con límite de peso por estatura: cintura fina, pecho y muslo completos, sin sobredimensión." },
  { id: "open", label: "Bodybuilding Open", focus: "Densidad, tamaño y condición máximos, simetría y detalle en todos los grupos." },
];

// Puesta a punto de la última semana
const BB_PEAK_WEEK = [
  "Llegar a semana −1 ya en condición: la peak week afina, no arregla una definición incompleta.",
  "Mantener sodio y agua estables toda la semana; los cortes agresivos aplanan más de lo que secan.",
  "Bajar volumen de entrenamiento ~50 % y eliminar excéntricas duras desde 5–7 días antes.",
  "Carga de carbohidratos progresiva 2–3 días antes, ajustada por aspecto visual, no por planilla fija.",
  "Ensayar posing a diario: la condición se muestra, y el posing gasta menos glucógeno si está automatizado.",
  "Nada nuevo en semana de competencia: ni suplementos, ni comidas, ni bronceado sin probar.",
];

// Suplementación ordenada por peso de la evidencia
const BB_SUPPS = [
  { tier: "Evidencia sólida", items: [
    "Creatina monohidrato · 3–5 g/día, todos los días, con o sin carga.",
    "Proteína en polvo · herramienta para llegar a 1,6–2,2 g/kg, no un suplemento mágico.",
    "Cafeína · 3–6 mg/kg unos 45–60 min antes; cuidar el sueño y ciclar para no perder efecto.",
    "Beta-alanina · 3–6 g/día, útil en series largas (60–240 s de esfuerzo).",
  ]},
  { tier: "Evidencia moderada / contextual", items: [
    "Citrulina malato · 6–8 g pre-entreno, efecto pequeño sobre repeticiones.",
    "Vitamina D · solo si hay déficit confirmado por análisis.",
    "Omega-3 · útil si la ingesta de pescado es baja.",
    "Electrolitos y multivitamínico · relevantes en definiciones prolongadas.",
  ]},
  { tier: "Poca o nula evidencia", items: [
    "BCAA/EAA aislados cuando ya se cubre la proteína diaria.",
    "«Boosters» de testosterona y quemadores de grasa.",
    "Glutamina para hipertrofia en personas sanas.",
  ]},
];

// Cómo diagnosticar un estancamiento antes de cambiar la rutina
const BB_PLATEAU = [
  "¿Hay adherencia real? Sesiones completadas y series registradas antes que cualquier rediseño.",
  "¿Hay superávit/déficit acorde a la fase? Sin energía no hay progresión de carga.",
  "¿Duerme 7–9 h? El sueño es la variable de recuperación más subestimada.",
  "¿El RIR anotado es honesto? Un RIR 2 declarado que en realidad es RIR 5 explica la mayoría de los estancamientos.",
  "¿El volumen está por encima del MRV? Más series no compensan una recuperación desbordada: probar deload.",
  "¿La técnica cambió al subir carga? Rango incompleto = estímulo menor aunque el número suba.",
];

const emptyAthlete = () => ({
  sex: "", age: "", height: "", weight: "", bf: "", years: "", level: "intermedio",
  phase: "volumen", category: "", compDate: "", weakPoints: [], injuries: "",
  daysWeek: "", sessionMin: "", equipment: "", notes: "",
});

/* Convierte los días que devuelve la IA (o el importador) al formato interno del plan */
function daysFromAIJson(rawDays) {
  return (rawDays || []).map((d) => ({
    id: uid(),
    name: d.name || "Día sin nombre",
    exs: (d.exs || []).map((e) => ({
      id: uid(),
      name: e.name || "Ejercicio",
      muscle: e.muscle || "Otro",
      rest: +e.rest || 90,
      notes: e.notes || "",
      video: "",
      superset: e.superset || "",
      coachAttachIds: [],
      attachIds: [],
      sets: ((e.sets && e.sets.length) ? e.sets : [{ type: "normal", repsT: "8-10", rirT: "" }]).map((s) => ({
        id: uid(),
        type: Object.keys(SET_TYPES).includes(s.type) ? s.type : "normal",
        repsT: String(s.repsT || "8-10"),
        rirT: s.rirT != null ? String(s.rirT) : "",
        pct: 15,
      })),
    })),
  }));
}

/* Reparte las series efectivas de un ejercicio entre su músculo principal
   (crédito completo) y los músculos secundarios que haya marcado el coach
   (crédito parcial, según el % de cada uno). Un ejercicio de espalda que
   también marque trapecio al 50 % suma sus series completas a Espalda y la
   mitad a Trapecio. */
function addExerciseVolume(perMuscle, ex) {
  const eff = (ex.sets || []).filter((s) => s.type !== "warmup").length;
  if (!eff) return;
  const m = ex.muscle || "Otro";
  perMuscle[m] = (perMuscle[m] || 0) + eff;
  (ex.secondary || []).forEach((sec) => {
    if (!sec || !sec.muscle || sec.muscle === m) return;
    const frac = (sec.pct != null ? sec.pct : 50) / 100;
    perMuscle[sec.muscle] = (perMuscle[sec.muscle] || 0) + eff * frac;
  });
}

const statusFor = (sets, ref) => {
  if (!ref) return "sin referencia";
  if (sets < ref.mev) return "bajo";
  if (sets < ref.mav[0]) return "mínimo";
  if (sets <= ref.mav[1]) return "óptimo";
  if (sets <= ref.mrv) return "alto";
  return "sobre MRV";
};

/* Series efectivas por grupo muscular para UN día (sesión) puntual —
   incluye el aporte parcial de músculos secundarios. */
function volumeByMuscleForDay(day) {
  const perMuscle = {};
  (day.exs || []).forEach((ex) => addExerciseVolume(perMuscle, ex));
  const rows = Object.entries(perMuscle)
    .map(([muscle, sets]) => ({ muscle, sets, ref: BB_VOLUME_REF[muscle], status: statusFor(sets, BB_VOLUME_REF[muscle]) }))
    .sort((a, b) => b.sets - a.sets);
  const totalSets = (day.exs || []).reduce((a, e) => a + (e.sets || []).filter((s) => s.type !== "warmup").length, 0);
  return { rows, totalSets };
}

/* Series efectivas por grupo muscular.
   Si el plan tiene cronograma semanal, cuenta lo que realmente toca cada semana;
   si no, cuenta una vuelta completa a la rutina. Incluye el aporte parcial de
   músculos secundarios marcados en cada ejercicio. */
function volumeByMuscle(plan) {
  const perMuscle = {};
  const add = (day) => { (day.exs || []).forEach((ex) => addExerciseVolume(perMuscle, ex)); };
  const sched = plan.schedule || {};
  const scheduledIds = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((k) => sched[k]).filter(Boolean);
  let basis = "semana";
  if (scheduledIds.length) {
    scheduledIds.forEach((id) => {
      const day = (plan.days || []).find((d) => d.id === id);
      if (day) add(day);
    });
  } else {
    basis = "ciclo";
    (plan.days || []).forEach(add);
  }
  const rows = Object.entries(perMuscle)
    .map(([muscle, sets]) => ({ muscle, sets, ref: BB_VOLUME_REF[muscle], status: statusFor(sets, BB_VOLUME_REF[muscle]) }))
    .sort((a, b) => b.sets - a.sets);
  return { basis, rows, total: rows.reduce((a, r) => a + r.sets, 0) };
}

const VOL_COLORS = { bajo: P.red, mínimo: P.ember2, óptimo: P.green, alto: P.ember2, "sobre MRV": P.red, "sin referencia": P.faint };

/* ============================================================
   Átomos de interfaz
   ============================================================ */
const GlobalStyle = () => (
  <style>{`
    /* Pareja tipográfica seria/profesional: Archivo (peso alto) para
       títulos — grotesca sobria, con autoridad, sin aire "poster" — e
       Inter para el cuerpo, el estándar de legibilidad y seriedad en
       producto. Nada de condensadas ni geométricas redondeadas. */
    @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; }
    html, body, #root { min-height: 100%; min-height: 100dvh; }
    body { overflow-x: hidden; overscroll-behavior: none; }
    .fj { min-height: 100vh; min-height: 100dvh; padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);
      font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; color: ${P.text}; font-variant-numeric: tabular-nums;
      line-height: 1.42; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    .fj h1,.fj h2,.fj .disp { font-family: 'Archivo','Inter',ui-sans-serif,sans-serif; letter-spacing: -.01em; }
    .fj input, .fj textarea, .fj select {
      background: ${P.s3}; border: 1px solid ${P.line}; color: ${P.text};
      border-radius: 12px; font-family: inherit; font-size: 15.5px; outline: none;
      box-shadow: 0 1px 3px rgba(0,0,0,.4) inset;
    }
    .fj input:focus-visible, .fj textarea:focus-visible, .fj select:focus-visible, .fj button:focus-visible {
      outline: 2px solid ${P.ember}; outline-offset: 1px;
    }
    .fj input::placeholder, .fj textarea::placeholder { color: ${P.faint}; }
    .fj button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
    .fj ::-webkit-scrollbar { width: 6px; height: 6px; }
    .fj ::-webkit-scrollbar-thumb { background: ${P.line}; border-radius: 3px; }
    @keyframes fjQuench { 0% { background-color: rgba(255,255,255,.35); } 100% { background-color: rgba(255,255,255,.10); } }
    .fj .quench { animation: fjQuench .9s ease forwards; }
    @keyframes fjPulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    .fj .pulse { animation: fjPulse 1.6s ease-in-out infinite; }
    @keyframes fjUp { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
    .fj .sheetIn { animation: fjUp .22s ease; }
    /* Splash de arranque: el fondo entra con un fundido suave, el ícono
       "golpea" hacia su tamaño final con un leve rebote, un anillo rojo se
       expande como onda de impacto, y el nombre converge desde letras
       separadas. La salida (fundido a 0 + achique leve) la controla React
       vía la prop "exiting" con una transición inline, no un keyframe. */
    @keyframes splashFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .fj .splashFadeIn { animation: splashFadeIn .7s ease both; }
    @keyframes splashIcon { 0% { transform: scale(0) rotate(-10deg); opacity: 0; }
      55% { transform: scale(1.14) rotate(3deg); opacity: 1; }
      75% { transform: scale(.95) rotate(-1deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
    .fj .splashIcon { animation: splashIcon 1.2s cubic-bezier(.2,.9,.3,1.2) both; }
    @keyframes splashRing { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(2.6); opacity: 0; } }
    .fj .splashRing { animation: splashRing 1.05s ease-out .7s both; }
    @keyframes splashWord { 0% { opacity: 0; transform: translateY(8px); letter-spacing: .5em; }
      100% { opacity: 1; transform: translateY(0); letter-spacing: .22em; } }
    .fj .splashWord { animation: splashWord .9s ease .95s both; }
    @keyframes splashTag { from { opacity: 0; } to { opacity: 1; } }
    .fj .splashTag { animation: splashTag .6s ease 1.7s both; }
    @media (prefers-reduced-motion: reduce) { .fj * { animation: none !important; transition: none !important; } }
    /* Mientras se arrastra un día/ejercicio/rutina para reordenar, la barra
       inferior fija (TabBar) queda "transparente" al puntero: si no, al
       arrastrar hacia la parte baja de la pantalla, elementFromPoint choca
       con la barra (que está encima en el z-index) en vez de con la tarjeta
       de abajo, y soltar ahí nunca aplica el cambio de orden. */
    body.fj-dragging [data-tabbar] { pointer-events: none; }
  `}</style>
);

// `rest` deja pasar data-*, manejadores de puntero y demás: sin eso, cualquier
// interacción que se le cuelgue a una Card se pierde en silencio.
// Sombra + reflejo superior sutil: da a las tarjetas un relieve suave
// ("3D discreto") en vez de quedar completamente planas sobre el fondo.
// Con el fondo ahora en degradado (ya no negro plano), las tarjetas necesitan
// más separación para no perderse contra las zonas más claras/rojizas del
// fondo: sombra inferior más profunda + un halo sutil detrás de cada tarjeta.
const CARD_LIFT = "0 1px 0 rgba(255,255,255,.07) inset, 0 14px 34px -14px rgba(0,0,0,.92), 0 0 0 1px rgba(0,0,0,.35)";
// Efecto "3D" de la ficha que se está arrastrando: se agranda, se levanta
// (translateY negativo) y una sombra profunda + anillo rojo la separan del
// resto, como si se despegara de la pantalla hacia el usuario.
const DRAG_LIFT_TRANSFORM = "scale(1.07) translateY(-6px)";
const DRAG_LIFT_SHADOW = "0 0 0 2px rgba(224,26,26,.55), 0 30px 54px -14px rgba(0,0,0,.8)";
const Card = ({ children, style, onClick, ...rest }) => (
  <div {...rest} onClick={onClick} style={{ background: P.s1, border: `1px solid ${P.line}`, borderRadius: 18,
    boxShadow: CARD_LIFT, ...style }}>{children}</div>
);

// `rest` deja pasar title, aria-label y demás: sin eso, un botón que solo
// lleva icono se queda sin nombre accesible.
const Btn = ({ children, kind = "ghost", onClick, style, disabled, small, ...rest }) => {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 13, fontWeight: 600, fontSize: small ? 13 : 16,
    padding: small ? "7px 11px" : "13px 19px", opacity: disabled ? 0.45 : 1, transition: "filter .15s, transform .1s" };
  const kinds = {
    // Degradado de 3 puntos (no un solo rojo plano) + brillo interior arriba
    // y sombra de color abajo: se lee como un botón con volumen, no un parche.
    ember: { background: `linear-gradient(160deg, #FF4747, ${P.ember} 55%, #7A0808)`, color: "#FFFFFF",
      boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 10px 22px -8px rgba(255,40,60,.55)" },
    ghost: { background: `linear-gradient(165deg, ${P.s3}, ${P.s2})`, border: `1px solid ${P.line}`, color: P.text,
      boxShadow: "0 1px 0 rgba(255,255,255,.07) inset, 0 6px 16px -10px rgba(0,0,0,.7)" },
    line:  { background: "transparent", border: `1px solid ${P.line}`, color: P.dim },
    green: { background: "rgba(255,255,255,.10)", border: `1px solid rgba(255,255,255,.32)`, color: P.green,
      boxShadow: "0 1px 0 rgba(255,255,255,.14) inset" },
    red:   { background: "rgba(224,26,26,.14)", border: `1px solid rgba(224,26,26,.45)`, color: P.red },
  };
  return <button {...rest} disabled={disabled} onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>;
};

const TypeBadge = ({ type, onInfo, big }) => {
  const t = SET_TYPES[type] || SET_TYPES.normal;
  return (
    <button onClick={onInfo} title={t.label}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${t.color}22`,
        color: t.color, border: `1px solid ${t.color}55`, borderRadius: 7, padding: big ? "4px 9px" : "3px 8px",
        fontSize: big ? 13 : 11.5, fontWeight: 700, letterSpacing: ".05em" }}>
      {t.short}{onInfo && <Info size={big ? 12 : 10} strokeWidth={2.5} />}
    </button>
  );
};

const Sheet = ({ open, onClose, title, children, tall }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,3,3,.68)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <div className="sheetIn" onClick={(e) => e.stopPropagation()}
        style={{ background: `${P.s1}F2`, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderTop: `1px solid ${P.line}`, borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 520,
          boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 -18px 40px rgba(0,0,0,.5)",
          maxHeight: tall ? "calc(100dvh - env(safe-area-inset-top) - 8px)" : "82dvh", minHeight: "60dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", paddingTop: "max(14px, env(safe-area-inset-top))", borderBottom: `1px solid ${P.line}`, flexShrink: 0 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 20, textTransform: "uppercase" }}>{title}</h2>
          <button onClick={onClose} style={{ color: P.dim, padding: 6 }}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 18px calc(28px + env(safe-area-inset-bottom))", flex: 1, minHeight: 0 }}>{children}</div>
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
        <div style={{ color: P.dim, fontSize: 15, lineHeight: 1.5, marginBottom: 18 }}>{body}</div>
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
    <div style={{ fontSize: 13, fontWeight: 600, color: P.dim, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 13, color: P.faint, marginTop: 4 }}>{hint}</div>}
  </div>
);

const Inp = (props) => <input {...props} style={{ width: "100%", padding: "10px 12px", ...props.style }} />;
const Txt = (props) => <textarea rows={props.rows || 3} {...props} style={{ width: "100%", padding: "10px 12px", resize: "vertical", ...props.style }} />;

const Empty = ({ icon: Icon, title, body }) => (
  <div style={{ textAlign: "center", padding: "42px 24px", color: P.faint }}>
    <Icon size={34} style={{ marginBottom: 10, opacity: .6 }} />
    <div style={{ fontWeight: 600, color: P.dim, marginBottom: 5 }}>{title}</div>
    <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{body}</div>
  </div>
);

const Logo = ({ size = 26 }) => (
  <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6, lineHeight: 1 }}>
    <div style={{ width: size + 14, height: size + 14, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
      background: "#FFFFFF", boxShadow: "0 2px 14px rgba(255,255,255,.20)" }}>
      {/* Mancuerna en negro sobre placa blanca: contraste blanco y negro puro. */}
      <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} aria-hidden="true">
        <g fill="#0B0B0C">
          <rect x="8" y="10.6" width="8" height="2.8" rx="1" />
          <rect x="2.5" y="8.2" width="2" height="7.6" rx="0.7" />
          <rect x="5" y="6.6" width="2.5" height="10.8" rx="0.9" />
          <rect x="16.5" y="6.6" width="2.5" height="10.8" rx="0.9" />
          <rect x="19.5" y="8.2" width="2" height="7.6" rx="0.7" />
        </g>
      </svg>
    </div>
    <div className="disp" style={{ fontSize: size * 0.72, fontWeight: 700, letterSpacing: ".18em", color: P.text }}>FORJA</div>
  </div>
);

// Splash de arranque: el fondo entra con un fundido, el ícono aparece con un
// golpe/rebote y una onda roja de impacto, y el nombre converge después.
// Toda la coreografía dura ~2.3s y la salida (cuando `exiting` se activa
// desde App) es otro fundido suave de .7s — nunca un corte abrupto. El total
// (entrada + espera + salida) queda bajo el límite de 4s. Respeta
// prefers-reduced-motion (regla global).
const SplashScreen = ({ exiting }) => (
  <div className="fj splashFadeIn" style={{ minHeight: "100vh", minHeight: "100dvh", background: P.bgGrad, display: "flex", alignItems: "center", justifyContent: "center",
    opacity: exiting ? 0 : 1, transform: exiting ? "scale(.97)" : "scale(1)", transition: "opacity .7s ease, transform .7s ease" }}>
    <GlobalStyle />
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: 74, height: 74, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="splashRing" style={{ position: "absolute", inset: 0, borderRadius: "50%",
          border: `2px solid ${P.ember}`, boxShadow: `0 0 30px 6px ${P.glow}` }} />
        <div className="splashIcon" style={{ width: 74, height: 74, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#FFFFFF", boxShadow: "0 8px 30px rgba(255,255,255,.25)" }}>
          <svg viewBox="0 0 24 24" width={40} height={40} aria-hidden="true">
            <g fill="#0C0708">
              <rect x="8" y="10.6" width="8" height="2.8" rx="1" />
              <rect x="2.5" y="8.2" width="2" height="7.6" rx="0.7" />
              <rect x="5" y="6.6" width="2.5" height="10.8" rx="0.9" />
              <rect x="16.5" y="6.6" width="2.5" height="10.8" rx="0.9" />
              <rect x="19.5" y="8.2" width="2" height="7.6" rx="0.7" />
            </g>
          </svg>
        </div>
      </div>
      <div className="disp splashWord" style={{ fontSize: 34, fontWeight: 800, letterSpacing: ".22em", color: P.text }}>FORJA</div>
      <div className="splashTag" style={{ fontSize: 12.5, color: P.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em" }}>
        Entrenamiento · Nutrición · Progreso
      </div>
    </div>
  </div>
);

/* ---------------- Glosario UI ---------------- */
// Quita tildes y pasa a minúsculas, para que buscar "mev" o "número" encuentre
// lo mismo sin importar acentos ni mayúsculas.
const searchNorm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const GlossaryBody = ({ focusId, showTopButton }) => {
  const ref = useRef(null);
  const [q, setQ] = useState("");
  // Solo se ve el título; tocar un término lo abre. Así la guía completa
  // (más de 20 entradas) se puede escanear de un vistazo en vez de tener
  // que hacer scroll por párrafos enteros para encontrar uno.
  const [openIds, setOpenIds] = useState(() => new Set(focusId ? [focusId] : []));
  useEffect(() => {
    if (focusId && ref.current) {
      setOpenIds((s) => (s.has(focusId) ? s : new Set(s).add(focusId)));
      const el = ref.current.querySelector(`[data-g="${focusId}"]`);
      el && el.scrollIntoView({ block: "start" });
    }
  }, [focusId]);
  const nq = searchNorm(q.trim());
  const items = nq ? GLOSSARY.filter((g) => searchNorm(g.term).includes(nq) || searchNorm(g.def).includes(nq) || searchNorm(g.ej).includes(nq)) : GLOSSARY;
  // Al buscar, los resultados se abren solos: si ya escribiste el término
  // exacto, ver la respuesta de inmediato ahorra un toque extra.
  const isOpen = (id) => (nq ? true : openIds.has(id));
  const toggle = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    let node = ref.current && ref.current.parentElement;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 4) node.scrollTo({ top: 0, behavior: "smooth" });
      node = node.parentElement;
    }
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={16} color={P.faint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un término (ej: MEV, RIR, drop set…)"
          aria-label="Buscar en la guía de términos" style={{ width: "100%", padding: "10px 12px 10px 34px", fontSize: 15 }} />
        {q && (
          <button onClick={() => setQ("")} aria-label="Borrar búsqueda"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: P.faint, padding: 4 }}>
            <X size={15} />
          </button>
        )}
      </div>
      {q && <div style={{ fontSize: 13, color: P.faint, marginBottom: 8 }}>{items.length} resultado{items.length !== 1 ? "s" : ""}</div>}
      {items.length === 0 && (
        <div style={{ padding: "24px 8px", textAlign: "center", color: P.faint, fontSize: 14.5 }}>Sin resultados para «{q}».</div>
      )}
      {items.map((g) => {
        const open = isOpen(g.id);
        return (
        <div key={g.id} data-g={g.id} style={{ borderBottom: `1px solid ${P.line}`,
          background: focusId === g.id ? "rgba(255,255,255,.06)" : "transparent", borderRadius: 8, scrollMarginTop: 8 }}>
          <button onClick={() => toggle(g.id)} aria-expanded={open}
            style={{ width: "100%", textAlign: "left", padding: "14px 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 16.5, color: focusId === g.id ? P.ember2 : P.text }}>{g.term}</span>
            {open ? <ChevronUp size={17} color={P.faint} /> : <ChevronDown size={17} color={P.faint} />}
          </button>
          {open && (
            <div style={{ padding: "0 4px 14px" }}>
              <div style={{ fontSize: 15, color: P.dim, lineHeight: 1.55, whiteSpace: "pre-line" }}>{g.def}</div>
              <div style={{ fontSize: 14, color: P.faint, lineHeight: 1.5, marginTop: 7, paddingLeft: 10, borderLeft: `2px solid ${P.line}` }}>
                <span style={{ color: P.ember2, fontWeight: 600 }}>Ejemplo · </span>{g.ej}
              </div>
            </div>
          )}
        </div>
        );
      })}
      {showTopButton && items.length > 4 && (
        <button onClick={scrollToTop} aria-label="Subir al inicio"
          style={{ position: "fixed", right: 16, bottom: "calc(96px + env(safe-area-inset-bottom))", zIndex: 40,
            width: 46, height: 46, borderRadius: 23, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`, color: "#FFFFFF",
            boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 10px 22px -8px rgba(224,26,26,.6)" }}>
          <ChevronUp size={22} />
        </button>
      )}
    </div>
  );
};

/* ============================================================
   Adjuntos
   ============================================================ */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB por video (límite del bucket)
const SB_PROJECT = "https://vzenlmcbftopyjzcltxa.supabase.co";
const SB_BUCKET = "forja-media";

/* Sube un archivo al bucket de Supabase Storage y devuelve su URL pública.
   Los videos ya no viajan como texto dentro de la base: pesaban demasiado. */
async function uploadToBucket(file) {
  const ext = (file.name && file.name.includes(".") ? file.name.split(".").pop() : "")
    .toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type === "video/quicktime" ? "mov" : "mp4");
  const path = `${new Date().toISOString().slice(0, 10)}/${uid()}.${ext}`;
  const r = await fetch(`${SB_PROJECT}/storage/v1/object/${SB_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "x-upsert": "true",
               "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!r.ok) throw new Error(`storage ${r.status}`);
  return `${SB_PROJECT}/storage/v1/object/public/${SB_BUCKET}/${path}`;
}

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
// capture: true = abre la cámara del celular directo (grabar); false = elegir de galería
const AttachButton = ({ onAttached, onAdd, onError, label, mode = "photo", capture, iconOnly, disabled }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const cb = onAttached || onAdd;
  const accept = mode === "video" ? "video/*" : mode === "both" ? "image/*,video/*" : "image/*";
  const Icon = mode === "video" ? Video : Camera;
  const text = label || (mode === "video" ? "Video" : mode === "both" ? "Foto/video" : "Foto");
  return (
    <>
      <input ref={ref} type="file" accept={accept} {...(capture ? { capture: mode === "video" ? "user" : "environment" } : {})} style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const id = uid();
            if (f.type && f.type.startsWith("video")) {
              if (f.size > MAX_VIDEO_BYTES) {
                throw new Error(`El video pesa ${(f.size / 1048576).toFixed(1)} MB. Máximo 50 MB. Recorta o graba a menor resolución. Para videos largos, mejor sube a YouTube/Drive y pega el link.`);
              }
              const objUrl = URL.createObjectURL(f);
              const poster = await videoPoster(objUrl);
              let src = null;
              try {
                src = await uploadToBucket(f);           // 1º: almacenamiento de archivos
              } catch (upErr) {
                if (f.size > 3.5 * 1024 * 1024) {        // 2º: respaldo en la base, solo si es liviano
                  URL.revokeObjectURL(objUrl);
                  throw new Error("No se pudo subir el video al almacenamiento. Revisa la conexión e inténtalo de nuevo.");
                }
                src = await readFileDataUrl(f);
              }
              URL.revokeObjectURL(objUrl);
              const ok = await sSet(`attach:${id}`, { dataUrl: src, poster, kind: "video", date: todayISO() });
              if (!ok) throw new Error("No se pudo guardar el video. Revisa la conexión.");
            } else {
              const dataUrl = await compressImage(f);
              const ok = await sSet(`attach:${id}`, { dataUrl, kind: "image", date: todayISO() });
              if (!ok) throw new Error("No se pudo guardar la foto. Revisa la conexión.");
            }
            cb && cb(id);
          } catch (err) { onError && onError(err.message); }
          finally { setBusy(false); }
        }} />
      {iconOnly ? (
        <button disabled={busy || disabled} title={text} onClick={() => ref.current && ref.current.click()}
          style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: P.s3, border: `1px solid ${P.line}`, color: busy ? P.ember : P.dim, flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
          {busy ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span> : <Icon size={15} />}
        </button>
      ) : (
        <Btn kind="line" small disabled={busy || disabled} onClick={() => ref.current && ref.current.click()}>
          <Icon size={14} /> {busy ? "Subiendo…" : text}
        </Btn>
      )}
    </>
  );
};

// Dictado de voz para cualquier campo de texto: usa el reconocimiento de voz
// del propio navegador (Web Speech API), en español. Va acumulando el texto
// final reconocido y lo entrega vía onResult cada vez que hay una frase
// terminada. No graba ni sube nada: todo pasa en el dispositivo.
const VoiceDictateButton = ({ onResult, onError, disabled }) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = () => {
    if (!supported) { onError && onError("El dictado de voz no está disponible en este navegador."); return; }
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = "es-CL";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) text += ev.results[i][0].transcript;
      }
      if (text.trim()) onResult(text.trim());
    };
    rec.onerror = (ev) => { if (ev.error !== "no-speech" && ev.error !== "aborted") onError && onError("No se pudo escuchar: " + ev.error); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { onError && onError("No se pudo iniciar el dictado."); }
  };

  useEffect(() => () => { recRef.current && recRef.current.stop(); }, []);

  return (
    <button type="button" disabled={disabled} onClick={toggle} title={listening ? "Detener dictado" : "Dictar por voz"}
      aria-label={listening ? "Detener dictado de voz" : "Dictar por voz"}
      style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        background: listening ? `${P.red}22` : P.s3, border: `1px solid ${listening ? P.red : P.line}`, color: listening ? P.red : P.dim }}>
      {listening ? <MicOff size={15} className="pulse" /> : <Mic size={15} />}
    </button>
  );
};

/* ============================================================
   Gráfico de progreso por ejercicio: pestañas de rango, curva de mejor
   peso, racha de sesiones, marca (PR) y tabla serie a serie. Construido
   desde cero sobre history.byEx, sin depender de nada externo.
   ============================================================ */
const PROGRESS_RANGES = [
  { id: "w", label: "7D", days: 7 },
  { id: "m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 182 },
  { id: "y", label: "1A", days: 365 },
  { id: "all", label: "Todo", days: null },
];

const ExerciseProgress = ({ entries }) => {
  const [range, setRange] = useState("3m");
  const all = entries || [];

  // Para cada sesión registrada, el mejor peso levantado, series hechas y
  // reps totales (solo series marcadas como hechas y con peso cargado).
  const withBest = useMemo(() => all.map((en) => {
    const done = (en.sets || []).filter((s) => s.done && s.weight !== "");
    const best = done.length ? Math.max(...done.map((s) => +s.weight)) : null;
    const totalReps = done.reduce((a, s) => a + (+s.reps || 0), 0);
    return { en, best, setsDone: done.length, totalReps };
  }).filter((x) => x.best != null), [all]);

  const rangeDef = PROGRESS_RANGES.find((r) => r.id === range) || PROGRESS_RANGES[2];
  const cutoff = rangeDef.days ? Date.now() - rangeDef.days * 86400000 : null;
  const filtered = cutoff ? withBest.filter((x) => new Date(x.en.date).getTime() >= cutoff) : withBest;

  const chartData = filtered.map((x) => ({ d: fmtDate(x.en.date), v: x.best }));
  const allTimeBest = withBest.length ? Math.max(...withBest.map((x) => x.best)) : null;

  // Delta de últimos 30 días: compara el último registro con el que había
  // vigente justo antes de esa ventana (o con el primero de la ventana, si
  // no hay nada anterior).
  const delta30 = useMemo(() => {
    const cut = Date.now() - 30 * 86400000;
    const recent = withBest.filter((x) => new Date(x.en.date).getTime() >= cut);
    if (!recent.length) return null;
    const before = withBest.filter((x) => new Date(x.en.date).getTime() < cut);
    const refBase = before.length ? before[before.length - 1].best : recent[0].best;
    return recent[recent.length - 1].best - refBase;
  }, [withBest]);

  const rangeDelta = filtered.length >= 2 ? filtered[filtered.length - 1].best - filtered[0].best : null;

  if (withBest.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto" }}>
        {PROGRESS_RANGES.map((r) => (
          <button key={r.id} onClick={() => setRange(r.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 9, fontSize: 13.5, fontWeight: 700,
            background: range === r.id ? P.s3 : "transparent", color: range === r.id ? P.text : P.faint, border: `1px solid ${range === r.id ? P.line : "transparent"}` }}>
            {r.label}
          </button>
        ))}
      </div>

      {chartData.length ? (
        <Card style={{ padding: "14px 8px 6px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 10px 6px", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: P.dim }}>Mejor peso por sesión (kg)</span>
            {rangeDelta != null && (
              <span style={{ fontSize: 13.5, fontWeight: 700, color: rangeDelta >= 0 ? P.ember2 : P.red }}>
                {rangeDelta >= 0 ? "+" : ""}{kg(rangeDelta)} kg · este rango
              </span>
            )}
          </div>
          <ChartBox data={chartData} unit="kg" />
        </Card>
      ) : (
        <div style={{ fontSize: 14, color: P.faint, padding: "10px 2px", marginBottom: 12 }}>Sin sesiones en este rango. Prueba un rango más amplio.</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <Card style={{ padding: "10px 6px", textAlign: "center" }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 700 }}>{withBest.length}</div>
          <div style={{ fontSize: 11, color: P.dim, marginTop: 2 }}>Sesiones</div>
        </Card>
        <Card style={{ padding: "10px 6px", textAlign: "center" }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: delta30 == null ? P.text : delta30 >= 0 ? P.ember2 : P.red }}>
            {delta30 == null ? "—" : `${delta30 >= 0 ? "+" : ""}${kg(delta30)}`}
          </div>
          <div style={{ fontSize: 11, color: P.dim, marginTop: 2 }}>Últimos 30 días</div>
        </Card>
        <Card style={{ padding: "10px 6px", textAlign: "center" }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: P.ember2, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <Award size={14} /> {allTimeBest != null ? kg(allTimeBest) : "—"}
          </div>
          <div style={{ fontSize: 11, color: P.dim, marginTop: 2 }}>Mejor marca</div>
        </Card>
      </div>

      <div style={{ fontSize: 13, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Progreso serie a serie</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ color: P.faint, textAlign: "left" }}>
              <th style={{ padding: "4px 6px", fontWeight: 600 }}>Fecha</th>
              <th style={{ padding: "4px 6px", fontWeight: 600 }}>Series</th>
              <th style={{ padding: "4px 6px", fontWeight: 600 }}>Reps</th>
              <th style={{ padding: "4px 6px", fontWeight: 600 }}>Peso</th>
              <th style={{ padding: "4px 6px", fontWeight: 600 }}>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {[...withBest].reverse().map((x, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? x.best - prev.best : null;
              const isBest = x.best === allTimeBest;
              return (
                <tr key={x.en.sessionId} style={{ borderTop: `1px solid ${P.line}`, background: isBest ? `${P.ember}0c` : "transparent" }}>
                  <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>{fmtDate(x.en.date)}</td>
                  <td style={{ padding: "6px 6px" }}>{x.setsDone}</td>
                  <td style={{ padding: "6px 6px" }}>{x.totalReps}</td>
                  <td style={{ padding: "6px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {kg(x.best)} kg {isBest && <Award size={11} color={P.ember2} style={{ verticalAlign: -1, marginLeft: 2 }} />}
                  </td>
                  <td style={{ padding: "6px 6px", color: diff == null ? P.faint : diff > 0 ? P.ember2 : diff < 0 ? P.red : P.faint }}>
                    {diff == null ? "—" : diff === 0 ? "=" : `${diff > 0 ? "+" : ""}${kg(diff)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
      <>
      <ExerciseProgress entries={entries} />
      {[...entries].reverse().map((en, i) => (
        <div key={i} style={{ padding: "13px 0", borderBottom: `1px solid ${P.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtDateFull(en.date)}</div>
            <div style={{ fontSize: 13, color: P.faint }}>{en.dayName}</div>
          </div>
          {en.sets.filter((s) => s.done).map((s, j) => (
            <div key={j} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 15, padding: "3px 0" }}>
              <TypeBadge type={s.type} />
              <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
              {s.rir !== "" && <span style={{ color: P.dim, fontSize: 13.5 }}>RIR {s.rir}</span>}
              {s.drops && s.drops.length > 0 && (
                <span style={{ color: SET_TYPES.drop.color, fontSize: 13.5 }}>
                  {s.drops.map((d) => `→ ${d.weight || "?"}×${d.reps || "?"}`).join(" ")}
                </span>
              )}
              {s.comment && <span style={{ color: P.ember2, fontSize: 13.5 }}>“{s.comment}”</span>}
            </div>
          ))}
          {en.comment && (
            <div style={{ marginTop: 7, fontSize: 14.5, color: P.ember2, background: "rgba(255,255,255,.07)",
              border: `1px solid rgba(255,255,255,.2)`, borderRadius: 10, padding: "8px 11px", lineHeight: 1.45 }}>
              <MessageSquare size={12} style={{ marginRight: 5, verticalAlign: -1 }} />{en.comment}
            </div>
          )}
          {en.attachIds && en.attachIds.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 9, overflowX: "auto" }}>
              {en.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={58} />)}
            </div>
          )}
        </div>
      ))}
      </>
    )}
  </Sheet>
);

/* ============================================================
   Ficha de técnica: junta en una sola tarjeta lo que antes vivía repartido
   (músculo, indicaciones del coach, video, demostración) y suma un rincón
   nuevo para que el alumno guarde sus propias fotos de forma — una
   referencia fija, a diferencia de las fotos de "Historial" que quedan
   atadas a una sesión puntual.
   ============================================================ */
const ExerciseInfoSheet = ({ ex, open, onClose, onPatchEx, onOpenImg, onError }) => {
  if (!ex) return null;
  const formPhotos = ex.formPhotoIds || [];
  const canEdit = !!onPatchEx;
  const addFormPhoto = (id) => onPatchEx && onPatchEx({ formPhotoIds: [...formPhotos, id].slice(0, 2) });
  const removeFormPhoto = (id) => onPatchEx && onPatchEx({ formPhotoIds: formPhotos.filter((x) => x !== id) });
  return (
    <Sheet open={open} onClose={onClose} title={`Ficha · ${ex.name}`} tall>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: P.s2, border: `1px solid ${P.line}`, color: P.ember2 }}>{ex.muscle}</span>
        {(ex.secondary || []).map((s, i) => (
          <span key={i} style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 9px", borderRadius: 8, background: P.s2, border: `1px solid ${P.line}`, color: P.dim }}>
            {s.muscle} · {s.pct}%
          </span>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Técnica</div>
        {ex.notes ? (
          <div style={{ fontSize: 15, color: P.dim, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{ex.notes}</div>
        ) : (
          <div style={{ fontSize: 14, color: P.faint }}>Tu coach todavía no dejó indicaciones técnicas para este ejercicio.</div>
        )}
      </div>

      {ex.video && (
        <Btn kind="line" small onClick={() => window.open(ex.video, "_blank")} style={{ marginBottom: 16 }}>
          <Video size={14} /> Ver video de técnica
        </Btn>
      )}

      {(ex.coachAttachIds || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Demostración del coach</div>
          <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
            {ex.coachAttachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={78} />)}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Tus fotos de forma (máx. 2)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {formPhotos.map((id) => (
            <AttachThumb key={id} id={id} onOpen={onOpenImg} size={78} onRemove={canEdit ? () => removeFormPhoto(id) : undefined} />
          ))}
          {canEdit && formPhotos.length < 2 && (
            <AttachButton mode="photo" iconOnly onAttached={addFormPhoto} onError={onError} />
          )}
        </div>
        {formPhotos.length === 0 && !canEdit && <div style={{ fontSize: 13.5, color: P.faint }}>Sin fotos todavía.</div>}
      </div>
    </Sheet>
  );
};

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
      background: over ? "rgba(255,255,255,.10)" : `${P.ember}12`, border: `1px solid ${over ? "rgba(255,255,255,.45)" : `${P.ember}44`}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Timer size={16} color={col} className={over ? "" : "pulse"} />
        <span style={{ fontSize: 12.5, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
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
const SetRow = ({ set, idx, last, suggest, onPatch, onToggleDone, onInfo, onOpenImg, onAttachError, restSec, timer, onStartRest, onAdjustRest, onDismissRest }) => {
  const [showCmt, setShowCmt] = useState(false);
  const done = set.done;
  const inp = (field, ph, w) => (
    <input type="number" inputMode="decimal" step="any" placeholder={ph} value={set[field]}
      onChange={(e) => onPatch({ [field]: e.target.value })}
      style={{ width: w, padding: "9px 4px", textAlign: "center", fontWeight: 600, fontSize: 16,
        background: done ? "rgba(255,255,255,.07)" : P.s3, borderColor: done ? "rgba(255,255,255,.35)" : P.line }} />
  );
  const coachNote = set.coachNote || "";
  const coachAttachIds = set.coachAttachIds || [];
  return (
    <div className={done ? "quench" : ""} style={{ borderRadius: 12, padding: "8px 8px 8px 10px", marginBottom: 6,
      background: done ? "rgba(255,255,255,.10)" : P.s2, border: `1px solid ${done ? "rgba(255,255,255,.3)" : P.line}` }}>
      {(coachNote || coachAttachIds.length > 0 || set.coachVideo) && (
        <div style={{ marginBottom: 7, padding: "7px 9px", background: `${P.ember}12`, border: `1px solid ${P.ember}33`, borderRadius: 8 }}>
          {coachNote && <div style={{ fontSize: 13.5, color: P.ember2, lineHeight: 1.4 }}>{coachNote}</div>}
          {set.coachVideo && (
            <a href={set.coachVideo} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, color: P.blue, fontWeight: 600, marginTop: coachNote ? 5 : 0 }}>
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
          <span style={{ fontSize: 12, color: P.faint, fontWeight: 700 }}>{idx + 1}</span>
          <TypeBadge type={set.type} onInfo={() => onInfo(SET_TYPES[set.type]?.g)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {inp("weight", "kg", "31%")}
            <span style={{ color: P.faint, fontSize: 13 }}>×</span>
            {inp("reps", set.repsT || "reps", "27%")}
            {inp("rir", set.rirT !== "" ? `RIR ${set.rirT}` : "RIR", "27%")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 12.5, color: P.faint, flexWrap: "wrap" }}>
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
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <AttachButton iconOnly mode="photo" onError={onAttachError}
              onAttached={(aid) => onPatch({ attachIds: [...(set.attachIds || []), aid] })} />
            <AttachButton iconOnly mode="video" onError={onAttachError}
              onAttached={(aid) => onPatch({ attachIds: [...(set.attachIds || []), aid] })} />
            {(set.attachIds || []).map((aid) => (
              <AttachThumb key={aid} id={aid} size={34} onOpen={onOpenImg}
                onRemove={() => onPatch({ attachIds: (set.attachIds || []).filter((x) => x !== aid) })} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={() => setShowCmt((v) => !v)} title="Comentario de la serie"
            style={{ padding: 5, color: set.comment ? P.ember2 : P.faint }}>
            <MessageSquare size={16} fill={set.comment ? "rgba(220,220,226,.25)" : "none"} />
          </button>
          <button onClick={() => onStartRest && onStartRest()} title={`Iniciar descanso de ${restSec}s`}
            style={{ padding: 5, color: timer ? P.ember : P.faint }}>
            <Timer size={16} />
          </button>
        </div>
        <button onClick={onToggleDone} title={done ? "Desmarcar" : "Serie completada"}
          style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
            background: done ? P.green : P.s3, color: done ? "#000000" : P.dim,
            border: `1px solid ${done ? P.green : P.line}` }}>
          <Check size={19} strokeWidth={3} />
        </button>
      </div>
      {set.type === "drop" && (
        <div style={{ marginTop: 7, paddingLeft: 37 }}>
          {(set.drops || []).map((d, di) => (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: SET_TYPES.drop.color, fontWeight: 700 }}>↓{di + 1}</span>
              <input type="number" inputMode="decimal" step="any" placeholder="kg" value={d.weight}
                onChange={(e) => onPatch({ drops: set.drops.map((x, xi) => xi === di ? { ...x, weight: e.target.value } : x) })}
                style={{ width: 74, padding: "7px 4px", textAlign: "center", fontSize: 15 }} />
              <span style={{ color: P.faint, fontSize: 13 }}>×</span>
              <input type="number" inputMode="numeric" placeholder="reps" value={d.reps}
                onChange={(e) => onPatch({ drops: set.drops.map((x, xi) => xi === di ? { ...x, reps: e.target.value } : x) })}
                style={{ width: 66, padding: "7px 4px", textAlign: "center", fontSize: 15 }} />
              <button onClick={() => onPatch({ drops: set.drops.filter((_, xi) => xi !== di) })} style={{ color: P.faint, padding: 5 }}><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => onPatch({ drops: [...(set.drops || []), { weight: "", reps: "" }] })}
            style={{ color: SET_TYPES.drop.color, fontSize: 13.5, fontWeight: 600 }}>+ Añadir caída</button>
        </div>
      )}
      {showCmt && (
        <div style={{ marginTop: 7, paddingLeft: 37 }}>
          <Inp placeholder={`Comentario de la serie ${idx + 1} (queda en tu historial)`} value={set.comment}
            onChange={(e) => onPatch({ comment: e.target.value })} style={{ fontSize: 14.5 }} />
        </div>
      )}
      {timer && <InlineRest timer={timer} onAdjust={onAdjustRest} onDismiss={onDismissRest} />}
    </div>
  );
};

/* ============================================================
   Tarjeta de ejercicio en sesión
   ============================================================ */
const SessionExercise = ({ ex, exIdx, gr, history, onPatchEx, onPatchSet, onSetDone, onInfo, onError, onOpenImg, timer, onStartRest, onAdjustRest, onDismissRest }) => {
  const [open, setOpen] = useState(exIdx === 0);
  const [hist, setHist] = useState(false);
  const [info, setInfo] = useState(false);
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
    <Card style={{ marginBottom: 12, overflow: "hidden", borderColor: complete ? "rgba(255,255,255,.35)" : P.line }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: complete ? "rgba(255,255,255,.15)" : P.s2, color: complete ? P.green : P.dim, border: `1px solid ${complete ? "rgba(255,255,255,.4)" : P.line}`, fontWeight: 700, fontSize: 15 }}>
          {complete ? <Check size={17} strokeWidth={3} /> : exIdx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16.5, lineHeight: 1.25 }}>{ex.name}</div>
          <div style={{ fontSize: 13, color: P.faint, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{ex.muscle}</span><span>· {ex.sets.length} series</span><span>· descanso {fmtClock(ex.rest || 120)}</span>
            {parseTempo(ex.notes) && <span>· Tempo {parseTempo(ex.notes)}</span>}
            {gr && gr.kind && (
              <span style={{ color: GROUP_KINDS[gr.kind].color, fontWeight: 700 }}>
                · {GROUP_KINDS[gr.kind].label} {gr.posLabel} · {gr.rounds} rondas
              </span>
            )}
            {gr && !gr.kind && gr.posLabel && (
              <span style={{ color: P.dim, fontWeight: 700 }}>· Bloque {gr.posLabel} · series tradicionales</span>
            )}
            {ex.superset && <span style={{ color: P.blue }}>· superserie</span>}
          </div>
        </div>
        <span style={{ fontSize: 13.5, color: P.dim, fontWeight: 600 }}>{doneCount}/{ex.sets.length}</span>
        {open ? <ChevronUp size={17} color={P.faint} /> : <ChevronDown size={17} color={P.faint} />}
      </button>

      {open && (
        <div style={{ padding: "0 12px 13px" }}>
          {ex.notes && (
            <div style={{ fontSize: 14.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, padding: "9px 12px", marginBottom: 9, lineHeight: 1.45 }}>
              <span style={{ color: P.ember2, fontWeight: 700 }}>Coach · </span>{ex.notes}
            </div>
          )}
          {ex.superset && (
            <div style={{ fontSize: 13.5, color: P.blue, marginBottom: 9 }}>⇄ En superserie con <b>{ex.superset}</b> (descansa al terminar ambos) <button onClick={() => onInfo("superset")} style={{ color: P.blue, textDecoration: "underline" }}>¿qué es?</button></div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <Btn kind={lastNote ? "ghost" : "line"} small onClick={() => setHist(true)}
              style={lastNote ? { borderColor: "rgba(220,220,226,.5)", color: P.ember2 } : {}}>
              <History size={14} /> Historial y notas{entries.length ? ` (${entries.length})` : ""}
            </Btn>
            <Btn kind="line" small onClick={() => setInfo(true)}><Info size={14} /> Ficha técnica</Btn>
            {ex.video && <Btn kind="line" small onClick={() => window.open(ex.video, "_blank")}><Video size={14} /> Ver técnica</Btn>}
            <AttachButton mode="photo" onAttached={(id) => onPatchEx({ attachIds: [...(ex.attachIds || []), id] })} onError={onError} />
            <AttachButton mode="video" onAttached={(id) => onPatchEx({ attachIds: [...(ex.attachIds || []), id] })} onError={onError} />
          </div>

          {(ex.coachAttachIds || []).length > 0 && (
            <div style={{ marginBottom: 10, padding: "8px 10px", background: `${P.ember}12`, border: `1px solid ${P.ember}33`, borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Demostración del coach</div>
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
              onOpenImg={onOpenImg} onAttachError={onError}
              last={lastEntry && lastEntry.sets[si] && lastEntry.sets[si].done ? lastEntry.sets[si] : null}
              suggest={suggestFor(s)}
              onPatch={(patch) => onPatchSet(si, patch)}
              onToggleDone={() => onSetDone(si)}
              onInfo={onInfo} />
          ))}

          {(ex.attachIds || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 8, overflowX: "auto" }}>
              {ex.attachIds.map((id) => <AttachThumb key={id} id={id} onOpen={onOpenImg} size={56} />)}
            </div>
          )}
          <Txt rows={2} placeholder="Comentario del ejercicio (sensaciones, molestias, ajustes…) — lo verás la próxima vez y lo verá tu coach"
            value={ex.comment} onChange={(e) => onPatchEx({ comment: e.target.value })} style={{ fontSize: 14.5, marginTop: 4 }} />
        </div>
      )}
      <ExHistorySheet open={hist} onClose={() => setHist(false)} exName={ex.name} entries={entries} onOpenImg={onOpenImg} />
      <ExerciseInfoSheet ex={ex} open={info} onClose={() => setInfo(false)} onPatchEx={onPatchEx} onOpenImg={onOpenImg} onError={onError} />
    </Card>
  );
};

/* ============================================================
   Bloque de superserie/triserie/serie gigante en sesión (vista normal,
   NO focus mode). En vez de una tarjeta por ejercicio con todas sus series
   apiladas, se muestra UNA tarjeta para todo el bloque, organizada por
   RONDA: la ronda 1 junta la serie 1 de cada ejercicio del bloque, la
   ronda 2 junta la serie 2 de cada uno, etc. — el mismo orden que el
   focus mode, para que sea evidente qué hacer justo después de qué.
   ============================================================ */
const SessionGroupBlock = ({ exsAll, members, kind, rounds, history, onPatchEx, onPatchSet, onSetDone, onInfo, onError, onOpenImg, timer, onStartRest, onAdjustRest, onDismissRest }) => {
  const [open, setOpen] = useState(members[0] === 0);
  const [hist, setHist] = useState(null);   // índice del ejercicio cuyo historial se ve
  const [info, setInfo] = useState(null);   // índice del ejercicio cuya ficha técnica se ve
  const col = GROUP_KINDS[kind].color;
  const totalSets = members.reduce((a, mi) => a + exsAll[mi].sets.length, 0);
  const doneSets = members.reduce((a, mi) => a + exsAll[mi].sets.filter((s) => s.done).length, 0);
  const complete = doneSets === totalSets && totalSets > 0;
  const posLabel = (k) => `${String.fromCharCode(65 + (blockIndexAt(exsAll, members[0]) % 26))}${k + 1}`;

  return (
    <Card style={{ marginBottom: 12, overflow: "hidden", borderColor: complete ? "rgba(255,255,255,.35)" : `${col}55`,
      borderLeft: `3px solid ${col}` }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: complete ? "rgba(255,255,255,.15)" : `${col}1E`, color: complete ? P.green : col, border: `1px solid ${complete ? "rgba(255,255,255,.4)" : `${col}55`}` }}>
          {complete ? <Check size={17} strokeWidth={3} /> : <Layers size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16.5, lineHeight: 1.25 }}>
            {members.map((mi, k) => exsAll[mi].name).join(" + ")}
          </div>
          <div style={{ fontSize: 13, color: col, marginTop: 2, fontWeight: 700 }}>
            {GROUP_KINDS[kind].label} · {rounds} rondas · {totalSets} series en total
          </div>
        </div>
        <span style={{ fontSize: 13.5, color: P.dim, fontWeight: 600 }}>{doneSets}/{totalSets}</span>
        {open ? <ChevronUp size={17} color={P.faint} /> : <ChevronDown size={17} color={P.faint} />}
      </button>

      {open && (
        <div style={{ padding: "0 12px 13px" }}>
          <div style={{ fontSize: 13, color: P.dim, marginBottom: 10, lineHeight: 1.4 }}>
            Haz {members.map((_, k) => posLabel(k)).join(" → ")} seguidos, sin descanso entre ellos. Descansa solo al terminar la ronda completa.
          </div>

          {members.map((mi, k) => exsAll[mi].notes && (
            <div key={"note" + mi} style={{ fontSize: 14, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, padding: "8px 11px", marginBottom: 8, lineHeight: 1.4 }}>
              <span style={{ color: col, fontWeight: 700 }}>{posLabel(k)} · {exsAll[mi].name} — Coach · </span>{exsAll[mi].notes}
            </div>
          ))}

          {Array.from({ length: rounds }).map((_, r) => (
            <div key={r} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: col, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 6 }}>
                Ronda {r + 1}/{rounds}
              </div>
              {members.map((mi, k) => {
                const s = exsAll[mi].sets[r];
                if (!s) return null;
                const ex = exsAll[mi];
                const entries = history.byEx[ex.id] || [];
                const lastEntry = entries.length ? entries[entries.length - 1] : null;
                return (
                  <div key={mi} style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: col, marginBottom: 3 }}>{posLabel(k)} · {ex.name}</div>
                    <SetRow set={s} idx={r}
                      restSec={(s.rest != null && s.rest !== "" ? +s.rest : (ex.rest || 90))}
                      timer={timer && timer.exIdx === mi && timer.setIdx === r ? timer : null}
                      onStartRest={() => onStartRest(mi, r)}
                      onAdjustRest={onAdjustRest}
                      onDismissRest={onDismissRest}
                      onOpenImg={onOpenImg} onAttachError={onError}
                      last={lastEntry && lastEntry.sets[r] && lastEntry.sets[r].done ? lastEntry.sets[r] : null}
                      suggest={null}
                      onPatch={(patch) => onPatchSet(mi, r, patch)}
                      onToggleDone={() => onSetDone(mi, r)}
                      onInfo={onInfo} />
                  </div>
                );
              })}
            </div>
          ))}

          {members.map((mi, k) => (
            <div key={"cmt" + mi} style={{ marginBottom: k < members.length - 1 ? 8 : 0 }}>
              <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, marginBottom: 3 }}>{posLabel(k)} · {exsAll[mi].name}</div>
              <Txt rows={2} placeholder={`Comentario de ${exsAll[mi].name} (sensaciones, molestias, ajustes…)`}
                value={exsAll[mi].comment} onChange={(e) => onPatchEx(mi, { comment: e.target.value })} style={{ fontSize: 14.5 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <Btn kind="line" small onClick={() => setInfo(mi)}><Info size={14} /> Ficha técnica</Btn>
                {exsAll[mi].video && (
                  <Btn kind="line" small onClick={() => window.open(exsAll[mi].video, "_blank")}>
                    <Video size={14} /> Ver técnica de {exsAll[mi].name}
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ExerciseInfoSheet ex={info != null ? exsAll[info] : null} open={info != null} onClose={() => setInfo(null)}
        onPatchEx={info != null ? (patch) => onPatchEx(info, patch) : null} onOpenImg={onOpenImg} onError={onError} />
    </Card>
  );
};

/* ============================================================
   Temporizador de descanso flotante
   ============================================================ */
/* ============================================================
   FOCUS MODE — una sola pantalla, un solo ejercicio
   Pensado para registrar con el mínimo número de toques cuando
   vas apurado o no quieres distraerte con la lista completa.
   La pantalla de entrenamiento normal sigue intacta.
   ============================================================ */

// Campo numérico grande: acepta coma o punto, flechas para subir/bajar
// respetando los decimales escritos, y una X para vaciarlo de un toque.
const FocusField = ({ label, value, placeholder, onChange, onClear }) => (
  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", color: P.faint, textTransform: "uppercase" }}>{label}</span>
      {value !== "" && (
        <button onClick={onClear} aria-label={`Borrar ${label}`} title={`Borrar ${label}`}
          style={{ color: P.faint, lineHeight: 0, padding: 1 }}><X size={11} strokeWidth={3} /></button>
      )}
    </div>
    <button onClick={() => onChange(stepNumeric(value, +1))} aria-label={`Subir ${label}`}
      style={{ width: "100%", padding: "3px 0", color: P.dim, background: P.s3, border: `1px solid ${P.line}`, borderRadius: "9px 9px 0 0" }}>
      <ChevronUp size={20} strokeWidth={2.5} />
    </button>
    <input type="text" inputMode="decimal" enterKeyHint="done" placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
      style={{ width: "100%", padding: "9px 2px", textAlign: "center", fontWeight: 700, fontSize: 20,
        background: value !== "" ? "rgba(255,255,255,.08)" : P.s2,
        borderColor: value !== "" ? "rgba(255,255,255,.35)" : P.line, borderRadius: 0 }} />
    <button onClick={() => onChange(stepNumeric(value, -1))} aria-label={`Bajar ${label}`}
      style={{ width: "100%", padding: "3px 0", color: P.dim, background: P.s3, border: `1px solid ${P.line}`, borderRadius: "0 0 9px 9px" }}>
      <ChevronDown size={20} strokeWidth={2.5} />
    </button>
  </div>
);

// Salir del focus mode ya no es un toque: hay que mantener pulsado 5s. Un
// anillo circular (SVG) muestra el progreso y el número de segundos que
// faltan, para que quede claro que hace falta sostener, no tocar.
const HOLD_EXIT_MS = 5000;
const HoldToExitButton = ({ onExit }) => {
  const [progress, setProgress] = useState(0); // 0..1
  const startAt = useRef(null);
  const raf = useRef(null);
  const cancel = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null; startAt.current = null;
    setProgress(0);
  };
  const start = () => {
    startAt.current = Date.now();
    const tick = () => {
      if (!startAt.current) return;
      const p = Math.min(1, (Date.now() - startAt.current) / HOLD_EXIT_MS);
      setProgress(p);
      if (p >= 1) { cancel(); onExit(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancel(), []);
  const active = progress > 0;
  const remaining = Math.max(1, Math.ceil((1 - progress) * (HOLD_EXIT_MS / 1000)));
  const R = 16, C = 2 * Math.PI * R;
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Mantén pulsado 5 segundos para salir del focus mode"
      title="Mantén pulsado 5 segundos para salir"
      style={{ position: "relative", width: 38, height: 38, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        color: active ? P.ember2 : P.faint, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 12,
        touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}>
      <svg width={38} height={38} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx="19" cy="19" r={R} fill="none" stroke={P.line} strokeWidth={2.5} />
        {active && (
          <circle cx="19" cy="19" r={R} fill="none" stroke={P.ember} strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        )}
      </svg>
      {active ? <span style={{ fontSize: 13, fontWeight: 700 }}>{remaining}</span> : <X size={17} />}
    </button>
  );
};

const FocusMode = ({ active, history, patch, patchSet, patchEx, onError, onExit, onFinish, storageOK, savedAt }) => {
  const [pageIdx, setPageIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [peek, setPeek] = useState(null);          // {mode:"name"|"full"} → siguiente página
  const [instr, setInstr] = useState(null);        // {ei, pinned} → nota del coach de ese ejercicio
  const [ficha, setFicha] = useState(null);        // ei → ficha técnica abierta de ese ejercicio
  const [viewImg, setViewImg] = useState(null);
  const [cmtKey, setCmtKey] = useState(null);      // "ei-si" de la serie con el comentario abierto
  const [rests, setRests] = useState({});          // {"ei-si": timestamp de inicio del descanso}
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const peekTimer = useRef(null);
  const instrTimer = useRef(null);
  const cmtTimer = useRef(null);
  const holdTimer = useRef(null);
  const heldRef = useRef(false);
  const touchRef = useRef(null);
  const cmtRef = useRef(null);
  const didPrefill = useRef(false);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => () => { [peekTimer, instrTimer, cmtTimer, holdTimer].forEach((t) => clearTimeout(t.current)); }, []);
  // Pide pantalla completa real del navegador (oculta barra de dirección) al
  // entrar y la libera al salir. No todos los navegadores lo soportan (Safari
  // de iPhone, en particular, no deja pedirla fuera de <video>) — por eso va
  // en un try/catch silencioso: si falla, el focus mode sigue funcionando
  // igual, solo que dentro del navegador en vez de a pantalla completa del SO.
  useEffect(() => {
    const el = document.documentElement;
    try { el.requestFullscreen && el.requestFullscreen().catch(() => {}); } catch {}
    return () => { try { document.fullscreenElement && document.exitFullscreen && document.exitFullscreen().catch(() => {}); } catch {} };
  }, []);

  const exs = active.exs;

  // Páginas del focus: un ejercicio suelto ocupa una página con todas sus
  // series; una superserie/triserie/gigante ocupa una página POR RONDA, y en
  // esa página aparecen todos los ejercicios del bloque juntos (A1, A2, A3…).
  const pages = useMemo(() => {
    const out = [];
    let i = 0;
    while (i < exs.length) {
      const g = exs[i].group;
      if (g) {
        const members = [];
        let j = i;
        while (j < exs.length && exs[j].group === g) { members.push(j); j++; }
        if (members.length >= 2) {
          const info = exGroupInfo(exs, i);
          const rounds = Math.max(1, ...members.map((m) => exs[m].sets.length));
          for (let r = 0; r < rounds; r++) out.push({ group: true, kind: info.kind, members, roundIdx: r, rounds });
          i = j; continue;
        }
      }
      out.push({ group: false, ei: i });
      i++;
    }
    return out.length ? out : [{ group: false, ei: 0 }];
  }, [exs]);

  const page = pages[Math.min(pageIdx, pages.length - 1)];
  const totalSets = exs.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const pct = totalSets ? (doneSets / totalSets) * 100 : 0;
  const elapsed = Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1000));

  const pageName = (pg) => {
    if (!pg) return null;
    if (pg.group) return `${GROUP_KINDS[pg.kind].label}: ${pg.members.map((m) => exs[m].name).join(" + ")}`;
    return exs[pg.ei].name;
  };
  const nextPage = pages[pageIdx + 1] || null;
  const nextNotes = nextPage && !nextPage.group ? exs[nextPage.ei].notes : "";

  // Prefill: las series vacías se rellenan una sola vez con lo último que se
  // registró en ese ejercicio, para no teclear lo mismo cada vez.
  useEffect(() => {
    if (didPrefill.current) return;
    didPrefill.current = true;
    const clone = structuredClone(active);
    let any = false;
    clone.exs.forEach((exx) => {
      const entries = history.byEx[exx.id] || [];
      const lastEntry = entries.length ? entries[entries.length - 1] : null;
      if (!lastEntry) return;
      exx.sets.forEach((s, si) => {
        if (s.weight !== "" || s.reps !== "" || s.rir !== "") return;
        const prev = (lastEntry.sets || [])[si];
        if (!prev) return;
        ["weight", "reps", "rir"].forEach((k) => { if (prev[k] !== "" && prev[k] != null) { s[k] = String(prev[k]); any = true; } });
      });
    });
    if (any) patch(() => clone);
  }, []);

  const go = (dir) => {
    const next = pageIdx + dir;
    if (next < 0 || next >= pages.length) return;
    setCmtKey(null); setInstr(null); setPeek(null);
    setPageIdx(next);
  };

  /* --- Nota del coach: un toque la muestra 6 s, mantener pulsado la fija --- */
  const showInstr = (ei, pinned) => {
    clearTimeout(instrTimer.current);
    setInstr({ ei, pinned });
    if (!pinned) instrTimer.current = setTimeout(() => setInstr(null), 6000);
  };
  const hideInstr = () => { clearTimeout(instrTimer.current); setInstr(null); };

  /* --- Barra de progreso: toque = nombre del siguiente · mantener = nombre + indicación --- */
  const showPeek = (mode, ms) => {
    clearTimeout(peekTimer.current);
    setPeek({ mode });
    peekTimer.current = setTimeout(() => setPeek(null), ms);
  };
  const barDown = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => { heldRef.current = true; showPeek("full", 12000); }, 380);
  };
  const barUp = () => {
    clearTimeout(holdTimer.current);
    if (heldRef.current) { showPeek("full", 6000); return; }   // al soltar, deja leer 6 s más
    showPeek("name", 4000);
  };

  /* --- Comentario de la serie: se guarda mientras escribes, sin botón guardar --- */
  const openCmt = (ck) => {
    setCmtKey(ck);
    clearTimeout(cmtTimer.current);
    cmtTimer.current = setTimeout(() => setCmtKey(null), 10000);
    setTimeout(() => cmtRef.current && cmtRef.current.focus(), 30);
  };
  const touchCmt = () => {
    clearTimeout(cmtTimer.current);
    cmtTimer.current = setTimeout(() => setCmtKey(null), 10000);
  };

  /* --- Borrados con deshacer/rehacer --- */
  const record = (ei, si, before, after) => {
    setUndoStack((s) => [...s.slice(-40), { ei, si, before, after }]);
    setRedoStack([]);
  };
  const clearField = (ei, si, field) => {
    const s = exs[ei].sets[si];
    if (s[field] === "") return;
    record(ei, si, { [field]: s[field] }, { [field]: "" });
    patchSet(ei, si, { [field]: "" });
  };
  const clearSet = (ei, si) => {
    const s = exs[ei].sets[si];
    if (s.weight === "" && s.reps === "" && s.rir === "") return;
    record(ei, si, { weight: s.weight, reps: s.reps, rir: s.rir }, { weight: "", reps: "", rir: "" });
    patchSet(ei, si, { weight: "", reps: "", rir: "" });
  };
  const undo = () => {
    const a = undoStack[undoStack.length - 1];
    if (!a) return;
    patchSet(a.ei, a.si, a.before);
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, a]);
  };
  const redo = () => {
    const a = redoStack[redoStack.length - 1];
    if (!a) return;
    patchSet(a.ei, a.si, a.after);
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, a]);
  };

  const restKey = (ei, si) => `${ei}-${si}`;
  const toggleRest = (ei, si) => {
    const k = restKey(ei, si);
    setRests((r) => (r[k] ? { ...r, [k]: null } : { ...r, [k]: Date.now() }));
  };

  const setVal = (ei, si, field, v) => patchSet(ei, si, { [field]: v });

  // Navegación como en las historias: tocar el tercio derecho avanza y el
  // izquierdo retrocede. Los toques sobre un control se respetan.
  const tapNav = (e) => {
    if (e.target.closest && e.target.closest("input, textarea, button, a, [data-keep]")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x > r.width * 0.66) go(1);
    else if (x < r.width * 0.34) go(-1);
  };

  /* --- Cabecera de un ejercicio dentro de una página --- */
  const renderExHeader = (ei, { big, posLabel, color }) => {
    const exx = exs[ei];
    const noteOpen = instr && instr.ei === ei;
    return (
      <div style={{ padding: big ? "2px 0 4px" : "8px 0 2px" }}>
        <div style={{ fontSize: 12, color: color || P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>
          {posLabel ? <span style={{ color }}>{posLabel} · </span> : null}{exx.muscle}
        </div>
        <div className="disp" style={{ fontSize: big ? 23 : 18.5, fontWeight: 700, lineHeight: 1.15, margin: "3px 0 6px" }}>{exx.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {parseTempo(exx.notes) && (
            <span style={{ fontSize: 13, fontWeight: 700, color: P.dim, border: `1px solid ${P.line}`, borderRadius: 6, padding: "2px 7px" }}>
              Tempo {parseTempo(exx.notes)}
            </span>
          )}
          <button
            onPointerDown={() => { heldRef.current = false; holdTimer.current = setTimeout(() => { heldRef.current = true; showInstr(ei, true); }, 380); }}
            onPointerUp={() => { clearTimeout(holdTimer.current); if (!heldRef.current) (noteOpen ? hideInstr() : showInstr(ei, false)); }}
            onPointerLeave={() => clearTimeout(holdTimer.current)}
            disabled={!exx.notes}
            aria-label="Indicación del coach: toca para verla 6 segundos, mantén pulsado para dejarla fija"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: big ? 34 : 30, height: big ? 34 : 30, borderRadius: 17,
              border: `1.5px solid ${exx.notes ? (noteOpen ? P.ember : P.dim) : P.line}`, color: exx.notes ? (noteOpen ? P.ember : P.dim) : P.line,
              background: noteOpen ? `${P.ember}18` : "transparent", touchAction: "manipulation", transition: "color .15s ease, border-color .15s ease" }}>
            <Info size={big ? 19 : 17} />
          </button>
          <button data-keep onClick={() => setFicha(ei)} aria-label="Ver ficha técnica completa del ejercicio"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, color: P.dim, fontWeight: 600,
              border: `1px solid ${P.line}`, borderRadius: 17, padding: big ? "7px 12px" : "6px 10px" }}>
            <BookOpen size={big ? 16 : 14} /> Ficha
          </button>
          {exx.video && (
            <a href={exx.video} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, color: P.blue, fontWeight: 600 }}>
              <Video size={15} /> Técnica
            </a>
          )}
        </div>
        <div style={{ maxHeight: noteOpen ? 200 : 0, opacity: noteOpen ? 1 : 0, overflow: "hidden",
          transition: "max-height .18s cubic-bezier(.32,.72,0,1), opacity .16s ease" }}>
          {noteOpen && (
            <div data-keep onClick={hideInstr} style={{ background: `${P.ember}12`, border: `1px solid ${P.ember}44`, borderRadius: 11,
              padding: "9px 11px", margin: "6px 0 2px", fontSize: 13.5, color: P.ember2, lineHeight: 1.45, maxHeight: 180, overflowY: "auto" }}>
              {exx.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* --- Tarjeta de una serie/ronda: casillas de peso, reps y RIR --- */
  const renderSetCard = (ei, si, label, kindColor) => {
    const exx = exs[ei];
    const s = exx.sets[si];
    if (!s) return null;
    const ck = restKey(ei, si);
    const started = rests[ck];
    const restEl = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
    const target = (s.rest != null && s.rest !== "" ? +s.rest : (exx.rest || 0));
    const over = target > 0 && restEl >= target;
    return (
      <div key={s.id} style={{ background: P.s1, border: `1px solid ${s.done ? "rgba(255,255,255,.35)" : P.line}`,
        borderRadius: 14, padding: "9px 10px 10px", marginBottom: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
          <span className="disp" style={{ fontSize: 16, fontWeight: 700, color: kindColor || P.text }}>{label}</span>
          <TypeBadge type={s.type} />
          <span style={{ fontSize: 12.5, color: P.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {s.repsT || "—"} reps{s.rirT !== "" ? ` @ RIR ${s.rirT}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => clearSet(ei, si)} aria-label={`Borrar los datos de ${label}`}
            style={{ padding: 5, color: P.faint }}><Trash2 size={16} /></button>
          <button data-cmt onClick={() => (cmtKey === ck ? setCmtKey(null) : openCmt(ck))} aria-label={`Comentario de ${label}`}
            style={{ padding: 5, color: s.comment ? P.ember2 : P.faint }}>
            <MessageSquare size={17} fill={s.comment ? "rgba(220,220,226,.25)" : "none"} />
          </button>
          <button onClick={() => toggleRest(ei, si)} aria-label={`Cronómetro de descanso de ${label}`}
            style={{ padding: 5, color: started ? P.ember : P.faint }}><Timer size={17} /></button>
          <button onClick={() => patchSet(ei, si, { done: !s.done })} aria-label={s.done ? "Desmarcar serie" : "Marcar serie hecha"}
            style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: s.done ? P.green : P.s3, color: s.done ? "#000000" : P.dim, border: `1px solid ${s.done ? P.green : P.line}` }}>
            <Check size={17} strokeWidth={3} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <FocusField label="Peso" value={s.weight} placeholder="kg"
            onChange={(vv) => setVal(ei, si, "weight", vv)} onClear={() => clearField(ei, si, "weight")} />
          <FocusField label="Reps" value={s.reps} placeholder={s.repsT || "reps"}
            onChange={(vv) => setVal(ei, si, "reps", vv)} onClear={() => clearField(ei, si, "reps")} />
          <FocusField label="RIR" value={s.rir} placeholder={s.rirT !== "" ? String(s.rirT) : "rir"}
            onChange={(vv) => setVal(ei, si, "rir", vv)} onClear={() => clearField(ei, si, "rir")} />
        </div>

        {started && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 9px", borderRadius: 9,
            background: over ? "rgba(255,255,255,.10)" : `${P.ember}12`,
            border: `1px solid ${over ? "rgba(255,255,255,.45)" : `${P.ember}44`}` }}>
            <Timer size={15} color={over ? P.green : P.ember} />
            <span className="disp" style={{ fontSize: 19, fontWeight: 700, color: over ? P.green : P.ember }}>{bigTime(restEl)}</span>
            <span style={{ fontSize: 12.5, color: P.faint }}>descansando{target ? ` · objetivo ${target}s` : ""}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => toggleRest(ei, si)} style={{ fontSize: 13, color: P.dim, fontWeight: 600, padding: "2px 4px" }}>parar</button>
          </div>
        )}

        <div data-cmt style={{ maxHeight: cmtKey === ck ? 130 : 0, opacity: cmtKey === ck ? 1 : 0, overflow: "hidden",
          transition: "max-height .18s cubic-bezier(.32,.72,0,1), opacity .16s ease" }}>
          <textarea ref={cmtKey === ck ? cmtRef : null} rows={2} value={s.comment || ""}
            placeholder={`Comentario de ${label}`}
            onChange={(e) => { setVal(ei, si, "comment", e.target.value); touchCmt(); }}
            onFocus={touchCmt} onKeyDown={touchCmt}
            style={{ width: "100%", marginTop: 8, padding: "8px 10px", fontSize: 16, lineHeight: 1.4, resize: "none",
              visibility: cmtKey === ck ? "visible" : "hidden", pointerEvents: cmtKey === ck ? "auto" : "none" }} />
        </div>
        {s.comment && cmtKey !== ck && (
          <div data-keep onClick={() => openCmt(ck)} style={{ marginTop: 7, fontSize: 13.5, color: P.dim, lineHeight: 1.4,
            background: P.s2, border: `1px solid ${P.line}`, borderRadius: 9, padding: "6px 9px" }}>{s.comment}</div>
        )}
      </div>
    );
  };

  const col = page.group ? GROUP_KINDS[page.kind].color : null;

  return (
    <div
      // Un toque en cualquier punto fuera del cuadro cierra el comentario.
      // Lo escrito ya está guardado: no hace falta pulsar guardar.
      onClickCapture={(e) => {
        if (cmtKey === null) return;
        if (e.target.closest && e.target.closest("[data-cmt]")) return;
        setCmtKey(null);
      }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: P.bgGrad, display: "flex", flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", overscrollBehavior: "contain" }}>

      {/* Cabecera: tiempo, posición y salidas */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px", flexShrink: 0 }}>
        <HoldToExitButton onExit={onExit} />
        <div className="disp" style={{ fontSize: 25, fontWeight: 700, color: P.text, letterSpacing: ".02em" }}>{bigTime(elapsed)}</div>
        <div style={{ fontSize: 12.5, color: P.faint, lineHeight: 1.2 }}>
          {pageIdx + 1}/{pages.length}<br />{doneSets}/{totalSets} series
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={undo} disabled={!undoStack.length} aria-label="Deshacer"
          style={{ padding: 6, color: undoStack.length ? P.dim : P.line }}><Undo2 size={18} /></button>
        <button onClick={redo} disabled={!redoStack.length} aria-label="Rehacer"
          style={{ padding: 6, color: redoStack.length ? P.dim : P.line }}><Redo2 size={18} /></button>
        <span title={storageOK ? (savedAt ? `Guardado ${savedAt}` : "Guardado") : "Sin guardado"}
          style={{ width: 7, height: 7, borderRadius: 4, background: storageOK ? P.green : P.red, flexShrink: 0 }} />
        <Btn kind="ember" small onClick={() => setConfirmFinish(true)}>Terminar</Btn>
      </div>

      {/* Barra de progreso de la sesión */}
      <div onPointerDown={barDown} onPointerUp={barUp} onPointerLeave={() => clearTimeout(holdTimer.current)}
        role="button" aria-label="Progreso de la sesión: toca para ver lo que sigue, mantén pulsado para ver también su indicación"
        style={{ padding: "10px 12px 12px", flexShrink: 0, cursor: "pointer", touchAction: "manipulation" }}>
        <div style={{ height: 9, background: P.s2, borderRadius: 5, overflow: "hidden", border: `1px solid ${P.line}` }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5,
            background: `linear-gradient(90deg, ${P.ember}, ${P.ember2})`, transition: "width .35s ease" }} />
        </div>
        {pageIdx === 0 && !peek && (
          <div style={{ fontSize: 11.5, color: P.faint, textAlign: "center", marginTop: 5, lineHeight: 1.3 }}>
            Toca la barra para ver lo que sigue · mantén pulsado para leer su indicación
          </div>
        )}
      </div>

      {/* Zona reservada para los avisos: crece y encoge, nunca tapa el contenido */}
      <div style={{ flexShrink: 0, padding: "0 12px",
        maxHeight: peek ? 190 : 0, opacity: peek ? 1 : 0, overflow: "hidden",
        transition: "max-height .18s cubic-bezier(.32,.72,0,1), opacity .16s ease" }}>
        {peek && (
          <div style={{ background: P.s2, border: `1px solid ${P.line}`, borderRadius: 12, padding: "9px 11px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", color: P.faint, textTransform: "uppercase", marginBottom: 3 }}>
              {nextPage ? "Siguiente" : "Último"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.3 }}>
              {nextPage ? pageName(nextPage) : "Este es el final de la sesión"}
            </div>
            {peek.mode === "full" && nextNotes && (
              <div style={{ fontSize: 13.5, color: P.ember2, lineHeight: 1.45, marginTop: 5,
                maxHeight: 108, overflowY: "auto" }}>{nextNotes}</div>
            )}
          </div>
        )}
      </div>

      {/* Cuerpo: la página actual (un ejercicio suelto, o una ronda del bloque) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", position: "relative", padding: "0 30px 16px" }}
        onClick={tapNav}
        onTouchStart={(e) => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={(e) => {
          const st = touchRef.current; if (!st) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - st.x, dy = t.clientY - st.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          touchRef.current = null;
        }}>

        {/* Franjas de los bordes, siempre libres de controles: derecha avanza, izquierda retrocede */}
        <div onClick={() => go(-1)} aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 30, zIndex: 3 }} />
        <div onClick={() => go(1)} aria-hidden style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 30, zIndex: 3 }} />

        <div style={{ position: "relative", zIndex: 2 }}>
          {page.group ? (
            <>
              {/* Cabecera del bloque: qué ronda es y cómo se hace */}
              <div style={{ marginTop: 4, marginBottom: 4, padding: "9px 11px", borderRadius: 12,
                background: `${col}16`, border: `1px solid ${col}55` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: col, letterSpacing: ".04em", textTransform: "uppercase" }}>
                    {GROUP_KINDS[page.kind].label}
                  </span>
                  <span className="disp" style={{ fontSize: 16, fontWeight: 700, color: P.text }}>Ronda {page.roundIdx + 1}/{page.rounds}</span>
                </div>
                <div style={{ fontSize: 12.5, color: P.dim, marginTop: 4, lineHeight: 1.4 }}>
                  Haz {page.members.map((mi) => exGroupInfo(exs, mi).posLabel).join(" → ")} seguidos, sin descanso entre ellos.
                  Descansa solo al terminar la ronda y desliza a la derecha para la siguiente.
                </div>
              </div>

              {page.members.map((mi) => {
                const s = exs[mi].sets[page.roundIdx];
                if (!s) return null;
                return (
                  <div key={mi} data-keep style={{ borderLeft: `3px solid ${col}`, paddingLeft: 10, marginBottom: 6 }}>
                    {renderExHeader(mi, { big: false, posLabel: exGroupInfo(exs, mi).posLabel, color: col })}
                    {renderSetCard(mi, page.roundIdx, `Ronda ${page.roundIdx + 1}`, col)}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {renderExHeader(page.ei, { big: true, posLabel: exGroupInfo(exs, page.ei).posLabel, color: P.dim })}
              <div style={{ marginTop: 10 }}>
                {exs[page.ei].sets.map((s, si) => renderSetCard(page.ei, si, `S${si + 1}`, null))}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Btn kind="line" onClick={() => go(-1)} disabled={pageIdx === 0} style={{ flex: 1 }}><ChevronLeft size={17} /> Anterior</Btn>
            <Btn kind={pageIdx === pages.length - 1 ? "line" : "ember"} onClick={() => go(1)} disabled={pageIdx >= pages.length - 1} style={{ flex: 2 }}>
              Siguiente <ChevronRight size={17} />
            </Btn>
          </div>
        </div>
      </div>

      <Confirm open={confirmFinish} title="Terminar sesión"
        body={doneSets < totalSets ? `Llevas ${doneSets} de ${totalSets} series marcadas. Se guardará todo lo registrado hasta ahora.` : "¡Sesión completa! Se guardará todo en tu historial."}
        okLabel="Terminar y guardar" onOk={() => { setConfirmFinish(false); onFinish(); }} onCancel={() => setConfirmFinish(false)} />
      <ExerciseInfoSheet ex={ficha != null ? exs[ficha] : null} open={ficha != null} onClose={() => setFicha(null)}
        onPatchEx={ficha != null && patchEx ? (p) => patchEx(ficha, p) : null} onOpenImg={setViewImg} onError={onError} />
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

const TrainTab = ({ plan, history, active, setActive, saveActive, finishSession, discardSession, onInfo, toast, savedAt, allowedRoutines }) => {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timer, setTimer] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const [previewDay, setPreviewDay] = useState(null);
  const [browsing, setBrowsing] = useState(false);   // ver la rutina aunque haya sesión abierta
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const [openRoutines, setOpenRoutines] = useState([]);   // rutinas desplegadas (arranca todo colapsado)
  const [focus, setFocus] = useState(false);              // pantalla completa de un ejercicio a la vez
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);

  // Solo se listan las rutinas que el coach dejó visibles para este alumno
  // (si hay restricción). Si el alumno tiene una sesión ya en curso de una
  // rutina que se le acaba de ocultar, igual puede terminarla con calma —
  // solo se filtra la lista para empezar sesiones nuevas.
  const routineGroups = useMemo(() => visibleRoutineGroups(plan.days, allowedRoutines), [plan.days, allowedRoutines]);
  const toggleRoutine = (key) => setOpenRoutines((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  // Si hay sesión en curso, la rutina a la que pertenece se muestra ya desplegada
  const activeRoutine = active ? (plan.days.find((d) => d.id === active.dayId) || {}).routine || null : null;
  useEffect(() => {
    if (!activeRoutine) return;
    setOpenRoutines((o) => (o.includes(activeRoutine) ? o : [...o, activeRoutine]));
  }, [activeRoutine]);

  const startSession = (day, withFocus) => {
    // Las reps y el RIR salen de la semana en curso del mesociclo; si esa
    // semana no fija nada para el ejercicio, se usan los del propio ejercicio.
    const week = currentWeek(plan);
    const snap = {
      id: uid(), dayId: day.id, dayName: day.name, startedAt: todayISO(),
      weekId: week.id, weekName: week.name, deload: !!week.deload,
      attachIds: [],
      exs: day.exs.map((ex) => ({ ...ex, comment: "", attachIds: [],
        sets: ex.sets.map((s, si) => {
          const t = setTargets(ex, si, week);
          return { ...s, repsT: t.repsT, rirT: t.rirT, weight: "", reps: "", rir: "", done: false, comment: "", drops: [] };
        }) })),
    };
    setActive(snap); saveActive(snap);
    setPreviewDay(null); setBrowsing(false);
    setFocus(!!withFocus);
  };

  const listMode = !active || browsing;

  // El resumen se muestra cuando la sesión ya terminó, así que tiene que vivir
  // fuera de la vista de sesión: al guardar, `active` pasa a null.
  const summarySheet = (
    <Sheet open={!!summary} onClose={() => setSummary(null)} title="Sesión guardada">
      {summary && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[["Duración", `${summary.durationMin} min`], ["Series", `${summary.setsDone}/${summary.setsTotal}`], ["Tonelaje", `${Math.round(summary.volume).toLocaleString("es-CL")} kg`]].map(([l, v]) => (
              <Card key={l} style={{ padding: "12px 8px", textAlign: "center", background: P.s2 }}>
                <div className="disp" style={{ fontSize: 21, fontWeight: 700, color: P.ember2 }}>{v}</div>
                <div style={{ fontSize: 12.5, color: P.dim, marginTop: 2 }}>{l}</div>
              </Card>
            ))}
          </div>
          {summary.prs.length > 0 && (
            <div style={{ background: "rgba(255,255,255,.08)", border: `1px solid ${P.ember}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: P.ember2, marginBottom: 6 }}><Award size={15} style={{ verticalAlign: -2, marginRight: 5 }} />Récords personales de peso</div>
              {summary.prs.map((p) => <div key={p} style={{ fontSize: 15, color: P.text, padding: "2px 0" }}>• {p}</div>)}
            </div>
          )}
          <div style={{ fontSize: 14.5, color: P.dim, lineHeight: 1.5 }}>Todo quedó en tu historial: pesos, repeticiones, RIR, comentarios y fotos. La próxima vez que hagas estos ejercicios los verás como referencia.</div>
          <Btn kind="ember" onClick={() => setSummary(null)} style={{ width: "100%", marginTop: 16 }}>Listo</Btn>
        </div>
      )}
    </Sheet>
  );

  if (listMode && previewDay) {
    const d = previewDay;
    const totalSeries = d.exs.reduce((a, e) => a + e.sets.length, 0);
    return (
      <div style={{ padding: "16px 16px 30px" }}>
        <button onClick={() => setPreviewDay(null)} style={{ display: "flex", alignItems: "center", gap: 6, color: P.faint, fontSize: 14.5, marginBottom: 12, padding: "4px 0" }}>
          <ChevronLeft size={17} /> Volver a la lista
        </button>
        <div style={{ fontSize: 12.5, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>{routineLabel(routineOf(d))}</div>
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "0 0 4px" }}>{d.name}</h1>
        <div style={{ color: P.dim, fontSize: 15, marginBottom: 14 }}>{d.exs.length} ejercicios · {totalSeries} series efectivas. Aún no se ha creado sesión: revisa lo que toca y arranca cuando estés listo.</div>
        {currentMesociclo(plan).weeks.length > 1 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 12, padding: "6px 11px", borderRadius: 9,
            background: currentWeek(plan).deload ? "rgba(255,255,255,.12)" : `${P.blue}14`,
            border: `1px solid ${currentWeek(plan).deload ? "rgba(255,255,255,.45)" : `${P.blue}44`}` }}>
            <Calendar size={14} color={currentWeek(plan).deload ? P.green : P.blue} />
            <span style={{ fontSize: 13.5, color: P.dim }}>
              {currentWeek(plan).name}{currentWeek(plan).deload ? " · semana de descarga" : ""} — reps y RIR de esta semana
            </span>
          </div>
        )}
        {d.exs.map((e, ei) => (
          <Card key={e.id} style={{ padding: "12px 13px", marginBottom: 9 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div className="disp" style={{ width: 26, height: 26, borderRadius: 7, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: P.ember2, flexShrink: 0, marginTop: 1 }}>{ei + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{e.name}</div>
                <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>{e.muscle} · descanso {e.rest}s · {e.sets.length} series</div>
                {e.superset && <div style={{ fontSize: 12.5, color: P.ember2, marginTop: 3 }}>Superserie con {e.superset}</div>}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                  {e.sets.map((s, si) => (
                    <div key={s.id} style={{ fontSize: 12.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 7, padding: "3px 7px" }}>
                      S{si + 1}: {s.repsT} reps{s.rirT !== "" ? ` · RIR ${s.rirT}` : ""}
                    </div>
                  ))}
                </div>
                {e.notes && <div style={{ fontSize: 13.5, color: P.dim, marginTop: 7, lineHeight: 1.4, fontStyle: "italic" }}>{e.notes}</div>}
              </div>
            </div>
          </Card>
        ))}
        {/* Espaciador: la barra de acciones es sticky con fondo opaco y podría
            tapar el último ejercicio si no dejamos hueco extra al final. */}
        <div style={{ height: 180 }} aria-hidden />
        <div style={{ position: "sticky", bottom: 96, marginTop: 18, display: "flex", gap: 8,
          background: P.bg, padding: "10px 0 4px", boxShadow: `0 -14px 18px -8px ${P.bg}`, zIndex: 3 }}>
          {active ? (
            <>
              <Btn kind="line" onClick={() => { setPreviewDay(null); setBrowsing(false); }} style={{ flex: 1 }}>
                <ChevronLeft size={16} /> Volver a mi sesión
              </Btn>
              <Btn kind="ember" onClick={() => setConfirmSwitch(d)} style={{ flex: 2 }}>
                <Play size={16} /> Empezar esta
              </Btn>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn kind="line" onClick={() => setPreviewDay(null)} style={{ flex: 1 }}><X size={16} /> Salir sin iniciar</Btn>
                <Btn kind="ember" onClick={() => startSession(d)} style={{ flex: 2 }}><Play size={16} /> Iniciar entrenamiento</Btn>
              </div>
              <Btn kind="ghost" onClick={() => startSession(d, true)} style={{ width: "100%", borderColor: `${P.ember}55` }}>
                <Zap size={16} color={P.ember2} /> Iniciar focus mode
              </Btn>
              <div style={{ fontSize: 12.5, color: P.faint, textAlign: "center", lineHeight: 1.4 }}>
                Focus mode: pantalla completa, un ejercicio a la vez. Puedes cambiar de modo en cualquier momento sin perder nada.
              </div>
            </div>
          )}
        </div>
        <Confirm open={!!confirmSwitch} danger title="Ya tienes una sesión en curso"
          body={`Se descartará «${active ? active.dayName : ""}» con todo lo que lleves registrado y empezará «${confirmSwitch ? confirmSwitch.name : ""}». Esta acción no se puede deshacer.`}
          okLabel="Descartar y empezar" onCancel={() => setConfirmSwitch(null)}
          onOk={() => { const day = confirmSwitch; setConfirmSwitch(null); discardSession(); startSession(day); }} />
      </div>
    );
  }

  if (listMode) {
    return (
      <div style={{ padding: "18px 16px 30px" }}>
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Entrenar</h1>
        <div style={{ color: P.dim, fontSize: 15, marginBottom: 16 }}>Toca una rutina para desplegar sus entrenamientos y luego un día para ver los ejercicios. Solo cuando aprietes «Iniciar entrenamiento» se creará la sesión y empezarán los cronómetros.</div>
        {active && (
          <Card style={{ padding: 14, marginBottom: 14, borderColor: `${P.ember}66`, background: `linear-gradient(160deg, rgba(255,255,255,.10), ${P.s1})` }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 3 }}>Sesión en curso: {active.dayName}</div>
            <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 10 }}>Estás mirando la rutina. Tu registro sigue guardado tal como lo dejaste.</div>
            <Btn kind="ember" small onClick={() => { setPreviewDay(null); setBrowsing(false); }} style={{ width: "100%" }}>
              <Play size={15} /> Volver a mi sesión
            </Btn>
          </Card>
        )}
        {plan.days.length === 0 ? (
          <Empty icon={Dumbbell} title="Aún no hay rutina" body="Tu coach todavía no carga días de entrenamiento. Pídele que entre en modo Coach y arme el plan." />
        ) : routineGroups.map((g) => {
          const open = openRoutines.includes(g.key);
          return (
            <Card key={g.key} style={{ marginBottom: 12, overflow: "hidden",
              borderColor: open ? `${P.ember}55` : P.line,
              background: open ? `linear-gradient(160deg, ${P.ember}12, ${P.s1})` : P.s1 }}>
              <button onClick={() => toggleRoutine(g.key)} aria-expanded={open}
                style={{ width: "100%", textAlign: "left", padding: "15px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                <div className="disp" style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(140deg, ${P.ember}22, ${P.ember}0A)`, border: `1px solid ${P.ember}44`, color: P.ember, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{g.key}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 18, textTransform: "uppercase" }}>{g.label}</div>
                  <div style={{ fontSize: 13.5, color: P.faint, marginTop: 2 }}>
                    {g.days.length} entrenamiento{g.days.length !== 1 ? "s" : ""} · {g.exCount} ejercicios · {g.setCount} series
                  </div>
                  {g.note && <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2, lineHeight: 1.35 }}>{g.note}</div>}
                </div>
                {open ? <ChevronUp size={19} color={P.ember} /> : <ChevronDown size={19} color={P.faint} />}
              </button>
              {open && (
                <div style={{ padding: "0 12px 12px" }}>
                  {g.days.map((d, i) => {
                    const lastDone = [...history.sessions].reverse().find((s) => s.dayId === d.id);
                    return (
                      <Card key={d.id} style={{ marginBottom: 10, background: P.s2 }}>
                        <button onClick={() => setPreviewDay(d)} style={{ width: "100%", textAlign: "left", padding: "15px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div className="disp" style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                            background: `linear-gradient(140deg, ${P.ember}22, ${P.ember}0A)`, border: `1px solid ${P.ember}44`, color: P.ember, fontSize: 18, fontWeight: 700 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16.5 }}>{d.name}</div>
                            <div style={{ fontSize: 13.5, color: P.faint, marginTop: 2 }}>
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
              )}
            </Card>
          );
        })}
        {summarySheet}
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
    setFocus(false);
    setSummary(res);
  };

  if (focus && active) {
    return (
      <>
        <FocusMode active={active} history={history} patch={patch} patchSet={patchSet} patchEx={patchEx} onError={toast} storageOK={storageOK} savedAt={savedAt}
          onExit={() => setFocus(false)} onFinish={doFinish} />
        {summarySheet}
      </>
    );
  }

  return (
    <div style={{ paddingBottom: 30 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: `${P.bg}F2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${P.line}`, padding: "10px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.dayName}</div>
            <div style={{ fontSize: 13, color: P.dim, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span>{elapsedMin} min</span><span>{doneSets}/{totalSets} series</span>
              <span style={{ color: storageOK ? P.green : P.red, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: storageOK ? P.green : P.red }} />
                {storageOK ? (savedAt ? `Guardado ${savedAt}` : "Guardado") : "Sin guardado"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <Btn kind="line" small onClick={() => setFocus(true)} title="Pasar al focus mode" aria-label="Pasar al focus mode"
              style={{ padding: "7px 9px" }}>
              <Zap size={15} />
            </Btn>
            <Btn kind="line" small onClick={() => { setBrowsing(true); setPreviewDay(null); }} title="Ver la rutina completa">
              <ClipboardList size={14} /> Rutina
            </Btn>
            <Btn kind="ember" small onClick={() => setConfirmFinish(true)}>Terminar</Btn>
          </div>
        </div>
        <div style={{ height: 5, background: P.s2, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
            background: `linear-gradient(90deg, ${P.ember}, ${P.ember2})`, transition: "width .35s ease", borderRadius: 3 }} />
        </div>
      </div>

      <div style={{ padding: "14px 14px 0" }}>
        <Card style={{ padding: "11px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Video y fotos de la sesión</div>
              <div style={{ fontSize: 12.5, color: P.faint, marginTop: 1 }}>Lo general del día: cómo te sentiste, el ambiente, un resumen</div>
            </div>
            <AttachButton mode="photo" onError={toast}
              onAttached={(aid) => patch((a) => { a.attachIds = [...(a.attachIds || []), aid]; return a; })} />
            <AttachButton mode="video" onError={toast}
              onAttached={(aid) => patch((a) => { a.attachIds = [...(a.attachIds || []), aid]; return a; })} />
          </div>
          {(active.attachIds || []).length > 0 && (
            <div style={{ display: "flex", gap: 7, marginTop: 10, overflowX: "auto" }}>
              {(active.attachIds || []).map((aid) => (
                <AttachThumb key={aid} id={aid} size={54} onOpen={setViewImg}
                  onRemove={() => patch((a) => { a.attachIds = (a.attachIds || []).filter((x) => x !== aid); return a; })} />
              ))}
            </div>
          )}
        </Card>
        {(() => {
          const out = [];
          let i = 0;
          while (i < active.exs.length) {
            const gr = exGroupInfo(active.exs, i);
            if (gr.kind) {
              // Un bloque (superserie/triserie/gigante) se renderiza UNA sola
              // vez, con todos sus ejercicios organizados por ronda.
              const members = [];
              let j = i;
              const g = active.exs[i].group;
              while (j < active.exs.length && active.exs[j].group === g) { members.push(j); j++; }
              out.push(
                <SessionGroupBlock key={"blk" + active.exs[i].id} exsAll={active.exs} members={members} kind={gr.kind} rounds={gr.rounds} history={history}
                  onPatchEx={patchEx} onPatchSet={patchSet} onSetDone={toggleDone} onInfo={onInfo} onError={toast} onOpenImg={setViewImg}
                  timer={timer} onStartRest={startRest} onAdjustRest={adjustRest} onDismissRest={() => setTimer(null)} />
              );
              i = j;
            } else {
              const ei = i;
              out.push(
                <SessionExercise key={active.exs[ei].id} ex={active.exs[ei]} exIdx={ei} gr={gr} history={history}
                  onPatchEx={(p) => patchEx(ei, p)} onPatchSet={(si, p) => patchSet(ei, si, p)}
                  onSetDone={(si) => toggleDone(ei, si)} onInfo={onInfo} onError={toast} onOpenImg={setViewImg}
                  timer={timer} onStartRest={startRest} onAdjustRest={adjustRest} onDismissRest={() => setTimer(null)} />
              );
              i++;
            }
          }
          return out;
        })()}
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

      {summarySheet}
    </div>
  );
};

/* ============================================================
   Hoy (inicio del alumno)
   ============================================================ */
const TodayTab = ({ plan, history, active, goTrain, role, allowedRoutines }) => {
  const [showInstr, setShowInstr] = useState(false);
  const wk = weekKey(todayISO());
  const weekSessions = history.sessions.filter((s) => weekKey(s.date) === wk);
  const weekVol = weekSessions.reduce((a, s) => a + s.volume, 0);
  const streak = weekStreak(history.sessions);
  const lastSession = history.sessions[history.sessions.length - 1];
  const days = visibleDays(plan.days, allowedRoutines);
  let suggested = days[0];
  if (lastSession) {
    const i = days.findIndex((d) => d.id === lastSession.dayId);
    // El siguiente día se busca dentro de la misma rutina que la última sesión
    if (i >= 0) {
      const sameRoutine = days.filter((d) => routineOf(d) === routineOf(days[i]));
      const j = sameRoutine.findIndex((d) => d.id === lastSession.dayId);
      suggested = sameRoutine[(j + 1) % sameRoutine.length] || days[0];
    } else {
      suggested = days[0];
    }
  }
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Logo />
        <div style={{ fontSize: 13, color: P.faint, textAlign: "right" }}>{fmtDateFull(todayISO())}</div>
      </div>

      {active ? (
        <Card style={{ padding: 16, marginBottom: 14, borderColor: `${P.ember}66`, background: `linear-gradient(160deg, rgba(255,255,255,.10), ${P.s1})` }}>
          <div style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 4 }}>Tienes una sesión en curso</div>
          <div style={{ fontSize: 14.5, color: P.dim, marginBottom: 12 }}>{active.dayName} — todos tus datos están guardados. Puedes retomarla exactamente donde quedaste, aunque cierres la app.</div>
          <Btn kind="ember" onClick={goTrain} style={{ width: "100%" }}><Play size={16} /> Continuar sesión</Btn>
        </Card>
      ) : suggested ? (
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Te toca · {routineLabel(routineOf(suggested))}</div>
          <div className="disp" style={{ fontSize: 21, fontWeight: 700, marginBottom: 3 }}>{suggested.name}</div>
          <div style={{ fontSize: 14, color: P.faint, marginBottom: 12 }}>{suggested.exs.length} ejercicios · {suggested.exs.reduce((a, e) => a + e.sets.length, 0)} series</div>
          <Btn kind="ember" onClick={goTrain} style={{ width: "100%" }}><Play size={16} /> Empezar a entrenar</Btn>
        </Card>
      ) : (
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <Empty icon={Dumbbell} title="Sin rutina cargada" body={role === "coach" ? "Entra a la pestaña Rutina para armar el plan." : "Tu coach aún no carga la rutina."} />
        </Card>
      )}

      {streak > 0 && (
        <Card style={{ padding: "13px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          borderColor: `${P.ember}55`, background: `linear-gradient(160deg, rgba(255,255,255,.10), ${P.s1})` }}>
          <Flame size={26} color={P.ember2} className="pulse" />
          <div style={{ flex: 1 }}>
            <div className="disp" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{streak} semana{streak !== 1 ? "s" : ""} seguida{streak !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: 13, color: P.faint, marginTop: 2 }}>entrenando sin cortar la racha</div>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Sesiones esta semana", weekSessions.length], ["Tonelaje semanal", `${Math.round(weekVol / 1000 * 10) / 10} t`], ["Sesiones totales", history.sessions.length]].map(([l, v]) => (
          <Card key={l} style={{ padding: "12px 8px", textAlign: "center" }}>
            <div className="disp" style={{ fontSize: 20, fontWeight: 700, color: P.ember2 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: P.dim, marginTop: 3, lineHeight: 1.3 }}>{l}</div>
          </Card>
        ))}
      </div>

      {plan.instructions.length > 0 && (
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <button onClick={() => setShowInstr(true)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardList size={18} color={P.ember2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>Indicaciones del coach</div>
              <div style={{ fontSize: 13.5, color: P.faint }}>{plan.instructions.length} indicaciones generales del plan</div>
            </div>
            <ChevronRight size={16} color={P.faint} />
          </button>
        </Card>
      )}

      {lastSession && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Última sesión</div>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{lastSession.dayName}</div>
          <div style={{ fontSize: 13.5, color: P.faint, marginTop: 2 }}>
            {fmtDateFull(lastSession.date)} · {lastSession.durationMin} min · {Math.round(lastSession.volume).toLocaleString("es-CL")} kg
            {lastSession.prs.length > 0 && <span style={{ color: P.ember2 }}> · {lastSession.prs.length} PR</span>}
          </div>
        </Card>
      )}

      <Sheet open={showInstr} onClose={() => setShowInstr(false)} title="Indicaciones del coach">
        {plan.instructions.map((it) => (
          <div key={it.id} style={{ padding: "12px 0", borderBottom: `1px solid ${P.line}` }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.title}</div>
            <div style={{ fontSize: 15, color: P.dim, lineHeight: 1.55 }}>{it.body}</div>
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
        <XAxis dataKey="d" tick={{ fill: P.faint, fontSize: 12 }} stroke={P.line} />
        <YAxis tick={{ fill: P.faint, fontSize: 12 }} stroke={P.line} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, fontSize: 14 }}
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
        <div style={{ fontSize: 14, color: P.dim, marginBottom: 12 }}>
          {fmtDateFull(session.date)} · {session.durationMin} min · {Math.round(session.volume).toLocaleString("es-CL")} kg totales
        </div>
        {(session.attachIds || []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Video y fotos de la sesión</div>
            <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
              {(session.attachIds || []).map((aid) => <AttachThumb key={aid} id={aid} size={62} onOpen={onOpenImg} />)}
            </div>
          </div>
        )}
        {session.exs.map((e) => {
          const entry = (history.byEx[e.exId] || []).find((en) => en.sessionId === session.id);
          if (!entry) return null;
          return (
            <div key={e.exId} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 5 }}>{e.name}</div>
              {entry.sets.filter((s) => s.done).map((s, j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 14.5, padding: "2px 0" }}>
                  <TypeBadge type={s.type} />
                  <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
                  {s.rir !== "" && <span style={{ color: P.dim, fontSize: 13 }}>RIR {s.rir}</span>}
                  {s.comment && <span style={{ color: P.ember2, fontSize: 13 }}>“{s.comment}”</span>}
                </div>
              ))}
              {entry.comment && <div style={{ fontSize: 14, color: P.ember2, marginTop: 4 }}>💬 {entry.comment}</div>}
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

// Grilla de medallas: agrupadas por categoría, con barra de progreso para
// las que faltan por desbloquear. Se usa tanto en "Mis logros" del alumno
// como (con el historial de cada uno) en Rankings del coach.
const AchievementGrid = ({ history }) => {
  const list = computeAchievements(history);
  const earnedCount = list.filter((a) => a.earned).length;
  const groups = [...new Set(list.map((a) => a.group))];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 14px",
        background: P.s1, border: `1px solid ${P.line}`, borderRadius: 14, boxShadow: CARD_LIFT }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`,
          boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px -6px rgba(224,26,26,.6)" }}>
          <Trophy size={20} color="#FFFFFF" />
        </div>
        <div><div style={{ fontWeight: 700, fontSize: 17 }}>{earnedCount} de {list.length} logros</div>
          <div style={{ fontSize: 12.5, color: P.faint }}>Sigue entrenando para desbloquear el resto</div></div>
      </div>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{g}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {list.filter((a) => a.group === g).map((a) => (
              <div key={a.id} style={{ padding: "13px 10px", borderRadius: 13, textAlign: "center",
                background: a.earned ? `linear-gradient(160deg, ${P.s3}, ${P.s2})` : P.s1,
                border: `1px solid ${a.earned ? `${P.ember}55` : P.line}`,
                boxShadow: a.earned ? CARD_LIFT : "none", opacity: a.earned ? 1 : .68 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center",
                  background: a.earned ? `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)` : P.s2,
                  boxShadow: a.earned ? "0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px -6px rgba(224,26,26,.6)" : "none" }}>
                  {a.earned ? <a.Icon size={21} color="#FFFFFF" /> : <Lock size={17} color={P.faint} />}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: P.faint }}>{a.fmt(a.value)}{!a.earned ? ` de ${a.fmt(a.need)}` : ""}</div>
                {!a.earned && (
                  <div style={{ height: 4, borderRadius: 2, background: P.s3, marginTop: 7, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${a.pct}%`, background: P.ember }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

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
    <button onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 14.5, fontWeight: 600,
      background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{label}</button>
  );

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Progreso</h1>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {subBtn("ex", "Ejercicios")}{subBtn("ses", "Sesiones")}{subBtn("vol", "Volumen")}{subBtn("body", "Cuerpo")}{subBtn("logros", "Logros")}
      </div>

      {sub === "logros" && <AchievementGrid history={history} />}

      {sub === "ex" && (
        <div>
          <select value={exId} onChange={(e) => setExId(e.target.value)} style={{ width: "100%", padding: "11px 12px", marginBottom: 12 }}>
            {allEx.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {(history.byEx[exId] || []).length === 0 ? (
            <Empty icon={TrendingUp} title="Sin datos aún" body="Cuando registres este ejercicio en una sesión, acá verás la curva de tu mejor peso, tu marca y el detalle serie a serie." />
          ) : (
            <>
              <ExerciseProgress entries={history.byEx[exId]} />
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 13, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Registro completo</div>
                <ExHistorySheetInline entries={history.byEx[exId]} onOpenImg={setViewImg} />
              </div>
            </>
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
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{s.dayName}</div>
                  <div style={{ fontSize: 13.5, color: P.faint, marginTop: 2 }}>
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

      {sub === "vol" && <VolumePanel plan={plan} />}

      {sub === "body" && (
        <div>
          <Card style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Peso corporal</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Inp type="number" inputMode="decimal" step="any" placeholder="kg de hoy" value={bw} onChange={(e) => setBw(e.target.value)} />
              <Btn kind="ember" onClick={addBW}><Plus size={16} /> Registrar</Btn>
            </div>
            {err && <div style={{ color: P.red, fontSize: 13.5, marginTop: 6 }}>{err}</div>}
            {bwData.length > 1 && <div style={{ marginTop: 10 }}><ChartBox data={bwData} unit="kg" /></div>}
            {bwData.length === 1 && <div style={{ fontSize: 14, color: P.faint, marginTop: 10 }}>Último registro: {bwData[0].v} kg ({bwData[0].d}). Con dos o más registros verás la curva.</div>}
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: P.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>Progreso: fotos y videos ({history.bodyPhotos.length})</div>
              <div style={{ display: "flex", gap: 6 }}>
                <AttachButton mode="photo" onError={setErr} onAttached={(id) => { const h = structuredClone(history); h.bodyPhotos.push({ id, date: todayISO() }); saveHistory(h); }} />
                <AttachButton mode="video" onError={setErr} onAttached={(id) => { const h = structuredClone(history); h.bodyPhotos.push({ id, date: todayISO() }); saveHistory(h); }} />
              </div>
            </div>
            {history.bodyPhotos.length === 0 ? (
              <div style={{ fontSize: 14, color: P.faint }}>Sube una foto o video cada 2–4 semanas, con la misma luz y pose, para comparar tu recomposición. Sin límite de cantidad.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[...history.bodyPhotos].reverse().map((p) => (
                  <div key={p.id} style={{ textAlign: "center" }}>
                    <AttachThumb id={p.id} onOpen={setViewImg} size={96}
                      onRemove={() => { const h = structuredClone(history); h.bodyPhotos = h.bodyPhotos.filter((x) => x.id !== p.id); saveHistory(h); }} />
                    <div style={{ fontSize: 12, color: P.faint, marginTop: 3 }}>{fmtDate(p.date)}</div>
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
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{fmtDateFull(en.date)}</span>
          <span style={{ fontSize: 12.5, color: P.faint }}>{en.dayName}</span>
        </div>
        {en.sets.filter((s) => s.done).map((s, j) => (
          <div key={j} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 14.5, padding: "2px 0" }}>
            <TypeBadge type={s.type} />
            <span style={{ fontWeight: 600 }}>{s.weight !== "" ? `${kg(+s.weight)} kg` : "—"} × {s.reps || "—"}</span>
            {s.rir !== "" && <span style={{ color: P.dim, fontSize: 13 }}>RIR {s.rir}</span>}
            {s.comment && <span style={{ color: P.ember2, fontSize: 13 }}>“{s.comment}”</span>}
          </div>
        ))}
        {en.comment && <div style={{ fontSize: 13.5, color: P.ember2, marginTop: 4 }}>💬 {en.comment}</div>}
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
  const v = macroSolve(n, n.solve || "kcal");
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Nutrición</h1>
      {hasMacros && (
        <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
          {[["kcal", v.kcal || "—", P.ember2], ["Proteína", v.p ? `${v.p} g` : "—", P.green], ["Carbos", v.c ? `${v.c} g` : "—", P.blue], ["Grasas", v.f ? `${v.f} g` : "—", "#8C8C93"]].map(([l, val, c]) => (
            <Card key={l} style={{ padding: "11px 6px", textAlign: "center" }}>
              <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: c }}>{val}</div>
              <div style={{ fontSize: 11.5, color: P.dim, marginTop: 2 }}>{l}</div>
            </Card>
          ))}
        </div>
        {v.tot > 0 && (
          <div style={{ padding: "10px 12px", background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", marginBottom: 8, background: P.s3 }}>
              <div style={{ width: `${v.pctP}%`, background: P.green }} />
              <div style={{ width: `${v.pctC}%`, background: P.blue }} />
              <div style={{ width: `${v.pctF}%`, background: "#8C8C93" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", fontSize: 12.5, color: P.dim }}>
              <span><b style={{ color: P.green }}>Proteína</b> {v.pk} kcal ({v.pctP}%)</span>
              <span><b style={{ color: P.blue }}>Carbos</b> {v.ck} kcal ({v.pctC}%)</span>
              <span><b style={{ color: "#8C8C93" }}>Grasa</b> {v.fk} kcal ({v.pctF}%)</span>
            </div>
          </div>
        )}
        </>
      )}
      {n.notes && <div style={{ fontSize: 14.5, color: P.dim, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: "11px 14px", lineHeight: 1.5, marginBottom: 14 }}>{n.notes}</div>}
      {n.meals.length === 0 ? (
        <Empty icon={Utensils} title="Sin plan de comidas" body="Tu coach aún no carga las comidas del plan." />
      ) : n.meals.map((m) => (
        <Card key={m.id} style={{ padding: "13px 15px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{m.name}</div>
            {m.time && <div style={{ fontSize: 13, color: P.faint }}>{m.time}</div>}
          </div>
          {m.items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "4px 0", borderBottom: `1px dashed ${P.line}` }}>
              <span>{it.food}</span><span style={{ color: P.dim, fontWeight: 600 }}>{it.qty}</span>
            </div>
          ))}
          {m.notes && <div style={{ fontSize: 13.5, color: P.ember2, marginTop: 7 }}>{m.notes}</div>}
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
      <div style={{ display: "flex", gap: 5, fontSize: 11.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", padding: "0 2px 4px" }}>
        <span style={{ width: 88 }}>Tipo</span><span style={{ flex: 1, minWidth: 60 }}>Reps</span><span style={{ width: 42 }}>RIR</span><span style={{ width: 46 }}>Desc</span><span style={{ width: 42 }}>−%</span><span style={{ width: 26 }} />
      </div>
      {sets.map((s, i) => {
        const hasExtras = (s.coachNote || "").length > 0 || (s.coachAttachIds || []).length > 0;
        return (
          <div key={s.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <select value={s.type} onChange={(e) => upd(i, { type: e.target.value })} style={{ width: 88, padding: "8px 4px", fontSize: 13.5 }}>
                {Object.entries(SET_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
              <input placeholder="8-10" value={s.repsT} onChange={(e) => upd(i, { repsT: e.target.value })} style={{ flex: 1, minWidth: 60, padding: "8px 6px", fontSize: 15 }} />
              <input placeholder="2" value={s.rirT} onChange={(e) => upd(i, { rirT: e.target.value })} style={{ width: 42, padding: "8px 4px", fontSize: 15, textAlign: "center" }} />
              <input type="number" inputMode="numeric" placeholder={String(exRest ?? 90)} value={s.rest ?? ""} title="Descanso de esta serie en segundos (vacío = usa el del ejercicio)"
                onChange={(e) => upd(i, { rest: e.target.value === "" ? undefined : (+e.target.value || 0) })}
                style={{ width: 46, padding: "8px 4px", fontSize: 14, textAlign: "center" }} />
              <input type="number" inputMode="numeric" placeholder="15" value={s.pct ?? ""}
                title={PCT_HINT[s.type] || "Porcentaje de bajada de carga para esta serie (libre para cualquier tipo)"}
                onChange={(e) => upd(i, { pct: e.target.value === "" ? undefined : (+e.target.value || 0) })}
                style={{ width: 42, padding: "8px 4px", fontSize: 14, textAlign: "center" }} />
              <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ color: hasExtras ? P.ember : P.faint, padding: 4 }} title="Nota y adjuntos de esta serie">
                <MessageSquare size={15} />
              </button>
              <button onClick={() => onChange(sets.filter((_, si) => si !== i))} style={{ color: P.faint, padding: 4 }}><Trash2 size={15} /></button>
            </div>
            {expanded === i && (
              <div style={{ marginTop: 6, padding: "10px 11px", background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Nota específica de la serie {i + 1}</div>
                <Txt rows={2} placeholder="Ej: solo en esta serie usa banco a 30°" value={s.coachNote || ""}
                  onChange={(e) => upd(i, { coachNote: e.target.value })} />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Enlace de video (YouTube, Drive, Instagram…)</div>
                  <Inp placeholder="https://…" value={s.coachVideo || ""} onChange={(e) => upd(i, { coachVideo: e.target.value })} style={{ fontSize: 14 }} />
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
                {attachErr && <div style={{ fontSize: 12.5, color: P.red, marginTop: 6, lineHeight: 1.4 }}>{attachErr}</div>}
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
      <div style={{ fontSize: 12.5, color: P.faint, marginTop: 6, lineHeight: 1.4 }}>
        <b>Desc</b>: segundos de descanso de esa serie (déjalo vacío para usar el del ejercicio). <b>−%</b> es el
        porcentaje de bajada de carga de esa serie y está libre para cualquier tipo (top, back-off, drop, AMRAP o
        cualquiera): déjalo vacío si no aplica. Icono 💬: nota, video y adjuntos específicos de esa serie.
      </div>
      <ImageViewer src={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

const ExerciseEditorSheet = ({ ex, onSave, onClose, onInfo, meso }) => {
  const [d, setD] = useState(ex);
  const [attachErr, setAttachErr] = useState("");
  const [preview, setPreview] = useState(null);
  useEffect(() => { setD(ex); setAttachErr(""); }, [ex]);
  if (!ex || !d) return null;
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
      <Field label="Equipo (opcional)" hint="Sirve para buscar y filtrar en la biblioteca de ejercicios.">
        <select value={d.equipment || ""} onChange={(e) => set({ equipment: e.target.value })} style={{ width: "100%", padding: "10px 10px" }}>
          <option value="">— Sin especificar —</option>
          {EQUIPMENT.map((eq) => <option key={eq}>{eq}</option>)}
        </select>
      </Field>
      <Field label="Músculos secundarios (opcional)"
        hint="Este ejercicio no es 100 % aislado para el músculo principal. Ej: un remo prioriza espalda pero también trabaja trapecio y bíceps: márcalos con el % que aportan y se suman al volumen semanal de esos grupos.">
        {(d.secondary || []).map((sec, si) => (
          <div key={si} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <select value={sec.muscle} onChange={(e) => set({ secondary: d.secondary.map((x, xi) => xi === si ? { ...x, muscle: e.target.value } : x) })}
              style={{ flex: 1, padding: "8px 8px", fontSize: 14.5 }}>
              {MUSCLES.filter((m) => m !== d.muscle).map((m) => <option key={m}>{m}</option>)}
            </select>
            <select value={sec.pct} onChange={(e) => set({ secondary: d.secondary.map((x, xi) => xi === si ? { ...x, pct: +e.target.value } : x) })}
              style={{ width: 82, padding: "8px 6px", fontSize: 14.5 }}>
              {SECONDARY_PCTS.map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
            <button onClick={() => set({ secondary: d.secondary.filter((_, xi) => xi !== si) })} style={{ color: P.faint, padding: 6 }}><Trash2 size={15} /></button>
          </div>
        ))}
        <Btn kind="line" small onClick={() => {
          const opt = MUSCLES.find((m) => m !== d.muscle && !(d.secondary || []).some((s) => s.muscle === m)) || MUSCLES[0];
          set({ secondary: [...(d.secondary || []), { muscle: opt, pct: 50 }] });
        }}><Plus size={14} /> Añadir músculo secundario</Btn>
      </Field>
      <Field label="Series"><SetsEditor sets={d.sets} onChange={(sets) => set({ sets })} onInfo={onInfo} exRest={d.rest} /></Field>
      <Field label="Vista previa del alumno" hint="Así verá el alumno este ejercicio al entrenar. Para armar una superserie/triserie une este ejercicio con el siguiente usando el clip de la lista de ejercicios.">
        <div style={{ background: P.s2, border: `1px solid ${P.line}`, borderRadius: 11, padding: "11px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{d.name || "Nombre del ejercicio"}</div>
          <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>
            {d.muscle} · descanso {fmtClock(d.rest || 120)} · {d.sets.length} serie{d.sets.length !== 1 ? "s" : ""}
            {(d.secondary || []).length > 0 && ` · también: ${d.secondary.map((s) => `${s.muscle} ${s.pct}%`).join(", ")}`}
          </div>
          {d.notes && <div style={{ fontSize: 13.5, color: P.ember2, marginTop: 7, lineHeight: 1.45 }}><b>Coach · </b>{d.notes}</div>}
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
            {d.sets.length === 0 && <div style={{ fontSize: 13.5, color: P.faint }}>Añade al menos una serie arriba.</div>}
            {d.sets.map((s, si) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: P.s1, border: `1px solid ${P.line}`, borderRadius: 9, padding: "7px 9px" }}>
                <span className="disp" style={{ fontSize: 14, fontWeight: 700, color: P.dim, width: 26 }}>S{si + 1}</span>
                <TypeBadge type={s.type} />
                <span style={{ fontSize: 13.5, color: P.dim }}>
                  {s.repsT || "—"} reps{s.rirT !== "" ? ` @ RIR ${s.rirT}` : ""}{s.pct != null && s.pct !== "" ? ` · −${s.pct}%` : ""}
                </span>
                {(s.coachNote || "").length > 0 && <span style={{ fontSize: 12.5, color: P.ember2 }}>· {s.coachNote}</span>}
              </div>
            ))}
          </div>
        </div>
      </Field>
      <Field label="Indicaciones técnicas (las verá el alumno en cada sesión)"><Txt value={d.notes} placeholder="Ej: agarre neutro, controla 3 s la bajada, pausa de 1 s abajo…" onChange={(e) => set({ notes: e.target.value })} /></Field>
      <Field label="Video de técnica (link opcional)"><Inp value={d.video} placeholder="https://youtube.com/…" onChange={(e) => set({ video: e.target.value })} /></Field>
      <Field label="Videos y fotos de demostración" hint="Se suben a la plataforma y el alumno los ve dentro del ejercicio. Videos hasta 50 MB.">
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
        {attachErr && <div style={{ fontSize: 12.5, color: P.red, marginTop: 7, lineHeight: 1.4 }}>{attachErr}</div>}
      </Field>
      {meso && meso.weeks.length > 1 && (
        <Field label="Objetivos por semana del mesociclo"
          hint="Déjalo vacío para usar las reps y el RIR de arriba. Lo que escribas aquí manda en esa semana.">
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 330 }}>
              <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: P.faint, fontWeight: 700, textTransform: "uppercase", padding: "0 2px 4px" }}>
                <span style={{ width: 96 }}>Semana</span>
                {d.sets.map((s2, i) => <span key={s2.id} style={{ flex: 1, minWidth: 92, textAlign: "center" }}>Serie {i + 1}</span>)}
              </div>
              {meso.weeks.map((w) => (
                <div key={w.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
                  <div style={{ width: 96, fontSize: 13, color: w.deload ? P.green : P.dim, fontWeight: 600,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {w.name}{w.deload ? " ↓" : ""}
                  </div>
                  {d.sets.map((s2, i) => {
                    const row = ((d.weekly || {})[w.id] || {})[i] || {};
                    const put = (patch) => set({ weekly: { ...(d.weekly || {}),
                      [w.id]: { ...((d.weekly || {})[w.id] || {}), [i]: { ...row, ...patch } } } });
                    return (
                      <div key={s2.id} style={{ flex: 1, minWidth: 92, display: "flex", gap: 4 }}>
                        <input placeholder={s2.repsT || "reps"} value={row.repsT || ""} aria-label={`Reps de ${w.name}, serie ${i + 1}`}
                          onChange={(e) => put({ repsT: e.target.value })}
                          style={{ flex: 1, minWidth: 0, padding: "7px 4px", fontSize: 14, textAlign: "center" }} />
                        <input placeholder={s2.rirT !== "" ? `RIR ${s2.rirT}` : "RIR"} value={row.rirT || ""} aria-label={`RIR de ${w.name}, serie ${i + 1}`}
                          onChange={(e) => put({ rirT: e.target.value })}
                          style={{ width: 40, padding: "7px 3px", fontSize: 14, textAlign: "center" }} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Field>
      )}
      <Field label="En superserie con (opcional)" hint="Para bloques reales usa el clip de la lista de ejercicios: une este con el siguiente y quedan como superserie, triserie o serie gigante con sus rondas.">
        <Inp value={d.superset} placeholder="Ej: Curl martillo con mancuernas" onChange={(e) => set({ superset: e.target.value })} /></Field>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn kind="line" onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn kind="ember" disabled={!d.name.trim()} onClick={() => onSave(d)} style={{ flex: 2 }}>Guardar ejercicio</Btn>
      </div>
      <ImageViewer src={preview} onClose={() => setPreview(null)} />
    </Sheet>
  );
};

/* ============================================================
   Importador de rutina desde archivo (usa Claude API)
   ============================================================ */
const ImportRoutineSheet = ({ open, onClose, plan, savePlan, toast }) => {
  const [apiKey, setApiKey] = useState("");
  const [step, setStep] = useState("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [fileB64, setFileB64] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { if (open) sGet("forja-ai-key").then((k) => k && setApiKey(k)); }, [open]);

  const reset = () => { setStep("input"); setText(""); setFile(null); setFileB64(null); setPreview(null); setErr(""); };
  const close = () => { onClose(); setTimeout(reset, 300); };

  const handleFile = async (f) => {
    if (!f) return;
    if (f.size > 30 * 1024 * 1024) { setErr("El archivo pesa más de 30 MB, muy grande para procesar."); return; }
    setErr("");
    try {
      const dataUrl = await readFileDataUrl(f);
      const b64 = dataUrl.split(",")[1];
      setFile({ name: f.name, type: f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"), size: f.size });
      setFileB64(b64);
    } catch (e) { setErr("No se pudo leer el archivo."); }
  };

  const analyze = async () => {
    if (!apiKey) { setErr("Falta configurar la API key de Anthropic. Ve a la pestaña IA."); return; }
    if (!text.trim() && !fileB64) { setErr("Sube un archivo o pega el texto de la rutina."); return; }
    setStep("analyzing"); setErr("");

    const systemPrompt = `Eres un asistente que extrae rutinas de entrenamiento estructuradas.
Analiza el contenido y devuelve SOLO JSON válido, sin markdown ni texto extra, con esta estructura:
{
  "days": [
    {
      "name": "Nombre del día (ej: Entrenamiento A, Push, Piernas...)",
      "exs": [
        {
          "name": "Nombre del ejercicio",
          "muscle": "Uno de: Pecho, Espalda, Hombro, Bíceps, Tríceps, Cuádriceps, Femoral, Glúteo, Pantorrilla, Abdomen, Antebrazo, Trapecio, Otro",
          "rest": 90,
          "notes": "Indicaciones técnicas si las hay",
          "sets": [{ "type": "normal", "repsT": "8-10", "rirT": "2" }]
        }
      ]
    }
  ]
}

REGLAS ESTRICTAS:
- "type" solo puede ser: "warmup", "normal", "top", "backoff", "drop", "restpause", "amrap", "cluster", "vma", "midiso", "pfi", "density"
- "repsT" es string ("8-10", "12", "AMRAP")
- "rirT" es string con número o vacío
- IE (Intensidad del Esfuerzo, escala 1-10) convertir a RIR: IE 10 → RIR "0", IE 9 → RIR "1", IE 8 → RIR "2", IE 7 → RIR "3", IE 6 → RIR "4"
- Si hay reps distintas por serie ("10-12 / 8-10 / 6-8"), crea una entrada en "sets" por cada una
- "rest": segundos (120 compuestos, 90 aislados si no está especificado)
- Traduce nombres al español si el original está en portugués o inglés
- No inventes ejercicios que no estén en el documento`;

    const content = [];
    if (fileB64 && file) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      content.push({
        type: isPdf ? "document" : "image",
        source: { type: "base64", media_type: isPdf ? "application/pdf" : (file.type || "image/jpeg"), data: fileB64 },
      });
    }
    if (text.trim()) content.push({ type: "text", text: text.trim() });
    if (content.length === 0) content.push({ type: "text", text: "Extrae la rutina del archivo adjunto." });

    try {
      const data = await callClaudeAPI(apiKey, {
        model: "claude-opus-4-6",
        max_tokens: 32000,
        system: systemPrompt,
        messages: [{ role: "user", content }],
      });
      const rawText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const result = parseRoutineJSON(rawText);
      if (!result) throw new Error("La IA no devolvió una rutina legible. Prueba pegar el texto, o sube el archivo por partes (por ej. un mes a la vez).");
      const parsed = result.data;
      if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) throw new Error("No se detectaron días en la rutina.");
      setPreview(parsed);
      setStep("preview");
      if (result.truncated && toast) toast(`⚠ La rutina era muy larga y se recuperaron ${parsed.days.length} días. Revisa que estén todos.`);
    } catch (e) {
      setErr(e.message || "Error al analizar");
      setStep("input");
    }
  };

  const applyDays = (mode) => {
    if (!preview) return;
    const newDays = daysFromAIJson(preview.days);
    const p = structuredClone(plan);
    const routine = mode === "replace" ? ROUTINE_A : nextRoutineKey(p.days);
    const tagged = newDays.map((d) => ({ ...d, routine }));
    if (mode === "replace") p.days = tagged;
    else p.days = [...p.days, ...tagged];
    p.updatedAt = todayISO();
    savePlan(p);
    if (toast) toast(`✓ Importada como ${routineLabel(routine)}: ${newDays.length} día${newDays.length !== 1 ? "s" : ""}, ${newDays.reduce((a, d) => a + d.exs.length, 0)} ejercicios`);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title="Importar rutina desde archivo" tall>
      {!apiKey && (
        <Card style={{ padding: 12, marginBottom: 12, borderColor: `${P.ember}66`, background: `${P.ember}0A` }}>
          <div style={{ fontSize: 14, color: P.dim, lineHeight: 1.5 }}>
            <b style={{ color: P.ember2 }}>Falta la API key.</b> Para usar el importador con IA, primero configura tu API key de Anthropic en la pestaña <b>IA</b> del modo Coach.
          </div>
        </Card>
      )}

      {step === "input" && (
        <>
          <div style={{ fontSize: 14.5, color: P.dim, marginBottom: 14, lineHeight: 1.5 }}>
            Sube un PDF, foto o pega el texto de la rutina. La IA la analiza y crea los días y ejercicios automáticamente. Puedes reemplazar el plan actual o añadir estos días al final.
          </div>

          <Field label="Subir archivo (PDF, foto o screenshot)">
            <label style={{ display: "block", padding: "16px 12px", background: P.s2, border: `2px dashed ${P.line}`, borderRadius: 12, textAlign: "center", cursor: "pointer" }}>
              <input type="file" accept="application/pdf,image/*" style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
              <Upload size={22} color={P.faint} style={{ margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: 14, color: P.dim }}>Toca para elegir archivo</div>
              <div style={{ fontSize: 12.5, color: P.faint, marginTop: 3 }}>PDF, JPG, PNG · hasta 30 MB</div>
            </label>
            {file && <div style={{ fontSize: 13.5, color: P.green, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              <button onClick={() => { setFile(null); setFileB64(null); }} style={{ color: P.faint, marginLeft: "auto" }}><X size={13} /></button>
            </div>}
          </Field>

          <div style={{ textAlign: "center", padding: "6px 0", color: P.faint, fontSize: 12, fontWeight: 700, letterSpacing: ".1em" }}>— O TAMBIÉN —</div>

          <Field label="Pegar texto de la rutina">
            <Txt rows={6} placeholder="Ej:&#10;Día A - Push&#10;Press banca 4x8-10 RIR 2&#10;Press militar 3x10-12&#10;..." value={text} onChange={(e) => setText(e.target.value)} />
          </Field>

          {err && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${P.red}22`, border: `1px solid ${P.red}55`, fontSize: 13.5, color: P.red, marginBottom: 10, lineHeight: 1.4 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn kind="line" onClick={close} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn kind="ember" disabled={!apiKey || (!text.trim() && !fileB64)} onClick={analyze} style={{ flex: 2 }}>
              <Sparkles size={15} /> Analizar con IA
            </Btn>
          </div>
        </>
      )}

      {step === "analyzing" && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div className="pulse"><Sparkles size={36} color={P.ember} /></div>
          <div style={{ marginTop: 16, fontWeight: 700, fontSize: 16 }}>Analizando la rutina…</div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: P.dim, lineHeight: 1.5 }}>Esto puede tardar entre 15 y 45 segundos según el tamaño del archivo.</div>
        </div>
      )}

      {step === "preview" && preview && (
        <>
          <Card style={{ padding: "12px 14px", marginBottom: 12, background: `${P.green}0F`, borderColor: `${P.green}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Check size={16} color={P.green} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Análisis completo</div>
            </div>
            <div style={{ fontSize: 14, color: P.dim }}>
              <b>{preview.days.length} día{preview.days.length !== 1 ? "s" : ""}</b> · <b>{preview.days.reduce((a, d) => a + (d.exs || []).length, 0)} ejercicios</b> · <b>{preview.days.reduce((a, d) => a + (d.exs || []).reduce((b, e) => b + (e.sets || []).length, 0), 0)} series</b>
            </div>
          </Card>

          {preview.days.map((d, i) => (
            <Card key={i} style={{ padding: "11px 13px", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{d.name}</div>
              <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>{(d.exs || []).length} ejercicios</div>
              <div style={{ marginTop: 7 }}>
                {(d.exs || []).map((e, ei) => (
                  <div key={ei} style={{ fontSize: 13.5, color: P.dim, padding: "3px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>• {e.name}</span>
                    <span style={{ color: P.faint, flexShrink: 0 }}>{(e.sets || []).length}s · {e.muscle}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div style={{ fontSize: 13, color: P.faint, marginTop: 10, marginBottom: 10, lineHeight: 1.5 }}>
            Puedes deshacer con el botón «Deshacer» si algo salió mal.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn kind="line" onClick={() => { setStep("input"); setPreview(null); }} style={{ flex: 1 }}>Reintentar</Btn>
            <Btn kind="line" onClick={() => applyDays("append")} style={{ flex: 1.4 }}>
              <Plus size={14} /> Añadir al plan
            </Btn>
            <Btn kind="ember" onClick={() => applyDays("replace")} style={{ flex: 1.4 }}>
              <RotateCcw size={14} /> Reemplazar plan
            </Btn>
          </div>
        </>
      )}
    </Sheet>
  );
};


/* ---- Plantillas populares de mesociclo: crean la lista de semanas de un
   golpe (nombre + descarga + una nota breve de enfoque por semana). No
   tocan los ejercicios — los objetivos por semana de cada ejercicio se
   siguen llenando a mano (o quedan vacíos y usan los valores del propio
   ejercicio). ---- */
const MESO_TEMPLATES = [
  { id: "lineal", name: "Progresión lineal clásica", desc: "Sube la intensidad semana a semana y cierra con descarga. La opción más simple para empezar.",
    weeks: [
      { name: "Semana 1", deload: false, notes: "RIR 3-4 · técnica y volumen base" },
      { name: "Semana 2", deload: false, notes: "RIR 2-3 · sube el peso levemente" },
      { name: "Semana 3", deload: false, notes: "RIR 1-2 · casi al fallo" },
      { name: "Semana 4", deload: false, notes: "RIR 0-1 · semana pico" },
      { name: "Semana 5 · Descarga", deload: true, notes: "50% del volumen · RIR 4-5" },
    ] },
  { id: "dup", name: "Ondulante diaria (DUP)", desc: "Alterna semanas de fuerza, hipertrofia y volumen dentro del mismo bloque.",
    weeks: [
      { name: "Semana 1 · Fuerza", deload: false, notes: "3-5 reps · RIR 2" },
      { name: "Semana 2 · Hipertrofia", deload: false, notes: "8-12 reps · RIR 2" },
      { name: "Semana 3 · Volumen", deload: false, notes: "12-15 reps · RIR 1-2" },
      { name: "Semana 4 · Descarga", deload: true, notes: "50% del volumen · RIR 4-5" },
    ] },
  { id: "bloques", name: "Periodización por bloques", desc: "Acumulación → Intensificación → Realización: el clásico de fuerza-hipertrofia.",
    weeks: [
      { name: "Semana 1 · Acumulación", deload: false, notes: "Alto volumen · RIR 3" },
      { name: "Semana 2 · Acumulación", deload: false, notes: "Alto volumen · RIR 2-3" },
      { name: "Semana 3 · Intensificación", deload: false, notes: "Baja volumen, sube intensidad · RIR 1-2" },
      { name: "Semana 4 · Intensificación", deload: false, notes: "RIR 1" },
      { name: "Semana 5 · Realización", deload: false, notes: "Bajo volumen, pico de intensidad · RIR 0-1" },
      { name: "Semana 6 · Descarga", deload: true, notes: "50% del volumen · RIR 4-5" },
    ] },
  { id: "autoreg", name: "Autorregulada por RIR", desc: "El RIR baja fijo cada semana; tú ajustas el peso del alumno según cómo responda.",
    weeks: [
      { name: "Semana 1", deload: false, notes: "RIR 4" },
      { name: "Semana 2", deload: false, notes: "RIR 3" },
      { name: "Semana 3", deload: false, notes: "RIR 2" },
      { name: "Semana 4", deload: false, notes: "RIR 1" },
      { name: "Semana 5 · Descarga", deload: true, notes: "RIR 5" },
    ] },
];

function parseMesoJSON(rawText) {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]);
    if (!data.weeks || !Array.isArray(data.weeks) || !data.weeks.length) return null;
    return data;
  } catch { return null; }
}

/* ---- Importar mesociclo con IA: mismo patrón que ImportRoutineSheet
   (sube PDF/foto/texto, la IA lo lee), pero acá solo arma el contenedor
   de semanas (nombre + descarga + una nota de enfoque) — no toca los
   ejercicios uno por uno. ---- */
const ImportMesoSheet = ({ open, onClose, toast, onAdd }) => {
  const [apiKey, setApiKey] = useState("");
  const [step, setStep] = useState("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [fileB64, setFileB64] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { if (open) sGet("forja-ai-key").then((k) => k && setApiKey(k)); }, [open]);
  const reset = () => { setStep("input"); setText(""); setFile(null); setFileB64(null); setPreview(null); setErr(""); };
  const close = () => { onClose(); setTimeout(reset, 300); };

  const handleFile = async (f) => {
    if (!f) return;
    if (f.size > 30 * 1024 * 1024) { setErr("El archivo pesa más de 30 MB, muy grande para procesar."); return; }
    setErr("");
    try {
      const dataUrl = await readFileDataUrl(f);
      const b64 = dataUrl.split(",")[1];
      setFile({ name: f.name, type: f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"), size: f.size });
      setFileB64(b64);
    } catch (e) { setErr("No se pudo leer el archivo."); }
  };

  const analyze = async () => {
    if (!apiKey) { setErr("Falta configurar la API key de Anthropic. Ve a la pestaña IA."); return; }
    if (!text.trim() && !fileB64) { setErr("Sube un archivo o pega el texto del mesociclo."); return; }
    setStep("analyzing"); setErr("");
    const systemPrompt = `Eres un asistente que extrae la ESTRUCTURA de un mesociclo de entrenamiento (solo las semanas, no ejercicios).
Analiza el contenido y devuelve SOLO JSON válido, sin markdown ni texto extra, con esta estructura:
{
  "name": "Nombre corto del mesociclo (ej: Fuerza bloque 1, Hipertrofia preverano...)",
  "weeks": [
    { "name": "Nombre de la semana (ej: Semana 1, Semana 1 · Acumulación...)", "deload": false, "notes": "Foco breve: RIR objetivo, volumen, énfasis (máx 12 palabras)" }
  ]
}
REGLAS ESTRICTAS:
- "deload" es true solo en semanas de descarga/recuperación
- Máximo 12 semanas
- "notes" siempre en español, corto
- No inventes semanas que no estén sugeridas por el documento`;
    const content = [];
    if (fileB64 && file) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      content.push({ type: isPdf ? "document" : "image", source: { type: "base64", media_type: isPdf ? "application/pdf" : (file.type || "image/jpeg"), data: fileB64 } });
    }
    if (text.trim()) content.push({ type: "text", text: text.trim() });
    if (content.length === 0) content.push({ type: "text", text: "Extrae la estructura del mesociclo del archivo adjunto." });
    try {
      const data = await callClaudeAPI(apiKey, { model: "claude-opus-4-6", max_tokens: 8000, system: systemPrompt, messages: [{ role: "user", content }] });
      const rawText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const parsed = parseMesoJSON(rawText);
      if (!parsed) throw new Error("La IA no devolvió un mesociclo legible. Prueba pegar el texto en vez del archivo.");
      setPreview(parsed);
      setStep("preview");
    } catch (e) {
      setErr(e.message || "Error al analizar");
      setStep("input");
    }
  };

  const apply = () => {
    if (!preview) return;
    onAdd(preview.name || "Mesociclo importado", preview.weeks);
    if (toast) toast(`✓ Mesociclo «${preview.name || "importado"}» creado con ${preview.weeks.length} semana${preview.weeks.length !== 1 ? "s" : ""}`);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title="Importar mesociclo con IA" tall>
      {!apiKey && (
        <Card style={{ padding: 12, marginBottom: 12, borderColor: `${P.ember}66`, background: `${P.ember}0A` }}>
          <div style={{ fontSize: 14, color: P.dim, lineHeight: 1.5 }}>
            <b style={{ color: P.ember2 }}>Falta la API key.</b> Configúrala en la pestaña <b>IA</b> del modo Coach.
          </div>
        </Card>
      )}
      {step === "input" && (
        <>
          <div style={{ fontSize: 14.5, color: P.dim, marginBottom: 14, lineHeight: 1.5 }}>
            Sube un PDF, foto o pega el texto de un mesociclo (el tuyo o uno que te haya pasado alguien). La IA arma las semanas — nombre, si es descarga y un enfoque breve. Los ejercicios y sus objetivos por semana se cargan después, dentro de cada ejercicio.
          </div>
          <Field label="Subir archivo (PDF, foto o screenshot)">
            <label style={{ display: "block", padding: "16px 12px", background: P.s2, border: `2px dashed ${P.line}`, borderRadius: 12, textAlign: "center", cursor: "pointer" }}>
              <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
              <Upload size={22} color={P.faint} style={{ margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: 14, color: P.dim }}>Toca para elegir archivo</div>
              <div style={{ fontSize: 12.5, color: P.faint, marginTop: 3 }}>PDF, JPG, PNG · hasta 30 MB</div>
            </label>
            {file && <div style={{ fontSize: 13.5, color: P.green, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              <button onClick={() => { setFile(null); setFileB64(null); }} style={{ color: P.faint, marginLeft: "auto" }}><X size={13} /></button>
            </div>}
          </Field>
          <div style={{ textAlign: "center", padding: "6px 0", color: P.faint, fontSize: 12, fontWeight: 700, letterSpacing: ".1em" }}>— O TAMBIÉN —</div>
          <Field label="Pegar texto del mesociclo">
            <Txt rows={6} placeholder="Ej:&#10;Semana 1: RIR 3, volumen base&#10;Semana 2: RIR 2&#10;Semana 3: descarga&#10;..." value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {err && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${P.red}22`, border: `1px solid ${P.red}55`, fontSize: 13.5, color: P.red, marginBottom: 10, lineHeight: 1.4 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn kind="line" onClick={close} style={{ flex: 1 }}>Cancelar</Btn>
            <Btn kind="ember" disabled={!apiKey || (!text.trim() && !fileB64)} onClick={analyze} style={{ flex: 2 }}><Sparkles size={15} /> Analizar con IA</Btn>
          </div>
        </>
      )}
      {step === "analyzing" && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div className="pulse"><Sparkles size={36} color={P.ember} /></div>
          <div style={{ marginTop: 16, fontWeight: 700, fontSize: 16 }}>Analizando el mesociclo…</div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: P.dim, lineHeight: 1.5 }}>Esto puede tardar unos segundos.</div>
        </div>
      )}
      {step === "preview" && preview && (
        <>
          <Card style={{ padding: "12px 14px", marginBottom: 12, background: `${P.green}0F`, borderColor: `${P.green}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Check size={16} color={P.green} /><div style={{ fontWeight: 700, fontSize: 15 }}>{preview.name || "Mesociclo importado"}</div>
            </div>
            <div style={{ fontSize: 14, color: P.dim }}><b>{preview.weeks.length}</b> semana{preview.weeks.length !== 1 ? "s" : ""}</div>
          </Card>
          {preview.weeks.map((w, i) => (
            <div key={i} style={{ padding: "8px 11px", marginBottom: 6, borderRadius: 10, background: P.s2, border: `1px solid ${P.line}` }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: w.deload ? P.green : P.text }}>{w.name}{w.deload ? " · descarga" : ""}</div>
              {w.notes && <div style={{ fontSize: 12.5, color: P.faint, marginTop: 2 }}>{w.notes}</div>}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <Btn kind="line" onClick={() => { setStep("input"); setPreview(null); }} style={{ flex: 1 }}>Reintentar</Btn>
            <Btn kind="ember" onClick={apply} style={{ flex: 2 }}><Plus size={14} /> Crear mesociclo</Btn>
          </div>
        </>
      )}
    </Sheet>
  );
};

/* ---- Mesociclos: uno o varios bloques, cada uno con sus propias semanas.
   El header de cada bloque muestra su NOMBRE (Mesociclo 1, o el que le
   pongas) — las "Semana 1, 2, 3..." solo aparecen al desplegarlo. ---- */
const MesociclosPanel = ({ plan, savePlan, toast }) => {
  const [openMesoId, setOpenMesoId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const state = mesoStateOf(plan);
  const mut = (fn) => {
    const p = structuredClone(plan);
    if (!p.mesoState || !Array.isArray(p.mesoState.mesociclos) || !p.mesoState.mesociclos.length) p.mesoState = mesoStateOf(p);
    fn(p);
    p.updatedAt = todayISO();
    savePlan(p);
  };

  const addMesociclo = (name, weeksSeed) => {
    const id = uid();
    mut((p) => {
      const m = { id, name: name || `Mesociclo ${p.mesoState.mesociclos.length + 1}`, notes: "", current: 0,
        weeks: weeksSeed && weeksSeed.length ? weeksSeed.map((w) => ({ id: uid(), name: w.name, deload: !!w.deload, notes: w.notes || "" })) : [{ id: uid(), name: "Semana 1", deload: false }] };
      p.mesoState.mesociclos.push(m);
      p.mesoState.currentMesoId = m.id;
    });
    setOpenMesoId(id);
  };
  const renameMesociclo = (mesoId, name) => mut((p) => { const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (m) m.name = name; });
  const setCurrentMesociclo = (mesoId) => mut((p) => { p.mesoState.currentMesoId = mesoId; });
  const delMesociclo = (mesoId) => mut((p) => {
    if (p.mesoState.mesociclos.length <= 1) return;
    const target = p.mesoState.mesociclos.find((x) => x.id === mesoId);
    p.mesoState.mesociclos = p.mesoState.mesociclos.filter((x) => x.id !== mesoId);
    if (p.mesoState.currentMesoId === mesoId) p.mesoState.currentMesoId = p.mesoState.mesociclos[0].id;
    const deadWeekIds = new Set((target ? target.weeks : []).map((w) => w.id));
    p.days.forEach((d) => d.exs.forEach((e) => { if (e.weekly) deadWeekIds.forEach((wid) => delete e.weekly[wid]); }));
  });
  const addWeek = (mesoId, deload) => mut((p) => {
    const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (!m) return;
    m.weeks.push({ id: uid(), name: `Semana ${m.weeks.length + 1}`, deload: !!deload });
  });
  const delWeek = (mesoId, weekId) => mut((p) => {
    const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (!m || m.weeks.length <= 1) return;
    m.weeks = m.weeks.filter((w) => w.id !== weekId);
    if (m.current >= m.weeks.length) m.current = m.weeks.length - 1;
    p.days.forEach((d) => d.exs.forEach((e) => { if (e.weekly) delete e.weekly[weekId]; }));
  });
  const renameWeek = (mesoId, weekId, name) => mut((p) => {
    const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (!m) return;
    const w = m.weeks.find((x) => x.id === weekId); if (w) w.name = name;
  });
  const toggleDeload = (mesoId, weekId) => mut((p) => {
    const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (!m) return;
    const w = m.weeks.find((x) => x.id === weekId); if (w) w.deload = !w.deload;
  });
  const setCurrentWeekOf = (mesoId, i) => mut((p) => {
    const m = p.mesoState.mesociclos.find((x) => x.id === mesoId); if (m) m.current = i;
  });

  const cm = currentMesociclo(plan);
  const delTarget = confirmDel ? state.mesociclos.find((m) => m.id === confirmDel) : null;

  return (
    <>
      <Card style={{ marginBottom: 22, overflow: "hidden", borderColor: `${P.blue}44` }}>
        <div style={{ padding: "13px 14px 2px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `${P.blue}1E`, border: `1px solid ${P.blue}55`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar size={19} color={P.blue} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>Mesociclos</div>
            <div style={{ fontSize: 13, color: P.dim, marginTop: 2 }}>{state.mesociclos.length} mesociclo{state.mesociclos.length !== 1 ? "s" : ""} · en curso: {cm.name}</div>
          </div>
        </div>
        <div style={{ padding: "10px 14px 14px" }}>
          <div style={{ fontSize: 13, color: P.faint, lineHeight: 1.45, marginBottom: 10 }}>
            Cada mesociclo agrupa varias semanas. El que está «en curso» es el que ve el alumno; dentro de cada semana marcas cuál es la activa. Los objetivos por semana de cada ejercicio se editan dentro del ejercicio.
          </div>
          {state.mesociclos.map((m) => {
            const open = openMesoId === m.id;
            const isCurrent = state.currentMesoId === m.id;
            const cur = m.weeks[Math.min(m.current || 0, m.weeks.length - 1)];
            return (
              <div key={m.id} style={{ marginBottom: 10, borderRadius: 12, overflow: "hidden",
                border: `1px solid ${isCurrent ? `${P.ember}66` : P.line}`, background: isCurrent ? `${P.ember}0A` : P.s2 }}>
                <button onClick={() => setOpenMesoId(open ? null : m.id)} style={{ width: "100%", textAlign: "left", padding: "11px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  {isCurrent && <span title="Mesociclo en curso" style={{ width: 8, height: 8, borderRadius: 4, background: P.ember, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflowWrap: "break-word" }}>{m.name}</div>
                    <div style={{ fontSize: 12.5, color: P.faint, marginTop: 1 }}>{m.weeks.length} semana{m.weeks.length !== 1 ? "s" : ""} · {cur.name}{cur.deload ? " (descarga)" : ""}</div>
                  </div>
                  {open ? <ChevronUp size={16} color={P.faint} /> : <ChevronDown size={16} color={P.faint} />}
                </button>
                {open && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 9, flexWrap: "wrap" }}>
                      <input value={m.name} onChange={(e) => renameMesociclo(m.id, e.target.value)} aria-label="Nombre del mesociclo"
                        style={{ flex: 1, minWidth: 120, padding: "7px 9px", fontSize: 14.5 }} />
                      {!isCurrent && <Btn kind="line" small onClick={() => setCurrentMesociclo(m.id)}>Poner en curso</Btn>}
                      {state.mesociclos.length > 1 && (
                        <button onClick={() => setConfirmDel(m.id)} aria-label={`Eliminar ${m.name}`} style={{ padding: 6, color: P.faint }}><Trash2 size={15} /></button>
                      )}
                    </div>
                    {m.weeks.map((w, i) => (
                      <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 9px", marginBottom: 6, borderRadius: 10,
                        background: i === m.current ? `${P.ember}14` : P.s1, border: `1px solid ${i === m.current ? `${P.ember}66` : P.line}` }}>
                        <button onClick={() => setCurrentWeekOf(m.id, i)} title="Marcar como semana en curso" aria-label={`Marcar ${w.name} como semana en curso`}
                          style={{ width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                            border: `2px solid ${i === m.current ? P.ember : P.line}`, background: i === m.current ? P.ember : "transparent" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input value={w.name} onChange={(e) => renameWeek(m.id, w.id, e.target.value)} aria-label={`Nombre de la semana ${i + 1}`}
                            style={{ width: "100%", padding: "5px 7px", fontSize: 14, background: "transparent", border: "none" }} />
                          {w.notes && <div style={{ fontSize: 11.5, color: P.faint, padding: "0 7px" }}>{w.notes}</div>}
                        </div>
                        <button onClick={() => toggleDeload(m.id, w.id)} title="Marcar como semana de descarga"
                          style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 7px", borderRadius: 7, whiteSpace: "nowrap",
                            color: w.deload ? P.green : P.faint, background: w.deload ? "rgba(255,255,255,.14)" : "transparent",
                            border: `1px solid ${w.deload ? "rgba(255,255,255,.45)" : P.line}` }}>
                          Descarga
                        </button>
                        {m.weeks.length > 1 && (
                          <button onClick={() => delWeek(m.id, w.id)} aria-label={`Eliminar ${w.name}`} style={{ padding: 5, color: P.faint }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <Btn kind="line" small onClick={() => addWeek(m.id, false)} style={{ flex: 1, minWidth: 120 }}><Plus size={13} /> Añadir semana</Btn>
                      <Btn kind="line" small onClick={() => addWeek(m.id, true)} style={{ flex: 1, minWidth: 130 }}><Plus size={13} /> Semana de descarga</Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
            <Btn kind="line" small onClick={() => addMesociclo(`Mesociclo ${state.mesociclos.length + 1}`)} style={{ flex: 1, minWidth: 160 }}><Plus size={14} /> Desde cero</Btn>
            <Btn kind="line" small onClick={() => setTemplatesOpen(true)} style={{ flex: 1, minWidth: 160 }}><Library size={14} /> Plantillas populares</Btn>
            <Btn kind="ember" small onClick={() => setImportOpen(true)} style={{ flex: 1, minWidth: 160 }}><Sparkles size={14} /> Importar con IA</Btn>
          </div>
        </div>
      </Card>

      <Sheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Plantillas de mesociclo" tall>
        <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 14, lineHeight: 1.5 }}>
          Crea un mesociclo nuevo ya armado con una estructura de semanas popular. Puedes editarlo después como cualquier otro.
        </div>
        {MESO_TEMPLATES.map((t) => (
          <Card key={t.id} style={{ padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 3 }}>{t.name}</div>
            <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 8, lineHeight: 1.4 }}>{t.desc}</div>
            <div style={{ fontSize: 12, color: P.faint, marginBottom: 10 }}>{t.weeks.length} semanas · {t.weeks.filter((w) => w.deload).length} de descarga</div>
            <Btn kind="ember" small onClick={() => { addMesociclo(t.name, t.weeks); setTemplatesOpen(false); if (toast) toast(`✓ Mesociclo «${t.name}» creado`); }} style={{ width: "100%" }}>
              <Plus size={14} /> Usar esta plantilla
            </Btn>
          </Card>
        ))}
      </Sheet>

      <ImportMesoSheet open={importOpen} onClose={() => setImportOpen(false)} toast={toast} onAdd={(name, weeks) => addMesociclo(name, weeks)} />

      <Confirm open={!!confirmDel} danger title="Eliminar mesociclo"
        body={delTarget ? `Se eliminará «${delTarget.name}» con sus ${delTarget.weeks.length} semana${delTarget.weeks.length !== 1 ? "s" : ""}. Los objetivos por semana que tuvieran cargados los ejercicios para esas semanas también se borran. Esta acción no se puede deshacer.` : ""}
        okLabel="Eliminar" onOk={() => { delMesociclo(confirmDel); setConfirmDel(null); }} onCancel={() => setConfirmDel(null)} />
    </>
  );
};

/* ============================================================
   Biblioteca de ejercicios: catálogo reutilizable de ejercicios, aparte
   de la rutina en sí. Reutiliza exactamente el mismo editor y la misma
   forma de dato que un ejercicio de rutina (ExerciseEditorSheet), así
   que agregar uno a la biblioteca se ve y se llena igual que agregarlo
   a un día. El agente IA también puede sumar ejercicios acá (ver
   BodybuildingChat / forja-biblioteca).
   ============================================================ */
// Junta todos los ejercicios ya usados —en cualquier día de cualquier
// rutina (A, B, C…), y también los que solo quedaron en el historial de
// sesiones porque ya se borraron de la rutina actual— y arma un candidato
// de biblioteca por cada nombre distinto (sin distinguir mayúsculas). Si
// el mismo nombre aparece más de una vez, se queda con la versión más
// completa (más series, con notas, con video, con secundarios).
function libraryExercisesFromPlanAndHistory(plan, history) {
  const byName = new Map();
  const richness = (ex) => (ex.sets ? ex.sets.length : 0) + (ex.notes ? 2 : 0) + (ex.video ? 1 : 0) + (ex.secondary ? ex.secondary.length : 0);

  (plan.days || []).forEach((d) => (d.exs || []).forEach((e) => {
    const key = (e.name || "").trim().toLowerCase();
    if (!key) return;
    const prev = byName.get(key);
    if (!prev || richness(e) > richness(prev)) byName.set(key, e);
  }));

  const byEx = (history && history.byEx) || {};
  Object.keys(byEx).forEach((exId) => {
    const entries = byEx[exId] || [];
    if (!entries.length) return;
    const last = entries[entries.length - 1];
    const key = (last.exName || "").trim().toLowerCase();
    if (!key || byName.has(key)) return; // ya cubierto por una rutina actual
    byName.set(key, {
      name: last.exName,
      muscle: "Otro",
      rest: 90,
      notes: "",
      video: "",
      secondary: [],
      sets: (last.sets && last.sets.length) ? last.sets.map((s) => ({
        type: Object.keys(SET_TYPES).includes(s.type) ? s.type : "normal",
        repsT: s.repsT || "8-10",
        rirT: s.rirT || "",
        pct: s.pct != null ? s.pct : 15,
      })) : [{ type: "normal", repsT: "8-10", rirT: "", pct: 15 }],
    });
  });

  return [...byName.values()];
}

const LibraryPanel = ({ plan, savePlan, onInfo, toast, onCopyExercise, history }) => {
  const [q, setQ] = useState("");
  const [muscleF, setMuscleF] = useState([]);
  const [equipF, setEquipF] = useState([]);
  const [editEx, setEditEx] = useState(null); // ejercicio de biblioteca en edición (o nuevo)
  const [del, setDel] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const lib = plan.library || [];

  const mut = (fn) => { const p = structuredClone(plan); fn(p); p.updatedAt = todayISO(); savePlan(p); };
  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = lib.filter((e) => {
    if (q.trim() && !e.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (muscleF.length && !muscleF.includes(e.muscle)) return false;
    if (equipF.length && !equipF.includes(e.equipment || "")) return false;
    return true;
  });

  const newExTemplate = () => ({ id: uid(), isNew: true, name: "", muscle: MUSCLES[0], equipment: "", rest: 120, video: "", superset: "", notes: "", secondary: [], sets: [{ id: uid(), type: "normal", repsT: "8-10", rirT: "2", pct: 15 }] });

  // Suma a la biblioteca todo lo que ya está registrado en las rutinas (A/B/C…)
  // y en el historial de sesiones (por si algún ejercicio ya se borró de la
  // rutina actual). Nunca duplica: si el nombre ya existe en la biblioteca
  // (sin distinguir mayúsculas), lo salta.
  const importUsed = () => {
    const candidates = libraryExercisesFromPlanAndHistory(plan, history);
    const existing = new Set(lib.map((x) => (x.name || "").trim().toLowerCase()));
    const toAdd = candidates.filter((c) => !existing.has((c.name || "").trim().toLowerCase()));
    if (!toAdd.length) { if (toast) toast("No hay ejercicios nuevos: la biblioteca ya los tiene todos."); return; }
    mut((p) => {
      if (!p.library) p.library = [];
      toAdd.forEach((c) => {
        p.library.push({
          id: uid(), name: c.name, muscle: c.muscle || "Otro", equipment: c.equipment || "",
          rest: c.rest || 90, notes: c.notes || "", video: c.video || "", superset: "",
          secondary: (c.secondary || []).map((s) => ({ ...s })),
          coachAttachIds: c.coachAttachIds ? [...c.coachAttachIds] : [],
          sets: (c.sets && c.sets.length ? c.sets : [{ type: "normal", repsT: "8-10", rirT: "", pct: 15 }])
            .map((s) => ({ id: uid(), type: s.type, repsT: s.repsT, rirT: s.rirT, pct: s.pct })),
        });
      });
    });
    if (toast) toast(`✓ ${toAdd.length} ejercicio${toAdd.length !== 1 ? "s" : ""} nuevo${toAdd.length !== 1 ? "s" : ""} agregado${toAdd.length !== 1 ? "s" : ""} desde rutinas y sesiones`);
  };

  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, flexShrink: 0,
      background: active ? `${P.ember}22` : P.s2, border: `1px solid ${active ? `${P.ember}66` : P.line}`, color: active ? P.ember2 : P.dim }}>{label}</button>
  );

  return (
    <div>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12 }}>
        Catálogo de ejercicios reutilizable, aparte de la rutina. Búscalos, cópialos y pégalos en cualquier día. El agente IA también puede sumar ejercicios acá cuando se lo pidas.
      </div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={16} color={P.faint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <Inp value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio por nombre…" style={{ paddingLeft: 34 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Grupo muscular</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {MUSCLES.map((m) => chip(m, muscleF.includes(m), () => toggle(muscleF, setMuscleF, m)))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Equipo</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {EQUIPMENT.map((eq) => chip(eq, equipF.includes(eq), () => toggle(equipF, setEquipF, eq)))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Btn kind="ember" onClick={() => setEditEx(newExTemplate())} style={{ flex: 1, minWidth: 170 }}>
          <Plus size={16} /> Añadir ejercicio a la biblioteca
        </Btn>
        <Btn kind="line" onClick={importUsed} style={{ flex: 1, minWidth: 220 }}>
          <ClipboardList size={16} /> Cargar los ya usados en rutinas y sesiones
        </Btn>
      </div>

      {lib.length === 0 ? (
        <Empty icon={Library} title="Biblioteca vacía" body="Añade ejercicios a mano o pídele al agente IA que sume los que recomiende. Después los copias y pegas en cualquier día de la rutina." />
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 14, color: P.faint, textAlign: "center", padding: "20px 0" }}>Ningún ejercicio calza con la búsqueda o los filtros.</div>
      ) : (
        filtered.map((e) => (
          <Card key={e.id} style={{ padding: "11px 12px", marginBottom: 9 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <button onClick={() => setEditEx(structuredClone(e))} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25 }}>{e.name}</div>
                <div style={{ fontSize: 12.5, color: P.faint, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>{e.muscle}</span>{e.equipment && <span>· {e.equipment}</span>}<span>· {e.sets.length} serie{e.sets.length !== 1 ? "s" : ""}</span>
                </div>
              </button>
              <button onClick={() => onCopyExercise(e)} title="Copiar (después pégalo en cualquier día de la rutina)" aria-label={`Copiar ${e.name}`} style={{ padding: 5, color: P.faint }}><Copy size={15} /></button>
              <button onClick={() => setDel(e)} style={{ padding: 5, color: P.faint }}><Trash2 size={15} /></button>
            </div>
          </Card>
        ))
      )}

      <ExerciseEditorSheet ex={editEx} onClose={() => setEditEx(null)} onInfo={onInfo}
        onSave={(exd) => { const { isNew, ...clean } = exd; mut((p) => {
          if (!p.library) p.library = [];
          const i = p.library.findIndex((x) => x.id === clean.id);
          if (i >= 0) p.library[i] = clean; else p.library.push(clean);
        }); setEditEx(null); if (toast) toast(`✓ «${exd.name}» guardado en la biblioteca`); }} />

      <Confirm open={!!del} danger title="Eliminar de la biblioteca" body={del ? `¿Eliminar «${del.name}» de la biblioteca? No afecta a las rutinas donde ya se usó.` : ""}
        okLabel="Eliminar" onCancel={() => setDel(null)}
        onOk={() => { mut((p) => { p.library = (p.library || []).filter((x) => x.id !== del.id); }); setDel(null); }} />

      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

const RoutineTab = ({ plan, savePlan, onInfo, toast, history, student, onUpdateStudent }) => {
  const [view, setView] = useState("dias"); // 'dias' | 'biblioteca'
  const [openDay, setOpenDay] = useState(null);
  const [editEx, setEditEx] = useState(null); // {dayId, ex}
  const [del, setDel] = useState(null); // {type:'day'|'ex', dayId, exId, name}
  const [importOpen, setImportOpen] = useState(false);
  const [copiedEx, setCopiedEx] = useState(null);
  const [copiedDay, setCopiedDay] = useState(null);
  const [fichaEx, setFichaEx] = useState(null); // ejercicio con la ficha técnica abierta (vista previa del coach)
  const [viewImg, setViewImg] = useState(null);
  const [openRoutines, setOpenRoutines] = useState([]);   // rutinas desplegadas (arranca todo colapsado)
  const toggleRoutine = (key) => setOpenRoutines((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  // Ocultar/mostrar una rutina para el alumno actual. Nunca deja que el
  // alumno se quede sin ninguna rutina visible.
  const toggleRoutineVisible = (key) => {
    if (!student || !onUpdateStudent) return;
    const allKeys = groupDaysByRoutine(plan.days).map((g) => g.key);
    const current = (student.allowedRoutines && student.allowedRoutines.length) ? student.allowedRoutines : allKeys.slice();
    const willHide = current.includes(key);
    if (willHide && current.length <= 1) {
      if (toast) toast(`${student.name} debe poder ver al menos una rutina.`);
      return;
    }
    let next = willHide ? current.filter((k) => k !== key) : [...current, key];
    if (next.length >= allKeys.length) next = []; // todas visibles = sin restricción
    onUpdateStudent({ allowedRoutines: next });
    if (toast) toast(willHide ? `${student.name} ya no ve ${routineLabel(key)}` : `${student.name} vuelve a ver ${routineLabel(key)}`);
  };
  // Reordenar los días arrastrando: mantén pulsado ~400 ms sobre un día y
  // suéltalo sobre otro. Si el destino está en otra rutina, adopta esa rutina.
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef({ holdTimer: null, activated: false, blockUntil: 0, startX: 0, startY: 0 });
  const mut = (fn) => { const p = structuredClone(plan); fn(p); p.updatedAt = todayISO(); savePlan(p); };
  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; normalizeGroups(arr); };
  // Reordenar días sin sacarlos de su rutina
  const moveDay = (p, di, dir) => {
    const key = routineOf(p.days[di]);
    let j = di + dir;
    while (j >= 0 && j < p.days.length && routineOf(p.days[j]) !== key) j += dir;
    if (j < 0 || j >= p.days.length) return;
    [p.days[di], p.days[j]] = [p.days[j], p.days[di]];
  };
  const copyExercise = (ex) => {
    setCopiedEx(structuredClone(ex));
    if (toast) toast(`✓ «${ex.name}» copiado con todas sus indicaciones`);
  };
  const pasteExercise = (dayId) => {
    if (!copiedEx) return;
    const pasted = structuredClone(copiedEx);
    pasted.id = uid();
    delete pasted.isNew;
    pasted.sets = (pasted.sets || []).map((s) => ({ ...s, id: uid() }));
    mut((p) => p.days.find((day) => day.id === dayId).exs.push(pasted));
    if (toast) toast(`✓ «${pasted.name}» pegado con series, indicaciones y adjuntos`);
  };
  // El arrastre arranca solo desde el asa de puntos, así el resto de la
  // tarjeta se sigue pudiendo tocar y el móvil no activa la selección de texto.
  const startDrag = (dayId, e) => {
    e.preventDefault();
    const st = dragRef.current;
    clearTimeout(st.holdTimer);
    st.activated = false;
    st.startX = e.clientX; st.startY = e.clientY;
    st.holdTimer = setTimeout(() => {
      st.activated = true;
      setDragging(dayId);
      try { navigator.vibrate && navigator.vibrate(25); } catch {}
    }, 220);
  };
  const cancelPress = (e) => {
    const st = dragRef.current;
    // Si el dedo se mueve más de 8 px antes de activarse, no era mantener pulsado
    if (e && st.holdTimer && !st.activated) {
      const dx = Math.abs(e.clientX - st.startX), dy = Math.abs(e.clientY - st.startY);
      if (dx > 8 || dy > 8) clearTimeout(st.holdTimer);
    }
  };
  const endDrag = () => {
    const st = dragRef.current;
    clearTimeout(st.holdTimer);
    if (dragging) {
      // Se ignora el clic que cierra el arrastre, pero solo ese: con un flag
      // suelto, el siguiente toque en cualquier tarjeta se perdía.
      st.blockUntil = Date.now() + 250;
      if (dragOver && dragOver !== dragging) {
        mut((p) => {
          const from = p.days.findIndex((d) => d.id === dragging);
          const to = p.days.findIndex((d) => d.id === dragOver);
          if (from < 0 || to < 0 || from === to) return;
          const [moved] = p.days.splice(from, 1);
          const insertAt = to > from ? to - 1 : to;
          const dest = p.days[insertAt];
          if (dest && dest.routine !== moved.routine) moved.routine = dest.routine;
          p.days.splice(insertAt, 0, moved);
        });
      }
    }
    st.activated = false;
    setDragging(null); setDragOver(null);
  };
  // Mientras arrastras, los eventos van al documento (así funciona aunque el
  // dedo salga de la tarjeta original), y el scroll queda bloqueado.
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      autoScrollNearEdge(e.clientY);
      const card = elementUnderY(document.querySelectorAll("[data-day-card]"), e.clientY);
      const overId = card ? card.getAttribute("data-day-card") : null;
      setDragOver((prev) => (prev === overId ? prev : overId));
      e.preventDefault();
    };
    const up = () => endDrag();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // El scroll de la página se deja activo a propósito (para el
    // auto-scroll de arriba): touch-action:none en el asa ya evita que el
    // navegador confunda el gesto con un scroll nativo mientras se arrastra.
    document.body.classList.add("fj-dragging");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("fj-dragging");
    };
  }, [dragging, dragOver]);

  // Reordenar ejercicios (o bloques enteros de superserie/triserie/gigante)
  // dentro de un mismo día, mismo mecanismo de mantener pulsado que los días.
  const [exDragging, setExDragging] = useState(null);   // {dayId, blockKey}
  const [exDragOver, setExDragOver] = useState(null);   // {dayId, blockKey}
  const exDragRef = useRef({ holdTimer: null, activated: false, blockUntil: 0, startX: 0, startY: 0 });
  const startExDrag = (dayId, blockKey, e) => {
    e.preventDefault();
    const st = exDragRef.current;
    clearTimeout(st.holdTimer);
    st.activated = false;
    st.startX = e.clientX; st.startY = e.clientY;
    st.holdTimer = setTimeout(() => {
      st.activated = true;
      setExDragging({ dayId, blockKey });
      try { navigator.vibrate && navigator.vibrate(25); } catch {}
    }, 220);
  };
  const cancelExPress = (e) => {
    const st = exDragRef.current;
    if (e && st.holdTimer && !st.activated) {
      const dx = Math.abs(e.clientX - st.startX), dy = Math.abs(e.clientY - st.startY);
      if (dx > 8 || dy > 8) clearTimeout(st.holdTimer);
    }
  };
  const endExDrag = () => {
    const st = exDragRef.current;
    clearTimeout(st.holdTimer);
    if (exDragging) {
      st.blockUntil = Date.now() + 250;
      if (exDragOver && exDragOver.dayId === exDragging.dayId && exDragOver.blockKey !== exDragging.blockKey) {
        mut((p) => {
          const day = p.days.find((d) => d.id === exDragging.dayId);
          if (day) moveBlock(day.exs, exDragging.blockKey, exDragOver.blockKey);
        });
      }
    }
    st.activated = false;
    setExDragging(null); setExDragOver(null);
  };
  useEffect(() => {
    if (!exDragging) return;
    const move = (e) => {
      autoScrollNearEdge(e.clientY);
      const candidates = Array.from(document.querySelectorAll("[data-ex-block]")).filter((c) => c.getAttribute("data-ex-day") === exDragging.dayId);
      const card = elementUnderY(candidates, e.clientY);
      const overKey = card ? card.getAttribute("data-ex-block") : null;
      setExDragOver((prev) => (overKey ? { dayId: exDragging.dayId, blockKey: overKey } : null));
      e.preventDefault();
    };
    const up = () => endExDrag();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.body.classList.add("fj-dragging");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("fj-dragging");
    };
  }, [exDragging, exDragOver]);

  // Reordenar rutinas completas (bloques A/B/C…) arrastrando el asa de su
  // encabezado, mismo mecanismo de mantener pulsado que días y ejercicios.
  const [routineDragging, setRoutineDragging] = useState(null); // key
  const [routineDragOver, setRoutineDragOver] = useState(null); // key
  const routineDragRef = useRef({ holdTimer: null, activated: false, blockUntil: 0, startX: 0, startY: 0 });
  const startRoutineDrag = (key, e) => {
    e.preventDefault();
    const st = routineDragRef.current;
    clearTimeout(st.holdTimer);
    st.activated = false;
    st.startX = e.clientX; st.startY = e.clientY;
    st.holdTimer = setTimeout(() => {
      st.activated = true;
      setRoutineDragging(key);
      try { navigator.vibrate && navigator.vibrate(25); } catch {}
    }, 220);
  };
  const cancelRoutinePress = (e) => {
    const st = routineDragRef.current;
    if (e && st.holdTimer && !st.activated) {
      const dx = Math.abs(e.clientX - st.startX), dy = Math.abs(e.clientY - st.startY);
      if (dx > 8 || dy > 8) clearTimeout(st.holdTimer);
    }
  };
  const endRoutineDrag = () => {
    const st = routineDragRef.current;
    clearTimeout(st.holdTimer);
    if (routineDragging) {
      st.blockUntil = Date.now() + 250;
      if (routineDragOver && routineDragOver !== routineDragging) {
        mut((p) => moveRoutineGroup(p, routineDragging, routineDragOver));
      }
    }
    st.activated = false;
    setRoutineDragging(null); setRoutineDragOver(null);
  };
  useEffect(() => {
    if (!routineDragging) return;
    const move = (e) => {
      autoScrollNearEdge(e.clientY);
      const card = elementUnderY(document.querySelectorAll("[data-routine-group]"), e.clientY);
      const overKey = card ? card.getAttribute("data-routine-group") : null;
      setRoutineDragOver((prev) => (prev === overKey ? prev : overKey));
      e.preventDefault();
    };
    const up = () => endRoutineDrag();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.body.classList.add("fj-dragging");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("fj-dragging");
    };
  }, [routineDragging, routineDragOver]);

  const [copiedRoutine, setCopiedRoutine] = useState(null);
  // Copia la rutina completa: todos sus días, con todos sus ejercicios y series.
  const copyRoutine = (g) => {
    setCopiedRoutine({ label: g.label, days: structuredClone(g.days) });
    if (toast) toast(`✓ ${g.label} copiada completa: ${g.days.length} día${g.days.length !== 1 ? "s" : ""}`);
  };
  // Pega la rutina copiada como una rutina nueva (letra libre), con ids nuevos
  // en días, ejercicios y series para no compartir estado con la original.
  const pasteRoutine = () => {
    if (!copiedRoutine) return;
    mut((p) => {
      const key = nextRoutineKey(p.days);
      const clones = copiedRoutine.days.map((d) => ({
        ...structuredClone(d), id: uid(), routine: key,
        exs: (d.exs || []).map((e) => ({ ...e, id: uid(), sets: (e.sets || []).map((s) => ({ ...s, id: uid() })) })),
      }));
      p.days.push(...clones);
      setOpenRoutines((o) => [...o, key]);
    });
    if (toast) toast(`✓ ${copiedRoutine.label} pegada como rutina nueva`);
  };

  // Vuelca todos los ejercicios del día copiado dentro de otro día ya existente.
  // Cada ejercicio y cada serie se clonan con ids nuevos para no compartir estado
  // con el día original.
  const pasteDayExercises = (dayId) => {
    if (!copiedDay) return;
    const clones = (copiedDay.exs || []).map((e) => ({
      ...structuredClone(e), id: uid(),
      sets: (e.sets || []).map((s) => ({ ...structuredClone(s), id: uid() })),
    }));
    if (!clones.length) return;
    mut((p) => { p.days.find((day) => day.id === dayId).exs.push(...clones); });
    if (toast) toast(`✓ ${clones.length} ejercicio${clones.length !== 1 ? "s" : ""} de «${copiedDay.name}» añadido${clones.length !== 1 ? "s" : ""}`);
  };
  // Copiar el día entero: todos sus ejercicios con series, notas, videos y adjuntos
  const copyDay = (day) => {
    setCopiedDay(structuredClone(day));
    if (toast) toast(`✓ Día «${day.name}» copiado: ${day.exs.length} ejercicios con todo su contenido`);
  };
  // Pega el día al final de la rutina indicada. Todo se clona con ids nuevos
  // para que editar la copia no toque el original.
  const pasteDay = (routineKey) => {
    if (!copiedDay) return;
    const src = structuredClone(copiedDay);
    const taken = new Set(plan.days.map((d) => d.name));
    let name = src.name;
    if (taken.has(name)) {
      let n = 2;
      while (taken.has(`${src.name} (${n})`)) n++;
      name = `${src.name} (${n})`;
    }
    const pasted = {
      ...src,
      id: uid(),
      name,
      routine: routineKey,
      exs: (src.exs || []).map((e) => ({ ...e, id: uid(), sets: (e.sets || []).map((s) => ({ ...s, id: uid() })) })),
    };
    mut((p) => {
      const at = p.days.reduce((last, day, i) => (routineOf(day) === routineKey ? i + 1 : last), p.days.length);
      p.days.splice(at, 0, pasted);
    });
    if (toast) toast(`✓ «${pasted.name}» pegado en ${routineLabel(routineKey)} con sus ${pasted.exs.length} ejercicios`);
  };

  return (
    // El padding inferior es más grande que en otras pestañas a propósito: la
    // barra de navegación fija tapa el final de la lista y, sin este espacio
    // extra, un bloque de superserie/triserie (más alto que un ejercicio
    // suelto) puede quedar atrapado detrás de la barra sin forma de
    // desplazarlo a la vista para poder arrastrarlo.
    <div style={{ padding: "18px 16px calc(100px + env(safe-area-inset-bottom))" }}>
      <h1 style={{ fontSize: 28, textTransform: "uppercase", margin: "4px 0 6px" }}>Rutina</h1>
      <div style={{ color: P.dim, fontSize: 15.5, marginBottom: 8 }}>Arma los días y ejercicios. Cada cambio se guarda solo y el alumno lo ve al instante.</div>
      {student && student.allowedRoutines && student.allowedRoutines.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, padding: "8px 11px", marginBottom: 14 }}>
          <EyeOff size={14} color={P.ember2} style={{ flexShrink: 0 }} />
          {student.name} solo ve {student.allowedRoutines.map(routineLabel).join(", ")}. Usa el ícono de ojo en cada rutina para cambiarlo.
        </div>
      )}

      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 13, padding: 4, marginBottom: 22, boxShadow: CARD_LIFT }}>
        {[["dias", "Días", ClipboardList], ["biblioteca", "Biblioteca", Library]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 4px", borderRadius: 10, fontSize: 14.5, fontWeight: 600,
            background: view === id ? P.s3 : "transparent", color: view === id ? P.text : P.faint, border: `1px solid ${view === id ? P.line : "transparent"}` }}>
            <Icon size={14} /> {label}{id === "biblioteca" && (plan.library || []).length > 0 ? ` (${plan.library.length})` : ""}
          </button>
        ))}
      </div>

      {view === "biblioteca" && <LibraryPanel plan={plan} savePlan={savePlan} onInfo={onInfo} toast={toast} onCopyExercise={copyExercise} history={history} />}

      {view === "dias" && (<>
      <MesociclosPanel plan={plan} savePlan={savePlan} toast={toast} />

      <Card style={{ marginBottom: 26, padding: 0, overflow: "hidden", background: `linear-gradient(150deg, ${P.ember}1F, ${P.s1} 55%)`, borderColor: `${P.ember}4A` }}>
        <button onClick={() => setImportOpen(true)} style={{ width: "100%", textAlign: "left", padding: "15px 15px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`,
            boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px -6px rgba(255,40,60,.6)" }}>
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16.5 }}>Importar rutina con IA</div>
            <div style={{ fontSize: 13.5, color: P.dim, marginTop: 2, lineHeight: 1.35 }}>Sube un PDF, foto o pega el texto. Claude arma los días y ejercicios solo.</div>
          </div>
          <ChevronRight size={18} color={P.faint} />
        </button>
      </Card>

      {plan.days.length === 0 && (
        <Empty icon={ClipboardList} title="El plan está vacío" body="Usa «Importar rutina con IA» para cargarla desde un archivo, o toca «Nuevo día» abajo para crearla a mano." />
      )}

      {groupDaysByRoutine(plan.days).map((g) => { const open = openRoutines.includes(g.key);
        const routineVisible = !student || isRoutineVisible(student.allowedRoutines, g.key); return (
        <div key={g.key} data-routine-group={g.key}
          onClickCapture={(e) => { if (Date.now() < (routineDragRef.current.blockUntil || 0)) { e.stopPropagation(); e.preventDefault(); } }}
          style={{ marginBottom: 26, borderRadius: 16,
            background: routineDragging === g.key ? P.s2 : (routineDragOver === g.key && routineDragging ? P.s1 : "transparent"),
            boxShadow: routineDragging === g.key ? DRAG_LIFT_SHADOW : "none",
            transform: routineDragging === g.key ? DRAG_LIFT_TRANSFORM : "none",
            transition: "background .12s ease, box-shadow .14s ease, transform .14s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open ? 12 : 0 }}>
            {/* Encabezado de rutina como tarjeta propia con relieve: la letra
                va en una placa con degradado (el acento rojo vive ahí, no en
                todo el texto), y el nombre queda en blanco — así no se ve
                como un simple texto rojo "pegado" sobre el fondo. */}
            <button onClick={() => toggleRoutine(g.key)} aria-expanded={open}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
                background: P.s1, border: `1px solid ${P.line}`, borderRadius: 14, padding: "11px 13px",
                boxShadow: CARD_LIFT, textAlign: "left" }}>
              <span style={{ flexShrink: 0, minWidth: 36, height: 36, borderRadius: 11, padding: "0 4px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`,
                boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px -6px rgba(255,40,60,.6)",
                color: "#FFFFFF", fontWeight: 800, fontSize: 15, letterSpacing: ".01em" }}>{g.key}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="disp" style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", color: P.text, lineHeight: 1.1 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: P.faint, marginTop: 2 }}>
                  {g.days.length} día{g.days.length !== 1 ? "s" : ""} · {g.exCount} ejercicios · {g.setCount} series
                  {!routineVisible && <span style={{ color: P.ember2, fontWeight: 700 }}> · Oculta para {student.name}</span>}
                </div>
              </div>
              {open ? <ChevronUp size={18} color={P.ember} /> : <ChevronDown size={18} color={P.faint} />}
            </button>
            {student && onUpdateStudent && (
              <button onClick={() => toggleRoutineVisible(g.key)}
                title={routineVisible ? `Ocultar ${g.label} para ${student.name}` : `Mostrarle ${g.label} a ${student.name}`}
                aria-label={routineVisible ? `Ocultar ${g.label}` : `Mostrar ${g.label}`}
                style={{ padding: 6, color: routineVisible ? P.faint : P.ember2 }}>
                {routineVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            )}
            <button onClick={() => copyRoutine(g)} title="Copiar la rutina completa" aria-label={`Copiar ${g.label} completa`}
              style={{ padding: 6, color: P.faint }}><Copy size={15} /></button>
            <button
              onPointerDown={(e) => startRoutineDrag(g.key, e)}
              onPointerMove={cancelRoutinePress}
              onPointerUp={() => { const st = routineDragRef.current; if (!routineDragging) clearTimeout(st.holdTimer); }}
              onPointerCancel={() => { const st = routineDragRef.current; clearTimeout(st.holdTimer); st.activated = false; }}
              onContextMenu={(e) => e.preventDefault()}
              title="Mantén pulsado aquí y arrastra para mover la rutina completa"
              aria-label={`Mover ${g.label}`}
              style={{ padding: "6px 2px", color: routineDragging === g.key ? P.ember : P.faint, cursor: "grab",
                position: "relative", zIndex: 60,
                touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}>
              <GripVertical size={17} />
            </button>
          </div>
          {open && (<>
          {g.items.map(({ day: d, index: di }) => (
            <Card key={d.id}
              data-day-card={d.id}
              onClickCapture={(e) => { if (Date.now() < (dragRef.current.blockUntil || 0)) { e.stopPropagation(); e.preventDefault(); } }}
              style={{ marginBottom: 12, overflow: "hidden", position: "relative",
                // Al engancharla, la ficha se despega del fondo con efecto 3D:
                // se agranda y se levanta hacia el usuario, como si fuera a
                // salir de la pantalla, con sombra profunda + anillo rojo.
                background: dragging === d.id ? P.s3 : (dragOver === d.id && dragging ? P.s2 : P.s1),
                boxShadow: dragging === d.id ? DRAG_LIFT_SHADOW : "none",
                transform: dragging === d.id ? DRAG_LIFT_TRANSFORM : (dragOver === d.id && dragging ? "scale(.98)" : "none"),
                // "auto" cuando no se arrastra: un z-index numérico aquí (aunque
                // sea bajo) crea un contexto de apilamiento que atrapa a los
                // descendientes (p.ej. el asa "Mantén pulsado para mover", con
                // z-index:60) y les impide ganarle a la barra inferior fija
                // (z-index:50) cuando el asa cae en esa franja de la pantalla.
                zIndex: dragging === d.id ? 5 : "auto",
                transition: "background .12s ease, box-shadow .14s ease, transform .14s ease",
                WebkitUserSelect: dragging ? "none" : "auto", userSelect: dragging ? "none" : "auto" }}>
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 4, alignItems: "center", gap: 6, padding: "11px 12px" }}>
                <button onClick={() => setOpenDay(openDay === d.id ? null : d.id)} style={{ flex: 1, minWidth: 150, textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, overflowWrap: "break-word" }}>{d.name}</div>
                  <div style={{ fontSize: 13, color: P.faint }}>{d.exs.length} ejercicios · {d.exs.reduce((a, e) => a + e.sets.length, 0)} series</div>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <button onClick={() => mut((p) => moveDay(p, di, -1))} style={{ padding: 6, color: P.faint }}><ArrowUp size={15} /></button>
                  <button onClick={() => mut((p) => moveDay(p, di, +1))} style={{ padding: 6, color: P.faint }}><ArrowDown size={15} /></button>
                  <button onClick={() => copyDay(d)} title="Copiar el día completo" aria-label={`Copiar el día ${d.name}`}
                    style={{ padding: 6, color: copiedDay && copiedDay.id === d.id ? P.ember2 : P.faint }}><Copy size={15} /></button>
                  <button onClick={() => { const name = prompt("Nombre del día:", d.name); if (name) mut((p) => { p.days[di].name = name; }); }} style={{ padding: 6, color: P.faint }}><PencilLine size={15} /></button>
                  <button onClick={() => setDel({ type: "day", dayId: d.id, name: d.name })} style={{ padding: 6, color: P.faint }}><Trash2 size={15} /></button>
                  <button onClick={() => setOpenDay(openDay === d.id ? null : d.id)} style={{ padding: 6, color: P.faint }}>{openDay === d.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  <button
                    onPointerDown={(e) => startDrag(d.id, e)}
                    onPointerMove={cancelPress}
                    onPointerUp={() => { const st = dragRef.current; if (!dragging) clearTimeout(st.holdTimer); }}
                    onPointerCancel={() => { const st = dragRef.current; clearTimeout(st.holdTimer); st.activated = false; }}
                    onContextMenu={(e) => e.preventDefault()}
                    title="Mantén pulsado aquí y arrastra para mover el día"
                    aria-label={`Mover el día ${d.name}`}
                    style={{ padding: "6px 2px", color: dragging === d.id ? P.ember : P.faint, cursor: "grab",
                      position: "relative", zIndex: 60,
                      touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}>
                    <GripVertical size={17} />
                  </button>
                </div>
              </div>
              {openDay === d.id && (
                <div style={{ padding: "0 12px 12px" }}>
                  {(() => { const blocks = exBlocks(d.exs); return d.exs.map((e, ei) => {
                    const gr = exGroupInfo(d.exs, ei);
                    const blockKey = (blocks.find((b) => ei >= b.start && ei < b.end) || {}).key;
                    const exDraggingHere = exDragging && exDragging.dayId === d.id && exDragging.blockKey === blockKey;
                    const exDragOverHere = exDragOver && exDragOver.dayId === d.id && exDragOver.blockKey === blockKey && exDragging && exDragging.blockKey !== blockKey;
                    return (
                    <div key={e.id} data-ex-block={blockKey} data-ex-day={d.id}
                      onClickCapture={(ev) => { if (Date.now() < (exDragRef.current.blockUntil || 0)) { ev.stopPropagation(); ev.preventDefault(); } }}
                      style={{ background: exDraggingHere ? P.s3 : "transparent", boxShadow: exDraggingHere ? DRAG_LIFT_SHADOW : "none",
                        transform: exDraggingHere ? DRAG_LIFT_TRANSFORM : (exDragOverHere ? "scale(.98)" : "none"), borderRadius: exDraggingHere || exDragOverHere ? 12 : 0,
                        transition: "background .12s ease, box-shadow .14s ease, transform .14s ease",
                        WebkitUserSelect: exDragging ? "none" : "auto", userSelect: exDragging ? "none" : "auto" }}>
                    {gr.first && gr.kind && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, padding: "0 2px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                          color: GROUP_KINDS[gr.kind].color, background: `${GROUP_KINDS[gr.kind].color}1E`,
                          border: `1px solid ${GROUP_KINDS[gr.kind].color}55`, borderRadius: 6, padding: "2px 7px" }}>
                          {GROUP_KINDS[gr.kind].label} · {gr.size} ejercicios seguidos
                        </span>
                        <span style={{ fontSize: 12.5, color: P.faint }}>rondas</span>
                        <input type="text" inputMode="numeric" value={gr.roundsRaw}
                          aria-label={`Rondas de la ${GROUP_KINDS[gr.kind].label.toLowerCase()}`}
                          placeholder="1"
                          onChange={(ev) => { const raw = ev.target.value.replace(/[^0-9]/g, "");
                            mut((p) => p.days[di].exs.forEach((x) => { if (x.group === e.group) x.groupRounds = raw; })); }}
                          style={{ width: 46, padding: "5px 4px", fontSize: 14, textAlign: "center" }} />
                        <button onClick={() => mut((p) => { const grp = e.group; p.days[di].exs.forEach((x) => { if (x.group === grp) { delete x.group; delete x.groupRounds; } }); })}
                          aria-label="Deshacer el bloque" title="Deshacer el bloque (los ejercicios quedan sueltos)"
                          style={{ fontSize: 12, fontWeight: 600, color: P.faint, padding: "3px 7px", borderRadius: 7, border: `1px solid ${P.line}` }}>
                          Deshacer bloque
                        </button>
                      </div>
                    )}
                    <div style={{ background: P.s2,
                      border: `1px solid ${gr.kind ? `${GROUP_KINDS[gr.kind].color}55` : P.line}`,
                      borderLeft: gr.kind ? `3px solid ${GROUP_KINDS[gr.kind].color}` : `1px solid ${P.line}`,
                      borderRadius: 11, padding: "9px 10px", marginBottom: gr.linkedToNext ? 2 : 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setEditEx({ dayId: d.id, ex: structuredClone(e) })} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.25, overflowWrap: "break-word" }}>
                          {gr.posLabel && <span style={{ color: gr.kind ? GROUP_KINDS[gr.kind].color : P.faint, marginRight: 5 }}>{gr.posLabel}</span>}{e.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: P.faint, display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                          {e.sets.map((s) => <TypeBadge key={s.id} type={s.type} />)}
                          {parseTempo(e.notes) && (
                            <span style={{ padding: "1px 6px", borderRadius: 5, border: `1px solid ${P.line}`, color: P.dim, fontWeight: 700 }}>
                              Tempo {parseTempo(e.notes)}
                            </span>
                          )}
                        </div>
                      </button>
                      <button onClick={() => mut((p) => move(p.days[di].exs, ei, -1))} style={{ padding: 5, color: P.faint }}><ArrowUp size={14} /></button>
                      <button onClick={() => mut((p) => move(p.days[di].exs, ei, +1))} style={{ padding: 5, color: P.faint }}><ArrowDown size={14} /></button>
                      <button onClick={() => setFichaEx(e)} title="Ver ficha técnica (vista previa del alumno)" aria-label={`Ver ficha técnica de ${e.name}`} style={{ padding: 5, color: P.faint }}><Info size={14} /></button>
                      <button onClick={() => copyExercise(e)} title="Copiar ejercicio completo" aria-label={`Copiar ${e.name}`} style={{ padding: 5, color: P.faint }}><Copy size={14} /></button>
                      {ei < d.exs.length - 1 && (
                        <button onClick={() => mut((p) => toggleLink(p.days[di].exs, ei))}
                          title={gr.linkedToNext ? "Separar de aquí (rompe el bloque en este punto)" : "Unir con el siguiente: forma superserie / triserie / serie gigante"}
                          aria-label={gr.linkedToNext ? `Separar ${e.name} del siguiente` : `Unir ${e.name} con el siguiente en superserie`}
                          style={{ padding: 5, color: gr.linkedToNext ? GROUP_KINDS[gr.kind || "superset"].color : P.faint,
                            transform: gr.linkedToNext ? "none" : "rotate(90deg)" }}>
                          <Paperclip size={15} />
                        </button>
                      )}
                      <button onClick={() => setDel({ type: "ex", dayId: d.id, exId: e.id, name: e.name })} style={{ padding: 5, color: P.faint }}><Trash2 size={14} /></button>
                    </div>
                    {gr.first && (
                      <button
                        onPointerDown={(ev) => startExDrag(d.id, blockKey, ev)}
                        onPointerMove={cancelExPress}
                        onPointerUp={() => { const st = exDragRef.current; if (!exDragging) clearTimeout(st.holdTimer); }}
                        onPointerCancel={() => { const st = exDragRef.current; clearTimeout(st.holdTimer); st.activated = false; }}
                        onContextMenu={(ev) => ev.preventDefault()}
                        title={gr.kind ? "Mantén pulsado y arrastra para mover todo el bloque" : "Mantén pulsado y arrastra para mover el ejercicio"}
                        aria-label={`Mover ${gr.kind ? "el bloque de " : ""}${e.name}`}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          marginTop: 8, padding: "8px 0", borderRadius: 8, border: `1px dashed ${exDraggingHere ? P.ember : P.line}`,
                          color: exDraggingHere ? P.ember : P.faint, fontSize: 12.5, fontWeight: 600, cursor: "grab",
                          position: "relative", zIndex: 60,
                          touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}>
                        <GripVertical size={15} /> Mantén pulsado para mover{gr.kind ? " el bloque" : ""}
                      </button>
                    )}
                    </div>
                    </div>
                  );});})()}
                  <div style={{ fontSize: 12.5, color: P.faint, lineHeight: 1.4, margin: "2px 2px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                    <Paperclip size={12} /> Toca el clip de un ejercicio para unirlo con el de abajo. Dos = superserie, tres = triserie, cuatro o más = serie gigante. Une otro más para agrandar el bloque.
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <Btn kind="ghost" small onClick={() => setEditEx({ dayId: d.id, ex: { id: uid(), isNew: true, name: "", muscle: MUSCLES[0], rest: 120, video: "", superset: "", notes: "", secondary: [], sets: [{ id: uid(), type: "normal", repsT: "8-10", rirT: "2", pct: 15 }] } })} style={{ flex: 1, minWidth: 150 }}>
                      <Plus size={15} /> Añadir ejercicio
                    </Btn>
                    {copiedEx && (
                      <Btn kind="line" small onClick={() => pasteExercise(d.id)} style={{ flex: 1.25, minWidth: 170 }}>
                        <ClipboardList size={15} /> Pegar «{copiedEx.name}»
                      </Btn>
                    )}
                    {copiedDay && copiedDay.id !== d.id && (copiedDay.exs || []).length > 0 && (
                      <Btn kind="line" small onClick={() => pasteDayExercises(d.id)} style={{ flex: 1.5, minWidth: 200 }}>
                        <ClipboardList size={15} /> Pegar {copiedDay.exs.length} ejercicios de «{copiedDay.name}»
                      </Btn>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn kind="ember" onClick={() => mut((p) => {
              const at = p.days.reduce((last, day, i) => (routineOf(day) === g.key ? i + 1 : last), p.days.length);
              p.days.splice(at, 0, { id: uid(), name: `Día ${g.days.length + 1}`, routine: g.key, exs: [] });
            })} style={{ flex: 1, minWidth: 180 }}>
              <Plus size={16} /> Añadir día a la {g.label}
            </Btn>
            {copiedDay && (
              <Btn kind="line" onClick={() => pasteDay(g.key)} style={{ flex: 1, minWidth: 180 }}>
                <ClipboardList size={16} /> Pegar día «{copiedDay.name}»
              </Btn>
            )}
          </div>
          </>)}
        </div>
      );})}
      {plan.days.length === 0 && (
        <Btn kind="ember" onClick={() => mut((p) => p.days.push({ id: uid(), name: "Día 1", routine: ROUTINE_A, exs: [] }))} style={{ width: "100%" }}>
          <Plus size={16} /> Añadir día de entrenamiento
        </Btn>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: plan.days.length === 0 ? 10 : 0 }}>
        <Btn kind="line" onClick={() => mut((p) => { const key = nextRoutineKey(p.days); p.days.push({ id: uid(), name: "Día 1", routine: key, exs: [] }); setOpenRoutines((o) => [...o, key]); })} style={{ flex: 1, minWidth: 180 }}>
          <Plus size={16} /> Nueva rutina
        </Btn>
        {copiedRoutine && (
          <Btn kind="line" onClick={pasteRoutine} style={{ flex: 1.3, minWidth: 200 }}>
            <ClipboardList size={16} /> Pegar {copiedRoutine.label} como rutina nueva
          </Btn>
        )}
      </div>
      </>)}

      <ExerciseEditorSheet ex={editEx ? editEx.ex : null} onClose={() => setEditEx(null)} onInfo={onInfo} meso={currentMesociclo(plan)}
        onSave={(exd) => { const { isNew, ...clean } = exd; mut((p) => { const day = p.days.find((x) => x.id === editEx.dayId);
          const i = day.exs.findIndex((x) => x.id === clean.id);
          if (i >= 0) day.exs[i] = clean; else day.exs.push(clean); }); setEditEx(null); }} />

      <Confirm open={!!del} danger title={del && del.type === "day" ? "Eliminar día" : "Eliminar ejercicio"}
        body={del ? `¿Eliminar «${del.name}» de la rutina? El historial del alumno no se borra.` : ""} okLabel="Eliminar"
        onCancel={() => setDel(null)}
        onOk={() => { mut((p) => { if (del.type === "day") p.days = p.days.filter((x) => x.id !== del.dayId);
          else { const day = p.days.find((x) => x.id === del.dayId); day.exs = day.exs.filter((x) => x.id !== del.exId); } }); setDel(null); }} />
      <ImportRoutineSheet open={importOpen} onClose={() => setImportOpen(false)} plan={plan} savePlan={savePlan} toast={toast} />
      <ExerciseInfoSheet ex={fichaEx} open={!!fichaEx} onClose={() => setFichaEx(null)} onOpenImg={setViewImg} />
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

/* ============================================================
   MODO COACH — nutrición e indicaciones
   ============================================================ */
// Calcula el macro que falta a partir de los otros tres. Devuelve un objeto con
// los cuatro valores ya resueltos (kcal, p, c, f) y el reparto de calorías.
const numN = (v) => (v === "" || v == null ? 0 : (+v || 0));
function macroSolve(n, solve = n.solve || "kcal") {
  const v = { p: numN(n.p), c: numN(n.c), f: numN(n.f), kcal: numN(n.kcal) };
  if (solve === "kcal") v.kcal = Math.round(v.p * 4 + v.c * 4 + v.f * 9);
  else if (solve === "p") v.p = Math.max(0, Math.round((v.kcal - v.c * 4 - v.f * 9) / 4));
  else if (solve === "c") v.c = Math.max(0, Math.round((v.kcal - v.p * 4 - v.f * 9) / 4));
  else if (solve === "f") v.f = Math.max(0, Math.round((v.kcal - v.p * 4 - v.c * 4) / 9));
  const pk = v.p * 4, ck = v.c * 4, fk = v.f * 9, tot = pk + ck + fk;
  return { ...v, pk, ck, fk, tot, pctP: tot ? Math.round(pk / tot * 100) : 0, pctC: tot ? Math.round(ck / tot * 100) : 0, pctF: tot ? Math.round(fk / tot * 100) : 0 };
}
const SOLVE_LABEL = { kcal: "Calorías (kcal)", p: "Proteína", c: "Carbohidratos", f: "Grasa" };
const GOAL_META = { deficit: { label: "Déficit (definición)", factor: 0.8, color: P.blue }, mant: { label: "Mantención", factor: 1, color: P.green }, bulk: { label: "Volumen (bulk)", factor: 1.1, color: P.ember } };

const NutritionEditor = ({ plan, savePlan, onOpenNutritionAI }) => {
  const n = plan.nutrition;
  const mut = (fn) => { const p = structuredClone(plan); fn(p.nutrition); p.updatedAt = todayISO(); savePlan(p); };
  const solve = n.solve || "kcal";
  const v = macroSolve(n, solve);
  // Al editar un macro se guarda su valor y se recalcula el que resuelve la app.
  const recalc = (x, s = x.solve || "kcal") => {
    const r = macroSolve(x, s);
    if (s === "kcal") x.kcal = r.kcal; else if (s === "p") x.p = r.p; else if (s === "c") x.c = r.c; else if (s === "f") x.f = r.f;
  };
  const setMacro = (key, val) => mut((x) => { x[key] = val === "" ? "" : (+val || 0); recalc(x); });
  const setSolve = (s) => mut((x) => { x.solve = s; recalc(x, s); });
  const goal = n.goal || "mant";
  const maint = numN(n.maintenance);
  const targetK = Math.round(maint * GOAL_META[goal].factor);
  const estMaint = Math.round(numN((plan.athlete || {}).weight) * 33);   // estimación rápida por peso
  const macroInput = (label, key, ph, color) => {
    const derived = solve === key;
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: derived ? P.ember2 : P.dim, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
          {label}{derived ? " · auto" : ""}
        </div>
        <Inp type="number" inputMode="numeric" placeholder={ph} readOnly={derived}
          value={derived ? v[key] : (n[key] === "" || n[key] == null ? "" : n[key])}
          onChange={(e) => setMacro(key, e.target.value)}
          title={derived ? "La app calcula este valor a partir de los otros tres" : ""}
          style={{ textAlign: "center", background: derived ? P.s3 : undefined, color: derived ? P.ember2 : undefined, fontWeight: derived ? 700 : undefined, borderColor: derived ? `${P.ember}66` : undefined }} />
      </div>
    );
  };
  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 12px" }}>Nutrición</h1>
      {onOpenNutritionAI && (
        <Card style={{ marginBottom: 14, padding: 0, overflow: "hidden", background: `linear-gradient(150deg, ${P.ember}1F, ${P.s1} 55%)`, borderColor: `${P.ember}4A` }}>
          <button onClick={onOpenNutritionAI} style={{ width: "100%", textAlign: "left", padding: "15px 15px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`,
              boxShadow: "0 1px 0 rgba(255,255,255,.35) inset, 0 6px 14px -6px rgba(224,26,26,.6)" }}>
              <Utensils size={19} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16.5 }}>Coach IA de nutrición</div>
              <div style={{ fontSize: 13.5, color: P.dim, marginTop: 2, lineHeight: 1.35 }}>Especializado en macros, timing y adherencia — ya conoce el plan de este alumno.</div>
            </div>
            <ChevronRight size={18} color={P.faint} />
          </button>
        </Card>
      )}
      <Card style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Macros del plan</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: P.dim }}>Calcular automáticamente:</span>
          <select value={solve} onChange={(e) => setSolve(e.target.value)} style={{ flex: 1, minWidth: 130, padding: "7px 8px", fontSize: 14 }}>
            {Object.entries(SOLVE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {macroInput("KCAL", "kcal", "2500")}
          {macroInput("PROT (g)", "p", "180")}
          {macroInput("CARB (g)", "c", "280")}
          {macroInput("GRASA (g)", "f", "70")}
        </div>
        {/* Reparto de calorías por macro */}
        <div style={{ marginTop: 11, padding: "10px 11px", background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10 }}>
          <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", marginBottom: 8, background: P.s3 }}>
            <div style={{ width: `${v.pctP}%`, background: P.green }} />
            <div style={{ width: `${v.pctC}%`, background: P.blue }} />
            <div style={{ width: `${v.pctF}%`, background: "#8C8C93" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", fontSize: 12.5, color: P.dim }}>
            <span><b style={{ color: P.green }}>Proteína</b> {v.p} g · {v.pk} kcal ({v.pctP}%)</span>
            <span><b style={{ color: P.blue }}>Carbos</b> {v.c} g · {v.ck} kcal ({v.pctC}%)</span>
            <span><b style={{ color: "#8C8C93" }}>Grasa</b> {v.f} g · {v.fk} kcal ({v.pctF}%)</span>
          </div>
          <div style={{ fontSize: 13.5, color: P.text, fontWeight: 700, marginTop: 6 }}>Total: {v.tot} kcal</div>
        </div>
        {/* Objetivo calórico según fase */}
        <div style={{ marginTop: 11, padding: "10px 11px", background: `${P.ember}0E`, border: `1px solid ${P.ember}33`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: P.ember2, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 7 }}>Objetivo calórico</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11.5, color: P.dim, fontWeight: 700, marginBottom: 3 }}>Mantención (kcal)</div>
              <Inp type="number" inputMode="numeric" placeholder={estMaint ? String(estMaint) : "2800"} value={n.maintenance === "" || n.maintenance == null ? "" : n.maintenance}
                onChange={(e) => mut((x) => (x.maintenance = e.target.value === "" ? "" : (+e.target.value || 0)))} style={{ textAlign: "center" }} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 11.5, color: P.dim, fontWeight: 700, marginBottom: 3 }}>Fase</div>
              <select value={goal} onChange={(e) => mut((x) => (x.goal = e.target.value))} style={{ width: "100%", padding: "9px 8px", fontSize: 14 }}>
                {Object.entries(GOAL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {estMaint > 0 && (
            <button onClick={() => mut((x) => (x.maintenance = estMaint))} style={{ fontSize: 12.5, color: P.blue, marginTop: 6, textDecoration: "underline" }}>
              Estimar mantención por peso (≈ {estMaint} kcal)
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, color: P.dim }}>
              Objetivo: <b className="disp" style={{ color: GOAL_META[goal].color, fontSize: 16 }}>{maint > 0 ? `${targetK} kcal` : "—"}</b>
              {maint > 0 && goal !== "mant" && <span style={{ fontSize: 12.5, color: P.faint }}> ({goal === "deficit" ? "−20%" : "+10%"})</span>}
            </div>
            <div style={{ flex: 1 }} />
            {maint > 0 && (() => {
              // Ajusta el macro que ya esté marcado como "automático" arriba
              // (proteína, carbos o grasa) — no siempre carbos. Si el modo
              // automático actual es "kcal" (no tiene sentido aplicar un
              // objetivo de calorías Y que las calorías sean el valor
              // derivado a la vez), cae en carbos por defecto.
              const applyKey = solve === "kcal" ? "c" : solve;
              const applyLabel = SOLVE_LABEL[applyKey].toLowerCase();
              return (
                <Btn kind="ember" small onClick={() => mut((x) => { x.kcal = targetK; x.solve = applyKey; recalc(x, applyKey); })}>
                  Aplicar y ajustar {applyLabel}
                </Btn>
              );
            })()}
          </div>
          <div style={{ fontSize: 12, color: P.faint, marginTop: 7, lineHeight: 1.4 }}>
            «Aplicar» fija las calorías objetivo y recalcula el macro marcado como automático arriba (proteína, carbohidratos o grasa) manteniendo fijos los otros dos. Cambia el macro automático en «Calcular automáticamente» si quieres ajustar otro.
          </div>
        </div>
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
            <Inp value={m.notes} placeholder="Nota de esta comida (opcional)" onChange={(e) => mut((x) => (x.meals[mi].notes = e.target.value))} style={{ fontSize: 14 }} />
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
      <div style={{ color: P.dim, fontSize: 15, marginBottom: 14 }}>Instrucciones generales del plan (cardio, pasos, sueño, suplementos…). El alumno las ve en su inicio.</div>
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
      <div style={{ color: P.dim, fontSize: 15, marginBottom: 14 }}>{history.sessions.length} sesiones registradas{commented ? ` · ${commented} con comentarios` : ""}. Revisa pesos, RIR, notas y fotos de cada entrenamiento.</div>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {[["ses", "Por sesión"], ["ex", "Por ejercicio"]].map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 14.5, fontWeight: 600,
            background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{l}</button>
        ))}
      </div>
      {sub === "ses" && (history.sessions.length === 0 ? (
        <Empty icon={Users} title="Aún no hay sesiones" body="Cuando el alumno termine su primera sesión, acá verás todo el detalle: series, comentarios y adjuntos." />
      ) : [...history.sessions].reverse().map((s) => (
        <Card key={s.id} style={{ marginBottom: 10 }}>
          <button onClick={() => setOpenSession(s)} style={{ width: "100%", textAlign: "left", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{s.dayName}</div>
              <div style={{ fontSize: 13.5, color: P.faint, marginTop: 2 }}>{fmtDateFull(s.date)} · {s.setsDone}/{s.setsTotal} series · {Math.round(s.volume).toLocaleString("es-CL")} kg</div>
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
            : (
              <>
                <ExerciseProgress entries={history.byEx[exId]} />
                <ExHistorySheetInline entries={history.byEx[exId]} onOpenImg={setViewImg} />
              </>
            )}
        </div>
      )}
      <SessionDetailSheet session={openSession} onClose={() => setOpenSession(null)} history={history} onOpenImg={setViewImg} />
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

/* ============================================================
   RANKINGS — tablas de posición entre alumnos + premio del mes.
   El coach elige el criterio; el "score total" (para sugerir al
   ganador del mes) suma puntos de posición en 5 criterios fijos.
   Calorías es una ESTIMACIÓN (no hay forma de medir gasto real sin
   un sensor) — se etiqueta como tal en toda la pantalla.
   ============================================================ */
function monthKeyOf(d) { return d.slice(0, 7); }
function monthMetrics(history, monthKey) {
  const sessions = ((history && history.sessions) || []).filter((s) => monthKeyOf(s.date || "") === monthKey);
  return {
    sessions: sessions.length,
    tonnage: sessions.reduce((a, s) => a + (s.volume || 0), 0),
    prs: sessions.reduce((a, s) => a + (s.prs ? s.prs.length : 0), 0),
    minutes: sessions.reduce((a, s) => a + (s.durationMin || 0), 0),
  };
}
// % de sesiones hechas vs las que tocaban según el horario semanal armado
// en Agenda (días con rutina asignada). Sin horario armado, no hay con qué
// comparar y se muestra "—" en vez de inventar un número.
function adherencePct(plan, history, monthKey) {
  const sched = (plan && plan.schedule) || {};
  const plannedPerWeek = Object.values(sched).filter(Boolean).length;
  if (!plannedPerWeek) return null;
  const now = new Date();
  const [y, mo] = monthKey.split("-").map(Number);
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === mo;
  const daysElapsed = isCurrent ? now.getDate() : new Date(y, mo, 0).getDate();
  const expected = plannedPerWeek * (daysElapsed / 7);
  if (expected <= 0) return null;
  const done = monthMetrics(history, monthKey).sessions;
  return Math.min(100, Math.round((done / expected) * 100));
}
function bestForExerciseName(history, nameLower) {
  let best = 0;
  Object.values((history && history.byEx) || {}).forEach((entries) => {
    (entries || []).forEach((en) => {
      if (((en.exName || "").trim().toLowerCase()) !== nameLower) return;
      (en.sets || []).forEach((s) => { if (s.done) best = Math.max(best, numN(s.weight)); });
    });
  });
  return best;
}
const RANK_CRITERIA = [
  { id: "kcal", label: "Calorías quemadas (estimado)", get: (r, mk) => estimateKcal(monthMetrics(r.history, mk).minutes, r.weight), fmt: (v) => `${Math.round(v).toLocaleString("es-CL")} kcal` },
  { id: "tonnage", label: "Tonelaje levantado", get: (r, mk) => monthMetrics(r.history, mk).tonnage, fmt: (v) => `${Math.round(v / 1000 * 10) / 10} t` },
  { id: "prs", label: "Récords personales (PRs)", get: (r, mk) => monthMetrics(r.history, mk).prs, fmt: (v) => `${v} PR${v !== 1 ? "s" : ""}` },
  { id: "adherencia", label: "Cumplimiento de indicaciones", get: (r, mk) => adherencePct(r.plan, r.history, mk), fmt: (v) => v == null ? "— (sin horario armado)" : `${v}%` },
  { id: "streak", label: "Constancia (racha de semanas)", get: (r) => r.metrics.streak, fmt: (v) => `${v} semana${v !== 1 ? "s" : ""}` },
];

const RankingsTab = ({ roster, toast }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [criterion, setCriterion] = useState("kcal");
  const [exName, setExName] = useState("");
  const [winners, setWinners] = useState([]);
  const [prizeDraft, setPrizeDraft] = useState("");
  const monthKey = monthKeyOf(todayISO());
  const monthLabel = new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const out = [];
      for (const s of roster.students) {
        const [p, h] = await Promise.all([sGet(`forja-plan:${s.id}`), sGet(`forja-history:${s.id}`)]);
        const hist = (h && h.sessions) ? h : emptyHistory();
        out.push({ id: s.id, name: s.name, plan: p || emptyPlan(), history: hist, weight: numN((p && p.athlete || {}).weight), metrics: progressMetrics(hist) });
      }
      setRows(out);
      setLoading(false);
      const w = await sGet("forja-monthly-winners");
      setWinners((w && w.list) || []);
    })();
  }, [roster]);

  const exOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => Object.values(r.history.byEx || {}).forEach((entries) => (entries || []).forEach((en) => en.exName && set.add(en.exName))));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);
  useEffect(() => { if (!exName && exOptions.length) setExName(exOptions[0]); }, [exOptions, exName]);

  // Puntaje total: para cada uno de los 5 criterios fijos, ordena a los
  // alumnos y reparte puntos por posición (1º = N puntos ... último = 1).
  // Así se puede sumar algo tan distinto como calorías, kg y % en una sola
  // tabla, sin que una unidad "pese" más que otra por su magnitud.
  const totals = useMemo(() => {
    const scores = new Map(rows.map((r) => [r.id, 0]));
    RANK_CRITERIA.forEach((c) => {
      const vals = rows.map((r) => ({ id: r.id, v: c.get(r, monthKey) })).filter((x) => x.v != null);
      vals.sort((a, b) => b.v - a.v);
      vals.forEach((x, i) => scores.set(x.id, scores.get(x.id) + (vals.length - i)));
    });
    return rows.map((r) => ({ ...r, score: scores.get(r.id) || 0 })).sort((a, b) => b.score - a.score);
  }, [rows, monthKey]);

  const activeCriterion = RANK_CRITERIA.find((c) => c.id === criterion);
  const board = criterion === "prEx"
    ? rows.map((r) => ({ ...r, v: bestForExerciseName(r.history, exName.trim().toLowerCase()) })).sort((a, b) => b.v - a.v)
    : rows.map((r) => ({ ...r, v: activeCriterion.get(r, monthKey) })).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));

  const leader = totals[0];
  const alreadyAwarded = winners.some((w) => w.month === monthKey);
  const declareWinner = async () => {
    if (!leader) return;
    const entry = { month: monthKey, studentId: leader.id, studentName: leader.name, score: leader.score, prize: prizeDraft.trim(), delivered: false, awardedAt: todayISO() };
    const list = [entry, ...winners.filter((w) => w.month !== monthKey)];
    setWinners(list);
    await sSet("forja-monthly-winners", { list });
    setPrizeDraft("");
    if (toast) toast(`✓ ${leader.name} queda como ganador de ${monthLabel}`);
  };
  const markDelivered = async (m) => {
    const list = winners.map((w) => w.month === m ? { ...w, delivered: true } : w);
    setWinners(list);
    await sSet("forja-monthly-winners", { list });
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: P.faint }}>Cargando rankings de todos los alumnos…</div>;

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Trophy size={22} color={P.ember} />
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0" }}>Rankings</h1>
      </div>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 16, lineHeight: 1.45 }}>
        Compara a tus alumnos por distintos criterios. Las calorías son una estimación (duración × peso corporal) — FORJA no mide gasto real.
      </div>

      <Card style={{ padding: 14, marginBottom: 16, background: `linear-gradient(150deg, ${P.ember}1F, ${P.s1} 55%)`, borderColor: `${P.ember}4A` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Gift size={17} color={P.ember} />
          <div style={{ fontWeight: 700, fontSize: 15.5, textTransform: "capitalize" }}>Premio de {monthLabel}</div>
        </div>
        {leader ? (
          <>
            <div style={{ fontSize: 14, color: P.dim, marginBottom: 10 }}>
              Sumando los 5 criterios de abajo, <b style={{ color: P.text }}>{leader.name}</b> va primero con <b style={{ color: P.ember2 }}>{leader.score} pts</b>.
            </div>
            {alreadyAwarded ? (
              (() => { const w = winners.find((x) => x.month === monthKey); return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5 }}>Ganador declarado: <b>{w.studentName}</b>{w.prize ? ` · Premio: ${w.prize}` : ""}</div>
                  {!w.delivered && <Btn kind="line" small onClick={() => markDelivered(monthKey)}><Check size={13} /> Marcar entregado</Btn>}
                  {w.delivered && <span style={{ fontSize: 12.5, color: P.green, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Entregado</span>}
                </div>
              );})()
            ) : (
              <>
                <Inp value={prizeDraft} onChange={(e) => setPrizeDraft(e.target.value)} placeholder="Premio sorpresa (ej: proteína, descuento, straps…)" style={{ marginBottom: 8 }} />
                <Btn kind="ember" onClick={declareWinner} style={{ width: "100%" }}><Trophy size={15} /> Declarar ganador de {monthLabel}</Btn>
              </>
            )}
          </>
        ) : <div style={{ color: P.faint, fontSize: 13.5 }}>Agrega alumnos con sesiones registradas para calcular el premio del mes.</div>}
      </Card>

      <select value={criterion} onChange={(e) => setCriterion(e.target.value)} style={{ width: "100%", padding: "10px 11px", fontSize: 14.5, marginBottom: exName || criterion !== "prEx" ? 10 : 0 }}>
        {RANK_CRITERIA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        <option value="prEx">PR de un ejercicio en particular</option>
      </select>
      {criterion === "prEx" && (
        <select value={exName} onChange={(e) => setExName(e.target.value)} style={{ width: "100%", padding: "10px 11px", fontSize: 14.5, marginBottom: 10 }}>
          {exOptions.length === 0 && <option value="">Sin ejercicios registrados aún</option>}
          {exOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}

      {board.map((r, i) => (
        <Card key={r.id} style={{ padding: "11px 13px", marginBottom: 8, display: "flex", alignItems: "center", gap: 11 }}>
          <div className="disp" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14,
            background: i === 0 ? `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)` : P.s2,
            color: i === 0 ? "#FFFFFF" : P.faint, border: i === 0 ? "none" : `1px solid ${P.line}` }}>
            {i === 0 ? <Medal size={15} /> : i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15, overflowWrap: "break-word" }}>{r.name}</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: P.ember2, flexShrink: 0 }}>
            {criterion === "prEx" ? (r.v > 0 ? `${kg(r.v)} kg` : "—") : activeCriterion.fmt(r.v)}
          </div>
        </Card>
      ))}
      {board.length === 0 && <Empty icon={Trophy} title="Sin alumnos" body="Agrega alumnos para empezar a comparar su progreso." />}

      {winners.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Historial de premios</div>
          {winners.map((w) => (
            <div key={w.month} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 6, borderRadius: 10, background: P.s2, border: `1px solid ${P.line}`, fontSize: 13 }}>
              <Award size={14} color={P.ember2} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>{w.month} · <b>{w.studentName}</b>{w.prize ? ` · ${w.prize}` : ""}</div>
              {w.delivered ? <Check size={14} color={P.green} /> : <span style={{ color: P.faint, fontSize: 11.5 }}>pendiente</span>}
            </div>
          ))}
        </div>
      )}
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
            <div><div style={{ fontSize: 12, color: P.faint, marginBottom: 4 }}>MIN</div>
              <input type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 90, padding: "12px", fontSize: 26, textAlign: "center", fontWeight: 700 }} /></div>
            <div style={{ fontSize: 26, paddingBottom: 12 }}>:</div>
            <div><div style={{ fontSize: 12, color: P.faint, marginBottom: 4 }}>SEG</div>
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
        {run.phase !== "done" && <div style={{ fontSize: 14, color: P.dim, marginBottom: 6 }}>Ronda {Math.max(1, run.round)} de {cfg.rounds}</div>}
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
      <div style={{ fontSize: 12, color: P.faint, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
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
      <div style={{ fontSize: 13.5, color: P.dim, textAlign: "center", marginBottom: 14 }}>
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
- Rutina: ${plan.days.length} días de entrenamiento, ${plan.days.reduce((a, d) => a + d.exs.length, 0)} ejercicios totales, repartidos en ${groupDaysByRoutine(plan.days).map((g) => `${g.label} (${g.days.length} días)`).join(", ") || "ninguna rutina"}.

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
      const data = await callClaudeAPI(apiKey, {
        model: "claude-opus-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
      });
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
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>
        Chat con Claude (Anthropic) para diseñar y ajustar planes nutricionales del alumno. La IA ya conoce el plan actual y los datos que has cargado.
      </div>

      {!apiKey || showKeyEdit ? (
        <Card style={{ padding: 14, marginBottom: 14, borderColor: `${P.ember}66` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <AlertTriangle size={16} color={P.ember2} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Configura tu API key de Anthropic</div>
          </div>
          <div style={{ fontSize: 13.5, color: P.dim, lineHeight: 1.5, marginBottom: 10 }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13, color: P.faint }}>
          <Check size={14} color={P.green} /> API key configurada
          <button onClick={() => setShowKeyEdit(true)} style={{ color: P.ember, marginLeft: 6, fontSize: 13 }}>cambiar</button>
        </div>
      )}

      {messages.length === 0 && apiKey && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Sugerencias para empezar</div>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
              background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, marginBottom: 6, fontSize: 14, color: P.dim, lineHeight: 1.4 }}>
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
              fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ marginBottom: 10, display: "flex" }}>
            <div style={{ padding: "10px 13px", borderRadius: 14, background: P.s2, border: `1px solid ${P.line}`, fontSize: 14.5, color: P.dim }}>
              <span className="pulse">Pensando…</span>
            </div>
          </div>
        )}
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: `${P.red}22`, border: `1px solid ${P.red}55`, fontSize: 13.5, color: P.red, marginBottom: 8 }}>{err}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea rows={2} placeholder={apiKey ? "Escribe tu consulta…" : "Configura la API key primero"} disabled={!apiKey || busy}
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, minWidth: 0, resize: "none" }} />
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

/* ============================================================
   Agente de culturismo profesional
   Un entrenador experto que conoce al alumno: su rutina, su
   historial de cargas, su volumen por grupo muscular, su peso y
   su fase. Puede responder, analizar y proponer cambios de
   rutina o de macros que el coach aplica con un botón.
   ============================================================ */
const AI_MODEL = "claude-opus-4-6";

const BB_SPECIALTIES = [
  {
    id: "general", label: "Coach jefe", Icon: Flame,
    focus: "Responde como el entrenador principal: mira el caso completo (entrenamiento, nutrición, recuperación y contexto de vida) y prioriza qué mover primero.",
    sugg: [
      "Revisa el plan completo de este alumno y dime las 3 cosas que cambiarías primero.",
      "¿El plan actual encaja con la fase y el objetivo que tiene cargado?",
      "Arma el plan de las próximas 8 semanas con objetivos por bloque.",
    ],
  },
  {
    id: "hipertrofia", label: "Hipertrofia", Icon: Dumbbell,
    focus: "Céntrate en los determinantes de hipertrofia: volumen efectivo por grupo muscular, proximidad al fallo, rango de repeticiones, frecuencia, tensión en estiramiento y sobrecarga progresiva.",
    sugg: [
      "Analiza el volumen semanal por grupo muscular y dime qué está bajo el MEV o sobre el MRV.",
      "El pecho no responde. ¿Qué cambio de volumen, frecuencia o selección propones?",
      "¿Cómo debería progresar cargas semana a semana en este mesociclo?",
    ],
  },
  {
    id: "tecnica", label: "Técnica", Icon: Video,
    focus: "Céntrate en biomecánica y ejecución: posiciones articulares, curva de resistencia, rango efectivo, tensión en estiramiento, errores frecuentes y señales de una serie mal ejecutada.",
    sugg: [
      "Explica la técnica óptima del remo con barra y los 3 errores más comunes.",
      "¿Qué variantes de press dan más tensión en estiramiento para pecho?",
      "¿Cómo corrijo que en la elevación lateral trabaje más el trapecio que el deltoide?",
    ],
  },
  {
    id: "periodizacion", label: "Periodización", Icon: Calendar,
    focus: "Céntrate en la estructura temporal: mesociclos, progresión de volumen e intensidad, acumulación de fatiga, deloads, especialización de puntos débiles y transición entre fases.",
    sugg: [
      "Diseña un mesociclo de 5 semanas con progresión de volumen y deload final.",
      "¿Cuándo toca deload según el historial de sesiones y los RIR registrados?",
      "Quiero un bloque de especialización de hombro sin perder el resto.",
    ],
  },
  {
    id: "nutricion", label: "Nutrición", Icon: Utensils,
    focus: "Céntrate en nutrición aplicada al culturismo: calorías por fase, reparto de macros, timing, adherencia, refeeds y diet breaks, y ajuste por velocidad de cambio de peso.",
    sugg: [
      "Calcula calorías y macros para la fase actual y propón el reparto de comidas.",
      "Lleva 3 semanas sin bajar de peso en definición. ¿Qué ajusto?",
      "¿Cuándo conviene un refeed o un diet break en esta prep?",
    ],
  },
  {
    id: "suplementacion", label: "Suplementos", Icon: Zap,
    focus: "Céntrate en suplementación jerarquizada por evidencia, con dosis y momento de toma. Sé explícito cuando algo no tiene respaldo y no lo recomiendes solo porque es popular.",
    sugg: [
      "¿Qué suplementos valen la pena en esta fase y en qué dosis?",
      "¿Creatina en definición: mantengo, subo o corto antes de competir?",
      "Revisa esta lista de suplementos y dime cuáles sobran.",
    ],
  },
  {
    id: "competicion", label: "Competición", Icon: Award,
    focus: "Céntrate en preparación a competencia: elección de categoría, timeline de prep, control de condición, peak week, posing y logística de tarima.",
    sugg: [
      "¿Cuántas semanas de prep necesita según el punto de partida actual?",
      "Arma la peak week día por día para la categoría objetivo.",
      "¿Qué poses debería trabajar para disimular los puntos débiles?",
    ],
  },
  {
    id: "lesiones", label: "Dolor / lesión", Icon: AlertTriangle,
    focus: "Céntrate en manejo de molestias en el gimnasio: modificar rango, ángulo, carga y selección para seguir entrenando alrededor del dolor. Deriva a profesional de salud ante señales de alarma.",
    sugg: [
      "Le molesta el hombro en press plano. ¿Qué sustituyo sin perder estímulo de pecho?",
      "Dolor lumbar tras peso muerto: ¿cómo reestructuro la sesión de pierna?",
      "¿Qué señales indican que hay que parar y derivar al médico?",
    ],
  },
  {
    id: "analisis", label: "Análisis", Icon: TrendingUp,
    focus: "Céntrate en leer los datos reales del alumno: tonelaje, PRs, adherencia, evolución del peso corporal y series completadas. Cita los números concretos del historial en tu respuesta.",
    sugg: [
      "Analiza el historial de sesiones y dime si está progresando de verdad.",
      "¿Qué ejercicios están estancados y cuáles siguen subiendo?",
      "Revisa la adherencia: ¿está completando las series planificadas?",
    ],
  },
];

/* Bloques de acción que el agente puede devolver para que el coach los aplique */
const BB_ACTION_RE = /```forja-(rutina|nutricion|biblioteca)\s*([\s\S]*?)```/g;
function parseAIActions(text) {
  const actions = [];
  const clean = text.replace(BB_ACTION_RE, (whole, kind, body) => {
    try {
      actions.push({ kind, data: JSON.parse(body.trim()) });
      return "";
    } catch { return whole; }
  });
  return { clean: clean.replace(/\n{3,}/g, "\n\n").trim(), actions };
}

/* Todo lo que el agente sabe del alumno, en texto plano */
function buildAthleteContext({ plan, history, athlete, student }) {
  const a = athlete || emptyAthlete();
  const vol = volumeByMuscle(plan);
  const sessions = history.sessions || [];
  const recent = sessions.slice(-8);
  const bw = history.bodyweight || [];
  const bwFirst = bw[0], bwLast = bw[bw.length - 1];
  const phase = BB_PHASES.find((p) => p.id === a.phase);
  const cat = BB_CATEGORIES.find((c) => c.id === a.category);

  const routineTxt = groupDaysByRoutine(plan.days).map((g) => {
    const days = g.items.map(({ day }) => {
      const exs = day.exs.map((ex) => {
        const eff = ex.sets.filter((s) => s.type !== "warmup");
        const detalle = eff.map((s) => `${SET_TYPES[s.type]?.short || s.type} ${s.repsT}${s.rirT ? ` @RIR ${s.rirT}` : ""}`).join(" | ");
        return `    · ${ex.name} [${ex.muscle}] — ${eff.length} series efectivas: ${detalle}${ex.superset ? ` (superserie con ${ex.superset})` : ""}`;
      }).join("\n");
      return `  ${day.name} (${day.exs.length} ejercicios):\n${exs || "    (sin ejercicios)"}`;
    }).join("\n");
    return `${g.label} — ${g.note || "sin nota"}\n${days}`;
  }).join("\n\n") || "El plan no tiene días cargados.";

  const schedTxt = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((k, i) => {
    const label = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i];
    const id = plan.schedule && plan.schedule[k];
    const day = id && (plan.days || []).find((d) => d.id === id);
    return `${label}: ${day ? day.name : "descanso"}`;
  }).join(" · ");

  const volTxt = vol.rows.length
    ? vol.rows.map((r) => `  · ${r.muscle}: ${r.sets} series/${vol.basis}${r.ref ? ` (MEV ${r.ref.mev} · MAV ${r.ref.mav[0]}-${r.ref.mav[1]} · MRV ${r.ref.mrv}) → ${r.status}` : ""}`).join("\n")
    : "  (sin series cargadas)";

  const sessTxt = recent.length
    ? recent.map((s) => `  · ${fmtDate(s.date)} — ${s.dayName}: ${s.setsDone}/${s.setsTotal} series, ${Math.round(s.volume)} kg de tonelaje, ${s.durationMin} min${s.prs.length ? `, PR: ${s.prs.join("; ")}` : ""}`).join("\n")
    : "  (todavía no registra sesiones)";

  const bwTxt = bw.length
    ? `${bw.slice(-6).map((b) => `${fmtDate(b.date)}: ${kg(b.kg)} kg`).join(" · ")}${bw.length > 1 ? ` → variación total ${kg(bwLast.kg - bwFirst.kg)} kg desde ${fmtDate(bwFirst.date)}` : ""}`
    : "sin registros de peso corporal";

  const instrTxt = (plan.instructions || []).length
    ? (plan.instructions || []).map((it) => `  · ${it.title}: ${it.body}`).join("\n")
    : "  (sin indicaciones cargadas)";

  return `FICHA DEL ATLETA
- Nombre: ${student?.name || "sin especificar"}
- Sexo: ${a.sex || "no indicado"} · Edad: ${a.age || "?"} · Estatura: ${a.height || "?"} cm · Peso: ${a.weight || "?"} kg · % graso estimado: ${a.bf || "?"}
- Años entrenando: ${a.years || "?"} · Nivel: ${a.level || "?"}
- Fase actual: ${phase ? `${phase.label} (${phase.kcal}, ritmo ${phase.rate}, proteína ${phase.prot})` : a.phase || "no definida"}
- Categoría objetivo: ${cat ? `${cat.label} — ${cat.focus}` : a.category || "no compite / no definida"}
- Fecha de competencia: ${a.compDate || "sin fecha"}
- Puntos débiles declarados: ${(a.weakPoints || []).join(", ") || "ninguno declarado"}
- Lesiones o limitaciones: ${a.injuries || "ninguna declarada"}
- Disponibilidad: ${a.daysWeek || "?"} días/semana · ${a.sessionMin || "?"} min por sesión
- Equipamiento: ${a.equipment || "no indicado"}
- Notas del coach: ${a.notes || "sin notas"}

CRONOGRAMA SEMANAL
${schedTxt}

VOLUMEN ACTUAL POR GRUPO MUSCULAR (series efectivas por ${vol.basis}, total ${vol.total})
${volTxt}

RUTINA COMPLETA
${routineTxt}

NUTRICIÓN CARGADA EN EL PLAN
- ${plan.nutrition.kcal || "?"} kcal · P ${plan.nutrition.p || "?"} g · C ${plan.nutrition.c || "?"} g · G ${plan.nutrition.f || "?"} g
- Comidas configuradas: ${(plan.nutrition.meals || []).length}
- Notas: ${plan.nutrition.notes || "sin notas"}

HISTORIAL (${sessions.length} sesiones registradas en total)
Últimas sesiones:
${sessTxt}
Peso corporal: ${bwTxt}

INDICACIONES GENERALES DEL PLAN
${instrTxt}`;
}

function buildBBSystemPrompt(ctx, specialty) {
  const spec = BB_SPECIALTIES.find((s) => s.id === specialty) || BB_SPECIALTIES[0];
  return `Eres un entrenador de culturismo profesional integrado en FORJA, la plataforma con la que un coach gestiona a sus alumnos. Tienes el nivel de un preparador con años dirigiendo atletas de físico en competencia y dominas la literatura científica de hipertrofia. Hablas con el coach, no con el alumno.

DOMINIO TÉCNICO QUE MANEJAS
1. Hipertrofia: tensión mecánica como estímulo principal, series efectivas cerca del fallo (RIR 0-4), rango de 5 a 30 repeticiones útil si la proximidad al fallo es suficiente, importancia de la tensión en posición de estiramiento, rango completo y control excéntrico.
2. Volumen: MEV, MAV y MRV por grupo muscular; el volumen productivo sube a lo largo del mesociclo y se recorta en el deload. Referencias por semana: ${Object.entries(BB_VOLUME_REF).map(([m, r]) => `${m} ${r.mev}/${r.mav[0]}-${r.mav[1]}/${r.mrv}`).join(", ")} (MEV/MAV/MRV en series efectivas).
3. Frecuencia y distribución: 2-3 estímulos por grupo y semana funcionan mejor que 1 cuando el volumen es alto; organización full body, torso-pierna, push-pull-legs o híbridos según disponibilidad.
4. Progresión: sobrecarga progresiva en carga, repeticiones o series, con doble progresión como método base; el RIR guía la intensidad real.
5. Técnicas de intensidad: top set + back-off, drop sets, rest-pause, series mioreps, parciales en estiramiento y superseries. Todas suben fatiga por unidad de estímulo: se dosifican, casi siempre en aislamientos y al final del ejercicio.
6. Periodización: mesociclos de 4 a 8 semanas con acumulación progresiva y deload; bloques de especialización para puntos débiles reduciendo el volumen del resto; transición ordenada entre volumen, mantención y definición.
7. Biomecánica y selección de ejercicios: curvas de resistencia, ángulos, torque articular, criterios para elegir entre libre, máquina o polea, y sustituciones equivalentes cuando hay dolor o falta de material.
8. Nutrición de culturismo: ${BB_PHASES.map((p) => `${p.label} → ${p.kcal}, ritmo ${p.rate}, proteína ${p.prot}`).join(" | ")}. Reparto de comidas, distribución proteica, timing perientrenamiento, refeeds y diet breaks, manejo del hambre y la adherencia.
9. Suplementación por evidencia: creatina monohidrato 3-5 g/día, cafeína 3-6 mg/kg, proteína en polvo como herramienta, beta-alanina 3-6 g/día, citrulina 6-8 g. Evidencia pobre: BCAA con proteína suficiente, boosters de testosterona, quemadores.
10. Recuperación: sueño de 7-9 h como variable crítica, manejo de estrés, señales de fatiga sistémica y local, cuándo un deload es obligatorio.
11. Competencia: categorías (${BB_CATEGORIES.map((c) => c.label).join(", ")}), timeline de prep de 16 a 24 semanas según punto de partida, control semanal de condición, peak week, posing y presentación.
12. Diagnóstico de estancamientos: antes de rediseñar nada, revisar adherencia, energía disponible, sueño, honestidad del RIR, volumen sobre MRV y calidad técnica.

LÍMITES INNEGOCIABLES
- No indicas, dosificas ni programas esteroides anabolizantes, hormonas, SARMs, diuréticos ni ninguna sustancia de prescripción o dopante. Si te lo piden, dilo con claridad y deriva a un médico especializado; puedes hablar de riesgos generales y de la importancia del control médico.
- No eres médico ni nutricionista clínico: ante patología, medicación, embarazo, trastorno de la conducta alimentaria, menores de edad o dolor con señales de alarma (dolor nocturno, pérdida de fuerza, hormigueo, inflamación marcada), deriva al profesional correspondiente.
- No inventas datos del alumno. Si falta información clave para responder bien, pídela antes de dar el plan.

CÓMO RESPONDES
- Español de Chile, tono directo de entrenador: sin relleno, sin motivación vacía.
- Concreto y accionable: números, series, repeticiones, RIR, gramos, semanas. Nada de "depende" sin una recomendación.
- Cita los datos reales del alumno cuando apoyen tu razonamiento (volumen actual, PRs, tonelaje, peso corporal).
- Máximo 6 párrafos cortos o una lista breve. Si el tema es grande, entrega lo esencial y ofrece profundizar.
- Explica el porqué fisiológico en una línea cuando cambie una decisión, no como clase teórica.

ESPECIALIDAD ACTIVA EN ESTA CONSULTA: ${spec.label}. ${spec.focus}

ACCIONES QUE PUEDES EJECUTAR
Cuando el coach te pida crear o modificar días de entrenamiento, además de explicarlo, incluye al final un bloque exactamente así (se convierte en un botón para aplicarlo al plan):
\`\`\`forja-rutina
{"titulo":"Nombre corto del bloque","days":[{"name":"Empujes 1","exs":[{"name":"Press inclinado con mancuernas","muscle":"Pecho","rest":120,"notes":"Indicación técnica breve","sets":[{"type":"normal","repsT":"6-10","rirT":"1"},{"type":"normal","repsT":"10-12","rirT":"0"}]}]}]}
\`\`\`
Reglas del bloque: "muscle" debe ser uno de ${MUSCLES.join(", ")}; "type" solo puede ser warmup, normal, top, backoff, drop, restpause, amrap, cluster, vma, midiso o pfi; "repsT" y "rirT" son strings; "rest" en segundos.

Cuando propongas calorías y macros concretos, incluye también:
\`\`\`forja-nutricion
{"kcal":3000,"p":200,"c":330,"f":80,"notes":"Resumen breve de la pauta"}
\`\`\`

Cuando el coach te pida agregar un ejercicio a la biblioteca (catálogo reutilizable, aparte de la rutina), o cuando tú mismo recomiendes uno nuevo y el coach lo acepte, incluye:
\`\`\`forja-biblioteca
{"name":"Nombre del ejercicio","muscle":"Pecho","equipment":"Mancuernas","rest":90,"notes":"Indicación técnica breve","sets":[{"type":"normal","repsT":"8-12","rirT":"2"}]}
\`\`\`
Reglas iguales a forja-rutina para "muscle" y "type"; "equipment" debe ser uno de ${EQUIPMENT.join(", ")} (o vacío). Un solo ejercicio por bloque; si son varios, repite el bloque forja-biblioteca una vez por cada uno.

No uses estos bloques si el coach solo pregunta algo teórico: son para cambios que quiere aplicar.

${ctx}`;
}

/* ---- Ficha del atleta ---- */
const AthleteForm = ({ plan, savePlan }) => {
  const a = plan.athlete || emptyAthlete();
  const set = (k, v) => {
    const p = structuredClone(plan);
    if (!p.athlete) p.athlete = emptyAthlete();
    // Migración: planes anteriores al mesociclo
    if (!p.meso || !Array.isArray(p.meso.weeks) || !p.meso.weeks.length) p.meso = emptyMeso();
    p.athlete[k] = v;
    p.updatedAt = todayISO();
    savePlan(p);
  };
  const toggleWeak = (m) => {
    const cur = a.weakPoints || [];
    set("weakPoints", cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
  };
  return (
    <div>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 14, lineHeight: 1.5 }}>
        Todo lo que cargues acá viaja con cada consulta al agente. Mientras más completa esté la ficha, menos preguntas te hará y más específicas serán sus respuestas.
      </div>

      <Card style={{ padding: "13px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Datos básicos</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Sexo"><select value={a.sex} onChange={(e) => set("sex", e.target.value)} style={{ width: "100%", padding: "10px 8px" }}>
            <option value="">—</option><option value="hombre">Hombre</option><option value="mujer">Mujer</option>
          </select></Field>
          <Field label="Edad"><Inp type="number" inputMode="numeric" value={a.age} onChange={(e) => set("age", e.target.value)} placeholder="27" /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Estatura (cm)"><Inp type="number" inputMode="decimal" value={a.height} onChange={(e) => set("height", e.target.value)} placeholder="177" /></Field>
          <Field label="Peso (kg)"><Inp type="number" inputMode="decimal" value={a.weight} onChange={(e) => set("weight", e.target.value)} placeholder="90" /></Field>
          <Field label="% graso"><Inp value={a.bf} onChange={(e) => set("bf", e.target.value)} placeholder="14" /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Años entrenando"><Inp type="number" inputMode="numeric" value={a.years} onChange={(e) => set("years", e.target.value)} placeholder="5" /></Field>
          <Field label="Nivel"><select value={a.level} onChange={(e) => set("level", e.target.value)} style={{ width: "100%", padding: "10px 8px" }}>
            <option value="principiante">Principiante</option><option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option><option value="competidor">Competidor</option>
          </select></Field>
        </div>
      </Card>

      <Card style={{ padding: "13px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Objetivo</div>
        <Field label="Fase actual" hint={BB_PHASES.find((p) => p.id === a.phase)?.note}>
          <select value={a.phase} onChange={(e) => set("phase", e.target.value)} style={{ width: "100%", padding: "10px 8px" }}>
            {BB_PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Categoría objetivo" hint={BB_CATEGORIES.find((c) => c.id === a.category)?.focus}>
          <select value={a.category} onChange={(e) => set("category", e.target.value)} style={{ width: "100%", padding: "10px 8px" }}>
            <option value="">No compite / sin definir</option>
            {BB_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Fecha de competencia"><Inp type="date" value={a.compDate} onChange={(e) => set("compDate", e.target.value)} /></Field>
        <Field label="Puntos débiles" hint="Los grupos que el agente priorizará al proponer volumen o especializaciones.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MUSCLES.filter((m) => m !== "Otro").map((m) => {
              const on = (a.weakPoints || []).includes(m);
              return (
                <button key={m} onClick={() => toggleWeak(m)} style={{ padding: "6px 10px", borderRadius: 9, fontSize: 13.5, fontWeight: 600,
                  background: on ? `${P.ember}22` : P.s2, border: `1px solid ${on ? `${P.ember}66` : P.line}`, color: on ? P.ember2 : P.dim }}>{m}</button>
              );
            })}
          </div>
        </Field>
      </Card>

      <Card style={{ padding: "13px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Contexto y limitaciones</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Días/semana"><Inp type="number" inputMode="numeric" value={a.daysWeek} onChange={(e) => set("daysWeek", e.target.value)} placeholder="5" /></Field>
          <Field label="Min/sesión"><Inp type="number" inputMode="numeric" value={a.sessionMin} onChange={(e) => set("sessionMin", e.target.value)} placeholder="75" /></Field>
        </div>
        <Field label="Lesiones o molestias"><Txt rows={2} value={a.injuries} onChange={(e) => set("injuries", e.target.value)} placeholder="Ej: pinzamiento de hombro derecho en press por encima de la cabeza." /></Field>
        <Field label="Equipamiento disponible"><Txt rows={2} value={a.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="Ej: gimnasio completo, sin prensa horizontal ni hack." /></Field>
        <Field label="Notas del coach"><Txt rows={3} value={a.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Cualquier cosa relevante: trabajo por turnos, historial de dietas, adherencia, etc." /></Field>
      </Card>
    </div>
  );
};

/* ---- Volumen por grupo muscular ---- */
const MuscleVolumeRow = ({ r, max }) => (
  <Card style={{ padding: "11px 13px", marginBottom: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
      <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{r.muscle}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{fmtSets(r.sets)} series</div>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
        color: VOL_COLORS[r.status], background: `${VOL_COLORS[r.status]}1E`, border: `1px solid ${VOL_COLORS[r.status]}55`,
        borderRadius: 7, padding: "2px 7px" }}>{r.status}</div>
    </div>
    <div style={{ position: "relative", height: 8, background: P.s3, borderRadius: 5, overflow: "hidden" }}>
      {r.ref && (
        <div style={{ position: "absolute", left: `${(r.ref.mav[0] / max) * 100}%`, width: `${((r.ref.mav[1] - r.ref.mav[0]) / max) * 100}%`,
          top: 0, bottom: 0, background: `${P.green}33` }} />
      )}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (r.sets / max) * 100)}%`,
        background: VOL_COLORS[r.status], opacity: .85, borderRadius: 5 }} />
    </div>
    {r.ref && (
      <div style={{ fontSize: 12.5, color: P.faint, marginTop: 6 }}>
        MEV {r.ref.mev} · zona óptima {r.ref.mav[0]}–{r.ref.mav[1]} · MRV {r.ref.mrv} · frecuencia sugerida {r.ref.freq}
      </div>
    )}
  </Card>
);

const VolumePanel = ({ plan }) => {
  const [sub, setSub] = useState("semana");
  const vol = useMemo(() => volumeByMuscle(plan), [plan]);
  // Agrupado por rutina (A, B, C…), igual que en la pestaña Rutina, para no
  // mezclar sesiones de rutinas distintas en una sola lista.
  const groups = useMemo(() => groupDaysByRoutine(plan.days).map((g) => ({
    ...g, perDay: g.days.map((d) => ({ day: d, ...volumeByMuscleForDay(d) })),
  })), [plan.days]);
  if (!vol.rows.length) return <Empty icon={Dumbbell} title="Sin series que analizar" body="Carga la rutina del alumno para ver el volumen efectivo por grupo muscular." />;
  const max = Math.max(...vol.rows.map((r) => Math.max(r.sets, r.ref ? r.ref.mrv : 0)), 1);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 11, padding: 3, marginBottom: 12 }}>
        {[["semana", "Semanal por músculo"], ["sesion", "Por sesión"]].map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            background: sub === id ? P.s3 : "transparent", color: sub === id ? P.text : P.faint, border: `1px solid ${sub === id ? P.line : "transparent"}` }}>{l}</button>
        ))}
      </div>

      {sub === "semana" && (
        <>
          <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>
            Series efectivas (sin contar aproximaciones) por <b>{vol.basis === "semana" ? "semana según el cronograma" : "vuelta completa a la rutina"}</b>. Total: {fmtSets(vol.total)} series.
            {vol.basis === "ciclo" && " Asigna los días en la pestaña Agenda para verlo en base semanal."}
            {" "}Incluye el aporte parcial de los músculos secundarios que marques en cada ejercicio.
          </div>
          {vol.rows.map((r) => <MuscleVolumeRow key={r.muscle} r={r} max={max} />)}
        </>
      )}

      {sub === "sesion" && (
        <>
          <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>
            Series efectivas totales de cada sesión, con el desglose por grupo muscular (incluye el aporte parcial de músculos secundarios), separadas por rutina.
          </div>
          {groups.length === 0 && <Empty icon={ClipboardList} title="Sin días cargados" body="Crea los días de la rutina para ver el detalle por sesión." />}
          {groups.map((g) => (
            <div key={g.key} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${P.line}` }}>
                <div className="disp" style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: P.ember2 }}>{g.label}</div>
                <div style={{ fontSize: 12.5, color: P.faint }}>{g.days.length} sesión{g.days.length !== 1 ? "es" : ""}</div>
              </div>
              {g.perDay.map(({ day, rows, totalSets }) => (
                <Card key={day.id} style={{ padding: "12px 13px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{day.name}</div>
                    <div style={{ flex: 1 }} />
                    <div className="disp" style={{ fontSize: 16, fontWeight: 700, color: P.ember2 }}>{fmtSets(totalSets)} series</div>
                  </div>
                  {rows.length === 0 ? (
                    <div style={{ fontSize: 13.5, color: P.faint }}>Sin ejercicios en este día.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {rows.map((r) => (
                        <div key={r.muscle} style={{ fontSize: 13, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 8, padding: "4px 9px" }}>
                          {r.muscle} <b style={{ color: P.text }}>{fmtSets(r.sets)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

/* ---- Base de conocimiento consultable ---- */
const KnowledgePanel = () => {
  const [open, setOpen] = useState("fases");
  const Section = ({ id, title, children }) => (
    <Card style={{ padding: 0, marginBottom: 9, overflow: "hidden" }}>
      <button onClick={() => setOpen(open === id ? "" : id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", textAlign: "left" }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15.5, color: P.text }}>{title}</div>
        {open === id ? <ChevronUp size={17} color={P.faint} /> : <ChevronDown size={17} color={P.faint} />}
      </button>
      {open === id && <div style={{ padding: "0 14px 14px", fontSize: 14.5, color: P.dim, lineHeight: 1.55 }}>{children}</div>}
    </Card>
  );
  const Li = ({ children }) => <div style={{ display: "flex", gap: 7, marginBottom: 6 }}><span style={{ color: P.ember, flexShrink: 0 }}>·</span><span>{children}</span></div>;
  return (
    <div>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>
        Las referencias con las que razona el agente. Están disponibles aunque no tengas API key configurada.
      </div>

      <Section id="fases" title="Fases: calorías, ritmo y proteína">
        {BB_PHASES.map((p) => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: P.text, marginBottom: 3 }}>{p.label}</div>
            <div style={{ fontSize: 14 }}>{p.kcal} · ritmo {p.rate} · proteína {p.prot}</div>
            <div style={{ fontSize: 13.5, color: P.faint, marginTop: 3 }}>{p.note}</div>
          </div>
        ))}
      </Section>

      <Section id="volumen" title="Volumen semanal por grupo muscular">
        <div style={{ fontSize: 13.5, color: P.faint, marginBottom: 10, lineHeight: 1.5 }}>
          Series efectivas por semana, de menor a mayor: <b style={{ color: P.text }}>MEV</b> (mínimo para estimular) →
          <b style={{ color: P.green }}> zona óptima</b> (donde se progresa mejor) → <b style={{ color: P.text }}>MRV</b> (techo que se puede recuperar).
          Pasarse del MRV no da más músculo, solo más fatiga.
        </div>
        {Object.entries(BB_VOLUME_REF).map(([m, r]) => (
          <div key={m} style={{ padding: "8px 0", borderBottom: `1px solid ${P.line}55` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <div style={{ flex: 1, color: P.text, fontWeight: 700, fontSize: 14.5 }}>{m}</div>
              <div style={{ color: P.faint, fontSize: 13 }}>{r.freq}</div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 6, padding: "2px 7px" }}>MEV {r.mev}</span>
              <span style={{ color: P.green, background: "rgba(255,255,255,.08)", border: `1px solid rgba(255,255,255,.35)`, borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>Óptimo {r.mav[0]}–{r.mav[1]}</span>
              <span style={{ color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 6, padding: "2px 7px" }}>MRV {r.mrv}</span>
            </div>
          </div>
        ))}
      </Section>

      <Section id="categorias" title="Categorías de competencia">
        {BB_CATEGORIES.map((c) => (
          <div key={c.id} style={{ marginBottom: 9 }}>
            <div style={{ fontWeight: 700, color: P.text }}>{c.label}</div>
            <div style={{ fontSize: 14 }}>{c.focus}</div>
          </div>
        ))}
      </Section>

      <Section id="peak" title="Peak week: reglas que no se rompen">
        {BB_PEAK_WEEK.map((t, i) => <Li key={i}>{t}</Li>)}
      </Section>

      <Section id="supps" title="Suplementación por evidencia">
        {BB_SUPPS.map((g) => (
          <div key={g.tier} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: P.text, marginBottom: 4 }}>{g.tier}</div>
            {g.items.map((t, i) => <Li key={i}>{t}</Li>)}
          </div>
        ))}
      </Section>

      <Section id="plateau" title="Estancamiento: qué revisar antes de cambiar la rutina">
        {BB_PLATEAU.map((t, i) => <Li key={i}>{t}</Li>)}
      </Section>

      <Card style={{ padding: "12px 14px", marginTop: 12, borderColor: `${P.red}44`, background: `${P.red}0C` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13.5, color: P.dim, lineHeight: 1.5 }}>
            El agente no indica ni dosifica esteroides, hormonas, SARMs ni diuréticos, y no reemplaza a un médico ni a un nutricionista clínico. Ante patologías, medicación o dolor con señales de alarma, deriva al profesional correspondiente.
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ---- Chat del agente ---- */
const BodybuildingChat = ({ plan, savePlan, history, currentStudent, apiKey, onNeedKey, toast }) => {
  const sid = currentStudent?.id;
  const [messages, setMessages] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const [input, setInput] = useState("");
  const [specialty, setSpecialty] = useState("general");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState({});
  const [pendingAttach, setPendingAttach] = useState([]); // ids de fotos/videos aún no enviados
  const [viewImg, setViewImg] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    (async () => {
      const saved = await sGet(`forja-bb-chat:${sid}`);
      if (!alive) return;
      setMessages(Array.isArray(saved) ? saved : []);
      setLoadedFor(sid);
    })();
    return () => { alive = false; };
  }, [sid]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

  const persist = (msgs) => { if (sid) sSet(`forja-bb-chat:${sid}`, msgs); };

  const spec = BB_SPECIALTIES.find((s) => s.id === specialty) || BB_SPECIALTIES[0];

  // Arma el contenido de un mensaje para la API de Claude: si tiene fotos
  // adjuntas, van primero como bloques de imagen (Claude las analiza), el
  // texto va al final. Los videos no se pueden mandar a la API de visión:
  // quedan adjuntos para que el coach los vea, pero se avisa en el texto.
  const contentForAPI = async (m) => {
    if (!m.attachIds || !m.attachIds.length) return m.content;
    const blocks = [];
    let videoCount = 0;
    for (const id of m.attachIds) {
      const media = await sGet(`attach:${id}`);
      if (!media) continue;
      if (media.kind === "video") { videoCount++; continue; }
      const comma = media.dataUrl.indexOf(",");
      const meta = media.dataUrl.slice(5, media.dataUrl.indexOf(";"));
      blocks.push({ type: "image", source: { type: "base64", media_type: meta || "image/jpeg", data: media.dataUrl.slice(comma + 1) } });
    }
    const note = videoCount ? `\n\n(${videoCount} video${videoCount !== 1 ? "s" : ""} adjunto${videoCount !== 1 ? "s" : ""}, no se envía a la IA para análisis)` : "";
    blocks.push({ type: "text", text: (m.content || "(foto adjunta)") + note });
    return blocks;
  };

  const send = async (preset) => {
    const text = (preset != null ? preset : input).trim();
    if ((!text && !pendingAttach.length) || busy) return;
    if (!apiKey) { setErr("Configura primero tu API key de Anthropic."); onNeedKey && onNeedKey(); return; }
    setErr("");
    const userMsg = { role: "user", content: text };
    if (pendingAttach.length) userMsg.attachIds = [...pendingAttach];
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs); setInput(""); setPendingAttach([]); setBusy(true);
    try {
      const ctx = buildAthleteContext({ plan, history, athlete: plan.athlete, student: currentStudent });
      const apiMessages = await Promise.all(nextMsgs.map(async (m) => ({ role: m.role, content: await contentForAPI(m) })));
      const data = await callClaudeAPI(apiKey, {
        model: AI_MODEL,
        max_tokens: 3000,
        system: buildBBSystemPrompt(ctx, specialty),
        messages: apiMessages,
      });
      const answer = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n") || "(sin respuesta)";
      const final = [...nextMsgs, { role: "assistant", content: answer }];
      setMessages(final); persist(final);
    } catch (e) {
      setErr(e.message || "Error de conexión");
    } finally { setBusy(false); }
  };

  const applyRoutine = (data, key, mode) => {
    const newDays = daysFromAIJson(data.days);
    if (!newDays.length) { toast && toast("El bloque no traía días válidos."); return; }
    const p = structuredClone(plan);
    const routine = mode === "replace" ? ROUTINE_A : nextRoutineKey(p.days);
    const tagged = newDays.map((d) => ({ ...d, routine }));
    p.days = mode === "replace" ? tagged : [...p.days, ...tagged];
    p.updatedAt = todayISO();
    savePlan(p);
    setApplied((a) => ({ ...a, [key]: true }));
    toast && toast(`✓ ${routineLabel(routine)}: ${newDays.length} día${newDays.length !== 1 ? "s" : ""}, ${newDays.reduce((acc, d) => acc + d.exs.length, 0)} ejercicios`);
  };

  const applyNutrition = (data, key) => {
    const p = structuredClone(plan);
    if (data.kcal != null) p.nutrition.kcal = +data.kcal || 0;
    if (data.p != null) p.nutrition.p = +data.p || 0;
    if (data.c != null) p.nutrition.c = +data.c || 0;
    if (data.f != null) p.nutrition.f = +data.f || 0;
    if (data.notes) p.nutrition.notes = data.notes;
    p.updatedAt = todayISO();
    savePlan(p);
    setApplied((a) => ({ ...a, [key]: true }));
    toast && toast("✓ Macros aplicados al plan nutricional");
  };

  const applyLibrary = (data, key) => {
    const p = structuredClone(plan);
    if (!p.library) p.library = [];
    p.library.push({
      id: uid(), name: data.name || "Ejercicio", muscle: MUSCLES.includes(data.muscle) ? data.muscle : MUSCLES[0],
      equipment: EQUIPMENT.includes(data.equipment) ? data.equipment : "", rest: +data.rest || 90, notes: data.notes || "",
      video: "", superset: "", secondary: [],
      sets: (data.sets || []).map((s) => ({ id: uid(), type: SET_TYPES[s.type] ? s.type : "normal", repsT: s.repsT || "8-12", rirT: s.rirT || "2", pct: 15 })),
    });
    p.updatedAt = todayISO();
    savePlan(p);
    setApplied((a) => ({ ...a, [key]: true }));
    toast && toast(`✓ «${data.name || "Ejercicio"}» agregado a la biblioteca`);
  };

  const clearChat = () => { setMessages([]); setApplied({}); persist([]); };

  if (sid && loadedFor !== sid) return <div style={{ padding: 30, textAlign: "center", color: P.faint }}>Cargando conversación…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
        {BB_SPECIALTIES.map(({ id, label, Icon }) => {
          const on = specialty === id;
          return (
            <button key={id} onClick={() => setSpecialty(id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
              padding: "7px 11px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
              background: on ? `${P.ember}1F` : P.s2, border: `1px solid ${on ? `${P.ember}66` : P.line}`, color: on ? P.ember2 : P.dim }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>
      {messages.length === 0 && <div style={{ fontSize: 13.5, color: P.faint, lineHeight: 1.45, marginBottom: 12 }}>{spec.focus}</div>}

      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Consultas frecuentes de {spec.label.toLowerCase()}</div>
          {spec.sugg.map((s, i) => (
            <button key={i} onClick={() => (apiKey ? send(s) : setInput(s))} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
              background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10, marginBottom: 6, fontSize: 14, color: P.dim, lineHeight: 1.4 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ maxHeight: "52vh", overflowY: "auto", marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                {m.attachIds && m.attachIds.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 5, maxWidth: "85%", overflowX: "auto" }}>
                    {m.attachIds.map((id) => <AttachThumb key={id} id={id} size={56} onOpen={setViewImg} />)}
                  </div>
                )}
                {m.content && (
                  <div style={{ maxWidth: "85%", padding: "10px 13px", borderRadius: 14, background: `${P.ember}22`,
                    border: `1px solid ${P.ember}55`, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.content}</div>
                )}
              </div>
            );
          }
          const { clean, actions } = parseAIActions(m.content);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex" }}>
                <div style={{ maxWidth: "92%", padding: "10px 13px", borderRadius: 14, background: P.s2,
                  border: `1px solid ${P.line}`, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{clean || "(sin texto)"}</div>
              </div>
              {actions.map((act, j) => {
                const key = `${i}-${j}`;
                const done = applied[key];
                if (act.kind === "rutina") {
                  const days = act.data.days || [];
                  const exCount = days.reduce((a, d) => a + (d.exs || []).length, 0);
                  return (
                    <Card key={key} style={{ padding: "12px 13px", marginTop: 8, borderColor: `${P.ember}55`, background: `${P.ember}0A` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <ClipboardList size={15} color={P.ember2} />
                        <div style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{act.data.titulo || "Bloque de entrenamiento"}</div>
                      </div>
                      <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 9, lineHeight: 1.45 }}>
                        {days.length} día{days.length !== 1 ? "s" : ""} · {exCount} ejercicios: {days.map((d) => d.name).join(" · ")}
                      </div>
                      {done ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: P.green }}><Check size={14} /> Aplicado al plan</div>
                      ) : (
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          <Btn kind="ember" small onClick={() => applyRoutine(act.data, key, "append")}><Plus size={13} /> Añadir como rutina nueva</Btn>
                          <Btn kind="line" small onClick={() => applyRoutine(act.data, key, "replace")}><RotateCcw size={13} /> Reemplazar plan</Btn>
                        </div>
                      )}
                    </Card>
                  );
                }
                if (act.kind === "biblioteca") {
                  const d = act.data;
                  return (
                    <Card key={key} style={{ padding: "12px 13px", marginTop: 8, borderColor: `${P.blue}55`, background: `${P.blue}0A` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <Library size={15} color={P.blue} />
                        <div style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{d.name || "Ejercicio"}</div>
                      </div>
                      <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 9, lineHeight: 1.45 }}>
                        {d.muscle}{d.equipment ? ` · ${d.equipment}` : ""} · {(d.sets || []).length} serie{(d.sets || []).length !== 1 ? "s" : ""}
                      </div>
                      {done ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: P.green }}><Check size={14} /> Agregado a la biblioteca</div>
                      ) : (
                        <Btn kind="line" small onClick={() => applyLibrary(d, key)}><Plus size={13} /> Agregar a la biblioteca</Btn>
                      )}
                    </Card>
                  );
                }
                const d = act.data;
                return (
                  <Card key={key} style={{ padding: "12px 13px", marginTop: 8, borderColor: `${P.green}55`, background: `${P.green}0A` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <Utensils size={15} color={P.green} />
                      <div style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>Pauta nutricional propuesta</div>
                    </div>
                    <div style={{ fontSize: 13.5, color: P.dim, marginBottom: 9, lineHeight: 1.45 }}>
                      {d.kcal} kcal · P {d.p} g · C {d.c} g · G {d.f} g{d.notes ? ` — ${d.notes}` : ""}
                    </div>
                    {done ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: P.green }}><Check size={14} /> Aplicado al plan</div>
                    ) : (
                      <Btn kind="green" small onClick={() => applyNutrition(d, key)}><Check size={13} /> Aplicar al plan nutricional</Btn>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })}
        {busy && (
          <div style={{ marginBottom: 10, display: "flex" }}>
            <div style={{ padding: "10px 13px", borderRadius: 14, background: P.s2, border: `1px solid ${P.line}`, fontSize: 14.5, color: P.dim }}>
              <span className="pulse">Analizando el caso…</span>
            </div>
          </div>
        )}
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: `${P.red}22`, border: `1px solid ${P.red}55`, fontSize: 13.5, color: P.red, marginBottom: 8 }}>{err}</div>}
      </div>

      {pendingAttach.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 7, overflowX: "auto" }}>
          {pendingAttach.map((id) => (
            <AttachThumb key={id} id={id} size={52} onOpen={setViewImg}
              onRemove={() => setPendingAttach((a) => a.filter((x) => x !== id))} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <AttachButton mode="both" iconOnly disabled={busy} onError={setErr} onAttached={(id) => setPendingAttach((a) => [...a, id])} />
          <VoiceDictateButton disabled={busy} onError={setErr} onResult={(text) => setInput((v) => (v ? `${v} ${text}` : text))} />
        </div>
        <textarea rows={2} placeholder={apiKey ? `Pregunta de ${spec.label.toLowerCase()}…` : "Configura la API key primero"} disabled={busy}
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, minWidth: 0, resize: "none" }} />
        <Btn kind="ember" disabled={(!input.trim() && !pendingAttach.length) || busy} onClick={() => send()} style={{ padding: "12px 14px", minWidth: 0 }}>
          <Send size={16} />
        </Btn>
      </div>

      {messages.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn kind="line" small onClick={clearChat}><Trash2 size={12} /> Reiniciar conversación</Btn>
          <div style={{ fontSize: 12.5, color: P.faint, alignSelf: "center" }}>La conversación se guarda por alumno. Las fotos se analizan con IA; los videos quedan adjuntos pero no se analizan.</div>
        </div>
      )}
      <ImageViewer src={viewImg} onClose={() => setViewImg(null)} />
    </div>
  );
};

/* ---- Pestaña IA: agente de culturismo + nutrición ---- */
const AITab = ({ plan, savePlan, history, currentStudent, toast, jumpSub, onJumpConsumed }) => {
  const [sub, setSub] = useState("agente");
  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [showKeyEdit, setShowKeyEdit] = useState(false);

  // Permite abrir esta pestaña directo en una sub-sección (p.ej. desde el
  // botón "Habla con el coach IA de nutrición" en la pestaña Nutrición).
  useEffect(() => {
    if (jumpSub) { setSub(jumpSub); onJumpConsumed && onJumpConsumed(); }
  }, [jumpSub]);

  useEffect(() => {
    (async () => {
      const k = await sGet("forja-ai-key");
      if (k) { setApiKey(k); setDraftKey(k); }
      setKeyLoaded(true);
    })();
  }, []);

  const saveKey = async () => {
    const k = draftKey.trim();
    await sSet("forja-ai-key", k);
    setApiKey(k); setShowKeyEdit(false);
  };

  if (!keyLoaded) return <div style={{ padding: 40, textAlign: "center", color: P.faint }}>Cargando…</div>;
  if (sub === "nutricion") {
    return (
      <div>
        <div style={{ padding: "18px 16px 0" }}><SubNav sub={sub} setSub={setSub} /></div>
        <NutriAITab plan={plan} savePlan={savePlan} currentStudent={currentStudent} />
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 16px 30px" }}>
      <SubNav sub={sub} setSub={setSub} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Flame size={22} color={P.ember} />
        <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0" }}>Coach IA</h1>
      </div>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>
        Entrenador de culturismo profesional con el caso completo de <b>{currentStudent?.name || "este alumno"}</b> a la vista: ficha, rutina, volumen por músculo, historial de cargas y nutrición. Puede proponer cambios y los aplicas con un botón.
      </div>

      {(!apiKey || showKeyEdit) && (
        <Card style={{ padding: 14, marginBottom: 14, borderColor: `${P.ember}66` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <AlertTriangle size={16} color={P.ember2} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Configura tu API key de Anthropic</div>
          </div>
          <div style={{ fontSize: 13.5, color: P.dim, lineHeight: 1.5, marginBottom: 10 }}>
            Consigue una API key en <b>console.anthropic.com</b> → Settings → API Keys. Se guarda en tu Supabase y se usa tanto para este agente como para el importador de rutinas y la IA de nutrición.
            <br /><br />
            <b>Aviso técnico:</b> por limitaciones del navegador la key viaja desde tu equipo hacia la API de Anthropic. Úsala solo para este uso y revócala si sospechas filtración.
          </div>
          <Inp type="password" placeholder="sk-ant-…" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {showKeyEdit && <Btn kind="line" onClick={() => { setDraftKey(apiKey); setShowKeyEdit(false); }} style={{ flex: 1 }}>Cancelar</Btn>}
            <Btn kind="ember" disabled={!draftKey.trim()} onClick={saveKey} style={{ flex: 2 }}>Guardar API key</Btn>
          </div>
        </Card>
      )}
      {apiKey && !showKeyEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13, color: P.faint }}>
          <Check size={14} color={P.green} /> API key configurada
          <button onClick={() => setShowKeyEdit(true)} style={{ color: P.ember, marginLeft: 6, fontSize: 13 }}>cambiar</button>
        </div>
      )}

      {sub === "agente" && (
        <BodybuildingChat plan={plan} savePlan={savePlan} history={history} currentStudent={currentStudent}
          apiKey={apiKey} onNeedKey={() => setShowKeyEdit(true)} toast={toast} />
      )}
      {sub === "ficha" && <AthleteForm plan={plan} savePlan={savePlan} />}
      {sub === "volumen" && <VolumePanel plan={plan} />}
      {sub === "saber" && <KnowledgePanel />}
    </div>
  );
};

const SubNav = ({ sub, setSub }) => (
  <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 14, WebkitOverflowScrolling: "touch" }}>
    {[["agente", "Agente"], ["ficha", "Ficha"], ["volumen", "Volumen"], ["saber", "Saber"], ["nutricion", "Nutrición"]].map(([id, label]) => {
      const on = sub === id;
      return (
        <button key={id} onClick={() => setSub(id)} style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: on ? P.s3 : "transparent", border: `1px solid ${on ? P.line : "transparent"}`, color: on ? P.text : P.faint }}>{label}</button>
      );
    })}
  </div>
);

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
        <span style={{ fontSize: 13, fontWeight: isTodayCell ? 700 : 500, color: isSel ? P.ember : P.text }}>{d.getDate()}</span>
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
            <button key={id} onClick={() => setView(id)} style={{ padding: "5px 11px", borderRadius: 6, fontSize: 13, fontWeight: 700,
              background: view === id ? P.s3 : "transparent", color: view === id ? P.text : P.faint }}>{l}</button>
          ))}
        </div>
      </div>

      <Card style={{ padding: "10px 12px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={goPrev} style={{ padding: 6, color: P.dim }}><ChevronLeft size={18} /></button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>
            {view === "month" ? `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semana del ${weekCells[0].getDate()} ${MONTH_LABELS[weekCells[0].getMonth()].slice(0, 3)}`}
          </div>
          <button onClick={goNext} style={{ padding: 6, color: P.dim }}><ChevronRight size={18} /></button>
          <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(isoDate(today)); }}
            style={{ padding: "4px 8px", fontSize: 12, color: P.ember, fontWeight: 700, borderRadius: 6, border: `1px solid ${P.ember}55`, marginLeft: 4 }}>HOY</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {DAY_LABELS.map((l) => <div key={l} style={{ textAlign: "center", fontSize: 11, color: P.faint, fontWeight: 700, textTransform: "uppercase", padding: "2px 0" }}>{l}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {view === "month" ? cells.map(cell) : weekCells.map(cell)}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, color: P.faint, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, background: P.ember, borderRadius: 2 }} />Entrenamiento</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, background: P.green, borderRadius: 2 }} />Realizado</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, background: P.blue, borderRadius: 999 }} />Recordatorio</span>
        </div>
      </Card>

      <Card style={{ padding: "13px 15px" }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>
          {isToday ? "Hoy · " : ""}{DAY_LABELS_LONG[selDate.getDay()]} {selDate.getDate()} {MONTH_LABELS[selDate.getMonth()].slice(0, 3)}
        </div>
        {selDay ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{selDay.name}</div>
            <div style={{ fontSize: 14, color: P.dim, marginTop: 2 }}>
              {selDay.exs.length} ejercicios · {selDay.exs.reduce((a, e) => a + e.sets.length, 0)} series
              {selSessions.length > 0 && ` · realizado ${selSessions.length}×`}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {selDay.exs.slice(0, 6).map((e) => (
                <span key={e.id} style={{ fontSize: 12.5, color: P.dim, background: P.s2, border: `1px solid ${P.line}`, borderRadius: 6, padding: "3px 7px" }}>{e.name}</span>
              ))}
              {selDay.exs.length > 6 && <span style={{ fontSize: 12.5, color: P.faint }}>+{selDay.exs.length - 6} más</span>}
            </div>
            {isToday && onGoTrain && (
              <Btn kind="ember" onClick={onGoTrain} style={{ width: "100%", marginTop: 12 }}>
                <Play size={15} /> Ir a entrenar
              </Btn>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 15, color: P.dim }}>Día de descanso · sin entrenamiento programado</div>
        )}

        {selEvents.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.line}` }}>
            <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Recordatorios del coach</div>
            {selEvents.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 9, padding: "8px 10px", background: `${P.blue}15`, border: `1px solid ${P.blue}44`, borderRadius: 9, marginBottom: 6 }}>
                <Bell size={15} color={P.blue} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{e.title}</div>
                  {e.note && <div style={{ fontSize: 13.5, color: P.dim, marginTop: 2 }}>{e.note}</div>}
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
      <div style={{ color: P.dim, fontSize: 15, marginBottom: 14 }}>Asigna qué entrenamiento toca cada día de la semana. Los días sin asignar quedan como descanso. También puedes añadir recordatorios en fechas específicas (fotos de progreso, chequeos, etc.).</div>

      <Card style={{ padding: "13px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Semana tipo</div>
        {[["mon", "Lunes"], ["tue", "Martes"], ["wed", "Miércoles"], ["thu", "Jueves"], ["fri", "Viernes"], ["sat", "Sábado"], ["sun", "Domingo"]].map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 84, flexShrink: 0, fontSize: 14.5, fontWeight: 600 }}>{label}</div>
            <select value={plan.schedule?.[k] || ""} onChange={(e) => mut((p) => { if (!p.schedule) p.schedule = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }; p.schedule[k] = e.target.value || null; })}
              style={{ flex: 1, minWidth: 0, maxWidth: "100%", padding: "9px 8px", fontSize: 14.5 }}>
              <option value="">Descanso</option>
              {groupDaysByRoutine(plan.days).map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: P.faint, fontWeight: 700, textTransform: "uppercase" }}>Recordatorios en fechas específicas</div>
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
                <div style={{ fontSize: 13, color: P.faint }}>{fmtDateFull(e.date)}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 1 }}>{e.title}</div>
                {e.note && <div style={{ fontSize: 13.5, color: P.dim, marginTop: 2 }}>{e.note}</div>}
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
      <div style={{ color: P.dim, fontSize: 15, marginBottom: 14 }}>Cronómetro, temporizador e intervalos de trabajo/descanso. Suena y vibra en cada cambio.</div>
      <div style={{ display: "flex", gap: 6, background: P.s1, border: `1px solid ${P.line}`, borderRadius: 12, padding: 4, marginBottom: 18 }}>
        {[["interval", "Intervalos"], ["count", "Temporizador"], ["stop", "Cronómetro"]].map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 14, fontWeight: 600,
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
  <div style={{ background: "rgba(255,36,56,.14)", border: `1px solid rgba(255,36,56,.45)`, borderRadius: 12,
    margin: "10px 16px 0", padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-start" }}>
    <AlertTriangle size={16} color={P.red} style={{ flexShrink: 0, marginTop: 1 }} />
    <div style={{ fontSize: 13.5, color: P.red, lineHeight: 1.45 }}>
      No se pudo conectar con el servidor. Los datos se mantienen en memoria pero pueden perderse al cerrar la app. Se reintentará automáticamente.
    </div>
  </div>
);

const Toast = ({ msg }) => !msg ? null : (
  <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 86, zIndex: 80,
    width: "calc(100% - 32px)", maxWidth: 488 }}>
    <div className="sheetIn" style={{ background: "rgba(30,10,13,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      border: `1px solid rgba(224,26,26,.55)`, color: "#FFFFFF",
      borderRadius: 14, padding: "12px 15px", fontSize: 15.5, lineHeight: 1.4,
      boxShadow: "0 1px 0 rgba(255,255,255,.1) inset, 0 12px 30px rgba(0,0,0,.55)" }}>{msg}</div>
  </div>
);

/* ============================================================
   ATLAS — enciclopedia + guía de ejercicios (Olympia Training Atlas)
   Se sirve como archivos propios dentro de esta misma plataforma
   (carpeta /atlas), así que queda embebido sin salir del sitio.
   ============================================================ */
const AtlasTab = () => (
  <div style={{ padding: "16px 12px 6px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <Library size={21} color={P.ember} />
      <h1 style={{ fontSize: 24, textTransform: "uppercase", margin: "4px 0" }}>Atlas</h1>
    </div>
    <div style={{ color: P.dim, fontSize: 14, marginBottom: 10, lineHeight: 1.4 }}>
      Enciclopedia profesional de fuerza e hipertrofia + guía definitiva de ejercicios: 248 conceptos, 83 ejercicios y 22 fuentes científicas.
    </div>
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${P.line}`,
      height: "calc(100dvh - 220px)", minHeight: 460, background: "#000000" }}>
      <iframe src="atlas/index.html" title="Olympia Training Atlas" loading="lazy"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
    </div>
  </div>
);

/* ============================================================
   EQUIPO — roles del lado coach (Head Coach y su staff)
   No hay login con contraseña en FORJA (la identidad se elige tocando un
   nombre, igual que con los alumnos): esto es una separación de
   ORGANIZACIÓN — qué ve y qué puede tocar cada rol — no una barrera de
   seguridad criptográfica. Se documenta así en la propia pantalla de
   gestión del equipo para que quede claro.
   ============================================================ */
// tabAccess: null = acceso completo a todas las pestañas de coach (editar).
// Si es un objeto, solo esas pestañas aparecen, con "edit" o "view" cada una.
// "guia"/"atlas"/"timer" son contenido de referencia sin riesgo de mutar
// datos del alumno, así que quedan disponibles para cualquier rol.
const ALWAYS_TABS = { timer: "edit", guia: "edit", atlas: "edit" };
const ROLE_META = {
  head_coach:  { label: "Head Coach", short: "Acceso completo + gestiona el equipo", manageTeam: true, tabAccess: null },
  coach_asistente: { label: "Coach asistente", short: "Acceso completo, no gestiona el equipo", manageTeam: false, tabAccess: null },
  asistente:   { label: "Asistente", short: "Rutina, agenda e indicaciones", manageTeam: false,
    tabAccess: { rutina: "edit", agenda: "edit", indicaciones: "edit", actividad: "view", ...ALWAYS_TABS } },
  nutricionista: { label: "Nutricionista", short: "Nutrición, ve rutina y actividad", manageTeam: false,
    tabAccess: { nutricion: "edit", ia: "edit", rutina: "view", actividad: "view", ...ALWAYS_TABS } },
  nutricionista_deportivo: { label: "Nutricionista deportivo", short: "Nutrición, ve rutina y actividad", manageTeam: false,
    tabAccess: { nutricion: "edit", ia: "edit", rutina: "view", actividad: "view", ...ALWAYS_TABS } },
  doctor:        { label: "Doctor", short: "Ve rutina, actividad e indicaciones", manageTeam: false,
    tabAccess: { rutina: "view", actividad: "view", indicaciones: "view", ...ALWAYS_TABS } },
  kinesiologo:   { label: "Kinesiólogo", short: "Ve rutina, actividad e indicaciones", manageTeam: false,
    tabAccess: { rutina: "view", actividad: "view", indicaciones: "view", ...ALWAYS_TABS } },
  quiropractico: { label: "Quiropráctico", short: "Ve rutina, actividad e indicaciones", manageTeam: false,
    tabAccess: { rutina: "view", actividad: "view", indicaciones: "view", ...ALWAYS_TABS } },
  masoterapeuta: { label: "Masoterapeuta", short: "Ve rutina, actividad e indicaciones", manageTeam: false,
    tabAccess: { rutina: "view", actividad: "view", indicaciones: "view", ...ALWAYS_TABS } },
  solo_ver:      { label: "Solo visualización", short: "Ve todo, no puede editar nada", manageTeam: false, tabAccess: null, forceView: true },
};
const ROLE_ORDER = ["head_coach", "coach_asistente", "asistente", "nutricionista", "nutricionista_deportivo", "doctor", "kinesiologo", "quiropractico", "masoterapeuta", "solo_ver"];

const TABS_COACH_IDS = ["rutina", "agenda", "nutricion", "ia", "indicaciones", "actividad", "rankings", "timer", "guia", "atlas"];
// Pestañas de coach visibles + si cada una es editable, según el rol.
// Sin equipo creado (o si el que entró es Head Coach) es acceso total: así
// un coach solo, sin staff, no nota ningún cambio de comportamiento.
function coachTabsForRole(role) {
  const meta = ROLE_META[role] || ROLE_META.head_coach;
  if (!meta.tabAccess) {
    const mode = meta.forceView ? "view" : "edit";
    return Object.fromEntries(TABS_COACH_IDS.map((id) => [id, mode]));
  }
  return meta.tabAccess;
}

// Bloquea toda interacción dentro de una pestaña cuando el rol solo puede
// verla: una capa transparente encima intercepta los toques y avisa por
// qué, sin tener que deshabilitar botón por botón en cada pantalla.
const ReadOnlyLock = ({ active, toast, children }) => (
  <div style={{ position: "relative" }}>
    {children}
    {active && (
      <div
        onClick={() => toast && toast("Tu rol solo puede ver esta sección — no editarla.")}
        style={{ position: "absolute", inset: 0, zIndex: 45, cursor: "not-allowed" }} />
    )}
    {active && (
      <div style={{ margin: "0 16px 14px", padding: "9px 12px", borderRadius: 10,
        background: P.s2, border: `1px solid ${P.line}`, color: P.dim, fontSize: 12.5,
        display: "flex", alignItems: "center", gap: 8 }}>
        <Info size={14} color={P.faint} style={{ flexShrink: 0 }} /> Estás viendo esta sección en modo solo lectura — tu rol no puede editarla.
      </div>
    )}
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
    { id: "atlas", label: "Atlas", Icon: Library },
  ],
  coach: [
    { id: "rutina", label: "Rutina", Icon: ClipboardList },
    { id: "agenda", label: "Agenda", Icon: Calendar },
    { id: "nutricion", label: "Nutric.", Icon: Utensils },
    { id: "ia", label: "IA", Icon: Sparkles },
    { id: "indicaciones", label: "Indicac.", Icon: StickyNote },
    { id: "actividad", label: "Activ.", Icon: Users },
    { id: "rankings", label: "Rankings", Icon: Trophy },
    { id: "timer", label: "Timer", Icon: Timer },
    { id: "guia", label: "Guía", Icon: BookOpen },
    { id: "atlas", label: "Atlas", Icon: Library },
  ],
};

const TabBar = ({ tabs, tab, setTab }) => (
  <div data-tabbar style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center",
    background: `${P.s1}F0`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: `1px solid ${P.line}`,
    boxShadow: "0 1px 0 rgba(255,255,255,.05) inset, 0 -14px 30px -16px rgba(0,0,0,.7)" }}>
    <div style={{ display: "flex", width: "100%", maxWidth: 520, padding: "7px 2px calc(8px + env(safe-area-inset-bottom))" }}>
      {tabs.map(({ id, label, Icon }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 3, padding: "5px 1px 4px", color: on ? P.ember2 : P.faint, minWidth: 0 }}>
            {/* La pestaña activa se ve como una placa con relieve (degradado +
                brillo), no solo un ícono coloreado: más volumen, más clara. */}
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 25, borderRadius: 9,
              background: on ? `linear-gradient(160deg, #FF4747, ${P.ember} 75%)` : "transparent",
              boxShadow: on ? "0 1px 0 rgba(255,255,255,.3) inset, 0 4px 12px -4px rgba(255,40,60,.6)" : "none",
              transition: "background .15s, box-shadow .15s" }}>
              <Icon size={18} strokeWidth={on ? 2.3 : 2} color={on ? "#FFFFFF" : P.faint} />
            </span>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ---- Selección de identidad (por dispositivo) ---- */
const Gate = ({ roster, team, onEnter, onEnterTeam, onAdd }) => {
  // Si ya hay equipo armado (más de un coach/staff), "Soy el coach" no
  // entra directo: primero pregunta quién de todos es. Sin equipo (el
  // caso de siempre, un solo coach) sigue entrando directo, sin fricción.
  const hasTeam = team && team.members && team.members.length > 0;
  const [pickingTeam, setPickingTeam] = useState(false);
  if (pickingTeam) {
    return (
      <div className="fj" style={{ minHeight: "100vh", background: P.bgGrad, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <GlobalStyle />
        <div style={{ width: "100%", maxWidth: 420 }}>
          <button onClick={() => setPickingTeam(false)} style={{ display: "flex", alignItems: "center", gap: 6, color: P.faint, fontSize: 13.5, marginBottom: 14 }}>
            <ChevronLeft size={16} /> Volver
          </button>
          <h1 style={{ fontSize: 22, textTransform: "uppercase", margin: "0 0 4px" }}>¿Quién eres?</h1>
          <div style={{ color: P.dim, fontSize: 14, marginBottom: 16, lineHeight: 1.4 }}>Elige tu nombre del equipo — así ves solo lo que corresponde a tu rol.</div>
          <Card onClick={() => onEnterTeam(null)} style={{ padding: "13px 15px", marginBottom: 9, cursor: "pointer", borderColor: `${P.ember}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(160deg, #FF4747, ${P.ember} 70%, #7A0808)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#FFF" }}>★</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15.5 }}>Tú (Head Coach)</div><div style={{ fontSize: 12.5, color: P.dim }}>El dueño de este dispositivo</div></div>
              <ChevronRight size={17} color={P.faint} />
            </div>
          </Card>
          {team.members.map((m) => (
            <Card key={m.id} onClick={() => onEnterTeam(m.id)} style={{ padding: "13px 15px", marginBottom: 9, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className="disp" style={{ width: 36, height: 36, borderRadius: 10, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2 }}>{m.name.slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15.5 }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: P.faint }}>{(ROLE_META[m.role] || {}).label || m.role}</div>
                </div>
                <ChevronRight size={17} color={P.faint} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  return (
  <div className="fj" style={{ minHeight: "100vh", background: P.bgGrad, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <GlobalStyle />
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}><Logo size={34} /></div>
      <h1 style={{ fontSize: 24, textTransform: "uppercase", textAlign: "center", margin: "0 0 4px" }}>¿Quién entra?</h1>
      <div style={{ color: P.dim, fontSize: 14.5, textAlign: "center", marginBottom: 20, lineHeight: 1.45 }}>
        Este dispositivo recordará tu elección. Podrás cambiarla cuando quieras desde el encabezado.
      </div>
      <Card onClick={() => hasTeam ? setPickingTeam(true) : onEnter("coach", roster.students[0]?.id)} style={{ padding: "15px 16px", marginBottom: 16, borderColor: `${P.ember}55`, cursor: "pointer",
        background: `linear-gradient(150deg, rgba(255,255,255,.10), ${P.s1})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${P.ember}22`, border: `1px solid ${P.ember}55`, display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={20} color={P.ember} /></div>
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>Soy el coach</div><div style={{ fontSize: 13.5, color: P.dim }}>{hasTeam ? "Elige quién del equipo eres" : "Crear y editar rutinas, ver la actividad de todos"}</div></div>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: P.faint, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, margin: "4px 2px 8px" }}>Entrar como alumno</div>
      {roster.students.map((s) => (
        <Card key={s.id} onClick={() => onEnter("alumno", s.id)} style={{ padding: "13px 15px", marginBottom: 9, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="disp" style={{ width: 36, height: 36, borderRadius: 10, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2 }}>{s.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>{s.name}</div>
            <ChevronRight size={17} color={P.faint} />
          </div>
        </Card>
      ))}
      <Btn kind="line" onClick={onAdd} style={{ width: "100%", marginTop: 6 }}><Plus size={15} /> Agregar alumno</Btn>
    </div>
  </div>
  );
};

/* ---- Gestión de alumnos (coach) ---- */
const RosterSheet = ({ open, onClose, roster, sid, onEnter, onAdd, onRename, onRemove }) => (
  <Sheet open={open} onClose={onClose} title="Alumnos" tall>
    <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 14 }}>Cada alumno tiene su propia rutina, historial y progreso, guardados por separado y sincronizados en todos los dispositivos que abran esta plataforma.</div>
    {roster.students.map((s) => (
      <Card key={s.id} style={{ padding: "12px 14px", marginBottom: 10, borderColor: s.id === sid ? `${P.ember}66` : P.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div className="disp" style={{ width: 34, height: 34, borderRadius: 9, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2 }}>{s.name.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{s.name}{s.id === sid && <span style={{ fontSize: 12, color: P.ember2, marginLeft: 8 }}>· gestionando</span>}</div>
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

/* ---- Gestión del equipo (solo Head Coach) ---- */
const EquipoSheet = ({ open, onClose, team, onAdd, onChangeRole, onRemove }) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("coach_asistente");
  const add = () => {
    const n = name.trim();
    if (!n) return;
    onAdd({ id: uid(), name: n, role, addedAt: todayISO() });
    setName(""); setRole("coach_asistente");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Equipo" tall>
      <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 6, lineHeight: 1.45 }}>
        Agrega a tu staff y decide qué puede ver y editar cada uno. Tú siempre eres Head Coach y no aparece en esta lista.
      </div>
      <div style={{ fontSize: 12.5, color: P.faint, marginBottom: 14, lineHeight: 1.4, padding: "8px 10px", background: P.s2, border: `1px solid ${P.line}`, borderRadius: 10 }}>
        FORJA no pide contraseña: la identidad se elige tocando un nombre, igual que con los alumnos. Esto organiza quién ve/edita qué — no reemplaza cuidar quién tiene el dispositivo en la mano.
      </div>
      {team.members.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px 8px", color: P.faint, fontSize: 14 }}>Todavía no agregaste a nadie del equipo.</div>
      )}
      {team.members.map((m) => (
        <Card key={m.id} style={{ padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div className="disp" style={{ width: 34, height: 34, borderRadius: 9, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2, flexShrink: 0 }}>{m.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: P.faint }}>{(ROLE_META[m.role] || {}).short}</div>
            </div>
            <button onClick={() => onRemove(m)} style={{ color: P.faint, padding: 6 }}><Trash2 size={15} /></button>
          </div>
          <select value={m.role} onChange={(e) => onChangeRole(m.id, e.target.value)} style={{ width: "100%", padding: "8px 9px", fontSize: 14 }}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
        </Card>
      ))}
      <Card style={{ padding: 14, marginTop: 6 }}>
        <div style={{ fontSize: 12, color: P.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Agregar al equipo</div>
        <Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" style={{ marginBottom: 8 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: "9px 9px", fontSize: 14, marginBottom: 10 }}>
          {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
        </select>
        <Btn kind="ember" onClick={add} disabled={!name.trim()} style={{ width: "100%" }}><Plus size={15} /> Agregar</Btn>
      </Card>
    </Sheet>
  );
};

const App = () => {
  const [loading, setLoading] = useState(true);
  // El splash se ve al menos 2.6s (para que toda la coreografía de entrada
  // termine de jugarse con calma) aunque los datos ya hayan llegado antes.
  // Al cumplirse el mínimo y ya no estar cargando, entra en "exiting"
  // (fundido de salida de .7s vía la prop `exiting`) y solo después de ese
  // fundido se desmonta de verdad — nunca un corte abrupto a la app real.
  const [splashMinDone, setSplashMinDone] = useState(false);
  const [splashExiting, setSplashExiting] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashMinDone(true), 2600); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (loading || !splashMinDone || splashGone) return;
    setSplashExiting(true);
    const t = setTimeout(() => setSplashGone(true), 700);
    return () => clearTimeout(t);
  }, [loading, splashMinDone, splashGone]);
  const [ready, setReady] = useState(false);
  const [roster, setRoster] = useState({ v: ROSTER_VERSION, students: [] });
  const [mode, setMode] = useState("coach");
  const [sid, setSid] = useState(null);
  // Equipo del lado coach (Head Coach + staff). Sin miembros = coach solo,
  // acceso total, cero fricción extra (comportamiento de siempre).
  const [team, setTeam] = useState({ members: [] });
  const [myTeamId, setMyTeamId] = useState(null);
  const [equipoOpen, setEquipoOpen] = useState(false);
  const myRole = (() => {
    if (!myTeamId) return "head_coach";
    const me = team.members.find((m) => m.id === myTeamId);
    return me ? me.role : "head_coach";
  })();
  const myRoleMeta = ROLE_META[myRole] || ROLE_META.head_coach;
  const roleTabAccess = coachTabsForRole(myRole);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState(emptyHistory);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("rutina");
  const [aiJumpSub, setAiJumpSub] = useState(null);
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
    // Migración: planes viejos sin ficha del atleta (la usa el agente de culturismo)
    if (!p.athlete) p.athlete = emptyAthlete();
    // Migración: planes viejos sin biblioteca de ejercicios
    if (!p.library) p.library = [];
    if ((p.seedVersion || 0) < SEED_VERSION) {
      const trainingB = (p.days || []).find((day) => day.name === "Entrenamiento B");
      if (trainingB) {
        TRAINING_B_VIDEOS.forEach((video, index) => {
          if (trainingB.exs[index]) trainingB.exs[index].video = video;
        });
      }
      // Todo lo que ya estaba cargado pasa a la Rutina A tal cual está (solo se etiqueta)
      (p.days || []).forEach((day) => { if (!day.routine) day.routine = ROUTINE_A; });
      // La Rutina B (documento J2) se añade una sola vez, sin tocar la Rutina A
      if ((p.days || []).length && !p.days.some((day) => day.routine === ROUTINE_B)) {
        p.days = [...p.days, ...routineBDays()];
      }
      p.seedVersion = SEED_VERSION;
      await sSet(`forja-plan:${id}`, p);
    }
    let h = await sGet(`forja-history:${id}`); if (!h) h = emptyHistory();
    const a = await sGet(`forja-active:${id}`);
    return { p, h, a: a || null };
  };

  const openIdentity = async (m, id, rosterArg, teamId) => {
    const r = rosterArg || roster;
    if (!id) id = r.students[0]?.id;
    if (!id) { setLoading(false); return; }
    const { p, h, a } = await loadStudent(id);
    sidRef.current = id; activeRef.current = a;
    setMode(m); setSid(id); setPlan(p); setHistory(h); setActive(a); setSavedAt("");
    setMyTeamId(teamId || null);
    setTab(m === "coach" ? "rutina" : "hoy");
    setReady(true); setLoading(false);
    sSet("forja-device", { mode: m, sid: id, teamId: teamId || null }, false);
    force((x) => x + 1);
  };

  useEffect(() => {
    (async () => {
      let r = await sGet("forja-roster");
      if (!r || r.v !== ROSTER_VERSION || !r.students || r.students.length === 0) {
        const id = uid();
        r = { v: ROSTER_VERSION, students: [{ id, name: "Alumno ejemplo", createdAt: todayISO() }] };
        await sSet(`forja-plan:${id}`, seedPlanWithSchedule());
        const legacyH = await sGet("forja-history");
        await sSet(`forja-history:${id}`, (legacyH && legacyH.sessions) ? legacyH : emptyHistory());
        const legacyA = await sGet("forja-active");
        if (legacyA) await sSet(`forja-active:${id}`, legacyA);
        await sSet("forja-roster", r);
      }
      setRoster(r);
      const t = await sGet("forja-team");
      if (t && Array.isArray(t.members)) setTeam(t);
      const dev = await sGet("forja-device", false);
      const known = dev && dev.sid && r.students.some((s) => s.id === dev.sid);
      if (dev && dev.mode && known) await openIdentity(dev.mode, dev.sid, r, dev.teamId);
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
        volume += num(s.weight) * num(s.reps);
        (s.drops || []).forEach((d) => { volume += num(d.weight) * num(d.reps); });
        if (s.comment) hasComments = true;
      });
      if (ex.comment || (ex.attachIds || []).length > 0) hasComments = true;
      if (doneSets.length === 0 && !ex.comment && (ex.attachIds || []).length === 0) return;
      const prevMax = (h.byEx[ex.id] || []).reduce(
        (m, en) => Math.max(m, ...en.sets.filter((s) => s.done).map((s) => num(s.weight)), 0), 0);
      const nowMax = Math.max(0, ...doneSets.map((s) => num(s.weight)));
      if (nowMax > 0 && nowMax > prevMax) prs.push(`${ex.name}: ${kg(nowMax)} kg`);
      if (!h.byEx[ex.id]) h.byEx[ex.id] = [];
      h.byEx[ex.id].push({ sessionId: a.id, date, dayId: a.dayId, dayName: a.dayName, exName: ex.name,
        sets: ex.sets, comment: ex.comment || "", attachIds: ex.attachIds || [] });
      recordedExs.push({ exId: ex.id, name: ex.name });
    });
    if ((a.attachIds || []).length > 0) hasComments = true;
    h.sessions.push({ id: a.id, date, dayId: a.dayId, dayName: a.dayName, durationMin, volume, setsDone, setsTotal, prs, hasComments, exs: recordedExs, attachIds: a.attachIds || [] });
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
    else { setRosterOpen(false); openIdentity("coach", id, r, myTeamId); }
  };

  // Actualiza campos sueltos del alumno (hoy: qué rutinas puede ver).
  const updateStudent = async (studentId, patch) => {
    const r = { ...roster, students: roster.students.map((x) => (x.id === studentId ? { ...x, ...patch } : x)) };
    await sSet("forja-roster", r); setRoster(r);
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
      if (r.students.length) openIdentity(mode, r.students[0].id, r, myTeamId);
      else { setReady(false); setRosterOpen(false); }
    }
  };

  const switchMode = (m) => openIdentity(m, sidRef.current, roster, myTeamId);
  const currentStudent = roster.students.find((s) => s.id === sid);
  const tabs = mode === "coach"
    ? TABS.coach.filter((t) => roleTabAccess[t.id])
    : TABS.alumno;

  if (!splashGone) {
    return <SplashScreen exiting={splashExiting} />;
  }

  if (!ready) {
    return <Gate roster={roster} team={team}
      onEnter={(m, id) => openIdentity(m, id)}
      onEnterTeam={(teamId) => openIdentity("coach", sidRef.current || roster.students[0]?.id, roster, teamId)}
      onAdd={() => addStudent(false)} />;
  }

  return (
    <div className="fj" style={{ minHeight: "100vh", minHeight: "100dvh", background: P.bgGrad }}>
      <GlobalStyle />
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, alignItems: "center", justifyContent: "space-between", gap: 8, padding: "calc(10px + env(safe-area-inset-top)) 14px 0" }}>
          <button onClick={() => setReady(false)} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div className="disp" style={{ width: 30, height: 30, borderRadius: 9, background: P.s3, border: `1px solid ${P.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: P.ember2, fontSize: 16, flexShrink: 0 }}>
              {(currentStudent?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 172 }}>{currentStudent?.name || "—"}</div>
              <div style={{ fontSize: 10.5, color: P.faint, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>modo {mode} · cambiar · {BUILD}</div>
            </div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "coach" && <Btn kind="ember" small onClick={() => setRosterOpen(true)}><Users size={14} /> Alumnos</Btn>}
            {mode === "coach" && myRoleMeta.manageTeam && <Btn kind="ember" small onClick={() => setEquipoOpen(true)}><Award size={14} /> Equipo</Btn>}
            <div style={{ display: "flex", background: P.s1, border: `1px solid ${P.line}`, borderRadius: 10, padding: 3, gap: 3 }}>
              {[["alumno", "Alumno"], ["coach", "Coach"]].map(([id, l]) => (
                <button key={id} onClick={() => switchMode(id)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: mode === id ? P.s3 : "transparent", color: mode === id ? P.text : P.faint, border: `1px solid ${mode === id ? P.line : "transparent"}` }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <StorageBanner />

        {mode === "alumno" && tab === "hoy" && (
          <TodayTab plan={plan} history={history} active={active} role={mode} goTrain={() => setTab("entrenar")} allowedRoutines={currentStudent && currentStudent.allowedRoutines} />
        )}
        {mode === "alumno" && tab === "agenda" && (
          <CalendarTab plan={plan} history={history} onGoTrain={() => setTab("entrenar")} />
        )}
        {mode === "alumno" && tab === "entrenar" && (
          <TrainTab plan={plan} history={history} active={active} setActive={applyActive} saveActive={saveActive}
            finishSession={finishSession} discardSession={discardSession} onInfo={onInfo} toast={toast} savedAt={savedAt}
            allowedRoutines={currentStudent && currentStudent.allowedRoutines} />
        )}
        {mode === "alumno" && tab === "progreso" && <ProgressTab plan={plan} history={history} saveHistory={saveHistory} />}
        {mode === "alumno" && tab === "nutricion" && <NutritionView n={plan.nutrition} />}
        {mode === "coach" && (tab === "rutina" || tab === "nutricion" || tab === "indicaciones" || tab === "agenda") && roleTabAccess[tab] === "edit" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 14px 0" }}>
            <Btn kind="ember" small onClick={undoPlan} disabled={planHistoryRef.current.past.length === 0}><Undo2 size={14} /> Deshacer</Btn>
            <Btn kind="ember" small onClick={redoPlan} disabled={planHistoryRef.current.future.length === 0}><Redo2 size={14} /> Rehacer</Btn>
            <div style={{ flex: 1 }} />
            <Btn kind="ember" small onClick={() => setConfirmReset(true)}><Trash2 size={13} /> Vaciar plan</Btn>
          </div>
        )}
        {mode === "coach" && tab === "rutina" && (
          <ReadOnlyLock active={roleTabAccess.rutina === "view"} toast={toast}>
            <RoutineTab plan={plan} savePlan={savePlan} onInfo={onInfo} toast={toast} history={history}
              student={currentStudent} onUpdateStudent={(patch) => currentStudent && updateStudent(currentStudent.id, patch)} />
          </ReadOnlyLock>
        )}
        {mode === "coach" && tab === "agenda" && (
          <ReadOnlyLock active={roleTabAccess.agenda === "view"} toast={toast}>
            <ScheduleEditor plan={plan} savePlan={savePlan} />
          </ReadOnlyLock>
        )}
        {mode === "coach" && tab === "nutricion" && (
          <ReadOnlyLock active={roleTabAccess.nutricion === "view"} toast={toast}>
            <NutritionEditor plan={plan} savePlan={savePlan}
              onOpenNutritionAI={() => { setTab("ia"); setAiJumpSub("nutricion"); }} />
          </ReadOnlyLock>
        )}
        {mode === "coach" && tab === "ia" && (
          <ReadOnlyLock active={roleTabAccess.ia === "view"} toast={toast}>
            <AITab plan={plan} savePlan={savePlan} history={history} currentStudent={currentStudent} toast={toast}
              jumpSub={aiJumpSub} onJumpConsumed={() => setAiJumpSub(null)} />
          </ReadOnlyLock>
        )}
        {mode === "coach" && tab === "indicaciones" && (
          <ReadOnlyLock active={roleTabAccess.indicaciones === "view"} toast={toast}>
            <InstructionsEditor plan={plan} savePlan={savePlan} />
          </ReadOnlyLock>
        )}
        {mode === "coach" && tab === "actividad" && <ActivityTab plan={plan} history={history} />}
        {mode === "coach" && tab === "rankings" && (
          <ReadOnlyLock active={roleTabAccess.rankings === "view"} toast={toast}>
            <RankingsTab roster={roster} toast={toast} />
          </ReadOnlyLock>
        )}
        {tab === "timer" && <TimerTab />}
        {tab === "guia" && (
          <div style={{ padding: "18px 16px 30px" }}>
            <h1 style={{ fontSize: 26, textTransform: "uppercase", margin: "4px 0 4px" }}>Guía de términos</h1>
            <div style={{ color: P.dim, fontSize: 15, marginBottom: 6 }}>
              Todo lo que aparece en la rutina, explicado en simple. Durante el entrenamiento también puedes tocar cualquier etiqueta (TOP, B-O, DROP…) para abrir esta guía.
            </div>
            <GlossaryBody showTopButton />
          </div>
        )}
        {tab === "atlas" && <AtlasTab />}
      </div>

      <TabBar tabs={tabs} tab={tab} setTab={setTab} />
      <RosterSheet open={rosterOpen} onClose={() => setRosterOpen(false)} roster={roster} sid={sid}
        onEnter={(m, id) => { setRosterOpen(false); openIdentity(m, id, roster, myTeamId); }}
        onAdd={() => addStudent(false)} onRename={renameStudent} onRemove={(s) => setConfirmDel(s)} />
      <EquipoSheet open={equipoOpen} onClose={() => setEquipoOpen(false)} team={team}
        onAdd={(member) => { const t = { members: [...team.members, member] }; setTeam(t); sSet("forja-team", t); }}
        onChangeRole={(id, role) => { const t = { members: team.members.map((m) => m.id === id ? { ...m, role } : m) }; setTeam(t); sSet("forja-team", t); }}
        onRemove={(m) => { const t = { members: team.members.filter((x) => x.id !== m.id) }; setTeam(t); sSet("forja-team", t);
          if (myTeamId === m.id) setMyTeamId(null); }} />
      <Confirm open={!!confirmDel} danger title="Eliminar alumno"
        body={confirmDel ? `Se borrará ${confirmDel.name} junto con su rutina, historial y progreso. Esta acción no se puede deshacer.` : ""}
        okLabel="Eliminar" onOk={() => removeStudent(confirmDel)} onCancel={() => setConfirmDel(null)} />
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Vaciar plan y volver a empezar">
        <div style={{ color: P.dim, fontSize: 14.5, marginBottom: 14, lineHeight: 1.5 }}>
          Esta acción reemplaza el plan actual. El historial del alumno (sesiones, pesos, fotos) NO se borra. Puedes deshacer con el botón «Deshacer» si te arrepientes.
        </div>
        <Btn kind="ember" onClick={() => { resetPlan(true); setConfirmReset(false); }} style={{ width: "100%", marginBottom: 8 }}>
          <RotateCcw size={15} /> Restaurar plan de ejemplo
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
