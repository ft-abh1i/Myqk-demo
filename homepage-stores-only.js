'use strict';

(() => {
  const hiddenHomepageHeadings = new Set([
    'Available Stores',
    'Available Products',
    'Products Near You',
    'Grocery & Kitchen'
  ]);

  function removeHiddenHomepageSections() {
    const homeView = document.querySelector('#appMain .home-view');
    if (!homeView) return;

    homeView.querySelectorAll(':scope > .home-section').forEach((section) => {
      const heading = section.querySelector('.home-section-head h2')?.textContent.trim();
      if (hiddenHomepageHeadings.has(heading)) section.remove();
    });
  }

  if (typeof renderHome === 'function') {
    const originalRenderHome = renderHome;

    renderHome = function renderCategoriesOnlyHomepage(...args) {
      const result = originalRenderHome.apply(this, args);
      removeHiddenHomepageSections();
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    removeHiddenHomepageSections();

    const appMain = document.querySelector('#appMain');
    if (!appMain) return;

    new MutationObserver(removeHiddenHomepageSections).observe(appMain, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });
})();
