// app.js (boot)
window.App = window.App || {};

(async function boot() {
  try {
    await window.FTS?.Boot?.ready?.({ scenePacks: true });

    App.State.init();
    App.Router.init();

    App.Map.init();
    App.Router.setMap(App.Map.getMap());

    App.Modal.init();
    App.UI.init();
    App.Search.init();

    App.Router.setUiReady();

    await App.Data.init();
  } catch (e) {
    console.error(e);
    alert("App failed to start. Check console for details.");
  }
})();
