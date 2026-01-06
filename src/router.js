window.App = window.App || {};

App.Router = (function () {
  let locationsById = new Map();
  let dataReady = false;
  let uiReady = false;

  let applyingFromUrl = false;
  let pendingState = null;

  let map = null;
  let mapReady = false;
  let mapDebounce = null;
  let lastMapSig = "";

  function init() {
    window.addEventListener("popstate", () => {
      // Back/forward should restore state, but only once ready
      const st = readUrlState();
      pendingState = st;
      tryApplyPending();
    });

    // Capture initial state; apply once ready
    pendingState = readUrlState();
  }

  function setUiReady() {
    uiReady = true;
    tryApplyPending();
  }

  function setMap(leafletMap) {
    map = leafletMap;
    mapReady = !!map;

    if (mapReady) {
      // Listen for map changes -> URL
      map.on("moveend zoomend", () => {
        if (applyingFromUrl) return;

        if (mapDebounce) clearTimeout(mapDebounce);
        mapDebounce = setTimeout(() => {
          const c = map.getCenter();
          const z = map.getZoom();

          const mlat = round(c.lat, 5);
          const mlng = round(c.lng, 5);
          const mz = Math.round(z);

          const sig = `${mlat},${mlng},${mz}`;
          if (sig === lastMapSig) return;
          lastMapSig = sig;

          onMapViewChanged({ mlat, mlng, mz });
        }, 150);
      });
    }

    // Map being ready might allow applying pending state (if UI+Data are ready too)
    tryApplyPending();
  }

  function setLocationsIndex(allLocs) {
    locationsById = new Map();
    (allLocs || []).forEach((loc) => {
      if (loc && loc.id) locationsById.set(loc.id, loc);
    });

    dataReady = true;
    tryApplyPending();
  }

  function tryApplyPending() {
    // We must not call Search/UI until both exist
    if (!uiReady || !dataReady) return;
    if (!pendingState) return;

    const st = pendingState;
    pendingState = null;
    applyState(st);
  }

  function round(n, dp) {
    const p = Math.pow(10, dp);
    return Math.round(n * p) / p;
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);

    const q = params.get("q") || "";
    const tabRaw = params.get("tab") || "";
    const tab = (tabRaw === "places") ? "places" : "groups"; // default groups

    const fk = params.get("fk") || "";
    const fl = params.get("fl") || "";
    const loc = params.get("loc") || "";

    const rm = params.get("rm") === "1";

    const mlat = params.get("mlat");
    const mlng = params.get("mlng");
    const mz = params.get("mz");

    return {
      q, tab, fk, fl, loc, rm,
      mlat: mlat !== null ? Number(mlat) : null,
      mlng: mlng !== null ? Number(mlng) : null,
      mz: mz !== null ? Number(mz) : null
    };
  }

  function writeUrlState(state, { push = false } = {}) {
    const params = new URLSearchParams();

    if (state.q) params.set("q", state.q);
    if (state.tab === "places") params.set("tab", "places"); // only store non-default

    if (state.fk) params.set("fk", state.fk);
    if (state.fl) params.set("fl", state.fl);
    if (state.loc) params.set("loc", state.loc);

    if (state.rm) params.set("rm", "1");

    if (Number.isFinite(state.mlat)) params.set("mlat", String(state.mlat));
    if (Number.isFinite(state.mlng)) params.set("mlng", String(state.mlng));
    if (Number.isFinite(state.mz)) params.set("mz", String(state.mz));

    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;

    const current = window.location.search ? `?${new URLSearchParams(window.location.search).toString()}` : "";
    const next = qs ? `?${qs}` : "";
    if (current === next) return;

    if (push) history.pushState({}, "", newUrl);
    else history.replaceState({}, "", newUrl);
  }

  function applyState(state) {
    applyingFromUrl = true;

    try {
      // 0) Map view first (safe even if UI stuff is delayed)
      if (mapReady && Number.isFinite(state.mlat) && Number.isFinite(state.mlng) && Number.isFinite(state.mz)) {
        map.setView([state.mlat, state.mlng], state.mz, { animate: false });
        lastMapSig = `${round(state.mlat, 5)},${round(state.mlng, 5)},${Math.round(state.mz)}`;
      }

      // 1) Tab
      App.Search.setActiveTab(state.tab, { skipUrl: true });

      // 2) Filter/search/default
      if (state.fk && state.fl) {
        if (state.rm && state.tab === "places") {
          App.Search.filterGroupAndListPlaces(state.fk, state.fl, { skipUrl: true, openResultsModal: true });
        } else {
          App.Search.applyGroupFilter(state.fk, state.fl, { skipUrl: true, keepSearch: true });
        }
      } else if (state.q) {
        const input = App.UI.getSearchInput();
        input.value = state.q;

        // ✅ Crucial: run search and render results immediately
        App.Search.runSearch(state.q, { skipUrl: true, openResultsModal: state.rm });
      } else {
        App.Search.resetAll({ skipUrl: true });
      }

      // 3) Results modal state if needed
      if (!state.q && !(state.fk && state.fl && state.tab === "places")) {
        if (state.rm) App.UI.openResultsModal({ skipUrl: true });
        else App.UI.closeResultsModal({ skipUrl: true });
      }

      // 4) Location modal
      if (state.loc && locationsById.has(state.loc)) {
        App.Modal.open(locationsById.get(state.loc), { skipUrl: true });
      }
    } finally {
      applyingFromUrl = false;
    }
  }

  // ---- callbacks ----

  function onSearchChanged({ q, tab }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: q || "",
      tab: tab || "groups",
      fk: "", fl: "",
      loc: st.loc || "",
      rm: st.rm,
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: false });
  }

  function onFilterChanged({ kind, label }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: "",
      tab: st.tab || "groups",
      fk: kind || "",
      fl: label || "",
      loc: "",
      rm: st.rm,
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: true });
  }

  function onReset() {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: "", tab: "groups", fk: "", fl: "", loc: "",
      rm: false,
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: true });
  }

  function onLocationOpened(id) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: st.q || "",
      tab: st.tab || "groups",
      fk: st.fk || "",
      fl: st.fl || "",
      loc: id || "",
      rm: st.rm,
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: true });
  }

  function onLocationClosed() {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: st.q || "",
      tab: st.tab || "groups",
      fk: st.fk || "",
      fl: st.fl || "",
      loc: "",
      rm: st.rm,
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: false });
  }

  function onMapViewChanged({ mlat, mlng, mz }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: st.q || "",
      tab: st.tab || "groups",
      fk: st.fk || "",
      fl: st.fl || "",
      loc: st.loc || "",
      rm: st.rm,
      mlat, mlng, mz
    }, { push: false });
  }

  function onResultsModalOpened() {
    if (applyingFromUrl) return;

    const st = readUrlState();
    if (st.rm) return;
    writeUrlState({ ...st, rm: true }, { push: false });
  }

  function onResultsModalClosed() {
    if (applyingFromUrl) return;

    const st = readUrlState();
    if (!st.rm) return;
    writeUrlState({ ...st, rm: false }, { push: false });
  }

  function isApplyingFromUrl() {
    return applyingFromUrl;
  }

  return {
    init,
    setUiReady,
    setMap,
    setLocationsIndex,
    onSearchChanged,
    onFilterChanged,
    onReset,
    onLocationOpened,
    onLocationClosed,
    onMapViewChanged,
    onResultsModalOpened,
    onResultsModalClosed,
    isApplyingFromUrl
  };
})();
