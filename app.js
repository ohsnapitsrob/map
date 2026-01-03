// ====== CONFIG ======
const MAPTILER_KEY = "PASTE_YOUR_MAPTILER_KEY_HERE";
const MAP_STYLE = "streets"; // try: basic, streets, outdoors, etc.

// ====== MAP ======
const map = L.map("map", { preferCanvas: true }).setView([54.5, -2.5], 6);

L.tileLayer(
  `https://api.maptiler.com/maps/${MAP_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
  { maxZoom: 20, attribution: "&copy; MapTiler & OpenStreetMap contributors" }
).addTo(map);

// Cluster for 10K+ (good UX + performance)
const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  removeOutsideVisibleBounds: true
});
map.addLayer(cluster);

// ====== UI ELEMENTS ======
const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const countEl = document.getElementById("count");
const showAllBtn = document.getElementById("showAll");

const tabGroups = document.getElementById("tabGroups");
const tabPlaces = document.getElementById("tabPlaces");

function setCount(text) { countEl.textContent = text; }

let activeTab = "groups"; // groups | places

tabGroups.addEventListener("click", () => {
  activeTab = "groups";
  tabGroups.classList.add("active");
  tabPlaces.classList.remove("active");
  runSearch(searchInput.value.trim());
});

tabPlaces.addEventListener("click", () => {
  activeTab = "places";
  tabPlaces.classList.add("active");
  tabGroups.classList.remove("active");
  runSearch(searchInput.value.trim());
});

// ====== MODAL ======
const modal = document.getElementById("modal");
const mTitle = document.getElementById("mTitle");
const mMeta  = document.getElementById("mMeta");
const mDesc  = document.getElementById("mDesc");
const mGallery = document.getElementById("mGallery");

function openModal(loc) {
  mTitle.textContent = loc.title || "";
  const bits = [];
  if (loc.type) bits.push(loc.type);
  if (loc.series) bits.push(`Series: ${loc.series}`);
  if (loc.collections && loc.collections.length) bits.push(`Collections: ${loc.collections.join(", ")}`);
  mMeta.textContent = `${loc.place || ""}${loc.country ? " • " + loc.country : ""}${bits.length ? " • " + bits.join(" • ") : ""}`;
  mDesc.textContent = loc.description || "";

  mGallery.innerHTML = "";
  const imgs = (loc.images || []);
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
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
document.getElementById("closeBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// ====== DATA + INDEXES ======
let ALL = [];
let allMarkers = [];
let markersByTitle = new Map();       // title -> markers[]
let markersByCollection = new Map();  // collection -> markers[]

let fuseLocations; // searches individual locations
let fuseGroups;    // searches group strings (titles + collections)

function norm(s) { return (s || "").toString().trim(); }
function safeArr(a) { return Array.isArray(a) ? a : (a ? [a] : []); }

function addToMapList(mapObj, key, val) {
  const k = norm(key);
  if (!k) return;
  if (!mapObj.has(k)) mapObj.set(k, []);
  mapObj.get(k).push(val);
}

function rebuildCluster(markers) {
  cluster.clearLayers();
  cluster.addLayers(markers);
  setCount(`${markers.length.toLocaleString()} location(s) shown`);
  if (markers.length) {
    const fg = L.featureGroup(markers);
    map.fitBounds(fg.getBounds(), { padding: [20, 20] });
  }
}

function showAll() {
  rebuildCluster(allMarkers);
  renderDefaultGroups();
}

showAllBtn.addEventListener("click", () => {
  searchInput.value = "";
  showAll();
});

// Build “groups” list for browsing (nice even without searching)
function renderDefaultGroups() {
  resultsEl.innerHTML = "";
  // Show top titles by count (nice browse experience)
  const titleCounts = Array.from(markersByTitle.entries())
    .map(([title, markers]) => ({ label: title, kind: "Title", count: markers.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const collectionCounts = Array.from(markersByCollection.entries())
    .map(([col, markers]) => ({ label: col, kind: "Collection", count: markers.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const section = (name) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cursor = "default";
    div.innerHTML = `<div class="title">${name}</div><div class="meta">Click a card to filter the map</div>`;
    resultsEl.appendChild(div);
  };

  section("Popular titles");
  titleCounts.forEach(x => addGroupCard(x.kind, x.label, x.count));

  if (collectionCounts.length) {
    section("Collections");
    collectionCounts.forEach(x => addGroupCard(x.kind, x.label, x.count));
  }
}

function addGroupCard(kind, label, count) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="title">${label}</div><div class="meta">${kind} • ${count.toLocaleString()} location(s)</div>`;
  card.addEventListener("click", () => filterByGroup(kind, label));
  resultsEl.appendChild(card);
}

function addPlaceCard(loc) {
  const card = document.createElement("div");
  card.className = "card";
  const metaBits = [];
  if (loc.type) metaBits.push(loc.type);
  if (loc.country) metaBits.push(loc.country);
  if (loc.collections && loc.collections.length) metaBits.push(loc.collections.join(", "));
  card.innerHTML = `<div class="title">${loc.place || "(Unknown place)"}</div>
                    <div class="meta">${norm(loc.title)}${metaBits.length ? " • " + metaBits.join(" • ") : ""}</div>`;
  card.addEventListener("click", () => {
    // zoom + open modal
    map.setView([loc.lat, loc.lng], 16, { animate: true });
    openModal(loc);
  });
  resultsEl.appendChild(card);
}

