window.FTS = window.FTS || {};

FTS.CSV = (function () {
  const { norm } = FTS.Utils;

  function parse(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      const next = text[i + 1];

      if (character === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
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
        if (character === "\r" && next === "\n") i++;
        row.push(current);
        current = "";
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];
        continue;
      }

      current += character;
    }

    row.push(current);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    return rows;
  }

  function toObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map((value) => norm(value));
    const output = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => norm(cell) === "")) continue;
      const object = {};
      for (let j = 0; j < header.length; j++) object[header[j]] = row[j] ?? "";
      output.push(object);
    }

    return output;
  }

  async function fetchText(url, options = {}) {
    if (window.FTS?.DataCache?.fetchText) {
      const result = await window.FTS.DataCache.fetchText(url, options);
      return result.text;
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${url}`);
    return response.text();
  }

  async function fetchObjects(url, options = {}) {
    if (window.FTS?.DataCache?.fetchCSV) {
      const result = await window.FTS.DataCache.fetchCSV(url, options);
      return result.rows;
    }

    const text = await fetchText(url, options);
    return toObjects(parse(text));
  }

  return { parse, toObjects, fetchText, fetchObjects };
})();
