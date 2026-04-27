// sync-kommo-task-types — popula bronze.kommo_task_types com a lista de task types
// da conta Kommo. Roda manualmente quando um novo astrônomo entra ou um tipo é criado.
// GET /functions/v1/sync-kommo-task-types

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KOMMO_TOKEN = Deno.env.get('KOMMO_ACCESS_TOKEN')!;
const KOMMO_BASE = Deno.env.get('KOMMO_BASE_URL')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'bronze' } });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

async function kommoGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(KOMMO_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + KOMMO_TOKEN },
  });
  if (!resp.ok) throw new Error('Kommo ' + resp.status + ': ' + (await resp.text()));
  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const data = await kommoGet('/api/v4/account', { with: 'task_types' });
    const types = data?._embedded?.task_types ?? [];

    const records = types.map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? null,
      icon_id: t.icon_id ?? null,
      synced_at: new Date().toISOString(),
    }));

    if (records.length > 0) {
      const { error } = await supabase.from('kommo_task_types').upsert(records, { onConflict: 'id' });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, total: records.length, types: records }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('sync-kommo-task-types:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
