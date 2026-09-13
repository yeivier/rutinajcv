#!/usr/bin/env python3
"""Verifica que BUILD en App.jsx y el ?v= del <script> coincidan.

Si se desincronizan, el navegador sirve el bundle viejo desde caché
mientras la app cree estar corriendo la versión nueva — el peor tipo de
bug: invisible en el build, visible solo en el teléfono de alguien. Se
bumpean a mano en cada versión, así que conviene que lo revise una
máquina y no la memoria."""
import re, sys, pathlib
raiz = pathlib.Path(__file__).resolve().parent.parent
app = (raiz / "src/App.jsx").read_text(encoding="utf-8")
html = (raiz / "index.html").read_text(encoding="utf-8")
build = re.search(r'const BUILD = "v(\d+)"', app)
script = re.search(r'<script type="module" src="/bundle\.js\?v=(\d+)"', html)
faltan = [n for n, m in (("BUILD de App.jsx", build), ("<script>", script)) if not m]
if faltan:
    print("NO ENCONTRÉ la versión en:", ", ".join(faltan)); sys.exit(1)
vs = {"BUILD de App.jsx": build.group(1), "<script>": script.group(1)}
if len(set(vs.values())) != 1:
    print("VERSIONES DESINCRONIZADAS — se serviría el bundle viejo desde caché:")
    for k, v in vs.items(): print(f"   {k}: v{v}")
    sys.exit(1)
print(f"OK — versión v{build.group(1)} coherente entre App.jsx y el <script>")
