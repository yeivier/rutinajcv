using Toybox.Application;
using Toybox.WatchUi;

class ForjaApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        return [ new HomeView(), new HomeDelegate() ];
    }

    function onSettingsChanged() {
        WatchUi.requestUpdate();
    }
}

function getApp() {
    return Application.getApp();
}
