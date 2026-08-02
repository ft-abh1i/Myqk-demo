'use strict';

const $ = (id) => document.getElementById(id);

const FIREBASE_VERSION = '10.12.5';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdE40-NJlErzD-w1y7TaIKMI_0wEXSOsg',
  authDomain: 'buyqk-app.firebaseapp.com',
  projectId: 'buyqk-app',
  storageBucket: 'buyqk-app.firebasestorage.app',
  messagingSenderId: '330615637805',
  appId: '1:330615637805:web:44851732ea01d6be6335a4'
};

const navTabs = [
  ['darkstore', 'Store', '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9 21v-6h6v6"/></svg>'],
  ['orders', 'Orders', '<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'],
  ['track', 'Track', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'],
  ['profile', 'Profile', '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.2-6.3 7.5-6.3s6.8 2.1 7.5 6.3"/></svg>']
];

const categories = [
  ['all', 'All Stores', '', 'https://i.ibb.co/ksPGNTh1/file-00000000e5e47207b913f9b20e24648a.png'],
  ['groceries', 'Grocery', '', 'https://i.ibb.co/DPM7XHp1/file-000000002e407207b364dac899ed1521.png'],
  ['pharmacy', 'Pharmacy', '', 'https://i.ibb.co/LXzpZ7wM/file-00000000142071fa904cffc2ac9358b3.png'],
  ['beauty', 'Beauty', '', 'https://i.ibb.co/Q7kN67Gz/file-000000001c7071fa83e0b592537c937c.png'],
  ['kids', 'Kids', '', 'https://i.ibb.co/WWGpBHDk/file-00000000d90471fa96565410954cb120.png'],
  ['electronics', 'Electronics', '', 'https://i.ibb.co/9Hg19qZp/file-0000000049ec71fab3f2e2e7de8d5ac0.png']
];

const stores = [];
const products = [];
const productListeners = new Map();

const state = {
  activeTab: 'darkstore',
  activeCategory: 'all',
  activeStoreId: null,
  search: '',
  cart: {},
  user: null,
  orders: [],
  catalogLoading: true,
  placingOrder: false,
  unsubscribeStores: null,
  unsubscribeOrders: null
};

let auth = null;
let db = null;

function money(value) {
  return `₹${Math.round(Number(value) || 0)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function toast(message, error = false) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  element.classList.toggle('error', error);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show', 'error'), 2600);
}

function empty(icon, title, subtitle) {
  return `<div class="view empty-state"><div class="emoji">${icon}</div><div class="title">${escapeHtml(title)}</div><div class="sub">${escapeHtml(subtitle)}</div></div>`;
}

function initials(value = 'QK') {
  return String(value).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'QK';
}

function placeholderImage(label, kind = 'store') {
  const background = kind === 'store' ? '#f8cb46' : '#f3f4f6';
  const foreground = '#111827';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" rx="28" fill="${background}"/><text x="160" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-size="62" font-weight="700" fill="${foreground}">${escapeHtml(initials(label))}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalizeCategory(value = '') {
  const category = String(value).toLowerCase();
  if (category.includes('grocery') || category.includes('fruit') || category.includes('vegetable') || category.includes('dairy') || category.includes('bakery')) return 'groceries';
  if (category.includes('medical') || category.includes('pharmacy')) return 'pharmacy';
  if (category.includes('beauty') || category.includes('cosmetic')) return 'beauty';
  if (category.includes('kid') || category.includes('baby')) return 'kids';
  if (category.includes('electronic')) return 'electronics';
  return 'all';
}

function timestampValue(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return Number(value) || 0;
}

function storeAddress(store) {
  return store?.address?.fullAddress || store?.address || '';
}

function statusLabel(status) {
  return ({
    pending_merchant: 'Waiting for store',
    merchant_accepted: 'Accepted by store',
    preparing: 'Preparing your order',
    ready_for_pickup: 'Ready for pickup',
    accepted: 'Rider assigned',
    arrived_pickup: 'Rider at store',
    picked_up: 'Out for delivery',
    completed: 'Delivered',
    merchant_rejected: 'Rejected by store',
    cancelled: 'Cancelled'
  })[status] || status || 'Processing';
}

function statusProgress(status) {
  return ({
    pending_merchant: 10,
    merchant_accepted: 25,
    preparing: 40,
    ready_for_pickup: 55,
    accepted: 70,
    arrived_pickup: 78,
    picked_up: 88,
    completed: 100,
    merchant_rejected: 100,
    cancelled: 100
  })[status] || 5;
}

function categoryMarkup() {
  return `<div class="home-category-strip" id="categoryNav">${categories.map(([id, label, icon, image], index) => `
    <button class="home-category ${state.activeCategory === id ? 'active' : ''} category-${index + 1}" data-category="${id}" type="button">
      <span class="home-category-icon">${image ? `<img src="${image}" alt="" loading="lazy">` : icon}</span><span>${label}</span>
    </button>`).join('')}</div>`;
}

function renderHome() {
  const query = state.search.trim().toLowerCase();
  const visibleStores = stores.filter((store) => (
    (state.activeCategory === 'all' || store.category === state.activeCategory)
    && (!query || `${store.name} ${store.rawCategory} ${store.description}`.toLowerCase().includes(query))
  ));
  const visibleProducts = products.filter((product) => {
    const store = stores.find((item) => item.id === product.storeId);
    const categoryMatches = state.activeCategory === 'all' || store?.category === state.activeCategory;
    const searchMatches = !query || `${product.name} ${product.unit} ${product.brand} ${product.category}`.toLowerCase().includes(query);
    return categoryMatches && searchMatches;
  });

  if (state.catalogLoading && !stores.length) {
    $('appMain').innerHTML = `<div class="view home-view">${categoryMarkup()}${empty('…', 'Loading nearby stores', 'Connecting to MyQK merchants.')}</div>`;
    return;
  }

  if (!stores.length) {
    $('appMain').innerHTML = `<div class="view home-view">
      ${categoryMarkup()}
      ${empty('⌂', 'No stores available yet', 'Open merchant stores will appear here automatically.')}
    </div>`;
    return;
  }

  $('appMain').innerHTML = `<div class="view home-view">
    ${categoryMarkup()}
    <section class="home-section">
      <div class="home-section-head"><h2>Available Stores</h2><button type="button" data-view-all="stores">View all</button></div>
      <div class="featured-store-row">${visibleStores.map((store) => `
        <button class="featured-store-card" type="button" data-store="${store.id}">
          <img src="${store.image}" alt="${escapeHtml(store.name)}" loading="lazy">
          <div class="featured-store-info"><strong>${escapeHtml(store.name)}</strong><span class="store-clock">◷ ${escapeHtml(store.time)}</span><span class="free-delivery">Live inventory</span></div>
        </button>`).join('') || '<p class="home-no-result">No matching stores found.</p>'}</div>
    </section>
    <section class="home-section products-section">
      <div class="home-section-head"><h2>Available Products</h2><button type="button" data-view-all="products">View all</button></div>
      <div class="best-product-row">${visibleProducts.slice(0, 20).map((product) => `
        <article class="best-product-card">
          <button class="best-product-image" type="button" data-store="${product.storeId}"><img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy"></button>
          <strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.unit)}</span>
          <div class="best-product-foot"><b>${money(product.price)}</b><button type="button" data-add="${product.key}" aria-label="Add ${escapeHtml(product.name)}">+</button></div>
        </article>`).join('') || '<p class="home-no-result">No matching products found.</p>'}</div>
    </section>
  </div>`;
}

function renderStore() {
  const store = stores.find((item) => item.id === state.activeStoreId);
  if (!store) {
    state.activeStoreId = null;
    renderHome();
    return;
  }

  const query = state.search.trim().toLowerCase();
  const list = products.filter((product) => product.storeId === store.id && (
    !query || `${product.name} ${product.unit} ${product.brand} ${product.category}`.toLowerCase().includes(query)
  ));

  $('appMain').innerHTML = `<div class="view home-view">
    <section class="home-section">
      <div class="home-section-head">
        <div><button class="round-back" data-store-back type="button" aria-label="Back to stores">←</button><h2>${escapeHtml(store.name)}</h2></div>
        <span>${escapeHtml(store.time)}</span>
      </div>
      <p class="store-desc">${escapeHtml(storeAddress(store) || store.description || 'Local MyQK store')}</p>
      <div class="best-product-row">${list.map((product) => `
        <article class="best-product-card">
          <div class="best-product-image"><img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy"></div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml([product.brand, product.unit].filter(Boolean).join(' · '))}</span>
          <div class="best-product-foot"><b>${money(product.price)}</b><button type="button" data-add="${product.key}" aria-label="Add ${escapeHtml(product.name)}">+</button></div>
        </article>`).join('') || '<p class="home-no-result">This store has no available products.</p>'}</div>
    </section>
  </div>`;
}

function orderCard(order) {
  return `<article class="product-card" data-order-id="${order.id}">
    <div class="product-info">
      <div class="product-name">Order #${escapeHtml(order.orderNumber || order.id.slice(0, 6))}</div>
      <div class="product-unit">${escapeHtml(order.storeName || 'MyQK Store')} · ${escapeHtml(statusLabel(order.status))}</div>
      <div class="product-price">${money(order.totalAmount)} · ${Number(order.itemCount || order.items?.length || 0)} items</div>
    </div>
  </article>`;
}

function renderOrders() {
  if (!state.orders.length) {
    $('appMain').innerHTML = empty('▤', 'No orders yet', 'Your placed orders will appear here.');
    return;
  }

  $('appMain').innerHTML = `<div class="view">
    <div class="product-list">${state.orders.map(orderCard).join('')}</div>
  </div>`;
}

function activeOrder() {
  return state.orders.find((order) => !['completed', 'cancelled', 'merchant_rejected'].includes(order.status));
}

function renderTrack() {
  const order = activeOrder();
  if (!order) {
    $('appMain').innerHTML = empty('⌖', 'Nothing to track', 'Your current live order will appear here.');
    return;
  }

  const riderLocation = order.riderLocation;
  const riderText = order.assignedRiderName
    ? `${order.assignedRiderName} is handling your delivery.`
    : 'A rider will be assigned after the store marks the order ready.';

  $('appMain').innerHTML = `<div class="view">
    <article class="product-card">
      <div class="product-info">
        <div class="product-name">Order #${escapeHtml(order.orderNumber || order.id.slice(0, 6))}</div>
        <div class="product-unit">${escapeHtml(order.storeName || 'MyQK Store')}</div>
        <div class="product-price">${escapeHtml(statusLabel(order.status))}</div>
      </div>
    </article>
    <section class="bill-details-card" aria-label="Live order progress">
      <div class="checkout-section-head"><div><small>LIVE STATUS</small><strong>${escapeHtml(statusLabel(order.status))}</strong></div><span>${statusProgress(order.status)}%</span></div>
      <div style="height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden"><div style="width:${statusProgress(order.status)}%;height:100%;background:#111827"></div></div>
      <p class="checkout-hint">${escapeHtml(riderText)}</p>
      ${riderLocation ? `<button class="checkout-btn" type="button" data-open-rider-map="${Number(riderLocation.latitude)},${Number(riderLocation.longitude)}">Open rider location</button>` : ''}
    </section>
  </div>`;
}

function renderMain() {
  if (state.activeTab === 'darkstore') {
    if (state.activeStoreId) renderStore();
    else renderHome();
    return;
  }
  if (state.activeTab === 'orders') {
    renderOrders();
    return;
  }
  if (state.activeTab === 'track') {
    renderTrack();
    return;
  }
  $('appMain').innerHTML = empty('○', 'Customer profile', 'Add your delivery details and preferences.');
}

function renderCategories() {
  if (state.activeTab === 'darkstore') renderMain();
}

function renderSearch() {
  renderMain();
}

function updateBadge() {
  const count = Object.values(state.cart).reduce((sum, item) => sum + item.quantity, 0);
  $('cartBadge').textContent = count;
  $('cartBadge').classList.toggle('show', count > 0);
}

function addProduct(productKey) {
  const product = products.find((item) => item.key === productKey);
  if (!product) {
    toast('Product is no longer available.', true);
    return;
  }

  const existing = Object.values(state.cart);
  if (existing.length && existing[0].product.storeId !== product.storeId) {
    state.cart = {};
    toast('Previous store cart cleared. One store per order.');
  }

  if (!state.cart[productKey]) state.cart[productKey] = { product, quantity: 0 };
  state.cart[productKey].quantity += 1;
  updateBadge();
  toast(`${product.name} added to cart`);
}

function changeCart(productKey, delta) {
  const item = state.cart[productKey];
  if (!item) return;
  item.quantity = Math.max(0, item.quantity + delta);
  if (!item.quantity) delete state.cart[productKey];
  updateBadge();
  renderCart();
}

function renderCart() {
  const items = Object.values(state.cart);
  $('cartFooter').style.display = items.length ? '' : 'none';

  if (!items.length) {
    $('cartBody').innerHTML = empty('🛒', 'Your cart is empty', 'Add products from a merchant store.');
    return;
  }

  $('cartBody').innerHTML = `<div class="product-list">${items.map(({ product, quantity }) => `
    <article class="product-card" data-cart-product>
      <div class="product-thumb"><img src="${product.image}" alt=""></div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-unit">${escapeHtml(product.unit)}</div>
        <div class="product-price">${money(product.price * quantity)}</div>
        <div class="card-actions">
          <button type="button" data-cart-change="${product.key}" data-delta="-1">−</button>
          <strong>Qty ${quantity}</strong>
          <button type="button" data-cart-change="${product.key}" data-delta="1">+</button>
        </div>
      </div>
    </article>`).join('')}</div>`;

  $('cartTotal').textContent = money(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
}

function openCart() {
  renderCart();
  $('cartOverlay').classList.add('open');
}

function renderNav() {
  $('bottomNav').innerHTML = navTabs.map(([id, label, icon]) => `<button class="nav-item ${state.activeTab === id ? 'active' : ''}" data-tab="${id}" type="button"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`).join('');
}

function switchTab(tab) {
  state.activeTab = tab;
  if (tab !== 'darkstore') state.activeStoreId = null;
  document.body.classList.toggle('secondary-tab-active', tab !== 'darkstore');
  renderNav();
  $('searchWrap').style.display = tab === 'darkstore' ? '' : 'none';
  renderMain();
}

function hasSavedLocation() {
  return Boolean(localStorage.getItem('qkLiveLocation')?.trim());
}

function openLocationSheet() {
  $('locationSheet').classList.add('show');
  $('allowLocationBtn').classList.remove('hidden');
  $('manualAddressBox').classList.add('hidden');
  $('detectedLocationBox').classList.add('hidden');
}

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`);
    const data = await response.json();
    return data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}

