# Catálogo de ejercicios

`catalogo-ejercicios.json` (en la raíz del repo) se genera a partir del
dataset [yeivier/exercises-dataset](https://github.com/yeivier/exercises-dataset):
1.324 ejercicios con grupo muscular, equipo e instrucciones paso a paso.

## Regenerarlo

```sh
git clone --depth 1 https://github.com/yeivier/exercises-dataset /tmp/exdata
python3 scripts/catalogo/construir.py /tmp/exdata catalogo-ejercicios.json
```

El archivo generado se commitea: la app lo pide por HTTP cuando hace falta,
así que no hay paso de build en Netlify.

## Los nombres

El dataset trae los nombres solo en inglés (las instrucciones sí vienen en
español). `traducir.py` los pasa a español con un traductor por ranuras:
saca el equipo, encuentra el núcleo del movimiento, declina los adjetivos
según el género del núcleo y arma

    NÚCLEO · músculo · variante · agarre · inclinación · postura · equipo

Cubre ~78 % de los nombres sin dejar palabras sueltas; los que no reconoce
quedan con el nombre en inglés. En los dos casos el nombre original se
guarda en el campo `e`, así que la búsqueda de la app encuentra el
ejercicio escribiendo en cualquiera de los dos idiomas.

## Licencias

- **Datos** (nombres, músculos, equipo, instrucciones): MIT,
  © Hasan Emir Yıldırım. Se copian a `catalogo-ejercicios.json`.
- **Imágenes y GIFs**: © Gym visual — https://gymvisual.com/. **No** se
  copian a este repo: la app las muestra desde el repositorio de origen,
  a 180×180 y con la atribución a la vista, que es lo que exigen sus
  términos. Para reutilizarlas fuera de eso hay que conseguir licencia
  propia en Gym visual.

## Segundo dataset: free-exercise-db (876 ejercicios, `src:"fedb"`)

Se suma con `construir_fedb.py`, aparte de `construir.py` de arriba (no lo
reemplaza — se AÑADE al catálogo existente, sin tocar los 1.323 de
Biblioteca-ejercicios-1). Fuente:
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db),
dominio público (licencia Unlicense, sin restricciones).

```sh
python3 scripts/catalogo/construir_fedb.py \
  /ruta/a/exercises-full.json catalogo-ejercicios.json catalogo-ejercicios.json
```

Diferencias con el dataset de arriba:
- **Fotos fijas, no GIF**: 1-2 fotos por ejercicio (posición inicial y
  final), hoteladas desde el repo de origen a un commit fijo (`FEDB_REF`
  en `App.jsx`, mismo criterio que `CAT_REF`). La app las alterna sola cada
  ~800ms (`StopMotionImg`) para dar un efecto simple de ejecución en
  movimiento, en vez del botón «Ver en movimiento» del GIF clásico.
  3 ejercicios del dataset no traen ninguna foto (`imgN: 0`): caen al
  ícono genérico, igual que cualquier imagen que no carga.
- **Taxonomía adicional**: `lvl` (nivel), `mech` (mecánica: compuesto/
  aislado), `frc` (tipo de fuerza: empuje/tracción/estático) y `cat`
  (categoría: fuerza/estiramiento/pliometría/…) — el dataset clásico no
  trae estos campos, así que quedan vacíos en esos ítems.
- **Nombres**: se traducen con el mismo `traducir.py` (mismo vocabulario
  de gimnasio). Reconoce el nombre completo en ~57 % de los casos; el
  resto queda con una traducción parcial (el núcleo del movimiento
  reconocido + lo que no se entendió, tal cual) — el nombre en inglés
  siempre se guarda en `e`, así que la búsqueda encuentra el ejercicio en
  cualquiera de los dos idiomas.
- **Instrucciones**: quedan en inglés en `p` (el dataset no las trae en
  español y traducir texto libre, a diferencia de nombres/categorías, no
  tiene un traductor por ranuras confiable). Se marcan en la ficha del
  ejercicio como "(en inglés)"; traducirlas de verdad es un trabajo aparte
  (más lento, texto libre) pendiente como mejora futura.
