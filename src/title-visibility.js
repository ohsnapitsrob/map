window.FTS = window.FTS || {};

FTS.TitleVisibility = (function () {
  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function coerceNumber(value) {
    const n = Number((value ?? "").toString().trim());
    return Number.isFinite(n) ? n : null;
  }

  function getValue(row, field) {
    const target = key(field);
    const matched = Object.keys(row).find((item) => key(item) === target);
    return matched ? row[matched] : "";
  }

  async function fetchRows(cacheKey, url) {
    if (!url) return [];

    if (window.FTS?.DataStore?.csvRows) {
      return window.FTS.DataStore.csvRows(cacheKey, url);
    }

    if (window.FTS?.CSV?.fetchObjects) {
      return window.FTS.CSV.fetchObjects(url);
    }

    if (window.FTS?.DataCache?.fetchCSV) {
      const result = await window.FTS.DataCache.fetchCSV(url);
      return result.rows;
    }

    return [];
  }

  function normalizeType(value) {
    if (window.FTS?.Utils?.normalizeType) return window.FTS.Utils.normalizeType(value);
    const type = key(value);
    if (type === "film" || type === "movie" || type === "movies") return "Film";
    if (type === "tv" || type === "tv show" || type === "tv shows" || type === "series") return "TV";
    if (type === "music video" || type === "music videos" || type === "mv") return "Music Video";
    if (type === "game" || type === "games" || type === "video game" || type === "video games") return "Video Game";
    return norm(value) || "Misc";
  }

  async function loadSceneRows() {
    if (window.FTS?.DataStore?.getSceneRows) {
      return window.FTS.DataStore.getSceneRows();
    }

    const cfg = window.APP_CONFIG || {};
    const sheets = cfg.SHEETS || {};
    const sources = [
      ["Film", sheets.movies, "scene-rows-films"],
      ["TV", sheets.tv, "scene-rows-tv"],
      ["Music Video", sheets.music_videos, "scene-rows-music-videos"],
      ["Video Game", sheets.games, "scene-rows-games"],
      ["Misc", sheets.misc, "scene-rows-misc"]
    ].filter(([, url]) => Boolean(url));

    const groups = await Promise.all(sources.map(async ([fallbackType, url, cacheKey]) => {
      const rows = await fetchRows(cacheKey, url);
      return rows.map((row) => {
        const title = norm(getValue(row, "title"));
        const lat = coerceNumber(getValue(row, "lat"));
        const lng = coerceNumber(getValue(row, "lng"));
        if (!title || typeof lat !== "number" || typeof lng !== "number") return null;
        return {
          title,
          type: normalizeType(getValue(row, "type") || fallbackType),
          access: norm(getValue(row, "Access") || getValue(row, "access") || getValue(row, "ACCESS"))
        };
      }).filter(Boolean);
    }));

    return groups.flat();
  }

  async function visibleTitleKeys() {
    const modeKey = window.FTS?.DataStore?.modeKey ? window.FTS.DataStore.modeKey("visible-title-keys") : "visible-title-keys";

    if (window.FTS?.DataStore?.remember) {
      return window.FTS.DataStore.remember(modeKey, async () => {
        if (window.FTS?.DataStore?.getScenePacks) {
          const scenePacks = await window.FTS.DataStore.getScenePacks();
          const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
          return hideNoAccess ? scenePacks.publicTitleKeys : scenePacks.allTitleKeys;
        }

        const sceneRows = await loadSceneRows();
        const visibleRows = window.FTS?.Visibility?.getVisibleScenes?.(sceneRows) || sceneRows;
        return new Set(visibleRows.map((row) => key(row.title)).filter(Boolean));
      });
    }

    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicTitleKeys : scenePacks.allTitleKeys;
    }

    const sceneRows = await loadSceneRows();
    const visibleRows = window.FTS?.Visibility?.getVisibleScenes?.(sceneRows) || sceneRows;
    return new Set(visibleRows.map((row) => key(row.title)).filter(Boolean));
  }

  function filterTitles(rows, visibleKeys) {
    if (!visibleKeys || !visibleKeys.size) return [];
    return rows.filter((row) => visibleKeys.has(key(getValue(row, "title"))));
  }

  return { visibleTitleKeys, filterTitles };
})();
