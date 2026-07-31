# MyQK Shared Backend Setup

`Myqk-demo`, `Myqk-merchant`, and `Myqk-rider` use the shared Firebase project `buyqk-rider`.

## Firebase Console

1. Open **Authentication → Sign-in method**.
2. Enable **Anonymous** authentication for the customer app.
3. Keep **Google** authentication enabled for merchant and rider apps.
4. Deploy the checked-in Firestore rules and indexes:

   ```bash
   firebase deploy --only firestore
   ```

   The `firestore.rules` and `firestore.indexes.json` files are identical in all
   three repositories, so deploy them from only one repository.

## Merchant approval

New stores stay in `pending_approval`. They cannot approve themselves.

Approve a store from a trusted Admin SDK service or the Firebase Console by
updating both documents:

- `merchants/{merchantUid}`: set `accountStatus` to `active`
- `stores/{storeId}`: set `isApproved` to `true` and `status` to `active`

For a client-side admin panel, give only real admins the Firebase Auth custom
claim `admin: true`. Never put service-account credentials in any web app.

## End-to-end test

1. Open the merchant app and create a store.
2. Approve the pending merchant and store through the trusted admin flow above.
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
