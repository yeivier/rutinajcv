using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.System;
using Toybox.Timer;
using Toybox.Lang;

const ACCENT = 0x2FCB78;

function cut(s, n) {
    var str = (s == null) ? "" : s.toString();
    if (str.length() > n) { return str.substring(0, n - 1) + "."; }
    return str;
}

function clock(sec) {
    var m = sec / 60;
    var s = sec % 60;
    return m.toString() + ":" + s.format("%02d");
}

// Pantalla principal del entrenamiento: ejercicio, serie y tres valores
// (peso, reps, RIR) que se ajustan con ARRIBA/ABAJO; OK pasa al siguiente
// valor y, tras el RIR, registra la serie y arranca el descanso.
class WorkoutView extends WatchUi.View {
    var w;
    var timer = null;

    function initialize(workout) {
        View.initialize();
        w = workout;
    }

    function onShow() {
        timer = new Timer.Timer();
        timer.start(method(:tick), 1000, true);
    }

    function onHide() {
        if (timer != null) { timer.stop(); timer = null; }
    }

    function tick() {
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        var W = dc.getWidth();
        var H = dc.getHeight();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var cj = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

        // Reloj de la sesión
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.075).toNumber(), Graphics.FONT_XTINY, clock(w.elapsedSec()), cj);

        // Ejercicio
        var ex = w.ex();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.175).toNumber(), Graphics.FONT_SMALL, cut(ex["n"], 22), cj);

        // Serie y consigna
        var st = w.curSet();
        var total = w.sets().size();
        var tag = w.isWarm() ? "Aprox " : "Serie ";
        var goal = tag + (w.setIdx + 1).toString() + "/" + total.toString();
        if (st["r"] != null && st["r"].length() > 0) { goal += "  " + st["r"] + " reps"; }
        if (st["q"] != null && st["q"].length() > 0) { goal += "  RIR " + st["q"]; }
        dc.setColor(w.isWarm() ? Graphics.COLOR_LT_GRAY : ACCENT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.275).toNumber(), Graphics.FONT_XTINY, goal, cj);

        // Tres valores
        var labels = ["KG", "REPS", "RIR"];
        var xs = [(W * 0.22).toNumber(), (W * 0.5).toNumber(), (W * 0.78).toNumber()];
        var texts = [Workout.fmtW(w.vals[0]), w.vals[1].toString(), w.vals[2].toString()];
        var yv = (H * 0.50).toNumber();
        for (var i = 0; i < 3; i++) {
            var on = (i == w.focus);
            if (on) {
                dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(3);
                dc.drawRoundedRectangle(xs[i] - (W * 0.13).toNumber(), yv - (H * 0.135).toNumber(), (W * 0.26).toNumber(), (H * 0.27).toNumber(), 14);
                dc.setPenWidth(1);
            }
            dc.setColor(on ? Graphics.COLOR_WHITE : Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(xs[i], yv - (H * 0.085).toNumber(), Graphics.FONT_XTINY, labels[i], cj);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(xs[i], yv + (H * 0.025).toNumber(), Graphics.FONT_NUMBER_MEDIUM, texts[i], cj);
        }

        // Lo de la vez pasada
        if (st["w"] != null) {
            var prev = "Antes " + Workout.fmtW(Workout.toF(st["w"]));
            if (st["l"] != null) { prev += " x " + st["l"]; }
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(W / 2, (H * 0.735).toNumber(), Graphics.FONT_XTINY, prev, cj);
        }

        // Puntos: una por serie del ejercicio
        var n = total;
        var gap = 16;
        var x0 = W / 2 - ((n - 1) * gap) / 2;
        for (var k = 0; k < n; k++) {
            var done = (k < w.doneInEx(w.exIdx));
            dc.setColor(done ? ACCENT : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            if (k == w.setIdx) {
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x0 + k * gap, (H * 0.835).toNumber(), 6);
            } else {
                dc.fillCircle(x0 + k * gap, (H * 0.835).toNumber(), 4);
            }
        }

        // Pie: qué hace OK
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.925).toNumber(), Graphics.FONT_XTINY,
            (w.focus < 2) ? "OK: siguiente" : "OK: hecha", cj);
    }
}

class WorkoutDelegate extends WatchUi.BehaviorDelegate {
    var w;

