window.FTS = window.FTS || {};

FTS.HomeV2Renderer = (function () {
  const U = window.FTS.HomeV2Utils;

  function ensureRailLinkStyles() {
    if (document.getElementById("fts-home-v2-rail-link-style")) return;

    const style = document.createElement("style");
    style.id = "fts-home-v2-rail-link-style";
    style.textContent = `
      .rail-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
      }

      .rail-header > div:first-child {
        min-width: 0;
      }

      .rail-link,
      .rail-title-link {
        padding: 4px 8px;
      }

      .rail-link-icon {
        width: 38px;
        height: 38px;
        padding: 4px 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        justify-self: end;
        align-self: center;
        border-radius: 999px;
        background: rgba(111, 66, 193, 0.12);
        color: #6f42c1;
        text-decoration: none;
        flex: 0 0 auto;
        box-sizing: border-box;
      }

      .rail-link-icon svg {
        width: 24px;
        height: 24px;
        display: block;
        fill: currentColor;
      }
    `;

    document.head.appendChild(style);
  }

  function overlayBadges(title, options = {}) {
    if (!U.featureEnabled("homepagePosterOverlays")) return [];
    if (U.appSettings().hideHomepageTags === true) return [];
    if (options.suppressOverlays === true) return [];
    if (options.variant === "thumbnail") return [];

    const key = U.key(title);

    if (options.noAccessTitles?.has(key)) return [{ label: "No access", type: "no-access" }];
    if (options.topTenTitles?.has(key)) return [{ label: "Top 10", type: "top" }];
    if (options.latestTitles?.has(key)) return [{ label: "New", type: "new" }];

    return [];
  }

  function poster(item, options = {}) {
    const variant = options.variant || "poster";
    const imageField = variant === "thumbnail" ? "thumbnail" : "poster";
    const image = U.safeUrl(item[imageField]);
    const href = item.href || U.titleUrl(item.title);
    const badges = overlayBadges(item.title, { ...options, variant });

    return `
      <a class="poster-link ${variant === "thumbnail" ? "thumbnail-link" : ""}" href="${U.escapeHtml(href)}" aria-label="${U.escapeHtml(item.title)}">
        <div class="poster-card ${variant === "thumbnail" ? "thumbnail-card" : ""}">
          ${image ? `<img src="${U.escapeHtml(image)}" alt="${U.escapeHtml(item.title)}" loading="lazy" draggable="false">` : `<div class="poster-fallback">${U.escapeHtml(item.title)}</div>`}
          ${badges.length ? `<div class="poster-badges">${badges.map((badge) => `<span class="poster-badge poster-badge-${U.escapeHtml(badge.type)}">${U.escapeHtml(badge.label)}</span>`).join("")}</div>` : ""}
        </div>
      </a>
    `;
  }

  function railLink(railConfig) {
    if (!railConfig.href) return "";

    const chevron = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"></path></svg>`;

    return `
      <a class="rail-link ${railConfig.linkIcon === "chevron" ? "rail-link-icon" : ""}" href="${U.escapeHtml(railConfig.href)}" aria-label="${U.escapeHtml(railConfig.linkLabel || railConfig.title)}">
        ${railConfig.linkIcon === "chevron" ? chevron : U.escapeHtml(railConfig.linkLabel || "View more")}
      </a>
    `;
  }

  function rail(railConfig) {
    if (!railConfig?.items?.length) return "";

    return `
      <section class="rail ${railConfig.className || ""}">
        <div class="rail-header">
          <div>
            <h2 class="rail-title">${U.escapeHtml(railConfig.title)}</h2>
            ${railConfig.subHeader ? `<p class="rail-subtitle">${U.escapeHtml(railConfig.subHeader)}</p>` : ""}
          </div>
          ${railLink(railConfig)}
        </div>

        <div class="poster-row ${railConfig.variant === "thumbnail" ? "thumbnail-row" : ""}">
          ${railConfig.items.map((item) => poster(item, railConfig)).join("")}
        </div>
      </section>
    `;
  }

  function render(root, rails) {
    ensureRailLinkStyles();
    root.innerHTML = rails.map(rail).filter(Boolean).join("");
  }

  function enableDragging(root) {
    root.querySelectorAll(".poster-row").forEach((rail) => {
      if (rail.dataset.dragReady === "true") return;
      rail.dataset.dragReady = "true";

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let moved = false;

      rail.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDown = true;
        moved = false;
        startX = e.pageX;
        scrollLeft = rail.scrollLeft;
        rail.classList.add("is-dragging");
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const walk = e.pageX - startX;
        if (Math.abs(walk) > 5) moved = true;
        rail.scrollLeft = scrollLeft - walk;
      });

      window.addEventListener("mouseup", () => {
        if (!isDown) return;
        isDown = false;
        rail.classList.remove("is-dragging");

        if (moved) {
          rail.dataset.justDragged = "true";
          setTimeout(() => { delete rail.dataset.justDragged; }, 150);
        }
      });

      rail.addEventListener("click", (e) => {
        if (rail.dataset.justDragged === "true") {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    });
  }

  return { render, enableDragging };
})();
