---
name: forja-exercise-icons
description: Genera iconos de ejercicio monocromáticos estilo FORJA (fondo negro puro, atleta blanco, alta fidelidad biomecánica) a partir de una foto, captura o frame de video del ejercicio. Usa esta skill SIEMPRE que el usuario adjunte una imagen/video de un ejercicio y pida crear, generar, regenerar o editar su icono, ilustración o imagen — aunque no mencione "FORJA" ni "skill" explícitamente. También úsala para poblar el icono de un ejercicio nuevo o existente en la app FORJA. No la actives para pedidos de imágenes genéricas sin relación a biomecánica de ejercicio (fotos de comida, logos, arte decorativo).
---

# FORJA Exercise Icon Generator

## Skill purpose
Use this skill whenever the user asks to create, adapt, or regenerate an exercise image/icon/illustration for the FORJA library or for a similar black-and-white exercise icon system.

This skill is specialized for:
- converting attached exercise photos, screenshots, or video frames into premium monochrome exercise icons;
- preserving exact exercise biomechanics from the reference;
- keeping a fixed FORJA visual identity across all exercise images;
- rendering cable machines, benches, cuffs, pulleys, and cable routing clearly;
- preventing left/right routing mistakes, especially in crossed-cable exercises.

## Required inputs
At least one of the following should be available:
1. An attached image, screenshot, or video frame of the exercise.
2. A written description of the exercise.
3. Additional user instructions about cuffs, cable routing, bench angle, body position, view angle, or machine details.

If both a style reference and a biomechanics reference are available, treat them separately:
- Style reference = overall visual language only.
- Biomechanics reference = exact exercise mechanics, pose, and machine setup.

The included file `references/STYLE_MASTER.png` is the default FORJA style reference.

## Core goal
Generate a **single final image** that is:
- visually premium;
- monochrome;
- highly readable;
- biomechanically accurate;
- consistent with the FORJA icon collection.

## Non-negotiable style rules
Always follow `instructions/01_visual-style.md`.

In short:
- pure black background;
- athlete predominantly white;
- grayscale/white machine details;
- high contrast;
- premium app icon / technical illustration aesthetic;
- no logos;
- no watermarks;
- no UI overlays;
- no random gym background;
- no decorative clutter;
- no text, unless the user explicitly requests labels.

## Non-negotiable biomechanics rules
Always follow:
- `instructions/02_biomechanics.md`
- `instructions/03_cable-routing.md`
- `instructions/04_anatomy-hands.md`
- `instructions/05_quality-control.md`

The image must show the exact exercise variant in the reference.
Do not replace it with a more common variation.
Do not simplify away critical mechanics.

## Required workflow
Before generating the final image, perform this internal workflow.

### Step 1 — Identify the exercise
Determine:
- the exercise name or best functional description;
- the machine or equipment used;
- the position of the athlete;
- the camera angle / perspective.

### Step 2 — Build a biomechanics map
Identify:
- torso orientation;
- bench angle;
- head position;
- shoulder position;
- arm path;
- elbow bend;
- forearm angle;
- hand state (open / closed / holding object / empty fist);
- wrist accessories;
- leg position;
- foot position;
- all machine elements needed to understand the exercise.

### Step 3 — Build a routing map for each cable or resistance line
For every side, map:
- origin point;
- pulley or anchor point;
- cable path;
- carabiner or attachment;
- final destination on the athlete.

Use explicit routing notation internally, for example:
- Left pulley tower (front-view machine left) → cable → cross body → right wrist cuff.
- Right pulley tower (front-view machine right) → cable → cross body → left wrist cuff.

### Step 4 — Determine anatomical left and right
Never determine left/right only from screen position.
Determine the athlete's anatomical left and right first.
Then determine the machine's left and right **from the front of the machine**, unless the user explicitly states another convention.

### Step 5 — Separate style from mechanics
Use the style reference only for:
- line quality;
- contrast;
- character design language;
- shading level;
- machine rendering language;
- overall composition feel.

Use the biomechanics reference only for:
- exercise form;
- pose;
- range of motion depiction;
- setup;
- cable routing;
- attachments;
- perspective.

### Step 6 — Final quality-control pass
Before finalizing, verify every critical point from `instructions/05_quality-control.md`.
If a critical point fails, correct it before final output.

## Special rule for cable-cuff exercises
When cuffs are used:
- the cuffs must be visible on the wrists;
- the hands must remain empty if the user says the hands are not holding any handle;
- the cable must terminate visually at the cuff via a visible connector or carabiner;
- do not put a handle into the hand unless the reference explicitly uses one.

## Special rule for crossed cables
When the user specifies a crossed-cable setup, show the crossing physically and unambiguously.
The final image must let a viewer visually follow each cable from machine origin to destination.

Example:
- Machine left pulley → athlete right wrist cuff.
- Machine right pulley → athlete left wrist cuff.

In these cases, the cables should visibly cross if that is mechanically correct.

## Output standard
The final output should usually be:
- one polished final image;
- high resolution;
- centered composition with enough empty black space;
- fully readable anatomy and machine setup.

## If the user provides extra instructions
Always prioritize:
1. explicit user instructions;
2. biomechanics reference;
3. FORJA visual style system.

## If instructions conflict
Use this order:
1. user explicit instruction;
2. reference biomechanics;
3. quality-control rules;
4. default FORJA style.

## Quick-use prompt pattern
If needed, ask or interpret the request in this structure:
- EXERCISE:
- REFERENCE:
- MANDATORY DETAILS:
- STYLE:
- OUTPUT:

## Prompt maestro completo en español
Para el detalle exhaustivo (persona, manos/muñequeras, cables/poleas, ejercicios con cables cruzados, equipamiento, composición, perspectiva, calidad, consistencia entre ejercicios), lee `MASTER_PROMPT_ES.md` — es la versión extendida en español de todo lo anterior y debe respetarse literalmente, en especial la regla de que la fidelidad al ejercicio de la referencia tiene prioridad sobre todo lo demás.

## Included resources
- `references/STYLE_MASTER.png` = visual style anchor (style only — never copy the specific exercise shown there).
- `references/STYLE_NOTES.md` = how to use the style anchor.
- `instructions/01_visual-style.md`
- `instructions/02_biomechanics.md`
- `instructions/03_cable-routing.md`
- `instructions/04_anatomy-hands.md`
- `instructions/05_quality-control.md`
- `MASTER_PROMPT_ES.md` = prompt maestro extendido en español.
- `templates/exercise-request-template.md`
- `examples/example_requests.md`

Use this skill as the default system for FORJA exercise-icon creation.
