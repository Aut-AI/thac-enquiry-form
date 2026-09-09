import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailWrapper, detailBlock, detailRow, ADMIN_EMAIL } from "../_shared/email-templates.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY")!;

// Must use the service role key, not anon -- this runs with no user
// session, and RLS on surveyors has no policy that lets anon (or any
// unauthenticated caller) read an arbitrary row. With the anon key this
// silently 404'd on every registration and the admin notification never
// sent, swallowed by the calling trigger's catch-all exception handler.
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const { surveyor_id } = await req.json();

    const { data: surveyor } = await supabase
      .from("surveyors")
      .select("id, full_name, email")
      .eq("id", surveyor_id)
      .single();

    if (!surveyor) {
      return new Response(JSON.stringify({ error: "Surveyor not found" }), {
        status: 404,
      });
    }

    const detailLink = `https://thac-enquiry-form-production.up.railway.app/admin/surveyor-detail.html?id=${surveyor.id}`;

    const html = emailWrapper(`
      <h2>New Surveyor Registration</h2>
      <p>A new surveyor has registered and is awaiting approval.</p>

      ${detailBlock([
        detailRow('Name', surveyor.full_name),
        detailRow('Email', surveyor.email),
      ].join(''))}

      <a href="${detailLink}" class="cta-button">
        Review & Approve →
      </a>
    `);

    await sendEmail(ADMIN_EMAIL, `New Surveyor Registration — ${surveyor.full_name}`, html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
