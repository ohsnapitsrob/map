window.FTS = window.FTS || {};

FTS.Routes = (function () {
  const nestedRoutes = [
    "/browse",
    "/explore",
    "/title",
    "/stats",
    "/national-trust",
    "/privacy",
    "/metadata",
    "/person",
    "/genre"
  ];

  function path() {
    return window.location.pathname.replace(/\/+$/, "");
  }

  function isNestedRoute() {
    const currentPath = path();
    return nestedRoutes.some((route) => currentPath.endsWith(route));
  }

  function getRootPath() {
    if (document.body?.dataset?.navRoot) return document.body.dataset.navRoot;
    return isNestedRoute() ? "../" : "./";
  }

  return {
    nestedRoutes,
    path,
    isNestedRoute,
    getRootPath
  };
})();
