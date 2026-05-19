window.FTS = window.FTS || {};

FTS.DataCache = (function () {
  const CACHE_VERSION = "v1";
  const CACHE_PREFIX = "fts:csv";

  function getRuntimeConfig() {
    return window.RUNTIME_CONFIG || {};
  }

  function getEnvironment() {
    return getRuntimeConfig().environment || "live";
  }

  function isStaging() {
    return getEnvironment() === "staging";
  }

  function params() {
    return new URLSearchParams(window.location.search || "");
  }

  function hasCacheBuster() {
    const p = params();
    return p.has("cacheBust") || p.has("cacheBuster") || p.has("ftsRefresh") || p.has("refreshData");
  }

  function cacheEnabled(options = {}) {
    if (options.cache === false) return false;
    if (hasCacheBuster()) return false;
    if (isStaging() && options.allowStagingCache !== true) return false;
    return true;
  }

  function hourlyBucket(date = new Date()) {
    return date.toISOString().slice(0, 13);
  }

  function cacheKey(url, bucket = hourlyBucket()) {
    return `${CACHE_PREFIX}:${CACHE_VERSION}:${bucket}:${url}`;
  }

  function canUseStorage() {
    try {
      const testKey = `${CACHE_PREFIX}:test`;
      sessionStorage.setItem(testKey, "1");
      sessionStorage.removeItem(testKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  function readCache(key) {
    if (!canUseStorage()) return null;
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeCache(key, value) {
    if (!canUseStorage()) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Storage may be full or blocked. Cache failure should never block the app.
    }
  }

  function shouldDebug(options = {}) {
    return isStaging() || options.debug === true;
  }

  function log(event, details, options = {}) {
    if (!shouldDebug(options)) return;
    if (!window.console) return;
    console.info(`[FTS Cache] ${event}`, details || "");
  }

  function norm(value) {
    return (value || "").toString().trim();
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      const next = text[i + 1];

      if (character === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (character === "," && !inQuotes) {
        row.push(current);
        current = "";
        continue;
      }

      if ((character === "\n" || character === "\r") && !inQuotes) {
        if (character === "\r" && next === "\n") i += 1;
        row.push(current);
        current = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        continue;
      }

      current += character;
    }

    row.push(current);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(norm);
    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    }).filter((row) => Object.values(row).some((value) => norm(value) !== ""));
  }

  async function fetchText(url, options = {}) {
    const bucket = hourlyBucket();
    const key = cacheKey(url, bucket);
    const enabled = cacheEnabled(options);

    if (enabled) {
      const cached = readCache(key);
      if (cached && typeof cached.text === "string") {
        log("cache hit", { url, bucket, key }, options);
        return { text: cached.text, fromCache: true, bucket, key, fetchedAt: cached.fetchedAt };
      }
    }

    const startedAt = performance.now();
    const response = await fetch(url, { cache: enabled ? "force-cache" : "no-store" });
    if (!response.ok) throw new Error(`Could not load CSV: ${url}`);
    const text = await response.text();
    const fetchedAt = new Date().toISOString();

    if (enabled) {
      writeCache(key, { text, fetchedAt, url, bucket });
    }

    log(enabled ? "cache miss, fetched fresh" : "cache bypass, fetched fresh", {
      url,
      bucket,
      key,
      ms: Math.round(performance.now() - startedAt)
    }, options);

    return { text, fromCache: false, bucket, key, fetchedAt };
  }

  async function fetchCSV(url, options = {}) {
    const startedAt = performance.now();
    const result = await fetchText(url, options);
    const rows = rowsToObjects(parseCSV(result.text));

    log("parsed csv", {
      url,
      rows: rows.length,
      fromCache: result.fromCache,
      bucket: result.bucket,
      ms: Math.round(performance.now() - startedAt)
    }, options);

    return { ...result, rows };
  }

  return {
    fetchText,
    fetchCSV,
    hourlyBucket,
    cacheKey,
    cacheEnabled,
    hasCacheBuster,
    isStaging
  };
})();
