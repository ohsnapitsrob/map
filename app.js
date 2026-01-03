// =====================
// CONFIG (from config.js)
// =====================
const CFG = window.APP_CONFIG || {};
const MAPTILER_KEY = CFG.MAPTILER_KEY;
const MAP_STYLE = CFG.MAP_STYLE || "streets";

if (!MAPTILER_KEY) {
  alert("MAPTILER_KEY is missing. Please set it in config.js");
  throw new Error("Missing MAPTILER_KEY");
}

// =====================
// MAP
// =====================
const map = L.map("map", { preferCanvas: true }).setView([54.5, -2.5], 6);

L.tileLayer(
  `https://api.maptiler.com/maps/${MAP_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
  { maxZoom: 20, attribution: "&copy; MapTiler & OpenStreetMap contributors" }
).addTo(map);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  removeOutsideVisibleBounds: true
});
map.addLayer(cluster);

// =====================
// UI ELEMENTS
// =====================
const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const countEl = document.getElementById("count");
const showAllBtn = document.getElementById("showAll");
const resetBtn = document.getElementById("resetFilter");
const filterLabelEl = document.getElementById("filterLabel");

const tabGroups = document.getElementById("tabGroups");
const tabPlaces = document.getElementById("tabPlaces");
let activeTab = "groups";

tabGroups.onclick = () => {
  activeTab = "groups";
  tabGroups.classList.add("active");
  tabPlaces.classList.remove("active");
  runSearch(searchInput.value.trim());
};

tabPlaces.onclick = () => {
  activeTab = "places";
  tabPlaces.classList.add("active");
  tabGroups.classList.remove("active");
  runSearch(searchInput.value.trim());
};

function setCount(text) {
  countEl.textContent = text;
}

// =====================
// FILTER STATE (for clear UX)
// =====================
let currentFilter = null; // { kind: "Title"|"Collection"|"Type"|"Search", label: string }

function setFilterUI(filter) {
  currentFilter = filter;

  if (!filter) {
    filterLabelEl.style.display = "none";
    filterLabelEl.textContent = "";
    resetBtn.style.display = "none";
    return;
  }

  filterLabelEl.style.display = "inline";
  resetBtn.style.display = "inline-block";

  const label = `${filter.kind}: ${filter.label}`;
  filterLabelEl.textContent = `Filtered by ${label}`;
}

function clearFilters() {
  setFilterUI(null);
  rebuildCluster(allMarkers);
  closeResultsModal();
}

resetBtn.onclick = () => {
  // Keep whatever search text is there, but reset map filtering to "all"
  clearFilters();
};

// =====================
// RESULTS MODAL
// =====================
const resultsModal = document.getElementById("resultsModal");
const resultsCloseBtn = document.getElementById("resultsCloseBtn");

function openResultsModal() {
  resultsModal.classList.add("open");
  resultsModal.setAttribute("aria-hidden", "false");
}
function closeResultsModal() {
  resultsModal.classList.remove("open");
  resultsModal.setAttribute("aria-hidden", "true");
}

resultsCloseBtn.onclick = closeResultsModal;
resultsModal.onclick = (e) => {
  if (e.target === resultsModal) closeResultsModal();
};

// =====================
// LOCATION MODAL
// =====================
const modal = document.getElementById("modal");
const mTitle = document.getElementById("mTitle");
const mMeta = document.getElementById("mMeta");
const mDesc = document.getElementById("mDesc");
const mGallery = document.getElementById("mGallery");
const closeBtn = document.getElementById("closeBtn");

function escapeHtml(s) {
  return (s || "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function chipHtml(kind, label) {
  const k = escapeHtml(kind);
  const l = escapeHtml(label);
  return `<span class="chip" role="button" tabindex="0" data-kind="${k}" data-label="${l}">${l}</span>`;
}

function openLocationModal(loc) {
  mTitle.textContent = loc.title || "";

  // Meta: place/country + clickable chips for type and collections
  const placeBits = [];
  if (loc.place) placeBits.push(loc.place);
  if (loc.country) placeBits.push(loc.country);

  let html = "";
  if (placeBits.length) {
    html += `<span class="meta-text">${escapeHtml(placeBits.join(" • "))}</span>`;
  }

  if (loc.type) {
    html += chipHtml("Type", loc.type);
  }

  const cols = Array.isArray(loc.collections) ? loc.collections : [];
  cols.forEach((c) => {
    if (c) html += chipHtml("Collection", c);
  });

  if (loc.series) {
    html += chipHtml("Title", loc.series);
  }

  mMeta.innerHTML = html;

  mDesc.textContent = loc.description || "";

  mGallery.innerHTML = "";
  const imgs = Array.isArray(loc.images) ? loc.images : [];
  if (!imgs.length) {
    const p = document.createElement("p");
    p.textContent = "No images yet.";
    mGallery.appendChild(p);
  } else {
    imgs.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      mGallery.appendChild(img);
    });
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeLocationModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

closeBtn.onclick = closeLocationModal;
modal.onclick = (e) => {
  if (e.target === modal) closeLocationModal();
};

// Clicking chips in the modal applies a filter
mMeta.addEventListener("click", (e) => {
  const el = e.target.closest("[data-kind][data-label]");
  if (!el) return;
  const kind = el.getAttribute("data-kind");
  const label = el.getAttribute("data-label");
  applyGroupFilter(kind, label);
});

// ESC closes whichever modal is open
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modal.classList.contains("open")) closeLocationModal();
    if (resultsModal.classList.contains("open")) closeResultsModal();
  }
});

// =====================
// DATA + SEARCH
// =====================
let ALL = [];
let allMarkers = [];
let fuseLocations;
let fuseGroups;

const groupsIndex = new Map(); // "Title::X" | "Collection::Y" | "Type::Z" -> Marker[]

function norm(s) {
  return (s || "").toString().trim();
}
function safeArr(a) {
  return Array.isArray(a) ? a : (a ? [a] : []);
}

function rebuildCluster(markers) {
  cluster.clearLayers();
  cluster.addLayers(markers);
  setCount(`${markers.length.toLocaleString()} locations shown`);
}

// Buttons
function showAll() {
  searchInput.value = "";
  setFilterUI(null);
  rebuildCluster(allMarkers);
  closeResultsModal();
}
showAllBtn.onclick = showAll;

// Apply a group filter (called by results + modal chips)
function applyGroupFilter(kind, label) {
  // Reset search text since we’re switching to a filter-by-group action
  // (prevents confusion + meets your “reset then apply one” requirement)
  searchInput.value = "";
  closeResultsModal();

  const key = `${kind}::${label}`;
  const markers = groupsIndex.get(key) || [];

  rebuildCluster(markers);
  setFilterUI({ kind, label });
}

// When user selects a group from results, we filter + show places list
function filterGroupAndListPlaces(kind, label) {
  const key = `${kind}::${label}`;
  const markers = groupsIndex.get(key) || [];

  rebuildCluster(markers);
  setFilterUI({ kind, label });

  // Switch to Places tab and list items
  activeTab = "places";
  tabPlaces.classList.add("active");
  tabGroups.classList.remove("active");

  openResultsModal();
  resultsEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "card";
  header.style.cursor = "default";
  header.innerHTML = `<div class="title">${label}</div>
                      <div class="meta">${kind} • ${markers.length.toLocaleString()} locations</div>`;
  resultsEl.appendChild(header);

  markers.slice(0, 200).forEach((mk) => {
    const loc = mk.__loc;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="title">${escapeHtml(loc.place || "(Unknown place)")}</div>
                      <div class="meta">${escapeHtml(loc.title || "")}${loc.country ? " • " + escapeHtml(loc.country) : ""}</div>`;
    card.onclick = () => {
      map.setView([loc.lat, loc.lng], 16);
      openLocationModal(loc);
    };
    resultsEl.appendChild(card);
  });

  if (markers.length > 200) {
    const more = document.createElement("div");
    more.className = "card";
    more.style.cursor = "default";
    more.innerHTML = `<div class="meta">Showing first 200 places here. (All are still on the map.)</div>`;
    resultsEl.appendChild(more);
  }
}