function requestCustomerLocation() {
  if (!navigator.geolocation) {
    $('manualAddressBox').classList.remove('hidden');
    return;
  }

  $('allowLocationBtn').disabled = true;
  $('allowLocationBtn').textContent = 'Detecting location…';
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    const coordinates = {
      latitude: Number(coords.latitude.toFixed(6)),
      longitude: Number(coords.longitude.toFixed(6)),
      accuracy: Math.round(coords.accuracy || 0)
    };
    localStorage.setItem('qkLocationCoords', JSON.stringify(coordinates));
    $('allowLocationBtn').classList.add('hidden');
    $('detectedLocationBox').classList.remove('hidden');
    $('manualAddressBox').classList.remove('hidden');
    const detected = await reverseGeocode(coords.latitude, coords.longitude);
    $('detectedLocationText').textContent = detected;
    localStorage.setItem('qkDetectedLocation', detected);
  }, () => {
    $('manualAddressBox').classList.remove('hidden');
    $('allowLocationBtn').disabled = false;
    $('allowLocationBtn').textContent = 'Try location access again';
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

function readCoordinates() {
  try {
    const value = JSON.parse(localStorage.getItem('qkLocationCoords') || 'null');
    if (!value) return null;
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, accuracy: Number(value.accuracy || 0) };
  } catch {
    return null;
  }
}

