window.FTS = window.FTS || {};

FTS.HomeV2 = (function () {
  const PRIVACY_STORAGE_KEY = "fts-privacy-settings";

  function featureEnabled(key) {
    return window.FTS?.Features?.isEnabled(key) !== false;
  }

  function savedPrivacyChoiceExists() {
    try {
      return Boolean(window.localStorage.getItem(PRIVACY_STORAGE_KEY));
    } catch (err) {
      return false;
    }
  }

  function privacyChoiceRequired() {
    if (!featureEnabled("privacyConsentEnabled")) return false;
    if (window.FTS?.Privacy?.enabled?.() === false) return false;
    return true;
  }

  function privacyChoiceAnswered() {
    if (!privacyChoiceRequired()) return true;
    if (savedPrivacyChoiceExists()) return true;
    return window.FTS?.Privacy?.getSettings?.().hasAnswered === true;
  }

  function waitForPrivacyChoice(callback) {
    const railsRoot = document.getElementById("railsRoot");

    if (privacyChoiceAnswered()) {
      callback();
      return;
    }

    if (railsRoot) {
      railsRoot.innerHTML = `<div class="loading-card">Choose your privacy settings to load the homepage.</div>`;
    }

    window.addEventListener("fts:privacy-updated", callback, { once: true });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function renderStats(context) {
    const statsEl = document.getElementById("homeStats");
    if (!statsEl) return;

    const titles = new Set();
    const cities = new Set();
    const countries = new Set();

    context.visibleRows.forEach((row) => {
      if (row.title) titles.add(row.title);
      if (row.city) cities.add(row.city);
      if (row.country) countries.add(row.country);
    });

    statsEl.innerHTML = `
      <article class="stat-card"><div class="stat-value">${formatNumber(context.visibleRows.length)}</div><div class="stat-label">Scenes</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(titles.size)}</div><div class="stat-label">Titles</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(cities.size)}</div><div class="stat-label">Cities</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(countries.size)}</div><div class="stat-label">Countries</div></article>
    `;
  }

  async function init() {
    const railsRoot = document.getElementById("railsRoot");
    if (!railsRoot) return;

    if (!featureEnabled("homeRailsEnabled")) {
      railsRoot.innerHTML = "";
      return;
    }

    try {
      const context = await window.FTS.HomeV2Data.load();
      const rails = window.FTS.HomeV2Rails.build(context);

      window.FTS.HomeV2Renderer.render(railsRoot, rails);
      window.FTS.HomeV2Renderer.enableDragging(railsRoot);
      renderStats(context);

      if (!rails.length) {
        railsRoot.innerHTML = `<div class="loading-card">No poster rails to show yet.</div>`;
      }
    } catch (error) {
      console.error(error);
      railsRoot.innerHTML = `<div class="loading-card">Could not load rails.</div>`;

      const statsEl = document.getElementById("homeStats");
      if (statsEl) statsEl.innerHTML = `<div class="loading-card">Could not load stats.</div>`;
    }
  }

  function boot() {
    waitForPrivacyChoice(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { init };
})();
