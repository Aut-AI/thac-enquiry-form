import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Manages who can log into the admin CRM. The client only ever holds the
// public anon key (see js/supabase.js) and PostgREST has no access to
// auth.users, so account CRUD has to happen server-side with the service
// role key -- this function is that boundary.
//
// Access model matches the rest of the CRM: any signed-in Supabase user can
// call this (verified below), there's no separate admin-role table. See
// CLAUDE.md.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_LOGIN_URL = "https://ciaran-aut-ai.github.io/thac-admin/index.html";

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
    if (req.method === "GET") {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) throw error;

      const users = data.users
        .map((u) => ({
          id: u.id,
          email: u.email,
          full_name: (u.user_metadata as Record<string, unknown> | null)?.full_name ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          banned_until: (u as { banned_until?: string }).banned_until ?? null,
        }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      return json({ users });
    }

    if (req.method === "POST") {
      const { email, full_name } = await req.json();
      if (!email) return json({ error: "Email is required" }, 400);

      // Sends a "you've been invited" email with a link to set a password --
      // avoids ever handling or transmitting a temporary password ourselves.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: full_name ? { full_name } : undefined,
        redirectTo: ADMIN_LOGIN_URL,
      });
      if (error) throw error;

      return json({ user: data.user }, 201);
    }

    if (req.method === "PATCH") {
      const { id, email, full_name, banned } = await req.json();
      if (!id) return json({ error: "id is required" }, 400);
      if (banned && id === caller.id) {
        return json({ error: "You can't disable your own account" }, 400);
      }

      const update: Record<string, unknown> = {};
      if (email) update.email = email;
      if (full_name !== undefined) update.user_metadata = { full_name };
      if (banned !== undefined) update.ban_duration = banned ? "876000h" : "none";

      const { data, error } = await admin.auth.admin.updateUserById(id, update);
      if (error) throw error;

      return json({ user: data.user });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ error: "id is required" }, 400);
      if (id === caller.id) return json({ error: "You can't delete your own account" }, 400);

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
