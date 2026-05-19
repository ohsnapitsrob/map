window.FTS = window.FTS || {};

FTS.AppHeaderTitleSearch = (function () {
  function escapeHtml(value) {
    if (window.FTS?.Utils?.escapeHtml) return window.FTS.Utils.escapeHtml(value);

    return (value || "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(value) {
    return window.FTS?.Utils?.norm ? window.FTS.Utils.norm(value) : (value || "").toString().trim();
  }

  function normalizeComparable(value) {
    return window.FTS?.Utils?.normalizeComparable ? window.FTS.Utils.normalizeComparable(value) : norm(value).toLowerCase();
  }

  function normaliseType(value) {
    if (window.FTS?.Utils?.displayType && window.FTS?.Utils?.normalizeType) {
      return window.FTS.Utils.displayType(window.FTS.Utils.normalizeType(value));
    }

    const type = norm(value).toLowerCase();
    if (type === "film" || type === "movie" || type === "movies") return "Movie";
    if (type === "tv" || type === "tv show" || type === "tv shows" || type === "series") return "TV Show";
    if (type === "music video" || type === "music videos" || type === "mv") return "Music Video";
    if (type === "game" || type === "games" || type === "video game" || type === "video games") return "Video Game";
    return norm(value) || "Title";
  }

  function getNoResultsMessage(query) {
    const easterEggMessage = window.FTS?.EasterEggs?.getTitleSearchNoResultsMessage?.(query);
    return easterEggMessage || "No matching titles.";
  }

  function getRootPath() {
    return window.FTS?.AppHeader?.getRootPath?.() || "./";
  }

  function titleUrl(title) {
    const params = new URLSearchParams();
    params.set("fl", title);
    return `${getRootPath()}title/?${params.toString()}`;
  }

  function metadataTitleType(meta, titleEntry) {
    return normaliseType(meta?.type || titleEntry?.type || "Title");
  }

  function metadataToSearchItem(meta, titleEntry) {
    const title = norm(meta?.title || titleEntry?.title);
    if (!title) return null;

    return {
      title,
      type: metadataTitleType(meta, titleEntry)
    };
  }

  async function loadTitleIndex() {
    await window.FTS?.Boot?.ready?.({
      titleVisibility: true,
      titleDatasets: true
    });

    const titleDatasets = window.FTS?.DataStore?.getTitleDatasets
      ? await window.FTS.DataStore.getTitleDatasets()
      : null;

    const visibleTitleKeys = window.FTS?.TitleVisibility?.visibleTitleKeys
      ? await window.FTS.TitleVisibility.visibleTitleKeys()
      : null;

    const metadataRows = window.FTS?.DataStore?.getTitleMetadata
      ? await window.FTS.DataStore.getTitleMetadata()
      : [];

    const entryByKey = titleDatasets?.allByTitleKey || titleDatasets?.byTitleKey || new Map();
    const configuredRows = metadataRows.length
      ? metadataRows
      : Array.from(entryByKey.values()).map((entry) => ({
        title: entry.title,
        type: entry.type
      }));

    const items = configuredRows
      .map((meta) => {
        const titleKey = normalizeComparable(meta.title);
        const titleEntry = entryByKey.get(titleKey);

        if (visibleTitleKeys && !visibleTitleKeys.has(titleKey)) return null;

        return metadataToSearchItem(meta, titleEntry);
      })
      .filter(Boolean);

    const deduped = new Map();

    items.forEach((item) => {
      const titleKey = normalizeComparable(item.title);
      if (!titleKey) return;
      if (!deduped.has(titleKey)) deduped.set(titleKey, item);
    });

    return Array.from(deduped.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  function addStyle() {
    if (document.getElementById("fts-title-search-style")) return;

    const style = document.createElement("style");
    style.id = "fts-title-search-style";
    style.textContent = `
      .fts-title-search-modal {
        position: fixed;
        inset: 0;
        z-index: 99000;
        display: none;
        background: rgba(17, 24, 39, 0.42);
        padding: 84px 16px 16px;
      }

      .fts-title-search-modal.open {
        display: block;
      }

      .fts-title-search-panel {
        width: min(680px, 100%);
        margin: 0 auto;
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        overflow: hidden;
      }

      .fts-title-search-head {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      .fts-title-search-input {
        flex: 1;
        min-width: 0;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 16px;
      }

      .fts-title-search-close {
        width: 42px;
        height: 42px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: #ffffff;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }

      .fts-title-search-results {
        max-height: min(62vh, 520px);
        overflow: auto;
        padding: 8px;
      }

      .fts-title-search-result {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border-radius: 16px;
        color: inherit;
        text-decoration: none;
      }

      .fts-title-search-result:hover,
      .fts-title-search-result:focus-visible {
        background: #f5f7f7;
      }

      .fts-title-search-result-title {
        font-weight: 800;
      }

      .fts-title-search-result-meta {
        margin-top: 3px;
        color: #6b7280;
        font-size: 12px;
      }

      .fts-title-search-empty {
        padding: 22px 14px;
        color: #6b7280;
        font-size: 14px;
      }
    `;

    document.head.appendChild(style);
  }

  function renderResults(results, query) {
    const resultsEl = document.querySelector(".fts-title-search-results");
    if (!resultsEl) return;

    if (!query) {
      resultsEl.innerHTML = `<div class="fts-title-search-empty">Start typing to search titles.</div>`;
      return;
    }

    if (!results.length) {
      resultsEl.innerHTML = `<div class="fts-title-search-empty">${escapeHtml(getNoResultsMessage(query))}</div>`;
      return;
    }

    resultsEl.innerHTML = results.slice(0, 30).map((item) => `
      <a class="fts-title-search-result" href="${titleUrl(item.title)}">
        <span>
          <span class="fts-title-search-result-title">${escapeHtml(item.title)}</span>
          <span class="fts-title-search-result-meta">${escapeHtml(item.type)}</span>
        </span>
        <span aria-hidden="true">›</span>
      </a>
    `).join("");
  }

  function init() {
    if (document.querySelector(".fts-title-search-modal")) return;

    addStyle();

    const modal = document.createElement("div");
    modal.className = "fts-title-search-modal";
    modal.innerHTML = `
      <div class="fts-title-search-panel" role="dialog" aria-modal="true" aria-label="Search titles">
        <div class="fts-title-search-head">
          <input class="fts-title-search-input" type="search" placeholder="Search titles…" autocomplete="off">
          <button class="fts-title-search-close" type="button" aria-label="Close title search">×</button>
        </div>
        <div class="fts-title-search-results"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector(".fts-title-search-input");
    const close = modal.querySelector(".fts-title-search-close");
    let index = [];
    let loaded = false;

    async function ensureLoaded() {
      if (loaded) return;
      loaded = true;

      try {
        index = await loadTitleIndex();
      } catch (err) {
        console.error("Could not load title search index", err);
        index = [];
      }
    }

    function closeModal() {
      modal.classList.remove("open");
      input.value = "";
      renderResults([], "");
    }

    input.addEventListener("input", () => {
      const query = norm(input.value).toLowerCase();
      const results = index.filter((item) => {
        return item.title.toLowerCase().includes(query) || item.type.toLowerCase().includes(query);
      }).sort((a, b) => a.title.localeCompare(b.title));

      renderResults(results, query);
    });

    close.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    window.addEventListener("fts:app-settings-updated", () => {
      loaded = false;
      index = [];
      if (modal.classList.contains("open")) {
        ensureLoaded().then(() => {
          input.dispatchEvent(new Event("input"));
        });
      }
    });

    window.FTSHeaderSearch = {
      async open() {
        modal.classList.add("open");
        renderResults([], "");
        await ensureLoaded();
        input.focus();
      }
    };
  }

  return {
    init
  };
})();
