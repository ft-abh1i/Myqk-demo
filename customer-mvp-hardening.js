'use strict';

(() => {
  const queryOne = (selector) => document.querySelector(selector);
  const ORDER_LOCK_KEY = 'qkOrderPlacementLock';
  const LOCK_TTL_MS = 20_000;
  const REAL_ORDER_STATUSES = new Set([
    'pending_merchant',
    'merchant_accepted',
    'preparing',
    'ready_for_pickup',
    'accepted',
    'arrived_pickup',
    'picked_up',
    'completed',
    'merchant_rejected',
    'cancelled'
  ]);
  const LEGACY_ORDER_KEYS = [
    'qkOrders',
    'qkOrderHistory',
    'qkPendingOrder',
    'pendingOrder',
    'fakeOrder',
    'fakeOrders',
    'sampleOrder',
    'sampleOrders'
  ];

  function showRuntimeToast(message, error = false) {
    const element = queryOne('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    element.classList.toggle('error', error);
    clearTimeout(showRuntimeToast.timer);
    showRuntimeToast.timer = setTimeout(() => {
      element.classList.remove('show', 'error');
    }, 3200);
  }

  function readLock() {
    const value = Number(sessionStorage.getItem(ORDER_LOCK_KEY));
    return Number.isFinite(value) && Date.now() - value < LOCK_TTL_MS;
  }

  function setCheckoutAvailability() {
    const button = queryOne('#checkoutBtn');
    if (!button) return;
    const offline = !navigator.onLine;
    const placing = typeof state !== 'undefined' && state.placingOrder === true;
    button.disabled = offline || placing;
    if (offline) button.textContent = 'Reconnect to continue';
    else if (placing) button.textContent = 'Placing order…';
    else button.textContent = 'Place order';
  }

  function guardCheckout(event) {
    if (!navigator.onLine) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showRuntimeToast('Internet connection is required to place an order.', true);
      return;
    }
    if (readLock()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showRuntimeToast('Your order is already being placed.', true);
      return;
    }
    sessionStorage.setItem(ORDER_LOCK_KEY, String(Date.now()));
    window.setTimeout(() => {
      sessionStorage.removeItem(ORDER_LOCK_KEY);
      setCheckoutAvailability();
    }, LOCK_TTL_MS);
  }

  function validateRuntime() {
    if (!window.isSecureContext) showRuntimeToast('Secure HTTPS is required for live location.', true);
    if (!navigator.geolocation) {
      queryOne('#allowLocationBtn')?.setAttribute('disabled', 'disabled');
      queryOne('#useCurrentLocationBtn')?.setAttribute('disabled', 'disabled');
      showRuntimeToast('Location is not supported on this device.', true);
    }
  }

  function removeLegacyOrderStorage() {
    LEGACY_ORDER_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  function isRealOrder(order) {
    if (!order || typeof order !== 'object') return false;
    if (order.status === 'pending' || !REAL_ORDER_STATUSES.has(order.status)) return false;
    if (typeof order.orderNumber !== 'string' || !order.orderNumber.startsWith('QK')) return false;
    if (typeof order.customerId !== 'string' || order.customerId !== state.user?.uid) return false;
    if (typeof order.merchantId !== 'string' || !order.merchantId.trim()) return false;
    if (typeof order.storeId !== 'string' || !order.storeId.trim()) return false;
    if (!Array.isArray(order.items) || order.items.length === 0) return false;
    if (!Number.isFinite(Number(order.totalAmount))) return false;
    if (!order.createdAt && !Number(order.createdAtMs)) return false;
    return true;
  }

  function removeFakeOrdersFromState() {
    if (typeof state === 'undefined' || !Array.isArray(state.orders)) return;
    state.orders = state.orders.filter(isRealOrder);
  }

  if (typeof statusLabel === 'function') {
    const originalStatusLabel = statusLabel;
    statusLabel = function realOrderStatusLabel(status) {
      if (status === 'pending_merchant') return 'Order placed';
      return originalStatusLabel(status);
    };
  }

  if (typeof renderOrders === 'function') {
    const originalRenderOrders = renderOrders;
    renderOrders = function renderRealOrdersOnly() {
      removeFakeOrdersFromState();
      return originalRenderOrders();
    };
  }

  if (typeof activeOrder === 'function') {
    const originalActiveOrder = activeOrder;
    activeOrder = function getRealActiveOrder() {
      removeFakeOrdersFromState();
      return originalActiveOrder();
    };
  }

  if (typeof updateLiveOrderBanner === 'function') {
    const originalUpdateLiveOrderBanner = updateLiveOrderBanner;
    updateLiveOrderBanner = function updateRealOrderBanner() {
      removeFakeOrdersFromState();
      return originalUpdateLiveOrderBanner();
    };
  }

  window.addEventListener('online', () => {
    sessionStorage.removeItem(ORDER_LOCK_KEY);
    setCheckoutAvailability();
    showRuntimeToast('Internet connection restored.');
  });

  window.addEventListener('offline', () => {
    setCheckoutAvailability();
    showRuntimeToast('You are offline. Cart is saved on this device.', true);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled customer app error:', event.reason);
    sessionStorage.removeItem(ORDER_LOCK_KEY);
    setCheckoutAvailability();
  });

  document.addEventListener('DOMContentLoaded', () => {
    sessionStorage.removeItem(ORDER_LOCK_KEY);
    removeLegacyOrderStorage();
    removeFakeOrdersFromState();
    validateRuntime();
    setCheckoutAvailability();
    queryOne('#checkoutBtn')?.addEventListener('click', guardCheckout, true);

    if (typeof updateLiveOrderBanner === 'function') updateLiveOrderBanner();
    if (typeof state !== 'undefined' && ['orders', 'track'].includes(state.activeTab) && typeof renderMain === 'function') {
      renderMain();
    }
  });
})();
