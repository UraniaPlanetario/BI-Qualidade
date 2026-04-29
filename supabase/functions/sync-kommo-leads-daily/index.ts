// sync-kommo-leads-daily — popula bronze.kommo_leads_raw a partir de
// /api/v4/leads do Kommo. Roda diariamente via cron 'sync-kommo-leads-daily'
// (07:15 BRT). Estende a sync incluindo `company_id` extraído de
// _embedded.companies[0].id (lead → empresa, 1:1 na prática).
//
// Params: ?days=N (default 3) | ?maxPages=N | ?startPage=N

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "bronze" } });

function tsToIso(ts: number | null): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function kommoGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(KOMMO_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), { headers: { Authorization: "Bearer " + KOMMO_TOKEN } });
  if (resp.status === 204) return null;
  if (!resp.ok) throw new Error("Kommo " + resp.status + ": " + (await resp.text()));
  return resp.json();
}

async function fetchUsersMap(): Promise<Record<number, string>> {
  const data = await kommoGet("/api/v4/users");
  const map: Record<number, string> = {};
  for (const u of data._embedded.users) map[u.id] = u.name;
  return map;
}

async function fetchPipelines() {
  const data = await kommoGet("/api/v4/leads/pipelines");
  const pmap: Record<number, string> = {};
  const smap: Record<string, string> = {};
  for (const p of data._embedded.pipelines) {
    pmap[p.id] = p.name;
    for (const s of p._embedded?.statuses ?? []) {
      smap[p.id + "_" + s.id] = s.name;
    }
  }
  return { pmap, smap };
}

function transformLead(lead: any, users: Record<number, string>, pmap: Record<number, string>, smap: Record<string, string>) {
  const cfs = lead.custom_fields_values ?? [];
  const cfDict: Record<string, any> = {};
  for (const f of cfs) {
    const name = f.field_name || String(f.field_id);
    const vals = f.values ?? [];
    cfDict[name] = vals.length === 1 ? vals[0]?.value : vals.map((v: any) => v?.value);
  }
  // Lead → empresa (1:1 na prática). Pegamos só a primeira do array — Kommo
  // tecnicamente permite múltiplas mas operacionalmente é sempre uma só.
  const companyId = lead._embedded?.companies?.[0]?.id ?? null;
  return {
    id: lead.id,
    name: lead.name,
    price: lead.price,
    responsible_user_id: lead.responsible_user_id,
    group_id: lead.group_id,
    status_id: lead.status_id,
    pipeline_id: lead.pipeline_id,
    loss_reason_id: lead.loss_reason_id,
    created_by: lead.created_by,
    updated_by: lead.updated_by,
    created_at: tsToIso(lead.created_at),
    updated_at: tsToIso(lead.updated_at),
    closed_at: tsToIso(lead.closed_at),
    closest_task_at: tsToIso(lead.closest_task_at),
    is_deleted: lead.is_deleted || false,
    pipeline_name: pmap[lead.pipeline_id],
    status_name: smap[lead.pipeline_id + "_" + lead.status_id],
    responsible_user_name: users[lead.responsible_user_id],
    custom_fields: Object.keys(cfDict).length > 0 ? cfDict : null,
    company_id: companyId,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") ?? "3");
    const maxPages = Number(url.searchParams.get("maxPages") ?? "500");
    const startPage = Number(url.searchParams.get("startPage") ?? "1");

    console.log(`=== Sync Kommo Leads -> bronze (days=${days}, maxPages=${maxPages}, startPage=${startPage}) ===`);
    const users = await fetchUsersMap();
    const { pmap, smap } = await fetchPipelines();

    const fromTs = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    let totalUpserted = 0;
    let page = startPage;
    const maxPage = startPage + maxPages - 1;

    while (page <= maxPage) {
      const data = await kommoGet("/api/v4/leads", {
        limit: "250",
        page: String(page),
        "order[updated_at]": "desc",
        "filter[updated_at][from]": String(fromTs),
      });
      if (!data) break;
      const leads = data._embedded?.leads ?? [];
      if (!leads.length) break;

      const records = leads.map((l: any) => transformLead(l, users, pmap, smap));
      const { error } = await supabase.from("kommo_leads_raw").upsert(records, { onConflict: "id" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message, totalUpserted, stoppedAtPage: page }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      totalUpserted += records.length;
      console.log(`Page ${page}: ${leads.length} leads (total: ${totalUpserted})`);

      if (leads.length < 250) break;
      if (page % 6 === 0) await new Promise((r) => setTimeout(r, 1000));
      else await new Promise((r) => setTimeout(r, 150));
      page++;
    }

    return new Response(
      JSON.stringify({ message: "Sync concluido", leads: totalUpserted, lastPage: page, days }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
