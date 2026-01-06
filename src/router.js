window.App = window.App || {};

App.Router = (function () {
  let locationsById = new Map();
  let dataReady = false;

  let applyingFromUrl = false;
  let pendingState = null;

  let map = null;
  let mapReady = false;
  let mapDebounce = null;
  let lastMapSig = "";

  function init() {
    window.addEventListener("popstate", () => {
      applyFromUrl();
    });

    pendingState = readUrlState();
  }

  function setMap(leafletMap) {
    map = leafletMap;
    mapReady = !!map;
    if (!mapReady) return;

    // apply any pending URL state once map exists
    if (pendingState) {
      applyState(pendingState);
      pendingState = null;
    } else {
      applyFromUrl();
    }

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

  function setLocationsIndex(allLocs) {
    locationsById = new Map();
    (allLocs || []).forEach((loc) => {
      if (loc && loc.id) locationsById.set(loc.id, loc);
    });

    dataReady = true;

    if (pendingState) {
      applyState(pendingState);
      pendingState = null;
    } else {
      applyFromUrl();
    }
  }

  function round(n, dp) {
    const p = Math.pow(10, dp);
    return Math.round(n * p) / p;
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);

    const q = params.get("q") || "";
    const tab = params.get("tab") || "";
    const fk = params.get("fk") || "";
    const fl = params.get("fl") || "";
    const loc = params.get("loc") || "";

    const rm = params.get("rm") === "1"; // ✅ results modal open/closed

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
    if (state.tab) params.set("tab", state.tab);
    if (state.fk) params.set("fk", state.fk);
    if (state.fl) params.set("fl", state.fl);
    if (state.loc) params.set("loc", state.loc);

    if (state.rm) params.set("rm", "1"); // ✅

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

  function applyFromUrl() {
    const st = readUrlState();
    applyState(st);
  }

  function applyState(state) {
    applyingFromUrl = true;

    try {
      // 0) Map view first
      if (mapReady && Number.isFinite(state.mlat) && Number.isFinite(state.mlng) && Number.isFinite(state.mz)) {
        map.setView([state.mlat, state.mlng], state.mz, { animate: false });
        lastMapSig = `${round(state.mlat, 5)},${round(state.mlng, 5)},${Math.round(state.mz)}`;
      }

      // If data not ready, stop here (it will re-apply on setLocationsIndex)
      if (!dataReady) return;

      // 1) Tab (defaults to groups)
      if (state.tab === "places" || state.tab === "groups") {
        App.Search.setActiveTab(state.tab, { skipUrl: true });
      }

      // 2) Apply filter/search/default, controlling whether results modal is open
      if (state.fk && state.fl) {
        // If rm=1 and tab=places, show the places list for that group (like clicking a group result)
        if (state.rm && state.tab === "places") {
          App.Search.filterGroupAndListPlaces(state.fk, state.fl, { skipUrl: true, openResultsModal: true });
        } else {
          App.Search.applyGroupFilter(state.fk, state.fl, { skipUrl: true, keepSearch: true });
        }
      } else if (state.q) {
        const input = App.UI.getSearchInput();
        input.value = state.q;
        App.Search.runSearch(state.q, { skipUrl: true, openResultsModal: state.rm });
      } else {
        App.Search.resetAll({ skipUrl: true });
      }

      // 3) Ensure results modal matches rm if no search just ran
      if (!state.q && !(state.fk && state.fl && state.tab === "places")) {
        if (state.rm) App.UI.openResultsModal({ skipUrl: true });
        else App.UI.closeResultsModal({ skipUrl: true });
      }

      // 4) Location modal
      if (state.loc && locationsById.has(state.loc)) {
        const locObj = locationsById.get(state.loc);
        App.Modal.open(locObj, { skipUrl: true });
      }
    } finally {
      applyingFromUrl = false;
    }
  }

  // ---- Public API used by Search + Modal + UI ----

  function onSearchChanged({ q, tab }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: q || "",
      tab: tab || "",
      fk: "", fl: "",
      loc: st.loc || "",
      rm: st.rm, // keep open/closed state
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: false });
  }

  function onFilterChanged({ kind, label }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: "",
      tab: st.tab || "",
      fk: kind || "",
      fl: label || "",
      loc: "",
      rm: st.rm, // keep results open/closed
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: true });
  }

  function onReset() {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: "", tab: "", fk: "", fl: "", loc: "",
      rm: false, // reset closes results modal
      mlat: st.mlat, mlng: st.mlng, mz: st.mz
    }, { push: true });
  }

  function onLocationOpened(id) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: st.q || "",
      tab: st.tab || "",
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
      tab: st.tab || "",
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
      tab: st.tab || "",
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
