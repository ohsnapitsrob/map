(function () {
  const {
    norm,
    escapeHtml,
    displayType,
    typeColor
  } = FTS.Utils;

  const {
    loadAll,
    buildTitleUrl
  } = FTS.Locations;

  const listEl = document.getElementById("browseList");
  const searchEl = document.getElementById("browseSearch");
  const sortEl = document.getElementById("browseSort");
  const countEl = document.getElementById("browseCount");

  let allEntries = [];

  function sceneLabel(number) {
    return `${number} scene${number === 1 ? "" : "s"}`;
  }

  function summaryLabel(titleCount, sceneCount) {
    return `${titleCount.toLocaleString()} title${titleCount === 1 ? "" : "s"}, ${sceneCount.toLocaleString()} scene${sceneCount === 1 ? "" : "s"}`;
  }

  function compareTitleAsc(a, b) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }

  function compareTypeAsc(a, b) {
    return a.type.localeCompare(b.type, undefined, { sensitivity: "base" });
  }

  function sortMost(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    const titleCompare = compareTitleAsc(a, b);
    if (titleCompare !== 0) return titleCompare;
    return compareTypeAsc(a, b);
  }

  function sortAZ(a, b) {
    const titleCompare = compareTitleAsc(a, b);
    if (titleCompare !== 0) return titleCompare;
    return compareTypeAsc(a, b);
  }

  function sortZA(a, b) {
    const titleCompare = compareTitleAsc(b, a);
    if (titleCompare !== 0) return titleCompare;
    return compareTypeAsc(a, b);
  }

  function sortVisitedLatest(a, b) {
    const aHas = Number.isFinite(a.latestVisitedTs);
    const bHas = Number.isFinite(b.latestVisitedTs);
    if (aHas && bHas && b.latestVisitedTs !== a.latestVisitedTs) return b.latestVisitedTs - a.latestVisitedTs;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return sortAZ(a, b);
  }

  function sortVisitedOldest(a, b) {
    const aHas = Number.isFinite(a.latestVisitedTs);
    const bHas = Number.isFinite(b.latestVisitedTs);
    if (aHas && bHas && a.latestVisitedTs !== b.latestVisitedTs) return a.latestVisitedTs - b.latestVisitedTs;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return sortAZ(a, b);
  }

  function getSorted(entries, sortMode) {
    const copy = [...entries];
    if (sortMode === "az") return copy.sort(sortAZ);
    if (sortMode === "za") return copy.sort(sortZA);
    if (sortMode === "visited-latest") return copy.sort(sortVisitedLatest);
    if (sortMode === "visited-oldest") return copy.sort(sortVisitedOldest);
    return copy.sort(sortMost);
  }

  function render(entries) {
    listEl.innerHTML = "";
    const titleCount = entries.length;
    const sceneCount = entries.reduce((sum, entry) => sum + entry.count, 0);
    countEl.textContent = summaryLabel(titleCount, sceneCount);
    if (!entries.length) {
      listEl.innerHTML = `<div class="browse-empty">No matches.</div>`;
      return;
    }
    entries.forEach((entry) => {
      const link = document.createElement("a");
      link.className = "browse-row";
      link.href = buildTitleUrl(entry.title);
      link.innerHTML = `
        <div class="browse-marker" style="background:${escapeHtml(typeColor(entry.type))};"></div>
        <div class="browse-main">
          <div class="browse-title">${escapeHtml(entry.title)}</div>
        </div>
        <div class="browse-type">${escapeHtml(displayType(entry.type))}</div>
        <div class="browse-scenes">${sceneLabel(entry.count)}</div>
      `;
      listEl.appendChild(link);
    });
  }

  function applyControls() {
    const query = norm(searchEl.value).toLowerCase();
    const sortMode = sortEl.value || "most";
    let filtered = allEntries;
    if (query) {
      filtered = filtered.filter((entry) => (
        entry.title.toLowerCase().includes(query) ||
        displayType(entry.type).toLowerCase().includes(query) ||
        entry.cities.some((city) => city.toLowerCase().includes(query)) ||
        entry.countries.some((country) => country.toLowerCase().includes(query))
      ));
    }
    render(getSorted(filtered, sortMode));
  }

  function buildEntries(rows) {
    const grouped = new Map();
    rows.forEach((location) => {
      const key = `${location.title}|||${location.type}`;
      if (!grouped.has(key)) {
        grouped.set(key, { title: location.title, type: location.type, count: 0, latestVisitedTs: null, cities: new Set(), countries: new Set() });
      }
      const entry = grouped.get(key);
      entry.count += 1;
      if (location.city) entry.cities.add(location.city);
      if (location.country) entry.countries.add(location.country);
      if (Number.isFinite(location.visitedTs)) {
        if (!Number.isFinite(entry.latestVisitedTs) || location.visitedTs > entry.latestVisitedTs) entry.latestVisitedTs = location.visitedTs;
      }
    });
    return Array.from(grouped.values()).map((entry) => ({ ...entry, cities: Array.from(entry.cities), countries: Array.from(entry.countries) }));
  }

  async function loadBrowseRows() {
    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicScenes : scenePacks.allScenes;
    }

    const rows = await loadAll();
    return FTS.Visibility?.getVisibleScenes?.(rows) || rows;
  }

  async function init() {
    try {
      listEl.innerHTML = `<div class="fts-loader" aria-label="Loading"></div>`;
      const rows = await loadBrowseRows();
      allEntries = buildEntries(rows);
      searchEl.addEventListener("input", applyControls);
      sortEl.addEventListener("change", applyControls);
      applyControls();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div class="browse-empty">Could not load browse index.</div>`;
      countEl.textContent = "";
    }
  }

  init();
})();
