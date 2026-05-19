window.FTS = window.FTS || {};

FTS.HomeV2Data = (function () {
  const U = window.FTS.HomeV2Utils;

  async function loadTitleMetadata() {
    const cfg = window.APP_CONFIG || {};
    const rows = window.FTS?.DataStore?.getTitleMetadata
      ? await window.FTS.DataStore.getTitleMetadata().catch(() => [])
      : await U.fetchRows(cfg.TITLE_METADATA_CSV || cfg.TITLE_METADATA || cfg.TITLES_METADATA_CSV).catch(() => []);

    return rows.map((row) => ({
      title: U.norm(row.title),
      type: U.norm(row.type),
      description: U.norm(row.description),
      imdb: U.norm(row.imdb),
      justwatch: U.norm(row.justwatch),
      poster: U.norm(row.poster),
      trailer: U.norm(row.trailer),
      thumbnail: U.norm(row.thumbnail),
      backdrop: U.norm(row.backdrop || row.Backdrop),
      carousel: U.norm(row.carousel || row.Carousel),
      nt: U.norm(row.NT),
      genres: U.norm(row.Genres || row.genres || row.genre || row.Genre),
      stars: U.norm(row.Stars || row.stars),
      director: U.norm(row.Director || row.director),
      railOrder: U.coerceNumber(row["set-rail-order"])
    })).filter((row) => row.title);
  }

  async function loadPeopleRows() {
    const cfg = window.APP_CONFIG || {};
    if (window.FTS?.DataStore?.csvRows) {
      return window.FTS.DataStore.csvRows("people-rows", cfg.PEOPLE_CSV).catch(() => []);
    }
    return U.fetchRows(cfg.PEOPLE_CSV).catch(() => []);
  }

  async function loadSceneRows() {
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
      const rows = window.FTS?.DataStore?.csvRows
        ? await window.FTS.DataStore.csvRows(cacheKey, url)
        : await U.fetchRows(url);
      return rows.map((row) => {
        const title = U.norm(row.title);
        const lat = U.coerceNumber(row.lat);
        const lng = U.coerceNumber(row.lng);

        if (!title || typeof lat !== "number" || typeof lng !== "number") return null;

        return {
          title,
          type: U.normalizeType(row.type || fallbackType),
          series: U.norm(row.series),
          country: U.norm(row.country),
          city: U.norm(row.city || row.place),
          thumbnail: U.norm(row.thumbnail),
          access: U.norm(row.Access || row.access || row.ACCESS),
          railOrder: U.coerceNumber(row["set-rail-order"]),
          visitedTs: U.parseVisitedDate(row["date-formatted"] || row["raw-date"] || row.visited || row["visit-date"])
        };
      }).filter(Boolean);
    }));

    return groups.flat();
  }

  function buildEntries(sceneRows, metadataRows) {
    const metaByTitle = new Map(metadataRows.map((meta) => [U.key(meta.title), meta]));
    const grouped = new Map();

    sceneRows.forEach((row) => {
      const titleKey = U.key(row.title);
      const meta = metaByTitle.get(titleKey) || {};

      if (!grouped.has(titleKey)) {
        grouped.set(titleKey, {
          title: row.title,
          type: row.type || meta.type,
          series: row.series,
          count: 0,
          visibleCount: 0,
          noAccessCount: 0,
          ukCount: 0,
          latestVisitedTs: null,
          railOrder: Number.isFinite(meta.railOrder) ? meta.railOrder : row.railOrder,
          poster: meta.poster || "",
          thumbnail: meta.thumbnail || row.thumbnail || "",
          backdrop: meta.backdrop || "",
          carousel: meta.carousel || "",
          nt: U.norm(meta.nt),
          genres: U.splitComma(meta.genres),
          stars: U.norm(meta.stars),
          director: U.norm(meta.director)
        });
      }

      const entry = grouped.get(titleKey);
      entry.count += 1;

      if (U.normalizeAccess(row.access) === "NOACCESS") entry.noAccessCount += 1;
      else entry.visibleCount += 1;

      if (U.isUKCountry(row.country)) entry.ukCount += 1;
      if (!entry.series && row.series) entry.series = row.series;
      if (!Number.isFinite(entry.latestVisitedTs) || row.visitedTs > entry.latestVisitedTs) entry.latestVisitedTs = row.visitedTs;
    });

    return Array.from(grouped.values()).map((entry) => ({
      ...entry,
      onlyNoAccess: entry.count > 0 && entry.visibleCount === 0 && entry.noAccessCount > 0
    }));
  }

  async function buildHomepageData() {
    const [sceneRows, metadataRows, peopleRows] = await Promise.all([
      loadSceneRows(),
      loadTitleMetadata(),
      loadPeopleRows()
    ]);

    const visibleRows = window.FTS?.Visibility?.getVisibleScenes?.(sceneRows) || sceneRows;

    return {
      sceneRows,
      visibleRows,
      metadataRows,
      peopleRows,
      entries: buildEntries(visibleRows, metadataRows)
    };
  }

  async function load() {
    if (window.FTS?.DataStore?.getHomepageDatasets) {
      return window.FTS.DataStore.getHomepageDatasets(buildHomepageData);
    }

    return buildHomepageData();
  }

  return { load };
})();
