(function () {
  const titleEl = document.getElementById("genreTitle");
  const copyEl = document.getElementById("genreCopy");
  const gridEl = document.getElementById("genreGrid");

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function escapeHtml(value) {
    return window.FTS?.Utils?.escapeHtml ? window.FTS.Utils.escapeHtml(value) : norm(value);
  }

  function splitComma(value) {
    return window.FTS?.Utils?.splitComma ? window.FTS.Utils.splitComma(value) : norm(value).split(",").map(norm).filter(Boolean);
  }

  function redirectTo404(reason, value = "") {
    const params = new URLSearchParams();
    params.set("genre-error", reason);
    if (value) params.set("value", value);
    window.location.replace(`../404.html?${params.toString()}`);
  }

  function getParam(name) {
    return norm(new URLSearchParams(window.location.search).get(name));
  }

  function wantedType() {
    const raw = key(getParam("type"));
    if (!raw) return "";
    if (raw === "films" || raw === "film" || raw === "movies" || raw === "movie") return "Film";
    if (raw === "series" || raw === "tv" || raw === "tv shows" || raw === "show") return "TV";
    if (raw === "games" || raw === "game" || raw === "video game" || raw === "video games") return "Video Game";
    if (raw === "music" || raw === "music videos" || raw === "music video") return "Music Video";
    return "";
  }

  function posterCard(item) {
    const title = norm(item.title);
    const poster = norm(item.poster);
    return `
      <a class="genre-card" href="../title/?fl=${encodeURIComponent(title)}" aria-label="${escapeHtml(title)}">
        <div class="poster-card">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy">` : `<div class="poster-fallback">${escapeHtml(title)}</div>`}
        </div>
      </a>
    `;
  }

  function metadataGenreList(row) {
    return splitComma(row.Genres || row.genres || row.genre || row.Genre);
  }

  async function getVisibleTitleKeys() {
    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicTitleKeys : scenePacks.allTitleKeys;
    }

    return null;
  }

  async function init() {
    await window.FTS?.Boot?.ready?.({ scenePacks: true, titleDatasets: true });

    const genre = getParam("genre");
    const type = wantedType();

    if (!genre) {
      redirectTo404("missing-genre-param");
      return;
    }

    titleEl.textContent = genre;
    document.title = `${genre} | Find That Scene`;

    try {
      const [metadataRows, visibleKeys] = await Promise.all([
        window.FTS.DataStore.getTitleMetadata(),
        getVisibleTitleKeys()
      ]);

      const matches = metadataRows
        .filter((row) => !type || norm(row.type) === type)
        .filter((row) => metadataGenreList(row).some((item) => key(item) === key(genre)))
        .filter((row) => !visibleKeys || visibleKeys.has(key(row.title)))
        .sort((a, b) => norm(a.title).localeCompare(norm(b.title), undefined, { sensitivity: "base" }));

      copyEl.textContent = `${matches.length} title${matches.length === 1 ? "" : "s"} found.`;
      gridEl.innerHTML = matches.length
        ? matches.map(posterCard).join("")
        : `<div class="poster-fallback">No matches</div>`;
    } catch (err) {
      console.error(err);
      copyEl.textContent = "Could not load this genre.";
      gridEl.innerHTML = "";
    }
  }

  init();
})();
