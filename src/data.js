window.App = window.App || {};

App.Data = (function () {
  let ALL = [];
  let allMarkers = [];
  const groupsIndex = new Map();

  function norm(s) { return (s || "").toString().trim(); }

  function getAccessValue(row) {
    return norm(
      row.access ||
      row.Access ||
      row.ACCESS ||
      row["access "] ||
      row["Access "] ||
      row["No Access"] ||
      row.noaccess ||
      row.NOACCESS
    );
  }
  
  function normalizeComparable(s) {
    return norm(s).toLowerCase();
  }

  function splitPipe(s) {
    const t = norm(s);
    if (!t) return [];
    return t.split("|").map(x => norm(x)).filter(Boolean);
  }

  function splitComma(s) {
    const t = norm(s);
    if (!t) return [];
    return t.split(",").map(x => norm(x).toLowerCase()).filter(Boolean);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (c === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += c;
    }

    row.push(cur);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => norm(h));
    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(cell => norm(cell) === "")) continue;

      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] ?? "");
      out.push(obj);
    }

    return out;
  }

  function normalizeType(t) {
    const x = norm(t).toLowerCase();
    if (!x) return "Misc";
    if (x === "film" || x === "movie" || x === "movies") return "Film";
    if (x === "tv" || x === "tv show" || x === "tv shows" || x === "series") return "TV";
    if (x === "music video" || x === "music videos" || x === "mv") return "Music Video";
    if (x === "game" || x === "games" || x === "video game" || x === "video games") return "Video Game";
    if (x === "misc" || x === "other") return "Misc";
    return norm(t);
  }

  function addToMapList(mapObj, key, val) {
    const k = norm(key);
    if (!k) return;
    if (!mapObj.has(k)) mapObj.set(k, []);
    mapObj.get(k).push(val);
  }

  async function fetchSheetCSV(url) {
    if (window.FTS?.DataCache?.fetchText) {
      const result = await window.FTS.DataCache.fetchText(url);
      return result.text;
    }

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to fetch CSV: ${url}`);
    return r.text();
  }

  function coerceNumber(x) {
    const n = Number((x ?? "").toString().trim());
    return Number.isFinite(n) ? n : null;
  }

  function postProcessRow(row, fallbackType) {
    const loc = {
      id: norm(row.id),
      title: norm(row.title),
      type: normalizeType(row.type || fallbackType),
      series: norm(row.series),
      place: norm(row.place),
      country: norm(row.country),
      lat: coerceNumber(row.lat),
      lng: coerceNumber(row.lng),
      description: norm(row.description),
      collections: splitPipe(row.collections),
      keywords: splitPipe(row.keywords),
      aliases: splitPipe(row.aliases),
      images: splitPipe(row.images),
      rating: splitComma(row.rating),
      access: getAccessValue(row),
      exportFileName: norm(row["export-file-name"]),
      imdb: norm(row.imdb),
      justwatch: norm(row.justwatch),
      rawDate: norm(row["raw-date"]),
      dateFormatted: norm(row["date-formatted"]),
      monthShort: norm(row["month-short"])
    };

    loc._raw = row;

    if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
    if (!loc.id || !loc.title || !loc.place) return null;

    if (!loc.series && loc.type === "TV") loc.series = loc.title;
    return loc;
  }

  async function loadTitleMetadata() {
    const cfg = window.APP_CONFIG || {};
    const url = cfg.TITLE_METADATA_CSV || cfg.TITLE_METADATA || cfg.TITLES_METADATA_CSV;

    if (!url) return new Map();

    try {
      const text = await fetchSheetCSV(url);
      const rows = rowsToObjects(parseCSV(text));

      const metaMap = new Map();

      rows.forEach((row) => {
        const title = norm(row.title);
        if (!title) return;

        metaMap.set(normalizeComparable(title), {
          title,
          type: norm(row.type),
          description: norm(row.description),
          imdb: norm(row.imdb),
          justwatch: norm(row.justwatch),
          poster: norm(row.poster),
          trailer: norm(row.trailer)
        });
      });

      return metaMap;
    } catch (err) {
      console.warn("Could not load title metadata CSV", err);
      return new Map();
    }
  }

  function applyMetadataFallbacks(locs, metadataByTitle) {
    return locs.map((loc) => {
      const meta = metadataByTitle.get(normalizeComparable(loc.title));

      if (!meta) return loc;

      return {
        ...loc,
        imdb: loc.imdb || meta.imdb || "",
        justwatch: loc.justwatch || meta.justwatch || ""
      };
    });
  }

  function markerIsVisible(marker) {
    if (!App.State || typeof App.State.getHideNoAccess !== "function") return true;
    if (!App.State.getHideNoAccess()) return true;

    return !App.State.hasNoAccess(marker?.__loc);
  }

  function visibleMarkers(markers) {
    return (markers || []).filter(markerIsVisible);
  }

  function visibleLocations() {
    return visibleMarkers(allMarkers)
      .map((marker) => marker.__loc)
      .filter(Boolean);
  }

  function addVisibleGroup(groups, kind, label, markers) {
    const visible = visibleMarkers(markers);

    if (!visible.length) return;

    groups.push({ kind, label, count: visible.length });
    groupsIndex.set(`${kind}::${label}`, visible);
  }

  function buildSearchIndexes() {
    const searchLocations = visibleLocations();
    const groups = [];

    groupsIndex.clear();

    const markersByTitle = new Map();
    const markersBySeries = new Map();
    const markersByCollection = new Map();
    const markersByType = new Map();

    allMarkers.forEach((marker) => {
      const loc = marker.__loc;
      if (!loc) return;

      addToMapList(markersByTitle, loc.title, marker);
      addToMapList(markersBySeries, loc.series, marker);
      (loc.collections || []).forEach((c) => addToMapList(markersByCollection, c, marker));
      addToMapList(markersByType, loc.type, marker);
    });

    markersByTitle.forEach((arr, title) => addVisibleGroup(groups, "Title", title, arr));
    markersBySeries.forEach((arr, series) => addVisibleGroup(groups, "Series", series, arr));
    markersByCollection.forEach((arr, col) => addVisibleGroup(groups, "Collection", col, arr));
    markersByType.forEach((arr, type) => addVisibleGroup(groups, "Type", type, arr));

    const fuseLocations = new Fuse(searchLocations, {
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

    const fuseGroups = new Fuse(groups, {
      threshold: 0.35,
      keys: ["label", "kind"]
    });

    App.Search.setData({
      fuseLoc: fuseLocations,
      fuseGrp: fuseGroups,
      groupsIdx: groupsIndex,
      allMk: visibleMarkers(allMarkers)
    });
  }

  async function init() {
    const cfg = window.APP_CONFIG || {};
    const sheets = cfg.SHEETS || {};

    const hasSheets =
      sheets.movies || sheets.tv || sheets.music_videos || sheets.games || sheets.misc;

    try {
      let locs = [];

      if (hasSheets) {
        const sources = [
          ["Film", sheets.movies],
          ["TV", sheets.tv],
          ["Music Video", sheets.music_videos],
          ["Video Game", sheets.games],
          ["Misc", sheets.misc]
        ].filter(([, url]) => !!url);

        const texts = await Promise.all(sources.map(([, url]) => fetchSheetCSV(url)));

        for (let i = 0; i < sources.length; i++) {
          const [fallbackType] = sources[i];
          const rows = rowsToObjects(parseCSV(texts[i]));

          rows.forEach((r) => {
            const loc = postProcessRow(r, fallbackType);
            if (loc) locs.push(loc);
          });
        }
      } else {
        const r = await fetch("./data/locations.json");
        const data = await r.json();
        locs = data.map((r) => postProcessRow(r, r.type)).filter(Boolean);
      }

      const metadataByTitle = await loadTitleMetadata();
      locs = applyMetadataFallbacks(locs, metadataByTitle);

      ALL = locs;

      App.Router.setLocationsIndex(ALL);

      allMarkers = [];

      ALL.forEach((loc) => {
        const marker = { __loc: loc };
        loc.__marker = marker;
        allMarkers.push(marker);
      });

      App.Map.rebuildCluster(allMarkers);
      App.State.clearFilter();
      buildSearchIndexes();

      window.addEventListener("fts:app-settings-updated", () => {
        buildSearchIndexes();
      });
    } catch (err) {
      console.error(err);
      alert("Failed to load data. Check console for details.");
    }
  }

  return { init };
})();