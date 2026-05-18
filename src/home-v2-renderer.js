window.FTS = window.FTS || {};

FTS.HomeV2Renderer = (function () {
  const U = window.FTS.HomeV2Utils;

  function ensureRailLinkStyles() {
    if (document.getElementById("fts-home-v2-rail-link-style")) return;

    const style = document.createElement("style");
    style.id = "fts-home-v2-rail-link-style";
    style.textContent = `
      .rail-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; }
      .rail-header > div:first-child { min-width: 0; }
      .rail-link, .rail-title-link { padding: 4px 8px; }
      .hero-carousel-row { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; scroll-snap-type: x mandatory; padding: 0; }
      .hero-carousel-row::-webkit-scrollbar { display: none; }
      .hero-carousel-card { position: relative; flex: 0 0 100%; aspect-ratio: 3 / 1; border-radius: 0; overflow: hidden; text-decoration: none; background: #111827; scroll-snap-align: start; box-shadow: none; transform: none; transition: none; }
      .hero-carousel-card:hover, .hero-carousel-card:focus-visible { transform: none; }
      .hero-carousel-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .hero-carousel-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.08) 55%, rgba(0,0,0,0)); display: flex; align-items: flex-end; padding: 22px; box-sizing: border-box; }
      .hero-carousel-title { color: #fff; font-size: clamp(12px, 2vw, 24px); font-weight: 900; line-height: 0.95; letter-spacing: -0.04em; text-shadow: 0 4px 18px rgba(0,0,0,0.4); }
      .rail-link-icon { width: 38px; height: 38px; padding: 4px 8px; display: inline-flex; align-items: center; justify-content: center; justify-self: end; align-self: center; border-radius: 999px; background: rgba(111, 66, 193, 0.12); color: #6f42c1; text-decoration: none; flex: 0 0 auto; box-sizing: border-box; }
      .rail-link-icon svg { width: 24px; height: 24px; display: block; fill: currentColor; }
      .button-rail-row { display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px; scroll-snap-type: x mandatory; }
      .button-rail-row::-webkit-scrollbar { display: none; }
      .button-rail-link { flex: 0 0 auto; min-width: 160px; min-height: 68px; padding: 16px 18px; border-radius: 18px; background: #ffffff; border: 1px solid rgba(229, 231, 235, 1); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); color: #111827; text-decoration: none; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; user-select: none; scroll-snap-align: start; }
    `;
    document.head.appendChild(style);
  }

  function overlayBadges(title, options = {}) { if (!U.featureEnabled("homepagePosterOverlays")) return []; if (U.appSettings().hideHomepageTags === true) return []; if (options.suppressOverlays === true) return []; if (options.variant === "thumbnail") return []; const key = U.key(title); if (options.noAccessTitles?.has(key)) return [{ label: "No access", type: "no-access" }]; if (options.topTenTitles?.has(key)) return [{ label: "Top 10", type: "top" }]; if (options.latestTitles?.has(key)) return [{ label: "New", type: "new" }]; return []; }
  function poster(item, options = {}) { const variant = options.variant || "poster"; const imageField = variant === "thumbnail" ? "thumbnail" : "poster"; const image = U.safeUrl(item[imageField]); const href = item.href || U.titleUrl(item.title); const badges = overlayBadges(item.title, { ...options, variant }); return `<a class="poster-link ${variant === "thumbnail" ? "thumbnail-link" : ""}" href="${U.escapeHtml(href)}" aria-label="${U.escapeHtml(item.title)}"><div class="poster-card ${variant === "thumbnail" ? "thumbnail-card" : ""}">${image ? `<img src="${U.escapeHtml(image)}" alt="${U.escapeHtml(item.title)}" loading="lazy" draggable="false">` : `<div class="poster-fallback">${U.escapeHtml(item.title)}</div>`}${badges.length ? `<div class="poster-badges">${badges.map((badge) => `<span class="poster-badge poster-badge-${U.escapeHtml(badge.type)}">${U.escapeHtml(badge.label)}</span>`).join("")}</div>` : ""}</div></a>`; }
  function carouselRail(railConfig) { return `<section class="rail rail-carousel"><div class="hero-carousel-row poster-row">${railConfig.items.map((item) => `<a class="hero-carousel-card" href="${U.escapeHtml(item.href)}" aria-label="${U.escapeHtml(item.title)}"><img src="${U.escapeHtml(item.backdrop)}" alt="${U.escapeHtml(item.title)}" loading="lazy" draggable="false"><div class="hero-carousel-overlay"><div class="hero-carousel-title">${U.escapeHtml(item.title)}</div></div></a>`).join("")}</div></section>`; }
  function railLink(railConfig) { if (!railConfig.href) return ""; const chevron = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0z"></path></svg>`; return `<a class="rail-link ${railConfig.linkIcon === "chevron" ? "rail-link-icon" : ""}" href="${U.escapeHtml(railConfig.href)}" aria-label="${U.escapeHtml(railConfig.linkLabel || railConfig.title)}">${railConfig.linkIcon === "chevron" ? chevron : U.escapeHtml(railConfig.linkLabel || "View more")}</a>`; }
  function buttonRail(railConfig) { return `<section class="rail"><div class="rail-header"><div><h2 class="rail-title">${U.escapeHtml(railConfig.title)}</h2></div></div><div class="button-rail-row poster-row">${railConfig.items.map((item) => `<a class="button-rail-link" href="${U.escapeHtml(item.href)}">${U.escapeHtml(item.title)}</a>`).join("")}</div></section>`; }
  function rail(railConfig) { if (!railConfig?.items?.length) return ""; if (railConfig.variant === "carousel") return carouselRail(railConfig); if (railConfig.variant === "buttons") return buttonRail(railConfig); return `<section class="rail ${railConfig.className || ""}"><div class="rail-header"><div><h2 class="rail-title">${U.escapeHtml(railConfig.title)}</h2>${railConfig.subHeader ? `<p class="rail-subtitle">${U.escapeHtml(railConfig.subHeader)}</p>` : ""}</div>${railLink(railConfig)}</div><div class="poster-row ${railConfig.variant === "thumbnail" ? "thumbnail-row" : ""}">${railConfig.items.map((item) => poster(item, railConfig)).join("")}</div></section>`; }
  function render(root, rails) { ensureRailLinkStyles(); root.innerHTML = rails.map(rail).filter(Boolean).join(""); }
  function enableDragging(root) { root.querySelectorAll(".poster-row").forEach((rail) => { if (rail.dataset.dragReady === "true") return; rail.dataset.dragReady = "true"; let isDown = false; let startX = 0; let scrollLeft = 0; let moved = false; rail.addEventListener("mousedown", (e) => { if (e.button !== 0) return; isDown = true; moved = false; startX = e.pageX; scrollLeft = rail.scrollLeft; rail.classList.add("is-dragging"); }); window.addEventListener("mousemove", (e) => { if (!isDown) return; const walk = e.pageX - startX; if (Math.abs(walk) > 5) moved = true; rail.scrollLeft = scrollLeft - walk; }); window.addEventListener("mouseup", () => { if (!isDown) return; isDown = false; rail.classList.remove("is-dragging"); if (moved) { rail.dataset.justDragged = "true"; setTimeout(() => { delete rail.dataset.justDragged; }, 150); } }); rail.addEventListener("click", (e) => { if (rail.dataset.justDragged === "true") { e.preventDefault(); e.stopPropagation(); } }, true); }); }
  return { render, enableDragging };
})();