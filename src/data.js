window.App = window.App || {};

App.Data = (function () {
  let ALL = [];
  let allMarkers = [];
  const groupsIndex = new Map(); // "Kind::Label" -> Marker[]

  function norm(s) { return (s || "").toString().trim(); }
  function safeArr(a) { return Array.isArray(a) ? a : (a ? [a] : []); }

  function addToMapList(mapObj, key, val) {
    const k = norm(key);
    if (!k) return;
    if (!mapObj.has(k)) mapObj.set(k, []);
    mapObj.get(k).push(val);
  }

  function init() {
    fetch("./data/locations.json")
      .then(r => r.json())
      .then((data) => {
        ALL = data;

        const markersByTitle = new Map();
        const markersByCollection = new Map();
        const markersByType = new Map();

        ALL.forEach((loc) => {
          if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

          // Normalize fields
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
          mk.on("click", () => App.Modal.open(loc));
          loc.__marker = mk;

          allMarkers.push(mk);

          addToMapList(markersByTitle, loc.title, mk);
          loc.collections.forEach((c) => addToMapList(markersByCollection, c, mk));
          addToMapList(markersByType, loc.type, mk);
        });

        // Initial render
        App.Map.rebuildCluster(allMarkers);
        App.State.clearFilter();

        // Build Fuse indexes
        const fuseLocations = new Fuse(ALL, {
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

        // Groups list + groupsIndex
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

        const fuseGroups = new Fuse(groups, {
          threshold: 0.35,
          keys: ["label", "kind"]
        });

        // Hand to Search module
        App.Search.setData({
          fuseLoc: fuseLocations,
          fuseGrp: fuseGroups,
          groupsIdx: groupsIndex,
          allMk: allMarkers
        });
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load data/locations.json");
      });
  }

  return { init };
})();
