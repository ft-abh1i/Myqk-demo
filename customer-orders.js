import { authReady, db } from './customer-firebase.js';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const STATUS_COPY = {
  pending: ['Order placed', 'We are finding a delivery partner for your order.'],
  accepted: ['Rider assigned', 'Your delivery partner is heading to the store.'],
  arrived_pickup: ['Rider reached store', 'Your order is being collected from the store.'],
  picked_up: ['Out for delivery', 'Your order is on the way.'],
  completed: ['Delivered', 'Your order was delivered successfully.'],
  cancelled: ['Cancelled', 'This order was cancelled.']
};

const STATUS_STEPS = ['pending', 'accepted', 'picked_up', 'completed'];
let orders = [];
let currentTab = 'darkstore';

function timestampValue(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  const time = timestampValue(value);
  if (!time) return 'Just now';
  return new Date(time).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function statusIndex(status) {
  if (status === 'arrived_pickup') return 1;
  return Math.max(0, STATUS_STEPS.indexOf(status));
}

function latestTrackableOrder() {
  return orders.find((order) => !['completed', 'cancelled'].includes(order.status)) || orders[0] || null;
}

function itemSummary(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return `${Number(order.itemCount || 0)} items`;
  const names = items.slice(0, 2).map((item) => item.name).filter(Boolean);
  const extra = items.length > 2 ? ` +${items.length - 2} more` : '';
  return `${names.join(', ')}${extra}`;
}

function orderCard(order) {
  const [title, description] = STATUS_COPY[order.status] || ['Order update', 'Your order status was updated.'];
  return `
    <article class="fq-order-card">
      <div class="fq-order-main">
        <div class="fq-order-thumb">QK</div>
        <div class="fq-order-copy">
          <strong>${order.pickup?.name || 'QK Store'}</strong>
          <p>${itemSummary(order)}</p>
          <small>Order #${order.orderNumber || order.id} · ${formatDate(order.createdAt)}</small>
        </div>
        <span class="fq-chevron">›</span>
      </div>
      <div class="fq-order-status-row ${order.status}">
        <span class="fq-status-dot"></span>
        <div><strong>${title}</strong><p>${description}</p></div>
      </div>
    </article>`;
}

function renderOrders() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'orders') return;
  main.innerHTML = `
    <div class="view fq-orders-view">
      <div class="fq-topbar"><h2>My Orders</h2><p>Track, review and manage your purchases</p></div>
      <div class="fq-order-list">
        ${orders.length ? orders.map(orderCard).join('') : '<div class="fq-empty"><div class="fq-empty-icon">□</div><strong>No orders yet</strong><p>Your placed orders will appear here.</p></div>'}
      </div>
    </div>`;
}

function timeline(order) {
  const active = statusIndex(order.status);
  const labels = ['Order placed', 'Rider assigned', 'Out for delivery', 'Delivered'];
  return labels.map((label, index) => `
    <div class="fq-step ${index <= active && order.status !== 'cancelled' ? 'done' : ''}">
      <span class="fq-step-dot">${index < active ? '✓' : ''}</span>
      <div><strong>${label}</strong>${index === active ? `<p>${STATUS_COPY[order.status]?.[1] || ''}</p>` : ''}</div>
    </div>`).join('');
}

function renderTrack() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'track') return;
  const order = latestTrackableOrder();
  if (!order) {
    main.innerHTML = '<div class="view fq-empty"><div class="fq-empty-icon">⌖</div><strong>Nothing to track</strong><p>Place an order to see live delivery updates.</p></div>';
    return;
  }

  const [title] = STATUS_COPY[order.status] || ['Order update'];
  main.innerHTML = `
    <div class="view fq-track-view">
      <div class="fq-topbar"><h2>Track Order</h2><p>Order #${order.orderNumber || order.id}</p></div>
      <section class="fq-track-summary">
        <div class="fq-summary-icon">QK</div>
        <div><small>${order.pickup?.name || 'QK Store'}</small><strong>${title}</strong><p>${itemSummary(order)}</p></div>
      </section>
      <section class="fq-timeline-card">${timeline(order)}</section>
      <section class="fq-address-card">
        <small>DELIVERY ADDRESS</small>
        <strong>${order.drop?.name || 'Customer'}</strong>
        <p>${order.drop?.address || 'Saved delivery address'}</p>
      </section>
      <section class="fq-help-card"><div><strong>Need help with this order?</strong><p>Contact support for delivery assistance.</p></div><button type="button">Help</button></section>
    </div>`;
}

