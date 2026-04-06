import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeamento: Kommo custom field ID → coluna no Supabase
const QUALITY_FIELD_MAP: Record<number, string> = {
  1150697: "dia_semana_criacao",
  1150801: "tipo_de_dia",
  1150803: "faixa_horario_criacao",
  1150805: "quem_atendeu_primeiro",
  1151533: "qualidade_abordagem_inicial",
  1151593: "personalizacao_atendimento",
  1151653: "clareza_comunicacao",
  1151655: "conectou_solucao_necessidade",
  1151657: "explicou_beneficios",
  1151659: "personalizou_argumentacao",
  1151661: "houve_desconto",
  1151663: "desconto_justificado",
  1151665: "quebrou_preco_sem_necessidade",
  1150807: "retorno_etapa_funil",
  1150809: "retorno_resgate",
  1150811: "tempo_primeira_resposta",
  1150813: "pediu_data",
  1150815: "data_sugerida",
  1150819: "dias_ate_fechar",
  1150821: "ligacoes_feitas",
  1150823: "conhecia_urania",
  1151725: "proximo_passo_definido",
  1150827: "observacoes_gerais",
  1150829: "ponto_critico",
  1150831: "ponto_positivo",
  1151727: "score_qualidade",
};

const EXTRA_FIELD_MAP: Record<number, string> = {
  847427: "vendedor_consultor",
  852041: "sdr",
  848739: "cidade_estado",
  851177: "etapa_funil",
  848211: "tipo_cliente",
  841197: "produtos",
};

const TIMESTAMP_FIELD_MAP: Record<number, string> = {
  850461: "data_fechamento",
  841867: "data_hora_agendamento",
};

const QUALITY_FIELD_IDS = new Set(Object.keys(QUALITY_FIELD_MAP).map(Number));
const ALL_COLUMNS = [
  ...Object.values(QUALITY_FIELD_MAP),
  ...Object.values(EXTRA_FIELD_MAP),
  ...Object.values(TIMESTAMP_FIELD_MAP),
];

async function kommoGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${KOMMO_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
  });
  if (resp.status === 204) return null;
  if (!resp.ok) throw new Error(`Kommo ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function fetchUsers(): Promise<Record<number, string>> {
  const data = await kommoGet("/api/v4/users");
  const users: Record<number, string> = {};
  for (const u of data._embedded.users) users[u.id] = u.name;
  return users;
}

async function fetchPipelines() {
  const data = await kommoGet("/api/v4/leads/pipelines");
  const pipelineMap: Record<number, string> = {};
  const statusMap: Record<string, string> = {};
  for (const p of data._embedded.pipelines) {
    pipelineMap[p.id] = p.name;
    for (const s of p._embedded?.statuses ?? []) {
      statusMap[`${p.id}_${s.id}`] = s.name;
    }
  }
  return { pipelineMap, statusMap };
}

function extractValue(field: any, multiselect = false): string | null {
  const values = field.values ?? [];
  if (!values.length) return null;
  if (multiselect) return values.map((v: any) => v.value ?? "").filter(Boolean).join(", ");
  return values[0].value ?? String(values[0].enum_id ?? "");
}

function transformLead(
  lead: any,
  users: Record<number, string>,
  pipelineMap: Record<number, string>,
  statusMap: Record<string, string>,
) {
  const record: Record<string, any> = {
    kommo_lead_id: lead.id,
    lead_name: lead.name,
    lead_price: lead.price,
    pipeline_name: pipelineMap[lead.pipeline_id],
    status_name: statusMap[`${lead.pipeline_id}_${lead.status_id}`],
    responsible_user: users[lead.responsible_user_id],
    created_at_kommo: lead.created_at
      ? new Date(lead.created_at * 1000).toISOString()
      : null,
    closed_at_kommo: lead.closed_at
      ? new Date(lead.closed_at * 1000).toISOString()
      : null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Inicializar todas as colunas como null
  for (const col of ALL_COLUMNS) record[col] = null;

  for (const field of lead.custom_fields_values ?? []) {
    const fid = field.field_id;
    if (fid in QUALITY_FIELD_MAP) {
      record[QUALITY_FIELD_MAP[fid]] = extractValue(field);
    } else if (fid in EXTRA_FIELD_MAP) {
      record[EXTRA_FIELD_MAP[fid]] = extractValue(field, fid === 841197);
    } else if (fid in TIMESTAMP_FIELD_MAP) {
      const val = field.values?.[0]?.value;
      try {
        record[TIMESTAMP_FIELD_MAP[fid]] = val
          ? new Date(Number(val) * 1000).toISOString()
          : null;
      } catch {
        record[TIMESTAMP_FIELD_MAP[fid]] = null;
      }
    }
  }

  return record;
}

Deno.serve(async (req) => {
  try {
    console.log("=== Sync Kommo Quality → Supabase ===");

    const [users, { pipelineMap, statusMap }] = await Promise.all([
      fetchUsers(),
      fetchPipelines(),
    ]);
    console.log(`Users: ${Object.keys(users).length}, Pipelines: ${Object.keys(pipelineMap).length}`);

    // Buscar leads com campos de qualidade
    const allLeads: any[] = [];
    let page = 1;
    let emptyPages = 0;
    const maxEmptyPages = 20;

    while (true) {
      const data = await kommoGet("/api/v4/leads", {
        limit: "250",
        page: String(page),
        "order[updated_at]": "desc",
      });

      if (!data) break;
      const leads = data._embedded?.leads ?? [];
      if (!leads.length) break;

      let found = 0;
      for (const lead of leads) {
        const cfs = lead.custom_fields_values ?? [];
        if (cfs.some((f: any) => QUALITY_FIELD_IDS.has(f.field_id))) {
          allLeads.push(lead);
          found++;
        }
      }

      console.log(`Page ${page}: ${leads.length} leads, +${found} quality (total: ${allLeads.length})`);

      emptyPages = found === 0 ? emptyPages + 1 : 0;
      if (emptyPages >= maxEmptyPages || leads.length < 250) break;

      // Rate limit: 7 req/s
      if (page % 6 === 0) await new Promise((r) => setTimeout(r, 1000));
      else await new Promise((r) => setTimeout(r, 150));

      page++;
    }

    console.log(`Total: ${allLeads.length} leads com qualidade`);

    if (allLeads.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum lead com qualidade encontrado", count: 0 }));
    }

    // Transformar e upsert
    const records = allLeads.map((l) => transformLead(l, users, pipelineMap, statusMap));

    // Upsert em batches de 50
    let upserted = 0;
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await supabase
        .from("leads_quality")
        .upsert(batch, { onConflict: "kommo_lead_id" });

      if (error) {
        console.error(`Erro batch ${i}: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      upserted += batch.length;
    }

    console.log(`=== Sync concluído: ${upserted} registros ===`);
    return new Response(
      JSON.stringify({ message: "Sync concluído", count: upserted }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
