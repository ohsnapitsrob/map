window.FTS = window.FTS || {};

FTS.Boot = (function () {
  const LOAD_TIMEOUT_MS = 3500;

  function nestedRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const routeNames = [
      "browse", "explore", "title", "stats", "national-trust", "privacy", "metadata",
      "person", "genre", "films", "series", "music-videos", "games", "other"
    ];

    return routeNames.some((route) => path.endsWith(`/${route}`));
  }

  function scriptBase() {
    if (window.FTS?.Routes?.isNestedRoute) {
      return window.FTS.Routes.isNestedRoute() ? "../src/" : "./src/";
    }

    return nestedRoute() ? "../src/" : "./src/";
  }

  function scriptAlreadyPresent(name, attribute) {
    if (attribute && document.querySelector(`script[${attribute}]`)) return true;
    const srcEnd = `/${name}`;
    return Array.from(document.scripts).some((script) => {
      const src = script.getAttribute("src") || "";
      return src === name || src.endsWith(srcEnd) || src.endsWith(name);
    });
  }

  function loadScript(name, attribute) {
    if (scriptAlreadyPresent(name, attribute)) return Promise.resolve();

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `${scriptBase()}${name}`;
      script.async = false;
      script.defer = false;
      if (attribute) script.setAttribute(attribute, "true");
      script.onload = resolve;
      script.onerror = resolve;
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function waitFor(check, timeoutMs = LOAD_TIMEOUT_MS) {
    if (check()) return Promise.resolve(true);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (check()) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 25);
    });
  }

  async function ensureUtils() {
    if (!window.FTS?.Utils) await loadScript("utils.js", "data-fts-utils");
    await waitFor(() => Boolean(window.FTS?.Utils));
  }

  async function ensureDataCache() {
    if (!window.FTS?.DataCache) await loadScript("data-cache.js", "data-fts-data-cache");
    await waitFor(() => Boolean(window.FTS?.DataCache));
  }

  async function ensureCSV() {
    await ensureUtils();
    await ensureDataCache();
    if (!window.FTS?.CSV) await loadScript("csv.js", "data-fts-csv");
    await waitFor(() => Boolean(window.FTS?.CSV));
  }

  async function ensureAppSettings() {
    if (!window.FTS?.AppSettings) await loadScript("app-settings.js", "data-fts-app-settings");
    await waitFor(() => Boolean(window.FTS?.AppSettings));
  }

  async function ensurePrivacy() {
    if (!window.FTS?.Privacy) await loadScript("privacy-consent.js", "data-fts-privacy-consent");
    await waitFor(() => Boolean(window.FTS?.Privacy));
  }

  async function ensureVisibility() {
    await ensureAppSettings();
    if (!window.FTS?.Visibility) await loadScript("visibility.js", "data-fts-visibility");
    await waitFor(() => Boolean(window.FTS?.Visibility));
  }

  async function ensureDataStore() {
    await ensureCSV();
    if (!window.FTS?.DataStore) await loadScript("data-store.js", "data-fts-data-store");
    await waitFor(() => Boolean(window.FTS?.DataStore));
  }

  async function ensureScenePacks() {
    await ensureDataStore();
    await ensureVisibility();
    if (!window.FTS?.DataStore?.getScenePacks) await loadScript("scene-packs.js", "data-fts-scene-packs");
    await waitFor(() => Boolean(window.FTS?.DataStore?.getScenePacks));
  }

  async function ensureTitleDatasets() {
    await ensureScenePacks();
    if (!window.FTS?.DataStore?.getTitleDatasets) await loadScript("title-datasets.js", "data-fts-title-datasets");
    await waitFor(() => Boolean(window.FTS?.DataStore?.getTitleDatasets));
  }

  async function ensureTitleVisibility() {
    await ensureScenePacks();
    if (!window.FTS?.TitleVisibility) await loadScript("title-visibility.js", "data-fts-title-visibility");
    await waitFor(() => Boolean(window.FTS?.TitleVisibility));
  }

  async function ensureLocations() {
    await ensureCSV();
    if (!window.FTS?.Locations) await loadScript("locations.js", "data-fts-locations");
    await waitFor(() => Boolean(window.FTS?.Locations));
  }

  async function ensureSceneCard() {
    await ensureLocations();
    if (!window.FTS?.SceneCard) await loadScript("scene-card.js", "data-fts-scene-card");
    await waitFor(() => Boolean(window.FTS?.SceneCard));
  }

  async function ready(requirements = {}) {
    if (requirements.utils) await ensureUtils();
    if (requirements.dataCache) await ensureDataCache();
    if (requirements.csv) await ensureCSV();
    if (requirements.appSettings) await ensureAppSettings();
    if (requirements.privacy) await ensurePrivacy();
    if (requirements.visibility) await ensureVisibility();
    if (requirements.dataStore) await ensureDataStore();
    if (requirements.scenePacks) await ensureScenePacks();
    if (requirements.titleDatasets) await ensureTitleDatasets();
    if (requirements.titleVisibility) await ensureTitleVisibility();
    if (requirements.locations) await ensureLocations();
    if (requirements.sceneCard) await ensureSceneCard();
    return true;
  }

  return {
    ready,
    loadScript,
    waitFor,
    scriptBase
  };
})();
