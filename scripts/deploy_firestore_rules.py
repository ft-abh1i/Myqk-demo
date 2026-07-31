import json
import os
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ID = 'buyqk-rider'
TOKEN = os.environ['ACCESS_TOKEN']


def api(url: str, method: str, body: dict):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors='replace')
        raise RuntimeError(f'{method} {url} failed with HTTP {error.code}: {detail}') from error


ruleset = api(
    f'https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/rulesets',
    'POST',
    {
        'source': {
            'files': [{
                'name': 'firestore.rules',
                'content': Path('firestore.rules').read_text(),
            }],
        },
    },
)

api(
    f'https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/releases/cloud.firestore?updateMask=rulesetName',
    'PATCH',
    {
        'name': f'projects/{PROJECT_ID}/releases/cloud.firestore',
        'rulesetName': ruleset['name'],
    },
)

print(f"rules_deployed=true ruleset={ruleset['name']}")
