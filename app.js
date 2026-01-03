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

function openModal(loc) {
  mTitle.textContent = loc.title || "";
  mMeta.textContent = `${loc.place || ""}${loc.country ? " • " + loc.country : ""}`;
  mDesc.textContent = loc.description || "";

  mGallery.innerHTML = "";
  if (!loc.images || !loc.images.length) {
    mGallery.innerHTML = "<p>No images yet.</p>";
  } else {
    loc.images.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      mGallery.appendChild(img);
    });
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

document.getElementById("closeBtn").onclick = () => {
  modal.classList.remove("open");
};

// =====================
// DATA + SEARCH
// =====================
let ALL = [];
let allMarkers = [];
let markersByTitle = new Map();
let markersByCollection = new Map();
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

function runSearch(q) {
  const query = norm(q);
  if (!query) {
    closeResultsModal();
    return;
  }

  openResultsModal();
  resultsEl.innerHTML = "";

  if (activeTab === "groups") {
    fuseGroups.search(query).slice(0, 30).forEach(r => {
      const { kind, label, count } = r.item;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="title">${label}</div>
                        <div class="meta">${kind} • ${count} locations</div>`;
      card.onclick = () => filterGroup(kind, label);
      resultsEl.appendChild(card);
    });
    return;
  }

  const locs = fuseLocations.search(query).slice(0, 50).map(r => r.item);
  rebuildCluster(locs.map(l => l.__marker));

  locs.forEach(loc => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="title">${loc.place}</div>
                      <div class="meta">${loc.title} • ${loc.country}</div>`;
    card.onclick = () => {
      map.setView([loc.lat, loc.lng], 16);
      openModal(loc);
    };
    resultsEl.appendChild(card);
  });
}

searchInput.addEventListener("input", () => runSearch(searchInput.value));

// =====================
// LOAD DATA
// =====================
fetch("./data/locations.json")
  .then(r => r.json())
  .then(data => {
    ALL = data;

    ALL.forEach(loc => {
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

      const mk = L.marker([loc.lat, loc.lng]);
      mk.on("click", () => openModal(loc));
      loc.__marker = mk;

      allMarkers.push(mk);

      const title = norm(loc.title);
      if (title) {
        if (!markersByTitle.has(title)) markersByTitle.set(title, []);
        markersByTitle.get(title).push(mk);
      }

      safeArr(loc.collections).forEach(c => {
        if (!markersByCollection.has(c)) markersByCollection.set(c, []);
        markersByCollection.get(c).push(mk);
      });
    });

    rebuildCluster(allMarkers);

    fuseLocations = new Fuse(ALL, {
      threshold: 0.35,
      keys: [
        { name: "title", weight: 3 },
        { name: "collections", weight: 2 },
        { name: "place", weight: 1.7 },
        { name: "country", weight: 1.2 },
        { name: "keywords", weight: 1.4 },
        { name: "description", weight: 0.8 }
      ]
    });

    const groups = [];
    markersByTitle.forEach((v, k) => groups.push({ kind: "Title", label: k, count: v.length }));
    markersByCollection.forEach((v, k) => groups.push({ kind: "Collection", label: k, count: v.length }));

    fuseGroups = new Fuse(groups, {
      threshold: 0.35,
      keys: ["label"]
    });
  });
