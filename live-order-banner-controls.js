'use strict';

(() => {
  const DISMISS_KEY = 'qkDismissedLiveOrderBanner';
  const previousUpdate = typeof updateLiveOrderBanner === 'function'
    ? updateLiveOrderBanner
    : null;

  if (!previousUpdate) return;

  function orderSignature(order) {
    return `${order.id || order.orderNumber || 'order'}:${order.status || 'active'}`;
  }

  function renderCompactLiveOrderBanner() {
    previousUpdate();

    const banner = document.getElementById('liveOrderBanner');
    const order = typeof activeOrder === 'function' ? activeOrder() : null;

    if (!banner || !order) {
      if (banner) {
        banner.classList.add('hidden');
        banner.innerHTML = '';
        delete banner.dataset.orderSignature;
      }
      return;
    }

    const signature = orderSignature(order);
    if (sessionStorage.getItem(DISMISS_KEY) === signature) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      banner.dataset.orderSignature = signature;
      return;
    }

    const orderNumber = order.orderNumber || String(order.id || '').slice(0, 6);
    banner.dataset.orderSignature = signature;
    banner.innerHTML = `
      <button class="live-order-open" type="button" data-tab="track" aria-label="Track order ${escapeHtml(orderNumber)}">
        <strong>Order #${escapeHtml(orderNumber)}</strong>
        <span>${escapeHtml(statusLabel(order.status))}</span>
      </button>
      <button class="live-order-close" type="button" data-live-order-close aria-label="Dismiss order status">×</button>
    `;
    banner.classList.remove('hidden');
  }

  updateLiveOrderBanner = renderCompactLiveOrderBanner;

  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-live-order-close]');
    if (!closeButton) return;

    event.preventDefault();
    event.stopPropagation();

    const banner = document.getElementById('liveOrderBanner');
    const signature = banner?.dataset.orderSignature;
    if (signature) sessionStorage.setItem(DISMISS_KEY, signature);

    if (banner) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
    }
  });

  document.addEventListener('DOMContentLoaded', renderCompactLiveOrderBanner);
})();
