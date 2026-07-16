'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const elements = {
    appHeader: $('appHeader'),
    locationBtn: $('locationBtn'),
    locationAddress: $('locationAddress'),
    cartBtn: $('cartBtn'),
    cartBadge: $('cartBadge'),
    searchWrap: $('searchWrap'),
    searchInput: $('searchInput'),
    searchClear: $('searchClear'),
    categoryNav: $('categoryNav'),
    appMain: $('appMain'),
    bottomNav: $('bottomNav'),
    toast: $('toast'),
    cartOverlay: $('cartOverlay'),
    cartClose: $('cartClose'),
    cartBody: $('cartBody'),
    cartFooter: $('cartFooter'),
    cartTotal: $('cartTotal'),
    checkoutBtn: $('checkoutBtn'),
    locationSheet: $('locationSheet'),
    locationClose: $('locationClose'),
    allowLocationBtn: $('allowLocationBtn'),
    detectedLocationBox: $('detectedLocationBox'),
    detectedLocationText: $('detectedLocationText'),
    manualAddressBox: $('manualAddressBox'),
    houseInput: $('houseInput'),
    streetInput: $('streetInput'),
    saveAddressBtn: $('saveAddressBtn'),
    locationStatus: $('locationStatus')
  };

  const required = Object.entries(elements).filter(([, value]) => !value);
  if (required.length) {
    console.error('QK initialization failed. Missing elements:', required.map(([key]) => key));
    return;
  }

  const categories = [
    ['all', 'All Stores'],
    ['medical', 'Medical & Pharmacy'],
    ['grocery', 'Grocery'],
    ['vegetables', 'Vegetables'],
    ['fruits', 'Fruits'],
    ['snacks', 'Snacks'],
    ['dairy', 'Dairy'],
    ['beverages', 'Beverages']
  ].map(([id, label]) => ({ id, label }));

  const stores = [
    {
      id: 'fresh-basket', name: 'Fresh Basket', icon: '🧺', time: '12 mins', rating: 4.6,
      desc: 'Fresh fruits, dairy and daily essentials', tags: ['grocery', 'fruits', 'dairy'],
      products: [
        ['p1', 'Apples', '1 kg', 180, 210, '🍎'],
        ['p2', 'Bananas', '6 pcs', 48, null, '🍌'],
        ['p3', 'Milk', '500 ml', 32, null, '🥛'],
        ['p4', 'Bread', '400 g', 45, 55, '🍞'],
        ['p5', 'Eggs', '6 pcs', 54, null, '🥚']
      ]
    },
    {
      id: 'city-mart', name: 'City Mart', icon: '🏬', time: '18 mins', rating: 4.3,
      desc: 'Groceries, snacks and beverages', tags: ['grocery', 'snacks', 'beverages'],
      products: [
        ['p6', 'Basmati Rice', '1 kg', 98, 120, '🍚'],
        ['p7', 'Potato Chips', '52 g', 20, null, '🥔'],
        ['p8', 'Cold Drink', '750 ml', 40, 45, '🥤'],
        ['p9', 'Cooking Oil', '1 L', 145, 160, '🫙'],
        ['p10', 'Green Tea', '25 bags', 99, null, '🍵']
      ]
    },
    {
      id: 'green-grocery', name: 'Green Grocery', icon: '🥬', time: '15 mins', rating: 4.5,
      desc: 'Farm-fresh vegetables sourced daily', tags: ['vegetables', 'grocery'],
      products: [
        ['p11', 'Tomatoes', '1 kg', 38, null, '🍅'],
        ['p12', 'Potato', '1 kg', 28, null, '🥔'],
        ['p13', 'Onion', '1 kg', 34, 40, '🧅'],
        ['p14', 'Spinach', '250 g', 22, null, '🥬']
      ]
    }
  ];

  stores.forEach((store) => {
    store.products = store.products.map(([id, name, unit, price, mrp, icon]) => ({ id, name, unit, price, mrp, icon }));
  });

  const state = {
    activeCategory: 'all',
    activeStoreId: null,
    activeTab: 'darkstore',
    searchQuery: '',
    quantities: {},
    cart: {}
  };

  const navTabs = [
    ['darkstore', 'Dark Store', '<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>'],
    ['orders', 'Orders', '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>'],
    ['track', 'Track', '<svg viewBox="0 0 24 24"><path d="M12 22s7-7.58 7-13A7 7 0 1 0 5 9c0 5.42 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>'],
    ['profile', 'Profile', '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5"/></svg>']
  ].map(([id, label, icon]) => ({ id, label, icon }));

  let toastTimer = null;
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 1800);
  }

  function renderCategories() {
    elements.categoryNav.innerHTML = categories.map((category) => `
      <button class="chip ${category.id === state.activeCategory ? 'active' : ''}" data-category="${category.id}" type="button">${category.label}</button>
    `).join('');

    elements.categoryNav.querySelectorAll('[data-category]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeCategory = button.dataset.category;
        state.activeStoreId = null;
        renderCategories();
        renderMain();
      });
    });
  }

  function renderMain() {
    if (state.searchQuery.trim()) {
      renderSearchResults();
    } else if (state.activeStoreId) {
      renderProductView();
    } else {
      renderStoreList();
    }
  }

  function renderStoreList() {
    const filtered = state.activeCategory === 'all'
      ? stores
      : stores.filter((store) => store.tags.includes(state.activeCategory));

    if (!filtered.length) {
      elements.appMain.innerHTML = emptyState('🗺️', 'No stores here yet', 'We are adding more stores in this category.');
      return;
    }

    elements.appMain.innerHTML = `
      <div class="view">
        <h2 class="section-title">Stores near you</h2>
        <div class="store-list">
          ${filtered.map(storeCard).join('')}
        </div>
      </div>
    `;

    bindStoreCards();
  }

  function storeCard(store) {
    return `
      <button class="store-card" data-store="${store.id}" type="button">
        <span class="store-thumb">${store.icon}</span>
        <span class="store-info">
          <span class="store-name">${store.name}</span>
          <span class="store-desc">${store.desc}</span>
          <span class="store-meta">
            <span class="store-time">${store.time}</span>
            <span class="store-rating">★ ${store.rating.toFixed(1)}</span>
          </span>
        </span>
      </button>
    `;
  }

  function bindStoreCards() {
    elements.appMain.querySelectorAll('[data-store]').forEach((card) => {
      card.addEventListener('click', () => {
        state.activeStoreId = card.dataset.store;
        renderMain();
      });
    });
  }

  function renderProductView() {
    const store = stores.find((item) => item.id === state.activeStoreId);
    if (!store) {
      state.activeStoreId = null;
      renderMain();
      return;
    }

    elements.appMain.innerHTML = `
      <div class="view">
        <div class="store-banner">
          <button class="round-back" id="storeBack" type="button" aria-label="Back to stores">
            <svg viewBox="0 0 24 24"><path d="m15 19-7-7 7-7"/></svg>
          </button>
          <div class="banner-icon">${store.icon}</div>
          <div>
            <div class="banner-name">${store.name}</div>
            <div class="banner-meta">${store.time} · ★ ${store.rating.toFixed(1)}</div>
          </div>
        </div>
        <div class="product-list">${store.products.map((product) => productCard(product)).join('')}</div>
      </div>
    `;

    $('storeBack').addEventListener('click', () => {
      state.activeStoreId = null;
      renderMain();
    });

    elements.appMain.querySelectorAll('.product-card').forEach((card) => bindProductCard(card, store));
  }

  function productCard(product, storeName = '') {
    const quantity = state.quantities[product.id] || 1;
    return `
      <article class="product-card" data-product="${product.id}">
        <div class="product-thumb">${product.icon}</div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-unit">${product.unit}</div>
          <div class="product-price">₹${product.price}${product.mrp ? `<span class="strike">₹${product.mrp}</span>` : ''}</div>
          ${storeName ? `<span class="product-store-tag">${storeName}</span>` : ''}
        </div>
        <div class="product-actions">
          <div class="stepper">
            <button class="quantity-minus" type="button" aria-label="Decrease quantity">−</button>
            <span class="qty">${quantity}</span>
            <button class="quantity-plus" type="button" aria-label="Increase quantity">+</button>
          </div>
          <div class="action-row">
            <button class="action-btn add-btn" type="button">Add</button>
            <button class="action-btn buy-btn" type="button">Buy Now</button>
          </div>
        </div>
      </article>
    `;
  }

  function bindProductCard(card, store) {
    const product = store.products.find((item) => item.id === card.dataset.product);
    if (!product) return;
    const quantityText = card.querySelector('.qty');

    card.querySelector('.quantity-minus').addEventListener('click', () => {
      state.quantities[product.id] = Math.max(1, (state.quantities[product.id] || 1) - 1);
      quantityText.textContent = state.quantities[product.id];
    });

    card.querySelector('.quantity-plus').addEventListener('click', () => {
      state.quantities[product.id] = Math.min(20, (state.quantities[product.id] || 1) + 1);
      quantityText.textContent = state.quantities[product.id];
    });

    card.querySelector('.add-btn').addEventListener('click', () => {
      const quantity = state.quantities[product.id] || 1;
      addToCart(product, store, quantity);
      showToast(`Added ${quantity} × ${product.name}`);
      state.quantities[product.id] = 1;
      quantityText.textContent = '1';
    });

    card.querySelector('.buy-btn').addEventListener('click', () => {
      const quantity = state.quantities[product.id] || 1;
      addToCart(product, store, quantity);
      state.quantities[product.id] = 1;
      quantityText.textContent = '1';
      openCart();
    });
  }

  function renderSearchResults() {
    const query = state.searchQuery.trim().toLowerCase();
    const matchedStores = stores.filter((store) => `${store.name} ${store.desc}`.toLowerCase().includes(query));
    const matchedProducts = [];

    stores.forEach((store) => {
      store.products.forEach((product) => {
        if (product.name.toLowerCase().includes(query)) matchedProducts.push({ store, product });
      });
    });

    if (!matchedStores.length && !matchedProducts.length) {
      elements.appMain.innerHTML = emptyState('🔍', `No results for “${escapeHtml(state.searchQuery)}”`, 'Try a different product or store name.');
      return;
    }

    elements.appMain.innerHTML = `
      <div class="view">
        ${matchedStores.length ? `<h2 class="section-title">Stores</h2><div class="store-list">${matchedStores.map(storeCard).join('')}</div>` : ''}
        ${matchedProducts.length ? `<h2 class="section-title" style="margin-top:20px">Products</h2><div class="product-list">${matchedProducts.map(({ store, product }) => productCard(product, store.name)).join('')}</div>` : ''}
      </div>
    `;

    bindStoreCards();
    elements.appMain.querySelectorAll('.product-card').forEach((card) => {
      const match = matchedProducts.find(({ product }) => product.id === card.dataset.product);
      if (match) bindProductCard(card, match.store);
    });
  }

  function emptyState(icon, title, description) {
    return `<div class="view empty-state"><div class="emoji">${icon}</div><div class="title">${title}</div><div class="sub">${description}</div></div>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function clearSearch() {
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.searchClear.classList.remove('show');
    elements.categoryNav.style.display = state.activeTab === 'darkstore' ? '' : 'none';
  }

  function addToCart(product, store, quantity) {
    if (state.cart[product.id]) {
      state.cart[product.id].quantity = Math.min(20, state.cart[product.id].quantity + quantity);
    } else {
      state.cart[product.id] = { product, store, quantity };
    }
    updateCartBadge();
  }

  function cartQuantity() {
    return Object.values(state.cart).reduce((total, item) => total + item.quantity, 0);
  }

  function cartPrice() {
    return Object.values(state.cart).reduce((total, item) => total + item.product.price * item.quantity, 0);
  }

  function updateCartBadge() {
    const count = cartQuantity();
    elements.cartBadge.textContent = count;
    elements.cartBadge.classList.toggle('show', count > 0);
  }

  function openCart() {
    renderCart();
    elements.cartOverlay.classList.add('open');
  }

  function closeCart() {
    elements.cartOverlay.classList.remove('open');
  }

  function renderCart() {
    const items = Object.values(state.cart);
    elements.cartFooter.style.display = items.length ? '' : 'none';

    if (!items.length) {
      elements.cartBody.innerHTML = emptyState('🛒', 'Your cart is empty', 'Add products from a store to see them here.');
      return;
    }

    elements.cartBody.innerHTML = `<div class="product-list">${items.map(({ product, store, quantity }) => `
      <article class="product-card" data-cart-product="${product.id}">
        <div class="product-thumb">${product.icon}</div>
        <div class="product-info">
          <div class="product-name">${product.name}</div>
          <div class="product-unit">${product.unit}</div>
          <span class="product-store-tag">${store.name}</span>
          <div class="product-price">₹${product.price * quantity}</div>
        </div>
        <div class="product-actions">
          <div class="stepper">
            <button class="cart-minus" type="button" aria-label="Decrease quantity">−</button>
            <span class="qty">${quantity}</span>
            <button class="cart-plus" type="button" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </article>
    `).join('')}</div>`;

    elements.cartBody.querySelectorAll('[data-cart-product]').forEach((card) => {
      const id = card.dataset.cartProduct;
      card.querySelector('.cart-minus').addEventListener('click', () => {
        state.cart[id].quantity -= 1;
        if (state.cart[id].quantity <= 0) delete state.cart[id];
        updateCartBadge();
        renderCart();
      });
      card.querySelector('.cart-plus').addEventListener('click', () => {
        state.cart[id].quantity = Math.min(20, state.cart[id].quantity + 1);
        updateCartBadge();
        renderCart();
      });
    });

    elements.cartTotal.textContent = `₹${cartPrice()}`;
  }

  function renderBottomNav() {
    elements.bottomNav.innerHTML = navTabs.map((tab) => `
      <button class="nav-item ${state.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}" type="button">
        ${tab.icon}<span class="nav-label">${tab.label}</span><span class="nav-dot"></span>
      </button>
    `).join('');

    elements.bottomNav.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.tab;
        renderBottomNav();
        renderTab();
      });
    });
  }

  function renderTab() {
    if (state.activeTab === 'darkstore') {
      elements.searchWrap.style.display = '';
      elements.categoryNav.style.display = state.searchQuery.trim() ? 'none' : '';
      renderMain();
      return;
    }

    elements.searchWrap.style.display = 'none';
    elements.categoryNav.style.display = 'none';

    if (state.activeTab === 'profile') {
      renderProfile();
      return;
    }

    const content = {
      orders: ['🧾', 'No orders yet', 'Your order history will appear here after checkout.'],
      track: ['📍', 'Nothing to track', 'Live order tracking will appear after you place an order.']
    }[state.activeTab];

    elements.appMain.innerHTML = emptyState(...content);
  }

  function renderProfile() {
    elements.appMain.innerHTML = `
      <div class="view">
        <div class="profile-card">
          <div class="profile-avatar">🧑</div>
          <div class="profile-info">
            <div class="profile-name">Guest User</div>
            <div class="profile-phone">Sign in to sync your account</div>
          </div>
          <button class="profile-edit" type="button">Edit</button>
        </div>
        <div class="profile-menu">
          ${[
            ['🧾', 'My Orders'],
            ['📍', 'Saved Addresses'],
            ['💳', 'Payment Methods'],
            ['🔔', 'Notifications'],
            ['❓', 'Help & Support']
          ].map(([icon, label]) => `<button class="profile-menu-item" type="button"><span>${icon}</span><span class="profile-menu-label">${label}</span><span>›</span></button>`).join('')}
        </div>
        <button class="profile-logout" type="button">Log Out</button>
      </div>
    `;

    elements.appMain.querySelectorAll('.profile-menu-item, .profile-edit, .profile-logout').forEach((button) => {
      button.addEventListener('click', () => showToast('Coming soon'));
    });
  }

  const locationKeys = {
    full: 'qkLiveLocation',
    base: 'qkDetectedLocation',
    latitude: 'qkLatitude',
    longitude: 'qkLongitude',
    house: 'qkHouse',
    street: 'qkStreet'
  };

  let baseLocation = '';
  let isDetecting = false;

  function cleanAddress(parts) {
    const seen = new Set();
    return parts
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6)
      .join(', ');
  }

  function formatNominatimAddress(data) {
    const address = data.address || {};
    return cleanAddress([
      address.neighbourhood || address.suburb || address.residential,
      address.road,
      address.city_district || address.county,
      address.city || address.town || address.village,
      address.state_district,
      address.postcode
    ]) || data.display_name || '';
  }

  function formatBigDataAddress(data) {
    return cleanAddress([data.locality, data.city, data.principalSubdivision, data.postcode]);
  }

  async function reverseGeocode(latitude, longitude) {
    localStorage.setItem(locationKeys.latitude, String(latitude));
    localStorage.setItem(locationKeys.longitude, String(longitude));

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}&accept-language=en`);
      if (response.ok) {
        const address = formatNominatimAddress(await response.json());
        if (address) return address;
      }
    } catch (error) {
      console.warn('Primary reverse geocoder failed:', error);
    }

    try {
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
      if (response.ok) {
        const address = formatBigDataAddress(await response.json());
        if (address) return address;
      }
    } catch (error) {
      console.warn('Backup reverse geocoder failed:', error);
    }

    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  function setHeaderLocation(address) {
    elements.locationAddress.textContent = address;
    localStorage.setItem(locationKeys.full, address);
  }

  function showDetectedLocation(address) {
    elements.detectedLocationText.textContent = address;
    elements.detectedLocationBox.classList.remove('hidden');
  }

  function openLocationSheet() {
    elements.locationStatus.style.color = 'var(--soft)';
    elements.locationSheet.classList.add('show');
    document.body.classList.add('locked');

    if (baseLocation) {
      elements.allowLocationBtn.classList.add('hidden');
      showDetectedLocation(baseLocation);
      elements.manualAddressBox.classList.remove('hidden');
      elements.locationStatus.textContent = 'Location detected. Add house/flat/floor and street/area.';
    } else {
      elements.allowLocationBtn.classList.remove('hidden');
      elements.detectedLocationBox.classList.add('hidden');
      elements.manualAddressBox.classList.add('hidden');
      elements.locationStatus.textContent = 'Tap Give location access to detect your area.';
    }
  }

  function closeLocationSheet() {
    elements.locationSheet.classList.remove('show');
    document.body.classList.remove('locked');
  }

  async function detectLocation() {
    if (isDetecting) return;
    if (!navigator.geolocation) {
      elements.locationStatus.style.color = 'var(--accent)';
      elements.locationStatus.textContent = 'Location is not supported on this device.';
      return;
    }

    isDetecting = true;
    elements.locationStatus.style.color = 'var(--soft)';
    elements.locationStatus.textContent = 'Detecting your location...';
    elements.allowLocationBtn.textContent = 'Detecting…';
    elements.allowLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          baseLocation = await reverseGeocode(position.coords.latitude, position.coords.longitude);
          localStorage.setItem(locationKeys.base, baseLocation);
          setHeaderLocation(baseLocation);
          showDetectedLocation(baseLocation);
          elements.allowLocationBtn.classList.add('hidden');
          elements.manualAddressBox.classList.remove('hidden');
          elements.locationStatus.style.color = 'var(--soft)';
          elements.locationStatus.textContent = 'Location detected. Add house/flat/floor and street/area.';
        } catch (error) {
          console.error('Location processing failed:', error);
          elements.locationStatus.style.color = 'var(--accent)';
          elements.locationStatus.textContent = 'Could not process your location. Please try again.';
        } finally {
          isDetecting = false;
          elements.allowLocationBtn.disabled = false;
          elements.allowLocationBtn.textContent = 'Give location access';
        }
      },
      () => {
        isDetecting = false;
        elements.allowLocationBtn.disabled = false;
        elements.allowLocationBtn.textContent = 'Give location access';
        elements.locationStatus.style.color = 'var(--accent)';
        elements.locationStatus.textContent = 'Location permission is required. Allow access and try again.';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function saveAddress() {
    const house = elements.houseInput.value.trim();
    const street = elements.streetInput.value.trim();

    if (!house && !street) {
      elements.locationStatus.style.color = 'var(--accent)';
      elements.locationStatus.textContent = 'Please add house/flat or street/area.';
      return;
    }

    localStorage.setItem(locationKeys.house, house);
    localStorage.setItem(locationKeys.street, street);
    const fullAddress = cleanAddress([house, street, baseLocation]);
    setHeaderLocation(fullAddress);
    elements.locationStatus.style.color = 'var(--primary)';
    elements.locationStatus.textContent = 'Exact address saved.';
    window.setTimeout(closeLocationSheet, 450);
  }

  elements.appMain.addEventListener('scroll', () => {
    elements.appHeader.classList.toggle('scrolled', elements.appMain.scrollTop > 4);
  });

  elements.searchInput.addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    elements.searchClear.classList.toggle('show', Boolean(state.searchQuery));
    elements.categoryNav.style.display = state.searchQuery.trim() ? 'none' : '';
    renderMain();
  });

  elements.searchClear.addEventListener('click', () => {
    clearSearch();
    renderMain();
  });

  elements.cartBtn.addEventListener('click', openCart);
  elements.cartClose.addEventListener('click', closeCart);
  elements.checkoutBtn.addEventListener('click', () => {
    showToast('Order placed! Demo checkout complete.');
    state.cart = {};
    updateCartBadge();
    closeCart();
  });

  elements.locationBtn.addEventListener('click', openLocationSheet);
  elements.locationClose.addEventListener('click', closeLocationSheet);
  elements.locationSheet.addEventListener('click', (event) => {
    if (event.target === elements.locationSheet) closeLocationSheet();
  });
  elements.allowLocationBtn.addEventListener('click', detectLocation);
  elements.saveAddressBtn.addEventListener('click', saveAddress);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (elements.locationSheet.classList.contains('show')) closeLocationSheet();
      if (elements.cartOverlay.classList.contains('open')) closeCart();
    }
  });

  const savedFullLocation = localStorage.getItem(locationKeys.full);
  const savedBaseLocation = localStorage.getItem(locationKeys.base);
  if (savedFullLocation) {
    baseLocation = savedBaseLocation || savedFullLocation;
    setHeaderLocation(savedFullLocation);
  } else {
    window.setTimeout(openLocationSheet, 450);
  }

  elements.houseInput.value = localStorage.getItem(locationKeys.house) || '';
  elements.streetInput.value = localStorage.getItem(locationKeys.street) || '';

  renderCategories();
  renderBottomNav();
  renderTab();
});
