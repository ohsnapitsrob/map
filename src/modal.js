window.App = window.App || {};

App.Modal = (function () {
  let modal, mTitle, mMeta, mDesc, mGallery, closeBtn;

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

  function init() {
    modal = document.getElementById("modal");
    mTitle = document.getElementById("mTitle");
    mMeta = document.getElementById("mMeta");
    mDesc = document.getElementById("mDesc");
    mGallery = document.getElementById("mGallery");
    closeBtn = document.getElementById("closeBtn");

    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // Clicking chips applies filter
    mMeta.addEventListener("click", (e) => {
      const el = e.target.closest("[data-kind][data-label]");
      if (!el) return;
      const kind = el.getAttribute("data-kind");
      const label = el.getAttribute("data-label");
      App.Search.applyGroupFilter(kind, label);
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

    let html = "";
    if (placeBits.length) {
      html += `<span class="meta-text">${escapeHtml(placeBits.join(" • "))}</span>`;
    }

    if (loc.type) html += chipHtml("Type", loc.type);

    const cols = Array.isArray(loc.collections) ? loc.collections : [];
    cols.forEach((c) => { if (c) html += chipHtml("Collection", c); });

    if (loc.series) html += chipHtml("Title", loc.series);

    mMeta.innerHTML = html;

    mDesc.textContent = loc.description || "";

    mGallery.innerHTML = "";
    const imgs = Array.isArray(loc.images) ? loc.images : [];
    if (!imgs.length) {
      const p = document.createElement("p");
      p.textContent = "No images yet.";
      mGallery.appendChild(p);
    } else {
      imgs.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.loading = "lazy";
        mGallery.appendChild(img);
      });
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  return { init, open, close, escapeHtml };
})();
