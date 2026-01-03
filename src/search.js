window.App = window.App || {};

App.Search = (function () {
  let activeTab = "groups";
  let fuseLocations = null;
  let fuseGroups = null;
  let groupsIndex = null; // Map key -> Marker[]
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

  function setActiveTab(which) {
    activeTab = (which === "places") ? "places" : "groups";
    App.UI.setActiveTabUI(activeTab);

    const input = App.UI.getSearchInput();
    const q = (input.value || "").trim();
    if (q) runSearch(q);
  }

  function showAll() {
    const input = App.UI.getSearchInput();
    input.value = "";
    App.State.clearFilter();
    App.Map.rebuildCluster(allMarkers);
    App.UI.closeResultsModal();
  }

  // Reset filter only (keeps whatever’s in the search box)
  function resetOnly() {
    App.State.clearFilter();
    App.Map.rebuildCluster(allMarkers);
    App.UI.closeResultsModal();
  }

  function applyGroupFilter(kind, label) {
    const input = App.UI.getSearchInput();
    input.value = ""; // per your requirement: reset search then apply the group filter
    App.UI.closeResultsModal();

    const key = `${kind}::${label}`;
    const markers = (groupsIndex && groupsIndex.get(key)) ? groupsIndex.get(key) : [];

    App.State.setFilter({ kind, label });
    App.Map.rebuildCluster(markers);
  }

  function filterGroupAndListPlaces(kind, label) {
    const key = `${kind}::${label}`;
    const markers = (groupsIndex && groupsIndex.get(key)) ? groupsIndex.get(key) : [];

    App.State.setFilter({ kind, label });
    App.Map.rebuildCluster(markers);

    // switch to places view & list places
    setActiveTab("places");
    App.UI.openResultsModal();
    App.UI.renderPlacesListForGroup(kind, label, markers);
  }

  function runSearch(raw) {
    const query = (raw || "").toString().trim();
    if (!query) {
      App.UI.closeResultsModal();
      return;
    }

    App.UI.openResultsModal();

    if (activeTab === "groups") {
      const hits = fuseGroups ? fuseGroups.search(query).slice(0, 30).map(r => r.item) : [];
      App.UI.renderGroupResults(hits);
      return;
    }

    const locHits = fuseLocations ? fuseLocations.search(query).slice(0, 50).map(r => r.item) : [];

    // filter map to hits (cap for perf)
    const hitMarkers = locHits
      .slice(0, 2000)
      .map(loc => loc.__marker)
      .filter(Boolean);

    App.State.setFilter({ kind: "Search", label: query });
    App.Map.rebuildCluster(hitMarkers);

    App.UI.renderPlaceResults(locHits);
  }

  return {
    init,
    setData,
    setActiveTab,
    runSearch,
    showAll,
    resetOnly,
    applyGroupFilter,
    filterGroupAndListPlaces
  };
})();
