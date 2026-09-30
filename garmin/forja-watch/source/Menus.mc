using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.System;
using Toybox.Lang;

// ------------------------------------------------------------ lista de días
class DayMenuDelegate extends WatchUi.Menu2InputDelegate {
    var days;

    function initialize(d) {
        Menu2InputDelegate.initialize();
        days = d;
    }

    function onSelect(item) {
        var day = days[item.getId()];
        if (day["e"] == null || day["e"].size() == 0) { return; }
        var w = new Workout(day);
        WatchUi.pushView(new WorkoutView(w), new WorkoutDelegate(w), WatchUi.SLIDE_LEFT);
    }

    function onBack() {
        System.exit();
    }
}

// ------------------------------------------- menú durante / al final del entreno
function openMenu(w) {
    var menu = new WatchUi.Menu2({ :title => w.finished ? "Terminaste" : "Entreno" });
    if (w.finished) {
        menu.addItem(new WatchUi.MenuItem("Guardar", "Enviar a FORJA", :save, {}));
        menu.addItem(new WatchUi.MenuItem("Descartar", null, :discard, {}));
    } else {
        menu.addItem(new WatchUi.MenuItem("Seguir", null, :cont, {}));
        menu.addItem(new WatchUi.MenuItem("Ejercicio siguiente", null, :next, {}));
        menu.addItem(new WatchUi.MenuItem("Ejercicio anterior", null, :prev, {}));
        menu.addItem(new WatchUi.MenuItem("Terminar y guardar", w.totalLogged().toString() + " series", :save, {}));
        menu.addItem(new WatchUi.MenuItem("Descartar", null, :discard, {}));
    }
    WatchUi.pushView(menu, new WorkoutMenuDelegate(w), WatchUi.SLIDE_UP);
}

class WorkoutMenuDelegate extends WatchUi.Menu2InputDelegate {
    var w;

    function initialize(workout) {
        Menu2InputDelegate.initialize();
        w = workout;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :cont) {
            WatchUi.popView(WatchUi.SLIDE_DOWN);
        } else if (id == :next) {
            w.gotoEx(1);
            WatchUi.popView(WatchUi.SLIDE_DOWN);
        } else if (id == :prev) {
            w.gotoEx(-1);
            WatchUi.popView(WatchUi.SLIDE_DOWN);
        } else if (id == :save) {
            w.save();
            WatchUi.switchToView(new SummaryView(w), new SummaryDelegate(), WatchUi.SLIDE_LEFT);
            // el entrenamiento se cerró: la vista de series queda debajo y se
            // quita cuando se sale del resumen
        } else if (id == :discard) {
            w.discard();
            WatchUi.popView(WatchUi.SLIDE_DOWN);   // menú
            WatchUi.popView(WatchUi.SLIDE_RIGHT);  // entreno → lista de días
        }
    }

    function onBack() {
        if (w.finished) {
            // no se sale sin decidir: cae en «Guardar»
            return;
        }
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}

// --------------------------------------------------------------- resumen
class SummaryView extends WatchUi.View {
    var w;

    function initialize(workout) {
        View.initialize();
        w = workout;
    }

    function onUpdate(dc) {
        var W = dc.getWidth();
        var H = dc.getHeight();
        var cj = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.22).toNumber(), Graphics.FONT_MEDIUM, "Listo", cj);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        var n = w.totalLogged();
        dc.drawText(W / 2, (H * 0.42).toNumber(), Graphics.FONT_NUMBER_MEDIUM, n.toString(), cj);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.58).toNumber(), Graphics.FONT_XTINY, "series | " + (w.elapsedSec() / 60).toString() + " min", cj);
        var msg = (w.sent == 1) ? "Enviado a FORJA" : ((w.sent == 2) ? "Sin senal: se envia luego" : "Enviando...");
        dc.setColor((w.sent == 1) ? ACCENT : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.74).toNumber(), Graphics.FONT_XTINY, msg, cj);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(W / 2, (H * 0.90).toNumber(), Graphics.FONT_XTINY, "OK: salir", cj);
    }
}

class SummaryDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }
    function leave() {
        System.exit();
        return true;
    }
    function onSelect() { return leave(); }
    function onBack() { return leave(); }
    function onTap(evt) { return leave(); }
}
