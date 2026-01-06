window.App = window.App || {};

App.Search = (function () {
  let activeTab = "groups";
  let fuseLocations = null;
  let fuseGroups = null;
  let groupsIndex = null;
  let allMarkers = [];

  function init() {
    const input = App.UI.getSearchInput();

    input.addEventListener("input", () => runSearch(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch(input.value);
      }
    });

    setActiveTab("groups");
  }

  function setData({ fuseLoc, fuseGrp, groupsIdx, allMk }) {
    fuseLocations = fuseLoc;
    fuseGroups = fuseGrp;
    groupsIndex = groupsIdx;
    allMarkers = allMk;
  }

  function setActiveTab(which, opts = {}) {
    activeTab = (which === "places") ? "places" : "groups";
    App.UI.setActiveTabUI(activeTab);

    if (!opts.skipUrl) {
      const q = (App.UI.getSearchInput().value || "").trim();
      App.Router.onSearchChanged({ q, tab: activeTab });
    }

    const input = App.UI.getSearchInput();
    const q = (input.value || "").trim();
    if (q) runSearch(q, opts);
  }

  function resetAll(opts = {}) {
    const input = App.UI.getSearchInput();
    input.value = "";

    App.State.clearFilter();
    App.Map.rebuildCluster(allMarkers);
    App.UI.closeResultsModal({ skipUrl: true }); // reset should close results
    App.Modal.close?.();

    if (!opts.skipUrl) App.Router.onReset();
  }

  function applyGroupFilter(kind, label, opts = {}) {
    const input = App.UI.getSearchInput();

    if (!opts.keepSearch) input.value = "";
    App.UI.closeResultsModal({ skipUrl: opts.skipUrl }); // keep URL in sync if closing via user action

    const key = `${kind}::${label}`;
    const markers = (groupsIndex && groupsIndex.get(key)) ? groupsIndex.get(key) : [];

    App.State.setFilter({ kind, label });
    App.Map.rebuildCluster(markers);

    if (!opts.skipUrl) App.Router.onFilterChanged({ kind, label });
  }

  function filterGroupAndListPlaces(kind, label, opts = {}) {
    // Apply the filter
    applyGroupFilter(kind, label, { ...opts, keepSearch: true });

    setActiveTab("places", opts);

    const key = `${kind}::${label}`;
    const markers = (groupsIndex && groupsIndex.get(key)) ? groupsIndex.get(key) : [];

    if (opts.openResultsModal === false) {
      App.UI.closeResultsModal({ skipUrl: opts.skipUrl });
    } else {
      App.UI.openResultsModal({ skipUrl: opts.skipUrl });
    }

    App.UI.renderPlacesListForGroup(kind, label, markers);
  }

  function runSearch(raw, opts = {}) {
    const query = (raw || "").toString().trim();
    if (!query) {
      App.UI.closeResultsModal({ skipUrl: opts.skipUrl });
      return;
    }

    if (opts.openResultsModal === false) {
      App.UI.closeResultsModal({ skipUrl: opts.skipUrl });
    } else {
      App.UI.openResultsModal({ skipUrl: opts.skipUrl });
    }

    if (activeTab === "groups") {
      const hits = fuseGroups ? fuseGroups.search(query).slice(0, 30).map(r => r.item) : [];
      App.UI.renderGroupResults(hits);

      if (!opts.skipUrl) App.Router.onSearchChanged({ q: query, tab: activeTab });
      return;
    }

    const locHits = fuseLocations ? fuseLocations.search(query).slice(0, 50).map(r => r.item) : [];
    const hitMarkers = locHits.slice(0, 2000).map(loc => loc.__marker).filter(Boolean);

    App.State.setFilter({ kind: "Search", label: query });
    App.Map.rebuildCluster(hitMarkers);
    App.UI.renderPlaceResults(locHits);

    if (!opts.skipUrl) App.Router.onSearchChanged({ q: query, tab: activeTab });
  }

  return {
    init,
    setData,
    setActiveTab,
    runSearch,
    resetAll,
    applyGroupFilter,
    filterGroupAndListPlaces
  };
})();
