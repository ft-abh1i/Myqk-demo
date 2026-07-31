import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const PROJECT_ID = 'demo-buyqk-rules-tests';
const storeLocation = { latitude: 28.6139, longitude: 77.209, accuracy: 10 };
const dropLocation = { latitude: 28.62, longitude: 77.22, accuracy: 8 };
let rulesEnvironment;

function orderData(overrides = {}) {
  return {
    orderNumber: 'QK1000001',
    customerId: 'customer-1',
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    merchantId: 'merchant-1',
    storeId: 'store-1',
    storeName: 'Test Store',
    items: [{
      productId: 'product-1',
      name: 'Test Product',
      brand: 'MyQK',
      unit: '1 pack',
      image: '',
      quantity: 2,
      unitPrice: 50,
      lineTotal: 100
    }],
    itemCount: 2,
    subtotal: 100,
    deliveryFee: 25,
    platformFee: 3,
    totalAmount: 128,
    pickup: {
      name: 'Test Store',
      address: 'Test Store Address',
      location: storeLocation
    },
    drop: {
      name: 'Test Customer',
      address: 'Test Customer Address',
      location: dropLocation
    },
    status: 'pending_merchant',
    assignedRiderId: null,
    assignedRiderName: null,
    paymentMode: 'Cash on Delivery',
    paymentStatus: 'pending',
    riderPayout: 25,
    schemaVersion: 2,
    inventoryReserved: false,
    inventoryRestored: false,
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    createdAtMs: 1_700_000_000_000,
    updatedAt: Timestamp.fromMillis(1_700_000_000_000),
    ...overrides
  };
}

async function seedBaseData() {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'merchants', 'merchant-1'), {
        uid: 'merchant-1',
        storeId: 'store-1',
        onboardingComplete: true,
        accountStatus: 'active'
      }),
      setDoc(doc(database, 'stores', 'store-1'), {
        merchantId: 'merchant-1',
        name: 'Test Store',
        isApproved: true,
        status: 'active',
        isOpen: true,
        minimumOrder: 99,
        deliveryRadiusKm: 8,
        location: storeLocation,
        rating: 0,
        totalRatings: 0
      }),
      setDoc(doc(database, 'stores', 'store-1', 'products', 'product-1'), {
        storeId: 'store-1',
        merchantId: 'merchant-1',
        name: 'Test Product',
        mrp: 60,
        sellingPrice: 50,
        stockQuantity: 10,
        isAvailable: true,
        isActive: true
      }),
      setDoc(doc(database, 'riders', 'rider-1'), {
        uid: 'rider-1',
        onboardingComplete: true,
        status: 'online',
        activeOrderId: null,
        activeOrderStatus: null
      })
    ]);
  });
}

test.before(async () => {
  const [host = '127.0.0.1', port = '8080'] = String(
    process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  ).split(':');
  rulesEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
    }
  });
});

test.beforeEach(async () => {
  await rulesEnvironment.clearFirestore();
  await seedBaseData();
});

test.after(async () => {
  await rulesEnvironment?.cleanup();
});

test('customer order validation accepts the real bill and rejects a tampered total', async () => {
  const customerDb = rulesEnvironment.authenticatedContext('customer-1').firestore();
  await assertSucceeds(setDoc(doc(customerDb, 'orders', 'valid-order'), orderData()));
  await assertFails(setDoc(
    doc(customerDb, 'orders', 'tampered-order'),
    orderData({ orderNumber: 'QK1000002', totalAmount: 1 })
  ));
});

