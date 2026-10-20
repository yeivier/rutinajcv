# FORJA — guía de la plataforma (para personas y para IAs)

PWA de entrenamiento (musculación / bodybuilding) con dos modos en la misma app:
**Atleta (alumno)** y **Coach**. Repo: `yeivier/rutinajcv`. Idioma de la interfaz: español.

## Reglas de trabajo del dueño (ver `CLAUDE.md`)
- Todo cambio de interfaz aplica a **ambos modos** (atleta y coach); revisar las dos vistas.
- Estilo: radicalmente minimalista, íconos antes que texto, sin sombras ni degradados decorativos, negro plano, mismos colores y temas.
- Cada entrega: subir `BUILD` en `src/App.jsx` (constante `BUILD = "vNNN"`) y `?v=` de `bundle.js` en `index.html`; PR y squash-merge a `main` (Netlify despliega `main`).

## Stack y estructura
| Pieza | Qué es |
|---|---|
| `src/App.jsx` (~33 000 líneas) | **Toda** la app React en un solo archivo (componentes, estado, estilos, lógica) |
| `src/main.jsx` | Punto de entrada |
| `scripts/build.sh` | Compila con esbuild a `bundle.js` + `chunk-*.js` en la raíz (requiere `react react-dom recharts lucide-react esbuild` en `/tmp/forja-build`) |
| `index.html`, `sw.js`, `manifest.webmanifest` | Shell PWA, service worker y caché (hay un flag de limpieza de caché `var V` en `index.html`) |
| `netlify.toml`, `scripts/gen-config.js` | Despliegue en Netlify (SPA con redirect a `/index.html`) |
| `supabase/` | Edge Functions (`whoop`) y migraciones SQL |
| `catalogo-ejercicios.json`, `scripts/catalogo/` | Catálogo de ~1.300 ejercicios (nombres, músculo, equipo, imágenes) |
| `garmin/forja-watch` | App de reloj Garmin (publica rutina y trae registros) |
| `privacy/` | Página de privacidad (requerida por WHOOP) |
| `docs/` | Documentación (este archivo) |

Librerías: React, Recharts, lucide-react (íconos). Fuentes: Archivo y Geist Mono (Google Fonts).

## Datos y backend
- **Supabase**: tabla clave-valor `forja_kv` vía REST (`sGet`/`sSet`/`sDel` en `App.jsx`). Claves principales por alumno:
  `forja-plan:<id>` (rutinas, nutrición, datos del atleta, mesociclo), `forja-history:<id>` (sesiones, `byEx` por ejercicio, peso corporal, fotos, medidas, sueño, etc.), `forja-active:<id>` (sesión en curso), más `forja-roster` (alumnos), `forja-library` (biblioteca del coach), `forja-chat`, `forja-bookings`, `forja-payments`, `forja-team`, `forja-access`.
- **Edge Functions** (`/functions/v1/...`): `forja-ai` (Coach IA), `forja-rest-push` (avisos de descanso), `whoop` (OAuth + sincronización WHOOP; requiere el secreto `WHOOP_CLIENT_SECRET` en Supabase).
- Login por usuario/clave de la app; el coach puede "entrar como" un atleta. Hay delegados (sin modo coach) y equipos.
- Almacenamiento local: `localStorage` para preferencias (tema, descanso elegido, etc.).

## Modelos de datos clave
- **Plan**: `days[]` → `exs[]` (ejercicio: `id, name, muscle, equipment, rest, notes, sets[]`); cada serie: `type` (`normal`, `warmup`, `top`, `drop`, …), `repsT`/`rirT` (objetivos), `weight`, `reps`, `rir`, `done`, `comment`, `attachIds`, `drops[]`.
- **Sesión en curso** (`active`): copia editable del día con `gym`, `startedAt`, ejercicios y series; se guarda sola.
- **Historial**: al terminar, cada ejercicio guarda una entrada en `history.byEx[exId]` (`sessionId, date, sets, comment, attachIds`) y la sesión en `history.sessions[]` (`gym, durationMin, volume, setsDone, prs, exs`). Pesos siempre en kg.

