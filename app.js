// app.js (boot)
window.App = window.App || {};

(function boot() {
  try {
    App.State.init();
    App.Router.init();

    App.Map.init();
    App.Router.setMap(App.Map.getMap());

    App.Modal.init();
    App.UI.init();
    App.Search.init();

    // ✅ NEW: tells Router it can now safely apply URL state that calls UI/Search
    App.Router.setUiReady();

    App.Data.init();
  } catch (e) {
    console.error(e);
    alert("App failed to start. Check console for details.");
  }
})();
