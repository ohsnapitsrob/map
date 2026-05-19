(function () {
  const titleEl = document.getElementById("personTitle");
  const copyEl = document.getElementById("personCopy");
  const contentEl = document.getElementById("personContent");

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
    params.set("person-error", reason);
    if (value) params.set("value", value);
    window.location.replace(`../404.html?${params.toString()}`);
  }

  function getParamNames() {
    const params = new URLSearchParams(window.location.search);
    return {
      star: norm(params.get("star")),
      director: norm(params.get("director")),
      person: norm(params.get("person")),
      q: norm(params.get("q"))
    };
  }

  function requestedPerson() {
    const names = getParamNames();
    return names.star || names.director || names.person || names.q;
  }

  function requestedMode() {
    const names = getParamNames();
    if (names.director) return "director";
    if (names.star) return "star";
    return "person";
  }

  function titleMatchesPerson(meta, personName, mode) {
    const wanted = key(personName);

    if (mode === "director") {
      return splitComma(meta.Director || meta.director).some((name) => key(name) === wanted);
    }

    if (mode === "star") {
      return splitComma(meta.Stars || meta.stars).some((name) => key(name) === wanted);
    }

    return (
      splitComma(meta.Stars || meta.stars).some((name) => key(name) === wanted) ||
      splitComma(meta.Director || meta.director).some((name) => key(name) === wanted)
    );
  }

  function posterCard(meta) {
    const title = norm(meta.title);
    const poster = norm(meta.poster);

    return `
      <a class="person-card" href="../title/?fl=${encodeURIComponent(title)}" aria-label="${escapeHtml(title)}">
        <div class="poster-card">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(title)}" loading="lazy">` : `<div class="poster-fallback">${escapeHtml(title)}</div>`}
        </div>
      </a>
    `;
  }

  async function visibleTitleKeys() {
    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicTitleKeys : scenePacks.allTitleKeys;
    }

    return null;
  }

  async function init() {
    await window.FTS?.Boot?.ready?.({ scenePacks: true, titleDatasets: true });

    const person = requestedPerson();
    const mode = requestedMode();

    if (!person) {
      redirectTo404("missing-person-param");
      return;
    }

    titleEl.textContent = person;
    document.title = `${person} | Find That Scene`;

    try {
      const [metadataRows, titleKeys] = await Promise.all([
        window.FTS.DataStore.getTitleMetadata(),
        visibleTitleKeys()
      ]);

      const matches = metadataRows
        .filter((meta) => titleMatchesPerson(meta, person, mode))
        .filter((meta) => !titleKeys || titleKeys.has(key(meta.title)))
        .sort((a, b) => norm(a.title).localeCompare(norm(b.title), undefined, { sensitivity: "base" }));

      copyEl.textContent = `${matches.length} connected title${matches.length === 1 ? "" : "s"} with scenes found.`;

      contentEl.innerHTML = matches.length
        ? `
          <section>
            <h2 class="person-section-title">Titles</h2>
            <div class="person-grid-section">
              ${matches.map(posterCard).join("")}
            </div>
          </section>
        `
        : `<div class="poster-fallback">No matches</div>`;
    } catch (err) {
      console.error(err);
      copyEl.textContent = "Could not load this person.";
      contentEl.innerHTML = "";
    }
  }

  init();
})();
