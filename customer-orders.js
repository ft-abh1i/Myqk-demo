import { authReady, db } from './customer-firebase.js';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const STATUS_COPY = {
  pending: ['Order placed', 'Waiting for a nearby rider to accept your order.'],
  accepted: ['Rider assigned', 'Your rider is heading to the pickup store.'],
  arrived_pickup: ['Rider at store', 'Your rider has reached the pickup point.'],
  picked_up: ['Out for delivery', 'Your order is on the way to you.'],
  completed: ['Delivered', 'Your order has been delivered successfully.'],
  cancelled: ['Cancelled', 'This order was cancelled.']
};

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
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function progressFor(status) {
  return {
    pending: 15,
    accepted: 35,
    arrived_pickup: 55,
    picked_up: 78,
    completed: 100,
    cancelled: 0
  }[status] ?? 10;
}

function latestTrackableOrder() {
  const active = orders.find((order) => !['completed', 'cancelled'].includes(order.status));
  return active || orders[0] || null;
}

function orderCard(order) {
  const [title] = STATUS_COPY[order.status] || [order.status];
  const itemCount = Number(order.itemCount || order.items?.length || 0);
  return `
    <article class="qk-order-history-card">
      <div class="qk-order-card-head">
        <div><small>${formatDate(order.createdAt)}</small><strong>#${order.orderNumber || order.id}</strong></div>
        <span class="qk-order-status ${order.status}">${title}</span>
      </div>
      <div class="qk-order-route"><b>${order.pickup?.name || 'QK Store'}</b><span>→</span><b>${order.drop?.address || 'Delivery address'}</b></div>
      <div class="qk-order-meta"><span>${itemCount} item${itemCount === 1 ? '' : 's'}</span><span>${order.paymentMode || 'Cash on Delivery'}</span></div>
    </article>`;
}

function renderOrders() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'orders') return;
  main.innerHTML = `
    <div class="view qk-orders-view">
      <div class="qk-page-heading"><small>YOUR ACTIVITY</small><h2>My Orders</h2><p>All orders placed from this device.</p></div>
      <div class="qk-order-list">
        ${orders.length ? orders.map(orderCard).join('') : '<div class="qk-empty-orders"><strong>No orders yet</strong><p>Your placed orders will appear here.</p></div>'}
      </div>
    </div>`;
}

function renderTrack() {
  const main = document.getElementById('appMain');
  if (!main || currentTab !== 'track') return;
  const order = latestTrackableOrder();
  if (!order) {
    main.innerHTML = '<div class="view qk-empty-orders"><strong>Nothing to track</strong><p>Place an order to see live delivery updates.</p></div>';
    return;
  }

  const [title, description] = STATUS_COPY[order.status] || ['Order update', 'Your order status was updated.'];
  main.innerHTML = `
    <div class="view qk-track-view">
      <div class="qk-page-heading"><small>LIVE ORDER</small><h2>#${order.orderNumber || order.id}</h2><p>${formatDate(order.createdAt)}</p></div>
      <div class="qk-track-card">
        <div class="qk-track-icon">${order.status === 'completed' ? '✓' : '●'}</div>
        <h3>${title}</h3>
        <p>${description}</p>
        <div class="qk-progress"><span style="width:${progressFor(order.status)}%"></span></div>
        <div class="qk-track-route">
          <div><small>Pickup</small><strong>${order.pickup?.name || 'QK Store'}</strong><p>${order.pickup?.address || ''}</p></div>
          <div><small>Delivery</small><strong>${order.drop?.name || 'Customer'}</strong><p>${order.drop?.address || ''}</p></div>
        </div>
      </div>
    </div>`;
}

function renderCurrentTab() {
  if (currentTab === 'orders') renderOrders();
  if (currentTab === 'track') renderTrack();
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .qk-page-heading{padding:6px 2px 16px}.qk-page-heading small{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.qk-page-heading h2{margin:5px 0 4px;font-size:26px}.qk-page-heading p{margin:0;color:#64748b;font-size:13px}
    .qk-order-list{display:grid;gap:12px}.qk-order-history-card,.qk-track-card{background:#fff;border:1px solid #e8edf3;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.05)}
    .qk-order-card-head{display:flex;justify-content:space-between;gap:12px}.qk-order-card-head div{display:grid;gap:3px}.qk-order-card-head small{color:#64748b;font-size:11px}.qk-order-card-head strong{font-size:16px}.qk-order-status{align-self:flex-start;padding:6px 9px;border-radius:999px;background:#eef2ff;font-size:10px;font-weight:800}.qk-order-status.completed{background:#dcfce7;color:#166534}.qk-order-status.cancelled{background:#fee2e2;color:#991b1b}
    .qk-order-route{display:flex;align-items:center;gap:8px;margin:15px 0;font-size:12px}.qk-order-route b{font-weight:650}.qk-order-route span{color:#94a3b8}.qk-order-meta{display:flex;justify-content:space-between;color:#64748b;font-size:11px;border-top:1px solid #eef2f7;padding-top:11px}
    .qk-empty-orders{min-height:45vh;display:grid;place-content:center;text-align:center;padding:24px;color:#64748b}.qk-empty-orders strong{font-size:20px;color:#0f172a}.qk-empty-orders p{margin:6px 0 0}
    .qk-track-card{text-align:center}.qk-track-icon{width:54px;height:54px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:#071a3b;color:#f8cb46;font-size:22px;font-weight:900}.qk-track-card h3{margin:0;font-size:22px}.qk-track-card>p{margin:7px auto 18px;max-width:280px;color:#64748b;font-size:13px;line-height:1.5}.qk-progress{height:8px;background:#e9eef5;border-radius:999px;overflow:hidden}.qk-progress span{display:block;height:100%;background:#071a3b;border-radius:inherit;transition:width .3s ease}.qk-track-route{display:grid;gap:12px;text-align:left;margin-top:18px}.qk-track-route div{padding:13px;border-radius:13px;background:#f8fafc}.qk-track-route small{display:block;color:#64748b;font-size:10px;text-transform:uppercase;font-weight:800}.qk-track-route strong{display:block;margin:3px 0;font-size:14px}.qk-track-route p{margin:0;color:#64748b;font-size:11px}
  `;
  document.head.appendChild(style);
}

async function startOrderListener() {
  const user = await authReady;
  if (!user) return;
  const customerOrders = query(collection(db, 'orders'), where('customerId', '==', user.uid));
  onSnapshot(customerOrders, (snapshot) => {
    orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
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
