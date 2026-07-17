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

const firebaseConfig = {
  apiKey: 'AIzaSyDbNDNI1a69VDZmLo7Se6LNGPLD6A8_MmE',
  authDomain: 'buyqk-rider.firebaseapp.com',
  projectId: 'buyqk-rider',
  storageBucket: 'buyqk-rider.firebasestorage.app',
  messagingSenderId: '61147606971',
  appId: '1:61147606971:web:d69dd4fcf5c0a0fea01e9e'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let authReadyResolve;
const authReady = new Promise((resolve) => {
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

function readNumber(key, fallback) {
  const value = Number.parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
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

async function createOrder() {
  const user = await authReady;
  if (!user) throw new Error('Could not sign in to Firebase.');

  const cart = getCartSummary();
  if (!cart.itemCount) throw new Error('Your cart is empty.');

  const customerLatitude = readNumber('qkLatitude', 25.615);
  const customerLongitude = readNumber('qkLongitude', 85.11);
  const address = localStorage.getItem('qkLiveLocation') || 'Customer location';

  const pickupLatitude = customerLatitude + 0.002;
  const pickupLongitude = customerLongitude + 0.002;

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
      address,
      location: {
        latitude: customerLatitude,
        longitude: customerLongitude
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
        window.setTimeout(() => toast.classList.remove('show'), 2500);
      }
    } finally {
      setCheckoutState(checkoutButton, false);
    }
  }, true);
});
