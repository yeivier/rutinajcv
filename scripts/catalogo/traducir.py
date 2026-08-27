# -*- coding: utf-8 -*-
"""Nombres de ejercicio, de inglés a español.

Los nombres del dataset son formulaicos: [equipo] [modificadores] NÚCLEO.
En inglés el núcleo va al final y los modificadores delante; en español es
al revés. Además los adjetivos concuerdan con el núcleo, así que cada
núcleo declara su género y número y cada adjetivo se declina.

El resultado se arma por RANURAS, siempre en el mismo orden, para que dos
ejercicios parecidos se lean parecido:

    NÚCLEO · músculo · variante · agarre · inclinación · postura · equipo

No es una traducción literaria: es un nombre de catálogo, y la meta es que
un entrenador lo reconozca de un vistazo. El nombre original en inglés se
guarda igual junto al ejercicio, para buscar por cualquiera de los dos.
"""
import re

# ---------------------------------------------------------------- núcleos
# (frase en inglés, español, género, número). Orden = prioridad: la primera
# que coincida gana, así que las frases largas van antes que las cortas.
NUCLEOS = [
    ("reverse hyperextension", "hiperextensión inversa", "f", "s"),
    ("hyperextension", "hiperextensión", "f", "s"),
    ("close-grip bench press", "press de banca agarre cerrado", "m", "s"),
    ("wide-grip bench press", "press de banca agarre ancho", "m", "s"),
    ("bench press", "press de banca", "m", "s"),
    ("military press", "press militar", "m", "s"),
    ("shoulder press", "press de hombro", "m", "s"),
    ("chest press", "press de pecho", "m", "s"),
    ("leg press", "prensa de piernas", "f", "s"),
    ("calf press", "prensa de gemelos", "f", "s"),
    ("french press", "press francés", "m", "s"),
    ("push press", "push press", "m", "s"),
    ("floor press", "press en el suelo", "m", "s"),
    ("skull crusher", "rompecráneos", "m", "s"),
    ("triceps extension", "extensión de tríceps", "f", "s"),
    ("tricep extension", "extensión de tríceps", "f", "s"),
    ("leg extension", "extensión de piernas", "f", "s"),
    ("back extension", "extensión de espalda", "f", "s"),
    ("hip extension", "extensión de cadera", "f", "s"),
    ("knee extension", "extensión de rodilla", "f", "s"),
    ("extension", "extensión", "f", "s"),
    ("lateral raise", "elevación lateral", "f", "s"),
    ("front raise", "elevación frontal", "f", "s"),
    ("rear delt raise", "elevación posterior de hombro", "f", "s"),
    ("calf raise", "elevación de gemelos", "f", "s"),
    ("heel raise", "elevación de talones", "f", "s"),
    ("leg raise", "elevación de piernas", "f", "s"),
    ("knee raise", "elevación de rodillas", "f", "s"),
    ("hip raise", "elevación de cadera", "f", "s"),
    ("chest raise", "elevación de pecho", "f", "s"),
    ("shoulder raise", "elevación de hombros", "f", "s"),
    ("y-raise", "elevación en Y", "f", "s"),
    ("t-raise", "elevación en T", "f", "s"),
    ("raise", "elevación", "f", "s"),
    ("lateral pulldown", "jalón al pecho", "m", "s"),
    ("pulldown", "jalón", "m", "s"),
    ("pushdown", "extensión en polea", "f", "s"),
    ("preacher curl", "curl predicador", "m", "s"),
    ("hammer curl", "curl martillo", "m", "s"),
    ("concentration curl", "curl concentrado", "m", "s"),
    ("spider curl", "curl araña", "m", "s"),
    ("wrist curl", "curl de muñeca", "m", "s"),
    ("leg curl", "curl femoral", "m", "s"),
    ("biceps curl", "curl de bíceps", "m", "s"),
    ("bicep curl", "curl de bíceps", "m", "s"),
    ("curls", "curl", "m", "s"), ("curl", "curl", "m", "s"),
    ("upright row", "remo al mentón", "m", "s"),
    ("bent over row", "remo inclinado", "m", "s"),
    ("inverted row", "remo invertido", "m", "s"),
    ("seal row", "seal row", "m", "s"),
    ("row", "remo", "m", "s"),
    ("front squat", "sentadilla frontal", "f", "s"),
    ("split squat", "sentadilla búlgara", "f", "s"),
    ("hack squat", "sentadilla hack", "f", "s"),
    ("goblet squat", "sentadilla goblet", "f", "s"),
    ("sissy squat", "sentadilla sissy", "f", "s"),
    ("jump squat", "sentadilla con salto", "f", "s"),
    ("full squat", "sentadilla completa", "f", "s"),
    ("squats", "sentadillas", "f", "p"), ("squat", "sentadilla", "f", "s"),
    ("romanian deadlift", "peso muerto rumano", "m", "s"),
    ("stiff leg deadlift", "peso muerto piernas rígidas", "m", "s"),
    ("straight leg deadlift", "peso muerto piernas rígidas", "m", "s"),
    ("sumo deadlift", "peso muerto sumo", "m", "s"),
    ("deadlift", "peso muerto", "m", "s"),
    ("good morning", "buenos días", "m", "p"),
    ("chest fly", "aperturas de pecho", "f", "p"),
    ("reverse fly", "aperturas inversas", "f", "p"),
    ("fly", "aperturas", "f", "p"),
    ("pullover", "pullover", "m", "s"),
    ("push-up", "flexiones", "f", "p"), ("push up", "flexiones", "f", "p"), ("pushup", "flexiones", "f", "p"),
    ("push-ups", "flexiones", "f", "p"), ("pushups", "flexiones", "f", "p"),
    ("pull-up", "dominadas", "f", "p"), ("pull up", "dominadas", "f", "p"), ("pullup", "dominadas", "f", "p"),
    ("pull-ups", "dominadas", "f", "p"), ("pullups", "dominadas", "f", "p"),
    ("chin-up", "dominadas supinas", "f", "p"), ("chin up", "dominadas supinas", "f", "p"),
    ("chin-ups", "dominadas supinas", "f", "p"),
    ("sit-up", "abdominales", "m", "p"), ("sit up", "abdominales", "m", "p"),
    ("sit-ups", "abdominales", "m", "p"), ("situp", "abdominales", "m", "p"),
    ("crunches", "crunch", "m", "s"), ("crunch", "crunch", "m", "s"),
    ("dips", "fondos", "m", "p"), ("dip", "fondos", "m", "p"),
    ("shrug", "encogimiento de hombros", "m", "s"), ("shrugs", "encogimiento de hombros", "m", "s"),
    ("kickback", "patada de tríceps", "f", "s"), ("kickbacks", "patada de tríceps", "f", "s"),
    ("lunges", "zancadas", "f", "p"), ("lunge", "zancada", "f", "s"),
    ("step-up", "subida al cajón", "f", "s"), ("step up", "subida al cajón", "f", "s"),
    ("hip thrust", "hip thrust", "m", "s"),
    ("glute bridge", "puente de glúteo", "m", "s"),
    ("bridge", "puente", "m", "s"),
    ("plank", "plancha", "f", "s"),
    ("stretch", "estiramiento", "m", "s"),
    ("twist", "giro de torso", "m", "s"),
    ("rotation", "rotación", "f", "s"),
    ("adduction", "aducción", "f", "s"),
    ("abduction", "abducción", "f", "s"),
    ("clean and jerk", "cargada y envión", "m", "s"),
    ("clean", "cargada", "f", "s"),
    ("snatch", "arrancada", "f", "s"),
    ("jerk", "envión", "m", "s"),
    ("swing", "swing", "m", "s"),
    ("burpee", "burpee", "m", "s"), ("burpees", "burpees", "m", "p"),
    ("jumping jack", "jumping jack", "m", "s"),
    ("jump rope", "salto a la cuerda", "m", "s"),
    ("jump", "salto", "m", "s"),
    ("run", "carrera", "f", "s"), ("running", "carrera", "f", "s"), ("jog", "trote", "m", "s"),
    ("walk", "caminata", "f", "s"), ("walking", "caminata", "f", "s"),
    ("windmill", "molino", "m", "s"),
    ("rollerout", "rueda abdominal", "f", "s"), ("roll-out", "rueda abdominal", "f", "s"),
    ("rollout", "rueda abdominal", "f", "s"),
    ("press", "press", "m", "s"),
    ("lift", "elevación", "f", "s"),
    ("pull", "jalón", "m", "s"),
    ("bend", "flexión lateral", "f", "s"),
    ("thrust", "empuje", "m", "s"),
    ("hold", "isométrico", "m", "s"),
    ("planche", "planche", "f", "s"),
    ("scissor kick", "tijeras", "f", "p"),
    ("flutter kick", "aleteo", "m", "s"),
    ("mountain climber", "escalador", "m", "s"),
    ("superman", "superman", "m", "s"),
    ("bird dog", "bird dog", "m", "s"),
    ("wall sit", "sentadilla isométrica en pared", "f", "s"),
    ("farmers walk", "paseo del granjero", "m", "s"),
    ("carry", "traslado", "m", "s"),
    ("circles", "círculos", "m", "p"), ("circle", "círculo", "m", "s"),
    ("kick", "patada", "f", "s"),
    ("march", "marcha", "f", "s"),
    ("hang", "colgado en barra", "m", "s"),
    ("sprint", "sprint", "m", "s"),
    ("drag", "arrastre", "m", "s"),
    ("throw", "lanzamiento", "m", "s"),
    ("slam", "golpe contra el suelo", "m", "s"),
    ("wiper", "limpiaparabrisas", "m", "s"),
    ("raise-", "elevación", "f", "s"),
    ("raises", "elevaciones", "f", "p"), ("presses", "press", "m", "s"),
    ("rows", "remo", "m", "s"), ("extensions", "extensiones", "f", "p"),
    ("stretches", "estiramientos", "m", "p"), ("twists", "giros de torso", "m", "p"),
    ("flyes", "aperturas", "f", "p"), ("flys", "aperturas", "f", "p"),
    ("supination", "supinación", "f", "s"), ("pronation", "pronación", "f", "s"),
    ("flexion", "flexión", "f", "s"), ("thruster", "thruster", "m", "s"),
    ("crawl", "desplazamiento a gatas", "m", "s"), ("handstand", "pino", "m", "s"),
    ("inchworm", "oruga", "f", "s"), ("dead bug", "dead bug", "m", "s"),
    ("flag", "bandera humana", "f", "s"), ("hug", "abrazo", "m", "s"),
    ("cocoons", "cocoons", "m", "p"), ("elevator", "elevador", "m", "s"),
    ("kicks", "patadas", "f", "p"), ("jumps", "saltos", "m", "p"),
    ("ropes", "cuerdas de batalla", "f", "p"),
    ("skullcrusher", "rompecráneos", "m", "s"), ("v-up", "v-up", "m", "s"),
    ("toe touch", "toque de puntas", "m", "s"), ("heel touch", "toque de talones", "m", "s"),
    ("air bike", "bicicleta en el aire", "f", "s"), ("slide", "deslizamiento", "m", "s"),
    ("squeeze", "contracción", "f", "s"), ("front lever", "front lever", "m", "s"),
    ("back lever", "back lever", "m", "s"), ("lever", "palanca", "f", "s"),
    ("yoga pose", "postura de yoga", "f", "s"), ("variation", "variante", "f", "s"),
    ("get up", "levantada", "f", "s"), ("sit", "sentadilla isométrica", "f", "s"),
    ("climb", "trepada", "f", "s"), ("hops", "saltos", "m", "p"),
    ("drive", "empuje", "m", "s"), ("retractor", "retracción", "f", "s"),
    ("board", "tabla", "f", "s"), ("step", "paso", "m", "s"),
]

