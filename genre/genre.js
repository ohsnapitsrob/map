(function () {
  const config = window.APP_CONFIG || {};

  function normalise(value) {
    return (value || "").toString().trim();
  }

  function normaliseKey(value) {
    return normalise(value).toLowerCase();
  }

  function getValue(row, key) {
    const target = normaliseKey(key);
    const matchedKey = Object.keys(row).find((rowKey) => normaliseKey(rowKey) === target);
    return matchedKey ? row[matchedKey] : "";
  }

  function splitList(value) {
    return normalise(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normaliseType(value) {
    const type = normaliseKey(value);

    if (type === "film" || type === "movie" || type === "movies") return "movies";
    if (type === "tv" || type === "tv show" || type === "tv shows" || type === "series") return "tv";

    return "other";
  }

  function sectionLabel(key) {
    if (key === "movies") return "Films";
    if (key === "tv") return "Series";
    return "Other";
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

    const headers = rows[0].map(normalise);

    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });
  }

  async function fetchCSV(url) {
    if (!url) return [];

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load CSV: ${url}`);

    return rowsToObjects(parseCSV(await response.text()));
  }

  function redirectTo404(reason) {
    const params = new URLSearchParams();
    params.set("env-guard", reason || "genre");
    window.location.replace(`/404.html?${params.toString()}`);
  }

  function posterCard(item) {
    const title = normalise(getValue(item, "title"));
    const poster = normalise(getValue(item, "poster"));

    if (!title) return "";

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

  function renderGroupedPosters(grid, matches) {
    const groups = new Map([
      ["movies", []],
      ["tv", []],
      ["other", []]
    ]);

    matches.forEach((item) => {
      const title = normalise(getValue(item, "title"));
      if (!title) return;

      const groupKey = normaliseType(getValue(item, "type"));
      groups.get(groupKey).push(item);
    });

    const sections = Array.from(groups.entries())
      .map(([key, items]) => ({
        key,
        title: sectionLabel(key),
        items: items.sort((a, b) => normalise(getValue(a, "title")).localeCompare(normalise(getValue(b, "title"))))
      }))
      .filter((section) => section.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title));

    const showSectionTitles = sections.length > 1;

    grid.innerHTML = sections.map((section) => `
      <section class="person-section">
        ${showSectionTitles ? `<h2 class="person-section-title">${section.title}</h2>` : ""}
        <div class="person-grid-section">
          ${section.items.map(posterCard).join("")}
        </div>
      </section>
    `).join("");
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const genre = normalise(params.get("genre"));

    if (!genre) {
      redirectTo404("genre");
      return;
    }

    const target = normaliseKey(genre);

    try {
      const metadata = await fetchCSV(config.TITLE_METADATA_CSV);

      const matches = metadata.filter((item) => {
        return splitList(getValue(item, "Genres"))
          .map(normaliseKey)
          .includes(target);
      });

      if (!matches.length) {
        redirectTo404("genre");
        return;
      }

      document.title = `${genre} | Find That Scene`;

      document.getElementById("genreTitle").textContent = genre;
      document.getElementById("genreCopy").textContent = `Appears in ${matches.length} title${matches.length === 1 ? "" : "s"} with scenes found.`;

      const grid = document.getElementById("genreGrid");
      renderGroupedPosters(grid, matches);
    } catch (error) {
      console.error(error);
      redirectTo404("genre");
    }
  }

  boot();
})();
