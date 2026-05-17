window.FTS = window.FTS || {};

FTS.HomeV2Utils = (function () {
  function norm(value) { return (value || "").toString().trim(); }
  function key(value) { return norm(value).toLowerCase(); }
  function coerceNumber(value) { const n = Number((value ?? "").toString().trim()); return Number.isFinite(n) ? n : null; }
  function safeUrl(url) { const value = norm(url); if (!value) return ""; try { const parsed = new URL(value); if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href; } catch (err) {} return ""; }
  function escapeHtml(value) { return norm(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function splitComma(value) { return norm(value).split(",").map(norm).filter(Boolean); }

  function featureEnabled(keyName) { return window.FTS?.Features?.isEnabled(keyName) !== false; }
  function appSettings() { return window.FTS?.AppSettings?.getSettings?.() || {}; }

  function normalizeType(value) {
    const type = key(value);
    if (!type) return "Misc";
    if (type === "film" || type === "movie" || type === "movies") return "Film";
    if (type === "tv" || type === "tv show" || type === "tv shows" || type === "series") return "TV";
    if (type === "music video" || type === "music videos" || type === "mv") return "Music Video";
    if (type === "game" || type === "games" || type === "video game" || type === "video games") return "Video Game";
    if (type === "misc" || type === "other") return "Misc";
    return norm(value);
  }

  function normalizeAccess(value) { return norm(value).toUpperCase(); }

  function isUKCountry(value) {
    const country = key(value);
    return country === "uk" || country === "united kingdom" || country === "england" || country === "scotland" || country === "wales" || country === "northern ireland";
  }

  function parseVisitedDate(value) {
    const raw = norm(value);
    if (!raw) return null;
    const cleaned = raw.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1");
    const ts = Date.parse(cleaned);
    return Number.isFinite(ts) ? ts : null;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      const next = text[i + 1];
      if (character === '"' && inQuotes && next === '"') { current += '"'; i++; continue; }
      if (character === '"') { inQuotes = !inQuotes; continue; }
      if (character === "," && !inQuotes) { row.push(current); current = ""; continue; }
      if ((character === "\n" || character === "\r") && !inQuotes) {
        if (character === "\r" && next === "\n") i++;
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
      headers.forEach((header, index) => { obj[header] = row[index] || ""; });
      return obj;
    }).filter((row) => Object.values(row).some((value) => norm(value) !== ""));
  }

  async function fetchRows(url) {
    if (!url) return [];
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${url}`);
    return rowsToObjects(parseCSV(await response.text()));
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
