import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailWrapper, ADMIN_EMAIL } from "../_shared/email-templates.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

      <div class="detail-block">
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${surveyor.full_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${surveyor.email}</span>
        </div>
      </div>

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
