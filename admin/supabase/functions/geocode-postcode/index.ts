import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceKeyHeaders } from "../_shared/service-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_THAC_SERVICE_ROLE_KEY");

interface PostcodesIOResponse {
  status: number;
  result?: {
    postcode: string;
    latitude: number;
    longitude: number;
    admin_district: string;
  };
}

serve(async (req) => {
  try {
    const { surveyor_id } = await req.json();

    if (!surveyor_id || !/^[0-9a-f-]{36}$/i.test(surveyor_id)) {
      return new Response(JSON.stringify({ error: "Surveyor ID required" }), {
        status: 400,
      });
    }

    // Geocode the postcode stored on the surveyor's row, never one supplied
    // in the request. This function is called by the
    // geocode_surveyor_postcode trigger and has to accept unauthenticated
    // calls (--no-verify-jwt), so trusting a caller-supplied postcode would
    // let anyone move any surveyor's home location -- and with it their
    // coverage area and which jobs they're offered. The trigger fires via
    // pg_net after commit, so the row already holds the new postcode.
    const surveyorRes = await fetch(
      `${SUPABASE_URL}/rest/v1/surveyors?id=eq.${surveyor_id}&select=home_postcode&limit=1`,
      { headers: serviceKeyHeaders(SUPABASE_SERVICE_ROLE_KEY!) }
    );
    const postcode = (await surveyorRes.json())?.[0]?.home_postcode;
    if (!postcode) {
      return new Response(JSON.stringify({ error: "Surveyor or postcode not found" }), {
        status: 404,
      });
    }

    const normalized = postcode.toUpperCase().trim().replace(/\s+/g, " ");

    const apiUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`;
    const response = await fetch(apiUrl);
    const data: PostcodesIOResponse = await response.json();

    if (data.status !== 200 || !data.result) {
      console.error(`Postcode not found: ${normalized}`);
      return new Response(
        JSON.stringify({ error: "Postcode not found" }),
        { status: 404 }
      );
    }

    const { latitude, longitude, admin_district } = data.result;

    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/surveyors?id=eq.${surveyor_id}`,
      {
        method: "PATCH",
        headers: {
          ...serviceKeyHeaders(SUPABASE_SERVICE_ROLE_KEY!),
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          home_lat: latitude,
          home_lng: longitude,
          area_name: admin_district,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`Failed to update surveyor: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to save geocoding result" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        latitude,
        longitude,
        area_name: admin_district,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
