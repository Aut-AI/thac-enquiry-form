import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-templates.ts";

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

    const adminEmail = "nick@njasolutionsltd.com";
    const detailLink = `https://thac-admin.vercel.app/admin/surveyor-detail.html?id=${surveyor.id}`;

    await sendEmail({
      to: adminEmail,
      subject: `New surveyor registration — ${surveyor.full_name}`,
      html: `
        <p>A new surveyor has registered and is awaiting approval.</p>
        <p><strong>${surveyor.full_name}</strong> (${surveyor.email})</p>
        <p><a href="${detailLink}">Review and approve in admin</a></p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
