import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

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
export const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authReadyResolve(user);
    return;
  }

  try {
    const credential = await signInAnonymously(auth);
    authReadyResolve(credential.user);
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    authReadyResolve(null);
  }
});

function readRequiredNumber(key) {
  const value = Number.parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : null;
}

function getCartSummary() {
  const cards = [...document.querySelectorAll('#cartBody [data-cart-product]')];
  const items = cards.map((card) => {
    const name = card.querySelector('.product-name')?.textContent?.trim() || 'Item';
    const unit = card.querySelector('.product-unit')?.textContent?.trim() || '';
    const store = card.querySelector('.product-store-tag')?.textContent?.trim() || 'QK Store';
    const quantity = Number.parseInt(card.querySelector('.qty')?.textContent || '1', 10) || 1;
    return { name, unit, store, quantity };
  });

  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    pickupName: items[0]?.store || 'QK Dark Store'
  };
}

function setCheckoutState(button, loading) {
  button.disabled = loading;
  button.textContent = loading ? 'Placing order…' : 'Proceed to Buy';
}

function requireCustomerLocation() {
  const latitude = readRequiredNumber('qkLatitude');
  const longitude = readRequiredNumber('qkLongitude');
  const address = localStorage.getItem('qkLiveLocation')?.trim();

  if (latitude === null || longitude === null || !address) {
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.getElementById('locationSheet')?.classList.add('show');
    document.body.classList.add('locked');
    throw new Error('Delivery location select karo, phir order place karo.');
  }

  return { latitude, longitude, address };
}

async function createOrder() {
  const user = await authReady;
  if (!user) throw new Error('Could not sign in to Firebase.');

  const cart = getCartSummary();
  if (!cart.itemCount) throw new Error('Your cart is empty.');

  const customerLocation = requireCustomerLocation();
  const pickupLatitude = customerLocation.latitude + 0.002;
  const pickupLongitude = customerLocation.longitude + 0.002;

  return addDoc(collection(db, 'orders'), {
    orderNumber: `QK${Date.now().toString().slice(-6)}`,
    customerId: user.uid,
    customerName: 'Guest Customer',
    customerPhone: '',
    status: 'pending',
    assignedRiderId: null,
    pickup: {
      name: cart.pickupName,
      address: `${cart.pickupName} fulfilment point`,
      location: {
        latitude: pickupLatitude,
        longitude: pickupLongitude
      }
    },
    drop: {
      name: 'Customer',
      address: customerLocation.address,
      location: {
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude
      }
    },
    items: cart.items,
    itemCount: cart.itemCount,
    paymentMode: 'Cash on Delivery',
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
    setCheckoutState(checkoutButton, true);

    try {
      const order = await createOrder();
      localStorage.setItem('qkLatestOrderId', order.id);
      checkoutButton.dataset.firebaseCommitted = 'true';
      checkoutButton.click();
    } catch (error) {
      console.error('Order creation failed:', error);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = error?.message || 'Could not place order. Try again.';
        toast.classList.add('show');
        window.setTimeout(() => toast.classList.remove('show'), 3000);
      }
    } finally {
      setCheckoutState(checkoutButton, false);
    }
  }, true);
});
