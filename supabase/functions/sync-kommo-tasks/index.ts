import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KOMMO_TOKEN = Deno.env.get("KOMMO_ACCESS_TOKEN")!;
const KOMMO_BASE = Deno.env.get("KOMMO_BASE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "bronze" } });

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

function transformTask(task: any, users: Record<number, string>) {
  return {
    id: task.id,
    text: task.text ?? null,
    task_type_id: task.task_type_id ?? null,
    entity_id: task.entity_id ?? null,
    entity_type: task.entity_type ?? null,
    responsible_user_id: task.responsible_user_id ?? null,
    responsible_user_name: users[task.responsible_user_id] ?? null,
    is_completed: task.is_completed ?? false,
    complete_till: tsToIso(task.complete_till),
    duration: task.duration ?? null,
    created_by: task.created_by ?? null,
    created_at: tsToIso(task.created_at),
    updated_at: tsToIso(task.updated_at),
    result: task.result ?? null,
    custom_fields: null,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const onlyOpen = url.searchParams.get("onlyOpen") !== "false";
    const windowDays = Number(url.searchParams.get("days") ?? "0");
    const maxPages = Number(url.searchParams.get("maxPages") ?? "200");
    const startPage = Number(url.searchParams.get("startPage") ?? "1");

    console.log(
      "=== Sync Kommo Tasks (onlyOpen=" + onlyOpen + ", days=" + windowDays +
      ", maxPages=" + maxPages + ", startPage=" + startPage + ") ===",
    );
    const users = await fetchUsersMap();

    let totalUpserted = 0;
    let page = startPage;
    const fromTs =
      windowDays > 0 ? Math.floor(Date.now() / 1000) - windowDays * 24 * 60 * 60 : null;
    const maxPage = startPage + maxPages - 1;

    while (page <= maxPage) {
      // Nota: o Kommo IGNORA `order[updated_at]=desc` em /api/v4/tasks e sempre
      // retorna em ordem asc (mais antigas primeiro). Por isso não passamos `order`.
      // Para sincronizar atualizações recentes, sempre passe ?days=N (recomendado 7-30).
      const params: Record<string, string> = {
        limit: "250",
        page: String(page),
      };
      if (fromTs !== null) params["filter[updated_at][from]"] = String(fromTs);
      if (onlyOpen) params["filter[is_completed]"] = "0";

      const data = await kommoGet("/api/v4/tasks", params);
      if (!data) break;
      const tasks = data._embedded?.tasks ?? [];
      if (!tasks.length) break;

      const records = tasks.map((t: any) => transformTask(t, users));
      const { error } = await supabase.from("kommo_tasks").upsert(records, { onConflict: "id" });
      if (error) {
        console.error("Upsert error page " + page + ": " + error.message);
        return new Response(
          JSON.stringify({ error: error.message, totalUpserted, stoppedAtPage: page }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      totalUpserted += records.length;
      console.log("Page " + page + ": " + tasks.length + " tasks (total: " + totalUpserted + ")");

      if (tasks.length < 250) break;
      if (page % 6 === 0) await new Promise((r) => setTimeout(r, 1000));
      else await new Promise((r) => setTimeout(r, 150));
      page++;
    }

    return new Response(
      JSON.stringify({ message: "Sync concluido", tasks: totalUpserted, lastPage: page, onlyOpen }),
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
