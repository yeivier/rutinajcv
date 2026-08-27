# -*- coding: utf-8 -*-
"""Arma el catálogo de FORJA a partir de yeivier/exercises-dataset."""
import json, sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from traducir import traducir

# target/muscle del dataset → grupo muscular de FORJA (MUSCLES)
MUSCULO = {
    "pectorals": "Pecho", "serratus anterior": "Pecho",
    "lats": "Espalda", "upper back": "Espalda", "spine": "Espalda",
    "delts": "Hombro",
    "biceps": "Bíceps", "triceps": "Tríceps",
    "quads": "Cuádriceps", "hamstrings": "Femoral",
    "glutes": "Glúteo", "calves": "Gemelo",
    "abs": "Core", "forearms": "Antebrazo",
    "traps": "Trapecio", "levator scapulae": "Trapecio",
    "adductors": "Otro", "abductors": "Otro", "cardiovascular system": "Otro",
}
# equipment del dataset → EQUIPMENT de FORJA
EQUIPO = {
    "barbell": "Barra", "olympic barbell": "Barra", "trap bar": "Barra",
    "ez barbell": "Barra EZ",
    "dumbbell": "Mancuernas",
    "leverage machine": "Máquina", "sled machine": "Máquina", "smith machine": "Smith",
    "stepmill machine": "Máquina", "elliptical machine": "Máquina",
    "skierg machine": "Máquina", "upper body ergometer": "Máquina", "stationary bike": "Máquina",
    "cable": "Polea",
    "body weight": "Peso corporal", "assisted": "Peso corporal", "weighted": "Peso corporal",
    "kettlebell": "Kettlebell",
    "band": "Banda elástica", "resistance band": "Banda elástica",
}

def construir(origen, destino):
    datos = json.load(open(os.path.join(origen, "data", "exercises.json"), encoding="utf-8"))
    fuera = []
    for x in datos:
        principal = MUSCULO.get(x["target"], "Otro")
        secundarios = []
        for s in x.get("secondary_muscles", []):
            m = MUSCULO.get(s)
            if m and m != principal and m not in secundarios:
                secundarios.append(m)
        nombre, _ = traducir(x["name"])
        pasos = (x.get("instruction_steps", {}) or {}).get("es") or []
        fuera.append({
            "i": x["id"],
            "m": x["media_id"],
            "n": nombre,
            "e": x["name"],
            "mu": principal,
            "eq": EQUIPO.get(x["equipment"], "Otro"),
            **({"s": secundarios} if secundarios else {}),
            **({"p": pasos} if pasos else {}),
        })
    fuera.sort(key=lambda z: z["n"].lower())
    catalogo = {
        "version": 1,
        "fuente": "https://github.com/yeivier/exercises-dataset",
        "atribucion": "© Gym visual — https://gymvisual.com/",
        "nota": ("Datos bajo licencia MIT (© Hasan Emir Yıldırım). Las imágenes son "
                 "© Gym visual y se muestran desde el repositorio de origen, a 180×180 "
                 "y con la atribución a la vista, como exigen sus términos."),
        "ejercicios": fuera,
    }
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(catalogo, f, ensure_ascii=False, separators=(",", ":"))
    return len(fuera)

if __name__ == "__main__":
    n = construir(sys.argv[1], sys.argv[2])
    print(f"{n} ejercicios → {sys.argv[2]} ({os.path.getsize(sys.argv[2])/1024:.0f} KB)")
