using Toybox.Communications;
using Toybox.Application;
using Toybox.Application.Storage;

// Acceso a la base de FORJA (Supabase). La clave es la pública («anon») que
// ya viaja dentro de la app web: solo puede leer/escribir la tabla forja_kv.
module Api {
    const SB_URL = "https://vzenlmcbftopyjzcltxa.supabase.co/rest/v1/forja_kv";
    const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW5sbWNiZnRvcHlqemNsdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjQ5NDksImV4cCI6MjA5ODI0MDk0OX0.CWCrsDVuFEsq3QiAYHRYmsRrD6AI2M7o6ofRUQJXUyY";

    function studentId() {
        var v = Application.Properties.getValue("studentId");
        return (v != null) ? v.toString() : "";
    }

    function baseHeaders() {
        return {
            "apikey" => SB_KEY,
            "Authorization" => "Bearer " + SB_KEY,
            "Accept" => "application/vnd.pgrst.object+json"
        };
    }

    // Trae la rutina compacta que publica FORJA en forja-watch:<código>.
    // Respuesta: { "value": { ...plan... } }
    function fetchPlan(cb) {
        var params = { "key" => "eq.forja-watch:" + studentId(), "select" => "value" };
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => baseHeaders(),
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(SB_URL, params, options, cb);
    }

    // Deja una sesión terminada en forja-watchlog:<código>:<id>. FORJA la
    // importa al historial cuando se abre y borra la clave.
    function postLog(log, cb) {
        var headers = baseHeaders();
        headers.put("Content-Type", Communications.REQUEST_CONTENT_TYPE_JSON);
        headers.put("Prefer", "resolution=merge-duplicates,return=representation");
        var body = { "key" => "forja-watchlog:" + studentId() + ":" + log["id"], "value" => log };
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => headers,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(SB_URL, body, options, cb);
    }

    // ---- Sesiones que no pudieron enviarse (sin señal): se reintentan al abrir ----
    function pending() {
        var p = Storage.getValue("pend");
        return (p != null) ? p : [];
    }
    function addPending(log) {
        var p = pending();
        p.add(log);
        Storage.setValue("pend", p);
    }
    function dropPending(id) {
        var p = pending();
        var out = [];
        for (var i = 0; i < p.size(); i++) {
            if (!p[i]["id"].equals(id)) { out.add(p[i]); }
        }
        Storage.setValue("pend", out);
    }
}
