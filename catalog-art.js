'use strict';

(() => {
  const PRODUCT_BY_ID = Object.freeze({
    p1: 'apples',
    p2: 'bananas',
    p3: 'milk',
    p4: 'bread',
    p5: 'eggs',
    p6: 'rice',
    p7: 'chips',
    p8: 'soda',
    p9: 'oil',
    p10: 'tea',
    p11: 'tomatoes',
    p12: 'potato',
    p13: 'onion',
    p14: 'spinach'
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

  const imageCache = new Map();

  function dataUri(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)
      .replace(/%0A/g, '')
      .replace(/%20/g, ' ')}`;
  }

  function productPalette(key) {
    const palettes = {
      apples: ['#fff7f7', '#ffe9e9'],
      bananas: ['#fffdf2', '#fff3bc'],
      milk: ['#f4f9ff', '#e7f2ff'],
      bread: ['#fff9f1', '#f9ead6'],
      eggs: ['#fffdf6', '#f4ead2'],
      rice: ['#f7fff8', '#e8f5ec'],
      chips: ['#fff7f1', '#ffe6d5'],
      soda: ['#fff5f5', '#f6e3e3'],
      oil: ['#fffaf0', '#ffedbd'],
      tea: ['#f3fff7', '#dff6e8'],
      tomatoes: ['#fff6f5', '#ffe5e1'],
      potato: ['#fffaf3', '#f3e5cf'],
      onion: ['#fff7fb', '#f3e5f0'],
      spinach: ['#f4fff7', '#daf3e1']
    };
    return palettes[key] || ['#f7faf8', '#edf3ef'];
  }

  function productInner(key) {
    const art = {
      apples: `
        <g>
          <circle cx="82" cy="128" r="39" fill="#e6443c"/>
          <circle cx="137" cy="118" r="43" fill="#f15a4f"/>
          <circle cx="166" cy="151" r="34" fill="#d93531"/>
          <path d="M133 77c2-15 10-24 22-29" stroke="#65412b" stroke-width="8" stroke-linecap="round"/>
          <path d="M146 61c17-11 31-8 39 3-17 7-31 5-39-3Z" fill="#3e9a54"/>
          <ellipse cx="69" cy="113" rx="10" ry="17" fill="#ff9188" opacity=".62"/>
          <ellipse cx="123" cy="101" rx="11" ry="18" fill="#ffaaa2" opacity=".58"/>
          <ellipse cx="155" cy="139" rx="8" ry="13" fill="#ff8a82" opacity=".45"/>
        </g>`,
      bananas: `
        <g fill="none" stroke-linecap="round">
          <path d="M55 91c24 75 88 98 139 47" stroke="#f5c92f" stroke-width="29"/>
          <path d="M64 75c18 68 72 92 119 58" stroke="#ffd94b" stroke-width="27"/>
          <path d="M78 63c15 56 57 79 98 50" stroke="#ffe46a" stroke-width="24"/>
          <path d="M52 84l8-12M188 137l10-6M74 60l5-12M176 112l8-8" stroke="#7a5a1b" stroke-width="8"/>
          <path d="M80 65c11 32 34 53 64 60" stroke="#fff4a6" stroke-width="5" opacity=".75"/>
        </g>`,
      milk: `
        <g>
          <path d="M79 61h76l24 33v95H69V94Z" fill="#ffffff" stroke="#b9d5ed" stroke-width="4"/>
          <path d="M79 61h76l24 33H92Z" fill="#d8ebfb"/>
          <path d="M92 94h87v30H69V94Z" fill="#2f80ed"/>
          <rect x="86" y="132" width="76" height="40" rx="12" fill="#eaf4ff"/>
          <text x="124" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#1d5fae">QK MILK</text>
          <text x="124" y="166" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#5f7d96">FRESH • 500 ML</text>
          <path d="M91 69h55" stroke="#8cb9dd" stroke-width="5" stroke-linecap="round"/>
          <path d="M156 69l20 28" stroke="#8cb9dd" stroke-width="5" stroke-linecap="round"/>
        </g>`,
      bread: `
        <g>
          <rect x="53" y="72" width="134" height="121" rx="36" fill="#f7d49c" stroke="#d7a66a" stroke-width="4"/>
          <path d="M60 107c20-24 38-35 60-35 26 0 44 10 61 34v25H60Z" fill="#e7b96f"/>
          <path d="M87 79c-3 16 3 29 16 39M121 73c-2 17 5 31 19 42M153 80c-1 14 4 25 15 35" fill="none" stroke="#fff0cf" stroke-width="8" stroke-linecap="round"/>
          <rect x="70" y="143" width="100" height="30" rx="15" fill="#fff7e8" opacity=".9"/>
          <text x="120" y="163" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#9b6d34">FRESH BREAD</text>
        </g>`,
      eggs: `
        <g>
          <path d="M50 133h140l-12 57H62Z" fill="#caa66b" stroke="#a5814d" stroke-width="4"/>
          <path d="M50 133l18-31h104l18 31Z" fill="#e6c99b" stroke="#b89257" stroke-width="4"/>
          <g fill="#fffaf0" stroke="#d8c5a4" stroke-width="3">
            <ellipse cx="77" cy="116" rx="18" ry="25"/>
            <ellipse cx="119" cy="111" rx="18" ry="26"/>
            <ellipse cx="161" cy="116" rx="18" ry="25"/>
            <ellipse cx="91" cy="154" rx="18" ry="24"/>
            <ellipse cx="135" cy="154" rx="18" ry="24"/>
          </g>
          <path d="M68 184h104" stroke="#987443" stroke-width="5" stroke-linecap="round"/>
        </g>`,
      rice: `
        <g>
          <path d="M69 58h102l17 132H52Z" fill="#ffffff" stroke="#c9ddd0" stroke-width="4"/>
          <path d="M69 58h102l5 37H64Z" fill="#23945c"/>
          <rect x="72" y="106" width="96" height="57" rx="18" fill="#e8f5ec"/>
          <text x="120" y="130" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#17663e">BASMATI</text>
          <text x="120" y="149" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#4e7a60">PREMIUM RICE</text>
          <g fill="#d7b76a">
            <ellipse cx="78" cy="177" rx="3" ry="8" transform="rotate(-28 78 177)"/>
            <ellipse cx="96" cy="181" rx="3" ry="8" transform="rotate(20 96 181)"/>
            <ellipse cx="115" cy="175" rx="3" ry="8" transform="rotate(-8 115 175)"/>
            <ellipse cx="135" cy="181" rx="3" ry="8" transform="rotate(24 135 181)"/>
            <ellipse cx="155" cy="176" rx="3" ry="8" transform="rotate(-20 155 176)"/>
          </g>
        </g>`,
      chips: `
        <g>
          <path d="M75 50h90l18 143H57Z" fill="#f06232" stroke="#c94623" stroke-width="4"/>
          <path d="M75 50h90l4 31H71Z" fill="#ffd466"/>
          <path d="M64 166h112l7 27H57Z" fill="#d84c28"/>
          <circle cx="120" cy="119" r="39" fill="#fff5dd"/>
          <g fill="#f1c85f" stroke="#d49e35" stroke-width="2">
            <ellipse cx="104" cy="111" rx="19" ry="11" transform="rotate(-25 104 111)"/>
            <ellipse cx="133" cy="126" rx="20" ry="12" transform="rotate(19 133 126)"/>
            <ellipse cx="130" cy="99" rx="17" ry="10" transform="rotate(-8 130 99)"/>
          </g>
          <text x="120" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#8e2d19">CRUNCH</text>
        </g>`,
      soda: `
        <g>
          <rect x="104" y="44" width="32" height="23" rx="7" fill="#c92525"/>
          <path d="M100 63h40l7 28c3 11 10 21 10 36v61c0 10-8 18-18 18H101c-10 0-18-8-18-18v-61c0-15 7-25 10-36Z" fill="#382019" stroke="#22110d" stroke-width="4"/>
          <path d="M91 121h58v45H91Z" fill="#e43c36"/>
          <path d="M95 126c18 11 34 9 50 0v35c-17-10-34-10-50 0Z" fill="#f0524c"/>
          <text x="120" y="151" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#ffffff">QK COLA</text>
          <path d="M107 73h26" stroke="#72584f" stroke-width="5" stroke-linecap="round"/>
          <path d="M101 92c-4 15-9 23-9 39" stroke="#6f5047" stroke-width="5" stroke-linecap="round"/>
        </g>`,
      oil: `
        <g>
          <rect x="103" y="42" width="34" height="24" rx="7" fill="#e36e22"/>
          <path d="M96 62h48l10 32v92c0 11-9 20-20 20h-28c-11 0-20-9-20-20V94Z" fill="#f6b938" stroke="#d98e17" stroke-width="4"/>
          <path d="M94 103h52v66H94Z" fill="#fff4cd"/>
          <path d="M111 128c17-20 37-16 42 4-17 2-31 1-42-4Z" fill="#f1a51d"/>
          <text x="120" y="153" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="900" fill="#8b5a10">PURE OIL</text>
          <path d="M104 72h32" stroke="#ffe39a" stroke-width="5" stroke-linecap="round"/>
        </g>`,
      tea: `
        <g>
          <rect x="60" y="62" width="120" height="132" rx="14" fill="#2c8b54" stroke="#17663e" stroke-width="4"/>
          <rect x="72" y="78" width="96" height="44" rx="12" fill="#ecf8ef"/>
          <text x="120" y="101" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#17663e">GREEN TEA</text>
          <path d="M90 158c24-41 56-43 69-10-25 10-48 14-69 10Z" fill="#b7e3bd"/>
          <path d="M103 166c8-30 25-45 48-49" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
          <circle cx="83" cy="146" r="14" fill="#f5df9f"/>
          <path d="M80 139c8 0 12 4 14 10" fill="none" stroke="#8d6c2d" stroke-width="3" stroke-linecap="round"/>
        </g>`,
      tomatoes: `
        <g>
          <circle cx="83" cy="137" r="40" fill="#ef493f"/>
          <circle cx="139" cy="119" r="44" fill="#f45b4f"/>
          <circle cx="164" cy="157" r="31" fill="#d93632"/>
          <g fill="#30924d">
            <path d="M65 100l18 11 17-13-5 20 17 10-22 1-8 20-6-20-21-3 16-9Z"/>
            <path d="M118 78l21 13 19-15-5 23 19 12-24 1-9 22-7-22-24-4 19-11Z"/>
            <path d="M149 130l16 9 13-12-3 18 15 8-18 2-6 17-6-17-18-3 14-8Z"/>
          </g>
          <ellipse cx="126" cy="103" rx="11" ry="17" fill="#ffaaa3" opacity=".55"/>
        </g>`,
      potato: `
        <g fill="#bd8655" stroke="#98683f" stroke-width="3">
          <ellipse cx="91" cy="133" rx="48" ry="39" transform="rotate(-15 91 133)"/>
          <ellipse cx="151" cy="119" rx="43" ry="36" transform="rotate(17 151 119)"/>
          <ellipse cx="139" cy="163" rx="39" ry="31" transform="rotate(-7 139 163)"/>
        </g>
        <g fill="#7f5638">
          <circle cx="70" cy="123" r="4"/><circle cx="103" cy="145" r="4"/><circle cx="84" cy="154" r="3"/>
          <circle cx="140" cy="101" r="4"/><circle cx="167" cy="128" r="3"/><circle cx="143" cy="151" r="4"/>
        </g>
        <path d="M63 111c16-14 33-17 49-10" fill="none" stroke="#d8a474" stroke-width="7" stroke-linecap="round" opacity=".7"/>`,
      onion: `
        <g>
          <path d="M78 187c-33-26-36-70-8-101 18-20 34-31 43-48 8 19 28 32 43 52 25 34 17 76-15 99-18 13-44 12-63-2Z" fill="#c784a8" stroke="#9d5c82" stroke-width="4"/>
          <path d="M117 45c-5 12-4 25 1 36M105 49c-13 14-15 27-8 39M130 51c10 13 13 27 7 40" fill="none" stroke="#6d8c4a" stroke-width="5" stroke-linecap="round"/>
          <path d="M93 98c-22 31-18 61 10 83M119 87c-15 40-9 73 13 98M143 99c8 34 3 62-15 83" fill="none" stroke="#edc4da" stroke-width="5" stroke-linecap="round" opacity=".8"/>
        </g>`,
      spinach: `
        <g>
          <path d="M120 190c0-58 0-92 1-130" fill="none" stroke="#337c49" stroke-width="8" stroke-linecap="round"/>
          <path d="M119 130c-39-11-58-35-56-66 37 4 57 26 56 66Z" fill="#45a85f" stroke="#2f8048" stroke-width="3"/>
          <path d="M122 111c39-10 60-34 60-67-39 4-60 27-60 67Z" fill="#5bbb6f" stroke="#358b4d" stroke-width="3"/>
          <path d="M119 166c-34-7-55-27-59-56 34-1 56 17 59 56Z" fill="#69c979" stroke="#3d9655" stroke-width="3"/>
          <path d="M122 151c34-5 56-25 61-54-35-2-58 16-61 54Z" fill="#319a52" stroke="#24783e" stroke-width="3"/>
          <path d="M84 77c20 12 30 27 35 46M159 61c-18 14-29 28-37 46M78 119c18 9 31 23 40 41M164 106c-18 10-31 23-41 39" fill="none" stroke="#d6f0dc" stroke-width="3" stroke-linecap="round" opacity=".78"/>
        </g>`
    };
    return art[key] || art.rice;
  }

  function productImage(key) {
    const cacheKey = `product:${key}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

    const [start, end] = productPalette(key);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${start}"/>
            <stop offset="1" stop-color="${end}"/>
          </linearGradient>
          <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#16351f" flood-opacity=".16"/>
          </filter>
        </defs>
        <rect width="240" height="240" rx="34" fill="url(#bg)"/>
        <ellipse cx="120" cy="199" rx="74" ry="13" fill="#173821" opacity=".1"/>
        <g filter="url(#shadow)">${productInner(key)}</g>
      </svg>`;

    const uri = dataUri(svg);
    imageCache.set(cacheKey, uri);
    return uri;
  }

  function storeConfig(key) {
    const stores = {
      'fresh-basket': { name: 'Fresh Basket', primary: '#1f7a4d', secondary: '#f2c94c', wall: '#f0f4eb', sky: '#dff2e6' },
      'city-mart': { name: 'City Mart', primary: '#2463a9', secondary: '#ff6b4a', wall: '#eef2f7', sky: '#e1edfb' },
      'green-grocery': { name: 'Green Grocery', primary: '#267246', secondary: '#80c35b', wall: '#edf5e9', sky: '#dcf0df' }
    };
    return stores[key] || stores['fresh-basket'];
  }

  function storeImage(key) {
    const cacheKey = `store:${key}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

    const config = storeConfig(key);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" role="img">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${config.sky}"/>
            <stop offset="1" stop-color="#ffffff"/>
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#d8eef5"/>
            <stop offset="1" stop-color="#87b4c4"/>
          </linearGradient>
          <filter id="storeShadow" x="-20%" y="-30%" width="140%" height="170%">
            <feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#183326" flood-opacity=".18"/>
          </filter>
        </defs>
        <rect width="360" height="240" rx="28" fill="url(#sky)"/>
        <circle cx="308" cy="40" r="24" fill="#ffffff" opacity=".7"/>
        <path d="M0 200h360v40H0Z" fill="#dbe2db"/>
        <path d="M0 205h360" stroke="#c2ccc4" stroke-width="4"/>
        <g filter="url(#storeShadow)">
          <rect x="42" y="54" width="276" height="151" rx="12" fill="${config.wall}" stroke="#d1dad2" stroke-width="4"/>
          <rect x="64" y="72" width="232" height="42" rx="8" fill="${config.primary}"/>
          <text x="180" y="99" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="900" fill="#ffffff">${config.name}</text>
          <path d="M56 115h248l-10 34H66Z" fill="${config.secondary}"/>
          <path d="M56 115h248" stroke="#ffffff" stroke-width="5" opacity=".65"/>
          <path d="M82 115l-4 34M112 115l-3 34M142 115l-1 34M172 115v34M202 115l1 34M232 115l3 34M262 115l4 34" stroke="#ffffff" stroke-width="12" opacity=".85"/>
          <rect x="63" y="146" width="234" height="55" rx="5" fill="url(#glass)"/>
          <rect x="159" y="146" width="43" height="55" fill="#ffffff" opacity=".72"/>
          <path d="M180 146v55M63 174h234" stroke="#ffffff" stroke-width="4" opacity=".72"/>
          <g>
            <rect x="52" y="178" width="54" height="28" rx="5" fill="#9b6a38"/>
            <rect x="254" y="178" width="54" height="28" rx="5" fill="#9b6a38"/>
            <circle cx="66" cy="178" r="9" fill="#e54e43"/>
            <circle cx="83" cy="177" r="10" fill="#f2c84b"/>
            <circle cx="97" cy="181" r="8" fill="#58a85e"/>
            <circle cx="268" cy="180" r="9" fill="#7ab95b"/>
            <circle cx="284" cy="177" r="10" fill="#e75c42"/>
            <circle cx="299" cy="181" r="8" fill="#f0c34b"/>
          </g>
          <rect x="138" y="122" width="84" height="18" rx="9" fill="#ffffff"/>
          <text x="180" y="135" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="900" fill="${config.primary}">QK DELIVERY PARTNER</text>
        </g>
      </svg>`;

    const uri = dataUri(svg);
    imageCache.set(cacheKey, uri);
    return uri;
  }

  function imageElement(src, alt, kind) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.className = `catalog-${kind}-image`;
    image.addEventListener('load', () => image.classList.add('loaded'), { once: true });
    if (image.complete) image.classList.add('loaded');
    return image;
  }

  function enhanceStoreCards() {
    document.querySelectorAll('.store-card[data-store]').forEach((card) => {
      const thumb = card.querySelector('.store-thumb');
      if (!thumb || thumb.dataset.catalogEnhanced === 'true') return;

      const storeId = card.dataset.store;
      const name = card.querySelector('.store-name')?.textContent.trim() || 'Store';
      thumb.replaceChildren(imageElement(storeImage(storeId), name, 'store'));
      thumb.dataset.catalogEnhanced = 'true';
      thumb.classList.add('catalog-image-ready');
    });
  }

  function enhanceProducts() {
    document.querySelectorAll('.product-card').forEach((card) => {
      const id = card.dataset.product || card.dataset.cartProduct;
      const key = PRODUCT_BY_ID[id];
      const thumb = card.querySelector('.product-thumb');
      if (!key || !thumb || thumb.dataset.catalogEnhanced === 'true') return;

      const name = card.querySelector('.product-name')?.textContent.trim() || 'Product';
      thumb.replaceChildren(imageElement(productImage(key), name, 'product'));
      thumb.dataset.catalogEnhanced = 'true';
      thumb.classList.add('catalog-image-ready');
    });
  }

  function enhanceStoreBanner() {
    const banner = document.querySelector('.store-banner');
    const icon = banner?.querySelector('.banner-icon');
    if (!banner || !icon || icon.dataset.catalogEnhanced === 'true') return;

    const visibleName = banner.querySelector('.banner-name')?.textContent.trim() || '';
    let storeId = STORE_BY_NAME[visibleName];

    if (!storeId) {
      const firstProduct = document.querySelector('.product-card[data-product]');
      storeId = firstProduct ? STORE_BY_PRODUCT[firstProduct.dataset.product] : null;
    }

    if (!storeId) return;
    icon.replaceChildren(imageElement(storeImage(storeId), visibleName || 'Store', 'banner'));
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
    enhanceAll();

    const observer = new MutationObserver(queueEnhance);
    const main = document.getElementById('appMain');
    const cart = document.getElementById('cartBody');

    if (main) observer.observe(main, { childList: true, subtree: true });
    if (cart) observer.observe(cart, { childList: true, subtree: true });

    window.QKCatalogArt = Object.freeze({
      refresh: queueEnhance,
      productImage,
      storeImage
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();