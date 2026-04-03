"""
Sync Kommo CRM quality fields → Supabase (leads_quality table)
Extrai leads com campos da aba Qualidade e faz upsert no Supabase.
"""

import os
import sys
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- Config ---
KOMMO_TOKEN = os.environ['KOMMO_ACCESS_TOKEN']
KOMMO_BASE = os.environ['KOMMO_BASE_URL']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

KOMMO_HEADERS = {'Authorization': f'Bearer {KOMMO_TOKEN}'}
SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

# Mapeamento: Kommo custom field ID → coluna no Supabase
QUALITY_FIELD_MAP = {
    1150697: 'dia_semana_criacao',
    1150801: 'tipo_de_dia',
    1150803: 'faixa_horario_criacao',
    1150805: 'quem_atendeu_primeiro',
    1151533: 'qualidade_abordagem_inicial',
    1151593: 'personalizacao_atendimento',
    1151653: 'clareza_comunicacao',
    1151655: 'conectou_solucao_necessidade',
    1151657: 'explicou_beneficios',
    1151659: 'personalizou_argumentacao',
    1151661: 'houve_desconto',
    1151663: 'desconto_justificado',
    1151665: 'quebrou_preco_sem_necessidade',
    1150807: 'retorno_etapa_funil',
    1150809: 'retorno_resgate',
    1150811: 'tempo_primeira_resposta',
    1150813: 'pediu_data',
    1150815: 'data_sugerida',
    1150819: 'dias_ate_fechar',
    1150821: 'ligacoes_feitas',
    1150823: 'conhecia_urania',
    1151725: 'proximo_passo_definido',
    1150827: 'observacoes_gerais',
    1150829: 'ponto_critico',
    1150831: 'ponto_positivo',
    1151727: 'score_qualidade',
}

# Campos adicionais (contexto, performance, comercial)
EXTRA_FIELD_MAP = {
    847427: 'vendedor_consultor',
    852041: 'sdr',
    848739: 'cidade_estado',
    851177: 'etapa_funil',
    848211: 'tipo_cliente',
    841197: 'produtos',           # multiselect
}

# Campos timestamp (precisam de conversão unix → ISO)
TIMESTAMP_FIELD_MAP = {
    850461: 'data_fechamento',
    841867: 'data_hora_agendamento',
}

# Todos os custom fields que nos interessam
ALL_FIELD_MAP = {**QUALITY_FIELD_MAP, **EXTRA_FIELD_MAP, **TIMESTAMP_FIELD_MAP}
QUALITY_FIELD_IDS = set(QUALITY_FIELD_MAP.keys())


def fetch_kommo_users():
    """Busca mapa de user_id → nome dos usuários do Kommo."""
    resp = requests.get(f'{KOMMO_BASE}/api/v4/users', headers=KOMMO_HEADERS)
    resp.raise_for_status()
    users = resp.json().get('_embedded', {}).get('users', [])
    return {u['id']: u['name'] for u in users}


def fetch_kommo_pipelines():
    """Busca mapa de pipeline_id/status_id → nomes."""
    resp = requests.get(f'{KOMMO_BASE}/api/v4/leads/pipelines', headers=KOMMO_HEADERS)
    resp.raise_for_status()
    pipelines = resp.json().get('_embedded', {}).get('pipelines', [])

    pipeline_map = {}
    status_map = {}
    for p in pipelines:
        pipeline_map[p['id']] = p['name']
        for s in p.get('_embedded', {}).get('statuses', []):
            status_map[(p['id'], s['id'])] = s['name']

    return pipeline_map, status_map


def extract_custom_field_value(field, multiselect=False):
    """Extrai o valor de um custom field do Kommo."""
    values = field.get('values', [])
    if not values:
        return None
    if multiselect:
        return ', '.join(v.get('value', '') for v in values if v.get('value'))
    val = values[0]
    return val.get('value', str(val.get('enum_id', '')))


