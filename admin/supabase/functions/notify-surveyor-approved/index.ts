import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailWrapper } from "../_shared/email-templates.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY")!;

// Must use the service role key, not anon -- see notify-new-surveyor-registered
// for why: no user session here, and RLS has no policy letting anon read
// an arbitrary surveyor row, so this silently 404'd on every approval and
// the surveyor never got their "you're approved" email.
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

    const html = emailWrapper(`
      <h2>You're Approved</h2>
      <p>Welcome, ${surveyor.full_name} — your account has been approved and you can
         now log in to the Heaps Arboriculture surveyor app. Open the app and enter
         your credentials to get started.</p>
    `);

    await sendEmail(surveyor.email, "Your Heaps Arboriculture Account Is Approved", html);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
