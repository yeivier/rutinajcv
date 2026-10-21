# Imagen del sandbox de Base44 — NO es la imagen de despliegue del sitio.
#
# El repo no tiene package.json propio: el sitio se publica tal cual
# (netlify.toml: publish = ".") y scripts/build.sh compila src/ con esbuild
# usando un directorio de build externo. Acá las dependencias del build viven
# SOLO en esta imagen, así el repo no necesita un manifiesto nuevo y el árbol
# de trabajo queda igual al de producción.
#
# /node_modules es un enlace a las dependencias de la imagen para que el
# servidor de desarrollo (montado desde el repo) pueda importar esbuild.
FROM node:22

WORKDIR /app
RUN npm install --no-audit --no-fund --loglevel=error \
      react react-dom recharts lucide-react esbuild \
 && ln -s /app/node_modules /node_modules

CMD ["node", "/repo/.base44/dev-server.mjs"]
