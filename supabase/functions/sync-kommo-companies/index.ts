// sync-kommo-companies — popula bronze.kommo_companies_raw a partir de
// /api/v4/companies do Kommo, e ao mesmo tempo "backfilla" o vínculo
// lead → empresa via _embedded.leads de cada company (UPDATE em bronze.kommo_leads_raw).
//
// Por que do dois lados? sync-kommo-leads-daily só vê leads atualizados nos
// últimos N dias, então leads antigos não teriam company_id. Iterando empresas
// (que são bem menos numerosas), o backfill cobre o histórico de uma vez.
//
// Params: ?days=N (filtra empresas atualizadas; default 0 = todas)
//         | ?maxPages=N | ?startPage=N
//
// Cron diário: schedule "sync-kommo-companies-daily" 07:30 BRT (entre o leads
// daily 07:15 e o tasks daily 07:45).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseBronze = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "bronze" } });

function tsToIso(ts: number | null | undefined): string | null {
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

function transformCompany(c: any, users: Record<number, string>) {
  const cfs = c.custom_fields_values ?? [];
  const byName: Record<string, any> = {};
  const byId: Record<string, any> = {};
  for (const f of cfs) {
    const vals = f.values ?? [];
    const v = vals.length === 1 ? vals[0]?.value : vals.map((x: any) => x?.value);
    // by-name (último vence em colisão — caso do "Endereço" 586024 vs 852349)
    const name = f.field_name || String(f.field_id);
    byName[name] = v;
    // by-id (sempre único — usar este pra desambiguar)
    if (f.field_id != null) byId[String(f.field_id)] = v;
  }
  return {
    id: c.id,
    name: c.name ?? null,
    responsible_user_id: c.responsible_user_id ?? null,
    responsible_user_name: users[c.responsible_user_id] ?? null,
    group_id: c.group_id ?? null,
    created_by: c.created_by ?? null,
    updated_by: c.updated_by ?? null,
    created_at: tsToIso(c.created_at),
    updated_at: tsToIso(c.updated_at),
    closest_task_at: tsToIso(c.closest_task_at),
    is_deleted: c.is_deleted || false,
    custom_fields: Object.keys(byName).length > 0 ? byName : null,
    custom_fields_by_id: Object.keys(byId).length > 0 ? byId : null,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") ?? "0");
    const maxPages = Number(url.searchParams.get("maxPages") ?? "500");
    const startPage = Number(url.searchParams.get("startPage") ?? "1");

    console.log(`=== Sync Kommo Companies -> bronze (days=${days}, maxPages=${maxPages}, startPage=${startPage}) ===`);
    const users = await fetchUsersMap();

    const fromTs = days > 0 ? Math.floor(Date.now() / 1000) - days * 24 * 60 * 60 : null;
    let totalCompanies = 0;
    let totalLeadLinks = 0;
    let page = startPage;
    const maxPage = startPage + maxPages - 1;

    while (page <= maxPage) {
      const params: Record<string, string> = {
        limit: "250",
        page: String(page),
        "order[updated_at]": "desc",
        "with": "leads",
      };
      if (fromTs !== null) params["filter[updated_at][from]"] = String(fromTs);

      const data = await kommoGet("/api/v4/companies", params);
      if (!data) break;
      const companies = data._embedded?.companies ?? [];
      if (!companies.length) break;

      // 1. Upsert empresas
      const records = companies.map((c: any) => transformCompany(c, users));
      const { error: upErr } = await supabaseBronze
        .from("kommo_companies_raw")
        .upsert(records, { onConflict: "id" });
      if (upErr) {
        console.error(`Upsert empresas page ${page}: ${upErr.message}`);
        return new Response(
          JSON.stringify({ error: upErr.message, totalCompanies, totalLeadLinks, stoppedAtPage: page }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      totalCompanies += records.length;

      // 2. Backfill lead.company_id em massa: pra cada empresa, UPDATE em todos
      //    os leads que ela embeddou. Erro num update específico só loga e segue.
      for (const c of companies) {
        const leadIds: number[] = (c._embedded?.leads ?? [])
          .map((l: any) => Number(l.id))
          .filter((n: number) => Number.isFinite(n));
        if (!leadIds.length) continue;
        // .select("id") sem head:true retorna as rows efetivamente atualizadas.
        // Usar count + head:true em UPDATE retorna null no supabase-js v2.
        const { data: updated, error: linkErr } = await supabaseBronze
          .from("kommo_leads_raw")
          .update({ company_id: c.id })
          .in("id", leadIds)
          .select("id");
        if (linkErr) {
          console.warn(`Link company ${c.id} → leads ${leadIds.length}: ${linkErr.message}`);
          continue;
        }
        totalLeadLinks += updated?.length ?? 0;
      }

      console.log(`Page ${page}: ${companies.length} empresas (total: ${totalCompanies}, links: ${totalLeadLinks})`);

      if (companies.length < 250) break;
      if (page % 6 === 0) await new Promise((r) => setTimeout(r, 1000));
      else await new Promise((r) => setTimeout(r, 150));
      page++;
    }

    return new Response(
      JSON.stringify({
        message: "Sync concluido",
        empresas: totalCompanies,
        lead_links: totalLeadLinks,
        lastPage: page,
        days,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
