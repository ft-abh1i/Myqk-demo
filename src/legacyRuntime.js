const legacyScripts = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  '/app-preloader.js?v=20260718-loader-88-5',
  '/real-customer-app.js?v=20260718-preload',
  '/homepage-stores-only.js?v=20260718-atta-rice-dal-1',
  '/catalog-ready-bridge.js?v=20260718',
  '/customer-checkout.js',
  '/profile.js',
  '/profile-layout.js',
  '/support.js',
  '/secondary-pages.js?v=20260719-order-detail-header-1',
  '/i18n.js',
  '/catalog-art.js',
  '/orders-page.js?v=20260719-orders-5',
  '/track-page.js?v=20260719-track-4',
  '/customer-mvp-hardening.js?v=20260719-checkout-gate-1',
  '/live-order-banner-controls.js?v=20260718-compact-dismiss',
  '/customer-order-system.js?v=20260719-checkout-gate-1',
  '/footer-nav-fix.js?v=20260721-ios-keyboard-1',
  '/app-history.js',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const selectorValue = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(src) : src.replace(/"/g, '\\"');
    const existing = document.querySelector(`script[data-qk-legacy="${selectorValue}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else existing.addEventListener('load', resolve, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.qkLegacy = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

export function startLegacyRuntime() {
  if (window.__QK_LEGACY_RUNTIME_PROMISE__) return window.__QK_LEGACY_RUNTIME_PROMISE__;

  window.__QK_REACT_APP__ = true;
  window.__QK_LEGACY_RUNTIME_PROMISE__ = legacyScripts.reduce(
    (chain, src) => chain.then(() => loadScript(src)),
    Promise.resolve(),
  ).then(() => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    window.dispatchEvent(new CustomEvent('qk:react-ready'));
  }).catch((error) => {
    console.error('MyQK compatibility runtime failed to start:', error);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'App could not finish loading. Please refresh.';
      toast.classList.add('show', 'error');
    }
    throw error;
  });

  return window.__QK_LEGACY_RUNTIME_PROMISE__;
}
