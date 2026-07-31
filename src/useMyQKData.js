import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import {
  normalizeCategory,
  placeholderImage,
  readCoordinates,
  storeAddress,
  timestampValue,
} from './appData.js';

export default function useMyQKData(onNotice) {
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [customerProfile, setCustomerProfile] = useState(null);

  useEffect(() => {
    let active = true;
    let unsubscribeOrders = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      if (!nextUser) {
        setUser(null);
        setBackendReady(false);
        setOrders([]);
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Anonymous sign-in failed:', error);
          onNotice('Enable Anonymous sign-in in Firebase Authentication.', true);
        }
        return;
      }

      setUser(nextUser);
      setBackendReady(true);

      try {
        const snapshot = await getDoc(doc(db, 'customers', nextUser.uid));
        if (active && snapshot.exists()) setCustomerProfile(snapshot.data());
      } catch (error) {
        console.warn('Customer profile could not load:', error);
      }

      unsubscribeOrders?.();
      const ordersQuery = query(
        collection(db, 'orders'),
        where('customerId', '==', nextUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        const nextOrders = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort((a, b) => (timestampValue(b.createdAt) || b.createdAtMs || 0) - (timestampValue(a.createdAt) || a.createdAtMs || 0));
        if (active) setOrders(nextOrders);
      }, (error) => {
        console.error('Customer orders listener failed:', error);
        onNotice('Orders could not load.', true);
      });
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeOrders?.();
    };
  }, [onNotice]);

  useEffect(() => {
    if (!backendReady || !user) {
      setCatalogLoading(true);
      return undefined;
    }

    let active = true;
    let unsubscribeStores = null;
    let retryTimer = null;
    let catalogErrorShown = false;
    const productListeners = new Map();
    const productGroups = new Map();

    const publishProducts = () => {
      if (!active) return;
      setProducts([...productGroups.values()].flat());
    };

    const syncProductListeners = (activeStores) => {
      const activeIds = new Set(activeStores.map((store) => store.id));

      productListeners.forEach((unsubscribe, storeId) => {
        if (activeIds.has(storeId)) return;
        unsubscribe();
        productListeners.delete(storeId);
        productGroups.delete(storeId);
      });

      activeStores.forEach((store) => {
        if (productListeners.has(store.id)) return;
        const productsRef = collection(db, 'stores', store.id, 'products');
        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
          const nextProducts = snapshot.docs.flatMap((entry) => {
            const data = entry.data();
            const stockQuantity = Number(data.stockQuantity || 0);
            if (data.isActive === false || data.isAvailable === false || stockQuantity <= 0) return [];
            return [{
              id: entry.id,
              key: `${store.id}__${entry.id}`,
              storeId: store.id,
              merchantId: data.merchantId || store.merchantId,
              name: data.name || 'Product',
              category: data.category || '',
              brand: data.brand || '',
              unit: data.unit || '',
              price: Number(data.sellingPrice ?? data.price ?? 0),
              mrp: Number(data.mrp || 0),
              stockQuantity,
              image: data.imageUrl || data.image || placeholderImage(data.name || 'Product', 'product'),
            }];
          });
          productGroups.set(store.id, nextProducts);
          publishProducts();
        }, (error) => {
          console.error(`Products listener failed for ${store.id}:`, error);
        });
        productListeners.set(store.id, unsubscribe);
      });

      publishProducts();
    };

    const storesQuery = query(
      collection(db, 'stores'),
      where('isApproved', '==', true),
      where('status', '==', 'active'),
      where('isOpen', '==', true),
    );

    const subscribeToStores = () => {
      if (!active) return;
      unsubscribeStores?.();
      unsubscribeStores = onSnapshot(storesQuery, (snapshot) => {
        const nextStores = snapshot.docs.flatMap((entry) => {
          const data = entry.data();
          if (data.status !== 'active' || data.isOpen === false) return [];
          return [{
            id: entry.id,
            merchantId: data.merchantId,
            name: data.name || 'MyQK Store',
            category: normalizeCategory(data.category),
            rawCategory: data.category || '',
            description: data.description || '',
            image: data.imageUrl || data.logoUrl || placeholderImage(data.name || 'Store', 'store'),
            time: `${data.openingTime || 'Open'}–${data.closingTime || 'Close'}`,
            address: data.address || {},
            location: data.location || null,
            minimumOrder: Number(data.minimumOrder || 0),
            deliveryRadiusKm: Number(data.deliveryRadiusKm || 0),
            rating: Number(data.rating || 0),
          }];
        });
        if (!active) return;
        catalogErrorShown = false;
        window.clearTimeout(retryTimer);
        setStores(nextStores);
        setCatalogLoading(false);
        syncProductListeners(nextStores);
      }, (error) => {
        console.error('Store catalog listener failed:', error);
        if (!active) return;
        setCatalogLoading(true);
        if (!catalogErrorShown) {
          const errorCode = String(error?.code || '');
          onNotice(
            errorCode.includes('failed-precondition')
              ? 'Store catalog index is preparing. Retrying automatically…'
              : 'Reconnecting to nearby stores…',
            true,
          );
          catalogErrorShown = true;
        }
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(subscribeToStores, 2500);
      });
    };

    subscribeToStores();

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      unsubscribeStores?.();
      productListeners.forEach((unsubscribe) => unsubscribe());
    };
  }, [backendReady, onNotice, user]);

  const saveCustomerProfile = useCallback(async ({ name, phone, address, email }) => {
    if (!user) throw new Error('Backend is still connecting. Try again.');
    const payload = {
      uid: user.uid,
      fullName: String(name || '').trim(),
      phone: String(phone || '').replace(/\D/g, ''),
      address: String(address || '').trim(),
      location: readCoordinates(),
      updatedAt: serverTimestamp(),
    };
    if (email !== undefined) payload.email = String(email || '').trim();
    await setDoc(doc(db, 'customers', user.uid), payload, { merge: true });
    setCustomerProfile((current) => ({ ...(current || {}), ...payload }));
  }, [user]);

  const createOrder = useCallback(async ({ cartItems, store, name, phone, address }) => {
    if (!user || !backendReady) throw new Error('Backend is still connecting. Try again.');
    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliveryFee = subtotal >= 299 ? 0 : 25;
    const platformFee = 3;
    const totalAmount = subtotal + deliveryFee + platformFee;
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const orderNumber = `QK${String(Date.now()).slice(-7)}`;

    await saveCustomerProfile({ name, phone, address });
    await addDoc(collection(db, 'orders'), {
      orderNumber,
      customerId: user.uid,
      customerName: name,
      customerPhone: phone,
      merchantId: store.merchantId,
      storeId: store.id,
      storeName: store.name,
      items: cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        brand: product.brand || '',
        unit: product.unit,
        image: product.image || '',
        quantity,
        unitPrice: product.price,
        lineTotal: product.price * quantity,
      })),
      itemCount,
      subtotal,
      deliveryFee,
      platformFee,
      totalAmount,
      pickup: { name: store.name, address: storeAddress(store), location: store.location || null },
      drop: { name, address, location: readCoordinates() },
      status: 'pending_merchant',
      assignedRiderId: null,
      assignedRiderName: null,
      paymentMode: 'Cash on Delivery',
      paymentStatus: 'pending',
      riderPayout: Math.max(25, deliveryFee),
      schemaVersion: 2,
      inventoryReserved: false,
      inventoryRestored: false,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });

    return orderNumber;
  }, [backendReady, saveCustomerProfile, user]);

  const cancelOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'cancelled',
      cancelledBy: 'customer',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const resetCustomerSession = useCallback(async () => {
    await signOut(auth);
  }, []);

  return {
    user,
    stores,
    products,
    orders,
    catalogLoading,
    backendReady,
    customerProfile,
    saveCustomerProfile,
    createOrder,
    cancelOrder,
    resetCustomerSession,
  };
}
