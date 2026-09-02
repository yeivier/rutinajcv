#!/usr/bin/env sh
# Compila src/ a bundle.js (+ chunk-*.js) en la raíz del repo.
# Requiere un directorio de build con react, react-dom, recharts,
# lucide-react y esbuild instalados (por defecto /tmp/forja-build):
#   mkdir -p /tmp/forja-build && cd /tmp/forja-build && npm i react react-dom recharts lucide-react esbuild
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${FORJA_BUILD_DIR:-/tmp/forja-build}"
mkdir -p "$BUILD/src"
cp "$REPO/src/App.jsx" "$REPO/src/main.jsx" "$BUILD/src/"
# Los trozos llevan hash: los de la versión anterior quedarían huérfanos en el repo.
rm -f "$REPO"/chunk-*.js
cd "$BUILD"
./node_modules/.bin/esbuild src/main.jsx \
  --bundle --minify --format=esm --splitting \
  --jsx=automatic --loader:.jsx=jsx \
  --outdir="$REPO" --entry-names=bundle --chunk-names=chunk-[hash] \
  --legal-comments=none \
  --define:process.env.NODE_ENV='"production"'
ls -la "$REPO"/bundle.js "$REPO"/chunk-*.js
