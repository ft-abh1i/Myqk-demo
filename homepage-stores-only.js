'use strict';

(() => {
  if (typeof renderHome !== 'function') return;

  const originalRenderHome = renderHome;

  const groceryKitchenMarkup = `
    <section class="home-section grocery-kitchen-section" aria-labelledby="groceryKitchenTitle">
      <div class="home-section-head">
        <h2 id="groceryKitchenTitle">Grocery &amp; Kitchen</h2>
      </div>
    </section>`;

  function removeHomepageProducts() {
    document.querySelector('#appMain .products-section')?.remove();
  }

  function addGroceryKitchenSection() {
    const homeView = document.querySelector('#appMain .home-view');
    if (!homeView || homeView.querySelector('.grocery-kitchen-section')) return;

    const storeSection = [...homeView.querySelectorAll('.home-section')].find((section) => (
      section.querySelector('.home-section-head h2')?.textContent.trim() === 'Available Stores'
    ));

    if (!storeSection) return;
    storeSection.insertAdjacentHTML('afterend', groceryKitchenMarkup);
  }

  function updateStoresOnlyHomepage() {
    removeHomepageProducts();
    addGroceryKitchenSection();
  }

  renderHome = function renderStoresOnlyHomepage() {
    const result = originalRenderHome();
    updateStoresOnlyHomepage();
    return result;
  };

  document.addEventListener('DOMContentLoaded', updateStoresOnlyHomepage);
})();