window.FTS = window.FTS || {};

(function () {
  if (!window.FTS?.DataStore) return;

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function normalizeType(value) {
    return window.FTS?.Utils?.normalizeType ? window.FTS.Utils.normalizeType(value) : norm(value);
  }

  function getAccessValue(row) {
    const raw = row?.access || row?.Access || row?.ACCESS || row?.["access "] || row?.["Access "] || row?.["No Access"] || row?.noaccess || row?.NOACCESS;
    return norm(raw).toUpperCase();
  }

  async function getTitleDatasets(options = {}) {
    const store = window.FTS.DataStore;
    const cacheKey = store.modeKey ? store.modeKey("title-datasets") : "title-datasets";

    return store.remember(cacheKey, async () => {
      const [sceneRows, metadataRows] = await Promise.all([
        store.getSceneRows ? store.getSceneRows(options) : [],
        store.getTitleMetadata ? store.getTitleMetadata(options) : []
      ]);

      const visibility = store.getVisibilityDatasets
        ? await store.getVisibilityDatasets(sceneRows, options)
        : null;

      const metadataByTitle = new Map(metadataRows.map((row) => [key(row.title), row]));
      const grouped = new Map();
      const visibleScenes = visibility?.visibleScenes || sceneRows;

      sceneRows.forEach((scene) => {
        const titleKey = key(scene.title);
        if (!titleKey) return;

        const meta = metadataByTitle.get(titleKey) || {};

        if (!grouped.has(titleKey)) {
          grouped.set(titleKey, {
            key: titleKey,
            title: norm(scene.title || meta.title),
            type: normalizeType(scene.type || meta.type),
            metadata: meta,
            scenes: [],
            visibleScenes: [],
            inaccessibleScenes: [],
            demolishedScenes: [],
            sceneCount: 0,
            visibleSceneCount: 0,
            inaccessibleSceneCount: 0,
            demolishedSceneCount: 0,
            latestVisitedTs: null,
            onlyNoAccess: false,
            hasNoAccess: false,
            hasVisibleScenes: false
          });
        }

        const entry = grouped.get(titleKey);
        const access = getAccessValue(scene);

        entry.scenes.push(scene);
        entry.sceneCount += 1;

        if (visibleScenes.includes(scene)) {
          entry.visibleScenes.push(scene);
          entry.visibleSceneCount += 1;
          entry.hasVisibleScenes = true;
        }

        if (access === "NOACCESS") {
          entry.inaccessibleScenes.push(scene);
          entry.inaccessibleSceneCount += 1;
          entry.hasNoAccess = true;
        }

        if (access === "DEMOLISHED") {
          entry.demolishedScenes.push(scene);
          entry.demolishedSceneCount += 1;
        }

        if (!Number.isFinite(entry.latestVisitedTs) || scene.visitedTs > entry.latestVisitedTs) {
          entry.latestVisitedTs = scene.visitedTs;
        }
      });

      const allEntries = Array.from(grouped.values()).map((entry) => ({
        ...entry,
        onlyNoAccess: entry.sceneCount > 0 && entry.visibleSceneCount === 0 && entry.inaccessibleSceneCount > 0
      }));

      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      const entries = hideNoAccess ? allEntries.filter((entry) => !entry.onlyNoAccess) : allEntries;

      return {
        mode: store.visibilityMode ? store.visibilityMode() : "public-only",
        sceneRows,
        metadataRows,
        visibility,
        entries,
        allEntries,
        byTitleKey: new Map(entries.map((entry) => [entry.key, entry])),
        allByTitleKey: new Map(allEntries.map((entry) => [entry.key, entry])),
        counts: {
          titles: entries.length,
          allTitles: allEntries.length,
          onlyNoAccessTitles: allEntries.filter((entry) => entry.onlyNoAccess).length,
          titlesWithNoAccess: allEntries.filter((entry) => entry.hasNoAccess).length
        }
      };
    }, options);
  }

  window.FTS.DataStore.getTitleDatasets = getTitleDatasets;
})();
