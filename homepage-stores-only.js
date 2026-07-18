'use strict';

(() => {
  if (typeof renderHome !== 'function') return;

  const originalRenderHome = renderHome;

  function installProductsNearYouStyles() {
    if (document.getElementById('qkProductsNearYouStyles')) return;
    const style = document.createElement('style');
    style.id = 'qkProductsNearYouStyles';
    style.textContent = `
      .products-near-head {
        align-items: flex-end;
      }

      .products-near-count {
        color: #6b7a72;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .products-near-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        width: 100%;
        padding: 1px 0 14px;
      }

      .nearby-product-card {
        display: flex;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        overflow: hidden;
      }

      .nearby-product-card .best-product-image {
        width: 100%;
        height: 118px;
        flex: 0 0 auto;
      }

      .nearby-product-card .best-product-image img {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .nearby-product-card > strong,
      .nearby-product-card > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nearby-product-store {
        color: #15935f !important;
        font-weight: 700;
      }

      .nearby-product-card .best-product-foot {
        margin-top: auto;
        padding-top: 9px;
      }

      @media (max-width: 340px) {
        .products-near-grid {
          gap: 9px;
        }

        .nearby-product-card {
          padding: 9px;
        }

        .nearby-product-card .best-product-image {
          height: 96px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function currentProducts() {
    if (typeof state === 'undefined' || !Array.isArray(products) || !Array.isArray(stores)) return [];

    const searchQuery = String(state.search || '').trim().toLowerCase();
    return products
      .filter((product) => {
        const store = stores.find((item) => item.id === product.storeId);
        const categoryMatches = state.activeCategory === 'all' || store?.category === state.activeCategory;
        const searchMatches = !searchQuery
          || `${product.name} ${product.unit} ${product.brand} ${product.category} ${store?.name || ''}`
            .toLowerCase()
            .includes(searchQuery);
        return Boolean(store) && categoryMatches && searchMatches;
      })
      .sort((first, second) => {
        const firstStore = stores.find((item) => item.id === first.storeId)?.name || '';
        const secondStore = stores.find((item) => item.id === second.storeId)?.name || '';
        return firstStore.localeCompare(secondStore) || String(first.name).localeCompare(String(second.name));
      });
  }

  function productMarkup(product) {
    const store = stores.find((item) => item.id === product.storeId);
    const storeName = store?.name || 'MyQK Store';
    return `
      <article class="best-product-card nearby-product-card">
        <button class="best-product-image" type="button" data-store="${product.storeId}" aria-label="Open ${escapeHtml(storeName)}">
          <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
        </button>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml([product.brand, product.unit].filter(Boolean).join(' · ') || product.unit || '')}</span>
        <span class="nearby-product-store">${escapeHtml(storeName)}</span>
        <div class="best-product-foot">
          <b>${money(product.price)}</b>
          <button type="button" data-add="${product.key}" aria-label="Add ${escapeHtml(product.name)}">+</button>
        </div>
      </article>`;
  }

  function renderProductsNearYou() {
    const section = document.querySelector('#appMain .products-section');
    if (!section) return;

    const list = currentProducts();
    section.innerHTML = `
      <div class="home-section-head products-near-head">
        <h2>Products near you</h2>
        <span class="products-near-count">${list.length} available</span>
      </div>
      <div class="products-near-grid">
        ${list.length ? list.map(productMarkup).join('') : '<p class="home-no-result">No matching products found.</p>'}
      </div>`;
  }

  renderHome = function renderHomepageWithAllProducts() {
    installProductsNearYouStyles();
    const result = originalRenderHome();
    renderProductsNearYou();
    return result;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installProductsNearYouStyles();
      renderProductsNearYou();
    }, { once: true });
  } else {
    installProductsNearYouStyles();
    renderProductsNearYou();
  }
})();
