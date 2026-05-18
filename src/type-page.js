(function () {
  const config = window.APP_CONFIG || {};

  function norm(value) {
    return (value || "").toString().trim();
  }

  function key(value) {
    return norm(value).toLowerCase();
  }

  function getValue(row, field) {
    const target = key(field);
    const matched = Object.keys(row).find((item) => key(item) === target);
    return matched ? row[matched] : "";
  }

  function parseCSV(text) {
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
    });
  }

  async function fetchCSV(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return rowsToObjects(parseCSV(await response.text()));
  }

  function posterCard(item) {
    const title = norm(getValue(item, "title"));
    const poster = norm(getValue(item, "poster"));

    return `
      <a class="person-card" href="../title/?fl=${encodeURIComponent(title)}" aria-label="${title}">
        <div class="poster-card">
          ${poster
            ? `<img src="${poster}" alt="${title}" loading="lazy">`
            : `<div class="poster-fallback">${title}</div>`}
        </div>
      </a>
    `;
  }

  async function boot() {
    const pageConfig = window.FTS_TYPE_PAGE;
    if (!pageConfig) return;

    const rows = await fetchCSV(config.TITLE_METADATA_CSV);

    const matches = rows
      .filter((row) => key(getValue(row, "type")) === key(pageConfig.type))
      .sort((a, b) => norm(getValue(a, "title")).localeCompare(norm(getValue(b, "title"))));

    document.title = `${pageConfig.label} | Find That Scene`;

    document.getElementById("typeTitle").textContent = pageConfig.label;
    document.getElementById("typeCopy").textContent = `${matches.length} title${matches.length === 1 ? "" : "s"} with scenes found.`;

    document.getElementById("typeGrid").innerHTML = matches.map(posterCard).join("");
  }

  boot();
})();