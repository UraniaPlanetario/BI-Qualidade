"""
Sync Kommo tasks → bronze.kommo_tasks
"""
import os, sys, time, requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

KOMMO_TOKEN = os.environ['KOMMO_ACCESS_TOKEN']
KOMMO_BASE = os.environ['KOMMO_BASE_URL']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

KOMMO_HEADERS = {'Authorization': f'Bearer {KOMMO_TOKEN}'}
SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json', 'Content-Profile': 'bronze',
    'Prefer': 'resolution=merge-duplicates',
}


def ts_to_iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None


def fetch_users():
    r = requests.get(f'{KOMMO_BASE}/api/v4/users', headers=KOMMO_HEADERS)
    r.raise_for_status()
    return {u['id']: u['name'] for u in r.json()['_embedded']['users']}


def main():
    print('=== Sync Kommo Tasks → bronze ===\n')
    users = fetch_users()

    all_tasks = []
    page = 1
    while True:
        r = requests.get(f'{KOMMO_BASE}/api/v4/tasks', headers=KOMMO_HEADERS, params={
            'limit': 250, 'page': page,
        })
        if r.status_code == 204:
            break
        r.raise_for_status()
        tasks = r.json().get('_embedded', {}).get('tasks', [])
        if not tasks:
            break
        all_tasks.extend(tasks)
        print(f'  Pagina {page}: {len(tasks)} tasks (total: {len(all_tasks)})', flush=True)
        if len(tasks) < 250:
            break
        if page % 6 == 0:
            time.sleep(1)
        else:
            time.sleep(0.15)
        page += 1

    print(f'  Total: {len(all_tasks)} tasks\n')

    records = []
    for t in all_tasks:
        records.append({
            'id': t['id'],
            'text': t.get('text'),
            'task_type_id': t.get('task_type_id'),
            'entity_id': t.get('entity_id'),
            'entity_type': t.get('entity_type'),
            'responsible_user_id': t.get('responsible_user_id'),
            'responsible_user_name': users.get(t.get('responsible_user_id')),
            'is_completed': t.get('is_completed', False),
            'complete_till': ts_to_iso(t.get('complete_till')),
            'duration': t.get('duration'),
            'created_by': t.get('created_by'),
            'created_at': ts_to_iso(t.get('created_at')),
            'updated_at': ts_to_iso(t.get('updated_at')),
            'result': t.get('result'),
            'synced_at': datetime.now(timezone.utc).isoformat(),
        })

    # Dedup
    seen = {}
    for r in records:
        seen[r['id']] = r
    records = list(seen.values())

    # Upsert
    batch_size = 500
    upserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/kommo_tasks?on_conflict=id',
            headers=SUPABASE_HEADERS, json=batch,
        )
        if resp.status_code in (200, 201):
            upserted += len(batch)
        else:
            print(f'  Erro: {resp.status_code} {resp.text[:200]}')
            sys.exit(1)

    print(f'=== Concluido: {upserted} tasks sincronizadas ===')


if __name__ == '__main__':
    main()