function filterByGroup(kind, label) {
  let markers = [];
  if (kind === "Title") markers = markersByTitle.get(label) || [];
  if (kind === "Collection") markers = markersByCollection.get(label) || [];
  rebuildCluster(markers);

  resultsEl.innerHTML = "";
  const header = document.createElement("div");
  header.className = "card";
  header.style.cursor = "default";
  header.innerHTML = `<div class="title">${label}</div><div class="meta">${kind} • ${markers.length.toLocaleString()} location(s)</div>`;
  resultsEl.appendChild(header);

  // list some places for quick browsing
  markers.slice(0, 200).forEach(mk => addPlaceCard(mk.__loc));
  if (markers.length > 200) {
    const more = document.createElement("div");
    more.className = "card";
    more.style.cursor = "default";
    more.innerHTML = `<div class="meta">Showing first 200 places here. (All are still on the map.)</div>`;
    resultsEl.appendChild(more);
  }
}

// ====== SEARCH ======
function runSearch(q) {
  const query = norm(q);

  if (!query) {
    if (activeTab === "groups") renderDefaultGroups();
    else {
      resultsEl.innerHTML = "";
      allMarkers.slice(0, 50).forEach(mk => addPlaceCard(mk.__loc));
      if (allMarkers.length > 50) {
        const more = document.createElement("div");
        more.className = "card";
        more.style.cursor = "default";
        more.innerHTML = `<div class="meta">Showing 50 random-ish places. Search to find more.</div>`;
        resultsEl.appendChild(more);
      }
    }
    return;
  }

  if (activeTab === "groups") {
    // Group search: titles + collections
    const res = fuseGroups.search(query).map(r => r.item);
    resultsEl.innerHTML = "";
    res.slice(0, 30).forEach(item => addGroupCard(item.kind, item.label, item.count));
    if (!res.length) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try different wording.</div>`;
      resultsEl.appendChild(empty);
    }
    return;
  }

  // Places search: individual locations
  const locRes = fuseLocations.search(query).map(r => r.item);
  resultsEl.innerHTML = "";
  locRes.slice(0, 50).forEach(loc => addPlaceCard(loc));

  // Filter the map to matched locations (great UX for search)
  const matchedMarkers = locRes
    .slice(0, 2000) // safety cap; map still shows clusters if huge
    .map(loc => loc.__marker)
    .filter(Boolean);

  rebuildCluster(matchedMarkers);

  if (!locRes.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="title">No matches</div><div class="meta">Try searching by collection, country, or a keyword.</div>`;
    resultsEl.appendChild(empty);
  }
}

searchInput.addEventListener("input", () => runSearch(searchInput.value));

// ====== LOAD ======
fetch("./data/locations.json")
  .then(r => r.json())
  .then((data) => {
    ALL = data;

    // Build markers + indexes
    markersByTitle = new Map();
    markersByCollection = new Map();
    allMarkers = [];

    for (const loc of ALL) {
      // Basic validation
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
      loc.title = norm(loc.title);
      loc.place = norm(loc.place);
      loc.country = norm(loc.country);
      loc.type = norm(loc.type);
      loc.collections = safeArr(loc.collections).map(norm).filter(Boolean);
      loc.keywords = safeArr(loc.keywords).map(norm).filter(Boolean);
      loc.aliases = safeArr(loc.aliases).map(norm).filter(Boolean);
      loc.series = norm(loc.series);
      loc.description = norm(loc.description);

      const mk = L.marker([loc.lat, loc.lng]);
      mk.__loc = loc;
      loc.__marker = mk; // link back for search filtering
      mk.on("click", () => openModal(loc));

      allMarkers.push(mk);

      addToMapList(markersByTitle, loc.title, mk);
      loc.collections.forEach(c => addToMapList(markersByCollection, c, mk));
    }

    // Build Fuse index for places (search hits across many fields)
    fuseLocations = new Fuse(ALL, {
      includeScore: true,
      threshold: 0.35,
      keys: [
        { name: "title", weight: 3 },
        { name: "collections", weight: 2.5 },
        { name: "series", weight: 2 },
        { name: "aliases", weight: 2 },
        { name: "place", weight: 1.7 },
        { name: "country", weight: 1.2 },
        { name: "type", weight: 1.1 },
        { name: "keywords", weight: 1.4 },
        { name: "description", weight: 0.8 }
      ]
    });

    // Build “group” index (titles + collections with counts)
    const groupItems = [];
    for (const [t, arr] of markersByTitle.entries()) groupItems.push({ kind: "Title", label: t, count: arr.length });
    for (const [c, arr] of markersByCollection.entries()) groupItems.push({ kind: "Collection", label: c, count: arr.length });

    fuseGroups = new Fuse(groupItems, {
      includeScore: true,
      threshold: 0.35,
      keys: [
        { name: "label", weight: 3 },
        { name: "kind", weight: 0.3 }
      ]
    });

    // Initial view
    rebuildCluster(allMarkers);
    renderDefaultGroups();
  })
  .catch((err) => {
    console.error(err);
    alert("Failed to load data/locations.json");
  });
