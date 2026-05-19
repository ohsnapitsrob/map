window.FTS = window.FTS || {};

FTS.HomeV2Utils = (function () {
  const SharedUtils = window.FTS?.Utils || {};

  function norm(value) { return SharedUtils.norm ? SharedUtils.norm(value) : (value || "").toString().trim(); }
  function key(value) { return SharedUtils.normalizeComparable ? SharedUtils.normalizeComparable(value) : norm(value).toLowerCase(); }
  function coerceNumber(value) { return SharedUtils.coerceNumber ? SharedUtils.coerceNumber(value) : (Number.isFinite(Number((value ?? "").toString().trim())) ? Number((value ?? "").toString().trim()) : null); }
  function safeUrl(url) { return SharedUtils.safeUrl ? SharedUtils.safeUrl(url) : ""; }
  function escapeHtml(value) { return SharedUtils.escapeHtml ? SharedUtils.escapeHtml(value) : norm(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function splitComma(value) { return SharedUtils.splitComma ? SharedUtils.splitComma(value) : norm(value).split(",").map(norm).filter(Boolean); }

  function featureEnabled(keyName) { return window.FTS?.Features?.isEnabled(keyName) !== false; }
  function appSettings() { return window.FTS?.AppSettings?.getSettings?.() || {}; }

  function normalizeType(value) {
    return SharedUtils.normalizeType ? SharedUtils.normalizeType(value) : norm(value);
  }

  function normalizeAccess(value) { return window.FTS?.Visibility?.normaliseAccess ? window.FTS.Visibility.normaliseAccess(value) : norm(value).toUpperCase(); }

  function isUKCountry(value) {
    const country = key(value);
    return country === "uk" || country === "united kingdom" || country === "england" || country === "scotland" || country === "wales" || country === "northern ireland";
  }

  function parseVisitedDate(value) {
    return SharedUtils.parseVisitedDate ? SharedUtils.parseVisitedDate(value) : null;
  }

  async function fetchRows(url) {
    if (!url) return [];

    if (window.FTS?.CSV?.fetchObjects) {
      return window.FTS.CSV.fetchObjects(url);
    }

    if (window.FTS?.DataCache?.fetchCSV) {
      const result = await window.FTS.DataCache.fetchCSV(url);
      return result.rows;
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${url}`);
    const text = await response.text();
    return window.FTS?.CSV?.toObjects ? window.FTS.CSV.toObjects(window.FTS.CSV.parse(text)) : [];
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function titleUrl(title) { const params = new URLSearchParams(); params.set("fl", title); return `./title/?${params.toString()}`; }
  function personUrl(person) { const params = new URLSearchParams(); params.set(person.mode || "star", person.title); return `./person/?${params.toString()}`; }

  return { norm, key, coerceNumber, safeUrl, escapeHtml, splitComma, featureEnabled, appSettings, normalizeType, normalizeAccess, isUKCountry, parseVisitedDate, fetchRows, shuffle, titleUrl, personUrl };
})();