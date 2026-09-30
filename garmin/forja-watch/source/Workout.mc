using Toybox.Time;
using Toybox.Lang;
using Toybox.ActivityRecording;
using Toybox.Attention;

// Estado de UN entrenamiento en el reloj: qué ejercicio/serie toca, los
// valores que se están ajustando y lo ya registrado.
class Workout {
    var day;
    var exs;
    var exIdx = 0;
    var setIdx = 0;
    var focus = 0;              // 0 = peso, 1 = reps, 2 = RIR
    var vals;                   // [peso, reps, rir]
    var logged;                 // por ejercicio: [[peso, reps, rir, esAprox]]
    var startEpoch;
    var session = null;
    var finished = false;
    var sent = 0;               // 0 = enviando, 1 = enviado, 2 = queda pendiente
    var log = null;

    function initialize(dayDict) {
        day = dayDict;
        exs = dayDict["e"];
        startEpoch = Time.now().value();
        logged = new [exs.size()];
        for (var i = 0; i < exs.size(); i++) { logged[i] = []; }
        vals = [0.0, 8, 2];
        prefill();
        if (Toybox has :ActivityRecording) {
            try {
                session = ActivityRecording.createSession({
                    :name => "Fuerza FORJA",
                    :sport => ActivityRecording.SPORT_TRAINING,
                    :subSport => ActivityRecording.SUB_SPORT_STRENGTH_TRAINING
                });
                session.start();
            } catch (e) {
                session = null;
            }
        }
    }

    // ---------- helpers ----------
    static function toF(x) {
        return (x == null) ? 0.0 : x.toFloat();
    }

    // Primer número que aparece en un texto ("8-10" → 8).
    static function firstInt(s, dflt) {
        if (s == null) { return dflt; }
        var str = s.toString();
        var n = 0;
        var got = false;
        for (var i = 0; i < str.length(); i++) {
            var d = "0123456789".find(str.substring(i, i + 1));
            if (d != null) { n = n * 10 + d; got = true; }
            else if (got) { break; }
        }
        return got ? n : dflt;
    }

    static function fmtW(w) {
        var n = w.toNumber();
        if (w == n.toFloat()) { return n.toString(); }
        return w.format("%.1f");
    }

    function ex() { return exs[exIdx]; }
    function sets() { return exs[exIdx]["s"]; }
    function curSet() { return exs[exIdx]["s"][setIdx]; }
    function isWarm() { return curSet()["t"] != null && curSet()["t"].equals("w"); }
    function doneInEx(i) { return logged[i].size(); }

    function lastWork(i) {
        var l = logged[i];
        for (var k = l.size() - 1; k >= 0; k--) {
            if (l[k][3] == 0) { return l[k]; }
        }
        return null;
    }

    // Deja en pantalla los valores sugeridos para la serie actual.
    function prefill() {
        var st = curSet();
        var w = toF(st["w"]);
        var last = lastWork(exIdx);
        if (last != null && (!isWarm() || w == 0.0)) { w = last[0]; }
        var r = firstInt(st["r"], (st["l"] != null) ? st["l"] : 8);
        var q = firstInt(st["q"], 2);
        vals = [w, r, q];
        focus = 0;
    }

    function adjust(dir) {
        if (focus == 0) {
            var w = vals[0] + dir * 2.5;
            vals[0] = (w < 0.0) ? 0.0 : w;
        } else if (focus == 1) {
            var r = vals[1] + dir;
            vals[1] = (r < 0) ? 0 : ((r > 99) ? 99 : r);
        } else {
            var q = vals[2] + dir;
            vals[2] = (q < 0) ? 0 : ((q > 6) ? 6 : q);
        }
    }

    // Registra la serie actual. Devuelve los segundos de descanso (0 si terminó todo).
    function commit() {
        var st = curSet();
        var warm = isWarm();
        logged[exIdx].add([vals[0], vals[1], vals[2], warm ? 1 : 0]);
        var rest = warm ? 45 : (ex()["rt"] != null ? ex()["rt"] : 90);
        var lastOfEx = (setIdx >= sets().size() - 1);
        if (lastOfEx) {
            if (exIdx >= exs.size() - 1) {
                finished = true;
                return 0;
            }
            exIdx += 1;
            setIdx = firstPending(exIdx);
        } else {
            setIdx += 1;
        }
        prefill();
        return rest;
    }

    function firstPending(i) {
        var n = logged[i].size();
        var total = exs[i]["s"].size();
        return (n >= total) ? total - 1 : n;
    }

    function gotoEx(delta) {
        var n = exIdx + delta;
        if (n < 0 || n >= exs.size()) { return false; }
        exIdx = n;
        setIdx = firstPending(exIdx);
        prefill();
        return true;
    }

    function totalLogged() {
        var t = 0;
        for (var i = 0; i < logged.size(); i++) { t += logged[i].size(); }
        return t;
    }

    function elapsedSec() {
        return Time.now().value() - startEpoch;
    }

    // ---------- cierre ----------
    function buildLog() {
        var e = [];
        for (var i = 0; i < exs.size(); i++) {
            if (logged[i].size() > 0) {
                e.add({ "i" => exs[i]["i"], "n" => exs[i]["n"], "s" => logged[i] });
            }
        }
        var mins = elapsedSec() / 60;
        if (mins < 1) { mins = 1; }
        return {
            "id" => startEpoch.toString(),
            "t" => startEpoch,
            "d" => day["id"],
            "dn" => day["n"],
            "m" => mins,
            "e" => e
        };
    }

    function save() {
        if (session != null) {
            try { session.stop(); session.save(); } catch (e) { }
            session = null;
        }
        log = buildLog();
        if (log["e"].size() == 0) { sent = 1; return; }
        Api.postLog(log, method(:onPosted));
    }

    function onPosted(code, data) {
        if (code == 200 || code == 201) {
            sent = 1;
        } else {
            Api.addPending(log);
            sent = 2;
        }
        Toybox.WatchUi.requestUpdate();
    }

    function discard() {
        if (session != null) {
            try { session.stop(); session.discard(); } catch (e) { }
            session = null;
        }
    }

    // ---------- avisos ----------
    static function buzz(ms) {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(100, ms)]);
        }
    }
    static function beep() {
        if (Attention has :playTone) {
            Attention.playTone(Attention.TONE_ALERT_HI);
        }
    }
}