def fetch_leads_with_quality():
    """Busca leads com campos de qualidade, ordenados por updated_at DESC.

    Para automaticamente após 10 páginas consecutivas sem encontrar novos
    leads de qualidade (evita varrer todas as 150+ páginas).
    """
    all_leads = []
    page = 1
    req_count = 0
    pages_without_quality = 0
    max_empty_pages = 20  # para após 20 páginas sem novos leads de qualidade

    while True:
        resp = requests.get(
            f'{KOMMO_BASE}/api/v4/leads',
            headers=KOMMO_HEADERS,
            params={
                'limit': 250,
                'page': page,
                'order[updated_at]': 'desc',
            },
        )
        req_count += 1

        if resp.status_code == 204:
            break

        resp.raise_for_status()
        leads = resp.json().get('_embedded', {}).get('leads', [])

        if not leads:
            break

        found_in_page = 0
        for lead in leads:
            custom_fields = lead.get('custom_fields_values') or []
            if any(f['field_id'] in QUALITY_FIELD_IDS for f in custom_fields):
                all_leads.append(lead)
                found_in_page += 1

        print(f'  Página {page}: {len(leads)} leads, +{found_in_page} qualidade (total: {len(all_leads)})', flush=True)

        if found_in_page == 0:
            pages_without_quality += 1
        else:
            pages_without_quality = 0

        if pages_without_quality >= max_empty_pages:
            print(f'  → {max_empty_pages} páginas sem novos leads de qualidade, parando busca.', flush=True)
            break

        if len(leads) < 250:
            break

        # Rate limit: 7 req/s → ~143ms entre requests
        if req_count % 6 == 0:
            time.sleep(1)
        else:
            time.sleep(0.15)

        page += 1

    return all_leads


def transform_lead(lead, users, pipeline_map, status_map):
    """Transforma um lead do Kommo em um registro para o Supabase."""
    record = {
        'kommo_lead_id': lead['id'],
        'lead_name': lead.get('name'),
        'lead_price': lead.get('price'),
        'pipeline_name': pipeline_map.get(lead.get('pipeline_id')),
        'status_name': status_map.get(
            (lead.get('pipeline_id'), lead.get('status_id'))
        ),
        'responsible_user': users.get(lead.get('responsible_user_id')),
        'created_at_kommo': datetime.fromtimestamp(
            lead['created_at'], tz=timezone.utc
        ).isoformat() if lead.get('created_at') else None,
        'synced_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }

    # Campo nativo: closed_at
    record['closed_at_kommo'] = datetime.fromtimestamp(
        lead['closed_at'], tz=timezone.utc
    ).isoformat() if lead.get('closed_at') else None

    # Inicializar todos os campos como None
    for col in ALL_FIELD_MAP.values():
        record[col] = None

    # Preencher os que existem no lead
    for field in lead.get('custom_fields_values') or []:
        field_id = field['field_id']
        if field_id in QUALITY_FIELD_MAP:
            record[QUALITY_FIELD_MAP[field_id]] = extract_custom_field_value(field)
        elif field_id in EXTRA_FIELD_MAP:
            is_multi = (field_id == 841197)  # Produtos é multiselect
            record[EXTRA_FIELD_MAP[field_id]] = extract_custom_field_value(field, multiselect=is_multi)
        elif field_id in TIMESTAMP_FIELD_MAP:
            values = field.get('values', [])
            if values and values[0].get('value'):
                ts = values[0]['value']
                try:
                    record[TIMESTAMP_FIELD_MAP[field_id]] = datetime.fromtimestamp(
                        int(ts), tz=timezone.utc
                    ).isoformat()
                except (ValueError, TypeError):
                    record[TIMESTAMP_FIELD_MAP[field_id]] = None

    return record


def upsert_to_supabase(records):
    """Faz upsert dos registros no Supabase via REST API."""
    if not records:
        print('Nenhum registro para enviar.')
        return

    resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/leads_quality?on_conflict=kommo_lead_id',
        headers=SUPABASE_HEADERS,
        json=records,
    )

    if resp.status_code in (200, 201):
        print(f'✓ {len(records)} registros enviados com sucesso!')
    else:
        print(f'✗ Erro ao enviar: {resp.status_code}')
        print(resp.text)
        sys.exit(1)


def main():
    print('=== Sync Kommo Quality → Supabase ===\n')

    print('[1/4] Buscando usuários do Kommo...')
    users = fetch_kommo_users()
    print(f'  {len(users)} usuários encontrados')
    time.sleep(0.2)

    print('[2/4] Buscando pipelines e status...')
    pipeline_map, status_map = fetch_kommo_pipelines()
    print(f'  {len(pipeline_map)} pipelines encontrados')
    time.sleep(0.2)

    print('[3/4] Buscando leads com campos de qualidade...')
    leads = fetch_leads_with_quality()
    print(f'  Total: {len(leads)} leads com dados de qualidade\n')

    if not leads:
        print('Nenhum lead com campos de qualidade encontrados.')
        return

    print('[4/4] Transformando e enviando para Supabase...')
    records = [transform_lead(l, users, pipeline_map, status_map) for l in leads]

    # Upsert em batches de 50
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        upsert_to_supabase(batch)

    print('\n=== Sync concluído! ===')


if __name__ == '__main__':
    main()
