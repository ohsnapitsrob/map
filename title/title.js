(function () {
  const {
    norm,
    normalizeComparable,
    escapeHtml,
    safeUrl,
    getYouTubeEmbedUrl,
    formatNumber,
    plural,
    labelForCount,
    displayType
  } = FTS.Utils;

  const {
    loadAll,
    loadTitleMetadata,
    titleMetadataMap,
    sortScenes,
    buildTitleMapUrl
  } = FTS.Locations;

  const contentEl = document.getElementById("titleContent");

  function renderLoading() {
    contentEl.innerHTML = `<div class="fts-loader" aria-label="Loading"></div>`;
  }

  function getRequestedTitle() {
    const params = new URLSearchParams(window.location.search);
    return norm(params.get("fl") || params.get("title") || params.get("q"));
  }

  function redirectTo404(reason, value = "") {
    const params = new URLSearchParams();
    params.set("title-error", reason);
    if (value) params.set("value", value);
    window.location.replace(`../404.html?${params.toString()}`);
  }

  function metadataHasContent(metadata) {
    if (!metadata) return false;
    return Boolean(norm(metadata.description) || norm(metadata.imdb) || norm(metadata.justwatch) || norm(metadata.poster) || norm(metadata.trailer));
  }

  function waitForShellDependencies(callback) {
    if (window.FTS?.AppSettings && window.FTS?.Visibility && window.FTS?.Privacy) {
      callback();
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (window.FTS?.AppSettings && window.FTS?.Visibility && window.FTS?.Privacy) {
        window.clearInterval(interval);
        callback();
        return;
      }

      if (Date.now() - startedAt > 2500) {
        window.clearInterval(interval);
        callback();
      }
    }, 25);
  }

  function titleSummaryHtml(metadata) {
    if (!metadataHasContent(metadata)) return "";
    const poster = safeUrl(metadata.poster);
    const imdb = safeUrl(metadata.imdb);
    const justwatch = safeUrl(metadata.justwatch);
    const trailer = window.FTS?.Privacy?.mediaAllowed?.() ? getYouTubeEmbedUrl(metadata.trailer) : "";
    const hasTopRow = poster || norm(metadata.description) || imdb || justwatch;

    return `
      <section class="title-summary">
        ${hasTopRow ? `<div class="title-summary-top">${poster ? `<div class="title-poster"><img src="${escapeHtml(poster)}" alt="" loading="lazy"></div>` : `<div class="title-poster title-poster-empty" aria-hidden="true"></div>`}<div class="title-summary-body">${metadata.description ? `<p class="title-description">${escapeHtml(metadata.description)}</p>` : ""}${imdb || justwatch ? `<div class="title-links">${imdb ? `<a class="btn btn-secondary" href="${escapeHtml(imdb)}" target="_blank" rel="noopener noreferrer">IMDb</a>` : ""}${justwatch ? `<a class="btn btn-secondary" href="${escapeHtml(justwatch)}" target="_blank" rel="noopener noreferrer">JustWatch</a>` : ""}</div>` : ""}</div></div>` : ""}
        ${trailer ? `<div class="title-trailer-wrap"><iframe class="title-trailer" src="${escapeHtml(trailer)}" title="Trailer" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ""}
      </section>
    `;
  }

  function renderNoVisibleScenes(title) {
    document.title = `${title} | Find That Scene`;
    contentEl.innerHTML = `
      <div class="empty-card">
        <div class="kicker">No public access</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">This title currently has no publicly accessible scenes based on your visibility settings.</p>
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="../browse/">Browse titles</a>
        <a class="btn btn-secondary" href="../explore/">Open map</a>
      </div>
    `;
  }

  function renderTitlePage(title, rows, metadata) {
    const visibleRows = rows;
    const sortedRows = sortScenes(visibleRows);
    const sceneCount = sortedRows.length;

    if (!sceneCount) {
      renderNoVisibleScenes(title);
      return;
    }

    const cities = new Set();
    const countries = new Set();
    const types = new Set();

    sortedRows.forEach((row) => {
      if (row.type) types.add(row.type);
      if (row.city) cities.add(row.city);
      if (row.country) countries.add(row.country);
    });

    const cityCount = cities.size;
    const countryCount = countries.size;
    const typeLabel = metadata?.type || Array.from(types).map(displayType).join(", ");

    document.title = `${title} | Find That Scene`;
    contentEl.innerHTML = `
      <section>
        <div class="kicker">${escapeHtml(typeLabel || "Title")}</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">${plural(sceneCount, "scene", "scenes")} found across ${plural(cityCount, "city", "cities")} and ${plural(countryCount, "country", "countries")}.</p>
      </section>
      ${titleSummaryHtml(metadata)}
      <section class="stats-grid">
        <article class="stat-card"><div class="stat-value">${formatNumber(sceneCount)}</div><div class="stat-label">${labelForCount(sceneCount, "Scene", "Scenes")}</div></article>
        <article class="stat-card"><div class="stat-value">${formatNumber(cityCount)}</div><div class="stat-label">${labelForCount(cityCount, "City", "Cities")}</div></article>
        <article class="stat-card"><div class="stat-value">${formatNumber(countryCount)}</div><div class="stat-label">${labelForCount(countryCount, "Country", "Countries")}</div></article>
      </section>
      <div class="actions">
        <a class="btn btn-primary" href="${buildTitleMapUrl(title)}">See scenes on the map</a>
        <a class="btn btn-secondary" href="../browse/">Browse all titles</a>
      </div>
      <section class="scene-section">
        <div class="scene-section-head"><h2 class="scene-section-title">${labelForCount(sceneCount, "Scene", "Scenes")}</h2></div>
        <div class="scene-grid">${sortedRows.map(FTS.SceneCard.render).join("")}</div>
      </section>
    `;
  }

  async function loadTitleData() {
    if (window.FTS?.DataStore?.getScenePacks) {
      const [scenePacks, metadataRows] = await Promise.all([
        window.FTS.DataStore.getScenePacks(),
        window.FTS.DataStore.getTitleMetadata ? window.FTS.DataStore.getTitleMetadata() : loadTitleMetadata()
      ]);

      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return {
        activeRows: hideNoAccess ? scenePacks.publicScenes : scenePacks.allScenes,
        allRows: scenePacks.allScenes,
        metadataRows
      };
    }

    const [rows, metadataRows] = await Promise.all([loadAll(), loadTitleMetadata()]);
    const activeRows = FTS.Visibility?.getVisibleScenes?.(rows) || rows;
    return { activeRows, allRows: rows, metadataRows };
  }

  async function init() {
    renderLoading();
    const requestedTitle = getRequestedTitle();
    if (!requestedTitle) {
      redirectTo404("missing-fl");
      return;
    }

    try {
      const { activeRows, allRows, metadataRows } = await loadTitleData();
      const activeMatches = activeRows.filter((row) => normalizeComparable(row.title) === normalizeComparable(requestedTitle));
      const allMatches = allRows.filter((row) => normalizeComparable(row.title) === normalizeComparable(requestedTitle));

      if (!allMatches.length) {
        redirectTo404("title-not-found", requestedTitle);
        return;
      }

      const title = allMatches[0].title;
      const metadata = titleMetadataMap(metadataRows).get(normalizeComparable(title));

      if (!activeMatches.length) {
        renderNoVisibleScenes(title);
        return;
      }

      renderTitlePage(title, activeMatches, metadata);
    } catch (err) {
      console.error(err);
      contentEl.innerHTML = `<div class="empty-card">Could not load this title.</div>`;
    }
  }

  waitForShellDependencies(init);
})();