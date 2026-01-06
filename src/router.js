window.App = window.App || {};

App.Router = (function () {
  let locationsById = new Map();
  let dataReady = false;

  let applyingFromUrl = false;
  let pendingState = null;

  function init() {
    window.addEventListener("popstate", () => {
      // Back/forward should restore state
      applyFromUrl();
    });

    // Initial parse (may apply later once data is ready)
    pendingState = readUrlState();
  }

  function setLocationsIndex(allLocs) {
    locationsById = new Map();
    (allLocs || []).forEach((loc) => {
      if (loc && loc.id) locationsById.set(loc.id, loc);
    });

    dataReady = true;

    // Apply initial state once we have data
    if (pendingState) {
      applyState(pendingState);
      pendingState = null;
    } else {
      // If nothing pending, still attempt reading URL (safe)
      applyFromUrl();
    }
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);

    const q = params.get("q") || "";
    const tab = params.get("tab") || "";
    const fk = params.get("fk") || "";
    const fl = params.get("fl") || "";
    const loc = params.get("loc") || "";

    return { q, tab, fk, fl, loc };
  }

  function writeUrlState(state, { push = false } = {}) {
    const params = new URLSearchParams();

    if (state.q) params.set("q", state.q);
    if (state.tab) params.set("tab", state.tab);
    if (state.fk) params.set("fk", state.fk);
    if (state.fl) params.set("fl", state.fl);
    if (state.loc) params.set("loc", state.loc);

    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;

    // Avoid churn if unchanged
    const current = window.location.search ? `?${new URLSearchParams(window.location.search).toString()}` : "";
    const next = qs ? `?${qs}` : "";
    if (current === next) return;

    if (push) history.pushState({}, "", newUrl);
    else history.replaceState({}, "", newUrl);
  }

  function applyFromUrl() {
    if (!dataReady) {
      pendingState = readUrlState();
      return;
    }
    applyState(readUrlState());
  }

  function applyState(state) {
    if (!dataReady) return;

    applyingFromUrl = true;

    try {
      // 1) Tab
      if (state.tab === "places" || state.tab === "groups") {
        App.Search.setActiveTab(state.tab, { skipUrl: true });
      }

      // 2) Filter (group filter)
      if (state.fk && state.fl) {
        App.Search.applyGroupFilter(state.fk, state.fl, { skipUrl: true, keepSearch: true });
      } else if (state.q) {
        // 3) Search
        const input = App.UI.getSearchInput();
        input.value = state.q;
        App.Search.runSearch(state.q, { skipUrl: true });
      } else {
        // 4) Default view
        App.Search.resetAll({ skipUrl: true });
      }

      // 5) Location modal
      if (state.loc && locationsById.has(state.loc)) {
        const locObj = locationsById.get(state.loc);
        // Open modal for that location
        App.Modal.open(locObj, { skipUrl: true });
      }
    } finally {
      applyingFromUrl = false;
    }
  }

  // Public API used by Search + Modal
  function onSearchChanged({ q, tab }) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: q || "",
      tab: tab || "",
      fk: "", fl: "",
      loc: st.loc || ""
    }, { push: false });
  }

  function onFilterChanged({ kind, label }) {
    if (applyingFromUrl) return;

    writeUrlState({
      q: "",
      tab: "",
      fk: kind || "",
      fl: label || "",
      loc: ""
    }, { push: true });
  }

  function onReset() {
    if (applyingFromUrl) return;
    writeUrlState({ q: "", tab: "", fk: "", fl: "", loc: "" }, { push: true });
  }

  function onLocationOpened(id) {
    if (applyingFromUrl) return;

    const st = readUrlState();
    writeUrlState({
      q: st.q || "",
      tab: st.tab || "",
      fk: st.fk || "",
      fl: st.fl || "",
      loc: id || ""
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
      loc: ""
    }, { push: false });
  }

  function isApplyingFromUrl() {
    return applyingFromUrl;
  }

  return {
    init,
    setLocationsIndex,
    onSearchChanged,
    onFilterChanged,
    onReset,
    onLocationOpened,
    onLocationClosed,
    isApplyingFromUrl
  };
})();
