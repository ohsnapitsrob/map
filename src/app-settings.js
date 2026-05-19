window.FTS = window.FTS || {};

FTS.AppSettings = (function () {
  const STORAGE_KEY = "fts-app-settings";
  const PRIVACY_STORAGE_KEY = "fts-privacy-settings";

  const defaults = {
    hideNoAccessScenes: true,
    hideHomepageTags: false
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch (err) {
      return { ...defaults };
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {}
  }

  function getSettings() {
    return load();
  }

  function clearRuntimeCaches() {
    try {
      window.FTS?.DataCache?.clearCache?.();
    } catch (err) {}

    try {
      window.FTS?.DataStore?.clear?.();
    } catch (err) {}

    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("fts:")) sessionStorage.removeItem(key);
      });
    } catch (err) {}
  }

  function setSetting(key, value) {
    const settings = load();
    settings[key] = value;
    save(settings);
    clearRuntimeCaches();

    window.dispatchEvent(new CustomEvent("fts:app-settings-updated", {
      detail: settings
    }));

    return settings;
  }

  function getVersionLabel() {
    const runtime = window.RUNTIME_CONFIG || {};
    const environment = runtime.environment || "local";
    const commit = runtime.commit || "dev";

    return `${environment}.${commit}`;
  }

  function clearOptionalStorage() {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("plausible_") ||
          key.startsWith("yt-") ||
          key.startsWith("youtube")
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {}

    try {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        if (!name) return;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });
    } catch (err) {}
  }

  function saveAllSettings(nextAppSettings, nextPrivacySettings, options = {}) {
    save(nextAppSettings);

    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify({
        mediaEmbeds: nextPrivacySettings.mediaEmbeds === true
      }));
    } catch (err) {}

    clearRuntimeCaches();

    window.dispatchEvent(new CustomEvent("fts:app-settings-updated", {
      detail: nextAppSettings
    }));

    if (options.privacyChanged) {
      clearOptionalStorage();
    }

    window.location.reload();
  }

  function getRootPath() {
    return window.FTS?.AppHeader?.getRootPath?.() || "./";
  }

  function addStyles() {
    if (document.getElementById("fts-app-settings-style")) return;

    const style = document.createElement("style");
    style.id = "fts-app-settings-style";
    style.textContent = `
      .fts-settings-overlay {
        position: fixed;
        inset: 0;
        z-index: 150000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.45);
      }

      .fts-settings-panel {
        width: min(620px, 100%);
        max-height: min(780px, calc(100vh - 32px));
        overflow: auto;
        border-radius: 28px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
      }

      .fts-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        padding: 22px 22px 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      .fts-settings-title {
        margin: 0 0 6px;
        font-size: 22px;
        line-height: 1.1;
        font-weight: 850;
      }

      .fts-settings-intro {
        margin: 0;
        color: #6b7280;
        font-size: 14px;
        line-height: 1.45;
      }

      .fts-settings-close {
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

      .fts-settings-body {
        padding: 8px 22px 12px;
      }

      .fts-settings-section {
        padding: 18px 0;
        border-bottom: 1px solid #e5e7eb;
      }

      .fts-settings-section:last-child {
        border-bottom: 0;
      }

      .fts-settings-section-title {
        margin: 0 0 12px;
        font-size: 13px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 850;
      }

      .fts-settings-section-copy,
      .fts-privacy-copy {
        margin: 0 0 8px;
        color: #5f5f5f;
        font-size: 14px;
        line-height: 1.5;
      }

      .fts-settings-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
      }

      .fts-settings-row-title {
        font-size: 15px;
        font-weight: 800;
      }

      .fts-settings-row-copy {
        margin-top: 4px;
        color: #6b7280;
        font-size: 13px;
        line-height: 1.45;
      }

      .fts-settings-link {
        display: inline-flex;
        margin-top: 10px;
        color: #111827;
        font-size: 14px;
        font-weight: 800;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .fts-settings-version {
        padding: 0 22px 14px;
        color: #9ca3af;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-align: center;
      }

      .fts-settings-toggle {
        flex: 0 0 auto;
        position: relative;
        width: 54px;
        height: 32px;
        min-width: 54px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: #d1d5db;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        box-shadow: inset 0 0 0 1px rgba(17, 24, 39, 0.06);
      }

      .fts-settings-toggle::after {
        content: "";
        position: absolute;
        top: 4px;
        left: 4px;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.22);
        transition: transform 0.2s ease;
      }

      .fts-settings-toggle.is-active {
        background: #111827;
      }

      .fts-settings-toggle.is-active::after {
        transform: translateX(22px);
      }

      .fts-settings-actions {
        position: sticky;
        bottom: 0;
        display: flex;
        gap: 10px;
        padding: 16px 22px 12px;
        border-top: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .fts-settings-save,
      .fts-settings-cancel {
        flex: 1;
        min-height: 48px;
        border: 0;
        border-radius: 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 800;
      }

      .fts-settings-save {
        background: #111827;
        color: #ffffff;
      }

      .fts-settings-cancel {
        background: #f3f4f6;
        color: #111827;
      }

      @media (min-width: 700px) {
        .fts-settings-overlay {
          align-items: center;
          padding: 24px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function toggleButton(active, label, key) {
    return `<button class="fts-settings-toggle ${active ? "is-active" : ""}" type="button" aria-label="${label}" aria-pressed="${active ? "true" : "false"}" data-setting-toggle="${key}"></button>`;
  }

  function syncToggle(toggle, active) {
    toggle.classList.toggle("is-active", active);
    toggle.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function open() {
    addStyles();

    const mapSettingsEnabled = window.FTS?.Features?.isEnabled("settingsMapSectionEnabled") !== false;
    const homepagePosterOverlaysEnabled = window.FTS?.Features?.isEnabled("homepagePosterOverlays") !== false;

    const originalAppSettings = load();
    const originalPrivacySettings = window.FTS?.Privacy?.getSettings?.() || { mediaEmbeds: false };

    const stagedAppSettings = { ...originalAppSettings };
    const stagedPrivacySettings = {
      mediaEmbeds: originalPrivacySettings.mediaEmbeds === true
    };

    const visibilityRows = `
      ${mapSettingsEnabled ? `
        <div class="fts-settings-row">
          <div>
            <div class="fts-settings-row-title">Hide scenes with no public access</div>
          </div>
          ${toggleButton(stagedAppSettings.hideNoAccessScenes, "Toggle hiding scenes with no public access", "hideNoAccessScenes")}
        </div>
      ` : ""}

      ${homepagePosterOverlaysEnabled ? `
        <div class="fts-settings-row">
          <div>
            <div class="fts-settings-row-title">Hide homepage tags</div>
          </div>
          ${toggleButton(stagedAppSettings.hideHomepageTags, "Toggle hiding homepage tags", "hideHomepageTags")}
        </div>
      ` : ""}
    `;

    const overlay = document.createElement("div");
    overlay.className = "fts-settings-overlay";
    overlay.innerHTML = `
      <div class="fts-settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="fts-settings-header">
          <div>
            <h2 class="fts-settings-title">Settings</h2>
            <p class="fts-settings-intro">Control display preferences and privacy options for Find That Scene.</p>
          </div>
          <button class="fts-settings-close" type="button" aria-label="Close settings">×</button>
        </div>

        <div class="fts-settings-body">
          ${visibilityRows.trim() ? `
            <section class="fts-settings-section">
              <h3 class="fts-settings-section-title">Visibility</h3>
              ${visibilityRows}
            </section>
          ` : ""}

          <section class="fts-settings-section">
            <h3 class="fts-settings-section-title">Privacy</h3>
            <p class="fts-privacy-copy">
              Find That Scene uses privacy-friendly analytics and optional media embeds.
              You can control optional media features here at any time.
            </p>
            <div class="fts-settings-row">
              <div>
                <div class="fts-settings-row-title">Media embeds</div>
                <div class="fts-settings-row-copy">Allows YouTube trailers and future embedded media content.</div>
              </div>
              ${toggleButton(stagedPrivacySettings.mediaEmbeds, "Toggle media embeds", "mediaEmbeds")}
            </div>
            <a class="fts-settings-link" href="${getRootPath()}privacy/">Read the privacy page</a>
          </section>
        </div>

        <div class="fts-settings-actions">
          <button class="fts-settings-cancel" type="button">Cancel</button>
          <button class="fts-settings-save" type="button">Save settings</button>
        </div>
        <div class="fts-settings-version">${getVersionLabel()}</div>
      </div>
    `;

    const close = () => overlay.remove();

    overlay.querySelector(".fts-settings-close")?.addEventListener("click", close);
    overlay.querySelector(".fts-settings-cancel")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    overlay.querySelector('[data-setting-toggle="hideNoAccessScenes"]')?.addEventListener("click", (event) => {
      stagedAppSettings.hideNoAccessScenes = !stagedAppSettings.hideNoAccessScenes;
      syncToggle(event.currentTarget, stagedAppSettings.hideNoAccessScenes);
    });

    overlay.querySelector('[data-setting-toggle="hideHomepageTags"]')?.addEventListener("click", (event) => {
      stagedAppSettings.hideHomepageTags = !stagedAppSettings.hideHomepageTags;
      syncToggle(event.currentTarget, stagedAppSettings.hideHomepageTags);
    });

    overlay.querySelector('[data-setting-toggle="mediaEmbeds"]')?.addEventListener("click", (event) => {
      stagedPrivacySettings.mediaEmbeds = !stagedPrivacySettings.mediaEmbeds;
      syncToggle(event.currentTarget, stagedPrivacySettings.mediaEmbeds);
    });

    overlay.querySelector(".fts-settings-save")?.addEventListener("click", () => {
      const privacyChanged = originalPrivacySettings.mediaEmbeds !== stagedPrivacySettings.mediaEmbeds;

      saveAllSettings(stagedAppSettings, stagedPrivacySettings, {
        privacyChanged
      });
    });

    document.body.appendChild(overlay);
  }

  return {
    getSettings,
    setSetting,
    open
  };
})();
