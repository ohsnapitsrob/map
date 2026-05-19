(function () {
  const contentEl = document.getElementById("statsContent");
  const copyEl = document.getElementById("statsCopy");

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function key(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function escapeHtml(value) {
    return window.FTS?.Utils?.escapeHtml ? window.FTS.Utils.escapeHtml(value) : norm(value);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function countBy(rows, getter) {
    const map = new Map();

    rows.forEach((row) => {
      const label = norm(getter(row));
      if (!label) return;
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function statCard(value, label) {
    return `
      <article class="stats-card-page">
        <div class="stats-card-value">${formatNumber(value)}</div>
        <div class="stats-card-label">${escapeHtml(label)}</div>
      </article>
    `;
  }

  function listSection(title, items) {
    return `
      <section class="stats-section">
        <h2>${escapeHtml(title)}</h2>
        <div class="stats-list">
          ${items.slice(0, 10).map((item) => `
            <div class="stats-row">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${formatNumber(item.count)}</span>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  async function loadRows() {
    await window.FTS?.Boot?.ready?.({ scenePacks: true });

    if (window.FTS?.DataStore?.getScenePacks) {
      const scenePacks = await window.FTS.DataStore.getScenePacks();
      const hideNoAccess = window.FTS?.Visibility?.hideNoAccessEnabled?.() === true;
      return hideNoAccess ? scenePacks.publicScenes : scenePacks.allScenes;
    }

    return [];
  }

  async function init() {
    try {
      const rows = await loadRows();

      const titleKeys = new Set(rows.map((row) => key(row.title)).filter(Boolean));
      const cityKeys = new Set(rows.map((row) => key(row.city)).filter(Boolean));
      const countryKeys = new Set(rows.map((row) => key(row.country)).filter(Boolean));
      const restrictedRows = rows.filter((row) => norm(row.access) !== "");

      copyEl.textContent = `${formatNumber(rows.length)} scene${rows.length === 1 ? "" : "s"} currently included based on your visibility settings.`;

      contentEl.innerHTML = `
        <section class="stats-grid-page">
          ${statCard(rows.length, "Scenes")}
          ${statCard(titleKeys.size, "Titles")}
          ${statCard(cityKeys.size, "Cities")}
          ${statCard(countryKeys.size, "Countries")}
          ${statCard(restrictedRows.length, "No public access scenes")}
        </section>

        ${listSection("By type", countBy(rows, (row) => row.type))}
        ${listSection("Top titles", countBy(rows, (row) => row.title))}
        ${listSection("Top cities", countBy(rows, (row) => row.city))}
        ${listSection("Top countries", countBy(rows, (row) => row.country))}
      `;
    } catch (err) {
      console.error(err);
      copyEl.textContent = "Could not load project stats.";
      contentEl.innerHTML = "";
    }
  }

  init();
})();
