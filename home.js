(function () {
  const PRIVACY_STORAGE_KEY = "fts-privacy-settings";
  const statsEl = document.getElementById("homeStats");
  const railsEl = document.getElementById("railsRoot");
  const MIN_GENRE_RAIL_ITEMS = 8;
  const MAX_RAIL_ITEMS = 12;

  function featureEnabled(key) {
    return window.FTS?.Features?.isEnabled(key) !== false;
  }

  function appSettings() {
    return window.FTS?.AppSettings?.getSettings?.() || {};
  }

  function privacyConsentFeatureEnabled() {
    return featureEnabled("privacyConsentEnabled");
  }

  function savedPrivacyChoiceExists() {
    try {
      return Boolean(window.localStorage.getItem(PRIVACY_STORAGE_KEY));
    } catch (err) {
      return false;
    }
  }

  function privacyChoiceRequired() {
    if (!privacyConsentFeatureEnabled()) return false;
    if (window.FTS?.Privacy?.enabled?.() === false) return false;

    return true;
  }

  function privacyChoiceAnswered() {
    if (!privacyChoiceRequired()) return true;
    if (savedPrivacyChoiceExists()) return true;

    return window.FTS?.Privacy?.getSettings?.().hasAnswered === true;
  }

  function waitForPrivacyChoice(callback) {
    if (privacyChoiceAnswered()) {
      callback();
      return;
    }

    railsEl.innerHTML = `
      <div class="loading-card">
        Choose your privacy settings to load the homepage.
      </div>
    `;

    window.addEventListener("fts:privacy-updated", callback, { once: true });
  }

  function norm(s) {
    return (s || "").toString().trim();
  }

  function normalizeComparable(s) {
    return norm(s).toLowerCase();
  }

  function normalizeType(t) {
    const x = norm(t).toLowerCase();

    if (!x) return "Misc";
    if (x === "film" || x === "movie" || x === "movies") return "Film";
    if (x === "tv" || x === "tv show" || x === "tv shows" || x === "series") return "TV";
    if (x === "music video" || x === "music videos" || x === "mv") return "Music Video";
    if (x === "game" || x === "games" || x === "video game" || x === "video games") return "Video Game";
    if (x === "misc" || x === "other") return "Misc";

    return norm(t);
  }

  function normalizeAccess(value) {
    return norm(value).toUpperCase();
  }

  function coerceNumber(x) {
    const n = Number((x ?? "").toString().trim());
    return Number.isFinite(n) ? n : null;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (c === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && next === "\n") i++;

        row.push(cur);
        cur = "";

        if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
          rows.push(row);
        }

        row = [];
        continue;
      }

      cur += c;
    }

    row.push(cur);

    if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];

    const header = rows[0].map((h) => norm(h));
    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      if (!r || r.every((cell) => norm(cell) === "")) continue;

      const obj = {};

      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = r[j] ?? "";
      }

      out.push(obj);
    }

    return out;
  }

  async function fetchSheetCSV(url) {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Failed to fetch CSV: ${url}`);
    }

    return res.text();
  }

  function getVisibleRows(rows) {
    return window.FTS?.Visibility?.getVisibleScenes?.(rows) || rows;
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString();
  }

  function escapeHtml(s) {
    return (s || "")
      .toString()
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

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch (err) {}

    return "";
  }

  function splitComma(value) {
    return norm(value)
      .split(",")
      .map((item) => norm(item))
      .filter(Boolean);
  }

  function titleUrl(title) {
    const params = new URLSearchParams();
    params.set("fl", title);
    return `./title/?${params.toString()}`;
  }

  function parseVisitedDate(value) {
    const raw = norm(value);

    if (!raw) return null;

    const cleaned = raw.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1");
    const ts = Date.parse(cleaned);

    return Number.isFinite(ts) ? ts : null;
  }

  function isUKCountry(value) {
    const country = normalizeComparable(value);
    return country === "uk" || country === "united kingdom" || country === "england" || country === "scotland" || country === "wales" || country === "northern ireland";
  }

  function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function overlayBadgesForTitle(title, options = {}) {
    if (!featureEnabled("homepagePosterOverlays")) return [];
    if (appSettings().hideHomepageTags === true) return [];
    if (options.suppressOverlays === true) return [];
    if (options.variant === "thumbnail") return [];

    const key = normalizeComparable(title);

    if (options.noAccessTitles?.has(key)) return [{ label: "No access", type: "no-access" }];
    if (options.topTenTitles?.has(key)) return [{ label: "Top 10", type: "top" }];
    if (options.latestTitles?.has(key)) return [{ label: "New", type: "new" }];

    return [];
  }

  function posterHtml(title, imageUrl, variant = "poster", options = {}) {
    const src = safeUrl(imageUrl);
    const isThumbnail = variant === "thumbnail";
    const isRanked = options.ranked === true;
    const rank = options.rank;
    const badges = overlayBadgesForTitle(title, { ...options, variant });

    return `
      <a class="poster-link ${isThumbnail ? "thumbnail-link" : ""} ${isRanked ? "ranked-link" : ""}" href="${titleUrl(title)}" aria-label="${escapeHtml(title)}">
        ${isRanked ? `<span class="ranked-number" aria-hidden="true">${escapeHtml(rank)}</span>` : ""}
        <div class="poster-card ${isThumbnail ? "thumbnail-card" : ""}">
          ${
            src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(title)}" loading="lazy" draggable="false">`
              : `<div class="poster-fallback">${escapeHtml(title)}</div>`
          }
          ${badges.length ? `<div class="poster-badges">${badges.map((badge) => `<span class="poster-badge poster-badge-${escapeHtml(badge.type)}">${escapeHtml(badge.label)}</span>`).join("")}</div>` : ""}
        </div>
      </a>
    `;
  }

  function railHtml(title, items, options = {}) {
    const variant = options.variant || "poster";
    const imageField = variant === "thumbnail" ? "thumbnail" : "poster";
    const ranked = options.ranked === true && featureEnabled("homeRailTopTenStyleEnabled");

    const withImages = items.filter((item) => safeUrl(item[imageField]));

    if (!withImages.length) return "";

    return `
      <section class="rail ${ranked ? "rail-ranked" : ""}">
        <div class="rail-header">
          <div>
            <h2 class="rail-title">${escapeHtml(title)}</h2>
            ${options.subHeader ? `<p class="rail-subtitle">${escapeHtml(options.subHeader)}</p>` : ""}
          </div>
          ${
            options.href
              ? `<a class="rail-link" href="${escapeHtml(options.href)}">${escapeHtml(options.linkLabel || "View more")}</a>`
              : ""
          }
        </div>

        <div class="poster-row ${variant === "thumbnail" ? "thumbnail-row" : ""} ${ranked ? "ranked-row" : ""}">
          ${withImages
            .map((item, index) => posterHtml(item.title, item[imageField], variant, {
              ranked,
              rank: index + 1,
              suppressOverlays: options.suppressOverlays,
              topTenTitles: options.topTenTitles,
              latestTitles: options.latestTitles,
              noAccessTitles: options.noAccessTitles
            }))
            .join("")}
        </div>
      </section>
    `;
  }

  function makeRailsDraggable() {
    document.querySelectorAll(".poster-row").forEach((rail) => {
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

        if (Math.abs(walk) > 5) {
          moved = true;
        }

        rail.scrollLeft = scrollLeft - walk;
      });

      window.addEventListener("mouseup", () => {
        if (!isDown) return;

        isDown = false;
        rail.classList.remove("is-dragging");

        if (moved) {
          rail.dataset.justDragged = "true";

          setTimeout(() => {
            delete rail.dataset.justDragged;
          }, 150);
        }
      });

      rail.addEventListener(
        "click",
        (e) => {
          if (rail.dataset.justDragged === "true") {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true
      );
    });
  }

  function renderStats({ scenes, titles, cities, countries }) {
    statsEl.innerHTML = `
      <article class="stat-card">
        <div class="stat-value">${formatNumber(scenes)}</div>
        <div class="stat-label">Scenes</div>
      </article>

      <article class="stat-card">
        <div class="stat-value">${formatNumber(titles)}</div>
        <div class="stat-label">Titles</div>
      </article>

      <article class="stat-card">
        <div class="stat-value">${formatNumber(cities)}</div>
        <div class="stat-label">Cities</div>
      </article>

      <article class="stat-card">
        <div class="stat-value">${formatNumber(countries)}</div>
        <div class="stat-label">Countries</div>
      </article>
    `;
  }

  function buildTitleEntries(rows, metadataRows) {
    const metaByTitle = new Map();

    metadataRows.forEach((meta) => {
      metaByTitle.set(normalizeComparable(meta.title), meta);
    });

    const grouped = new Map();

    rows.forEach((row) => {
      const key = normalizeComparable(row.title);
      const meta = metaByTitle.get(key) || {};

      if (!grouped.has(key)) {
        grouped.set(key, {
          title: row.title,
          type: row.type || meta.type,
          series: row.series,
          count: 0,
          visibleCount: 0,
          noAccessCount: 0,
          ukCount: 0,
          latestVisitedTs: null,

          railOrder: Number.isFinite(meta.railOrder)
            ? meta.railOrder
            : row.railOrder,

          poster: meta.poster || "",
          thumbnail: meta.thumbnail || row.thumbnail || "",
          nt: norm(meta.nt),
          genres: splitComma(meta.genres)
        });
      }

      const entry = grouped.get(key);
      const access = normalizeAccess(row.access);

      entry.count += 1;

      if (access === "NOACCESS") {
        entry.noAccessCount += 1;
      } else {
        entry.visibleCount += 1;
      }

      if (isUKCountry(row.country)) {
        entry.ukCount += 1;
      }

      if (!entry.series && row.series) {
        entry.series = row.series;
      }

      if (
        !Number.isFinite(entry.latestVisitedTs) ||
        row.visitedTs > entry.latestVisitedTs
      ) {
        entry.latestVisitedTs = row.visitedTs;
      }
    });

    return Array.from(grouped.values()).map((entry) => ({
      ...entry,
      onlyNoAccess: entry.count > 0 && entry.visibleCount === 0 && entry.noAccessCount > 0
    }));
  }

  function titleCountLabel(count) {
    return `${count} ${count === 1 ? "title" : "titles"}`;
  }

  function visitedSubHeader(count) {
    return `${titleCountLabel(count)} with scenes visited`;
  }

  function selectionSubHeader(visibleCount, totalCount) {
    if (visibleCount >= totalCount) {
      return visitedSubHeader(totalCount);
    }

    return `A random selection of ${titleCountLabel(visibleCount)} with scenes visited`;
  }

  function latestSubHeader(count) {
    return `${titleCountLabel(count)} with new scenes added`;
  }

  function genreRailTitle(genre, type) {
    return `${genre} ${type === "Film" ? "Films" : "Series"}`;
  }

  function buildGenreRails(entries) {
    if (!featureEnabled("homeGenreRailsEnabled")) return [];

    const genreMap = new Map();

    entries.forEach((entry) => {
      if (!safeUrl(entry.poster)) return;

      const type = normalizeType(entry.type);

      if (type !== "Film" && type !== "TV") return;

      (entry.genres || []).forEach((genre) => {
        const genreKey = normalizeComparable(genre);
        if (!genreKey) return;

        const key = `${genreKey}::${type}`;

        if (!genreMap.has(key)) {
          genreMap.set(key, {
            title: genreRailTitle(genre, type),
            entries: []
          });
        }

        genreMap.get(key).entries.push(entry);
      });
    });

    return Array.from(genreMap.values())
      .map((genre) => {
        const items = shuffle(genre.entries).slice(0, MAX_RAIL_ITEMS);

        return {
          title: genre.title,
          subHeader: selectionSubHeader(items.length, genre.entries.length),
          items,
          total: genre.entries.length
        };
      })
      .filter((rail) => rail.total >= MIN_GENRE_RAIL_ITEMS)
      .map((rail) => ({
        title: rail.title,
        subHeader: rail.subHeader,
        items: rail.items
      }));
  }

  function maybeRail(toggleKey, rail) {
    return featureEnabled(toggleKey) ? rail : null;
  }

  function titleSet(items) {
    return new Set((items || []).map((item) => normalizeComparable(item.title)));
  }

  function buildRails(rows, metadataRows) {
    const entries = buildTitleEntries(rows, metadataRows);

    const hasPoster = (entry) => safeUrl(entry.poster);
    const hasThumbnail = (entry) => safeUrl(entry.thumbnail);

    const latestScenes = [...entries]
      .filter(hasPoster)
      .filter((entry) => Number.isFinite(entry.latestVisitedTs))
      .sort((a, b) => b.latestVisitedTs - a.latestVisitedTs)
      .slice(0, MAX_RAIL_ITEMS);

    const topFilmsUK = [...entries]
      .filter(hasPoster)
      .filter((entry) => normalizeType(entry.type) === "Film")
      .filter((entry) => entry.ukCount > 0)
      .sort((a, b) => b.ukCount - a.ukCount || a.title.localeCompare(b.title))
      .slice(0, 10);

    const topSeriesUK = [...entries]
      .filter(hasPoster)
      .filter((entry) => normalizeType(entry.type) === "TV")
      .filter((entry) => entry.ukCount > 0)
      .sort((a, b) => b.ukCount - a.ukCount || a.title.localeCompare(b.title))
      .slice(0, 10);

    const overlayContext = {
      latestTitles: titleSet(latestScenes),
      topTenTitles: titleSet([...topFilmsUK, ...topSeriesUK]),
      noAccessTitles: titleSet(entries.filter((entry) => entry.onlyNoAccess))
    };

    function orderedSeriesRail(seriesName, options = {}) {
      const direction = options.direction || "asc";

      return [...entries]
        .filter(hasPoster)
        .filter(
          (entry) =>
            normalizeComparable(entry.series) ===
            normalizeComparable(seriesName)
        )
        .sort((a, b) => {
          const aHas = Number.isFinite(a.railOrder);
          const bHas = Number.isFinite(b.railOrder);

          if (aHas && bHas) {
            return direction === "desc"
              ? b.railOrder - a.railOrder
              : a.railOrder - b.railOrder;
          }

          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;

          return a.title.localeCompare(b.title);
        })
        .slice(0, MAX_RAIL_ITEMS);
    }

    const typeRail = (typeName) => {
      return shuffle(
        entries
          .filter(hasPoster)
          .filter((entry) => normalizeType(entry.type) === typeName)
      ).slice(0, MAX_RAIL_ITEMS);
    };

    const musicVideoEntries = entries
      .filter(hasThumbnail)
      .filter((entry) => normalizeType(entry.type) === "Music Video");

    const musicVideoThumbnailRail = shuffle(musicVideoEntries).slice(0, MAX_RAIL_ITEMS);

    const nationalTrustEntries = entries.filter((entry) => {
      if (!hasPoster(entry)) return false;

      return norm(entry.nt) !== "";
    });

    const nationalTrustRail = shuffle(nationalTrustEntries).slice(0, MAX_RAIL_ITEMS);

    const moviesEntries = entries
      .filter(hasPoster)
      .filter((entry) => normalizeType(entry.type) === "Film");

    const tvShowEntries = entries
      .filter(hasPoster)
      .filter((entry) => normalizeType(entry.type) === "TV");

    const gamesEntries = entries
      .filter(hasPoster)
      .filter((entry) => normalizeType(entry.type) === "Video Game");

    const movies = typeRail("Film");
    const tvShows = typeRail("TV");
    const games = typeRail("Video Game");

    const fixedRails = [
      maybeRail("homeRailLatestScenesEnabled", {
        title: "Latest",
        subHeader: latestSubHeader(latestScenes.length),
        items: latestScenes,
        suppressOverlays: true
      })
    ].filter(Boolean);

    const randomRails = [
      maybeRail("homeRailTopScenesEnabled", {
        title: "Top 10 Films in the UK",
        subHeader: "Top 10 titles based on number of scenes visited",
        items: topFilmsUK,
        ranked: true,
        suppressOverlays: true
      }),

      maybeRail("homeRailTopScenesEnabled", {
        title: "Top 10 Series in the UK",
        subHeader: "Top 10 titles based on number of scenes visited",
        items: topSeriesUK,
        ranked: true,
        suppressOverlays: true
      }),

      maybeRail("homeRailJamesBondEnabled", {
        title: "James Bond",
        items: orderedSeriesRail("James Bond", { direction: "desc" })
      }),

      maybeRail("homeRailHarryPotterEnabled", {
        title: "Harry Potter",
        items: orderedSeriesRail("Harry Potter")
      }),

      maybeRail("homeRailMoviesEnabled", {
        title: "Movies",
        subHeader: selectionSubHeader(movies.length, moviesEntries.length),
        items: movies
      }),

      maybeRail("homeRailTVEnabled", {
        title: "TV Shows",
        subHeader: selectionSubHeader(tvShows.length, tvShowEntries.length),
        items: tvShows
      }),

      maybeRail("homeRailMusicVideosEnabled", {
        title: "Music Videos",
        subHeader: selectionSubHeader(musicVideoThumbnailRail.length, musicVideoEntries.length),
        items: musicVideoThumbnailRail,
        variant: "thumbnail",
        suppressOverlays: true
      }),

      maybeRail("homeRailNationalTrustEnabled", {
        title: "National Trust On Screen",
        subHeader: selectionSubHeader(nationalTrustRail.length, nationalTrustEntries.length),
        items: nationalTrustRail,
        href: "./national-trust/",
        linkLabel: "Explore National Trust locations"
      }),

      maybeRail("homeRailGamesEnabled", {
        title: "Games",
        subHeader: selectionSubHeader(games.length, gamesEntries.length),
        items: games
      }),

      ...buildGenreRails(entries)
    ].filter(Boolean).map((rail) => ({ ...overlayContext, ...rail }));

    return [
      ...fixedRails.map((rail) => ({ ...overlayContext, ...rail })),
      ...shuffle(randomRails)
    ];
  }

  function renderRails(rows, metadataRows) {
    if (!featureEnabled("homeRailsEnabled")) {
      railsEl.innerHTML = "";
      return;
    }

    const rails = buildRails(rows, metadataRows);

    const html = rails
      .map((rail) =>
        railHtml(rail.title, rail.items, {
          variant: rail.variant,
          href: rail.href,
          linkLabel: rail.linkLabel,
          subHeader: rail.subHeader,
          ranked: rail.ranked,
          suppressOverlays: rail.suppressOverlays,
          topTenTitles: rail.topTenTitles,
          latestTitles: rail.latestTitles,
          noAccessTitles: rail.noAccessTitles
        })
      )
      .filter(Boolean)
      .join("");

    railsEl.innerHTML =
      html || `<div class="loading-card">No poster rails to show yet.</div>`;

    makeRailsDraggable();
  }

  async function loadTitleMetadata() {
    const cfg = window.APP_CONFIG || {};
    const url =
      cfg.TITLE_METADATA_CSV ||
      cfg.TITLE_METADATA ||
      cfg.TITLES_METADATA_CSV;

    if (!url) return [];

    try {
      const text = await fetchSheetCSV(url);

      return rowsToObjects(parseCSV(text))
        .map((row) => ({
          title: norm(row.title),
          type: norm(row.type),
          description: norm(row.description),
          imdb: norm(row.imdb),
          justwatch: norm(row.justwatch),
          poster: norm(row.poster),
          trailer: norm(row.trailer),
          thumbnail: norm(row.thumbnail),
          nt: norm(row.NT),
          genres: norm(row.Genres || row.genres || row.genre || row.Genre),
          railOrder: coerceNumber(row["set-rail-order"])
        }))
        .filter((row) => row.title);
    } catch (err) {
      console.warn("Could not load title metadata CSV", err);
      return [];
    }
  }

  async function loadSceneRows() {
    const cfg = window.APP_CONFIG || {};
    const sheets = cfg.SHEETS || {};

    const sources = [
      ["Film", sheets.movies],
      ["TV", sheets.tv],
      ["Music Video", sheets.music_videos],
      ["Video Game", sheets.games],
      ["Misc", sheets.misc]
    ].filter(([, url]) => !!url);

    const texts = await Promise.all(
      sources.map(([, url]) => fetchSheetCSV(url))
    );

    const rows = [];

    for (let i = 0; i < sources.length; i++) {
      const [fallbackType] = sources[i];
      const parsed = rowsToObjects(parseCSV(texts[i]));

      parsed.forEach((row) => {
        const title = norm(row.title);
        const type = normalizeType(row.type || fallbackType);

        const lat = coerceNumber(row.lat);
        const lng = coerceNumber(row.lng);

        if (!title || typeof lat !== "number" || typeof lng !== "number") {
          return;
        }

        rows.push({
          title,
          type,
          series: norm(row.series),
          country: norm(row.country),
          city: norm(row.city || row.place),
          thumbnail: norm(row.thumbnail),
          access: norm(row.Access || row.access || row.ACCESS),
          railOrder: coerceNumber(row["set-rail-order"]),
          visitedTs: parseVisitedDate(
            row["date-formatted"] ||
              row["raw-date"] ||
              row["visited"] ||
              row["visit-date"]
          )
        });
      });
    }

    return rows;
  }

  async function init() {
    try {
      const [sceneRows, metadataRows] = await Promise.all([
        loadSceneRows(),
        loadTitleMetadata()
      ]);

      const visibleRows = getVisibleRows(sceneRows);
      const titles = new Set();
      const cities = new Set();
      const countries = new Set();

      visibleRows.forEach((row) => {
        if (row.title) titles.add(row.title);
        if (row.city) cities.add(row.city);
        if (row.country) countries.add(row.country);
      });

      renderRails(visibleRows, metadataRows);

      renderStats({
        scenes: visibleRows.length,
        titles: titles.size,
        cities: cities.size,
        countries: countries.size
      });
    } catch (err) {
      console.error(err);

      railsEl.innerHTML = `
        <div class="loading-card">
          Could not load rails.
        </div>
      `;

      statsEl.innerHTML = `
        <div class="loading-card">
          Could not load stats.</div>
      `;
    }
  }

  waitForPrivacyChoice(init);
})();
