'use strict';

(() => {
  if (typeof renderHome !== 'function') return;

  const originalRenderHome = renderHome;

  function removeHomepageProducts() {
    document.querySelector('#appMain .products-section')?.remove();
  }

  renderHome = function renderStoresOnlyHomepage() {
    const result = originalRenderHome();
    removeHomepageProducts();
    return result;
  };

  document.addEventListener('DOMContentLoaded', removeHomepageProducts);
})();
