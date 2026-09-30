# FORJA para Garmin Fénix 8

App de reloj (Connect IQ · Monkey C) que lleva tu rutina de FORJA a la muñeca:

- Lista de días (el que toca va primero, marcado con `>`).
- Por serie: ajustas **peso, reps y RIR** con ARRIBA/ABAJO (o tocando), OK avanza y, tras el RIR, registra la serie.
- **Descanso** automático con cuenta regresiva y vibración.
- Graba la actividad como **Fuerza** (pulso, calorías) para que salga en Garmin Connect.
- Al terminar deja la sesión en tu cuenta: FORJA la importa al historial cuando la abres.

## Cómo funciona

```
FORJA (web) ──publica──▶ forja_kv["forja-watch:<código>"]  ──▶ reloj (rutina compacta)
reloj ──deja──▶ forja_kv["forja-watchlog:<código>:<n>"]   ──▶ FORJA (importa y borra)
```

El reloj habla con internet a través del teléfono (Garmin Connect en el móvil, con Bluetooth).

## Instalar en el reloj (sin publicar en la tienda)

1. Instala **Visual Studio Code** y la extensión **Monkey C** (de Garmin).
2. En VS Code: `Ctrl/Cmd+Shift+P` → **Monkey C: Verify Installation** (descarga el SDK) y **Monkey C: Open SDK Manager**: instala el SDK y el dispositivo **fēnix 8** (pide iniciar sesión con tu cuenta Garmin).
3. `Monkey C: Generate a Developer Key` (una vez).
4. Abre la carpeta `garmin/forja-watch` en VS Code.
5. Si tu **código FORJA** no es `4242nua4mm`, cámbialo en `resources/settings/properties.xml`. Lo ves en FORJA → Más → Dispositivos → *Garmin Fénix · código*.
6. `Monkey C: Build for Device` → elige tu modelo (p. ej. `fenix847mm`) → se crea `bin/forja-watch.prg`.
7. Conecta el reloj por USB y copia el `.prg` a `GARMIN/Apps/` del reloj. Desconecta: FORJA aparece en la lista de apps (Entrenamientos → o Aplicaciones).

## Uso

1. En FORJA (móvil): Más → Dispositivos → **Enviar la rutina al reloj** (también se publica sola cuando cambia el plan).
2. En el reloj abre **FORJA**, elige el día, y registra.
3. Al terminar → **Guardar**. Abre FORJA en el móvil y la sesión aparece en el historial.

## Botones

| | |
|---|---|
| ARRIBA / ABAJO | subir / bajar el valor elegido |
| OK (INICIO) | siguiente valor; tras el RIR registra la serie |
| ATRÁS | valor anterior; en el primero abre el menú |
| Mantener ARRIBA | menú (siguiente/anterior ejercicio, terminar, descartar) |
| Táctil | tocar sobre/bajo un valor lo sube/baja, deslizar ← → cambia de ejercicio |

## Notas

- Los IDs de producto del `manifest.xml` son los de Fénix 8 (`fenix843mm`, `fenix847mm`, `fenix8solar47mm`, `fenix8solar51mm`, `fenix8pro47mm`, `fenix8pro51mm`). Si el SDK Manager no muestra alguno, bórralo del manifest.
- Sin señal, la sesión queda guardada en el reloj y se envía la próxima vez que abras la app.
