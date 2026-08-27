// Barrido de humo de toda la app: recorre cada pestaña, cada segmento y
// cada hoja, en los dos roles (alumno y coach) y los dos temas (claro y
// oscuro), y reporta cualquier pantalla que se caiga, quede vacía, tire
// un error de consola o se salga al selector de identidad.
//
// Existe porque los errores que más cuestan acá no son los que rompen la
// compilación —esos los cazan `check-undefined.py` y esbuild— sino los de
// runtime en una pantalla concreta: un prop que no se pasó y revienta al
// montarse. Pasó con `toast` en la Agenda del coach, que se caía entera.
//
// Cómo correrlo:
//   python3 -m http.server 8971 --bind 127.0.0.1 &
//   FORJA_PW=/ruta/a/playwright-core node scripts/barrido.js
// Variables: FORJA_PW (módulo playwright), FORJA_CHROMIUM (ejecutable),
// FORJA_URL (dónde está servida la app), FORJA_OUT (dónde deja capturas).
//
// Nota sobre los selectores: `has-text` de Playwright es subcadena e
// insensible a mayúsculas, así que "IA" engancha "cambiar" (camb-ia-r).
// Por eso los segmentos se buscan por nombre EXACTO.

const { chromium } = require(process.env.FORJA_PW || 'playwright-core');
const EXE = process.env.FORJA_CHROMIUM || '/opt/pw-browsers/chromium';
const BASE = process.env.FORJA_URL || 'http://localhost:8971/index.html';
const DIR = process.env.FORJA_OUT || require('os').tmpdir();

