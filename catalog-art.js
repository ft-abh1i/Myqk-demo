'use strict';

(() => {
  const PRODUCT_IMAGES = Object.freeze({
    p1: 'https://images.unsplash.com/photo-1630563451961-ac2ff27616ab?auto=format&fit=crop&w=520&h=520&q=80',
    p2: 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=520&h=520&q=80',
    p3: 'https://images.unsplash.com/photo-1634141510639-d691d86f47be?auto=format&fit=crop&w=520&h=520&q=80',
    p4: 'https://images.unsplash.com/photo-1534620808146-d33bb39128b2?auto=format&fit=crop&w=520&h=520&q=80',
    p5: 'https://images.unsplash.com/photo-1639194335563-d56b83f0060c?auto=format&fit=crop&w=520&h=520&q=80',
    p6: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=520&h=520&q=80',
    p7: 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?auto=format&fit=crop&w=520&h=520&q=80',
    p8: 'https://images.unsplash.com/photo-1648569883125-d01072540b4c?auto=format&fit=crop&w=520&h=520&q=80',
    p9: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=520&h=520&q=80',
    p10: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=520&h=520&q=80',
    p11: 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=520&h=520&q=80',
    p12: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=520&h=520&q=80',
    p13: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=520&h=520&q=80',
    p14: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=520&h=520&q=80'
  });

  const STORE_IMAGES = Object.freeze({
    'fresh-basket': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&h=620&q=82',
    'city-mart': 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&h=620&q=82',
    'green-grocery': 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=900&h=620&q=82'
  });

  const STORE_BY_NAME = Object.freeze({
    'Fresh Basket': 'fresh-basket',
    'City Mart': 'city-mart',
    'Green Grocery': 'green-grocery'
  });

  const STORE_BY_PRODUCT = Object.freeze({
    p1: 'fresh-basket', p2: 'fresh-basket', p3: 'fresh-basket', p4: 'fresh-basket', p5: 'fresh-basket',
    p6: 'city-mart', p7: 'city-mart', p8: 'city-mart', p9: 'city-mart', p10: 'city-mart',
    p11: 'green-grocery', p12: 'green-grocery', p13: 'green-grocery', p14: 'green-grocery'
  });

  const ALL_IMAGES = Object.freeze([
    ...new Set([...Object.values(STORE_IMAGES), ...Object.values(PRODUCT_IMAGES)])
  ]);

  const FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="36" fill="#eef5f0"/>
      <path d="M92 119h136l-12 106H104L92 119Z" fill="#d7e9dd"/>
      <path d="M126 119c0-24 14-40 34-40s34 16 34 40" fill="none" stroke="#1f7a4d" stroke-width="12" stroke-linecap="round"/>
      <text x="160" y="181" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#1f7a4d">QK</text>
    </svg>`);

  const preloadCache = new Map();

  function preloadImage(src) {
    if (preloadCache.has(src)) return preloadCache.get(src);

    const request = new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'high';
      image.onload = () => resolve({ src, loaded: true });
      image.onerror = () => resolve({ src, loaded: false });
      image.src = src;
    });

    preloadCache.set(src, request);
    return request;
  }

  function preloadAllImages() {
    return Promise.all(ALL_IMAGES.map(preloadImage));
  }

  function imageElement(src, alt, mode) {
    const image = document.createElement('img');
    image.alt = alt;
    image.loading = 'eager';
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.draggable = false;
    image.className = `catalog-photo catalog-photo-${mode}`;
    image.addEventListener('load', () => image.classList.add('loaded'), { once: true });
    image.addEventListener('error', () => {
      if (image.src !== FALLBACK_IMAGE) image.src = FALLBACK_IMAGE;
    }, { once: true });
    image.src = src || FALLBACK_IMAGE;
    return image;
  }

  function enhanceProducts() {
    document.querySelectorAll('.product-card').forEach((card) => {
      const productId = card.dataset.product || card.dataset.cartProduct;
      const thumb = card.querySelector('.product-thumb');
      if (!productId || !thumb || thumb.dataset.catalogEnhanced === 'true') return;

      const productName = card.querySelector('.product-name')?.textContent?.trim() || 'Product';
      thumb.replaceChildren(imageElement(PRODUCT_IMAGES[productId], productName, 'product'));
      thumb.dataset.catalogEnhanced = 'true';
      thumb.classList.add('catalog-image-ready');
    });
  }

  function enhanceStoreCards() {
    document.querySelectorAll('.store-card').forEach((card) => {
      const storeId = card.dataset.store;
      const thumb = card.querySelector('.store-thumb');
      if (!storeId || !thumb || thumb.dataset.catalogEnhanced === 'true') return;

      const storeName = card.querySelector('.store-name')?.textContent?.trim() || 'Store';
      thumb.replaceChildren(imageElement(STORE_IMAGES[storeId], storeName, 'store'));
      thumb.dataset.catalogEnhanced = 'true';
      thumb.classList.add('catalog-image-ready');
    });
  }

  function enhanceStoreBanner() {
    const icon = document.querySelector('.banner-icon');
    if (!icon || icon.dataset.catalogEnhanced === 'true') return;

    const visibleName = document.querySelector('.banner-name')?.textContent?.trim() || '';
    let storeId = STORE_BY_NAME[visibleName];

    if (!storeId) {
      const firstProduct = document.querySelector('.product-card[data-product]');
      storeId = firstProduct ? STORE_BY_PRODUCT[firstProduct.dataset.product] : null;
    }

    if (!storeId) return;
    icon.replaceChildren(imageElement(STORE_IMAGES[storeId], visibleName || 'Store', 'banner'));
    icon.dataset.catalogEnhanced = 'true';
    icon.classList.add('catalog-image-ready');
  }

  function enhanceAll() {
    enhanceStoreCards();
    enhanceProducts();
    enhanceStoreBanner();
  }

  let refreshQueued = false;
  function queueEnhance() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      enhanceAll();
    });
  }

  function initialize() {
    const ready = preloadAllImages();
    enhanceAll();

    const observer = new MutationObserver(queueEnhance);
    const main = document.getElementById('appMain');
    const cart = document.getElementById('cartBody');

    if (main) observer.observe(main, { childList: true, subtree: true });
    if (cart) observer.observe(cart, { childList: true, subtree: true });

    window.QKCatalogArt = Object.freeze({
      refresh: queueEnhance,
      preload: preloadAllImages,
      ready
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();