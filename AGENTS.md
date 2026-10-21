# AGENTS.md — cómo correr FORJA en el sandbox (Base44)

Notas que no se deducen de los manifiestos. El proyecto es una **PWA estática**:
no hay `package.json` en la raíz ni servidor propio. Netlify publica la raíz del
repo (`publish = "."` en `netlify.toml`) y el bundle se compila a mano con
`scripts/build.sh` (esbuild) y se commitea.

## Arrancar

```sh
docker compose -f docker-compose.base44.yml up -d
```

El preview vive en el puerto **3000**. Servicios:

- `web` — sirve el repo tal cual (con el fallback de SPA de `netlify.toml`),
  proxea `/rest/v1/*` a la base local y recompila al cambiar `src/`.
  Código: `.base44/dev-server.mjs`.
- `api` — base de datos local de pruebas. Responde las MISMAS llamadas REST que
  la app hace a la tabla `forja_kv` de Supabase (`GET ?key=eq.…|like.…&select=…`,
  `POST` con `Prefer: resolution=merge-duplicates`, `DELETE ?key=eq.…`).
  Código: `.base44/kv-service.mjs`; datos en el volumen `forja-kv`.

No hace falta ninguna credencial para que funcione: el dueño entra con la cuenta
que ya es constante en el código. **No se modificó ni una línea de `src/`.**

## Entrar a la app (para verificar)

1. `/` muestra la *landing* pública (aparece una vez por dispositivo,
   `localStorage["forja-landing-seen"]`).
2. "Ya tengo cuenta" → usuario **`javier`** / clave **`1234`** (constante
   `OWNER_HASH` de `src/App.jsx`; `clave: 1234` está comentada ahí mismo) →
   pantalla "Hoy" con la barra inferior.

Comprobación de que la app escribe de verdad (no solo pinta): después de entrar,
la base local queda con `forja-access`, `forja-roster`, `forja-plan:*` y
`forja-history:*`.

```sh
curl -s "http://localhost:3000/rest/v1/forja_kv?select=key"
```

## `config.js` (git-ignorado)

Lo genera `.base44/dev-server.mjs` al arrancar `web`:

- sin `FORJA_SB_URL`/`FORJA_SB_KEY` → apunta a la base local con **URL relativa**
  (`/rest/v1/forja_kv`). Relativa a propósito: el navegador la resuelve contra el
  mismo origen del preview, así no hay host público clavado en ningún archivo ni
  CORS que abrir.
- con esas variables (secretos del usuario) → corre el `scripts/gen-config.js`
  del repo, que valida el formato y calcula el prefijo de localStorage. Si ese
  script falla, el servidor sigue con la base local para no dejar el preview roto
  (y lo avisa por log).

## Editar `src/`

`src/App.jsx` es toda la app. Al guardar, `web` corre `scripts/build.sh` y manda
un reload por SSE (el script inyectado borra la caché del service worker antes de
recargar: en desarrollo `bundle.js` se pide con el mismo `?v=` y el service worker
lo sirve caché-primero, así que sin eso se seguiría viendo la versión vieja).

Ojo con dos cosas:

- Las dependencias del build se instalan al arrancar en el volumen `forja-build`
  (`npm i react react-dom recharts lucide-react esbuild`, la receta que documenta
  `build.sh`; el repo no trae lockfile). Son versiones **actuales**, así que el
  bundle recompilado NO es byte a byte el commiteado: cambian `bundle.js` y los
  nombres de `chunk-*.js`. Para dejar el repo limpio después de una prueba:
  `git checkout -- bundle.js chunk-*.js` (los viejos vuelven) y borrar los nuevos
  que haya dejado el build.
- Un build fallido **no** recarga la pantalla: se sigue viendo la última versión
  buena y el error queda en `docker compose logs web` (también en
  `http://localhost:3000/__base44/status`).

## Lo que NO funciona contra la base local

`src/App.jsx` tiene la URL del proyecto real clavada (`SB_PROJECT`) para las
funciones y el storage, no solo para `forja_kv`. Sin las claves del proyecto real
quedan fuera: **Coach IA** (`forja-ai`), fotos (Supabase Storage), avisos push y
**WHOOP**. El resto (rutinas, sesiones, historial, progreso, nutrición,
progresión) funciona entero.

## Verificación y salud de los servicios

```sh
docker compose -f docker-compose.base44.yml ps          # api y web: healthy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/rest/v1/forja_kv?limit=1"
```

El healthcheck de `web` comprueba las dos mitades (shell de la app y base a
través del proxy) y dice cuál falla.

## Sandbox

`BASE44_PREVIEW_MODE` se pasa al servicio `web`, pero hoy **nada lo usa**: el
servidor es propio y no valida `Host` ni `Origin`, así que no hay allowlist que
extender ni comportamiento que ramificar. Si algún día se agrega un dev server
con allowlist (Vite/Next), ahí sí habrá que gatear el cambio con ese flag.
