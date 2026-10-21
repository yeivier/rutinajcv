# FORJA — notas de entorno (sandbox de Base44)

Reglas de trabajo del dueño: ver `CLAUDE.md` (estilo, ramas, PR, subir `BUILD` y `?v=`).

## Cómo se ejecuta este repo

Es un **sitio estático**: no hay servidor ni `package.json` en la raíz. Netlify publica
el repo tal cual (`netlify.toml`: `publish = "."`), así que lo que se despliega es
`index.html` + el `bundle.js` **ya compilado y commiteado**. El único manifiesto del
repo es `ios-wrapper/package.json` (wrapper Capacitor), que no tiene `start` — por eso
un arranque genérico tipo `npm start` no puede levantar nada: el sandbox usa
`docker-compose.base44.yml`.

- `docker-compose.base44.yml` levanta `.base44/Dockerfile` (node:22 con react, react-dom,
  recharts, lucide-react y esbuild) y corre `.base44/dev-server.mjs`, que sirve el repo
  en el puerto 3000 y **recompila `src/` con esbuild** (las mismas opciones de
  `scripts/build.sh`) cada vez que cambia `src/App.jsx` o `src/main.jsx`.
- El bundle del sandbox se escribe en `/tmp/forja-dev-out` (dentro del contenedor) y se
  sirve desde ahí: así ningún rebuild ensucia el árbol de trabajo, que debe quedar
  igual al de producción.
- Las dependencias del build viven **solo en la imagen** (`/app/node_modules`, con un
  enlace `/node_modules` para que el servidor montado desde el repo pueda importar
  esbuild). Si cambian, hay que reconstruir la imagen:
  `docker compose -f docker-compose.base44.yml up -d --build`.

## Cosas que no son obvias

- **`config.js` está en `.gitignore`** y lo genera `scripts/gen-config.js` en cada
  despliegue (Netlify lo corre como build command). Sin él, `index.html` recibe el
  fallback a `index.html` en vez de JS y tira un error de sintaxis en consola. El
  servidor de desarrollo lo genera al arrancar y, si faltara, sirve `null`.
- **`bundle.js` es un artefacto commiteado**: un cambio en `src/App.jsx` no se ve en
  ningún lado hasta recompilar (`scripts/build.sh`, o el sandbox automáticamente). Por
  eso `scripts/check-version.py` exige que `BUILD` en `App.jsx` y el `?v=` de
  `index.html` coincidan, y `scripts/check-undefined.py` (esbuild no avisa de un
  componente JSX inexistente) se corre antes de compilar.
- Las dependencias del bundle se instalan sin versión fija, así que un rebuild puede dar
  bytes distintos a los de `bundle.js` commiteado (mismos nombres de trozo distintos).
  No es un error; el sitio desplegado sigue siendo el que está en el repo.

## Solo en el sandbox (`BASE44_PREVIEW_MODE=1`)

El servidor de desarrollo cambia dos cosas, y solo cuando la bandera vale exactamente
`"1"` (sin la variable, o con otro valor, se comporta como producción):

- **`sw.js` se sirve vacío**: el service worker real guarda `/bundle.js` con estrategia
  cache-first (es inmutable por `?v=`, ver `netlify.toml`), así que en un servidor de
  desarrollo seguiría entregando el bundle viejo y no se vería ningún cambio.
- **Se inyecta una recarga automática** (EventSource → `/__base44_reload`) al final de
  `index.html`, para que el navegador se refresque cuando termina la recompilación.

## Verificar que anda

```sh
docker compose -f docker-compose.base44.yml ps                      # web: healthy
curl -s localhost:3000/__base44_status                              # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/bundle.js    # 200
python3 scripts/check-version.py                                    # versión coherente
python3 scripts/check-undefined.py                                  # sin componentes sueltos
```

El healthcheck del contenedor comprueba las dos mitades (el HTML se sirve **y** el bundle
compila), y `/__base44_status` devuelve el error de esbuild en texto si la compilación
falla.
