window.FTS = window.FTS || {};

(function () {
  if (!window.FTS?.DataStore) return;

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function accessValue(scene) {
    if (window.FTS?.Visibility?.accessValue) return window.FTS.Visibility.accessValue(scene);
    const raw = scene?.access || scene?.Access || scene?.ACCESS || scene?.["access "] || scene?.["Access "] || scene?.["No Access"] || scene?.noaccess || scene?.NOACCESS;
    return norm(raw).toUpperCase();
  }

  function isRestrictedScene(scene) {
    if (window.FTS?.Visibility?.isRestrictedScene) return window.FTS.Visibility.isRestrictedScene(scene);
    return accessValue(scene) !== "";
  }

  async function getScenePacks(options = {}) {
    const store = window.FTS.DataStore;

    return store.remember("scene-packs", async () => {
      const allScenes = store.getSceneRows ? await store.getSceneRows(options) : [];
      const publicScenes = allScenes.filter((scene) => !isRestrictedScene(scene));
      const restrictedScenes = allScenes.filter(isRestrictedScene);
      const restrictedTitleKeys = new Set(restrictedScenes.map((scene) => key(scene.title)).filter(Boolean));
      const publicTitleKeys = new Set(publicScenes.map((scene) => key(scene.title)).filter(Boolean));
      const allTitleKeys = new Set(allScenes.map((scene) => key(scene.title)).filter(Boolean));
      const onlyRestrictedTitleKeys = new Set(
        Array.from(allTitleKeys).filter((titleKey) => restrictedTitleKeys.has(titleKey) && !publicTitleKeys.has(titleKey))
      );

      return {
        allScenes,
        publicScenes,
        restrictedScenes,
        allTitleKeys,
        publicTitleKeys,
        restrictedTitleKeys,
        onlyRestrictedTitleKeys,
        counts: {
          allScenes: allScenes.length,
          publicScenes: publicScenes.length,
          restrictedScenes: restrictedScenes.length,
          allTitles: allTitleKeys.size,
          publicTitles: publicTitleKeys.size,
          restrictedTitles: restrictedTitleKeys.size,
          onlyRestrictedTitles: onlyRestrictedTitleKeys.size
        }
      };
    }, { ...options, persist: true });
  }

  window.FTS.DataStore.getScenePacks = getScenePacks;
})();