## IA de la plataforma
- **Una sola puerta**: toda llamada va a la Edge Function `forja-ai` (`supabase/functions/forja-ai/index.ts`). Con clave de Anthropic (secreto `ANTHROPIC_API_KEY` en Supabase, o fila `provider='anthropic'` en `forja_ai_secrets`) usa Claude; sin clave, o si falla, cae a la cadena gratuita (Gemini → Groq → OpenRouter → Pollinations). La app nunca guarda ni envía la clave.
- **Niveles de modelo** (`tier` en la petición): `fast` (memoria y tareas cortas), `default` (chat del alumno y del coach) y `deep` (análisis del equipo). Los modelos se pueden cambiar con `FORJA_MODEL_FAST/DEFAULT/DEEP`.
- **Base de conocimiento (RAG)**: tabla `forja_kb` (título, contenido, fuente, evidencia, `reviewed`). Antes de cada respuesta la función busca las entradas relevantes (`forja_kb_search`, prioriza las revisadas) y las inyecta con prioridad sobre la memoria del modelo. La semilla está en `supabase/migrations/20261101000001_forja_kb_seed.sql`; el coach la edita en la tabla y marca `reviewed=true` al validar cada criterio.
- **Contexto por pregunta**: ficha, rutina, volumen, historial, nutrición, resumen de la sesión abierta, estado de recuperación de hoy, tendencias de 7 días (peso, sueño, recuperación, pasos), adherencia y la progresión calculada por la app para el próximo día.
- **Memoria por atleta** (`forja-aimem:<id>`): hechos duraderos (lesiones, preferencias, objetivos) destilados cada 6 preguntas y al reiniciar la conversación; el atleta la ve y la edita desde el ícono de nota del chat.
- **Propuestas con aprobación**: la IA del alumno no cambia nada; si hay un cambio justificado emite un bloque `forja-propuesta` que se guarda en `forja-proposals:<id>`. El coach las decide en Atletas › Progresión › Propuestas: aprobar aplica series ±1, reemplazo o nota al plan del alumno (el tipo "otro" se aplica a mano).
- **Análisis de equipo**: Atletas › Progresión › IA envía un resumen numérico con alias (A1…An, sin nombres) al nivel `deep` y devuelve estado (ok / atención / riesgo), motivo y acción por atleta.
- **Sustancias**: la IA programa entrenamiento y nutrición también para atletas asistidos y explica riesgos y controles médicos, pero no receta ni dosifica (política única `AI_SUBSTANCES_POLICY`).
- **Evaluación**: `docs/ia-evals.json` (30 preguntas con criterios de acierto) y `FORJA_SB_KEY=<anon key> node scripts/eval-ai.js [categoría]` para medir el % de aciertos antes y después de cambiar modelo, prompt o base de conocimiento.

## Pantallas — Modo Atleta (barra inferior)
- **Hoy**: resumen, tira de semana, fichas con gráficos táctiles (volumen, sesiones, sueño…), check-in, acceso al Coach IA y a Competition Prep.
- **Entrenar**: lista de rutinas colapsadas, "Siguiente" con botón Empezar, elección de sede. **Sesión en vivo** (`FocusModeMono`): tabla por ejercicio con columnas `# / ANTES / KG / REPS / RIR`, comentario por serie y por ejercicio, deslizar una serie a la izquierda para eliminarla, agregar/quitar serie, **reemplazar ejercicio** por uno equivalente conservando las series, franja de historial (progresó / igual / bajó / estancado), temporizador de descanso (presets 60/90/120/180 s), modo Focus (una serie a la vez), herramientas (conversor kg↔lb, RM), barra "Entreno en curso" para salir y volver.
- **Progreso**: Fuerza (gráfico por ejercicio, e1RM), actividad por sesión/ejercicio/sede, historial completo con comentarios y adjuntos, fotos y medidas.
- **Nutrición**: objetivos, comidas, suplementos, MyFitnessPal.
- **Más**: perfil, ajustes, dispositivos (WHOOP, Garmin), Competition Prep (categoría elegible + peak week), Atlas de ejercicios, laboratorios, exámenes, guía de términos, cambiar a Coach.

