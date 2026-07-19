'use strict';

(() => {
  const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'merchant_rejected']);
  const CUSTOMER_CANCELLABLE_STATUSES = new Set([
    'pending_merchant',
    'merchant_accepted',
    'preparing',
    'ready_for_pickup'
  ]);
  const STATUS_META = {
    pending_merchant: {
      title: 'Order placed',
      description: 'Waiting for the store to confirm your order',
      tone: 'active',
      step: 0
    },
    merchant_accepted: {
      title: 'Order confirmed',
      description: 'The store has accepted your order',
      tone: 'active',
      step: 1
    },
    preparing: {
      title: 'Being packed',
      description: 'The store is getting your items ready',
      tone: 'active',
      step: 2
    },
    ready_for_pickup: {
      title: 'Ready for pickup',
      description: 'Your order is ready for the delivery partner',
      tone: 'active',
      step: 2
    },
    accepted: {
      title: 'Delivery partner assigned',
      description: 'Your delivery partner is heading to the store',
      tone: 'active',
      step: 2
    },
    arrived_pickup: {
      title: 'Delivery partner at store',
      description: 'Your order will be picked up shortly',
      tone: 'active',
      step: 2
    },
    picked_up: {
      title: 'Out for delivery',
      description: 'Your order is on its way to you',
      tone: 'active',
      step: 3
    },
    completed: {
      title: 'Delivered',
      description: 'Your order was delivered successfully',
      tone: 'success',
      step: 4
    },
    merchant_rejected: {
      title: 'Not accepted',
      description: 'The store could not accept this order',
      tone: 'failed',
      step: -1
    },
    cancelled: {
      title: 'Cancelled',
      description: 'This order was cancelled',
      tone: 'failed',
      step: -1
    }
  };
  const TIMELINE_LABELS = ['Placed', 'Confirmed', 'Packed', 'On the way', 'Delivered'];
  let selectedOrderId = null;
  let pendingCancelOrderId = null;
  let cancellationInFlight = false;

  function escapeValue(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function orderTime(value) {
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function placedTime(order) {
    return orderTime(order.createdAt) || Number(order.createdAtMs) || 0;
  }

  function formatDate(order, full = false) {
    const time = placedTime(order);
    if (!time) return 'Just now';
    return new Date(time).toLocaleString('en-IN', full ? {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    } : {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return `₹${Math.round(number).toLocaleString('en-IN')}`;
  }

  function hasNumber(value) {
    return value !== null && value !== '' && Number.isFinite(Number(value));
  }

  function orderItems(order) {
    return Array.isArray(order.items) ? order.items.filter(Boolean) : [];
  }

  function itemCount(order) {
    const stored = Number(order.itemCount);
    if (Number.isFinite(stored) && stored > 0) return stored;
    return orderItems(order).reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  }

  function statusMeta(status) {
    return STATUS_META[status] || {
      title: typeof statusLabel === 'function' ? statusLabel(status) : 'Processing',
      description: 'We will update this order as it moves forward',
      tone: 'active',
      step: 0
    };
  }

  function hasAssignedRider(order) {
    return Boolean(
      order?.assignedRiderId
      || order?.assignedRiderUid
      || order?.riderId
      || order?.rider?.id
    );
  }

  function canCustomerCancel(order) {
    return Boolean(
      order
      && CUSTOMER_CANCELLABLE_STATUSES.has(order.status)
      && !hasAssignedRider(order)
    );
  }

  function storeName(order) {
    return order.storeName || order.pickup?.name || 'BuyQK Store';
  }

  function orderNumber(order) {
    return order.orderNumber || String(order.id || '').slice(0, 8).toUpperCase();
  }

  function itemInitials(name) {
    return String(name || 'Item')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'QK';
  }

  function safeImage(item) {
    const value = String(item?.imageUrl || item?.image || '').trim();
    return /^(https?:\/\/|\/)/i.test(value) ? escapeValue(value) : '';
  }

  function statusIcon(tone) {
    if (tone === 'success') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3.2 3.2L17.5 8"/></svg>';
    }
    if (tone === 'failed') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8M16 8l-8 8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 1.8"/></svg>';
  }

  function chevronIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  }

  function backIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  }

  function pinIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-6.2 6-11a6 6 0 1 0-12 0c0 4.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>';
  }

  function itemPreview(order) {
    const items = orderItems(order);
    const visible = items.slice(0, 4);
    const tiles = visible.map((item, index) => {
      const image = safeImage(item);
      return `<span class="qk-order-mini-item tone-${(index % 4) + 1}">${image
        ? `<img src="${image}" alt="" loading="lazy">`
        : `<b>${escapeValue(itemInitials(item.name))}</b>`}</span>`;
    }).join('');
    const missing = Math.max(0, itemCount(order) - visible.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0));
    return `<div class="qk-order-preview">${tiles || '<span class="qk-order-mini-item tone-1"><b>QK</b></span>'}${missing ? `<span class="qk-order-more">+${missing}</span>` : ''}</div>`;
  }

  function itemSummary(order) {
    const items = orderItems(order);
    if (!items.length) return `${itemCount(order)} item${itemCount(order) === 1 ? '' : 's'}`;
    const names = items.slice(0, 2).map((item) => item.name).filter(Boolean);
    const extra = Math.max(0, items.length - names.length);
    return `${names.join(', ')}${extra ? ` +${extra} more` : ''}`;
  }

  function orderCard(order) {
    const meta = statusMeta(order.status);
    const number = orderNumber(order);
    return `<button class="qk-order-card" type="button" data-order-open="${escapeValue(order.id)}" aria-label="View order ${escapeValue(number)}">
      <div class="qk-order-card-status">
        <span class="qk-order-status-icon ${meta.tone}">${statusIcon(meta.tone)}</span>
        <div class="qk-order-status-copy">
          <strong>${escapeValue(meta.title)}</strong>
          <p>${escapeValue(meta.description)}</p>
        </div>
        <span class="qk-order-chevron">${chevronIcon()}</span>
      </div>
      <div class="qk-order-card-body">
        <div class="qk-order-store-line">
          <div><strong>${escapeValue(storeName(order))}</strong><span>${escapeValue(formatDate(order))}</span></div>
          <small>${itemCount(order)} item${itemCount(order) === 1 ? '' : 's'}</small>
        </div>
        <div class="qk-order-items-preview">
          ${itemPreview(order)}
          <p>${escapeValue(itemSummary(order))}</p>
        </div>
      </div>
      <div class="qk-order-card-foot">
        <span>Order #${escapeValue(number)}</span>
        <strong>${formatMoney(order.totalAmount)}</strong>
      </div>
    </button>`;
  }

  function emptyOrders() {
    return `<div class="qk-orders-empty">
      <div class="qk-orders-empty-art" aria-hidden="true">
        <svg viewBox="0 0 64 64"><path d="M18 12h28l-2 39H20l-2-39Z"/><path d="M25 12a7 7 0 0 1 14 0M26 25h12M26 33h8"/></svg>
      </div>
      <strong>No orders yet</strong>
      <p>Your orders will appear here after checkout.</p>
      <button type="button" data-tab="darkstore">Start shopping</button>
    </div>`;
  }

  function listMarkup(orders) {
    return `<div class="view qk-orders-view">
      <div class="qk-orders-scroll">
        ${orders.length ? `<div class="qk-orders-list-meta"><strong>Recent orders</strong><span>${orders.length} total</span></div>
          <div class="qk-orders-list">${orders.map(orderCard).join('')}</div>` : emptyOrders()}
      </div>
    </div>`;
  }

  function timelineMarkup(order) {
    const meta = statusMeta(order.status);
    if (meta.tone === 'failed') {
      return `<div class="qk-order-ended ${meta.tone}">
        <span>${statusIcon(meta.tone)}</span>
        <div><strong>${escapeValue(meta.title)}</strong><p>${escapeValue(meta.description)}</p></div>
      </div>`;
    }

    return `<div class="qk-order-timeline">${TIMELINE_LABELS.map((label, index) => {
      const done = index <= meta.step;
      const current = index === meta.step && order.status !== 'completed';
      return `<div class="qk-order-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
        <span>${index < meta.step || order.status === 'completed' ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 8 2.3 2.3L12 5"/></svg>' : ''}</span>
        <div><strong>${label}</strong>${current ? `<p>${escapeValue(meta.description)}</p>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function itemRows(order) {
    const items = orderItems(order);
    if (!items.length) return '<p class="qk-order-unavailable">Item details are unavailable for this order.</p>';
    return items.map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const lineTotal = hasNumber(item.lineTotal)
        ? Number(item.lineTotal)
        : hasNumber(item.unitPrice) ? Number(item.unitPrice) * quantity : null;
      const image = safeImage(item);
      return `<div class="qk-order-item-row">
        <span class="qk-order-item-image tone-${(index % 4) + 1}">${image
          ? `<img src="${image}" alt="" loading="lazy">`
          : `<b>${escapeValue(itemInitials(item.name))}</b>`}</span>
        <div class="qk-order-item-copy">
          <strong>${escapeValue(item.name || 'Item')}</strong>
          <p>${escapeValue([item.unit, `Qty ${quantity}`].filter(Boolean).join(' · '))}</p>
        </div>
        <strong class="qk-order-item-price">${lineTotal === null ? '' : formatMoney(lineTotal)}</strong>
      </div>`;
    }).join('');
  }

  function derivedSubtotal(order) {
    if (hasNumber(order.subtotal)) return Number(order.subtotal);
    const total = orderItems(order).reduce((sum, item) => {
      if (hasNumber(item.lineTotal)) return sum + Number(item.lineTotal);
      if (hasNumber(item.unitPrice)) return sum + Number(item.unitPrice) * Math.max(1, Number(item.quantity) || 1);
      return sum;
    }, 0);
    return total || null;
  }

  function billMarkup(order) {
    const subtotal = derivedSubtotal(order);
    const rows = [];
    if (subtotal !== null) rows.push(`<div><span>Item subtotal</span><strong>${formatMoney(subtotal)}</strong></div>`);
    if (hasNumber(order.deliveryFee)) rows.push(`<div><span>Delivery fee</span><strong class="${Number(order.deliveryFee) === 0 ? 'free' : ''}">${Number(order.deliveryFee) === 0 ? 'FREE' : formatMoney(order.deliveryFee)}</strong></div>`);
    if (hasNumber(order.platformFee)) rows.push(`<div><span>Platform fee</span><strong>${formatMoney(order.platformFee)}</strong></div>`);
    return `${rows.join('')}<div class="qk-order-bill-total"><span>Grand total</span><strong>${formatMoney(order.totalAmount)}</strong></div>`;
  }

  function detailAction(order) {
    if (!TERMINAL_STATUSES.has(order.status)) {
      return `<div class="qk-order-action-stack">
        <button class="qk-order-primary-action" type="button" data-tab="track">Track order</button>
        ${canCustomerCancel(order) ? `<button class="qk-order-cancel-action" type="button" data-order-cancel="${escapeValue(order.id)}">Cancel order</button>
          <p>Cancellation is available until a delivery partner is assigned.</p>` : ''}
      </div>`;
    }
    return '<button class="qk-order-primary-action" type="button" data-tab="darkstore">Browse stores</button>';
  }

  function showOrderToast(message, error = false) {
    if (typeof toast === 'function') {
      toast(message, error);
      return;
    }
    const element = document.getElementById('toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    element.classList.toggle('error', error);
    window.clearTimeout(showOrderToast.timer);
    showOrderToast.timer = window.setTimeout(() => element.classList.remove('show', 'error'), 3000);
  }

  function ensureCancelSheet() {
    let sheet = document.getElementById('qkOrderCancelSheet');
    if (sheet) return sheet;

    sheet = document.createElement('section');
    sheet.id = 'qkOrderCancelSheet';
    sheet.className = 'qk-order-cancel-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'qkOrderCancelTitle');
    sheet.innerHTML = `
      <button class="qk-order-cancel-backdrop" type="button" data-cancel-sheet-close aria-label="Keep order"></button>
      <div class="qk-order-cancel-panel">
        <span class="qk-order-cancel-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
        </span>
        <h2 id="qkOrderCancelTitle">Cancel this order?</h2>
        <p>A delivery partner has not been assigned yet. Once cancelled, this order cannot be restored.</p>
        <small id="qkOrderCancelNumber"></small>
        <div class="qk-order-cancel-sheet-actions">
          <button type="button" data-cancel-sheet-close>Keep order</button>
          <button type="button" data-confirm-order-cancel>Yes, cancel order</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    return sheet;
  }

  function closeCancelSheet() {
    if (cancellationInFlight) return;
    pendingCancelOrderId = null;
    document.getElementById('qkOrderCancelSheet')?.classList.remove('show');
  }

  function openCancelSheet(orderId) {
    const order = state.orders.find((item) => item.id === orderId);
    if (!canCustomerCancel(order)) {
      showOrderToast('A rider has already been assigned. This order can no longer be cancelled.', true);
      return;
    }

    pendingCancelOrderId = orderId;
    const sheet = ensureCancelSheet();
    const number = sheet.querySelector('#qkOrderCancelNumber');
    if (number) number.textContent = `Order #${orderNumber(order)}`;
    sheet.classList.add('show');
    window.setTimeout(() => sheet.querySelector('[data-confirm-order-cancel]')?.focus(), 80);
  }

  async function cancelCustomerOrder() {
    if (cancellationInFlight || !pendingCancelOrderId) return;
    const orderId = pendingCancelOrderId;
    const sheet = ensureCancelSheet();
    const confirmButton = sheet.querySelector('[data-confirm-order-cancel]');
    const keepButton = sheet.querySelector('[data-cancel-sheet-close]');
    const userId = state.user?.uid;

    if (!db || !userId) {
      showOrderToast('Order service is still connecting. Please try again.', true);
      return;
    }

    cancellationInFlight = true;
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Cancelling…';
    }
    if (keepButton) keepButton.disabled = true;

    try {
      const orderRef = db.collection('orders').doc(orderId);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists) throw new Error('ORDER_NOT_FOUND');
        const latestOrder = snapshot.data();
        if (latestOrder.customerId !== userId) throw new Error('NOT_ALLOWED');
        if (!canCustomerCancel(latestOrder)) throw new Error('RIDER_ALREADY_ASSIGNED');

        const now = firebase.firestore.FieldValue.serverTimestamp();
        transaction.update(orderRef, {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now
        });
      });

      const localOrder = state.orders.find((order) => order.id === orderId);
      if (localOrder) {
        localOrder.status = 'cancelled';
      }
      sheet.classList.remove('show');
      pendingCancelOrderId = null;
      renderOrders();
      showOrderToast('Order cancelled successfully.');
    } catch (error) {
      console.error('Customer order cancellation failed:', error);
      const riderAssigned = error?.message === 'RIDER_ALREADY_ASSIGNED';
      const permissionDenied = error?.code === 'permission-denied' || error?.message === 'NOT_ALLOWED';
      if (riderAssigned) {
        sheet.classList.remove('show');
        pendingCancelOrderId = null;
      }
      showOrderToast(riderAssigned
        ? 'A rider has already been assigned. This order can no longer be cancelled.'
        : permissionDenied
          ? 'Cancellation permission was denied. Please try again later.'
          : 'Could not cancel the order. Please try again.', true);
    } finally {
      cancellationInFlight = false;
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Yes, cancel order';
      }
      if (keepButton) keepButton.disabled = false;
    }
  }

  function detailMarkup(order) {
    const meta = statusMeta(order.status);
    const number = orderNumber(order);
    const customerName = order.customerName || order.drop?.name || 'Customer';
    const phone = order.customerPhone || '';
    const address = order.drop?.address || 'Saved delivery address';
    const payment = order.paymentMode || 'Cash on Delivery';
    const paymentState = String(order.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : payment;

    return `<div class="view qk-orders-view qk-order-detail-view">
      <div class="qk-orders-scroll">
        <button class="qk-orders-back" type="button" data-orders-back>${backIcon()}<span>Back to all orders</span></button>
        <section class="qk-order-detail-hero ${meta.tone}">
          <span class="qk-order-detail-icon">${statusIcon(meta.tone)}</span>
          <div><small>${escapeValue(storeName(order))}</small><strong>${escapeValue(meta.title)}</strong><p>${escapeValue(meta.description)}</p></div>
        </section>

        <section class="qk-order-detail-card">
          <h2>Order status</h2>
          ${timelineMarkup(order)}
        </section>

        <section class="qk-order-detail-card">
          <div class="qk-order-section-head"><h2>${itemCount(order)} item${itemCount(order) === 1 ? '' : 's'} in this order</h2><span>${formatMoney(order.totalAmount)}</span></div>
          <div class="qk-order-items">${itemRows(order)}</div>
        </section>

        <section class="qk-order-detail-card">
          <h2>Bill details</h2>
          <div class="qk-order-bill">${billMarkup(order)}</div>
        </section>

        <section class="qk-order-detail-card">
          <h2>Delivery details</h2>
          <div class="qk-order-address">
            <span>${pinIcon()}</span>
            <div><strong>${escapeValue(customerName)}</strong><p>${escapeValue(address)}</p>${phone ? `<small>${escapeValue(phone)}</small>` : ''}</div>
          </div>
        </section>

        <section class="qk-order-detail-card qk-order-info-card">
          <h2>Order information</h2>
          <div><span>Order ID</span><strong>#${escapeValue(number)}</strong></div>
          <div><span>Placed on</span><strong>${escapeValue(formatDate(order, true))}</strong></div>
          <div><span>Payment</span><strong>${escapeValue(paymentState)}</strong></div>
          <div><span>Store</span><strong>${escapeValue(storeName(order))}</strong></div>
        </section>

        <div class="qk-order-detail-action">${detailAction(order)}</div>
      </div>
    </div>`;
  }

  function renderBuyQkOrders() {
    const main = document.getElementById('appMain');
    if (!main) return;
    const orders = Array.isArray(state?.orders) ? state.orders : [];
    const selected = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) : null;
    if (selectedOrderId && !selected) selectedOrderId = null;
    main.innerHTML = selected ? detailMarkup(selected) : listMarkup(orders);
    const scroll = main.querySelector('.qk-orders-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  if (typeof renderOrders === 'function') {
    renderOrders = renderBuyQkOrders;
  }

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) selectedOrderId = null;

    const openButton = event.target.closest('[data-order-open]');
    if (openButton) {
      selectedOrderId = openButton.dataset.orderOpen;
      renderOrders();
      return;
    }

    const cancelButton = event.target.closest('[data-order-cancel]');
    if (cancelButton) {
      event.preventDefault();
      openCancelSheet(cancelButton.dataset.orderCancel);
      return;
    }

    if (event.target.closest('[data-confirm-order-cancel]')) {
      event.preventDefault();
      cancelCustomerOrder();
      return;
    }

    if (event.target.closest('[data-cancel-sheet-close]')) {
      closeCancelSheet();
      return;
    }

    if (event.target.closest('[data-orders-back]')) {
      selectedOrderId = null;
      renderOrders();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCancelSheet();
  });
})();
