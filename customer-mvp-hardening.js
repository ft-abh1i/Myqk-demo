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

  let cancellingOrderId = null;

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
    button.disabled = offline || readLock();
    if (offline) button.textContent = 'Reconnect to continue';
    else if (readLock()) button.textContent = 'Placing order…';
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
    setCheckoutAvailability();
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

  function canCancelOrder(order) {
    return Boolean(
      order
      && order.status === 'pending_merchant'
      && !order.assignedRiderId
      && state.user
      && order.customerId === state.user.uid
    );
  }

  function installCancelStyles() {
    if (document.getElementById('qkOrderCancelStyles')) return;
    const style = document.createElement('style');
    style.id = 'qkOrderCancelStyles';
    style.textContent = `
      .qk-cancellable-order {
        flex-wrap: wrap;
      }

      .qk-order-card-actions {
        display: flex;
        flex: 0 0 100%;
        justify-content: flex-end;
        width: 100%;
        padding-top: 10px;
        border-top: 1px solid #edf0ee;
      }

      .qk-order-cancel-btn {
        min-height: 40px;
        padding: 0 15px;
        border: 1px solid #dc2626;
        border-radius: 12px;
        background: #fff;
        color: #dc2626;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
      }

      .qk-order-cancel-btn:disabled {
        cursor: not-allowed;
        opacity: .55;
      }

      .qk-track-cancel-card {
        margin-top: 14px;
        padding: 15px;
        border: 1px solid #fecaca;
        border-radius: 18px;
        background: #fff;
      }

      .qk-track-cancel-card strong {
        display: block;
        color: #111827;
        font-size: 14px;
      }

      .qk-track-cancel-card p {
        margin: 6px 0 12px;
        color: #6b7280;
        font-size: 12px;
        line-height: 1.5;
      }

      .qk-track-cancel-card .qk-order-cancel-btn {
        width: 100%;
        min-height: 46px;
      }
    `;
    document.head.appendChild(style);
  }

  function cancelButton(order, fullWidth = false) {
    const busy = cancellingOrderId === order.id;
    return `<button class="qk-order-cancel-btn${fullWidth ? ' full' : ''}" type="button" data-cancel-order="${order.id}" ${busy ? 'disabled' : ''}>${busy ? 'Cancelling…' : 'Cancel order'}</button>`;
  }

  function appendOrderListCancelControls() {
    if (typeof state === 'undefined' || state.activeTab !== 'orders') return;

    document.querySelectorAll('#appMain [data-order-id]').forEach((card) => {
      const order = state.orders.find((item) => item.id === card.dataset.orderId);
      const existing = card.querySelector('[data-cancel-order]');

      if (!canCancelOrder(order)) {
        existing?.closest('.qk-order-card-actions')?.remove();
        card.classList.remove('qk-cancellable-order');
        return;
      }

      card.classList.add('qk-cancellable-order');
      if (existing) return;
      card.insertAdjacentHTML('beforeend', `<div class="qk-order-card-actions">${cancelButton(order)}</div>`);
    });
  }

  function appendTrackCancelControl() {
    if (typeof state === 'undefined' || state.activeTab !== 'track') return;

    const order = typeof activeOrder === 'function' ? activeOrder() : null;
    const view = queryOne('#appMain > .view');
    const existing = queryOne('#qkTrackCancelCard');

    if (!view || !canCancelOrder(order)) {
      existing?.remove();
      return;
    }

    if (existing) return;
    view.insertAdjacentHTML('beforeend', `
      <section id="qkTrackCancelCard" class="qk-track-cancel-card">
        <strong>Need to cancel this order?</strong>
        <p>You can cancel until the store accepts and starts processing it.</p>
        ${cancelButton(order, true)}
      </section>`);
  }

  function appendCancelControls() {
    installCancelStyles();
    appendOrderListCancelControls();
    appendTrackCancelControl();
  }

  async function cancelOrder(orderId, button) {
    if (cancellingOrderId || !navigator.onLine) {
      if (!navigator.onLine) showRuntimeToast('Internet connection is required to cancel an order.', true);
      return;
    }

    const order = state.orders.find((item) => item.id === orderId);
    if (!canCancelOrder(order)) {
      showRuntimeToast('This order can no longer be cancelled.', true);
      appendCancelControls();
      return;
    }

    if (!window.confirm('Cancel this order?')) return;

    cancellingOrderId = orderId;
    button.disabled = true;
    button.textContent = 'Cancelling…';

    try {
      if (typeof db === 'undefined' || !db || typeof firebase === 'undefined' || !firebase.firestore) {
        throw new Error('BACKEND_NOT_READY');
      }
      const orderReference = db.collection('orders').doc(orderId);

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(orderReference);
        if (!snapshot.exists) throw new Error('ORDER_NOT_FOUND');

        const current = snapshot.data();
        if (current.customerId !== state.user?.uid) throw new Error('NOT_ALLOWED');
        if (current.status !== 'pending_merchant' || current.assignedRiderId) {
          throw new Error('ORDER_ALREADY_PROCESSING');
        }

        const now = firebase.firestore.FieldValue.serverTimestamp();
        transaction.update(orderReference, {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now
        });
      });

      showRuntimeToast('Order cancelled successfully.');
    } catch (error) {
      console.error('Order cancellation failed:', error);
      const alreadyProcessing = error?.message === 'ORDER_ALREADY_PROCESSING';
      const permissionDenied = error?.code === 'permission-denied';
      showRuntimeToast(
        alreadyProcessing
          ? 'The store has already started processing this order.'
          : permissionDenied
            ? 'Cancellation permission denied. Publish the latest Firestore rules.'
            : 'Order could not be cancelled. Please try again.',
        true
      );
    } finally {
      cancellingOrderId = null;
      button.disabled = false;
      button.textContent = 'Cancel order';
      window.setTimeout(appendCancelControls, 0);
    }
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
      const result = originalRenderOrders();
      appendOrderListCancelControls();
      return result;
    };
  }

  if (typeof renderTrack === 'function') {
    const originalRenderTrack = renderTrack;
    renderTrack = function renderTrackWithCancellation() {
      removeFakeOrdersFromState();
      const result = originalRenderTrack();
      appendTrackCancelControl();
      return result;
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
    removeLegacyOrderStorage();
    removeFakeOrdersFromState();
    validateRuntime();
    installCancelStyles();
    setCheckoutAvailability();
    queryOne('#checkoutBtn')?.addEventListener('click', guardCheckout, true);

    document.addEventListener('click', (event) => {
      const cancelButtonElement = event.target.closest('[data-cancel-order]');
      if (!cancelButtonElement) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelOrder(cancelButtonElement.dataset.cancelOrder, cancelButtonElement);
    }, true);

    if (typeof updateLiveOrderBanner === 'function') updateLiveOrderBanner();
    if (typeof state !== 'undefined' && ['orders', 'track'].includes(state.activeTab) && typeof renderMain === 'function') {
      renderMain();
    }
    appendCancelControls();
  });
})();
