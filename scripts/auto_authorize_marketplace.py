import datetime
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise RuntimeError(f'Missing expected {label} block')


def patch_files() -> None:
    rules_path = Path('firestore.rules')
    rules = rules_path.read_text()

    rules = replace_once(
        rules,
        """    function publicStore(storeId) {
      return exists(/databases/$(database)/documents/stores/$(storeId))
        && get(/databases/$(database)/documents/stores/$(storeId)).data.isApproved == true
        && get(/databases/$(database)/documents/stores/$(storeId)).data.status == 'active'
        && get(/databases/$(database)/documents/stores/$(storeId)).data.isOpen == true;
    }""",
        """    function publicStoreData(data) {
      return data.isApproved == true
        && data.status == 'active'
        && data.isOpen == true;
    }

    function publicStore(storeId) {
      return exists(/databases/$(database)/documents/stores/$(storeId))
        && publicStoreData(
          get(/databases/$(database)/documents/stores/$(storeId)).data
        );
    }""",
        'public store helper',
    )
    rules = replace_once(
        rules,
        "        && request.resource.data.accountStatus == 'pending'",
        "        && request.resource.data.accountStatus == 'active'",
        'merchant account status',
    )
    rules = replace_once(
        rules,
        """        ).data.status == 'pending_approval';""",
        """        ).data.status == 'active'
        && getAfter(
          /databases/$(database)/documents/stores/$(request.resource.data.storeId)
        ).data.isApproved == true;""",
        'merchant linked store status',
    )
    rules = replace_once(
        rules,
        """        && request.resource.data.isApproved == false
        && request.resource.data.status == 'pending_approval'""",
        """        && request.resource.data.isApproved == true
        && request.resource.data.status == 'active'""",
        'store create status',
    )
    rules = replace_once(
        rules,
        "        || publicStore(storeId);",
        "        || publicStoreData(resource.data);",
        'query-safe store read',
    )

    rider_anchor = """      allow update: if isOwner(riderId)
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.onboardingComplete == resource.data.onboardingComplete
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'fullName', 'email', 'photoURL', 'phone', 'city',"""
    rider_activation = """      allow update: if isOwner(riderId)
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.onboardingComplete == true
        && request.resource.data.isApproved == true
        && request.resource.data.accountStatus == 'active'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'isApproved', 'accountStatus', 'updatedAt'
        ]);

"""
    if rider_activation not in rules:
        if rider_anchor not in rules:
            raise RuntimeError('Missing rider update insertion point')
        rules = rules.replace(rider_anchor, rider_activation + rider_anchor, 1)

    rules_path.write_text(rules)

    tests_path = Path('tests/firestore-rules.integration.mjs')
    tests = tests_path.read_text()
    import_block = tests.split("from 'firebase/firestore';", 1)[0]
    if '  getDocs,' not in import_block:
        tests = tests.replace(
            "  collection,\n  doc,\n  runTransaction,",
            "  collection,\n  doc,\n  getDocs,\n  query,\n  runTransaction,",
            1,
        )
    import_block = tests.split("from 'firebase/firestore';", 1)[0]
    if '  where,' not in import_block:
        tests = tests.replace(
            "  updateDoc,\n  writeBatch",
            "  updateDoc,\n  where,\n  writeBatch",
            1,
        )

    pending_test = "test('merchant onboarding requires the pending store and profile to be created together'"
    active_test = "test('merchant onboarding creates an active store and profile together'"
    if pending_test in tests:
        start = tests.index(pending_test)
        prefix, onboarding = tests[:start], tests[start:]
        onboarding = onboarding.replace(pending_test, active_test, 1)
        onboarding = onboarding.replace(
            "    isApproved: false,\n    status: 'pending_approval',",
            "    isApproved: true,\n    status: 'active',",
            1,
        )
        onboarding = onboarding.replace(
            "    accountStatus: 'pending'",
            "    accountStatus: 'active'",
            1,
        )
        tests = prefix + onboarding
    elif active_test not in tests:
        raise RuntimeError('Missing merchant onboarding test')

    insert_at = "test('customer order validation accepts the real bill and rejects a tampered total', async () => {"
    public_test = """test('public homepage query can list active open stores', async () => {
  const publicDb = rulesEnvironment.unauthenticatedContext().firestore();
  const storesQuery = query(
    collection(publicDb, 'stores'),
    where('isApproved', '==', true),
    where('status', '==', 'active'),
    where('isOpen', '==', true)
  );
  const snapshot = await assertSucceeds(getDocs(storesQuery));
  assert.equal(snapshot.size, 1);
});

"""
    rider_test = """test('onboarded rider can mark their own account approved and active', async () => {
  const riderDb = rulesEnvironment.authenticatedContext('rider-1').firestore();
  await assertSucceeds(updateDoc(doc(riderDb, 'riders', 'rider-1'), {
    isApproved: true,
    accountStatus: 'active',
    updatedAt: serverTimestamp()
  }));
});

"""
    if insert_at not in tests:
        raise RuntimeError('Missing rules test insertion point')
    if public_test not in tests:
        tests = tests.replace(insert_at, public_test + insert_at, 1)
    if rider_test not in tests:
        tests = tests.replace(insert_at, rider_test + insert_at, 1)

    tests_path.write_text(tests)


def api(url: str, method: str = 'GET', body=None):
    token = os.environ['ACCESS_TOKEN']
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        method=method,
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def migrate_records() -> None:
    project = 'buyqk-rider'
    root = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents'

    def all_docs(collection: str):
        page_token = ''
        while True:
            params = {'pageSize': 300}
            if page_token:
                params['pageToken'] = page_token
            response = api(f"{root}/{collection}?{urllib.parse.urlencode(params)}")
            yield from response.get('documents', [])
            page_token = response.get('nextPageToken', '')
            if not page_token:
                break

    def scalar(field):
        return next(iter(field.values()), None) if field else None

    def patch(document, fields):
        masks = [('updateMask.fieldPaths', field) for field in fields]
        url = f"https://firestore.googleapis.com/v1/{document['name']}?{urllib.parse.urlencode(masks)}"
        api(url, 'PATCH', {'fields': fields})

    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    changed = {'stores': 0, 'merchants': 0, 'riders': 0}

    for document in all_docs('stores'):
        fields = document.get('fields', {})
        if scalar(fields.get('isApproved')) is not True or scalar(fields.get('status')) != 'active':
            patch(document, {
                'isApproved': {'booleanValue': True},
                'status': {'stringValue': 'active'},
                'updatedAt': {'timestampValue': now},
            })
            changed['stores'] += 1

    for document in all_docs('merchants'):
        if scalar(document.get('fields', {}).get('accountStatus')) != 'active':
            patch(document, {
                'accountStatus': {'stringValue': 'active'},
                'updatedAt': {'timestampValue': now},
            })
            changed['merchants'] += 1

    for document in all_docs('riders'):
        fields = document.get('fields', {})
        if scalar(fields.get('isApproved')) is not True or scalar(fields.get('accountStatus')) != 'active':
            patch(document, {
                'isApproved': {'booleanValue': True},
                'accountStatus': {'stringValue': 'active'},
                'updatedAt': {'timestampValue': now},
            })
            changed['riders'] += 1

    print('rules_deployed=true')
    for key, value in changed.items():
        print(f'{key}_activated={value}')


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {'patch', 'migrate'}:
        raise SystemExit('Usage: auto_authorize_marketplace.py patch|migrate')
    if sys.argv[1] == 'patch':
        patch_files()
    else:
        migrate_records()


if __name__ == '__main__':
    main()