# ------------------------------------------------------------ adjetivos
# Los que concuerdan se escriben en masculino singular y se declinan.
def _declina(adj, gen, num):
    if adj.endswith("o"):
        base = adj[:-1] + ("a" if gen == "f" else "o")
    elif adj.endswith(("e", "l", "r", "z", "n", "s")) or " " in adj:
        base = adj
    else:
        base = adj
    if num == "p":
        if base.endswith(("a", "e", "o")):
            base += "s"
        elif base.endswith(("l", "r", "n", "d")):
            base += "es"
        elif base.endswith("z"):
            base = base[:-1] + "ces"
    return base

# (inglés, español, ranura, ¿concuerda?)
# ranuras: 1 músculo · 2 variante · 3 agarre · 4 inclinación · 5 postura · 6 apoyo
MODIF = [
    ("triceps", "de tríceps", 1, False), ("tricep", "de tríceps", 1, False),
    ("biceps", "de bíceps", 1, False), ("bicep", "de bíceps", 1, False),
    ("upper back", "de espalda alta", 1, False), ("lower back", "de lumbar", 1, False),
    ("hamstring", "de femoral", 1, False), ("hamstrings", "de femorales", 1, False),
    ("quadriceps", "de cuádriceps", 1, False), ("quads", "de cuádriceps", 1, False),
    ("glutes", "de glúteos", 1, False), ("glute", "de glúteo", 1, False),
    ("calves", "de gemelos", 1, False), ("calf", "de gemelos", 1, False),
    ("obliques", "de oblicuos", 1, False), ("oblique", "de oblicuo", 1, False),
    ("shoulders", "de hombros", 1, False), ("shoulder", "de hombro", 1, False),
    ("delts", "de deltoides", 1, False), ("delt", "de deltoides", 1, False),
    ("lats", "de dorsales", 1, False), ("lat", "de dorsal", 1, False),
    ("pecs", "de pecho", 1, False), ("pectoral", "de pecho", 1, False), ("chest", "de pecho", 1, False),
    ("abs", "abdominal", 1, False), ("abdominal", "abdominal", 1, False),
    ("traps", "de trapecios", 1, False), ("trap", "de trapecio", 1, False),
    ("forearms", "de antebrazos", 1, False), ("forearm", "de antebrazo", 1, False),
    ("hip flexor", "de flexores de cadera", 1, False),
    ("adductor", "de aductores", 1, False), ("abductor", "de abductores", 1, False),
    ("groin", "de aductores", 1, False), ("spine", "de columna", 1, False),
    ("neck", "de cuello", 1, False), ("hips", "de cadera", 1, False), ("hip", "de cadera", 1, False),
    ("knees", "de rodillas", 1, False), ("knee", "de rodilla", 1, False),
    ("wrist", "de muñeca", 1, False), ("ankle", "de tobillo", 1, False),
    ("legs", "de piernas", 1, False), ("leg", "de pierna", 1, False),
    ("arms", "de brazos", 1, False), ("arm", "de brazo", 1, False),
    ("back", "de espalda", 1, False), ("toes", "de puntillas", 1, False), ("toe", "de puntillas", 1, False),
    ("elbows", "de codos", 1, False), ("elbow", "de codo", 1, False),
    ("scapula", "escapular", 1, False), ("scapular", "escapular", 1, False),
    ("deltoid", "de deltoides", 1, False), ("deltoids", "de deltoides", 1, False),
    ("pectorals", "de pecho", 1, False), ("thigh", "de muslo", 1, False),
    ("shin", "de tibial", 1, False), ("trapezius", "de trapecio", 1, False),
    ("astride", "a horcajadas", 2, False), ("battling", "de batalla", 2, False),
    ("bear", "de oso", 2, False), ("gorilla", "de gorila", 2, False),
    ("judo", "de judo", 2, False), ("flip", "de volteo", 2, False),
    ("pin", "desde pines", 2, False), ("skier", "esquiador", 2, False),
    ("bottoms-up", "con base arriba", 2, False), ("butt-ups", "de glúteos", 2, False),
    ("sternum", "al esternón", 2, False), ("gironda", "gironda", 2, False),

    ("one arm", "a un brazo", 2, False), ("single arm", "a un brazo", 2, False),
    ("one-arm", "a un brazo", 2, False), ("two arm", "a dos brazos", 2, False),
    ("one leg", "a una pierna", 2, False), ("single leg", "a una pierna", 2, False),
    ("one-leg", "a una pierna", 2, False), ("single-leg", "a una pierna", 2, False),
    ("unilateral", "unilateral", 2, False), ("bilateral", "bilateral", 2, False),
    ("alternate", "alterno", 2, True), ("alternating", "alterno", 2, True),
    ("reverse", "inverso", 2, True), ("inverse", "inverso", 2, True),
    ("cross body", "cruzado", 2, True), ("cross-body", "cruzado", 2, True),
    ("crossover", "cruzado", 2, True), ("crossovers", "cruzado", 2, True), ("cross", "cruzado", 2, True),
    ("side", "lateral", 2, False), ("lateral", "lateral", 2, False),
    ("front", "frontal", 2, False), ("rear", "posterior", 2, False),
    ("overhead", "sobre la cabeza", 2, False),
    ("behind head", "tras la nuca", 2, False), ("behind neck", "tras la nuca", 2, False),
    ("behind the back", "tras la espalda", 2, False), ("behind back", "tras la espalda", 2, False),
    ("twisting", "con giro", 2, False), ("rotating", "con rotación", 2, False),
    ("explosive", "explosivo", 2, True), ("dynamic", "dinámico", 2, True),
    ("static", "estático", 2, True), ("isometric", "isométrico", 2, True),
    ("full", "completo", 2, True), ("partial", "parcial", 2, False), ("half", "medio", 2, True),
    ("negative", "negativo", 2, True), ("eccentric", "excéntrico", 2, True),
    ("assisted", "asistido", 2, True), ("self assisted", "autoasistido", 2, True),
    ("weighted", "con lastre", 2, False), ("bodyweight", "con peso corporal", 2, False),
    ("sumo", "sumo", 2, False), ("bulgarian", "búlgaro", 2, True),
    ("curtsey", "de reverencia", 2, False), ("curtsy", "de reverencia", 2, False),
    ("zottman", "zottman", 2, False), ("preacher", "predicador", 2, False), ("scott", "scott", 2, False),
    ("spider", "araña", 2, False), ("diamond", "diamante", 2, False), ("archer", "arquero", 2, False),
    ("clap", "con palmada", 2, False), ("pike", "en pica", 2, False),
    ("spiderman", "spiderman", 2, False), ("hindu", "hindú", 2, False),
    ("donkey", "burro", 2, False), ("goblet", "goblet", 2, False),
    ("zercher", "zercher", 2, False), ("jefferson", "jefferson", 2, False),
    ("landmine", "landmine", 2, False), ("jm", "JM", 2, False),
    ("scissor", "en tijera", 2, False), ("frog", "rana", 2, False), ("butterfly", "mariposa", 2, False),
    ("hanging", "colgado", 2, True), ("suspended", "suspendido", 2, True),
    ("inverted", "invertido", 2, True), ("straight", "recto", 2, True),
    ("narrow", "estrecho", 2, True), ("wide", "abierto", 2, True), ("close", "cerrado", 2, True),
    ("high", "alto", 2, True), ("low", "bajo", 2, True),
    ("stiff", "rígido", 2, True), ("bent", "flexionado", 2, True),
    ("l-sit", "en L", 2, False), ("v-sit", "en V", 2, False),

    ("reverse grip", "agarre supino", 3, False), ("supinated grip", "agarre supino", 3, False),
    ("underhand", "agarre supino", 3, False), ("overhand", "agarre prono", 3, False),
    ("pronate-grip", "agarre prono", 3, False), ("pronated grip", "agarre prono", 3, False),
    ("close-grip", "agarre cerrado", 3, False), ("close grip", "agarre cerrado", 3, False),
    ("wide-grip", "agarre ancho", 3, False), ("wide grip", "agarre ancho", 3, False),
    ("neutral grip", "agarre neutro", 3, False), ("neutral-grip", "agarre neutro", 3, False),
    ("hammer grip", "agarre martillo", 3, False), ("mixed grip", "agarre mixto", 3, False),
    ("grip", "agarre", 3, False),
    ("with rope", "con cuerda", 3, False), ("rope", "con cuerda", 3, False),
    ("with v-bar", "con barra en V", 3, False), ("v-bar", "con barra en V", 3, False),
    ("v bar", "con barra en V", 3, False), ("straight bar", "con barra recta", 3, False),
    ("ez bar", "con barra EZ", 3, False), ("t-bar", "con barra T", 3, False),
    ("with bar", "con barra", 3, False), ("bar", "con barra", 3, False),
    ("with strap", "con cinta", 3, False), ("with towel", "con toalla", 3, False),

    ("incline", "inclinado", 4, True), ("inclined", "inclinado", 4, True),
    ("decline", "declinado", 4, True), ("declined", "declinado", 4, True),
    ("flat", "plano", 4, True), ("horizontal", "horizontal", 4, False),
    ("vertical", "vertical", 4, False), ("45", "a 45°", 4, False),

    ("seated", "sentado", 5, True), ("sitting", "sentado", 5, True),
    ("standing", "de pie", 5, False), ("stand", "de pie", 5, False),
    ("lying", "tumbado", 5, True), ("laying", "tumbado", 5, True),
    ("kneeling", "de rodillas", 5, False), ("prone", "boca abajo", 5, False),
    ("supine", "boca arriba", 5, False), ("bent over", "inclinado", 5, True),
    ("bent-over", "inclinado", 5, True), ("bent knee", "rodilla flexionada", 5, False),
    ("squatting", "en sentadilla", 5, False), ("split", "en split", 5, False),
    ("staggered", "en paso alterno", 5, False), ("stork stance", "en apoyo de cigüeña", 5, False),
    ("stance", "postura", 5, False), ("hands", "con las manos", 5, False),

    ("on stability ball", "en fitball", 6, False), ("stability ball", "en fitball", 6, False),
    ("exercise ball", "en fitball", 6, False), ("swiss ball", "en fitball", 6, False),
    ("bosu ball", "en bosu", 6, False), ("medicine ball", "con balón medicinal", 6, False),
    ("ball", "con balón", 6, False),
    ("on bench", "en banco", 6, False), ("bench", "en banco", 6, False),
    ("floor", "en el suelo", 6, False), ("wall", "en la pared", 6, False),
    ("chair", "en silla", 6, False), ("box", "al cajón", 6, False),
    ("platform", "en plataforma", 6, False), ("step", "en step", 6, False),
    ("rings", "en anillas", 6, False), ("ring", "en anillas", 6, False),
    ("parallel bars", "en paralelas", 6, False), ("parallel", "en paralelas", 6, False),
    ("machine", "en máquina", 6, False), ("lever", "en máquina", 6, False),
    ("sled", "en trineo", 6, False), ("smith", "en Smith", 6, False),
    ("treadmill", "en cinta", 6, False), ("elliptical", "en elíptica", 6, False),
    ("over bench", "sobre el banco", 6, False), ("over", "sobre", 6, False),
    ("hammer", "martillo", 2, False), ("blaster", "con arm blaster", 6, False),
    ("russian", "ruso", 2, True), ("forward", "hacia delante", 2, False),
    ("backward", "hacia atrás", 2, False), ("attachment", "con agarre", 3, False),
    ("support", "con apoyo", 6, False), ("supported", "con apoyo", 6, False),
    ("palms", "con las palmas", 3, False), ("palm", "con la palma", 3, False),
    ("inner", "interno", 2, True), ("outer", "externo", 2, True),
    ("internal", "interna", 2, False), ("external", "externa", 2, False),
    ("double", "doble", 2, False), ("single", "simple", 2, False),
    ("touch", "con toque", 2, False), ("tap", "con toque", 2, False),
    ("through", "pasando", 2, False), ("against", "contra", 6, False),
    ("between benches", "entre bancos", 6, False), ("between", "entre", 6, False),
    ("wheel", "con rueda", 3, False), ("head", "de cabeza", 1, False),
    ("neutral", "neutro", 3, False), ("hand", "con una mano", 3, False),
    ("hands", "con las manos", 3, False), ("hang", "colgado", 5, False),
    ("circular", "circular", 2, False), ("motion", "en movimiento", 2, False),
    ("jack", "jack", 2, False), ("plyo", "pliométrico", 2, True),
    ("plyometric", "pliométrico", 2, True), ("arnold", "arnold", 2, False),
    ("extended", "extendido", 2, True), ("raised", "elevado", 2, True),
    ("twisted", "girado", 2, True), ("pelvic tilt", "báscula pélvica", 2, False),
    ("pelvic", "pélvico", 2, True), ("tilt", "inclinación", 2, False),
    ("reach", "con alcance", 2, False), ("range", "de recorrido", 2, False),
    ("drop", "en descenso", 2, False), ("pose", "postura", 2, False),
    ("piriformis", "de piramidal", 1, False), ("balance", "en equilibrio", 5, False),
    ("bike", "en bicicleta", 6, False), ("pov", "", 2, False),
    ("45°", "a 45°", 4, False), ("90°", "a 90°", 4, False),
    ("ez", "con barra EZ", 3, False), ("v", "en V", 2, False),
    ("lower", "bajo", 2, True), ("upper", "alto", 2, True),
    ("body", "corporal", 2, True), ("muscle", "muscular", 2, False),
    ("from", "desde", 2, False), ("two", "a dos", 2, False), ("one", "a uno", 2, False),
]

