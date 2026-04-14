"""
Sync Kommo events (todas as atividades) → Supabase kommo_events_raw
Backfill histórico + atualização incremental.

Uso:
    python scripts/sync_kommo_events.py              # sync incremental (últimos 2 dias)
    python scripts/sync_kommo_events.py --backfill   # backfill desde 01/01/2026
"""

import os
import sys
import time
import argparse
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

KOMMO_TOKEN = os.environ['KOMMO_ACCESS_TOKEN']
KOMMO_BASE = os.environ['KOMMO_BASE_URL']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

KOMMO_HEADERS = {'Authorization': f'Bearer {KOMMO_TOKEN}'}
SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Content-Profile': 'bronze',
    'Prefer': 'resolution=merge-duplicates',
}


def sync_users():
    """Sincroniza usuários do Kommo → kommo_users."""
    print('[Users] Buscando usuários do Kommo...')
    resp = requests.get(f'{KOMMO_BASE}/api/v4/users', headers=KOMMO_HEADERS)
    resp.raise_for_status()
    users = resp.json().get('_embedded', {}).get('users', [])

    records = [
        {
            'id': u['id'],
            'name': u.get('name'),
            'email': u.get('email'),
            'role': u.get('rights', {}).get('is_admin') and 'admin' or 'user',
            'synced_at': datetime.now(timezone.utc).isoformat(),
        }
        for u in users
    ]

    r = requests.post(
        f'{SUPABASE_URL}/rest/v1/kommo_users?on_conflict=id',
        headers=SUPABASE_HEADERS,
        json=records,
    )
    if r.status_code in (200, 201):
        print(f'[Users] ✓ {len(records)} usuários sincronizados')
    else:
        print(f'[Users] ✗ Erro {r.status_code}: {r.text[:200]}')
        sys.exit(1)


def fetch_events_range(start_ts: int, end_ts: int):
    """Busca todos os eventos entre start_ts e end_ts (timestamps unix)."""
    all_events = []
    page = 1

    while True:
        resp = requests.get(
            f'{KOMMO_BASE}/api/v4/events',
            headers=KOMMO_HEADERS,
            params={
                'limit': 250,
                'page': page,
                'filter[created_at][from]': start_ts,
                'filter[created_at][to]': end_ts,
            },
        )

        if resp.status_code == 204:
            break
        resp.raise_for_status()

        events = resp.json().get('_embedded', {}).get('events', [])
        if not events:
            break

        all_events.extend(events)
        print(f'  Page {page}: {len(events)} events (total: {len(all_events)})', flush=True)

        if len(events) < 250:
            break

        # Rate limit: 7 req/s
        if page % 6 == 0:
            time.sleep(1)
        else:
            time.sleep(0.15)
        page += 1

    return all_events


def upsert_events(events):
    """Upsert eventos em kommo_events_raw."""
    if not events:
        return 0

    # Dedup por id (API pode retornar duplicatas em paginação)
    seen = {}
    for e in events:
        seen[e['id']] = {
            'id': e['id'],
            'type': e['type'],
            'entity_id': e.get('entity_id'),
            'entity_type': e.get('entity_type'),
            'created_by': e.get('created_by'),
            'created_at': datetime.fromtimestamp(e['created_at'], tz=timezone.utc).isoformat(),
            'value_before': e.get('value_before'),
            'value_after': e.get('value_after'),
            'account_id': e.get('account_id'),
        }
    records = list(seen.values())

    # Upsert em batches de 500
    upserted = 0
    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        r = requests.post(
            f'{SUPABASE_URL}/rest/v1/kommo_events_raw?on_conflict=id',
            headers=SUPABASE_HEADERS,
            json=batch,
        )
        if r.status_code in (200, 201):
            upserted += len(batch)
        else:
            print(f'  ✗ Erro batch {i}: {r.status_code} {r.text[:200]}')
            sys.exit(1)
    return upserted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backfill', action='store_true', help='Backfill desde 01/01/2026')
    parser.add_argument('--days', type=int, default=2, help='Dias para trás no modo incremental')
    args = parser.parse_args()

    sync_users()

    now = datetime.now(timezone.utc)
    if args.backfill:
        start_date = datetime(2026, 1, 1, tzinfo=timezone.utc)
        print(f'\n[Backfill] Desde {start_date.date()} até {now.date()}')
    else:
        start_date = now - timedelta(days=args.days)
        print(f'\n[Incremental] Últimos {args.days} dias (desde {start_date.date()})')

    # Processar por janelas de 7 dias (a API pode ter limite de eventos por query)
    total_upserted = 0
    window_days = 7
    current = start_date

    while current < now:
        window_end = min(current + timedelta(days=window_days), now)
        print(f'\n[Janela] {current.date()} → {window_end.date()}')

        events = fetch_events_range(
            int(current.timestamp()),
            int(window_end.timestamp()),
        )

        if events:
            upserted = upsert_events(events)
            total_upserted += upserted
            print(f'  ✓ {upserted} eventos salvos (acumulado: {total_upserted})')

        current = window_end

    print(f'\n=== Sync concluído: {total_upserted} eventos ===')


if __name__ == '__main__':
    main()
