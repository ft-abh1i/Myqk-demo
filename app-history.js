'use strict';

(() => {
  const APP_STATE_KEY = 'qkAppState';
  let restoring = false;

  function snapshot(extra = {}) {
    return {
      [APP_STATE_KEY]: true,
      tab: state.activeTab || 'darkstore',
      storeId: state.activeStoreId || null,
      category: state.activeCategory || 'all',
      search: state.search || '',
      overlay: null,
      ...extra
    };
  }

  function pushCurrent(extra = {}) {
    if (restoring) return;
    history.pushState(snapshot(extra), '', location.href);
  }

  function closeOverlays() {
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.getElementById('locationSheet')?.classList.remove('show');
    document.getElementById('qkMapPicker')?.classList.remove('open');
    document.body.classList.remove('qk-map-picker-open');
  }

  function restorePage(saved) {
    restoring = true;
    closeOverlays();

    state.activeTab = saved.tab || 'darkstore';
    state.activeStoreId = saved.storeId || null;
    state.activeCategory = saved.category || 'all';
    state.search = saved.search || '';

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = state.search;

    renderCategories();
    switchTab(state.activeTab);

    if (state.activeTab === 'darkstore') {
      renderMain();
    }

    if (saved.overlay === 'cart') {
      openCart();
    } else if (saved.overlay === 'location') {
      openLocationSheet();
    }

    restoring = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const initial = snapshot();
    history.replaceState(initial, '', location.href);
    history.pushState(initial, '', location.href);

    document.addEventListener('click', (event) => {
      const storeBack = event.target.closest('#storeBack');
      const cartClose = event.target.closest('#cartClose');
      const locationClose = event.target.closest('#locationClose');

      if (storeBack || cartClose || locationClose) {
        event.preventDefault();
        event.stopImmediatePropagation();
        history.back();
        return;
      }

      const tab = event.target.closest('[data-tab]');
      const store = event.target.closest('[data-store]');
      const cart = event.target.closest('#cartBtn');
      const location = event.target.closest('#locationBtn');

      setTimeout(() => {
        if (tab || store) pushCurrent();
        else if (cart) pushCurrent({ overlay: 'cart' });
        else if (location) pushCurrent({ overlay: 'location' });
      }, 0);
    }, true);

    window.addEventListener('popstate', (event) => {
      const saved = event.state;
      if (!saved || !saved[APP_STATE_KEY]) {
        const root = snapshot({ tab: 'darkstore', storeId: null, overlay: null });
        history.pushState(root, '', location.href);
        restorePage(root);
        return;
      }

      restorePage(saved);

      if (saved.tab === 'darkstore' && !saved.storeId && !saved.overlay) {
        history.pushState(saved, '', location.href);
      }
    });
  });
})();

(() => {
  function loadLocationMapPicker() {
    if (!document.querySelector('link[href^="location-map-picker.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'location-map-picker.css?v=20260719-google-map-picker-1';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[src^="location-map-picker.js"]')) {
      const script = document.createElement('script');
      script.src = 'location-map-picker.js?v=20260719-google-map-picker-1';
      script.async = true;
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLocationMapPicker, { once: true });
  } else {
    loadLocationMapPicker();
  }
})();
