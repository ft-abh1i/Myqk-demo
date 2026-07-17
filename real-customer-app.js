'use strict';

const $ = (id) => document.getElementById(id);

const navTabs = [
  ['darkstore', 'Store', '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9 21v-6h6v6"/></svg>'],
  ['orders', 'Orders', '<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'],
  ['track', 'Track', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'],
  ['profile', 'Profile', '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.2-6.3 7.5-6.3s6.8 2.1 7.5 6.3"/></svg>']
];

const categories = [
  ['all', 'All Stores', '🛒'],
  ['pharmacy', 'Pharmacy', '✚'],
  ['groceries', 'Groceries', '🧺'],
  ['fruits', 'Fruits & Veg', '🌿'],
  ['snacks', 'Snacks', '▣'],
  ['more', 'More', '▦']
];

const stores = [
  { id: 'freshmart', name: 'FreshMart', time: '20–30 mins', category: 'groceries', image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=500&q=80' },
  { id: 'mediquick', name: 'MediQuick', time: '15–25 mins', category: 'pharmacy', image: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=500&q=80' },
  { id: 'dailybasket', name: 'DailyBasket', time: '25–35 mins', category: 'fruits', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80' },
  { id: 'snackhub', name: 'SnackHub', time: '20–30 mins', category: 'snacks', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=500&q=80' }
];

const products = [
  { id: 'banana', name: 'Fresh Bananas', unit: '6 pcs', price: 48, image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=500&q=85' },
  { id: 'bread', name: 'Whole Wheat Bread', unit: '400 g', price: 45, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=85' },
  { id: 'eggs', name: 'Farm Fresh Eggs', unit: '6 pcs', price: 72, image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=500&q=85' },
  { id: 'orange', name: 'Fresh Oranges', unit: '1 kg', price: 95, image: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=500&q=85' },
  { id: 'tomato', name: 'Fresh Tomatoes', unit: '500 g', price: 38, image: 'https://images.unsplash.com/photo-1561136594-7f68413baa99?auto=format&fit=crop&w=500&q=85' },
  { id: 'juice', name: 'Orange Juice', unit: '1 L', price: 110, image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=500&q=85' }
];

const state = {
  activeTab: 'darkstore',
  activeCategory: 'all',
  search: '',
  cart: {}
};

function money(value) { return `₹${Math.round(Number(value) || 0)}`; }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function empty(icon, title, subtitle) {
  return `<div class="view empty-state"><div class="emoji">${icon}</div><div class="title">${title}</div><div class="sub">${subtitle}</div></div>`;
}

function categoryMarkup() {
  return `<div class="home-category-strip" id="categoryNav">${categories.map(([id, label, icon], index) => `
    <button class="home-category ${state.activeCategory === id ? 'active' : ''} category-${index + 1}" data-category="${id}" type="button">
      <span class="home-category-icon">${icon}</span><span>${label}</span>
    </button>`).join('')}</div>`;
}

function renderHome() {
  const query = state.search.trim().toLowerCase();
  const visibleStores = stores.filter(store => (state.activeCategory === 'all' || state.activeCategory === 'more' || store.category === state.activeCategory) && (!query || `${store.name} ${store.category}`.toLowerCase().includes(query)));
  const visibleProducts = products.filter(product => !query || `${product.name} ${product.unit}`.toLowerCase().includes(query));

  $('appMain').innerHTML = `<div class="view home-view">
    ${categoryMarkup()}
    <section class="home-section">
      <div class="home-section-head"><h2>Featured Stores</h2><button type="button" data-view-all="stores">View all</button></div>
      <div class="featured-store-row">${visibleStores.map(store => `
        <button class="featured-store-card" type="button" data-store="${store.id}">
          <img src="${store.image}" alt="${escapeHtml(store.name)}" loading="lazy">
          <div class="featured-store-info"><strong>${escapeHtml(store.name)}</strong><span class="store-clock">◷ ${store.time}</span><span class="free-delivery">♣ Free delivery</span></div>
        </button>`).join('') || '<p class="home-no-result">No matching stores found.</p>'}</div>
    </section>
    <section class="home-section products-section">
      <div class="home-section-head"><h2>Best Selling Products</h2><button type="button" data-view-all="products">View all</button></div>
      <div class="best-product-row">${visibleProducts.map(product => `
        <article class="best-product-card">
          <div class="best-product-image"><img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy"></div>
          <strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.unit)}</span>
          <div class="best-product-foot"><b>${money(product.price)}</b><button type="button" data-add="${product.id}" aria-label="Add ${escapeHtml(product.name)}">+</button></div>
        </article>`).join('') || '<p class="home-no-result">No matching products found.</p>'}</div>
    </section>
  </div>`;
}

function renderMain() {
  if (state.activeTab === 'darkstore') renderHome();
}

function renderSearch() { renderHome(); }

function updateBadge() {
  const count = Object.values(state.cart).reduce((sum, item) => sum + item.quantity, 0);
  $('cartBadge').textContent = count;
  $('cartBadge').classList.toggle('show', count > 0);
}

function addProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  if (!state.cart[productId]) state.cart[productId] = { product, quantity: 0 };
  state.cart[productId].quantity += 1;
  updateBadge();
  toast(`${product.name} added to cart`);
}

function renderCart() {
  const items = Object.values(state.cart);
  $('cartFooter').style.display = items.length ? '' : 'none';
  if (!items.length) {
    $('cartBody').innerHTML = empty('🛒', 'Your cart is empty', 'Add products from the home page.');
    return;
  }
  $('cartBody').innerHTML = `<div class="product-list">${items.map(({ product, quantity }) => `<article class="product-card"><div class="product-thumb"><img src="${product.image}" alt=""></div><div class="product-info"><div class="product-name">${escapeHtml(product.name)}</div><div class="product-unit">${escapeHtml(product.unit)}</div><div class="product-price">${money(product.price * quantity)} · Qty ${quantity}</div></div></article>`).join('')}</div>`;
  $('cartTotal').textContent = money(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
}

function openCart() { renderCart(); $('cartOverlay').classList.add('open'); }

function renderNav() {
  $('bottomNav').innerHTML = navTabs.map(([id, label, icon]) => `<button class="nav-item ${state.activeTab === id ? 'active' : ''}" data-tab="${id}" type="button"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`).join('');
}

function switchTab(tab) {
  state.activeTab = tab;
  document.body.classList.toggle('secondary-tab-active', tab !== 'darkstore');
  renderNav();
  $('searchWrap').style.display = tab === 'darkstore' ? '' : 'none';
  if (tab === 'darkstore') renderHome();
  else $('appMain').innerHTML = empty(tab === 'profile' ? '○' : tab === 'orders' ? '▤' : '⌖', tab === 'profile' ? 'Customer profile' : tab === 'orders' ? 'No orders yet' : 'Nothing to track', 'This section is ready for the next integration step.');
}

function hasSavedLocation() { return Boolean(localStorage.getItem('qkLiveLocation')?.trim()); }
function openLocationSheet() { $('locationSheet').classList.add('show'); $('allowLocationBtn').classList.remove('hidden'); $('manualAddressBox').classList.add('hidden'); $('detectedLocationBox').classList.add('hidden'); }

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`);
    const data = await response.json();
    return data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  } catch { return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; }
}

function requestCustomerLocation() {
  if (!navigator.geolocation) return $('manualAddressBox').classList.remove('hidden');
  $('allowLocationBtn').disabled = true;
  $('allowLocationBtn').textContent = 'Detecting location…';
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    $('allowLocationBtn').classList.add('hidden');
    $('detectedLocationBox').classList.remove('hidden');
    $('manualAddressBox').classList.remove('hidden');
    const detected = await reverseGeocode(coords.latitude, coords.longitude);
    $('detectedLocationText').textContent = detected;
    localStorage.setItem('qkDetectedLocation', detected);
  }, () => { $('manualAddressBox').classList.remove('hidden'); $('allowLocationBtn').disabled = false; $('allowLocationBtn').textContent = 'Try location access again'; });
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) return switchTab(tab.dataset.tab);
  const category = event.target.closest('[data-category]');
  if (category) { state.activeCategory = category.dataset.category; return renderHome(); }
  const add = event.target.closest('[data-add]');
  if (add) return addProduct(add.dataset.add);
  if (event.target.closest('[data-store]')) toast('Store catalog opening soon');
  if (event.target.closest('[data-view-all]')) toast('Showing all available items');
});

document.addEventListener('DOMContentLoaded', () => {
  $('searchInput').addEventListener('input', (event) => { state.search = event.target.value; $('searchClear').classList.toggle('show', Boolean(state.search)); renderSearch(); });
  $('searchClear').addEventListener('click', () => { state.search = ''; $('searchInput').value = ''; $('searchClear').classList.remove('show'); renderHome(); });
  $('cartBtn').addEventListener('click', openCart);
  $('cartClose').addEventListener('click', () => $('cartOverlay').classList.remove('open'));
  $('locationBtn').addEventListener('click', openLocationSheet);
  $('locationClose').addEventListener('click', () => hasSavedLocation() ? $('locationSheet').classList.remove('show') : toast('Delivery location select karna required hai.'));
  $('allowLocationBtn').addEventListener('click', requestCustomerLocation);
  $('saveAddressBtn').addEventListener('click', () => {
    const exact = [$('houseInput').value, $('streetInput').value].filter(Boolean).join(', ');
    if (!exact) return toast('Exact address add karo.');
    const full = [exact, localStorage.getItem('qkDetectedLocation')?.trim()].filter(Boolean).join(', ');
    localStorage.setItem('qkLiveLocation', full); $('locationAddress').textContent = full; $('locationSheet').classList.remove('show');
  });
  $('checkoutBtn').addEventListener('click', () => toast('Checkout integration next step me connect hoga.'));
  const savedLocation = localStorage.getItem('qkLiveLocation')?.trim();
  $('locationAddress').textContent = savedLocation || 'Camp, Teenbatti, Siliguri';
  renderNav(); renderHome(); updateBadge();
});