import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_KEY")!;

serve(async (req) => {
  try {
    const { postcode } = await req.json();

    if (!postcode) {
      return new Response(JSON.stringify({ error: "Postcode required" }), {
        status: 400,
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      postcode
    )}&components=country:UK&key=${GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results.length) {
      return new Response(
        JSON.stringify({ error: "Postcode not found", area: null }),
        { status: 404 }
      );
    }

    const result = data.results[0];
    let area = null;

    // Extract the administrative area (district/region)
    for (const component of result.address_components) {
      // Look for administrative_area_level_2 (district) first
      if (component.types.includes("administrative_area_level_2")) {
        area = component.long_name;
        break;
      }
      // Fallback to administrative_area_level_1 (county/region)
      if (component.types.includes("administrative_area_level_1")) {
        area = component.long_name;
      }
    }

    return new Response(JSON.stringify({ area, formatted: result.formatted_address }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