# --------------------------------------------------------------- equipo
EQUIPO = [
    ("olympic barbell", "con barra olímpica"), ("ez barbell", "con barra EZ"),
    ("trap bar", "con barra hexagonal"), ("barbell", "con barra"),
    ("dumbbell", "con mancuernas"), ("kettlebell", "con kettlebell"),
    ("smith machine", "en Smith"), ("smith", "en Smith"),
    ("leverage machine", "en máquina"), ("lever", "en máquina"),
    ("sled machine", "en máquina de trineo"), ("sled", "en trineo"),
    ("stepmill machine", "en escaladora"), ("elliptical machine", "en elíptica"),
    ("skierg machine", "en SkiErg"), ("upper body ergometer", "en ergómetro de brazos"),
    ("stationary bike", "en bicicleta estática"),
    ("cable", "en polea"), ("resistance band", "con banda elástica"), ("band", "con banda elástica"),
    ("stability ball", "en fitball"), ("exercise ball", "en fitball"),
    ("bosu ball", "en bosu"), ("medicine ball", "con balón medicinal"),
    ("wheel roller", "con rueda abdominal"), ("roller", "con rodillo"),
    ("weighted", "con lastre"), ("assisted", "asistido"),
    ("body weight", ""), ("bodyweight", ""),
    ("rope", "con cuerda"), ("hammer", "con mazo"), ("tire", "con neumático"),
]

