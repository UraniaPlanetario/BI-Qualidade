// backfill-events-by-leads — pega histórico completo de eventos para uma lista
// específica de leads (default: todos os leads em gold.leads_closed_origem
// com data_fechamento no ano informado). Mais eficiente que o backfill por
// janelas de tempo quando o objetivo é só "completar o histórico desses N leads".
//
// Uso:
//   ?closed_year=2026          → fechados em 2026
//   ?after_lead_id=22000000    → cursor pra próxima chamada
//   ?limit=100                 → leads processados nessa chamada
//
// Resposta:
//   { leads_processed, events_inserted, last_lead_id, has_more }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseGold = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "gold" } });
const supabaseBronze = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "bronze" } });

async function kommoGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(KOMMO_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: "Bearer " + KOMMO_TOKEN },
  });
  if (resp.status === 204) return null;
  if (!resp.ok) throw new Error("Kommo " + resp.status + ": " + (await resp.text()));
  return resp.json();
}

function transformEvents(events: any[]) {
  return events.map((e: any) => ({
    id: e.id,
    type: e.type,
    entity_id: e.entity_id,
    entity_type: e.entity_type,
    created_by: e.created_by,
    created_at: new Date(e.created_at * 1000).toISOString(),
    value_before: e.value_before,
    value_after: e.value_after,
    account_id: e.account_id,
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const closedYear = Number(url.searchParams.get("closed_year") ?? "2026");
    const afterLeadId = Number(url.searchParams.get("after_lead_id") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "100");

    // Pega lead_ids fechados no ano, paginando por lead_id pra ser determinístico
    const yearStart = `${closedYear}-01-01`;
    const yearEnd = `${closedYear + 1}-01-01`;
    const { data: leads, error: leadsErr } = await supabaseGold
      .from("leads_closed_origem")
      .select("lead_id")
      .gte("data_fechamento_fmt", yearStart)
      .lt("data_fechamento_fmt", yearEnd)
      .gt("lead_id", afterLeadId)
      .order("lead_id", { ascending: true })
      .limit(limit);

    if (leadsErr) {
      return new Response(JSON.stringify({ error: leadsErr.message }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const leadIds = Array.from(new Set((leads ?? []).map((l: any) => l.lead_id as number)));
    if (leadIds.length === 0) {
      return new Response(JSON.stringify({
        leads_processed: 0, events_inserted: 0,
        last_lead_id: afterLeadId, has_more: false,
      }), { headers: { "Content-Type": "application/json" } });
    }

    let totalEvents = 0;
    let lastLeadId = afterLeadId;
    let leadsProcessed = 0;

    for (const leadId of leadIds) {
      let page = 1;
      while (page <= 20) {
        const data = await kommoGet("/api/v4/events", {
          limit: "250",
          page: String(page),
          "filter[entity]": "lead",
          "filter[entity_id]": String(leadId),
        });
        const events = data?._embedded?.events ?? [];
        if (events.length === 0) break;

        const records = transformEvents(events);
        const { error } = await supabaseBronze
          .from("kommo_events_raw")
          .upsert(records, { onConflict: "id" });
        if (error) {
          return new Response(JSON.stringify({
            error: error.message, last_lead_id: lastLeadId,
            leads_processed: leadsProcessed, events_inserted: totalEvents,
          }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        totalEvents += records.length;

        if (events.length < 250) break;
        await sleep(150);
        page++;
      }
      lastLeadId = leadId;
      leadsProcessed++;
      // Rate limit: 7 req/s do Kommo
      await sleep(150);
    }

    // has_more: indica se a query original retornou exatamente `limit` (provável que tenha mais)
    const hasMore = leadIds.length >= limit;

    return new Response(JSON.stringify({
      leads_processed: leadsProcessed,
      events_inserted: totalEvents,
      last_lead_id: lastLeadId,
      has_more: hasMore,
      closed_year: closedYear,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
