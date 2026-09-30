using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.System;
using Toybox.Application.Storage;

// Pantalla de arranque: baja la rutina y, cuando la tiene, la reemplaza por
// la lista de días (así «atrás» desde la lista cierra la app).
class HomeView extends WatchUi.View {
    var msg = "Conectando...";
    var started = false;

    function initialize() {
        View.initialize();
    }

    function onShow() {
        if (!started) {
            started = true;
            Api.fetchPlan(method(:onPlan));
            retryPending();
        }
    }

    function onPlan(code, data) {
        var plan = null;
        if (code == 200 && data != null && data["value"] != null) {
            plan = data["value"];
            Storage.setValue("plan", plan);
        } else {
            plan = Storage.getValue("plan");
            if (plan != null) {
                msg = "Sin conexion (modo guardado)";
            } else if (code == 406 || code == 404) {
                msg = "Abre FORJA en el teléfono:\nMas > Dispositivos >\nGarmin > Enviar rutina";
                WatchUi.requestUpdate();
                return;
            } else {
                msg = "Sin conexion\n(" + code.toString() + ")";
                WatchUi.requestUpdate();
                return;
            }
        }
        if (plan["d"] == null || plan["d"].size() == 0) {
            msg = "Tu rutina está vacía";
            WatchUi.requestUpdate();
            return;
        }
        showDays(plan);
    }

    function showDays(plan) {
        var days = plan["d"];
        var menu = new WatchUi.Menu2({ :title => "FORJA" });
        // El día que toca va primero.
        var first = -1;
        for (var i = 0; i < days.size(); i++) {
            if (plan["nx"] != null && days[i]["id"].equals(plan["nx"])) { first = i; }
        }
        var order = [];
        if (first >= 0) { order.add(first); }
        for (var j = 0; j < days.size(); j++) {
            if (j != first) { order.add(j); }
        }
        for (var k = 0; k < order.size(); k++) {
            var d = days[order[k]];
            var sub = d["g"].toString() + " | " + d["e"].size().toString() + " ej";
            var label = (k == 0 && first >= 0) ? "> " + d["n"] : d["n"];
            menu.addItem(new WatchUi.MenuItem(label, sub, order[k], {}));
        }
        WatchUi.switchToView(menu, new DayMenuDelegate(days), WatchUi.SLIDE_IMMEDIATE);
    }

    // Sesiones que quedaron sin enviar por falta de señal.
    function retryPending() {
        var p = Api.pending();
        if (p.size() == 0) { return; }
        var log = p[0];
        Api.postLog(log, new PendingSender(log["id"]).cb());
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.drawText(w / 2, (h * 0.30).toNumber(), Graphics.FONT_LARGE, "FORJA", Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, (h * 0.58).toNumber(), Graphics.FONT_XTINY, msg, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}

class HomeDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }
    function onBack() {
        System.exit();
        return true;
    }
}

// Reintento de un envío pendiente: si llega, lo borra de la cola.
class PendingSender {
    var id;
    function initialize(logId) {
        id = logId;
    }
    function cb() {
        return self.method(:onDone);
    }
    function onDone(code, data) {
        if (code == 200 || code == 201) { Api.dropPending(id); }
    }
}