_BASURA = re.compile(r"\b(and|with|on|in|the|a|an|to|of|or|for|your|both|up|down|it|its)\b")
_LIMPIAR = [
    (re.compile(r"\bv\.?\s*\d+\b"), ""),
    (re.compile(r"\b(male|female)\b", re.I), ""),
    (re.compile(r"в°"), "°"),
    (re.compile(r"\s+"), " "),
]

def _limpio(nombre):
    t = nombre.lower().strip()
    for rx, rep in _LIMPIAR:
        t = rx.sub(rep, t)
    return t.strip(" -–,")

def _saca(txt, frase):
    rx = re.compile(r"(?:^|(?<=[\s\-(),]))" + re.escape(frase) + r"(?=$|[\s\-(),])")
    m = rx.search(txt)
    if not m:
        return False, txt, 0
    return True, (txt[:m.start()] + " " + txt[m.end():]).strip(), m.start()

def _traduce_suelto(txt):
    """Traduce un fragmento suelto (lo que va entre paréntesis) usando el
    mismo diccionario de modificadores, sin núcleo ni concordancia."""
    resto, piezas = txt.lower().strip(), []
    for ing, esp, _slot, _c in sorted(MODIF, key=lambda x: -len(x[0])):
        ok, r, pos = _saca(resto, ing)
        if ok and esp:
            piezas.append((pos, esp))
            resto = r
        elif ok:
            resto = r
    sobra = [w for w in re.split(r"[\s,\-]+", _BASURA.sub(" ", resto)) if w]
    return " ".join([p for _, p in sorted(piezas)] + sobra).strip() or txt


