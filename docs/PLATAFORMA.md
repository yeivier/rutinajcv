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
