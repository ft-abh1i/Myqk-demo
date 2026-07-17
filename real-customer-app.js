'use strict';

const $ = (id) => document.getElementById(id);
const navTabs = [
  ['darkstore', 'Store', '⌂'],
  ['orders', 'Orders', '▤'],
  ['track', 'Track', '⌖'],
  ['profile', 'Profile', '○']
];

const state = {
  stores: [],
  activeStoreId: null,
  activeTab: 'darkstore',
  search: '',
  cart: {},
  quantities: {}
};

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
  })[character]);
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

function empty(icon, title, subtitle) {
  return `<div class="view empty-state"><div class="emoji">${icon}</div><div class="title">${title}</div><div class="sub">${subtitle}</div></div>`;
}

function renderMain() {
  if (state.activeTab !== 'darkstore') return;
  $('appMain').innerHTML = empty('⌂', 'No stores added yet', 'Store design and real catalog will be added next.');
}

function renderSearch() {
  $('appMain').innerHTML = empty('⌕', 'No stores or products', 'The demo catalog has been removed.');
}

function updateBadge() {
  const badge = $('cartBadge');
  if (!badge) return;
  const count = Object.values(state.cart).reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = count;
  badge.classList.toggle('show', count > 0);
}

function renderCart() {
  const items = Object.values(state.cart);
  $('cartFooter').style.display = items.length ? '' : 'none';

  if (!items.length) {
    $('cartBody').innerHTML = empty('🛒', 'Your cart is empty', 'Products will appear here after stores are added.');
    return;
  }

  $('cartBody').innerHTML = `<div class="product-list">${items.map(({ store, product, quantity }) => `
    <article class="product-card">
      <div class="product-info">
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-unit">${escapeHtml(product.unit || '')}</div>
        <span class="product-store-tag">${escapeHtml(store.name)}</span>
        <div class="product-price">${money(product.price * quantity)}</div>
      </div>
    </article>`).join('')}</div>`;
}

function openCart() {
  renderCart();
  $('cartOverlay').classList.add('open');
}

function renderNav() {
  $('bottomNav').innerHTML = navTabs.map(([id, label, icon]) => `
    <button class="nav-item ${state.activeTab === id ? 'active' : ''}" data-tab="${id}" type="button">
      <span>${icon}</span>
      <span class="nav-label">${label}</span>
      <span class="nav-dot"></span>
    </button>`).join('');
}

function switchTab(tab) {
  state.activeTab = tab;
  renderNav();
  $('searchWrap').style.display = tab === 'darkstore' ? '' : 'none';

  if (tab === 'darkstore') {
    renderMain();
  } else if (tab === 'profile') {
    $('appMain').innerHTML = empty('○', 'Customer profile', 'Profile UI will be upgraded before backend integration.');
  } else {
    $('appMain').innerHTML = empty(
      tab === 'orders' ? '▤' : '⌖',
      tab === 'orders' ? 'No orders yet' : 'Nothing to track',
      'No active data is available.'
    );
  }
}

function hasSavedLocation() {
  return Boolean(localStorage.getItem('qkLiveLocation')?.trim());
}

function openLocationSheet() {
  $('locationSheet').classList.add('show');
  $('allowLocationBtn').classList.remove('hidden');
  $('allowLocationBtn').disabled = false;
  $('allowLocationBtn').textContent = 'Give location access';
  $('manualAddressBox').classList.add('hidden');
  $('detectedLocationBox').classList.add('hidden');
  $('locationStatus').textContent = 'Tap Give location access to detect your area.';
}

async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`);
    if (!response.ok) throw new Error('Address lookup failed');
    const data = await response.json();
    const address = data.address || {};
    return [
      address.road || address.neighbourhood || address.suburb,
      address.city || address.town || address.village || address.county,
      address.state,
      address.postcode
    ].filter(Boolean).join(', ') || data.display_name;
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}

function requestCustomerLocation() {
  $('allowLocationBtn').disabled = true;
  $('allowLocationBtn').textContent = 'Detecting location…';
  $('locationStatus').textContent = 'Detecting your current location…';

  if (!navigator.geolocation) {
    $('manualAddressBox').classList.remove('hidden');
    $('locationStatus').textContent = 'Location is unavailable. Enter your address manually.';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    $('allowLocationBtn').classList.add('hidden');
    $('detectedLocationBox').classList.remove('hidden');
    $('detectedLocationText').textContent = 'Finding address…';
    $('manualAddressBox').classList.remove('hidden');
    const detected = await reverseGeocode(latitude, longitude);
    $('detectedLocationText').textContent = detected;
    localStorage.setItem('qkDetectedLocation', detected);
    $('locationStatus').textContent = 'Location detected. Add your exact delivery address.';
  }, () => {
    $('manualAddressBox').classList.remove('hidden');
    $('allowLocationBtn').disabled = false;
    $('allowLocationBtn').textContent = 'Try location access again';
    $('locationStatus').textContent = 'Location permission was not granted. Enter your address manually.';
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000
  });
}

function previewOrder() {
  toast('Cart empty hai.');
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) switchTab(tab.dataset.tab);
});

document.addEventListener('DOMContentLoaded', () => {
  $('searchInput').addEventListener('input', (event) => {
    state.search = event.target.value;
    $('searchClear').classList.toggle('show', Boolean(state.search));
    state.search.trim() ? renderSearch() : renderMain();
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
  $('locationClose').addEventListener('click', () => {
    if (hasSavedLocation()) $('locationSheet').classList.remove('show');
    else toast('Delivery location select karna required hai.');
  });
  $('allowLocationBtn').addEventListener('click', requestCustomerLocation);
  $('saveAddressBtn').addEventListener('click', () => {
    const exact = [$('houseInput').value, $('streetInput').value].filter(Boolean).join(', ');
    if (!exact) return toast('Exact address add karo.');
    const detected = localStorage.getItem('qkDetectedLocation')?.trim();
    const full = [exact, detected].filter(Boolean).join(', ');
    localStorage.setItem('qkLiveLocation', full);
    $('locationAddress').textContent = full;
    $('locationSheet').classList.remove('show');
  });
  $('checkoutBtn').addEventListener('click', previewOrder);

  const savedLocation = localStorage.getItem('qkLiveLocation')?.trim();
  if (savedLocation) $('locationAddress').textContent = savedLocation;

  renderNav();
  renderMain();
  updateBadge();
});
