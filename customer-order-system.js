'use strict';

(() => {
  const REQUEST_KEY = 'qkActiveOrderRequestId';
  const ORDER_SOURCE = 'customer_app';
  const SCHEMA_VERSION = 1;

  function checkoutError(message = '') {
    const element = document.getElementById('checkoutError');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
  }

  function createRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getRequestId() {
    try {
      let value = sessionStorage.getItem(REQUEST_KEY);
      if (!value) {
        value = createRequestId();
        sessionStorage.setItem(REQUEST_KEY, value);
      }
      return value;
    } catch {
      return createRequestId();
    }
  }

  function clearRequestId() {
    try {
      sessionStorage.removeItem(REQUEST_KEY);
    } catch {
      // Storage can be unavailable in private browsing. Order placement still works.
    }
  }

  function releaseCheckoutLock() {
    try {
      sessionStorage.removeItem('qkOrderPlacementLock');
    } catch {
      // Ignore unavailable session storage.
    }
  }

  function createOrderNumber() {
    const date = new Date();
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const suffix = String(Date.now()).slice(-6);
    return `QK${year}${month}${day}${suffix}`;
  }

  function setPlacingState(active) {
    state.placingOrder = active;
    const button = document.getElementById('checkoutBtn');
    if (!button) return;
    button.disabled = active;
    button.textContent = active ? 'Verifying order…' : 'Place order';
  }

  function updateCartFromVerification(adjustments) {
    if (!Array.isArray(adjustments)) return;

    adjustments.forEach((adjustment) => {
      const cartItem = state.cart[adjustment.key];
      if (!cartItem) return;

      if (!adjustment.available || adjustment.quantity <= 0) {
        delete state.cart[adjustment.key];
        return;
      }

      cartItem.quantity = adjustment.quantity;
      cartItem.product.price = adjustment.price;
      cartItem.product.stockQuantity = adjustment.stockQuantity;
    });

    updateBadge();
    renderCart();
  }

  function normalizeCoordinates(value) {
    if (!value || typeof value !== 'object') return null;
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      accuracy: Math.max(0, Number(value.accuracy || 0))
    };
  }

  function requestDeliveryLocation() {
    checkoutError('Select and save a delivery address.');
    toast('Select your delivery location to continue.', true);
    releaseCheckoutLock();

    if (typeof openLocationSheet === 'function') {
      openLocationSheet();
      window.setTimeout(() => {
        document.getElementById('allowLocationBtn')?.focus();
      }, 80);
    }
  }

  async function placeVerifiedOrder() {
    if (state.placingOrder) return;

    checkoutError('');

    const cartItems = Object.values(state.cart);
    const customerName = document.getElementById('customerNameInput')?.value.trim() || '';
    const customerPhone = document.getElementById('customerPhoneInput')?.value.replace(/\D/g, '') || '';
    const deliveryAddress = localStorage.getItem('qkLiveLocation')?.trim() || '';
    const dropLocation = normalizeCoordinates(readCoordinates());

    if (!cartItems.length) {
      checkoutError('Your cart is empty.');
      toast('Cart is empty.', true);
      releaseCheckoutLock();
      return;
    }
    if (!customerName) {
      checkoutError('Enter the receiver name.');
      toast('Enter receiver name.', true);
      releaseCheckoutLock();
      return;
    }
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      checkoutError('Enter a valid 10-digit mobile number.');
      toast('Enter a valid 10-digit phone number.', true);
      releaseCheckoutLock();
      return;
    }
    if (!deliveryAddress) {
      requestDeliveryLocation();
      return;
    }
    if (!state.user || !db) {
      checkoutError('Backend is still connecting. Please try again.');
      toast('Backend is still connecting.', true);
      releaseCheckoutLock();
      return;
    }

    const storeId = cartItems[0].product.storeId;
    if (!storeId || cartItems.some((item) => item.product.storeId !== storeId)) {
      checkoutError('Products from different stores cannot be ordered together.');
      toast('Only one store is allowed per order.', true);
      releaseCheckoutLock();
      return;
    }

    const requestId = getRequestId();
    const orderNumber = createOrderNumber();
    const orderRef = db.collection('orders').doc();
    const storeRef = db.collection('stores').doc(storeId);
    let verifiedCartAdjustments = null;

    setPlacingState(true);

    try {
      await saveCustomerProfile(customerName, customerPhone, deliveryAddress);

      const orderData = await db.runTransaction(async (transaction) => {
        const storeSnapshot = await transaction.get(storeRef);
        if (!storeSnapshot.exists) throw new Error('STORE_UNAVAILABLE');

        const liveStore = storeSnapshot.data();
        if (liveStore.isApproved !== true || liveStore.status !== 'active') {
          throw new Error('STORE_UNAVAILABLE');
        }
        if (liveStore.isOpen === false) throw new Error('STORE_CLOSED');
        if (!liveStore.merchantId) throw new Error('STORE_CONFIGURATION');

        const requestedItems = cartItems.map((item) => ({
          key: item.product.key,
          productId: item.product.id,
          quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
          displayedPrice: Number(item.product.price || 0),
          ref: storeRef.collection('products').doc(item.product.id)
        }));

        const productSnapshots = [];
        for (const requestedItem of requestedItems) {
          productSnapshots.push(await transaction.get(requestedItem.ref));
        }

        const adjustments = [];
        const verifiedItems = [];
        let cartChanged = false;

        productSnapshots.forEach((snapshot, index) => {
          const requested = requestedItems[index];
          if (!snapshot.exists) {
            cartChanged = true;
            adjustments.push({ ...requested, available: false, quantity: 0, price: 0, stockQuantity: 0 });
            return;
          }

          const product = snapshot.data();
          const stockQuantity = Math.max(0, Math.floor(Number(product.stockQuantity || 0)));
          const currentPrice = Number(product.sellingPrice ?? product.price ?? 0);
          const available = product.isActive !== false
            && product.isAvailable !== false
            && stockQuantity > 0
            && Number.isFinite(currentPrice)
            && currentPrice > 0;
          const allowedQuantity = available ? Math.min(requested.quantity, stockQuantity) : 0;

          if (!available || allowedQuantity !== requested.quantity || currentPrice !== requested.displayedPrice) {
            cartChanged = true;
          }

          adjustments.push({
            key: requested.key,
            productId: requested.productId,
            available,
            quantity: allowedQuantity,
            price: currentPrice,
            stockQuantity
          });

          if (!available || allowedQuantity <= 0) return;

          verifiedItems.push({
            productId: requested.productId,
            name: product.name || 'Product',
            unit: product.unit || '',
            brand: product.brand || '',
            quantity: allowedQuantity,
            unitPrice: currentPrice,
            lineTotal: currentPrice * allowedQuantity
          });
        });

        if (cartChanged) {
          verifiedCartAdjustments = adjustments;
          throw new Error('CART_CHANGED');
        }

        if (!verifiedItems.length) throw new Error('EMPTY_VERIFIED_CART');

        const subtotal = verifiedItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const minimumOrder = Math.max(0, Number(liveStore.minimumOrder || 0));
        if (minimumOrder && subtotal < minimumOrder) {
          const error = new Error('MINIMUM_ORDER');
          error.minimumOrder = minimumOrder;
          throw error;
        }

        const deliveryFee = subtotal >= 299 ? 0 : 25;
        const platformFee = 3;
        const totalAmount = subtotal + deliveryFee + platformFee;
        const itemCount = verifiedItems.reduce((sum, item) => sum + item.quantity, 0);
        const now = firebase.firestore.FieldValue.serverTimestamp();

        const payload = {
          schemaVersion: SCHEMA_VERSION,
          orderSource: ORDER_SOURCE,
          clientRequestId: requestId,
          orderNumber,
          customerId: state.user.uid,
          customerName,
          customerPhone,
          merchantId: liveStore.merchantId,
          storeId,
          storeName: liveStore.name || 'MyQK Store',
          items: verifiedItems,
          itemCount,
          subtotal,
          deliveryFee,
          platformFee,
          totalAmount,
          pickup: {
            name: liveStore.name || 'MyQK Store',
            address: storeAddress(liveStore),
            location: normalizeCoordinates(liveStore.location)
          },
          drop: {
            name: customerName,
            address: deliveryAddress,
            location: dropLocation
          },
          status: 'pending_merchant',
          assignedRiderId: null,
          assignedRiderName: null,
          paymentMode: 'Cash on Delivery',
          paymentStatus: 'unpaid',
          riderPayout: Math.max(25, deliveryFee),
          createdAt: now,
          createdAtMs: Date.now(),
          updatedAt: now
        };

        transaction.set(orderRef, payload);
        return payload;
      });

      localStorage.setItem('qkCustomerName', customerName);
      localStorage.setItem('qkCustomerPhone', customerPhone);
      state.cart = {};
      updateBadge();
      renderCart();
      document.getElementById('cartOverlay')?.classList.remove('open');
      clearRequestId();
      releaseCheckoutLock();
      switchTab('orders');
      toast(`Order #${orderData.orderNumber} placed successfully.`);
    } catch (error) {
      console.error('Verified order placement failed:', error);

      if (error.message === 'CART_CHANGED') {
        updateCartFromVerification(verifiedCartAdjustments);
        checkoutError('Price or stock changed. Your cart has been updated; review it and place the order again.');
        toast('Cart updated with live price and stock.', true);
      } else if (error.message === 'STORE_CLOSED') {
        checkoutError('This store is currently closed.');
        toast('Store is currently closed.', true);
      } else if (error.message === 'STORE_UNAVAILABLE' || error.message === 'STORE_CONFIGURATION') {
        checkoutError('This store is currently unavailable.');
        toast('Store is currently unavailable.', true);
      } else if (error.message === 'MINIMUM_ORDER') {
        const amount = Number(error.minimumOrder || 0);
        checkoutError(`Minimum order for this store is ${money(amount)}.`);
        toast(`Minimum order is ${money(amount)}.`, true);
      } else if (error.code === 'permission-denied') {
        checkoutError('Order permission denied. Publish the latest shared Firestore rules.');
        toast('Publish the latest Firestore rules.', true);
      } else if (error.code === 'unavailable' || !navigator.onLine) {
        checkoutError('Internet connection lost. Your cart is safe; try again when online.');
        toast('Internet connection lost.', true);
      } else {
        checkoutError('Order could not be placed. Please try again.');
        toast('Order could not be placed.', true);
      }
    } finally {
      setPlacingState(false);
      releaseCheckoutLock();
    }
  }

  // real-customer-app.js registers its click listener at DOMContentLoaded.
  // Replacing this global function before that event makes the verified flow active.
  placeOrder = placeVerifiedOrder;

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#saveAddressBtn')) return;
    window.setTimeout(() => {
      if (localStorage.getItem('qkLiveLocation')?.trim()) checkoutError('');
    }, 0);
  });
})();