function runSearch(raw) {
  const query = norm(raw);

  if (!query) {
    closeResultsModal();
    return;
  }

  openResultsModal();
  resultsEl.innerHTML = "";

  // GROUP SEARCH
  if (activeTab === "groups") {
    const hits = fuseGroups.search(query).slice(0, 30);

    if (!hits.length) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try a different search.</div>`;
      resultsEl.appendChild(empty);
      return;
    }

    hits.forEach((r) => {
      const { kind, label, count } = r.item;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="title">${escapeHtml(label)}</div>
                        <div class="meta">${escapeHtml(kind)} • ${count.toLocaleString()} locations</div>`;
      card.onclick = () => filterGroupAndListPlaces(kind, label);
      resultsEl.appendChild(card);
    });

    return;
  }

  // PLACES SEARCH
  const locHits = fuseLocations.search(query).slice(0, 50).map((r) => r.item);

  if (!locHits.length) {
    rebuildCluster([]);
    setFilterUI({ kind: "Search", label: query });

    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try a collection, country, or keyword.</div>`;
    resultsEl.appendChild(empty);
    return;
  }

  // Filter map to hits
  const hitMarkers = locHits
    .slice(0, 2000)
    .map((loc) => loc.__marker)
    .filter(Boolean);

  rebuildCluster(hitMarkers);
  setFilterUI({ kind: "Search", label: query });

  locHits.forEach((loc) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="title">${escapeHtml(loc.place || "(Unknown place)")}</div>
                      <div class="meta">${escapeHtml(loc.title || "")}${loc.country ? " • " + escapeHtml(loc.country) : ""}</div>`;
    card.onclick = () => {
      map.setView([loc.lat, loc.lng], 16);
      openLocationModal(loc);
    };
    resultsEl.appendChild(card);
  });
}