### Progresión automática (`sugerirProgresion` en `App.jsx`)
Al iniciar una sesión, cada ejercicio con historial recibe el peso y las reps a buscar hoy (peso precargado y editable; reps como meta en gris; RIR objetivo de la rutina). Doble progresión con autorregulación por RIR, determinista y con **valores exactos** (sin redondear a discos): sube carga (2,5 % tren superior / 5 % inferior, doble si el RIR superó al objetivo en 2+) cuando todas las series llegan al tope del rango; si no, mantiene carga y busca +1 rep (0 si llegó al fallo); −5 % tras dos sesiones bajo el piso; −5/−10 % tras 3–5 semanas sin hacerlo; −10 % en descarga; −5 % si hay estancamiento. Cada tipo de serie usa su propia referencia: top set, back-off (conserva su proporción respecto al top), drop / rest-pause / cluster (las partes extra conservan proporción de carga y reps), AMRAP y protocolos. Superseries: cada ejercicio miembro por separado. Sin historial: botón "anota la última vez" que guarda un registro a mano (`manual: true`) y calcula la sugerencia. El peso sugerido que no se toca no se guarda. Coach: Atletas › Progresión › Sugerencias lista la sugerencia de todos los ejercicios de todos los atletas.

## Pantallas — Modo Coach (barra inferior)
- **Panel**: tarjetas con métricas del equipo (sesiones, volumen, adherencia) y detalle.
- **Atletas**: Actividad (lista el roster **y los perfiles con acceso**, p. ej. Connie; tocar al atleta abre su actividad/historial con comentarios; ícono de pesa = "Entrar como atleta" con acceso completo sin restricción de rutinas; ícono de ajustes = "Gestionar" como coach), Progresión (Estado / Sugerencias), Rankings, Cobros, Leads.
- **Rutinas**: editor de rutinas/días/ejercicios, biblioteca, periodización/mesociclos.
- **Mensajes**: chat con atletas.
- **Más**: equipo y accesos, ajustes, Atlas, comparador, cambiar a Atleta.
- Atajo: **doble toque en el avatar** (arriba a la derecha) alterna Atleta ↔ Coach; un toque abre "Más".

## Sistema visual
Paletas mutables `P` (claro / oscuro / rosa) con acento seleccionable; sesión usa la paleta `SES`. Tarjetas con borde fino (sin sombra), etiquetas mono en mayúscula (`.mono`), tab bar plana. Radios: `R_CARD`, `R_TILE`, `R_ROW`.

## Cómo compilar y probar
```bash
mkdir -p /tmp/forja-build && cd /tmp/forja-build && npm i react react-dom recharts lucide-react esbuild playwright-core
bash scripts/build.sh            # genera bundle.js + chunks
python3 -m http.server 8971      # servir la raíz y abrir http://localhost:8971/index.html
```
Para pruebas automatizadas se usó Playwright con las rutas de Supabase simuladas (`forja_kv`).

## Cómo dárselo a otra IA
1. Dale acceso de **lectura** al repo `yeivier/rutinajcv` (GitHub) o pega este archivo (`docs/PLATAFORMA.md`) como contexto inicial.
2. Como `src/App.jsx` es enorme, pídele que lo recorra por **búsquedas** (nombres de componentes: `FocusModeMono`, `TrainTab`, `ProgressTabMono`, `AtletasActividadTab`, `DashboardTabMono`, `RoutineTab`, `NutritionView`, `MoreSheet`, `CompetitionPrepSheet`, `ReemplazarEjSheet`) en vez de leerlo entero.
3. Nunca compartas claves: el secreto de WHOOP, las claves de Supabase con permisos de escritura y la clave del Coach IA viven en los secretos de Supabase / ajustes de la app, no en el código.

## IA al día y marco de decisión (v434)
- **forja-research** (edge function, cron cada 6 horas, lotes de hasta 12 candidatos): busca en PubMed metaanálisis, revisiones y ensayos nuevos sobre hipertrofia, volumen, proteína/creatina, recuperación y preparación de físico, y artículos recientes de Stronger By Science, Menno Henselmans y Renaissance Periodization. Un LLM los resume en español (sin enlaces ni HTML); se guardan en `forja_kb` como **no revisados** (`[Estudio reciente]` / `[Artículo reciente]`) y en el feed `forja-science-feed`, que se ve en Más › Ciencia al día. Lo descartado por poco relevante queda en `forja-research-seen`.
- **forja-ai v6**: la base de conocimiento se inyecta como *datos* (no instrucciones) y las novedades se citan con su nivel de evidencia sin cambiar recomendaciones consolidadas.
- **Marco de decisión** (`COACH_DECISION_FRAMEWORK`) y **señales calculadas** (`senalesDeDecision`: tendencia de peso, adherencia, volumen bajo MEV/sobre MRV, puntos débiles del último análisis de físico, cuenta atrás de competencia) en los prompts del coach y del alumno.
