#!/usr/bin/env bash
# Arma ios-wrapper/www con la app web ya compilada (para empaquetarla dentro de la app de iPhone).
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build.sh >/dev/null
node scripts/gen-config.js >/dev/null 2>&1 || true
rm -rf ios-wrapper/www && mkdir -p ios-wrapper/www
cp index.html bundle.js chunk-*.js sw.js manifest.webmanifest ios-wrapper/www/
[ -f config.js ] && cp config.js ios-wrapper/www/ || true
cp -r icons ios-wrapper/www/icons
[ -d privacy ] && cp -r privacy ios-wrapper/www/privacy || true
echo "ios-wrapper/www listo"
