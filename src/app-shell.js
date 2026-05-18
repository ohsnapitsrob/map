(function () {
  const config = window.APP_CONFIG || {};

  function getRuntimeConfig() {
    return window.RUNTIME_CONFIG || {};
  }

  function getScriptTarget() {
    return document.head || document.documentElement;
  }

  function onDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function getFallbackScriptBase() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const routeNames = ["browse", "explore", "title", "stats", "national-trust", "privacy", "metadata", "person", "genre", "films", "series", "music-videos", "games", "other"];
    const isNestedRoute = routeNames.some((route) => path.endsWith(`/${route}`));
    return isNestedRoute ? "../src/" : "./src/";
  }

  function getSharedScriptBase() {
    if (window.FTS?.Routes?.isNestedRoute) {
      return window.FTS.Routes.isNestedRoute() ? "../src/" : "./src/";
    }

    return getFallbackScriptBase();
  }

  function loadScriptFromBase(name, attribute, base, options = {}) {
    if (document.querySelector(`script[${attribute}]`)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `${base}${name}`;
      script.setAttribute(attribute, "true");
      script.async = false;

      if (options.defer !== false) {
        script.defer = true;
      }

      script.onload = resolve;
      script.onerror = resolve;

      getScriptTarget().appendChild(script);
    });
  }

  function loadSharedScript(name, attribute, options = {}) {
    return loadScriptFromBase(name, attribute, getSharedScriptBase(), options);
  }

  function dispatchReady(name) {
    window.dispatchEvent(new CustomEvent(`fts:${name}-ready`));
  }

  function hasPrivacyChoice() {
    try {
      const raw = localStorage.getItem("fts-privacy-settings");
      if (!raw) return false;

      const settings = JSON.parse(raw);
      return settings && typeof settings === "object";
    } catch (err) {
      return false;
    }
  }

  function loadRoutes() {
    return loadScriptFromBase("routes.js", "data-fts-routes", getFallbackScriptBase())
      .then(() => dispatchReady("routes"));
  }

  function loadPrivacySystem() {
    return loadSharedScript("privacy-consent.js", "data-fts-privacy-consent")
      .then(() => dispatchReady("privacy"));
  }

  function loadAppSettings() {
    return loadSharedScript("app-settings.js", "data-fts-app-settings")
      .then(() => dispatchReady("app-settings"));
  }

  function loadVisibility() {
    return loadSharedScript("visibility.js", "data-fts-visibility")
      .then(() => dispatchReady("visibility"));
  }

  function loadBottomNav() {
    return loadSharedScript("bottom-nav.js", "data-fts-bottom-nav")
      .then(() => dispatchReady("bottom-nav"));
  }

  function loadAppHeaderModules() {
    return Promise.all([
      loadSharedScript("app-header-title-search.js", "data-fts-app-header-title-search"),
      loadSharedScript("app-header-map-search.js", "data-fts-app-header-map-search")
    ]).then(() => {
      return loadSharedScript("app-header.js", "data-fts-app-header");
    }).then(() => dispatchReady("app-header"));
  }

  function loadIOSInstallPrompt() {
    return loadSharedScript("ios-install-prompt.js", "data-fts-ios-install-prompt")
      .then(() => dispatchReady("ios-install-prompt"));
  }

  function loadAnalytics() {
    if (window.FTS?.Features?.isEnabled("plausibleAnalyticsEnabled") !== true) {
      return Promise.resolve();
    }

    if (!hasPrivacyChoice()) {
      return Promise.resolve();
    }

    return loadSharedScript("analytics.js", "data-fts-analytics")
      .then(() => dispatchReady("analytics"));
  }

  function loadEasterEggs() {
    if (window.FTS?.Features?.isEnabled("easterEggsEnabled") !== true) {
      return Promise.resolve();
    }

    return loadSharedScript("easter-eggs.js", "data-fts-easter-eggs")
      .then(() => dispatchReady("easter-eggs"));
  }

  function showEnvironmentBadge() {
    const runtime = getRuntimeConfig();
    const isStaging = runtime.environment === "staging";

    if (!isStaging) return;

    onDomReady(() => {
      const label = config.ENVIRONMENT_LABEL || "STAGING";

      const badge = document.createElement("div");
      badge.className = "fts-env-badge";
      badge.textContent = label;

      const style = document.createElement("style");
      style.textContent = `
        .fts-env-badge {
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 99999;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.88);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          pointer-events: none;
          user-select: none;
        }

        @media (max-width: 640px) {
          .fts-env-badge {
            font-size: 10px;
            padding: 7px 9px;
            bottom: calc(92px + env(safe-area-inset-bottom));
          }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(badge);
    });
  }

  loadRoutes().then(async () => {
    await Promise.all([
      loadAppHeaderModules(),
      loadBottomNav()
    ]);

    document.documentElement.setAttribute("data-shell-ready", "true");

    loadPrivacySystem();
    loadAppSettings();
    loadVisibility();
    loadEasterEggs();

    if (window.FTS?.Features?.isEnabled("iosInstallPromptEnabled") === true) {
      loadIOSInstallPrompt();
    }

    loadAnalytics();
    showEnvironmentBadge();
  });

  window.addEventListener("load", () => {
    window.FTS?.Privacy?.maybeShowInitialPrompt?.();
  });
})();