window.FTS = window.FTS || {};

FTS.HomePeopleRail = (function () {
  const MAX_ITEMS = 12;
  let builtMarkup = "";
  let insertTimer = null;

  function norm(value) { return (value || "").toString().trim(); }
  function key(value) { return norm(value).toLowerCase(); }
  function escapeHtml(value) { return norm(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function safeUrl(url) { const value = norm(url); if (!value) return ""; try { const parsed = new URL(value); if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href; } catch (err) {} return ""; }
  function splitList(value) { return norm(value).split(",").map(norm).filter(Boolean); }

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
      if ((character === "\n" || character === "\r") && !inQuotes) { if (character === "\r" && next === "\n") i++; row.push(current); current = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; continue; }
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
    });
  }

  async function fetchCsv(url) {
    if (!url) return [];
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    return rowsToObjects(parseCSV(await response.text()));
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }

  function getValue(row, names) {
    const fields = Array.isArray(names) ? names : [names];
    const keys = Object.keys(row || {});
    for (const field of fields) {
      const match = keys.find((rowKey) => key(rowKey) === key(field));
      if (match) return row[match];
    }
    return "";
  }

  function buildOnlyNoAccessTitleSet(sceneRows) {
    const titles = new Map();
    sceneRows.forEach((row) => {
      const title = norm(getValue(row, "title"));
      if (!title) return;
      const titleKey = key(title);
      if (!titles.has(titleKey)) titles.set(titleKey, { total: 0, visible: 0 });
      const entry = titles.get(titleKey);
      entry.total += 1;
      if (norm(getValue(row, ["Access", "access", "ACCESS"])).toUpperCase() !== "NOACCESS") entry.visible += 1;
    });
    return new Set(Array.from(titles.entries()).filter(([, value]) => value.total > 0 && value.visible === 0).map(([titleKey]) => titleKey));
  }

  function buildPeopleIndex(metadataRows, onlyNoAccessTitles) {
    const people = new Map();
    metadataRows.forEach((titleRow) => {
      const title = norm(getValue(titleRow, "title"));
      if (!title) return;
      const titleKey = key(title);
      const onlyNoAccess = onlyNoAccessTitles.has(titleKey);
      [["star", getValue(titleRow, ["Stars", "stars"])], ["director", getValue(titleRow, ["Director", "director"])]].forEach(([mode, rawList]) => {
        splitList(rawList).forEach((name) => {
          const personKey = key(name);
          if (!personKey) return;
          if (!people.has(personKey)) people.set(personKey, { name, mode, titles: new Map() });
          const person = people.get(personKey);
          if (person.mode !== "star" && mode === "star") person.mode = "star";
          person.titles.set(titleKey, { title, onlyNoAccess });
        });
      });
    });
    return people;
  }

  function eligiblePeople(metadataRows, peopleRows, sceneRows) {
    const index = buildPeopleIndex(metadataRows, buildOnlyNoAccessTitleSet(sceneRows));
    return peopleRows.map((row) => {
      const name = norm(getValue(row, "name"));
      const photo = safeUrl(getValue(row, "photo"));
      const person = index.get(key(name));
      if (!name || !photo || !person) return null;
      const titles = Array.from(person.titles.values());
      if (!titles.length) return null;
      if (titles.length === 1 && titles[0].onlyNoAccess === true) return null;
      return { title: name, poster: photo, href: `./person/?${person.mode}=${encodeURIComponent(name)}` };
    }).filter(Boolean);
  }

  async function html() {
    if (builtMarkup) return builtMarkup;
    if (window.FTS?.Features?.isEnabled("homeRailPeopleEnabled") === false) return "";
    const cfg = window.APP_CONFIG || {};
    const sheets = cfg.SHEETS || {};
    const sceneUrls = [sheets.movies, sheets.tv, sheets.music_videos, sheets.misc, sheets.games].filter(Boolean);
    const [metadataRows, peopleRows, ...sceneGroups] = await Promise.all([
      fetchCsv(cfg.TITLE_METADATA_CSV),
      fetchCsv(cfg.PEOPLE_CSV),
      ...sceneUrls.map(fetchCsv)
    ]);
    const items = shuffle(eligiblePeople(metadataRows, peopleRows, sceneGroups.flat())).slice(0, MAX_ITEMS);
    if (!items.length) return "";
    builtMarkup = `<section class="rail rail-people"><div class="rail-header"><div><h2 class="rail-title">Following in their footsteps</h2></div></div><div class="poster-row people-row">${items.map((item) => `<a class="poster-link people-link" href="${escapeHtml(item.href)}" aria-label="${escapeHtml(item.title)}"><div class="poster-card people-card"><img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" loading="lazy" draggable="false"></div></a>`).join("")}</div></section>`;
    return builtMarkup;
  }

  function enableDrag(rail) {
    if (!rail || rail.dataset.peopleDragReady === "true") return;
    rail.dataset.peopleDragReady = "true";
    rail.scrollLeft = 0;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let moved = false;
    rail.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDown = true;
      moved = false;
      startX = e.pageX;
      scrollLeft = rail.scrollLeft;
      rail.classList.add("is-dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const walk = e.pageX - startX;
      if (Math.abs(walk) > 5) moved = true;
      rail.scrollLeft = scrollLeft - walk;
    });
    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      rail.classList.remove("is-dragging");
      if (moved) {
        rail.dataset.justDragged = "true";
        setTimeout(() => { delete rail.dataset.justDragged; }, 150);
      }
    });
    rail.addEventListener("click", (e) => {
      if (rail.dataset.justDragged === "true") {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function railsLookReady(railsRoot) {
    const loading = railsRoot.querySelector(".loading-card");
    const rails = railsRoot.querySelectorAll(":scope > .rail");
    return !loading && rails.length > 0;
  }

  async function placeRail() {
    const railsRoot = document.getElementById("railsRoot");
    if (!railsRoot || !railsLookReady(railsRoot)) return;
    const existing = railsRoot.querySelector(":scope > .rail-people");
    let rail = existing;
    if (!rail) {
      const markup = await html().catch((error) => { console.warn("Could not build people rail", error); return ""; });
      if (!markup) return;
      const template = document.createElement("template");
      template.innerHTML = markup.trim();
      rail = template.content.firstElementChild;
    }
    const gamesRail = Array.from(railsRoot.querySelectorAll(":scope > .rail")).find((item) => item !== rail && item.querySelector(".rail-title")?.textContent.trim().toLowerCase() === "games");
    if (gamesRail) railsRoot.insertBefore(rail, gamesRail);
    else railsRoot.appendChild(rail);
    enableDrag(rail.querySelector(".poster-row"));
  }

  function schedulePlace() {
    clearTimeout(insertTimer);
    insertTimer = setTimeout(placeRail, 250);
  }

  function init() {
    const railsRoot = document.getElementById("railsRoot");
    if (!railsRoot) return;
    const observer = new MutationObserver(schedulePlace);
    observer.observe(railsRoot, { childList: true });
    schedulePlace();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { html, insert: placeRail };
})();
