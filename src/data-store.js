window.FTS = window.FTS || {};

FTS.DataStore = (function () {
  const DATASET_CACHE_VERSION = "v2";
  const DATASET_CACHE_PREFIX = "fts:dataset";
  const store = new Map();
  const pending = new Map();
  const metadata = new Map();

  function runtimeConfig() {
    return window.RUNTIME_CONFIG || {};
  }

  function appConfig() {
    return window.APP_CONFIG || {};
  }

  function environment() {
    return runtimeConfig().environment || "live";
  }

  function isStaging() {
    return environment() === "staging";
  }

  function shouldDebug(options = {}) {
    return isStaging() || options.debug === true;
  }

  function log(event, details, options = {}) {
    if (!shouldDebug(options)) return;
    if (!window.console) return;
    console.info(`[FTS DataStore] ${event}`, details || "");
  }

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function splitPipe(value) {
    if (window.FTS?.Utils?.splitPipe) return window.FTS.Utils.splitPipe(value);
    const text = norm(value);
    return text ? text.split("|").map(norm).filter(Boolean) : [];
  }

  function splitComma(value) {
    if (window.FTS?.Utils?.splitComma) return window.FTS.Utils.splitComma(value);
    const text = norm(value);
    return text ? text.split(",").map(norm).filter(Boolean) : [];
  }

  function coerceNumber(value) {
    if (window.FTS?.Utils?.coerceNumber) return window.FTS.Utils.coerceNumber(value);
    const number = Number((value ?? "").toString().trim());
    return Number.isFinite(number) ? number : null;
  }

  function normalizeType(value) {
    if (window.FTS?.Utils?.normalizeType) return window.FTS.Utils.normalizeType(value);
    return norm(value) || "Misc";
  }

  function parseVisitedDate(value) {
    if (window.FTS?.Utils?.parseVisitedDate) return window.FTS.Utils.parseVisitedDate(value);
    const timestamp = Date.parse(norm(value));
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function getNationalTrustName(row) {
    if (window.FTS?.Utils?.getNationalTrustName) return window.FTS.Utils.getNationalTrustName(row);
    return norm(row?.NationalTrust || row?.["National Trust"] || row?.nt || row?.NT);
  }

  function getNationalTrustUrl(row) {
    if (window.FTS?.Utils?.getNationalTrustUrl) return window.FTS.Utils.getNationalTrustUrl(row);
    return norm(row?.NTURL || row?.["NT URL"] || row?.nturl || row?.ntUrl);
  }

  function visibilityMode() {
    return window.FTS?.Visibility?.mode?.() || "public-only";
  }

  function modeKey(baseKey) {
    return `${baseKey}:${visibilityMode()}`;
  }

  function hourlyBucket(date = new Date()) {
    return date.toISOString().slice(0, 13);
  }

  function storageAvailable() {
    try {
      const testKey = `${DATASET_CACHE_PREFIX}:test`;
      sessionStorage.setItem(testKey, "1");
      sessionStorage.removeItem(testKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  function datasetStorageKey(keyName, bucket = hourlyBucket()) {
    return `${DATASET_CACHE_PREFIX}:${DATASET_CACHE_VERSION}:${bucket}:${encodeURIComponent(keyName)}`;
  }

  function serializeDataset(value) {
    return JSON.stringify(value, (itemKey, itemValue) => {
      if (itemValue instanceof Set) {
        return { __ftsDatasetType: "Set", values: Array.from(itemValue) };
      }

      if (itemValue instanceof Map) {
        return { __ftsDatasetType: "Map", values: Array.from(itemValue.entries()) };
      }

      return itemValue;
    });
  }

  function deserializeDataset(text) {
    return JSON.parse(text, (itemKey, itemValue) => {
      if (itemValue && itemValue.__ftsDatasetType === "Set") {
        return new Set(itemValue.values || []);
      }

      if (itemValue && itemValue.__ftsDatasetType === "Map") {
        return new Map(itemValue.values || []);
      }

      return itemValue;
    });
  }

  function readPersistentDataset(keyName, options = {}) {
    if (options.persist !== true || options.force === true || !storageAvailable()) return null;

    const storageKey = datasetStorageKey(keyName);

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const value = deserializeDataset(raw);
      log("session hit", { key: keyName, storageKey }, options);
      return value;
    } catch (err) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
  }

  function writePersistentDataset(keyName, value, options = {}) {
    if (options.persist !== true || !storageAvailable()) return;

    const storageKey = datasetStorageKey(keyName);

    try {
      sessionStorage.setItem(storageKey, serializeDataset(value));
      log("session stored", { key: keyName, storageKey }, options);
    } catch (err) {
      log("session store skipped", { key: keyName, reason: err?.message || "storage failed" }, options);
    }
  }

  function clearPersistentDataset(keyName) {
    if (!storageAvailable()) return;

    try {
      Object.keys(sessionStorage).forEach((storageKey) => {
        const matchesPrefix = storageKey.startsWith(`${DATASET_CACHE_PREFIX}:${DATASET_CACHE_VERSION}:`);
        const matchesKey = typeof keyName !== "string" || storageKey.endsWith(`:${encodeURIComponent(keyName)}`);
        if (matchesPrefix && matchesKey) sessionStorage.removeItem(storageKey);
      });
    } catch (err) {
      // Persistent dataset cache clearing should never block the app.
    }
  }

  function getAccessValue(row) {
    return norm(
      row?.access ||
      row?.Access ||
      row?.ACCESS ||
      row?.["access "] ||
      row?.["Access "] ||
      row?.["No Access"] ||
      row?.noaccess ||
      row?.NOACCESS
    ).toUpperCase();
  }

  function has(keyName) {
    return store.has(keyName);
  }

  function get(keyName) {
    return store.get(keyName);
  }

  function set(keyName, value, info = {}) {
    store.set(keyName, value);
    metadata.set(keyName, {
      updatedAt: new Date().toISOString(),
      ...info
    });

    log("stored dataset", {
      key: keyName,
      rows: Array.isArray(value) ? value.length : undefined,
      info
    });

    return value;
  }

  function info(keyName) {
    return metadata.get(keyName) || null;
  }

  function clear(keyName) {
    if (typeof keyName === "string") {
      store.delete(keyName);
      metadata.delete(keyName);
      pending.delete(keyName);
      clearPersistentDataset(keyName);

      log("cleared dataset", { key: keyName });
      return;
    }

    store.clear();
    metadata.clear();
    pending.clear();
    clearPersistentDataset();

    log("cleared all datasets");
  }

  async function remember(keyName, loader, options = {}) {
    if (has(keyName) && options.force !== true) {
      log("memory hit", { key: keyName });
      return get(keyName);
    }

    const persisted = readPersistentDataset(keyName, options);
    if (persisted !== null) {
      set(keyName, persisted, {
        fromSession: true,
        mode: visibilityMode()
      });
      return persisted;
    }

    if (pending.has(keyName) && options.force !== true) {
      log("awaiting existing loader", { key: keyName });
      return pending.get(keyName);
    }

    const startedAt = performance.now();

    const promise = (async () => {
      try {
        log("building dataset", { key: keyName, mode: visibilityMode() });

        const value = await loader();

        set(keyName, value, {
          buildMs: Math.round(performance.now() - startedAt),
          mode: visibilityMode(),
          persisted: options.persist === true
        });

        writePersistentDataset(keyName, value, options);

        return value;
      } finally {
        pending.delete(keyName);
      }
    })();

    pending.set(keyName, promise);

    return promise;
  }

  async function csvRows(keyName, url, options = {}) {
    return remember(keyName, async () => {
      if (window.FTS?.CSV?.fetchObjects) {
        return window.FTS.CSV.fetchObjects(url, options);
      }

      if (!window.FTS?.DataCache?.fetchCSV) {
        throw new Error("FTS.CSV.fetchObjects or FTS.DataCache.fetchCSV is required before DataStore.csvRows can be used.");
      }

      const result = await window.FTS.DataCache.fetchCSV(url, options);
      return result.rows;
    }, options);
  }

  function normalizeSceneRow(row, fallbackType) {
    const lat = coerceNumber(row.lat);
    const lng = coerceNumber(row.lng);
    const title = norm(row.title);
    const type = normalizeType(row.type || fallbackType);
    const ntName = getNationalTrustName(row);

    if (!title || typeof lat !== "number" || typeof lng !== "number") return null;

    return {
      ...row,
      id: norm(row.id),
      title,
      type,
      series: norm(row.series) || (type === "TV" ? title : ""),
      place: norm(row.place),
      city: norm(row.city || row.town || row.place),
      country: norm(row.country),
      description: norm(row.description),
      collections: splitPipe(row.collections),
      keywords: splitPipe(row.keywords),
      aliases: splitPipe(row.aliases),
      images: splitPipe(row.images),
      rating: splitComma(row.rating).map((value) => value.toLowerCase()),
      access: getAccessValue(row),
      exportFileName: norm(row["export-file-name"]),
      imdb: norm(row.imdb),
      justwatch: norm(row.justwatch),
      NationalTrust: ntName,
      NTURL: getNationalTrustUrl(row),
      rawDate: norm(row["raw-date"]),
      dateFormatted: norm(row["date-formatted"]),
      monthShort: norm(row["month-short"]),
      railOrder: coerceNumber(row["set-rail-order"]),
      visitedTs: parseVisitedDate(row["date-formatted"] || row["raw-date"] || row.visited || row["visit-date"]),
      lat,
      lng,
      _raw: row
    };
  }

  async function getSceneRows(options = {}) {
    return remember("scene-rows", async () => {
      const config = appConfig();
      const sheets = config.SHEETS || {};
      const sources = [
        ["Film", sheets.movies, "scene-rows-films"],
        ["TV", sheets.tv, "scene-rows-tv"],
        ["Music Video", sheets.music_videos, "scene-rows-music-videos"],
        ["Video Game", sheets.games, "scene-rows-games"],
        ["Misc", sheets.misc, "scene-rows-misc"]
      ].filter(([, url]) => Boolean(url));

      const groups = await Promise.all(sources.map(async ([fallbackType, url, cacheKey]) => {
        const rows = await csvRows(cacheKey, url, options);
        return rows.map((row) => normalizeSceneRow(row, fallbackType)).filter(Boolean);
      }));

      return groups.flat();
    }, { ...options, persist: true });
  }

  async function getTitleMetadata(options = {}) {
    const config = appConfig();
    const url = config.TITLE_METADATA_CSV;

    if (!url) return [];

    return csvRows("title-metadata", url, options);
  }

  async function getTitleMetadataMap(options = {}) {
    return remember("title-metadata-map", async () => {
      const rows = await getTitleMetadata(options);

      const map = new Map();

      rows.forEach((row) => {
        const title = norm(row.title);
        if (!title) return;

        map.set(key(title), row);
      });

      return map;
    }, options);
  }

  async function getTitleTypes(options = {}) {
    return remember("title-types", async () => {
      const rows = await getTitleMetadata(options);

      return Array.from(new Set(
        rows
          .map((row) => norm(row.type))
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b));
    }, options);
  }

  async function getExploreSearchIndexes(builder, options = {}) {
    return remember(modeKey("explore-search-indexes"), async () => {
      if (typeof builder !== "function") {
        throw new Error("FTS.DataStore.getExploreSearchIndexes requires a builder function.");
      }

      const result = await builder();

      return {
        fuseLocations: result.fuseLocations,
        fuseGroups: result.fuseGroups,
        groupsIndex: result.groupsIndex,
        searchLocations: result.searchLocations,
        groups: result.groups
      };
    }, options);
  }

  async function getHomepageDatasets(builder, options = {}) {
    return remember(modeKey("homepage-datasets"), async () => {
      if (typeof builder !== "function") {
        throw new Error("FTS.DataStore.getHomepageDatasets requires a builder function.");
      }

      const result = await builder();

      return {
        ...result,
        sceneRows: result.sceneRows || [],
        visibleRows: result.visibleRows || [],
        metadataRows: result.metadataRows || [],
        peopleRows: result.peopleRows || [],
        entries: result.entries || [],
        featuredTitles: result.featuredTitles || [],
        latestTitles: result.latestTitles || [],
        topTitles: result.topTitles || [],
        collectionRails: result.collectionRails || [],
        nationalTrustRails: result.nationalTrustRails || [],
        homepageCounts: result.homepageCounts || {},
        visibilityMode: visibilityMode()
      };
    }, options);
  }

  async function getVisibilityDatasets(sceneRowsOrBuilder, options = {}) {
    return remember(modeKey("visibility-datasets"), async () => {
      const sceneRows = typeof sceneRowsOrBuilder === "function"
        ? await sceneRowsOrBuilder()
        : (sceneRowsOrBuilder || []);

      const visibleScenes = window.FTS?.Visibility?.getVisibleScenes?.(sceneRows) || sceneRows;
      const visibleTitleKeys = new Set(visibleScenes.map((row) => key(row.title)).filter(Boolean));
      const hiddenScenes = sceneRows.filter((row) => !visibleScenes.includes(row));
      const inaccessibleScenes = sceneRows.filter((row) => getAccessValue(row) === "NOACCESS");
      const demolishedScenes = sceneRows.filter((row) => getAccessValue(row) === "DEMOLISHED");
      const inaccessibleTitleKeys = new Set(inaccessibleScenes.map((row) => key(row.title)).filter(Boolean));
      const demolishedTitleKeys = new Set(demolishedScenes.map((row) => key(row.title)).filter(Boolean));

      return {
        mode: visibilityMode(),
        sceneRows,
        visibleScenes,
        hiddenScenes,
        inaccessibleScenes,
        demolishedScenes,
        visibleTitleKeys,
        inaccessibleTitleKeys,
        demolishedTitleKeys,
        counts: {
          scenes: sceneRows.length,
          visibleScenes: visibleScenes.length,
          hiddenScenes: hiddenScenes.length,
          inaccessibleScenes: inaccessibleScenes.length,
          demolishedScenes: demolishedScenes.length,
          visibleTitles: visibleTitleKeys.size,
          inaccessibleTitles: inaccessibleTitleKeys.size,
          demolishedTitles: demolishedTitleKeys.size
        }
      };
    }, options);
  }

  function snapshot() {
    return {
      keys: Array.from(store.keys()),
      metadata: Object.fromEntries(metadata.entries())
    };
  }

  window.FTS_DEBUG_DATASTORE = snapshot;

  return {
    has,
    get,
    set,
    info,
    clear,
    remember,
    csvRows,
    getSceneRows,
    getTitleMetadata,
    getTitleMetadataMap,
    getTitleTypes,
    getExploreSearchIndexes,
    getHomepageDatasets,
    getVisibilityDatasets,
    visibilityMode,
    modeKey,
    snapshot
  };
})();
