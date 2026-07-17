const $ = (selector) => document.querySelector(selector);
const ORDER_LOCK_KEY = 'qkOrderPlacementLock';
const LOCK_TTL_MS = 20_000;

function toast(message, error = false) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  element.classList.toggle('error', error);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.classList.remove('show', 'error');
  }, 3200);
}

function readLock() {
  const value = Number(sessionStorage.getItem(ORDER_LOCK_KEY));
  return Number.isFinite(value) && Date.now() - value < LOCK_TTL_MS;
}

function setCheckoutAvailability() {
  const button = $('#checkoutBtn');
  if (!button) return;
  const offline = !navigator.onLine;
  button.disabled = offline || readLock();
  if (offline) button.textContent = 'Reconnect to continue';
  else if (readLock()) button.textContent = 'Placing order…';
  else if (button.textContent === 'Reconnect to continue' || button.textContent === 'Placing order…') button.textContent = 'Proceed to Buy';
}

function guardCheckout(event) {
  if (!navigator.onLine) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toast('Internet connection is required to place an order.', true);
    return;
  }
  if (readLock()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toast('Your order is already being placed.', true);
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
  if (!window.isSecureContext) toast('Secure HTTPS is required for live location.', true);
  if (!navigator.geolocation) {
    $('#allowLocationBtn')?.setAttribute('disabled', 'disabled');
    $('#useCurrentLocationBtn')?.setAttribute('disabled', 'disabled');
    toast('Location is not supported on this device.', true);
  }
}

window.addEventListener('online', () => {
  sessionStorage.removeItem(ORDER_LOCK_KEY);
  setCheckoutAvailability();
  toast('Internet connection restored.');
});
window.addEventListener('offline', () => {
  setCheckoutAvailability();
  toast('You are offline. Cart is saved on this device.', true);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled customer app error:', event.reason);
  sessionStorage.removeItem(ORDER_LOCK_KEY);
  setCheckoutAvailability();
});

document.addEventListener('DOMContentLoaded', () => {
  validateRuntime();
  setCheckoutAvailability();
  $('#checkoutBtn')?.addEventListener('click', guardCheckout, true);
});
