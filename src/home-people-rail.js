window.FTS = window.FTS || {};

FTS.HomePeopleRail = (function () {
  const MAX_ITEMS = 12;

  function norm(value) {
    return (value || "").toString().trim();
  }

  function key(value) {
    return norm(value).toLowerCase();
  }

  function escapeHtml(value) {
    return norm(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(url) {
    const value = norm(url);
    if (!value) return "";

    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (err) {}

    return "";
  }

  function splitList(value) {
    return norm(value).split(",").map(norm).filter(Boolean);
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

  async function loadPeopleRows() {
    const url = window.APP_CONFIG?.PEOPLE_CSV;
    if (!url) return [];

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

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

  function getMetaValue(row, names) {
    const fields = Array.isArray(names) ? names : [names];
    const keys = Object.keys(row || {});

    for (const field of fields) {
      const match = keys.find((rowKey) => key(rowKey) === key(field));
      if (match) return row[match];
    }

    return "";
  }

  function buildPeopleIndex(metadataRows) {
    const people = new Map();

    metadataRows.forEach((titleRow) => {
      const title = norm(getMetaValue(titleRow, "title"));
      if (!title) return;

      const titleKey = key(title);
      const onlyNoAccess = titleRow.onlyNoAccess === true;

      [
        ["star", getMetaValue(titleRow, ["Stars", "stars"])],
        ["director", getMetaValue(titleRow, ["Director", "director"])]
      ].forEach(([mode, rawList]) => {
        splitList(rawList).forEach((name) => {
          const personKey = key(name);
          if (!personKey) return;

          if (!people.has(personKey)) {
            people.set(personKey, {
              name,
              mode,
              titles: new Map()
            });
          }

          const person = people.get(personKey);
          if (person.mode !== "star" && mode === "star") person.mode = "star";
          person.titles.set(titleKey, { title, onlyNoAccess });
        });
      });
    });

    return people;
  }

  function eligiblePeople(metadataRows, peopleRows) {
    const index = buildPeopleIndex(metadataRows);

    return peopleRows
      .map((row) => {
        const name = norm(getMetaValue(row, "name"));
        const photo = safeUrl(getMetaValue(row, "photo"));
        const person = index.get(key(name));

        if (!name || !photo || !person) return null;

        const titles = Array.from(person.titles.values());
        if (!titles.length) return null;
        if (titles.length === 1 && titles[0].onlyNoAccess === true) return null;

        return {
          title: name,
          poster: photo,
          href: `./person/?${person.mode}=${encodeURIComponent(name)}`
        };
      })
      .filter(Boolean);
  }

  function html(metadataRows) {
    if (window.FTS?.Features?.isEnabled("homeRailPeopleEnabled") === false) {
      return Promise.resolve("");
    }

    return loadPeopleRows().then((peopleRows) => {
      const items = shuffle(eligiblePeople(metadataRows, peopleRows)).slice(0, MAX_ITEMS);
      if (!items.length) return "";

      return `
        <section class="rail rail-people">
          <div class="rail-header">
            <div>
              <h2 class="rail-title">Following in their footsteps</h2>
            </div>
          </div>
          <div class="poster-row people-row">
            ${items.map((item) => `
              <a class="poster-link people-link" href="${escapeHtml(item.href)}" aria-label="${escapeHtml(item.title)}">
                <div class="poster-card people-card">
                  <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" loading="lazy" draggable="false">
                </div>
              </a>
            `).join("")}
          </div>
        </section>
      `;
    }).catch((error) => {
      console.warn("Could not build people rail", error);
      return "";
    });
  }

  return { html };
})();
