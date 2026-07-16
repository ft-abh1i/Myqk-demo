'use strict';

(() => {
  const ACTIVE_CLASS = 'profile-tab-active';

  function isProfileTabActive() {
    return Boolean(document.querySelector('#bottomNav [data-tab="profile"].active'));
  }

  function syncProfileLayout() {
    const active = isProfileTabActive();
    document.body.classList.toggle(ACTIVE_CLASS, active);

    if (active) {
      const main = document.getElementById('appMain');
      if (main) main.scrollTop = 0;
    }
  }

  function initialize() {
    const bottomNav = document.getElementById('bottomNav');
    const appMain = document.getElementById('appMain');

    document.addEventListener('click', (event) => {
      if (event.target.closest('#bottomNav [data-tab]')) {
        window.requestAnimationFrame(syncProfileLayout);
      }
    }, true);

    const observer = new MutationObserver(syncProfileLayout);
    if (bottomNav) observer.observe(bottomNav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (appMain) observer.observe(appMain, { childList: true });

    syncProfileLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