// Search triggers
searchInput.addEventListener("input", () => runSearch(searchInput.value));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSearch(searchInput.value);
  }
});

// =====================
// LOAD DATA
// =====================
fetch("./data/locations.json")
  .then((r) => r.json())
  .then((data) => {
    ALL = data;

    const markersByTitle = new Map();
    const markersByCollection = new Map();
    const markersByType = new Map();

    function addToMapList(mapObj, key, val) {
      const k = norm(key);
      if (!k) return;
      if (!mapObj.has(k)) mapObj.set(k, []);
      mapObj.get(k).push(val);
    }

    ALL.forEach((loc) => {
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

      // Normalise optional fields for consistent search
      loc.title = norm(loc.title);
      loc.place = norm(loc.place);
      loc.country = norm(loc.country);
      loc.type = norm(loc.type);
      loc.series = norm(loc.series);
      loc.description = norm(loc.description);

      loc.collections = safeArr(loc.collections).map(norm).filter(Boolean);
      loc.keywords = safeArr(loc.keywords).map(norm).filter(Boolean);
      loc.aliases = safeArr(loc.aliases).map(norm).filter(Boolean);

      const mk = L.marker([loc.lat, loc.lng]);
      mk.__loc = loc;
      mk.on("click", () => openLocationModal(loc));
      loc.__marker = mk;

      allMarkers.push(mk);

      // Grouping indexes
      addToMapList(markersByTitle, loc.title, mk);
      loc.collections.forEach((c) => addToMapList(markersByCollection, c, mk));
      addToMapList(markersByType, loc.type, mk);
    });

    rebuildCluster(allMarkers);
    setFilterUI(null);

    // Locations search (lots of fields)
    fuseLocations = new Fuse(ALL, {
      threshold: 0.35,
      keys: [
        { name: "title", weight: 3 },
        { name: "collections", weight: 2.3 },
        { name: "series", weight: 1.8 },
        { name: "aliases", weight: 1.8 },
        { name: "place", weight: 1.7 },
        { name: "country", weight: 1.2 },
        { name: "type", weight: 1.1 },
        { name: "keywords", weight: 1.4 },
        { name: "description", weight: 0.8 }
      ]
    });

    // Groups search (Titles + Collections + Types)
    const groups = [];

    markersByTitle.forEach((arr, title) => {
      groups.push({ kind: "Title", label: title, count: arr.length });
      groupsIndex.set(`Title::${title}`, arr);
    });

    markersByCollection.forEach((arr, col) => {
      groups.push({ kind: "Collection", label: col, count: arr.length });
      groupsIndex.set(`Collection::${col}`, arr);
    });

    markersByType.forEach((arr, type) => {
      groups.push({ kind: "Type", label: type, count: arr.length });
      groupsIndex.set(`Type::${type}`, arr);
    });

    fuseGroups = new Fuse(groups, {
      threshold: 0.35,
      keys: ["label", "kind"]
    });
  })
  .catch((err) => {
    console.error(err);
    alert("Failed to load data/locations.json");
  });
