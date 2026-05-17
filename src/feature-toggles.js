window.FTS = window.FTS || {};

FTS.FeatureToggles = {
  headerLogoEnabled: true,
  easterEggsEnabled: true,
  iosInstallPromptEnabled: false,
  privacyConsentEnabled: true,
  mediaEmbedsEnabled: true,
  plausibleAnalyticsEnabled: true,
  siteDisclaimerEnabled: false,
  settingsMapSectionEnabled: true,

  homeRailsEnabled: true,
  homeRailLatestScenesEnabled: true,
  homeRailTopScenesEnabled: true,
  homeRailTopTenStyleEnabled: false,
  homepagePosterOverlays: true,
  homeRailJamesBondEnabled: true,
  homeRailHarryPotterEnabled: true,
  homeRailMoviesEnabled: false,
  homeRailTVEnabled: false,
  homeRailMusicVideosEnabled: true,
  homeRailNationalTrustEnabled: true,
  homeRailPeopleEnabled: true,
  homeRailGamesEnabled: true,
  homeGenreRailsEnabled: true
};

FTS.Features = (function () {
  function isEnabled(key) {
    const toggles = window.FTS?.FeatureToggles || {};

    if (!Object.prototype.hasOwnProperty.call(toggles, key)) {
      return true;
    }

    return toggles[key] === true;
  }

  return {
    isEnabled
  };
})();