async function saveCustomerProfile(name, phone, address) {
  if (!db || !state.user) return;
  await db.collection('customers').doc(state.user.uid).set({
    uid: state.user.uid,
    fullName: name,
    phone,
    address,
    location: readCoordinates(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function placeOrder() {
  if (state.placingOrder) return;
  const items = Object.values(state.cart);
  const name = $('customerNameInput').value.trim();
  const phone = $('customerPhoneInput').value.replace(/\D/g, '');
  const address = localStorage.getItem('qkLiveLocation')?.trim() || '';

  if (!items.length) return toast('Cart is empty.', true);
  if (!name) return toast('Enter receiver name.', true);
  if (!/^[6-9]\d{9}$/.test(phone)) return toast('Enter a valid 10-digit phone number.', true);
  if (!address) return toast('Select delivery location first.', true);
  if (!state.user || !db) return toast('Backend is still connecting. Try again.', true);

  const storeId = items[0].product.storeId;
  const store = stores.find((item) => item.id === storeId);
  if (!store) return toast('This store is currently unavailable.', true);
  if (items.some((item) => item.product.storeId !== storeId)) return toast('Only one store is allowed per order.', true);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = subtotal >= 299 ? 0 : 25;
  const platformFee = 3;
  const totalAmount = subtotal + deliveryFee + platformFee;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const orderNumber = `QK${String(Date.now()).slice(-7)}`;

  const orderItems = items.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    unit: product.unit,
    quantity,
    unitPrice: product.price,
    lineTotal: product.price * quantity
  }));

  state.placingOrder = true;
  const button = $('checkoutBtn');
  button.disabled = true;
  button.textContent = 'Placing order…';

  try {
    await saveCustomerProfile(name, phone, address);
    await db.collection('orders').add({
      orderNumber,
      customerId: state.user.uid,
      customerName: name,
      customerPhone: phone,
      merchantId: store.merchantId,
      storeId: store.id,
      storeName: store.name,
      items: orderItems,
      itemCount,
      subtotal,
      deliveryFee,
      platformFee,
      totalAmount,
      pickup: {
        name: store.name,
        address: storeAddress(store),
        location: store.location || null
      },
      drop: {
        name,
        address,
        location: readCoordinates()
      },
      status: 'pending_merchant',
      assignedRiderId: null,
      assignedRiderName: null,
      paymentMode: 'Cash on Delivery',
      paymentStatus: 'pending',
      riderPayout: Math.max(25, deliveryFee),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.setItem('qkCustomerName', name);
    localStorage.setItem('qkCustomerPhone', phone);
    state.cart = {};
    updateBadge();
    renderCart();
    $('cartOverlay').classList.remove('open');
    sessionStorage.removeItem('qkOrderPlacementLock');
    switchTab('orders');
    toast(`Order #${orderNumber} placed successfully.`);
  } catch (error) {
    console.error('Order placement failed:', error);
    toast(error?.code === 'permission-denied'
      ? 'Order permission denied. Publish the shared Firestore rules.'
      : 'Order could not be placed. Try again.', true);
  } finally {
    state.placingOrder = false;
    button.disabled = false;
    button.textContent = 'Place order';
  }
}

function updateLiveOrderBanner() {
  const banner = $('liveOrderBanner');
  if (!banner) return;
  const order = activeOrder();
  if (!order) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  banner.innerHTML = `<button type="button" data-tab="track"><strong>Order #${escapeHtml(order.orderNumber || order.id.slice(0, 6))}</strong><span>${escapeHtml(statusLabel(order.status))}</span></button>`;
  banner.classList.remove('hidden');
}

function listenCustomerOrders() {
  state.unsubscribeOrders?.();
  if (!db || !state.user) return;

  state.unsubscribeOrders = db.collection('orders')
    .where('customerId', '==', state.user.uid)
    .limit(50)
    .onSnapshot((snapshot) => {
      state.orders = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
        .sort((a, b) => (timestampValue(b.createdAt) || b.createdAtMs || 0) - (timestampValue(a.createdAt) || a.createdAtMs || 0));
      updateLiveOrderBanner();
      if (state.activeTab === 'orders' || state.activeTab === 'track') renderMain();
    }, (error) => {
      console.error('Customer orders listener failed:', error);
      toast('Orders could not load.', true);
    });
}

async function loadCustomerProfile() {
  if (!db || !state.user) return;
  try {
    const snapshot = await db.collection('customers').doc(state.user.uid).get();
    if (!snapshot.exists) return;
    const profile = snapshot.data();
    if (profile.fullName && !$('customerNameInput').value) $('customerNameInput').value = profile.fullName;
    if (profile.phone && !$('customerPhoneInput').value) $('customerPhoneInput').value = profile.phone;
    if (profile.address && !hasSavedLocation()) {
      localStorage.setItem('qkLiveLocation', profile.address);
      $('locationAddress').textContent = profile.address;
    }
  } catch (error) {
    console.warn('Customer profile could not load:', error);
  }
}

function clearProductListeners() {
  productListeners.forEach((unsubscribe) => unsubscribe());
  productListeners.clear();
}

function syncProductsForStores(activeStores) {
  const activeIds = new Set(activeStores.map((store) => store.id));

  productListeners.forEach((unsubscribe, storeId) => {
    if (!activeIds.has(storeId)) {
      unsubscribe();
      productListeners.delete(storeId);
      for (let index = products.length - 1; index >= 0; index -= 1) {
        if (products[index].storeId === storeId) products.splice(index, 1);
      }
    }
  });

  activeStores.forEach((store) => {
    if (productListeners.has(store.id)) return;
    const unsubscribe = db.collection('stores').doc(store.id).collection('products')
      .onSnapshot((snapshot) => {
        for (let index = products.length - 1; index >= 0; index -= 1) {
          if (products[index].storeId === store.id) products.splice(index, 1);
        }

        snapshot.docs.forEach((document) => {
          const data = document.data();
          const stockQuantity = Number(data.stockQuantity || 0);
          if (data.isActive === false || data.isAvailable === false || stockQuantity <= 0) return;
          products.push({
            id: document.id,
            key: `${store.id}__${document.id}`,
            storeId: store.id,
            merchantId: data.merchantId || store.merchantId,
            name: data.name || 'Product',
            category: data.category || '',
            brand: data.brand || '',
            unit: data.unit || '',
            price: Number(data.sellingPrice ?? data.price ?? 0),
            mrp: Number(data.mrp || 0),
            stockQuantity,
            image: data.imageUrl || data.image || placeholderImage(data.name || 'Product', 'product')
          });
        });

        if (state.activeTab === 'darkstore') renderMain();
      }, (error) => {
        console.error(`Products listener failed for ${store.id}:`, error);
      });
    productListeners.set(store.id, unsubscribe);
  });
}

function listenCatalog() {
  if (!db) return;
  state.unsubscribeStores?.();
  clearProductListeners();

  state.unsubscribeStores = db.collection('stores')
    .where('isApproved', '==', true)
    .onSnapshot((snapshot) => {
      stores.splice(0, stores.length);
      snapshot.docs.forEach((document) => {
        const data = document.data();
        if (data.status !== 'active' || data.isOpen === false) return;
        stores.push({
          id: document.id,
          merchantId: data.merchantId,
          name: data.name || 'MyQK Store',
          category: normalizeCategory(data.category),
          rawCategory: data.category || '',
          description: data.description || '',
          image: data.imageUrl || data.logoUrl || placeholderImage(data.name || 'Store', 'store'),
          time: `${data.openingTime || 'Open'}–${data.closingTime || 'Close'}`,
          address: data.address || {},
          location: data.location || null,
          minimumOrder: Number(data.minimumOrder || 0),
          rating: Number(data.rating || 0)
        });
      });

      state.catalogLoading = false;
      syncProductsForStores(stores);
      if (state.activeStoreId && !stores.some((store) => store.id === state.activeStoreId)) state.activeStoreId = null;
      if (state.activeTab === 'darkstore') renderMain();
    }, (error) => {
      state.catalogLoading = false;
      console.error('Store catalog listener failed:', error);
      toast('Stores could not load. Check Firebase rules.', true);
      if (state.activeTab === 'darkstore') renderMain();
    });
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${source}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

async function loadFirebaseSdk() {
  if (window.firebase?.firestore && window.firebase?.auth) return;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  await loadScript(`${base}/firebase-app-compat.js`);
  await loadScript(`${base}/firebase-auth-compat.js`);
  await loadScript(`${base}/firebase-firestore-compat.js`);
}

async function initializeFirebaseBackend() {
  try {
    await loadFirebaseSdk();
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    auth = app.auth();
    db = app.firestore();
    listenCatalog();

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        try {
          await auth.signInAnonymously();
        } catch (error) {
          console.error('Anonymous sign-in failed:', error);
          toast('Enable Anonymous sign-in in Firebase Authentication.', true);
        }
        return;
      }

      state.user = user;
      await loadCustomerProfile();
      listenCustomerOrders();
    });
  } catch (error) {
    state.catalogLoading = false;
    console.error('Customer Firebase initialization failed:', error);
    toast('Customer backend could not connect.', true);
    renderMain();
  }
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) return switchTab(tab.dataset.tab);

  const category = event.target.closest('[data-category]');
  if (category) {
    state.activeCategory = category.dataset.category;
    state.activeStoreId = null;
    return renderHome();
  }

  const storeButton = event.target.closest('[data-store]');
  if (storeButton) {
    state.activeStoreId = storeButton.dataset.store;
    return renderStore();
  }

  if (event.target.closest('[data-store-back]')) {
    state.activeStoreId = null;
    return renderHome();
  }

  const add = event.target.closest('[data-add]');
  if (add) return addProduct(add.dataset.add);

  const cartChange = event.target.closest('[data-cart-change]');
  if (cartChange) return changeCart(cartChange.dataset.cartChange, Number(cartChange.dataset.delta || 0));

  const riderMap = event.target.closest('[data-open-rider-map]');
  if (riderMap) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(riderMap.dataset.openRiderMap)}`, '_blank', 'noopener');
    return;
  }

  if (event.target.closest('[data-view-all]')) toast('Showing all currently available items.');
});

document.addEventListener('DOMContentLoaded', () => {
  const integrationHint = document.querySelector('.customer-details-card .checkout-hint');
  if (integrationHint) integrationHint.textContent = 'Your order will be sent directly to the selected merchant.';
  $('checkoutBtn').textContent = 'Place order';

  $('searchInput').addEventListener('input', (event) => {
    state.search = event.target.value;
    $('searchClear').classList.toggle('show', Boolean(state.search));
    renderSearch();
  });

  $('searchClear').addEventListener('click', () => {
    state.search = '';
    $('searchInput').value = '';
    $('searchClear').classList.remove('show');
    renderMain();
  });

  $('cartBtn').addEventListener('click', openCart);
  $('cartClose').addEventListener('click', () => $('cartOverlay').classList.remove('open'));
  $('locationBtn').addEventListener('click', openLocationSheet);
  $('locationClose').addEventListener('click', () => hasSavedLocation() ? $('locationSheet').classList.remove('show') : toast('Delivery location select karna required hai.'));
  $('allowLocationBtn').addEventListener('click', requestCustomerLocation);
  $('saveAddressBtn').addEventListener('click', async () => {
    const exact = [$('houseInput').value, $('streetInput').value].filter(Boolean).join(', ');
    if (!exact) return toast('Exact address add karo.');
    const full = [exact, localStorage.getItem('qkDetectedLocation')?.trim()].filter(Boolean).join(', ');
    localStorage.setItem('qkLiveLocation', full);
    $('locationAddress').textContent = full;
    $('locationSheet').classList.remove('show');
    const name = $('customerNameInput').value.trim();
    const phone = $('customerPhoneInput').value.replace(/\D/g, '');
    if (name && phone.length === 10) saveCustomerProfile(name, phone, full).catch(() => {});
  });

  $('checkoutBtn').addEventListener('click', placeOrder);

  const savedLocation = localStorage.getItem('qkLiveLocation')?.trim();
  $('locationAddress').textContent = savedLocation || 'Select your area';
  renderNav();
  renderMain();
  updateBadge();
  initializeFirebaseBackend();
});

window.addEventListener('beforeunload', () => {
  state.unsubscribeStores?.();
  state.unsubscribeOrders?.();
  clearProductListeners();
});
