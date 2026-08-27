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
