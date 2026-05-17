(function () {
  const CONFIG = window.APP_CONFIG || {};
  const LOGO_URL = CONFIG.SITE_LOGO_URL || "";
  const SITE_NAME = CONFIG.SITE_NAME || "Find That Scene";

  window.FTS = window.FTS || {};

  function getPath() {
    return window.location.pathname.replace(/\/+$/, "");
  }

  function getRootPath() {
    if (document.body.dataset.navRoot) return document.body.dataset.navRoot;

    const path = getPath();
    const nestedRoutes = ["/browse", "/explore", "/title", "/stats", "/national-trust", "/privacy", "/metadata", "/person"];

    if (nestedRoutes.some((route) => path.endsWith(route))) {
      return "../";
    }

    return "./";
  }

  function isExploreView() {
    return getPath().endsWith("/explore");
  }

  function isPrivacyView() {
    return getPath().endsWith("/privacy");
  }

  function logoEnabled() {
    return window.FTS?.Features?.isEnabled("headerLogoEnabled") !== false;
  }

  function addStyle() {
    if (document.getElementById("fts-app-header-style")) return;

    const style = document.createElement("style");
    style.id = "fts-app-header-style";
    style.textContent = `
      body.fts-has-app-header:not(:has(#map)) {
        padding-top: 72px;
      }

      body.fts-has-app-header:has(#map) {
        padding-top: 0;
      }

      .fts-app-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        min-height: 72px;
        max-height: 72px;
        padding: 12px 16px;
        background: #ffffff;
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        z-index: 3200;
        box-shadow: 0 1px 0 rgba(229, 231, 235, 0.9);
      }

      .fts-app-header-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        justify-self: center;
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
      }

      .fts-app-header-logo {
        display: block;
        max-height: 48px;
        width: auto;
        object-fit: contain;
      }

      .fts-app-header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .fts-header-search-btn,
      .fts-header-info-btn,
      .fts-header-settings-btn {
        width: 44px;
        height: 44px;
        border: 0;
        border-radius: 14px;
        background: #f5f7f7;
        color: #111827;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .fts-header-search-btn.is-hidden {
        visibility: hidden;
        pointer-events: none;
      }

      .fts-header-search-btn svg,
      .fts-header-info-btn svg,
      .fts-header-settings-btn svg {
        width: 21px;
        height: 21px;
        fill: currentColor;
      }

      .fts-info-overlay {
        position: fixed;
        inset: 0;
        z-index: 150000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.45);
      }

      .fts-info-panel {
        width: min(560px, 100%);
        border-radius: 28px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
        overflow: hidden;
      }

      .fts-info-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        padding: 22px 22px 14px;
        border-bottom: 1px solid #e5e7eb;
      }

      .fts-info-title {
        margin: 0;
        font-size: 22px;
        line-height: 1.1;
        font-weight: 850;
      }

      .fts-info-close {
        flex: 0 0 auto;
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 999px;
        background: #f3f4f6;
        color: #111827;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
      }

      .fts-info-body {
        padding: 20px 22px 22px;
      }

      .fts-info-copy {
        margin: 0;
        color: #374151;
        font-size: 15px;
        line-height: 1.6;
      }

      .fts-info-quote {
        margin: 18px 0 0;
        padding: 16px;
        border-radius: 18px;
        background: #f5f7f7;
        color: #111827;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 800;
      }

      .fts-info-link {
        display: inline-flex;
        margin-top: 18px;
        color: #111827;
        font-size: 14px;
        font-weight: 800;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      body:has(#map) .topbar {
        margin-top: 72px;
      }

      body:has(#map) .topbar-inner {
        display: none;
      }

      body:has(#map) .topbar.fts-map-search-open .topbar-inner {
        display: flex;
      }

      body:has(#map) .topbar.fts-map-search-open {
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      }

      @media (min-width: 700px) {
        .fts-info-overlay {
          align-items: center;
          padding: 24px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function iconSearch() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 0 1 5.16 10.45l4.45 4.44-1.42 1.42-4.44-4.45A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z"></path></svg>`;
  }

  function iconInfo() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 10h2v8h-2v-8Zm0-4h2v2h-2V6Zm1-4a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16a8 8 0 0 1 0 16Z"></path></svg>`;
  }

  function iconSettings() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"></path></svg>`;
  }

  function openInfoModal() {
    if (document.querySelector(".fts-info-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "fts-info-overlay";
    overlay.innerHTML = `
      <div class="fts-info-panel" role="dialog" aria-modal="true" aria-label="About Find That Scene">
        <div class="fts-info-header">
          <h2 class="fts-info-title">About Find That Scene</h2>
          <button class="fts-info-close" type="button" aria-label="Close about this project">×</button>
        </div>
        <div class="fts-info-body">
          <p class="fts-info-copy">
            Find That Scene is an independent personal project documenting real-world filming, TV, music video, game, and inspiration locations. It’s built as a fan-made archive for discovery, photography, and location research.
          </p>
          <p class="fts-info-quote">
            “Doc, this is heavy.” — Marty McFly, Back to the Future (1985)
          </p>
          <a class="fts-info-link" href="${getRootPath()}privacy/">Read the privacy page</a>
        </div>
      </div>
    `;

    const close = () => overlay.remove();

    overlay.querySelector(".fts-info-close")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    document.body.appendChild(overlay);
  }

  function render() {
    if (document.querySelector(".fts-app-header")) return;

    const explore = isExploreView();
    const privacy = isPrivacyView();

    const header = document.createElement("header");
    header.className = "fts-app-header";

    const logoMarkup = logoEnabled() && LOGO_URL
      ? `
        <a class="fts-app-header-link" href="${getRootPath()}" aria-label="${SITE_NAME} home">
          <img class="fts-app-header-logo" src="${LOGO_URL}" alt="${SITE_NAME}">
        </a>
      `
      : `<span></span>`;

    header.innerHTML = `
      <button class="fts-header-search-btn ${privacy ? "is-hidden" : ""}" type="button" aria-label="${explore ? "Search map" : "Search titles"}">${iconSearch()}</button>
      ${logoMarkup}
      <div class="fts-app-header-actions">
        <button class="fts-header-info-btn" type="button" aria-label="About this project">${iconInfo()}</button>
        <button class="fts-header-settings-btn" type="button" aria-label="Settings">${iconSettings()}</button>
      </div>
    `;

    document.body.classList.add("fts-has-app-header");
    document.body.prepend(header);

    const searchButton = header.querySelector(".fts-header-search-btn");
    const infoButton = header.querySelector(".fts-header-info-btn");
    const settingsButton = header.querySelector(".fts-header-settings-btn");

    if (!privacy) {
      if (explore) {
        window.FTS?.AppHeaderMapSearch?.init?.(searchButton);
      } else {
        window.FTS?.AppHeaderTitleSearch?.init?.();
      }

      searchButton?.addEventListener("click", () => {
        window.FTSHeaderSearch?.open();
      });
    }

    infoButton?.addEventListener("click", openInfoModal);

    settingsButton?.addEventListener("click", () => {
      if (window.FTS?.AppSettings?.open) {
        window.FTS.AppSettings.open();
        return;
      }

      window.FTS?.Privacy?.openSettings?.();
    });
  }

  FTS.AppHeader = {
    getRootPath
  };

  addStyle();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
