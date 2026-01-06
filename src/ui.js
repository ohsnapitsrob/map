window.App = window.App || {};

App.UI = (function () {
  let searchInput, resultsEl, countEl, resetBtn, filterLabelEl;
  let resultsModal, resultsCloseBtn;
  let tabGroups, tabPlaces;

  function init() {
    searchInput = document.getElementById("search");
    resultsEl = document.getElementById("results");
    countEl = document.getElementById("count");
    resetBtn = document.getElementById("resetFilter");
    filterLabelEl = document.getElementById("filterLabel");

    resultsModal = document.getElementById("resultsModal");
    resultsCloseBtn = document.getElementById("resultsCloseBtn");

    tabGroups = document.getElementById("tabGroups");
    tabPlaces = document.getElementById("tabPlaces");

    resultsCloseBtn.onclick = () => closeResultsModal();
    resultsModal.onclick = (e) => { if (e.target === resultsModal) closeResultsModal(); };

    resetBtn.onclick = () => App.Search.resetAll();

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && resultsModal.classList.contains("open")) closeResultsModal();
    });

    tabGroups.onclick = () => App.Search.setActiveTab("groups");
    tabPlaces.onclick = () => App.Search.setActiveTab("places");
  }

  function getSearchInput() {
    return searchInput;
  }

  function setCount(text) {
    countEl.textContent = text;
  }

  function setFilterUI(filter) {
    if (!filter) {
      filterLabelEl.style.display = "none";
      filterLabelEl.textContent = "";
      resetBtn.style.display = "none";
      return;
    }

    filterLabelEl.style.display = "inline";
    resetBtn.style.display = "inline-block";
    filterLabelEl.textContent = `Filtered by ${filter.kind}: ${filter.label}`;
  }

  function openResultsModal(opts = {}) {
    resultsModal.classList.add("open");
    resultsModal.setAttribute("aria-hidden", "false");

    if (!opts.skipUrl) App.Router.onResultsModalOpened();
  }

  function closeResultsModal(opts = {}) {
    resultsModal.classList.remove("open");
    resultsModal.setAttribute("aria-hidden", "true");

    if (!opts.skipUrl) App.Router.onResultsModalClosed();
  }

  function clearResults() {
    resultsEl.innerHTML = "";
  }

  function setActiveTabUI(which) {
    if (which === "groups") {
      tabGroups.classList.add("active");
      tabPlaces.classList.remove("active");
    } else {
      tabPlaces.classList.add("active");
      tabGroups.classList.remove("active");
    }
  }

  function addCard({ title, meta, onClick, cursorDefault }) {
    const card = document.createElement("div");
    card.className = "card";
    if (cursorDefault) card.style.cursor = "default";
    card.innerHTML = `<div class="title">${title}</div>${meta ? `<div class="meta">${meta}</div>` : ""}`;
    if (onClick) card.onclick = onClick;
    resultsEl.appendChild(card);
  }

  function renderGroupResults(items) {
    clearResults();
    if (!items.length) {
      addCard({ title: "No matches", meta: "Try a different search.", cursorDefault: true });
      return;
    }

    items.forEach((it) => {
      addCard({
        title: App.Modal.escapeHtml(it.label),
        meta: `${App.Modal.escapeHtml(it.kind)} • ${it.count.toLocaleString()} locations`,
        onClick: () => App.Search.filterGroupAndListPlaces(it.kind, it.label)
      });
    });
  }

  function renderPlaceResults(locs) {
    clearResults();
    if (!locs.length) {
      addCard({ title: "No matches", meta: "Try a collection, country, or keyword.", cursorDefault: true });
      return;
    }

    locs.forEach((loc) => {
      addCard({
        title: App.Modal.escapeHtml(loc.place || "(Unknown place)"),
        meta: `${App.Modal.escapeHtml(loc.title || "")}${loc.country ? " • " + App.Modal.escapeHtml(loc.country) : ""}`,
        onClick: () => {
          closeResultsModal();
          App.Map.getMap().setView([loc.lat, loc.lng], 16);
          App.Modal.open(loc);
        }
      });
    });
  }

  function renderPlacesListForGroup(kind, label, markers) {
    clearResults();

    addCard({
      title: App.Modal.escapeHtml(label),
      meta: `${App.Modal.escapeHtml(kind)} • ${markers.length.toLocaleString()} locations`,
      cursorDefault: true
    });

    markers.slice(0, 200).forEach((mk) => {
      const loc = mk.__loc;
      addCard({
        title: App.Modal.escapeHtml(loc.place || "(Unknown place)"),
        meta: `${App.Modal.escapeHtml(loc.title || "")}${loc.country ? " • " + App.Modal.escapeHtml(loc.country) : ""}`,
        onClick: () => {
          closeResultsModal();
          App.Map.getMap().setView([loc.lat, loc.lng], 16);
          App.Modal.open(loc);
        }
      });
    });

    if (markers.length > 200) {
      addCard({
        title: "More locations…",
        meta: "Showing first 200 places here. (All are still on the map.)",
        cursorDefault: true
      });
    }
  }

  return {
    init,
    getSearchInput,
    setCount,
    setFilterUI,
    setActiveTabUI,
    openResultsModal,
    closeResultsModal,
    renderGroupResults,
    renderPlaceResults,
    renderPlacesListForGroup
  };
})();
