import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const { postcode, surveyor_id } = await req.json();

    if (!postcode) {
      return new Response(JSON.stringify({ error: "Postcode required" }), {
        status: 400,
      });
    }

    if (!surveyor_id) {
      return new Response(JSON.stringify({ error: "Surveyor ID required" }), {
        status: 400,
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
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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
