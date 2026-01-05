window.App = window.App || {};

App.Modal = (function () {
  let modal, mTitle, mInfo, mDesc, mGallery, mTags, closeBtn;

  function escapeHtml(s) {
    return (s || "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function chipHtml(kind, label) {
    const k = escapeHtml(kind);
    const l = escapeHtml(label);
    return `<span class="chip" role="button" tabindex="0" data-kind="${k}" data-label="${l}">${l}</span>`;
  }

  function pinIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2c-3.314 0-6 2.686-6 6c0 4.5 6 14 6 14s6-9.5 6-14c0-3.314-2.686-6-6-6z"></path>
        <circle cx="12" cy="8" r="2.5"></circle>
      </svg>
    `;
  }

  function cameraIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 4l1.2-2h3.6L15 4h2.5A3.5 3.5 0 0 1 21 7.5v9A3.5 3.5 0 0 1 17.5 20h-11A3.5 3.5 0 0 1 3 16.5v-9A3.5 3.5 0 0 1 6.5 4H9zm3 5a4 4 0 1 0 0 8a4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4z"></path>
      </svg>
    `;
  }

  function init() {
    modal = document.getElementById("modal");
    mTitle = document.getElementById("mTitle");
    mInfo = document.getElementById("mInfo");
    mDesc = document.getElementById("mDesc");
    mGallery = document.getElementById("mGallery");
    mTags = document.getElementById("mTags");
    closeBtn = document.getElementById("closeBtn");

    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // Clicking chips applies filter AND closes modal
    mTags.addEventListener("click", (e) => {
      const el = e.target.closest("[data-kind][data-label]");
      if (!el) return;
      const kind = el.getAttribute("data-kind");
      const label = el.getAttribute("data-label");

      App.Search.applyGroupFilter(kind, label);
      close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
  }

  function open(loc) {
    mTitle.textContent = loc.title || "";

    const placeBits = [];
    if (loc.place) placeBits.push(loc.place);
    if (loc.country) placeBits.push(loc.country);
    const where = placeBits.join(", ");

    const when = loc.monthShort || loc.dateFormatted || loc.rawDate || "";

    mInfo.innerHTML = `
      ${where ? `
        <div class="loc-info-item">
          <span class="loc-info-icon loc-info-icon-pin">${pinIconSvg()}</span>
          <span class="loc-info-text">${escapeHtml(where)}</span>
        </div>
      ` : ""}

      ${when ? `
        <div class="loc-info-item">
          <span class="loc-info-icon loc-info-icon-cam">${cameraIconSvg()}</span>
          <span class="loc-info-text">${escapeHtml(when)}</span>
        </div>
      ` : ""}
    `;

    mDesc.textContent = loc.description || "";
    mDesc.style.display = mDesc.textContent ? "block" : "none";

    // Gallery
    mGallery.innerHTML = "";
    mGallery.classList.remove("single");
    const imgs = Array.isArray(loc.images) ? loc.images : [];

    if (!imgs.length) {
      const p = document.createElement("p");
      p.textContent = "No images yet.";
      mGallery.appendChild(p);
    } else {
      if (imgs.length === 1) mGallery.classList.add("single");
      imgs.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.loading = "lazy";
        mGallery.appendChild(img);
      });
    }

    // Tags (below image)
    const chips = [];

    // Always include the exact Title so users can see all locations for it
    if (loc.title) chips.push(chipHtml("Title", loc.title));

    // ✅ Series now uses its own kind so filtering works
    if (loc.series && loc.series !== loc.title) chips.push(chipHtml("Series", loc.series));

    if (loc.type) chips.push(chipHtml("Type", loc.type));

    const cols = Array.isArray(loc.collections) ? loc.collections : [];
    cols.forEach((c) => { if (c) chips.push(chipHtml("Collection", c)); });

    mTags.innerHTML = chips.length ? chips.join("") : `<span class="loc-tags-empty">No tags yet.</span>`;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  return { init, open, close, escapeHtml };
})();
