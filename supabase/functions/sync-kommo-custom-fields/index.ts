import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "bronze" } });

async function kommoGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(KOMMO_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), { headers: { Authorization: "Bearer " + KOMMO_TOKEN } });
  if (resp.status === 204) return null;
  if (!resp.ok) throw new Error("Kommo " + resp.status + ": " + (await resp.text()));
  return resp.json();
}

async function fetchCustomFields(entity: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const data = await kommoGet(`/api/v4/${entity}/custom_fields`, {
      limit: "250",
      page: String(page),
    });
    if (!data) break;
    const fields = data._embedded?.custom_fields ?? [];
    if (!fields.length) break;
    all.push(...fields);
    if (fields.length < 250) break;
    await new Promise((r) => setTimeout(r, 150));
    page++;
  }
  return all;
}

function transform(field: any, entity_type: string) {
  return {
    id: field.id,
    name: field.name ?? null,
    type: field.type ?? null,
    entity_type,
    code: field.code ?? null,
    is_deletable: field.is_deletable ?? null,
    is_computed: field.is_computed ?? null,
    sort: field.sort ?? null,
    group_id: field.group_id != null ? String(field.group_id) : null,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (_req) => {
  try {
    console.log("=== Sync Kommo Custom Fields -> bronze ===");

    const entities = ["leads", "contacts", "companies"];
    let totalUpserted = 0;

    for (const entity of entities) {
      const fields = await fetchCustomFields(entity);
      console.log(`${entity}: ${fields.length} fields`);
      if (!fields.length) continue;

      const records = fields.map((f) => transform(f, entity));
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500);
        const { error } = await supabase
          .from("kommo_custom_fields")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          console.error(`Batch ${i} (${entity}):`, error.message);
          return new Response(JSON.stringify({ error: error.message, totalUpserted }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        totalUpserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ message: "Sync concluido", fields: totalUpserted }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
