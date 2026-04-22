/**
 * sync-from-hub — BI Urânia
 * ─────────────────────────────────────────────────────────────────────────────
 * Lê dados identitários do Supabase do Hub (poxolucfvuutvcfpjznt) e replica
 * no BI (wkunbifgxntzbufjkize). Sync one-way, idempotente.
 *
 * Replica:
 *   - public.users         (só campos identitários — preserva auth_user_id,
 *                           is_global_admin, kommo_user_id locais)
 *   - public.departments   (catálogo completo)
 *   - public.user_departments (truncate + reinsert)
 *   - public.platforms     (catálogo, exceto 'bi' que é local)
 *
 * Não replica:
 *   - user_platform_access (é local do BI)
 *   - route_access_*       (local do BI)
 *   - system_logs, tickets, notifications, etc.
 *
 * Env vars:
 *   HUB_SUPABASE_URL            — https://poxolucfvuutvcfpjznt.supabase.co
 *   HUB_SUPABASE_SERVICE_ROLE_KEY — service_role key do Hub (para ler dados)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — do próprio BI
 *
 * Autenticação: só admins do BI podem invocar.
 * Query params:  ?dry_run=true     (não persiste, só retorna o que mudaria)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HUB_URL = Deno.env.get("HUB_SUPABASE_URL")!;
const HUB_KEY = Deno.env.get("HUB_SUPABASE_SERVICE_ROLE_KEY")!;
const BI_URL = Deno.env.get("SUPABASE_URL")!;
const BI_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface HubUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean | null;
  kommo_user_id: number | null;
  teams_user_id: string | null;
  phone_whatsapp: string | null;
}

interface HubDepartment {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  parent_department_id: number | null;
  color: string | null;
  is_active: boolean | null;
}

interface HubPlatform {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  base_url: string | null;
  is_active: boolean | null;
  display_order: number | null;
  default_role: string | null;
}

interface HubUserDepartment {
  user_id: string;
  department_id: number;
  is_primary: boolean | null;
  role: string;
}

interface SyncReport {
  dry_run: boolean;
  users: { total_hub: number; inserted: number; updated: number; skipped: number };
  departments: { total_hub: number; inserted: number; updated: number };
  platforms: { total_hub: number; inserted: number; updated: number; skipped_local: string[] };
  user_departments: { total_hub: number; inserted: number; removed: number };
  hub_deptos_slugs: string[];
  bi_user_count_before: number;
  bi_user_count_after: number;
  errors: string[];
}

async function verifyBIAdmin(bi: any, sessionToken: string): Promise<boolean> {
  const { data: { user }, error } = await bi.auth.getUser(sessionToken);
  if (error || !user) return false;
  const { data } = await bi
    .from("users_new")
    .select("is_global_admin, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return !!data?.is_active && !!data?.is_global_admin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    // Auth: só admins do BI
    const authHeader = req.headers.get("Authorization") ?? "";
    const sessionToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Authorization header ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bi = createClient(BI_URL, BI_KEY);
    const isAdmin = await verifyBIAdmin(bi, sessionToken);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado — admin do BI apenas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hub = createClient(HUB_URL, HUB_KEY);
    const report: SyncReport = {
      dry_run: dryRun,
      users: { total_hub: 0, inserted: 0, updated: 0, skipped: 0 },
      departments: { total_hub: 0, inserted: 0, updated: 0 },
      platforms: { total_hub: 0, inserted: 0, updated: 0, skipped_local: [] },
      user_departments: { total_hub: 0, inserted: 0, removed: 0 },
      hub_deptos_slugs: [],
      bi_user_count_before: 0,
      bi_user_count_after: 0,
      errors: [],
    };

    // ── 1. Puxar dados do Hub ────────────────────────────────────────────────
    const [hubUsersRes, hubDeptsRes, hubPlatformsRes, hubUserDeptsRes] = await Promise.all([
      hub.from("users").select("id, email, full_name, avatar_url, job_title, is_active, kommo_user_id, teams_user_id, phone_whatsapp"),
      hub.from("departments").select("id, slug, name, description, parent_department_id, color, is_active"),
      hub.from("platforms").select("id, slug, name, description, icon, color, base_url, is_active, display_order, default_role"),
      hub.from("user_departments").select("user_id, department_id, is_primary, role"),
    ]);

    if (hubUsersRes.error) throw new Error("Hub users: " + hubUsersRes.error.message);
    if (hubDeptsRes.error) throw new Error("Hub departments: " + hubDeptsRes.error.message);
    if (hubPlatformsRes.error) throw new Error("Hub platforms: " + hubPlatformsRes.error.message);
    if (hubUserDeptsRes.error) throw new Error("Hub user_departments: " + hubUserDeptsRes.error.message);

    const hubUsers = (hubUsersRes.data ?? []) as HubUser[];
    const hubDepts = (hubDeptsRes.data ?? []) as HubDepartment[];
    const hubPlatforms = (hubPlatformsRes.data ?? []) as HubPlatform[];
    const hubUserDepts = (hubUserDeptsRes.data ?? []) as HubUserDepartment[];

    report.users.total_hub = hubUsers.length;
    report.departments.total_hub = hubDepts.length;
    report.platforms.total_hub = hubPlatforms.length;
    report.user_departments.total_hub = hubUserDepts.length;
    report.hub_deptos_slugs = hubDepts.map((d) => d.slug).sort();

    const { count: countBefore } = await bi.from("users_new").select("*", { count: "exact", head: true });
    report.bi_user_count_before = countBefore ?? 0;

    if (dryRun) {
      return new Response(JSON.stringify({ ...report, note: "dry_run=true, nenhuma escrita foi feita" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Sync departments ──────────────────────────────────────────────────
    //    Primeiro sem parent_department_id pra não quebrar ordem
    const deptsWithoutParent = hubDepts.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      description: d.description,
      parent_department_id: null,
      color: d.color,
      is_active: d.is_active ?? true,
    }));
    const { error: deptErr1 } = await bi.from("departments").upsert(deptsWithoutParent, { onConflict: "id" });
    if (deptErr1) throw new Error("Upsert departments 1/2: " + deptErr1.message);

    // Passo 2: setar parent_department_id
    for (const d of hubDepts) {
      if (d.parent_department_id != null) {
        const { error } = await bi.from("departments").update({ parent_department_id: d.parent_department_id }).eq("id", d.id);
        if (error) report.errors.push(`parent dept ${d.slug}: ${error.message}`);
      }
    }
    report.departments.updated = hubDepts.length;

    // ── 3. Sync platforms (exceto 'bi') ──────────────────────────────────────
    const platformsFiltered = hubPlatforms.filter((p) => {
      if (p.slug === "bi") {
        report.platforms.skipped_local.push(p.slug);
        return false;
      }
      return true;
    });
    if (platformsFiltered.length > 0) {
      // Upsert só pelos SLUGs — preservar IDs locais
      const { error } = await bi.from("platforms").upsert(platformsFiltered.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        icon: p.icon,
        color: p.color,
        base_url: p.base_url,
        is_active: p.is_active ?? true,
        display_order: p.display_order ?? 0,
        default_role: p.default_role,
      })), { onConflict: "slug" });
      if (error) throw new Error("Upsert platforms: " + error.message);
      report.platforms.updated = platformsFiltered.length;
    }

    // ── 4. Sync users (preservando campos locais) ────────────────────────────
    //    Estratégia: upsert por email. Se já existe, mantém auth_user_id,
    //    is_global_admin, kommo_user_id locais. Se não existe, cria.
    const { data: biExistingUsers } = await bi
      .from("users_new")
      .select("id, email, auth_user_id, is_global_admin, kommo_user_id");
    const existingByEmail = new Map<string, any>();
    for (const u of biExistingUsers ?? []) existingByEmail.set(u.email.toLowerCase(), u);

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const hu of hubUsers) {
      if (!hu.email) { report.users.skipped++; continue; }
      const existing = existingByEmail.get(hu.email.toLowerCase());
      const base = {
        email: hu.email,
        full_name: hu.full_name,
        avatar_url: hu.avatar_url,
        job_title: hu.job_title,
        is_active: hu.is_active ?? true,
        teams_user_id: hu.teams_user_id,
        phone_whatsapp: hu.phone_whatsapp,
        synced_from_hub_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        // Update: preservar auth_user_id, is_global_admin, kommo_user_id locais
        toUpdate.push({ id: existing.id, ...base });
        report.users.updated++;
      } else {
        // Insert: usar id do Hub, kommo_user_id do Hub também (primeira vez)
        toInsert.push({
          id: hu.id,
          ...base,
          kommo_user_id: hu.kommo_user_id,
          is_global_admin: false,
          auth_user_id: null, // só preenche quando o user logar (via trigger) ou admin ativar
        });
        report.users.inserted++;
      }
    }

    // Batch insert
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const { error } = await bi.from("users_new").insert(batch);
      if (error) report.errors.push(`insert users batch ${i}: ${error.message}`);
    }

    // Batch update (um por um porque auth_user_id local deve ser preservado)
    for (const u of toUpdate) {
      const { id, ...fields } = u;
      const { error } = await bi.from("users_new").update(fields).eq("id", id);
      if (error) report.errors.push(`update user ${u.email}: ${error.message}`);
    }

    // ── 5. Sync user_departments ────────────────────────────────────────────
    //     Truncate + reinsert (operação simples; poucas linhas)
    const { data: usersAfter } = await bi.from("users_new").select("id");
    const validUserIds = new Set((usersAfter ?? []).map((u: any) => u.id));

    // Remove todos user_departments (serão reinseridos)
    const { error: delErr } = await bi.from("user_departments").delete().neq("id", -1);
    if (delErr) report.errors.push("delete user_departments: " + delErr.message);

    const validUserDepts = hubUserDepts.filter((ud) => validUserIds.has(ud.user_id));
    const toInsertUD = validUserDepts.map((ud) => ({
      user_id: ud.user_id,
      department_id: ud.department_id,
      is_primary: ud.is_primary ?? false,
      role: ud.role === "leader" ? "leader" : "member", // mapear outras roles (coordinator, etc) para member
    }));
    for (let i = 0; i < toInsertUD.length; i += 500) {
      const batch = toInsertUD.slice(i, i + 500);
      const { error } = await bi.from("user_departments").upsert(batch, { onConflict: "user_id,department_id" });
      if (error) report.errors.push(`insert user_departments batch ${i}: ${error.message}`);
    }
    report.user_departments.inserted = toInsertUD.length;
    report.user_departments.removed = (biExistingUsers ?? []).length > 0 ? 1 : 0; // flag que houve reset

    // ── 6. Link auth_user_id por email (para users sem link) ─────────────────
    //    Busca auth.users do BI e liga por email
    const { data: authUsers } = await bi.auth.admin.listUsers();
    for (const au of authUsers?.users ?? []) {
      const { error } = await bi
        .from("users_new")
        .update({ auth_user_id: au.id })
        .eq("email", au.email)
        .is("auth_user_id", null);
      if (error && !error.message.includes("no rows")) {
        report.errors.push(`link auth_user_id ${au.email}: ${error.message}`);
      }
    }

    const { count: countAfter } = await bi.from("users_new").select("*", { count: "exact", head: true });
    report.bi_user_count_after = countAfter ?? 0;

    // ── 7. Log ───────────────────────────────────────────────────────────────
    await bi.from("system_logs").insert({
      level: report.errors.length > 0 ? "warn" : "info",
      source: "edge:sync-from-hub",
      action: "sync.completed",
      metadata: report,
    });

    return new Response(JSON.stringify(report), {
      status: report.errors.length > 0 ? 207 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