def traducir(nombre):
    """→ (nombre en español, ¿se entendió todo?)"""
    t = _limpio(nombre)
    parentesis = ""
    m = re.search(r"\(([^)]*)\)", t)
    if m:
        parentesis = m.group(1).strip()
        t = (t[:m.start()] + " " + t[m.end():]).strip()
        t = re.sub(r"\s+", " ", t)

    # equipo, solo cuando abre el nombre
    equipo = ""
    for ing, esp in sorted(EQUIPO, key=lambda x: -len(x[0])):
        if t == ing or t.startswith(ing + " "):
            equipo = esp
            t = t[len(ing):].strip()
            break

    # núcleo
    nucleo, gen, num = "", "m", "s"
    for ing, esp, g, n in NUCLEOS:
        ok, resto, _ = _saca(t, ing)
        if ok:
            nucleo, gen, num, t = esp, g, n, resto
            break

    # modificadores, cada uno a su ranura
    ranuras = {}
    for ing, esp, slot, concuerda in sorted(MODIF, key=lambda x: -len(x[0])):
        ok, resto, pos = _saca(t, ing)
        if ok:
            texto = _declina(esp, gen, num) if concuerda else esp
            ranuras.setdefault(slot, []).append((pos, texto))
            t = resto

    sobra = [w for w in re.split(r"[\s,\-]+", _BASURA.sub(" ", t)) if w]

    if not nucleo:
        piezas = [x for s in sorted(ranuras) for _, x in sorted(ranuras[s])]
        if not piezas:
            return nombre.strip(), False
        nucleo = piezas[0]
        ranuras = {}
        for i, p in enumerate(piezas[1:]):
            ranuras.setdefault(9, []).append((i, p))

    partes = [nucleo]
    for slot in sorted(ranuras):
        vistos = set()
        for _, texto in sorted(ranuras[slot]):
            if texto not in vistos:
                vistos.add(texto)
                partes.append(texto)
    if equipo and equipo not in partes:
        partes.append(equipo)
    if parentesis:
        partes.append(f"({_traduce_suelto(parentesis)})")

    txt = re.sub(r"\s+", " ", " ".join(p for p in partes if p)).strip()
    return txt[:1].upper() + txt[1:], not sobra
