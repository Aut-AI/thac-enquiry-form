import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Manages who can log into the admin CRM and what role they hold there.
// The client only ever holds the public anon key (see js/supabase.js) and
// creating/deleting login accounts needs the Auth Admin API, so account CRUD
// has to happen server-side with the service role key -- this function is
// that boundary.
//
// Roles live in public.users (role: 'admin' | 'user' | 'surveyor'), which
// also backs the RLS policies on jobs/clients/quotes/pricing/surveyors --
// see migrations/20260805_admin_user_roles.sql. Only 'admin' can call the
// mutating endpoints here (inviting, editing, disabling, deleting other
// accounts is itself an admin-only action, same as Settings).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Where invite/recovery email links land -- set-password.html reads the
// session token Supabase puts in the URL fragment and lets the user choose
// a password, since inviteUserByEmail() deliberately never generates one.
const SET_PASSWORD_URL = "https://ciaran-aut-ai.github.io/thac-admin/set-password.html";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface AppUserRow {
  id: string;
  role: "admin" | "user" | "surveyor";
  full_name: string;
  email: string;
  is_active: boolean;
}

async function getAppUser(id: string): Promise<AppUserRow | null> {
  const { data, error } = await admin
    .from("users")
    .select("id, role, full_name, email, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const { data: { user: caller }, error: authError } = await anon.auth.getUser(token);
  if (authError || !caller) return json({ error: "Invalid or expired session" }, 401);

  try {
    // Every method here is either reading or changing who has admin CRM
    // access, so every method requires the caller to be an active admin --
    // 'user' role accounts don't get to see or touch this page at all.
    const callerAppUser = await getAppUser(caller.id);
    if (!callerAppUser || callerAppUser.role !== "admin" || !callerAppUser.is_active) {
      return json({ error: "Admin access required" }, 403);
    }

    if (req.method === "GET") {
      const { data: authData, error: authListError } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (authListError) throw authListError;

      const { data: appUsers, error: appUsersError } = await admin
        .from("users")
        .select("id, role, is_active, full_name");
      if (appUsersError) throw appUsersError;
      const appUserById = new Map((appUsers ?? []).map((u) => [u.id, u]));

      const users = authData.users
        .map((u) => {
          const appUser = appUserById.get(u.id);
          return {
            id: u.id,
            email: u.email,
            full_name: appUser?.full_name ?? (u.user_metadata as Record<string, unknown> | null)?.full_name ?? null,
            role: appUser?.role ?? null,
            crm_active: appUser?.is_active ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at,
            banned_until: (u as { banned_until?: string }).banned_until ?? null,
          };
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      return json({ users });
    }

    if (req.method === "POST") {
      const { email, full_name, role } = await req.json();
      if (!email) return json({ error: "Email is required" }, 400);
      const resolvedRole = role === "admin" ? "admin" : "user";

      // Sends a "you've been invited" email with a link to set a password --
      // avoids ever handling or transmitting a temporary password ourselves.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: full_name ? { full_name } : undefined,
        redirectTo: SET_PASSWORD_URL,
      });
      if (error) throw error;

      const { error: upsertError } = await admin.from("users").upsert({
        id: data.user.id,
        email,
        full_name: full_name || email,
        role: resolvedRole,
        is_active: true,
      });
      if (upsertError) throw upsertError;

      return json({ user: data.user }, 201);
    }

    if (req.method === "PATCH") {
      const { id, email, full_name, role, banned } = await req.json();
      if (!id) return json({ error: "id is required" }, 400);
      if (banned && id === caller.id) {
        return json({ error: "You can't disable your own account" }, 400);
      }
      if (role && role !== "admin" && id === caller.id) {
        return json({ error: "You can't remove your own admin access" }, 400);
      }

      const authUpdate: Record<string, unknown> = {};
      if (email) authUpdate.email = email;
      if (full_name !== undefined) authUpdate.user_metadata = { full_name };
      if (banned !== undefined) authUpdate.ban_duration = banned ? "876000h" : "none";

      if (Object.keys(authUpdate).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
        if (error) throw error;
      }

      // role/full_name/email changes need public.users kept in sync since
      // that's what RLS everywhere else actually checks; banning only blocks
      // login, so is_active mirrors it here for anyone who still has a live
      // session/token when disabled.
      if (role === "none") {
        // "No CRM Access" -- revoke rather than upsert, since 'none' isn't
        // a real role value. Leaves the auth account (and any surveyor
        // access) untouched, just removes CRM access.
        const { error: revokeError } = await admin.from("users").delete().eq("id", id);
        if (revokeError) throw revokeError;
      } else if (role || full_name !== undefined || email || banned !== undefined) {
        const existing = await getAppUser(id);
        const upsertPayload: Record<string, unknown> = { id };
        if (role) upsertPayload.role = role;
        else if (existing) upsertPayload.role = existing.role;
        if (full_name !== undefined) upsertPayload.full_name = full_name;
        else upsertPayload.full_name = existing?.full_name ?? email ?? undefined;
        if (email) upsertPayload.email = email;
        else upsertPayload.email = existing?.email;
        if (banned !== undefined) upsertPayload.is_active = !banned;
        else upsertPayload.is_active = existing?.is_active ?? true;

        // Nothing to upsert if this account has never had a public.users
        // row and this call isn't assigning one a role -- e.g. a plain
        // ban/enable on a surveyor-only account should stay a no-op here.
        if (existing || role) {
          const { error: upsertError } = await admin.from("users").upsert(upsertPayload);
          if (upsertError) throw upsertError;
        }
      }

      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;

      return json({ user: data.user });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ error: "id is required" }, 400);
      if (id === caller.id) return json({ error: "You can't delete your own account" }, 400);

      const { error: deleteAppUserError } = await admin.from("users").delete().eq("id", id);
      if (deleteAppUserError) throw deleteAppUserError;

      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;

      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("admin-users error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
