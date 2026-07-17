# MyQK Shared Backend Setup

`Myqk-demo`, `Myqk-merchant`, and `Myqk-rider` use the shared Firebase project `buyqk-rider`.

## Firebase Console

1. Open **Authentication → Sign-in method**.
2. Enable **Anonymous** authentication for the customer app.
3. Keep **Google** authentication enabled for merchant and rider apps.
4. Open **Firestore Database → Rules**.
5. Copy and publish `firestore.rules` from the `Myqk-merchant` repository.

## End-to-end test

1. Open the merchant app and create a store.
2. Log out and sign in again once so the existing MVP auto-approval script activates the merchant and store.
3. Add at least one product with stock greater than zero.
4. Open or refresh `Myqk-demo`; the active store and product should appear automatically.
5. Add a product, enter customer details and address, then place the order.
6. In the merchant app, move the order through:
   - `pending_merchant`
   - `merchant_accepted`
   - `preparing`
   - `ready_for_pickup`
7. In the rider app, go online, accept the order, and move it through:
   - `accepted`
   - `arrived_pickup`
   - `picked_up`
   - `completed`
8. The customer Orders and Track tabs update from the same Firestore order document in real time.

## Customer data paths

```text
customers/{anonymousAuthUid}
orders/{orderId}
stores/{storeId}
stores/{storeId}/products/{productId}
```
