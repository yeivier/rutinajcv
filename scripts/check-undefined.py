import re, sys
src = open("src/App.jsx", encoding="utf-8").read()
# declaraciones: sobre el fuente crudo (no vaya a ser que un /* */ se coma una línea real)
declared = set(re.findall(r'^\s*(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', src, re.M))
# nombres que salen de una desestructuración (const [R, setR] = useState…, const { X } = …)
for m in re.finditer(r'^\s*(?:const|let|var)\s*[\[{]([^\]}=]*)[\]}]', src, re.M):
    for part in m.group(1).split(','):
        n = part.split(':')[-1].split('=')[0].strip()
        if re.fullmatch(r'[A-Za-z_$][\w$]*', n): declared.add(n)
for m in re.finditer(r'import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from', src, re.S):
    if m.group(1): declared.add(m.group(1))
    if m.group(2):
        for part in m.group(2).split(','):
            n = part.split(' as ')[-1].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', n): declared.add(n)
# usos: sobre el fuente sin comentarios
nc = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
nc = re.sub(r'^\s*//.*$', '', nc, flags=re.M)
BUILTIN = {'React','Fragment','Math','JSON','Object','Array','Date','Promise','Set','Map','Image','Audio'}
tags = {t.split('.')[0] for t in re.findall(r'<([A-Z][\w$.]*)', nc)}
# variables locales en mayúscula (const Foo = ... dentro de una función) ya entran por el regex de arriba
missing = sorted(t for t in tags if t not in declared and t not in BUILTIN)
if missing:
    print("COMPONENTES JSX SIN DEFINIR:", missing)
    for m in missing:
        for i, l in enumerate(nc.split("\n"), 1):
            if re.search(r'<'+re.escape(m)+r'\b', l): print(f"   src/App.jsx:{i}: {l.strip()[:100]}"); break
    sys.exit(1)
print(f"OK — {len(tags)} componentes JSX usados, todos declarados o importados")

# Uso: python3 scripts/check-undefined.py  (desde la raíz del repo)
#
# Por qué existe: esbuild NO avisa cuando un componente JSX no está
# definido — no es un error de compilación, es un ReferenceError que
# recién aparece cuando el usuario abre esa pantalla. Al borrar la
# pantalla vieja de focus mode se fue con ella HoldToExitButton, que la
# pantalla nueva sí usaba, y el bundle compiló igual: la app crasheaba
# al entrar a entrenar. Este chequeo compara cada <Componente/> usado
# contra lo declarado o importado en el archivo. Correr siempre antes
# de compilar, sobre todo después de borrar código.
