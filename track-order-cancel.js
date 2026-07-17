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

let currentUser = null;
let pendingOrder = null;
let cancelling = false;

const CANCELLABLE_STATUSES = new Set(['pending', 'pending_merchant']);

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function isCancellable(order) {
  return Boolean(order && CANCELLABLE_STATUSES.has(order.status) && !order.assignedRiderId);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function installStyles() {
  if (document.getElementById('uqTrackCancelStyles')) return;
  const style = document.createElement('style');
  style.id = 'uqTrackCancelStyles';
  style.textContent = `
    .uq-track-cancel-card{margin-top:12px;padding:14px;background:#fff;border:1px solid #fecaca;border-radius:16px}
    .uq-track-cancel-card strong{display:block;color:#111827;font-size:13px}
    .uq-track-cancel-card p{margin:5px 0 12px;color:#6b7280;font-size:10px;line-height:1.5}
    .uq-track-cancel-btn{width:100%;min-height:44px;border:1px solid #dc2626;border-radius:12px;background:#fff;color:#dc2626;font:inherit;font-size:12px;font-weight:800}
    .uq-track-cancel-btn:active{transform:scale(.99)}
    .uq-track-cancel-btn:disabled{cursor:not-allowed;opacity:.55}
  `;
  document.head.appendChild(style);
}

function renderControl() {
  const trackView = document.querySelector('.uq-track-view');
  const existing = document.getElementById('uqTrackCancelCard');

  if (!trackView || !isCancellable(pendingOrder)) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.querySelector('button')?.setAttribute('data-order-id', pendingOrder.id);
    return;
  }

  const card = document.createElement('section');
  card.id = 'uqTrackCancelCard';
  card.className = 'uq-track-cancel-card';
  card.innerHTML = `
    <strong>Need to cancel?</strong>
    <p>You can cancel free of charge until a delivery partner accepts the order.</p>
    <button class="uq-track-cancel-btn" type="button" data-track-cancel data-order-id="${pendingOrder.id}">Cancel order</button>
  `;
  trackView.appendChild(card);
}

async function cancelPendingOrder(button) {
  if (!currentUser || !pendingOrder || cancelling) return;
  if (!window.confirm('Are you sure you want to cancel this order?')) return;

  cancelling = true;
  button.disabled = true;
  button.textContent = 'Cancelling…';

  try {
    const orderRef = doc(db, 'orders', pendingOrder.id);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists()) throw new Error('ORDER_NOT_FOUND');

      const order = snapshot.data();
      if (order.customerId !== currentUser.uid) throw new Error('NOT_ALLOWED');
      if (!isCancellable(order)) throw new Error('ALREADY_ACCEPTED');

      transaction.update(orderRef, {
        status: 'cancelled',
        cancelledBy: 'customer',
        cancellationReason: 'Cancelled by customer before rider assignment',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    showToast('Order cancelled successfully.');
  } catch (error) {
    console.error('Track page cancellation failed:', error);
    const accepted = error?.message === 'ALREADY_ACCEPTED';
    const denied = error?.code === 'permission-denied' || error?.message === 'NOT_ALLOWED';
    showToast(accepted
      ? 'A rider has already accepted this order. It can no longer be cancelled.'
      : denied
        ? 'Cancellation permission denied. Check Firestore rules.'
        : 'Could not cancel the order. Please try again.');
    if (!accepted) {
      button.disabled = false;
      button.textContent = 'Cancel order';
    }
  } finally {
    cancelling = false;
  }
}

async function initialize() {
  installStyles();
  currentUser = await authReady;
  if (!currentUser) return;

  const customerOrders = query(collection(db, 'orders'), where('customerId', '==', currentUser.uid));
  onSnapshot(customerOrders, (snapshot) => {
    pendingOrder = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isCancellable)
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))[0] || null;
    window.setTimeout(renderControl, 0);
  }, (error) => console.error('Track cancellation listener failed:', error));

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-track-cancel]');
    if (button) cancelPendingOrder(button);
    if (event.target.closest('[data-tab]')) window.setTimeout(renderControl, 40);
  });

  const appMain = document.getElementById('appMain');
  if (appMain) {
    new MutationObserver(() => {
      if (document.querySelector('.uq-track-view')) window.setTimeout(renderControl, 0);
    }).observe(appMain, { childList: true, subtree: true });
  }
}

document.addEventListener('DOMContentLoaded', initialize);