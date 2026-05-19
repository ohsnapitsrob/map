(function () {
  const U = window.FTS?.Utils || {};
  const contentEl = document.getElementById("ntContent");
  const DEFAULT_SHOWN = 3;

  function norm(value) {
    return U.norm ? U.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return U.normalizeComparable ? U.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function escapeHtml(value) {
    return U.escapeHtml ? U.escapeHtml(value) : norm(value);
  }

  function safeUrl(value) {
    return U.safeUrl ? U.safeUrl(value) : norm(value);
  }

  function getNationalTrustName(row) {
    return U.getNationalTrustName ? U.getNationalTrustName(row) : norm(row.NationalTrust || row["National Trust"] || row.NT);
  }

  function getNationalTrustUrl(row) {
    return U.getNationalTrustUrl ? U.getNationalTrustUrl(row) : norm(row.NTURL || row["NT URL"] || row.nturl);
  }

  function renderLoading() {
    if (!contentEl) return;
    contentEl.innerHTML = `<section class="type-loading-stage"><div class="fts-loader" aria-label="Loading"></div></section>`;
  }

  function sceneTitleKey(scene) {
    return key(scene.title);
  }

  function balanceScenesByTitle(scenes) {
    const byTitle = new Map();

    scenes.forEach((scene) => {
      const titleKey = sceneTitleKey(scene);
      if (!titleKey) return;
      if (!byTitle.has(titleKey)) byTitle.set(titleKey, []);
      byTitle.get(titleKey).push(scene);
    });

    const balanced = [];
    const groups = Array.from(byTitle.values());
    let added = true;

    while (added) {
      added = false;

      groups.forEach((group) => {
        const next = group.shift();
        if (!next) return;
        balanced.push(next);
        added = true;
      });
    }

    return balanced;
  }

  function groupedByProperty(rows) {
    const groups = new Map();

    rows.forEach((scene) => {
      const name = getNationalTrustName(scene);
      if (!name) return;

      const groupKey = key(name);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          name,
          url: getNationalTrustUrl(scene),
          scenes: []
        });
      }

      const group = groups.get(groupKey);
      group.scenes.push(scene);
      if (!group.url) group.url = getNationalTrustUrl(scene);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        scenes: balanceScenesByTitle(group.scenes)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function discoverButton(group) {
    const url = safeUrl(group.url);
    if (!url) return "";

    return `
      <a class="nt-discover-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
        Discover more about this location
      </a>
    `;
  }

  function sceneGrid(group, index) {
    const visibleScenes = group.scenes.slice(0, DEFAULT_SHOWN);
    const hiddenScenes = group.scenes.slice(DEFAULT_SHOWN);
    const hiddenId = `nt-hidden-${index}`;

    return `
      <div class="scene-grid nt-scene-grid">
        ${visibleScenes.map((scene) => window.FTS.SceneCard.render(scene)).join("")}
      </div>

      ${hiddenScenes.length ? `
        <div id="${hiddenId}" class="scene-grid nt-scene-grid nt-hidden-scenes" hidden>
          ${hiddenScenes.map((scene) => window.FTS.SceneCard.render(scene)).join("")}
        </div>

        <button class="btn btn-secondary nt-see-all" type="button" data-nt-expand="${hiddenId}">
          See all ${group.scenes.length} titles
        </button>
      ` : ""}
    `;
  }

  function renderGroups(groups) {
    if (!groups.length) {
      contentEl.innerHTML = `
        <div class="empty-card">
          <div class="kicker">No locations</div>
          <h2>No National Trust locations to show</h2>
          <p class="meta">No publicly visible National Trust scenes match your current settings.</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = groups.map((group, index) => `
      <section class="nt-group">
        <div class="nt-group-header">
          <div>
            <h2>${escapeHtml(group.name)}</h2>
            <p class="meta">${group.scenes.length} scene${group.scenes.length === 1 ? "" : "s"} found here.</p>
            ${discoverButton(group)}
          </div>
        </div>

        ${sceneGrid(group, index)}
      </section>
    `).join("");

    contentEl.querySelectorAll("[data-nt-expand]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.getAttribute("data-nt-expand"));
        if (!target) return;
        target.hidden = false;
        button.remove();
      });
    });
  }

  async function loadRows() {
    await window.FTS?.Boot?.ready?.({ scenePacks: true, locations: true, sceneCard: true });

    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicScenes : scenePacks.allScenes;
    }

    const rows = await window.FTS.Locations.loadAll();
    return window.FTS?.Visibility?.getVisibleScenes?.(rows) || rows;
  }

  async function init() {
    renderLoading();

    try {
      const rows = await loadRows();
      const ntRows = rows.filter((row) => getNationalTrustName(row));
      renderGroups(groupedByProperty(ntRows));
    } catch (err) {
      console.error(err);
      contentEl.innerHTML = `<div class="empty-card">Could not load National Trust locations.</div>`;
    }
  }

  init();
})();
