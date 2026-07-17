import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { addDoc, collection, getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyDbNDNI1a69VDZmLo7Se6LNGPLD6A8_MmE',
  authDomain: 'buyqk-rider.firebaseapp.com',
  projectId: 'buyqk-rider',
  storageBucket: 'buyqk-rider.firebasestorage.app',
  messagingSenderId: '61147606971',
  appId: '1:61147606971:web:d69dd4fcf5c0a0fea01e9e'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let authReadyResolve;
export const authReady = new Promise((resolve) => { authReadyResolve = resolve; });

onAuthStateChanged(auth, async (user) => {
  if (user) return authReadyResolve(user);
  try {
    const credential = await signInAnonymously(auth);
    authReadyResolve(credential.user);
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    authReadyResolve(null);
  }
});

function numberFromStorage(key) {
  const value = Number.parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : null;
}

function numberFromDataset(element, key) {
  const value = Number.parseFloat(element?.dataset?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function getCartSummary() {
  const cards = [...document.querySelectorAll('#cartBody [data-cart-product]')];
  const items = cards.map((card) => {
    const name = card.querySelector('.product-name')?.textContent?.trim() || 'Item';
    const unit = card.querySelector('.product-unit')?.textContent?.trim() || '';
    const store = card.querySelector('.product-store-tag')?.textContent?.trim() || 'QK Store';
    const quantity = Number.parseInt(card.querySelector('.qty')?.textContent || '1', 10) || 1;
    const lineTotal = Number(card.querySelector('.product-price')?.textContent?.replace(/[^0-9.]/g, '')) || 0;
    return { name, unit, store, quantity, lineTotal };
  });
  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    pickupName: items[0]?.store || 'QK Dark Store'
  };
}

function showCheckoutError(message) {
  const errorBox = document.getElementById('checkoutError');
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3000);
  }
}

function clearCheckoutError() {
  const errorBox = document.getElementById('checkoutError');
  if (errorBox) {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }
}

function setCheckoutState(button, loading) {
  button.disabled = loading;
  button.textContent = loading ? 'Placing order…' : 'Proceed to Buy';
}

function requireCustomerDetails() {
  const name = document.getElementById('customerNameInput')?.value.trim() || '';
  const phone = document.getElementById('customerPhoneInput')?.value.replace(/\D/g, '') || '';
  if (name.length < 2) throw new Error('Please enter the customer name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit mobile number.');
  localStorage.setItem('qkCustomerName', name);
  localStorage.setItem('qkCustomerPhone', phone);
  return { name, phone };
}

function requireCustomerLocation() {
  const latitude = numberFromStorage('qkLatitude');
  const longitude = numberFromStorage('qkLongitude');
  const address = localStorage.getItem('qkLiveLocation')?.trim();
  if (latitude === null || longitude === null || !address) {
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.getElementById('locationSheet')?.classList.add('show');
    document.body.classList.add('locked');
    throw new Error('Select your delivery location before placing the order.');
  }
  return { latitude, longitude, address };
}

async function createOrder() {
  const user = await authReady;
  if (!user) throw new Error('Could not connect to Firebase. Please retry.');
  const cart = getCartSummary();
  if (!cart.itemCount) throw new Error('Your cart is empty.');

  const customer = requireCustomerDetails();
  const customerLocation = requireCustomerLocation();
  const cartFooter = document.getElementById('cartFooter');
  const subtotal = numberFromDataset(cartFooter, 'subtotal');
  const deliveryFee = numberFromDataset(cartFooter, 'deliveryFee');
  const platformFee = numberFromDataset(cartFooter, 'platformFee');
  const totalAmount = numberFromDataset(cartFooter, 'payable');

  return addDoc(collection(db, 'orders'), {
    orderNumber: `QK${Date.now().toString().slice(-6)}`,
    customerId: user.uid,
    customerName: customer.name,
    customerPhone: customer.phone,
    status: 'pending',
    assignedRiderId: null,
    pickup: {
      name: cart.pickupName,
      address: `${cart.pickupName} fulfilment point`,
      location: { latitude: customerLocation.latitude + 0.002, longitude: customerLocation.longitude + 0.002 }
    },
    drop: {
      name: customer.name,
      address: customerLocation.address,
      location: { latitude: customerLocation.latitude, longitude: customerLocation.longitude }
    },
    items: cart.items,
    itemCount: cart.itemCount,
    paymentMode: 'Cash on Delivery',
    subtotal,
    deliveryFee,
    platformFee,
    totalAmount,
    riderPayout: 42,
    distanceKm: 0.4,
    durationText: '10 min',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const checkoutButton = document.getElementById('checkoutBtn');
  if (!checkoutButton) return;

  checkoutButton.addEventListener('click', async (event) => {
    if (checkoutButton.dataset.firebaseCommitted === 'true') {
      delete checkoutButton.dataset.firebaseCommitted;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    clearCheckoutError();
    setCheckoutState(checkoutButton, true);

    try {
      const order = await createOrder();
      localStorage.setItem('qkLatestOrderId', order.id);
      checkoutButton.dataset.firebaseCommitted = 'true';
      checkoutButton.click();
    } catch (error) {
      console.error('Order creation failed:', error);
      showCheckoutError(error?.message || 'Could not place order. Try again.');
    } finally {
      setCheckoutState(checkoutButton, false);
    }
  }, true);
});