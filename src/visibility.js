window.FTS = window.FTS || {};

FTS.Visibility = (function () {
  const DEFAULT_SETTINGS = {
    hideNoAccessScenes: true
  };

  function getSettings() {
    if (window.FTS?.AppSettings?.getSettings) {
      return window.FTS.AppSettings.getSettings();
    }

    try {
      const stored = JSON.parse(localStorage.getItem("fts-app-settings") || "{}");
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch (err) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function normaliseAccess(value) {
    return (value || "")
      .toString()
      .trim()
      .toUpperCase();
  }

  function hideNoAccessEnabled() {
    return getSettings().hideNoAccessScenes === true;
  }

  function mode() {
    return hideNoAccessEnabled() ? "public-only" : "all";
  }

  function shouldHideScene(scene) {
    if (!hideNoAccessEnabled()) {
      return false;
    }

    const access = normaliseAccess(
      scene?.Access ||
      scene?.access ||
      scene?.ACCESS
    );

    return access === "NOACCESS";
  }

  function getVisibleScenes(scenes) {
    return (scenes || []).filter((scene) => !shouldHideScene(scene));
  }

  function hasVisibleScenes(scenes) {
    return getVisibleScenes(scenes).length > 0;
  }

  return {
    shouldHideScene,
    getVisibleScenes,
    hasVisibleScenes,
    hideNoAccessEnabled,
    mode,
    normaliseAccess
  };
})();