const seed = (theme) => {
  const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
  localStorage.setItem('forja-theme', theme);
  localStorage.setItem('fjkv:forja-roster', JSON.stringify({ v: 1, students: [
    { id: 's1', name: 'Javier', createdAt: iso(200) }, { id: 's2', name: 'Lucía', createdAt: iso(120) },
  ] }));
  const mk = (id, name, muscle, n) => ({ id, name, muscle, rest: 90, sets: Array.from({ length: n }, (_, i) => ({ id: id + i, type: i === 0 ? 'warmup' : 'normal', repsT: '8-10', rirT: '2' })) });
  localStorage.setItem('fjkv:forja-plan:s1', JSON.stringify({
    days: [
      { id: 'd1', name: 'Empuje', routine: 'A', exs: [mk('e1', 'Press banca', 'Pecho', 3), mk('e2', 'Press militar', 'Hombro', 3)] },
      { id: 'd2', name: 'Tirón', routine: 'A', exs: [mk('e4', 'Remo', 'Espalda', 3)] },
    ],
    routineNames: {},
    nutrition: { kcal: 2600, p: 180, c: 260, f: 80, solve: 'kcal', notes: 'Bebe agua.',
      meals: [{ id: 'm1', name: 'Desayuno', time: '08:00', kcal: 620, items: [{ id: 'i1', food: 'Avena', qty: '80 g' }], notes: '' }],
      supplements: [{ id: 'sp1', name: 'Creatina', dose: '5 g', when: '', group: 'diario' }] },
    instructions: [{ id: 'in1', title: 'Cardio', body: '30 min, 3 veces por semana.' }],
    schedule: { mon: 'd1', wed: 'd2' }, events: [], athlete: { doctor: 'Dr. Herrera' }, mesoState: null, updatedAt: iso(0),
  }));
  const set = (w, r) => ({ done: true, type: 'normal', weight: String(w), reps: String(r), rir: '2' });
  localStorage.setItem('fjkv:forja-history:s1', JSON.stringify({
    byEx: { e1: [
      { date: iso(14), dayName: 'Empuje', exName: 'Press banca', sets: [set(75, 8), set(75, 8)] },
      { date: iso(7), dayName: 'Empuje', exName: 'Press banca', sets: [set(80, 8), set(80, 7)] },
    ] },
    sessions: [{ id: 'x1', date: iso(7), dayName: 'Empuje', prs: ['Press banca: 80 kg'], durationMin: 58 }],
    bodyweight: [{ date: iso(14), kg: 79.2 }, { date: iso(0), kg: 78.4 }],
    steps: [{ date: iso(0), count: 9482 }], water: [{ date: iso(0), liters: 2.4 }], sleep: [{ date: iso(0), hours: 7.4 }],
    measurements: [{ date: iso(20), values: { pecho: 104 } }], bodyPhotos: [],
    mealChecks: { [new Date().toISOString().slice(0, 10)]: { m1: true } },
    supplementChecks: {},
    labs: [{ id: 'l1', date: iso(12), requestedBy: 'Dr. Herrera', values: { hemoglobina: 17.2, ldl: 148, hdl: 32, glucosa: 92, vitd: 28 } }],
  }));
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  let fallos = 0, visitadas = 0;
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
    await page.addInitScript(seed, theme);
    await page.goto(BASE);
    await page.waitForTimeout(2200);
    await page.locator('text="Javier"').first().click();
    // Esperar a que la barra de pestañas exista de verdad: si se toca
    // antes, el primer clic cae en el vacío y el barrido reporta un
    // fallo que es de arranque, no de la app.
    await page.locator('[data-tabbar] button').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);

    const check = async (label) => {
      visitadas++;
      const antes = errs.length;
      await page.waitForTimeout(450);
      const crash = await page.locator('text=/FORJA crash|Algo salió mal/i').count();
      // Caerse al selector de identidad es una salida no pedida: se
      // reporta como fallo, no se pasa por alto.
      if (await page.locator('text="¿Quién entra?"').count()) {
        fallos++;
        console.log(`  ✗ [${theme}] ${label} → volvió al selector "¿Quién entra?"`);
        return;
      }
      const vacio = await page.evaluate(() => (document.body.innerText || '').trim().length < 40);
      const nuevos = errs.slice(antes);
      if (crash || vacio || nuevos.length) {
        fallos++;
        console.log(`  ✗ [${theme}] ${label}${crash ? ' → CRASH' : ''}${vacio ? ' → PANTALLA VACÍA' : ''}${nuevos.length ? ' → ' + nuevos.join(' | ') : ''}`);
      }
    };
    const tab = async (name) => {
      const l = page.locator('[data-tabbar] button', { hasText: name }).first();
      if (!(await l.count())) {
        fallos++;
        const hay = await page.locator('[data-tabbar] button').allInnerTexts();
        console.log(`  ✗ [${theme}] no existe la pestaña "${name}" — la barra tiene ${JSON.stringify(hay)}`);
        await page.screenshot({ path: `${DIR}/barrido_falla_${theme}_${name}.png` });
        return false;
      }
      await l.click({ timeout: 5000 }).catch(async () => {
        fallos++;
        console.log(`  ✗ [${theme}] la pestaña "${name}" existe pero no se puede tocar (¿algo la tapa?)`);
        await page.screenshot({ path: `${DIR}/barrido_falla_${theme}_${name}.png` });
      });
      await page.waitForTimeout(600);
      return true;
    };
    // Nombre EXACTO: `has-text` es subcadena e insensible a mayúsculas, y
    // "IA" engancha "cambiar" (camb-ia-r) del encabezado de identidad.
    const seg = async (name) => {
      const l = page.getByRole('button', { name, exact: true }).first();
      if (await l.count()) { await l.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500); }
      else console.log(`  ? [${theme}] sin segmento "${name}"`);
    };
    const sheet = async (name) => {
      await page.locator('[data-tabbar] button', { hasText: 'Más' }).first().click();
      await page.waitForTimeout(500);
      const l = page.getByRole('button', { name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
      if (!(await l.count())) { console.log(`  ? [${theme}] no encontré "${name}"`); return; }
      await l.click(); await page.waitForTimeout(700); await check('hoja ' + name);
      // Las hojas se cierran tocando el fondo oscuro de arriba.
      await page.mouse.click(195, 14);
      await page.waitForTimeout(500);
      if (await page.locator('.sheetIn').count()) { await page.mouse.click(195, 6); await page.waitForTimeout(400); }
    };

    console.log(`--- ALUMNO (${theme}) ---`);
    for (const t of ['Inicio', 'Progreso', 'Nutrición', 'Más']) { await tab(t); await check('pestaña ' + t); }
    await tab('Progreso');
    for (const sg of ['Fuerza', 'Cuerpo', 'Volumen', 'Logros']) { await seg(sg); await check('Progreso · ' + sg); }
    await tab('Más');
    for (const sh of ['Check-in', 'Posing', 'Competition Prep', 'Comparar fotos', 'Suplementación', 'Analítica', 'Ejercicios', 'Guía de términos']) await sheet(sh);
    await tab('Entrenar'); await check('pestaña Entrenar');

    console.log(`--- COACH (${theme}) ---`);
    await page.mouse.click(195, 8); await page.waitForTimeout(400);
    await page.locator('[data-tabbar] button', { hasText: 'Inicio' }).first().click(); await page.waitForTimeout(600);
    await page.locator('text=/cambiar/i').first().click(); await page.waitForTimeout(900);
    await page.locator('text="Coach"').first().click();
    await page.locator('[data-tabbar] button').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    for (const t of ['Panel', 'Atletas', 'Rutinas', 'Mensajes', 'Más']) { await tab(t); await check('pestaña ' + t); }
    await tab('Atletas');
    for (const sg of ['Actividad', 'Rankings', 'Cobros', 'Leads']) { await seg(sg); await check('Atletas · ' + sg); }
    await tab('Rutinas');
    for (const sg of ['Rutina', 'Borradores', 'Nutrición', 'IA']) { await seg(sg); await check('Rutinas · ' + sg); }
    // Comparador de rutinas: capa a pantalla completa, se cierra con la X
    await seg('Rutina');
    {
      const b = page.getByRole('button', { name: /^Comparar rutinas$/ }).first();
      if (await b.count()) {
        await b.click(); await page.waitForTimeout(700); await check('Comparar rutinas');
        // Detalle: los ejercicios que hay detrás del número de un grupo
        const grupo = page.getByRole('button', { name: /^Ver los ejercicios de / }).first();
        if (await grupo.count()) {
          await grupo.click(); await page.waitForTimeout(600); await check('Comparar rutinas · ejercicios del grupo');
          await page.getByRole('button', { name: 'Volver a los grupos musculares' }).first().click(); await page.waitForTimeout(400);
        }
        await page.getByRole('button', { name: 'Cerrar' }).first().click(); await page.waitForTimeout(500);
      } else console.log(`  ? [${theme}] no encontré "Comparar rutinas"`);
    }
    await tab('Mensajes');
    for (const sg of ['Chat', 'Indicaciones']) { await seg(sg); await check('Mensajes · ' + sg); }
    await tab('Más');
    await seg('Agenda'); await check('Agenda');
    for (const sg of ['Semana', 'Mes', 'Temporada']) { await seg(sg); await check('Agenda · ' + sg); }
    await page.screenshot({ path: `${DIR}/barrido_${theme}.png` });
    await page.close();
  }
  console.log(`\n${visitadas} pantallas visitadas · ${fallos} con problemas`);
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();
