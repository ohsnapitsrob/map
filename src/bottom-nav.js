(function () {
  function getRootPath() {
    if (document.body.dataset.navRoot) return document.body.dataset.navRoot;

    const path = window.location.pathname.replace(/\/+$/, "");

    const nestedRoutes = [
      "/browse",
      "/explore",
      "/title",
      "/stats",
      "/national-trust",
      "/privacy",
      "/metadata",
      "/person"
    ];

    if (nestedRoutes.some((route) => path.endsWith(route))) {
      return "../";
    }

    return "./";
  }

  const rootPath = getRootPath();

  const items = [
    {
      key: "home",
      label: "Home",
      href: rootPath,
      icon: "home"
    },
    {
      key: "browse",
      label: "Browse",
      href: `${rootPath}browse/`,
      icon: "browse"
    },
    {
      key: "map",
      label: "Map",
      href: `${rootPath}explore/`,
      icon: "map"
    }
  ];

  function getActiveKey() {
    const path = window.location.pathname.replace(/\/+$/, "");

    if (path.endsWith("/privacy")) return null;
    if (path.endsWith("/browse")) return "browse";
    if (path.endsWith("/explore")) return "map";
    if (
      path.endsWith("/title") ||
      path.endsWith("/stats") ||
      path.endsWith("/national-trust") ||
      path.endsWith("/metadata") ||
      path.endsWith("/person")
    ) return "browse";

    return "home";
  }

  function iconSvg(icon) {
    const icons = {
      home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.4 12 4l9 7.4v8.1A1.5 1.5 0 0 1 19.5 21h-4.2v-5.7H8.7V21H4.5A1.5 1.5 0 0 1 3 19.5v-8.1z"></path></svg>`,
      browse: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3zm10 0A1.5 1.5 0 0 1 15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3zM4 15.5A1.5 1.5 0 0 1 5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3zm10 0a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3z"></path></svg>`,
      map: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5A6.5 6.5 0 0 0 5.5 9c0 4.9 6.5 12.5 6.5 12.5S18.5 13.9 18.5 9A6.5 6.5 0 0 0 12 2.5zm0 9.1A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"></path></svg>`
    };

    return icons[icon] || "";
  }

  function addStyle() {
    if (document.getElementById("fts-bottom-nav-style")) return;

    const style = document.createElement("style");
    style.id = "fts-bottom-nav-style";
    style.textContent = `...`;

    document.head.appendChild(style);
  }

  function render() {
    if (document.querySelector(".fts-bottom-nav")) return;

    const activeKey = getActiveKey();
    const nav = document.createElement("nav");

    nav.className = "fts-bottom-nav";
    nav.setAttribute("aria-label", "Primary navigation");
    nav.innerHTML = items.map((item) => {
      const active = activeKey && item.key === activeKey;

      return `
        <a href="${item.href}"${active ? ' aria-current="page"' : ""}>
          ${iconSvg(item.icon)}
          <span>${item.label}</span>
        </a>
      `;
    }).join("");

    document.body.classList.add("fts-has-bottom-nav");
    document.body.appendChild(nav);
  }

  addStyle();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();