    function initialize(workout) {
        BehaviorDelegate.initialize();
        w = workout;
    }

    function onPreviousPage() {     // ARRIBA
        w.adjust(1);
        WatchUi.requestUpdate();
        return true;
    }

    function onNextPage() {         // ABAJO
        w.adjust(-1);
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {           // OK / INICIO
        if (w.focus < 2) {
            w.focus += 1;
            WatchUi.requestUpdate();
        } else {
            doCommit();
        }
        return true;
    }

    function doCommit() {
        var rest = w.commit();
        Workout.buzz(120);
        if (w.finished) {
            openMenu(w);
        } else {
            WatchUi.pushView(new RestView(w, rest), new RestDelegate(), WatchUi.SLIDE_LEFT);
        }
    }

    function onBack() {
        if (w.focus > 0) {
            w.focus -= 1;
            WatchUi.requestUpdate();
        } else {
            openMenu(w);
        }
        return true;
    }

    function onMenu() {
        openMenu(w);
        return true;
    }

    // Táctil: tocar arriba de un valor lo sube, abajo lo baja, al centro lo elige.
    function onTap(evt) {
        var c = evt.getCoordinates();
        var W = System.getDeviceSettings().screenWidth;
        var H = System.getDeviceSettings().screenHeight;
        var x = c[0];
        var y = c[1];
        if (y > (H * 0.66).toNumber()) {
            if (y > (H * 0.86).toNumber()) { onSelect(); }
            return true;
        }
        if (y < (H * 0.36).toNumber()) { return true; }
        var col = (x < (W * 0.36).toNumber()) ? 0 : ((x < (W * 0.64).toNumber()) ? 1 : 2);
        if (w.focus != col) {
            w.focus = col;
        } else if (y < (H * 0.46).toNumber()) {
            w.adjust(1);
        } else if (y > (H * 0.56).toNumber()) {
            w.adjust(-1);
        }
        WatchUi.requestUpdate();
        return true;
    }

    function onSwipe(evt) {
        var d = evt.getDirection();
        if (d == WatchUi.SWIPE_LEFT) {
            w.gotoEx(1);
        } else if (d == WatchUi.SWIPE_RIGHT) {
            w.gotoEx(-1);
        }
        WatchUi.requestUpdate();
        return true;
    }
}

// ---------------------------------------------------------------- descanso
class RestView extends WatchUi.View {
    var w;
    var endAt;
    var timer = null;
    var buzzed = false;

    function initialize(workout, seconds) {
        View.initialize();
        w = workout;
        endAt = System.getTimer() + seconds * 1000;
    }

    function onShow() {
        timer = new Timer.Timer();
        timer.start(method(:tick), 1000, true);
    }

    function onHide() {
        if (timer != null) { timer.stop(); timer = null; }
    }

    function remaining() {
        var ms = endAt - System.getTimer();
        return (ms <= 0) ? 0 : (ms + 999) / 1000;
    }

    function tick() {
        var r = remaining();
        if (r <= 3 && r > 0) { Workout.buzz(60); }
        if (r <= 0 && !buzzed) {
            buzzed = true;
            Workout.buzz(500);
            Workout.beep();
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            return;
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        var W = dc.getWidth();
        var H = dc.getHeight();
        var cj = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.17).toNumber(), Graphics.FONT_XTINY, "DESCANSO", cj);
        dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.42).toNumber(), Graphics.FONT_NUMBER_THAI_HOT, clock(remaining()), cj);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.68).toNumber(), Graphics.FONT_SMALL, cut(w.ex()["n"], 22), cj);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        var st = w.curSet();
        var txt = ((st["t"] != null && st["t"].equals("w")) ? "Aprox " : "Serie ") + (w.setIdx + 1).toString() + "/" + w.sets().size().toString();
        if (st["r"] != null && st["r"].length() > 0) { txt += "  " + st["r"] + " reps"; }
        dc.drawText(W / 2, (H * 0.80).toNumber(), Graphics.FONT_XTINY, txt, cj);
        dc.drawText(W / 2, (H * 0.92).toNumber(), Graphics.FONT_XTINY, "OK: saltar", cj);
    }
}

class RestDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }
    function onSelect() {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }
    function onBack() {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }
    function onTap(evt) {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }
}
