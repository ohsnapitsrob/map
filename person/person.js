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

  async function loadSceneRows() {
    const sheets = config.SHEETS || {};
    const urls = [sheets.movies, sheets.tv, sheets.music_videos, sheets.misc, sheets.games].filter(Boolean);
    const groups = await Promise.all(urls.map(fetchCSV));
    return groups.flat();
  }

  function redirectTo404(reason) {
    const params = new URLSearchParams();
    params.set("env-guard", reason || "person");
    window.location.replace(`/404.html?${params.toString()}`);
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const star = params.get("star");
    const director = params.get("director");

    if ((!star && !director) || (star && director)) {
      redirectTo404("person");
      return;
    }

    const mode = star ? "star" : "director";
    const label = normalise(star || director);
    const target = normaliseKey(label);
    const field = mode === "star" ? "Stars" : "Director";

    try {
      const [metadata, sceneRows] = await Promise.all([
        fetchCSV(config.TITLE_METADATA_CSV),
        loadSceneRows()
      ]);

      const matches = metadata.filter((item) => {
        return splitList(getValue(item, field))
          .map(normaliseKey)
          .includes(target);
      });

      if (!matches.length) {
        redirectTo404("person");
        return;
      }

      const sceneCounts = new Map();

      sceneRows.forEach((scene) => {
        const title = normalise(getValue(scene, "title"));
        if (!title) return;
        sceneCounts.set(normaliseKey(title), (sceneCounts.get(normaliseKey(title)) || 0) + 1);
      });

      matches.sort((a, b) => {
        const aTitle = normalise(getValue(a, "title"));
        const bTitle = normalise(getValue(b, "title"));
        const aCount = sceneCounts.get(normaliseKey(aTitle)) || 0;
        const bCount = sceneCounts.get(normaliseKey(bTitle)) || 0;
        return bCount - aCount || aTitle.localeCompare(bTitle);
      });

      document.title = `${label} | Find That Scene`;

      document.getElementById("personKicker").textContent = mode === "star" ? "Star" : "Director";
      document.getElementById("personTitle").textContent = label;
      document.getElementById("personCopy").textContent = mode === "star"
        ? `${matches.length} title${matches.length === 1 ? "" : "s"} featuring ${label}.`
        : `${matches.length} title${matches.length === 1 ? "" : "s"} directed by ${label}.`;

      const grid = document.getElementById("personGrid");
      grid.innerHTML = "";

      matches.forEach((item) => {
        const title = normalise(getValue(item, "title"));
        const poster = normalise(getValue(item, "poster"));
        if (!title) return;

        const card = document.createElement("a");
        card.className = "person-card";
        card.href = `../title/?fl=${encodeURIComponent(title)}`;
        card.setAttribute("aria-label", title);

        card.innerHTML = `
          <div class="poster-card">
            ${poster
              ? `<img src="${poster}" alt="${title}" loading="lazy">`
              : `<div class="poster-fallback">${title}</div>`}
          </div>
        `;

        grid.appendChild(card);
      });
    } catch (error) {
      console.error(error);
      redirectTo404("person");
    }
  }

  boot();
})();
