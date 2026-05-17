window.FTS = window.FTS || {};

FTS.HomeV2Rails = (function () {
  const U = window.FTS.HomeV2Utils;

  function plural(value, single, pluralWord) {
    return `${value} ${value === 1 ? single : pluralWord}`;
  }

  function selectionSubHeader(total, visible) {
    if (total <= visible) return `${plural(total, "title", "titles")} with scenes visited`;
    return `A random selection of ${plural(visible, "title", "titles")}`;
  }

  function latestRail(entries) {
    const items = entries
      .filter((entry) => Number.isFinite(entry.latestVisitedTs))
      .sort((a, b) => b.latestVisitedTs - a.latestVisitedTs)
      .slice(0, 12);

    if (!items.length) return null;

    return {
      title: "Latest",
      subHeader: `${plural(items.length, "title", "titles")} with new scenes added`,
      items,
      latestTitles: new Set(items.map((item) => U.key(item.title)))
    };
  }

  function topUKRail(entries, type) {
    const label = type === "Film" ? "Films" : "Series";

    const items = entries
      .filter((entry) => U.normalizeType(entry.type) === type)
      .filter((entry) => entry.ukCount > 0)
      .sort((a, b) => b.ukCount - a.ukCount || a.title.localeCompare(b.title))
      .slice(0, 10);

    if (!items.length) return null;

    return {
      title: `Top 10 ${label} in the UK`,
      subHeader: `Top 10 titles based on number of scenes visited`,
      items,
      topTenTitles: new Set(items.map((item) => U.key(item.title)))
    };
  }

  function gamesRail(entries) {
    if (!U.featureEnabled("homeRailGamesEnabled")) return null;

    const items = entries
      .filter((entry) => U.normalizeType(entry.type) === "Video Game")
      .sort((a, b) => a.title.localeCompare(b.title));

    if (!items.length) return null;

    return {
      title: "Games",
      subHeader: selectionSubHeader(items.length, items.length),
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
    }).filter(Boolean)).slice(0, 12);

    if (!items.length) return null;

    return {
      title: "Following in their footsteps",
      items
    };
  }

  function build(context) {
    const entries = context.entries || [];

    const latest = latestRail(entries);

    const randomRails = [
      topUKRail(entries, "Film"),
      topUKRail(entries, "TV")
    ].filter(Boolean);

    return [
      latest,
      ...U.shuffle(randomRails),
      peopleRail(entries, context.peopleRows),
      gamesRail(entries)
    ].filter(Boolean);
  }

  return { build };
})();
