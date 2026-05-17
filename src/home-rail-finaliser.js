window.FTS = window.FTS || {};

FTS.HomeRailFinaliser = (function () {
  let timer = null;

  function norm(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function railTitle(rail) {
    return norm(rail?.querySelector?.(".rail-title")?.textContent);
  }

  function moveSpecialRails() {
    const root = document.getElementById("railsRoot");
    if (!root) return;

    const rails = Array.from(root.querySelectorAll(":scope > .rail"));
    if (!rails.length) return;

    const peopleRail = rails.find((rail) => rail.classList.contains("rail-people"));
    const gamesRail = rails.find((rail) => railTitle(rail) === "games");

    if (peopleRail) root.appendChild(peopleRail);
    if (gamesRail) root.appendChild(gamesRail);
  }

  function refreshDrag() {
    window.FTS?.HomeRails?.makeRailsDraggable?.();
  }

  function finalise() {
    moveSpecialRails();
    refreshDrag();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(finalise, 350);
  }

  function init() {
    const root = document.getElementById("railsRoot");
    if (!root) return;

    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true });
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { finalise, schedule };
})();
