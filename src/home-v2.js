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

    const counts = context.homepageCounts || {};

    statsEl.innerHTML = `
      <article class="stat-card"><div class="stat-value">${formatNumber(counts.scenes)}</div><div class="stat-label">Scenes</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(counts.titles)}</div><div class="stat-label">Titles</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(counts.cities)}</div><div class="stat-label">Cities</div></article>
      <article class="stat-card"><div class="stat-value">${formatNumber(counts.countries)}</div><div class="stat-label">Countries</div></article>
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

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });

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

  function rebuildHomepageDatasets() {
    if (window.FTS?.DataStore?.clear) {
      [
        "homepage-datasets:all",
        "homepage-datasets:public-only",
        "visibility-datasets:all",
        "visibility-datasets:public-only",
        "explore-search-indexes:all",
        "explore-search-indexes:public-only"
      ].forEach((key) => window.FTS.DataStore.clear(key));
    }

    init();
  }

  function boot() {
    waitForPrivacyChoice(init);

    window.addEventListener("fts:app-settings-updated", rebuildHomepageDatasets);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { init };
})();
