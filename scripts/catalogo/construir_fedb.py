# -*- coding: utf-8 -*-
"""Transforma exercises-full.json (free-exercise-db, 876 ejercicios) al
esquema del catálogo de FORJA y lo fusiona con catalogo-ejercicios.json.

Fuente: https://github.com/yuhonas/free-exercise-db (dominio público,
licencia Unlicense). Los nombres se pasan por el mismo traductor por
ranuras que ya usa el catálogo (scripts/catalogo/traducir.py) — mismo
vocabulario de gimnasio, mismo criterio. Las instrucciones (paso a paso)
quedan en inglés en esta primera pasada — se traducen aparte.
"""
import json, sys, os, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from traducir import traducir

MUSCULO = {
    "abdominals": "Core", "abductors": "Glúteo", "adductors": "Otro",
    "biceps": "Bíceps", "calves": "Gemelo", "chest": "Pecho",
    "forearms": "Antebrazo", "glutes": "Glúteo", "hamstrings": "Femoral",
    "lats": "Espalda", "lower back": "Espalda", "middle back": "Espalda",
    "neck": "Otro", "quadriceps": "Cuádriceps", "shoulders": "Hombro",
    "traps": "Trapecio", "triceps": "Tríceps",
}
EQUIPO = {
    "barbell": "Barra", "dumbbell": "Mancuernas", "body only": "Peso corporal",
    "cable": "Polea", "machine": "Máquina", "kettlebells": "Kettlebell",
    "bands": "Banda elástica", "e-z curl bar": "Barra EZ",
    "medicine ball": "Balón medicinal", "exercise ball": "Fitball",
    "foam roll": "Rodillo de espuma", "other": "Otro", None: "Otro",
}
NIVEL = {"beginner": "Principiante", "intermediate": "Intermedio", "expert": "Avanzado"}
MECANICA = {"compound": "Compuesto", "isolation": "Aislado", None: ""}
FUERZA = {"push": "Empuje", "pull": "Tracción", "static": "Estático", None: ""}
CATEGORIA = {
    "strength": "Fuerza", "stretching": "Estiramiento", "plyometrics": "Pliometría",
    "powerlifting": "Powerlifting", "olympic weightlifting": "Halterofilia",
    "strongman": "Strongman", "cardio": "Cardio",
}


def construir(origen_json, catalogo_actual, destino):
    datos = json.load(open(origen_json, encoding="utf-8"))
    existentes = json.load(open(catalogo_actual, encoding="utf-8"))
    ejercicios = existentes["ejercicios"]
    ids_ya = {e["i"] for e in ejercicios}

    nuevos = []
    sin_imagen = []
    no_traducidos = 0
    for x in datos:
        principal = MUSCULO.get((x.get("primaryMuscles") or [None])[0], "Otro")
        secundarios = []
        for s in x.get("secondaryMuscles", []):
            m = MUSCULO.get(s)
            if m and m != principal and m not in secundarios:
                secundarios.append(m)
        nombre, ok = traducir(x["name"])
        if not ok:
            no_traducidos += 1
        i = f"fedb/{x['id']}"
        if i in ids_ya:
            i = f"fedb2/{x['id']}"
        n_img = len(x.get("images") or [])
        if n_img == 0:
            sin_imagen.append(x["name"])
        item = {
            "i": i,
            "src": "fedb",
            "fd": x["id"],
            "n": nombre,
            "e": x["name"],
            "mu": principal,
            "eq": EQUIPO.get(x.get("equipment"), "Otro"),
            "lvl": NIVEL.get(x.get("level"), ""),
            "mech": MECANICA.get(x.get("mechanic"), ""),
            "frc": FUERZA.get(x.get("force"), ""),
            "cat": CATEGORIA.get(x.get("category"), ""),
            "imgN": n_img,
            # Instrucciones en inglés por ahora (traducción real de texto
            # libre pendiente, ver scripts/catalogo/traducir-pasos.py);
            # se identifican por `src=="fedb"` para reemplazarlas en su
            # sitio cuando estén traducidas, sin tocar el resto del ítem.
            "p": x.get("instructions") or [],
        }
        if secundarios:
            item["s"] = secundarios
        nuevos.append(item)

    todos = ejercicios + nuevos
    todos.sort(key=lambda z: z["n"].lower())
    salida = {"ejercicios": todos}
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))

    print(f"agregados: {len(nuevos)}")
    print(f"total combinado: {len(todos)}")
    print(f"sin imagen: {len(sin_imagen)} -> {sin_imagen}")
    print(f"nombres no reconocidos del todo por el traductor: {no_traducidos} / {len(nuevos)}")
    print(f"tamaño final: {os.path.getsize(destino)/1024:.0f} KB")


if __name__ == "__main__":
    construir(sys.argv[1], sys.argv[2], sys.argv[3])
