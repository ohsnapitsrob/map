window.FTS = window.FTS || {};

FTS.HomeV2Rails = (function () {
  const U = window.FTS.HomeV2Utils;
  const MIN_GENRE_RAIL_ITEMS = 8;
  const MAX_RAIL_ITEMS = 12;

  function plural(value, single, pluralWord) {
    return `${value} ${value === 1 ? single : pluralWord}`;
  }

  function selectionSubHeader(total, visible) {
    if (visible >= total) return `${plural(total, "title", "titles")} with scenes visited`;
    return `A random selection of ${plural(visible, "title", "titles")} with scenes visited`;
  }

  function titleSet(items) {
    return new Set((items || []).map((item) => U.key(item.title)));
  }

  function latestRail(entries) {
    if (!U.featureEnabled("homeRailLatestScenesEnabled")) return null;

    const items = entries
      .filter((entry) => U.safeUrl(entry.poster))
      .filter((entry) => Number.isFinite(entry.latestVisitedTs))
      .sort((a, b) => b.latestVisitedTs - a.latestVisitedTs)
      .slice(0, 12);

    if (!items.length) return null;

    return {
      title: "Latest",
      subHeader: `${plural(items.length, "title", "titles")} with new scenes added`,
      items,
      suppressOverlays: true
    };
  }

  function topUKRail(entries, type) {
    if (!U.featureEnabled("homeRailTopScenesEnabled")) return null;

    const label = type === "Film" ? "Films" : "Series";

    const items = entries
      .filter((entry) => U.safeUrl(entry.poster))
      .filter((entry) => U.normalizeType(entry.type) === type)
      .filter((entry) => entry.ukCount > 0)
      .sort((a, b) => b.ukCount - a.ukCount || a.title.localeCompare(b.title))
      .slice(0, 10);

    if (!items.length) return null;

    return {
      title: `Top 10 ${label} in the UK`,
      subHeader: `Top 10 titles based on number of scenes visited`,
      items,
      suppressOverlays: true
    };
  }

  function franchiseRail(entries, seriesName, options = {}) {
    if (!U.featureEnabled(options.toggleKey)) return null;

    const direction = options.direction || "asc";

    const items = entries
      .filter((entry) => U.safeUrl(entry.poster))
      .filter((entry) => U.key(entry.series) === U.key(seriesName))
      .sort((a, b) => {
        const aHasOrder = Number.isFinite(a.railOrder);
        const bHasOrder = Number.isFinite(b.railOrder);

        if (aHasOrder && bHasOrder) {
          return direction === "desc" ? b.railOrder - a.railOrder : a.railOrder - b.railOrder;
        }

        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;

        return a.title.localeCompare(b.title);
      })
      .slice(0, MAX_RAIL_ITEMS);

    if (!items.length) return null;

    return {
      title: seriesName,
      items
    };
  }

  function genreRails(entries) {
    if (!U.featureEnabled("homeGenreRailsEnabled")) return [];

    const map = new Map();

    entries.forEach((entry) => {
      if (!U.safeUrl(entry.poster)) return;

      const type = U.normalizeType(entry.type);
      if (type !== "Film" && type !== "TV") return;

      (entry.genres || []).forEach((genre) => {
        const genreKey = U.key(genre);
        if (!genreKey) return;

        const key = `${genreKey}::${type}`;
        if (!map.has(key)) {
          map.set(key, {
            title: `${genre} ${type === "Film" ? "Films" : "Series"}`,
            entries: []
          });
        }

        map.get(key).entries.push(entry);
      });
    });

    return Array.from(map.values())
      .filter((group) => group.entries.length >= MIN_GENRE_RAIL_ITEMS)
      .map((group) => {
        const items = U.shuffle(group.entries).slice(0, MAX_RAIL_ITEMS);
        return {
          title: group.title,
          subHeader: selectionSubHeader(group.entries.length, items.length),
          items
        };
      });
  }

  function gamesRail(entries) {
    if (!U.featureEnabled("homeRailGamesEnabled")) return null;

    const allItems = entries
      .filter((entry) => U.safeUrl(entry.poster))
      .filter((entry) => U.normalizeType(entry.type) === "Video Game")
      .sort((a, b) => a.title.localeCompare(b.title));

    const items = allItems.slice(0, MAX_RAIL_ITEMS);
    if (!items.length) return null;

    return {
      title: "Games",
      subHeader: selectionSubHeader(allItems.length, items.length),
      items
    };
  }

  function peopleRail(entries, peopleRows) {
    if (!U.featureEnabled("homeRailPeopleEnabled")) return null;

    const index = new Map();

    entries.forEach((entry) => {
      U.splitComma(entry.stars).forEach((name) => {
        const k = U.key(name);
        if (!k) return;
        if (!index.has(k)) index.set(k, { title: name, mode: "star", titles: new Set(), onlyNoAccess: true });
        const person = index.get(k);
        person.titles.add(entry.title);
        if (!entry.onlyNoAccess) person.onlyNoAccess = false;
      });

      U.splitComma(entry.director).forEach((name) => {
        const k = U.key(name);
        if (!k) return;
        if (!index.has(k)) index.set(k, { title: name, mode: "director", titles: new Set(), onlyNoAccess: true });
        const person = index.get(k);
        person.titles.add(entry.title);
        if (!entry.onlyNoAccess) person.onlyNoAccess = false;
      });
    });

    const items = U.shuffle(peopleRows.map((row) => {
      const name = U.norm(row.name);
      const photo = U.safeUrl(row.photo);
      const person = index.get(U.key(name));

      if (!name || !photo || !person) return null;
      if (person.titles.size === 1 && person.onlyNoAccess) return null;

      return {
        title: name,
        poster: photo,
        href: U.personUrl(person)
      };
    }).filter(Boolean)).slice(0, MAX_RAIL_ITEMS);

    if (!items.length) return null;

    return {
      title: "Following in their footsteps",
      items,
      suppressOverlays: true
    };
  }

  function build(context) {
    const entries = context.entries || [];
    const latest = latestRail(entries);
    const topFilms = topUKRail(entries, "Film");
    const topSeries = topUKRail(entries, "TV");
    const jamesBond = franchiseRail(entries, "James Bond", { toggleKey: "homeRailJamesBondEnabled", direction: "desc" });
    const harryPotter = franchiseRail(entries, "Harry Potter", { toggleKey: "homeRailHarryPotterEnabled", direction: "asc" });

    const randomRails = [
      topFilms,
      topSeries,
      jamesBond,
      harryPotter,
      ...genreRails(entries)
    ].filter(Boolean);

    const overlayContext = {
      latestTitles: latest ? titleSet(latest.items) : new Set(),
      topTenTitles: titleSet([...(topFilms?.items || []), ...(topSeries?.items || [])]),
      noAccessTitles: titleSet(entries.filter((entry) => entry.onlyNoAccess))
    };

    return [
      latest,
      ...U.shuffle(randomRails),
      peopleRail(entries, context.peopleRows),
      gamesRail(entries)
    ].filter(Boolean).map((rail) => ({ ...overlayContext, ...rail }));
  }

  return { build };
})();
