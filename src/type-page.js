(function () {
  const config = window.APP_CONFIG || {};

  function norm(value) { return (value || "").toString().trim(); }
  function key(value) { return norm(value).toLowerCase(); }
  function getValue(row, field) {
    const target = key(field);
    const matched = Object.keys(row).find((item) => key(item) === target);
    return matched ? row[matched] : "";
  }

  async function fetchMetadataRows() {
    await window.FTS?.Boot?.ready?.({ dataStore: true, titleVisibility: true });

    if (window.FTS?.DataStore?.getTitleMetadata) {
      return window.FTS.DataStore.getTitleMetadata();
    }

    return [];
  }

  function ensureFallbackStyles() {
    if (document.getElementById("fts-type-page-fallback-style")) return;
    const style = document.createElement("style");
    style.id = "fts-type-page-fallback-style";
    style.textContent = `.poster-fallback { width: auto; } .type-loading-stage { min-height: 260px; display: grid; place-items: center; }`;
    document.head.appendChild(style);
  }

  function posterCard(item) {
    const title = norm(getValue(item, "title"));
    const poster = norm(getValue(item, "poster"));
    const escapeHtml = window.FTS?.Utils?.escapeHtml || ((value) => norm(value));
    return `<a class="person-card" href="../title/?fl=${encodeURIComponent(title)}" aria-label="${escapeHtml(title)}"><div class="poster-card">${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy">` : `<div class="poster-fallback">${escapeHtml(title)}</div>`}</div></a>`;
  }

  function getTypeKeys(pageConfig) {
    if (Array.isArray(pageConfig.types)) return pageConfig.types.map(key);
    return [key(pageConfig.type)];
  }

  async function getVisibleTitleKeys() {
    if (window.FTS?.TitleVisibility?.visibleTitleKeys) return window.FTS.TitleVisibility.visibleTitleKeys();
    return null;
  }

  function renderLoading() {
    const shell = document.querySelector(".person-shell");
    if (!shell) return;
    shell.innerHTML = `<section class="type-loading-stage"><div class="fts-loader" aria-label="Loading"></div></section>`;
  }

  function renderReady(pageConfig, matches) {
    const shell = document.querySelector(".person-shell");
    if (!shell) return;
    shell.innerHTML = `
      <section class="person-hero">
        <div class="person-hero-copy">
          <p class="person-kicker">Type</p>
          <h1 class="person-title" id="typeTitle">${pageConfig.label}</h1>
          <p class="person-copy" id="typeCopy">${matches.length} title${matches.length === 1 ? "" : "s"} with scenes found.</p>
        </div>
      </section>
      <section><div class="person-grid"><div id="typeGrid" class="person-grid-section">${matches.map(posterCard).join("")}</div></div></section>
    `;
  }

  async function boot() {
    const pageConfig = window.FTS_TYPE_PAGE;
    if (!pageConfig) return;
    ensureFallbackStyles();
    renderLoading();
    const [rows, visibleTitleKeys] = await Promise.all([fetchMetadataRows(), getVisibleTitleKeys()]);
    const typeKeys = getTypeKeys(pageConfig);
    const matches = rows
      .filter((row) => typeKeys.includes(key(getValue(row, "type"))))
      .filter((row) => !visibleTitleKeys || visibleTitleKeys.has(key(getValue(row, "title"))))
      .sort((a, b) => norm(getValue(a, "title")).localeCompare(norm(getValue(b, "title"))));
    document.title = `${pageConfig.label} | Find That Scene`;
    renderReady(pageConfig, matches);
  }

  boot();
})();
