import { authReady, db } from './customer-firebase.js';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const STATUS_COPY = {
  pending: ['Order placed', 'We are finding a delivery partner for your order.'],
  accepted: ['Rider assigned', 'Your delivery partner is heading to the store.'],
  arrived_pickup: ['Rider reached store', 'Your order is being collected.'],
  picked_up: ['Out for delivery', 'Your order is on the way.'],
  completed: ['Delivered', 'Your order was delivered successfully.'],
  cancelled: ['Cancelled', 'This order was cancelled.']
};

const STATUS_STEPS = ['pending', 'accepted', 'picked_up', 'completed'];
let orders = [];
let currentTab = 'darkstore';
let currentUser = null;

function timestampValue(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  const time = timestampValue(value);
  if (!time) return 'Just now';
  return new Date(time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${Math.round(amount)}` : '—';
}

function statusIndex(status) {
  if (status === 'arrived_pickup') return 1;
  return Math.max(0, STATUS_STEPS.indexOf(status));
}

function liveOrder() {
  return orders.find((order) => !['completed', 'cancelled'].includes(order.status)) || null;
}

function itemSummary(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return `${Number(order.itemCount || 0)} items`;
  const names = items.slice(0, 2).map((item) => item.name).filter(Boolean);
  return `${names.join(', ')}${items.length > 2 ? ` +${items.length - 2} more` : ''}`;
}

function itemLines(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return '<p class="uq-muted">Item details unavailable.</p>';
  return items.map((item) => `
    <div class="uq-item-line">
      <div><strong>${item.name || 'Item'}</strong><small>${item.unit || ''} · Qty ${Number(item.quantity || 1)}</small></div>
      <span>${item.lineTotal ? money(item.lineTotal) : ''}</span>
    </div>`).join('');
}

function billLines(order) {
  if (!Number.isFinite(Number(order.totalAmount))) return '';
  return `
    <div class="uq-bill">
      <div><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div>
      <div><span>Delivery fee</span><strong>${Number(order.deliveryFee) === 0 ? 'FREE' : money(order.deliveryFee)}</strong></div>
      <div><span>Platform fee</span><strong>${money(order.platformFee)}</strong></div>
      <div class="uq-bill-total"><span>Total</span><strong>${money(order.totalAmount)}</strong></div>
    </div>`;
}

function orderCard(order) {
  const [title, description] = STATUS_COPY[order.status] || ['Order update', 'Your order status was updated.'];
  return `
    <article class="uq-order-card" data-order-card="${order.id}">
      <div class="uq-order-head">
        <div class="uq-store-mark">QK</div>
        <div class="uq-order-title">
          <strong>${order.pickup?.name || 'QK Store'}</strong>
          <p>${itemSummary(order)}</p>
        </div>
        <span class="uq-status ${order.status}">${title}</span>
      </div>
      <div class="uq-order-details">
        <div><small>ORDER ID</small><strong>#${order.orderNumber || order.id}</strong></div>
        <div><small>PLACED ON</small><strong>${formatDate(order.createdAt)}</strong></div>
        <div><small>PAYMENT</small><strong>${order.paymentMode || 'Cash on Delivery'}</strong></div>
      </div>
      <div class="uq-expandable">
        <div class="uq-items">${itemLines(order)}</div>
        ${billLines(order)}
        <div class="uq-address-row">
          <span class="uq-pin">⌖</span>
          <div><small>DELIVERY ADDRESS</small><p>${order.drop?.address || 'Saved delivery address'}</p></div>
        </div>
      </div>
      <div class="uq-order-foot ${order.status}">
        <span class="uq-dot"></span>
        <div><strong>${title}</strong><p>${description}</p></div>
        ${order.status === 'pending' ? `<button class="uq-cancel-btn" data-cancel-order="${order.id}" type="button">Cancel</button>` : ''}
      </div>
    </article>`;
}

function renderOrders() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'orders') return;
  main.innerHTML = `
    <div class="view uq-orders-view">
      <div class="uq-page-head"><h2>My Orders</h2><p>Your current and previous orders</p></div>
      <div class="uq-order-list">
        ${orders.length ? orders.map(orderCard).join('') : '<div class="uq-empty"><div>□</div><strong>No orders yet</strong><p>Your placed orders will appear here.</p></div>'}
      </div>
    </div>`;
}

function timeline(order) {
  const active = statusIndex(order.status);
  const labels = ['Order placed', 'Rider assigned', 'Out for delivery', 'Delivered'];
  return labels.map((label, index) => `
    <div class="uq-step ${index <= active ? 'done' : ''} ${index === active ? 'current' : ''}">
      <span>${index < active ? '✓' : ''}</span>
      <div><strong>${label}</strong>${index === active ? `<p>${STATUS_COPY[order.status]?.[1] || ''}</p>` : ''}</div>
    </div>`).join('');
}

function renderTrack() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'track') return;
  const order = liveOrder();
  if (!order) {
    main.innerHTML = '<div class="view uq-empty"><div>⌖</div><strong>No live order</strong><p>Your active delivery will appear here.</p></div>';
    return;
  }

  const [title] = STATUS_COPY[order.status] || ['Order update'];
  main.innerHTML = `
    <div class="view uq-track-view">
      <div class="uq-page-head"><h2>Track Order</h2><p>Live delivery status</p></div>
      <section class="uq-live-card">
        <div class="uq-live-top">
          <div class="uq-store-mark">QK</div>
          <div><small>ORDER #${order.orderNumber || order.id}</small><strong>${title}</strong></div>
          <span class="uq-live-badge">LIVE</span>
        </div>
        <div class="uq-timeline">${timeline(order)}</div>
      </section>
    </div>`;
}

function renderLiveBanner() {
  const banner = document.getElementById('liveOrderBanner');
  if (!banner) return;
  const order = liveOrder();
  const show = currentTab === 'darkstore' && Boolean(order);
  banner.classList.toggle('hidden', !show);
  if (!show) {
    banner.innerHTML = '';
    return;
  }
  const [title, description] = STATUS_COPY[order.status] || ['Order update', 'Your order is moving forward.'];
  banner.innerHTML = `
    <button type="button" data-open-live-order>
      <div><small>LIVE ORDER · #${order.orderNumber || order.id}</small><strong>${title}</strong><p>${description}</p></div>
      <span class="live-arrow">›</span>
    </button>`;
}

function renderCurrentTab() {
  renderLiveBanner();
  if (currentTab === 'orders') renderOrders();
  if (currentTab === 'track') renderTrack();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

async function cancelOrder(orderId, button) {
  if (!currentUser || !orderId || button.disabled) return;
  button.disabled = true;
  button.textContent = 'Cancelling…';
  try {
    const orderRef = doc(db, 'orders', orderId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists()) throw new Error('ORDER_NOT_FOUND');
      const order = snapshot.data();
      if (order.customerId !== currentUser.uid) throw new Error('NOT_ALLOWED');
      if (order.status !== 'pending' || order.assignedRiderId) throw new Error('ALREADY_ACCEPTED');
      transaction.update(orderRef, { status: 'cancelled', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    showToast('Order cancelled.');
  } catch (error) {
    console.error('Order cancellation failed:', error);
    showToast(error.message === 'ALREADY_ACCEPTED' ? 'Rider assigned ho chuka hai, order cancel nahi ho sakta.' : 'Order cancel nahi hua. Try again.');
    button.disabled = false;
    button.textContent = 'Cancel';
  }
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .uq-orders-view,.uq-track-view{padding-bottom:18px}.uq-page-head{padding:4px 2px 16px}.uq-page-head h2{margin:0;color:#111827;font-size:24px}.uq-page-head p{margin:4px 0 0;color:#6b7280;font-size:13px}.uq-order-list{display:grid;gap:12px}
    .uq-order-card,.uq-live-card{background:#fff;border:1px solid #e8ebf0;border-radius:16px;box-shadow:0 5px 18px rgba(15,23,42,.04);overflow:hidden}.uq-order-head{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;padding:14px}.uq-store-mark{width:44px;height:44px;border-radius:12px;background:#071a3b;color:#f8cb46;display:grid;place-items:center;font-size:12px;font-weight:800}.uq-order-title{min-width:0}.uq-order-title strong{display:block;color:#111827;font-size:14px}.uq-order-title p{margin:4px 0 0;color:#6b7280;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.uq-status{padding:5px 8px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:9px;font-weight:800}.uq-status.completed{background:#ecfdf3;color:#15803d}.uq-status.cancelled{background:#fef2f2;color:#dc2626}
    .uq-order-details{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 14px;border-top:1px solid #f0f2f5}.uq-order-details div{min-width:0}.uq-order-details small,.uq-address-row small{display:block;color:#9ca3af;font-size:8px;font-weight:800;letter-spacing:.05em}.uq-order-details strong{display:block;margin-top:4px;color:#374151;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.uq-expandable{border-top:1px solid #f0f2f5}.uq-items{padding:10px 14px}.uq-item-line{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:6px 0}.uq-item-line strong{display:block;font-size:11px;color:#1f2937}.uq-item-line small{display:block;margin-top:3px;color:#94a3b8;font-size:9px}.uq-item-line>span{font-size:10px;font-weight:700;color:#334155}.uq-muted{margin:0;color:#94a3b8;font-size:10px}.uq-bill{padding:10px 14px;border-top:1px dashed #e5e7eb}.uq-bill>div{display:flex;justify-content:space-between;padding:4px 0;color:#64748b;font-size:10px}.uq-bill strong{color:#334155}.uq-bill-total{margin-top:4px;padding-top:8px!important;border-top:1px solid #eef0f3;font-size:11px!important}.uq-bill-total span,.uq-bill-total strong{color:#111827!important;font-weight:800}.uq-address-row{display:flex;gap:9px;padding:12px 14px;border-top:1px solid #f0f2f5}.uq-pin{color:#071a3b;font-size:17px}.uq-address-row p{margin:4px 0 0;color:#4b5563;font-size:11px;line-height:1.4}.uq-order-foot{display:grid;grid-template-columns:8px 1fr auto;gap:9px;padding:11px 14px;background:#fafafa;border-top:1px solid #f0f2f5;align-items:start}.uq-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;background:#f59e0b}.uq-order-foot.completed .uq-dot{background:#16a34a}.uq-order-foot.cancelled .uq-dot{background:#dc2626}.uq-order-foot strong{font-size:11px;color:#111827}.uq-order-foot p{margin:2px 0 0;color:#6b7280;font-size:10px;line-height:1.35}.uq-cancel-btn{align-self:center;border:1px solid #dc2626;background:#fff;color:#dc2626;border-radius:9px;padding:7px 10px;font-size:9px;font-weight:800}.uq-cancel-btn:disabled{opacity:.55}
    .uq-live-card{padding:16px}.uq-live-top{display:grid;grid-template-columns:44px 1fr auto;gap:11px;align-items:center;padding-bottom:16px;border-bottom:1px solid #eef0f3}.uq-live-top small{display:block;color:#9ca3af;font-size:9px;font-weight:800}.uq-live-top strong{display:block;margin-top:4px;color:#111827;font-size:17px}.uq-live-badge{padding:5px 8px;border-radius:999px;background:#ecfdf3;color:#15803d;font-size:9px;font-weight:900}.uq-timeline{padding-top:18px}.uq-step{display:grid;grid-template-columns:22px 1fr;gap:10px;position:relative;padding-bottom:21px}.uq-step:last-child{padding-bottom:0}.uq-step:not(:last-child):before{content:"";position:absolute;left:10px;top:21px;width:2px;height:calc(100% - 4px);background:#e5e7eb}.uq-step.done:not(:last-child):before{background:#071a3b}.uq-step>span{width:20px;height:20px;border-radius:50%;border:2px solid #d1d5db;background:#fff;color:#fff;display:grid;place-items:center;font-size:9px;z-index:1}.uq-step.done>span{border-color:#071a3b;background:#071a3b}.uq-step.current>span{box-shadow:0 0 0 4px rgba(248,203,70,.28)}.uq-step strong{font-size:12px;color:#111827}.uq-step p{margin:4px 0 0;color:#6b7280;font-size:10px;line-height:1.4}
    .uq-empty{min-height:48vh;display:grid;place-content:center;text-align:center;padding:28px;color:#6b7280}.uq-empty>div{width:58px;height:58px;border-radius:50%;background:#f3f4f6;display:grid;place-items:center;margin:0 auto 12px;font-size:24px;color:#374151}.uq-empty strong{font-size:18px;color:#111827}.uq-empty p{margin:6px 0 0;font-size:13px}
  `;
  document.head.appendChild(style);
}

async function startOrderListener() {
  currentUser = await authReady;
  if (!currentUser) return;
  const customerOrders = query(collection(db, 'orders'), where('customerId', '==', currentUser.uid));
  onSnapshot(customerOrders, (snapshot) => {
    orders = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
    renderCurrentTab();
  }, (error) => console.error('Customer order listener failed:', error));
}

document.addEventListener('DOMContentLoaded', () => {
  installStyles();
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]')?.dataset.tab;
    if (tab) {
      currentTab = tab;
      window.setTimeout(renderCurrentTab, 0);
    }

    if (event.target.closest('[data-open-live-order]')) {
      document.querySelector('[data-tab="track"]')?.click();
    }

    const cancelButton = event.target.closest('[data-cancel-order]');
    if (cancelButton) cancelOrder(cancelButton.dataset.cancelOrder, cancelButton);
  });
  startOrderListener();
});