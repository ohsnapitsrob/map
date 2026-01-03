// =====================
// CONFIG
// =====================
const MAPTILER_KEY = "4iGDVzk2f6BFmiqgFyyU";
const MAP_STYLE = "streets";

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

function openModal(loc) {
  mTitle.textContent = loc.title || "";
  mMeta.textContent = `${loc.place || ""}${loc.country ? " • " + loc.country : ""}`;
  mDesc.textContent = loc.description || "";

  mGallery.innerHTML = "";
  if (!loc.images || !loc.images.length) {
    const p = document.createElement("p");
    p.textContent = "No images yet.";
    mGallery.appendChild(p);
  } else {
    loc.images.forEach((src) => {
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

// ESC closes whichever modal is open (nice UX)
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
let fuseLocations, fuseGroups;

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

function showAll() {
  rebuildCluster(allMarkers);
  closeResultsModal();
}

showAllBtn.onclick = () => {
  searchInput.value = "";
  showAll();
};

function filterGroup(kind, label, groupsIndex) {
  const markers = groupsIndex.get(`${kind}::${label}`) || [];
  rebuildCluster(markers);

  // keep results modal open and show places list for that group (best UX)
  activeTab = "places";
  tabPlaces.classList.add("active");
  tabGroups.classList.remove("active");

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
    card.innerHTML = `<div class="title">${loc.place || "(Unknown place)"}</div>
                      <div class="meta">${loc.title || ""}${loc.country ? " • " + loc.country : ""}</div>`;
    card.onclick = () => {
      map.setView([loc.lat, loc.lng], 16);
      openModal(loc);
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

function runSearch(q) {
  const query = norm(q);

  // If empty: close results modal and don't filter the map
  if (!query) {
    closeResultsModal();
    return;
  }

  openResultsModal();
  resultsEl.innerHTML = "";

  // NOTE: fuseGroups needs a groupsIndex map (built at load)
  if (!runSearch._groupsIndex) {
    // should be set after data load
    runSearch._groupsIndex = new Map();
  }
  const groupsIndex = runSearch._groupsIndex;

  if (activeTab === "groups") {
    const groupHits = fuseGroups.search(query).slice(0, 30);

    if (!groupHits.length) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try a different search.</div>`;
      resultsEl.appendChild(empty);
      return;
    }

    groupHits.forEach((r) => {
      const { kind, label, count } = r.item;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="title">${label}</div>
                        <div class="meta">${kind} • ${count.toLocaleString()} locations</div>`;
      card.onclick = () => filterGroup(kind, label, groupsIndex);
      resultsEl.appendChild(card);
    });
    return;
  }

  // Places search
  const locHits = fuseLocations.search(query).slice(0, 50).map((r) => r.item);

  if (!locHits.length) {
    rebuildCluster([]); // show none (feels consistent)
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try a collection, country, or keyword.</div>`;
    resultsEl.appendChild(empty);
    return;
  }

  // Filter map markers to hits (cap for performance)
  const hitMarkers = locHits
    .slice(0,
