window.App = window.App || {};

App.Map = (function () {
  let map;
  let cluster;

  function init() {
    const CFG = window.APP_CONFIG || {};
    const MAPTILER_KEY = CFG.MAPTILER_KEY;
    const MAP_STYLE = CFG.MAP_STYLE || "streets";

    if (!MAPTILER_KEY) {
      alert("MAPTILER_KEY is missing. Set it in config.js");
      throw new Error("Missing MAPTILER_KEY");
    }

    map = L.map("map", { preferCanvas: true }).setView([54.5, -2.5], 6);

    L.tileLayer(
      `https://api.maptiler.com/maps/${MAP_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      { maxZoom: 20, attribution: "&copy; MapTiler & OpenStreetMap contributors" }
    ).addTo(map);

    cluster = L.markerClusterGroup({
      chunkedLoading: true,
      removeOutsideVisibleBounds: true
    });

    map.addLayer(cluster);
  }

  function getMap() {
    return map;
  }

  function rebuildCluster(markers) {
    cluster.clearLayers();
    cluster.addLayers(markers);
    App.UI.setCount(`${markers.length.toLocaleString()} locations shown`);
  }

  return { init, getMap, rebuildCluster };
})();