test('customer cancellation writes cancelledBy without changing protected order data', async () => {
  const customerDb = rulesEnvironment.authenticatedContext('customer-1').firestore();
  await assertSucceeds(setDoc(doc(customerDb, 'orders', 'cancel-order'), orderData()));
  await assertSucceeds(updateDoc(doc(customerDb, 'orders', 'cancel-order'), {
    status: 'cancelled',
    cancelledBy: 'customer',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

test('merchant cannot self-approve but can atomically reserve valid stock', async () => {
  const merchantDb = rulesEnvironment.authenticatedContext('merchant-1').firestore();
  await assertFails(updateDoc(doc(merchantDb, 'stores', 'store-1'), {
    isApproved: false,
    status: 'pending_approval',
    updatedAt: serverTimestamp()
  }));

  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), 'orders', 'merchant-order'),
      orderData({ orderNumber: 'QK1000003' })
    );
  });

  await assertSucceeds(runTransaction(merchantDb, async (transaction) => {
    const orderReference = doc(merchantDb, 'orders', 'merchant-order');
    const productReference = doc(merchantDb, 'stores', 'store-1', 'products', 'product-1');
    const [orderSnapshot, productSnapshot] = await Promise.all([
      transaction.get(orderReference),
      transaction.get(productReference)
    ]);
    assert.equal(orderSnapshot.data().status, 'pending_merchant');
    assert.equal(productSnapshot.data().stockQuantity, 10);

    transaction.update(productReference, {
      stockQuantity: 8,
      isAvailable: true,
      updatedAt: serverTimestamp()
    });
    transaction.set(
      doc(collection(merchantDb, 'stores', 'store-1', 'stockMovements'), 'movement-1'),
      {
        productId: 'product-1',
        orderId: 'merchant-order',
        type: 'order_reserved',
        quantityChange: -2,
        previousStock: 10,
        newStock: 8,
        createdBy: 'merchant-1',
        createdAt: serverTimestamp()
      }
    );
    transaction.update(orderReference, {
      status: 'merchant_accepted',
      inventoryReserved: true,
      inventoryRestored: false,
      inventoryReservedAt: serverTimestamp(),
      merchantAcceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }));
});

test('rider acceptance links one active order atomically and blocks a second one', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'orders', 'ready-order-1'), orderData({
        orderNumber: 'QK1000004',
        status: 'ready_for_pickup',
        inventoryReserved: true,
        readyAt: Timestamp.fromMillis(1_700_000_010_000)
      })),
      setDoc(doc(database, 'orders', 'ready-order-2'), orderData({
        orderNumber: 'QK1000005',
        status: 'ready_for_pickup',
        inventoryReserved: true,
        readyAt: Timestamp.fromMillis(1_700_000_020_000)
      }))
    ]);
  });

  const riderDb = rulesEnvironment.authenticatedContext('rider-1').firestore();
  const acceptOrder = (orderId) => runTransaction(riderDb, async (transaction) => {
    const orderReference = doc(riderDb, 'orders', orderId);
    const riderReference = doc(riderDb, 'riders', 'rider-1');
    await Promise.all([
      transaction.get(orderReference),
      transaction.get(riderReference)
    ]);
    transaction.update(orderReference, {
      status: 'accepted',
      assignedRiderId: 'rider-1',
      assignedRiderName: 'Test Rider',
      riderAcceptedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.update(riderReference, {
      activeOrderId: orderId,
      activeOrderStatus: 'accepted',
      updatedAt: serverTimestamp()
    });
  });

  await assertSucceeds(acceptOrder('ready-order-1'));
  await assertFails(acceptOrder('ready-order-2'));
});

test('merchant onboarding requires the pending store and profile to be created together', async () => {
  const merchantDb = rulesEnvironment.authenticatedContext('merchant-2').firestore();
  const batch = writeBatch(merchantDb);
  batch.set(doc(merchantDb, 'stores', 'store-2'), {
    merchantId: 'merchant-2',
    name: 'Second Store',
    isApproved: false,
    status: 'pending_approval',
    isOpen: true,
    minimumOrder: 99,
    deliveryRadiusKm: 8,
    location: storeLocation,
    rating: 0,
    totalRatings: 0
  });
  batch.set(doc(merchantDb, 'merchants', 'merchant-2'), {
    uid: 'merchant-2',
    storeId: 'store-2',
    onboardingComplete: true,
    accountStatus: 'pending'
  });
  await assertSucceeds(batch.commit());
});