function renderCurrentTab() {
  if (currentTab === 'orders') renderOrders();
  if (currentTab === 'track') renderTrack();
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .fq-orders-view,.fq-track-view{padding-bottom:20px}.fq-topbar{padding:4px 2px 18px}.fq-topbar h2{margin:0;font-size:24px;color:#111827}.fq-topbar p{margin:5px 0 0;color:#6b7280;font-size:13px}.fq-order-list{display:grid;gap:10px}
    .fq-order-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}.fq-order-main{display:grid;grid-template-columns:48px 1fr 20px;gap:12px;align-items:center;padding:14px}.fq-order-thumb,.fq-summary-icon{width:48px;height:48px;border-radius:10px;background:#071a3b;color:#f8cb46;display:grid;place-items:center;font-size:13px;font-weight:800}.fq-order-copy{min-width:0}.fq-order-copy strong{display:block;font-size:14px;color:#111827}.fq-order-copy p{margin:4px 0;color:#4b5563;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fq-order-copy small{color:#9ca3af;font-size:10px}.fq-chevron{font-size:24px;color:#9ca3af}
    .fq-order-status-row{display:flex;gap:10px;padding:12px 14px;border-top:1px solid #eef0f3;background:#fafafa}.fq-status-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;background:#f59e0b;flex:0 0 auto}.fq-order-status-row.completed .fq-status-dot{background:#16a34a}.fq-order-status-row.cancelled .fq-status-dot{background:#dc2626}.fq-order-status-row strong{display:block;font-size:12px}.fq-order-status-row p{margin:2px 0 0;color:#6b7280;font-size:11px;line-height:1.35}
    .fq-track-summary,.fq-timeline-card,.fq-address-card,.fq-help-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px}.fq-track-summary{display:flex;gap:12px;align-items:center;padding:14px}.fq-track-summary small{display:block;color:#6b7280;font-size:11px}.fq-track-summary strong{display:block;margin:3px 0;font-size:17px;color:#111827}.fq-track-summary p{margin:0;color:#6b7280;font-size:12px}.fq-timeline-card{margin-top:12px;padding:18px 16px}.fq-step{display:grid;grid-template-columns:24px 1fr;gap:10px;position:relative;padding-bottom:22px}.fq-step:last-child{padding-bottom:0}.fq-step:not(:last-child):before{content:"";position:absolute;left:11px;top:22px;width:2px;height:calc(100% - 8px);background:#e5e7eb}.fq-step.done:not(:last-child):before{background:#2874f0}.fq-step-dot{width:22px;height:22px;border-radius:50%;border:2px solid #d1d5db;background:#fff;color:#fff;display:grid;place-items:center;font-size:10px;z-index:1}.fq-step.done .fq-step-dot{border-color:#2874f0;background:#2874f0}.fq-step strong{font-size:13px;color:#111827}.fq-step p{margin:4px 0 0;color:#6b7280;font-size:11px;line-height:1.4}.fq-address-card{margin-top:12px;padding:14px}.fq-address-card small{color:#6b7280;font-size:10px;font-weight:700}.fq-address-card strong{display:block;margin:6px 0 3px;font-size:13px}.fq-address-card p{margin:0;color:#6b7280;font-size:12px;line-height:1.45}.fq-help-card{margin-top:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.fq-help-card strong{font-size:13px}.fq-help-card p{margin:3px 0 0;color:#6b7280;font-size:11px}.fq-help-card button{border:1px solid #2874f0;background:#fff;color:#2874f0;border-radius:8px;padding:8px 15px;font-weight:700}
    .fq-empty{min-height:48vh;display:grid;place-content:center;text-align:center;padding:28px;color:#6b7280}.fq-empty-icon{width:58px;height:58px;border-radius:50%;background:#f3f4f6;display:grid;place-items:center;margin:0 auto 12px;font-size:24px;color:#374151}.fq-empty strong{font-size:18px;color:#111827}.fq-empty p{margin:6px 0 0;font-size:13px}
  `;
  document.head.appendChild(style);
}

async function startOrderListener() {
  const user = await authReady;
  if (!user) return;
  const customerOrders = query(collection(db, 'orders'), where('customerId', '==', user.uid));
  onSnapshot(customerOrders, (snapshot) => {
    orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
    renderCurrentTab();
  }, (error) => console.error('Customer order listener failed:', error));
}

document.addEventListener('DOMContentLoaded', () => {
  installStyles();
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]')?.dataset.tab;
    if (!tab) return;
    currentTab = tab;
    window.setTimeout(renderCurrentTab, 0);
  });
  startOrderListener();
});