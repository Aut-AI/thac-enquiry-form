import { supabase } from './supabase';

// Extract the outcode (everything except the last 3 characters) from a UK postcode
// E.g. "SW19 2AB" → "SW19", "E1 6AN" → "E1", "M1 1AE" → "M1"
export function extractOutcode(postcode: string): string {
  if (!postcode) return '';
  const normalized = postcode.toUpperCase().trim().replace(/\s+/g, '');
  return normalized.slice(0, -3);
}

// Fetch all outcode strings for a surveyor's computed service area
export async function fetchServiceOutcodes(surveyorId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('surveyor_service_outcodes')
    .select('outcode')
    .eq('surveyor_id', surveyorId);

  if (error) {
    console.error('Failed to fetch service outcodes:', error);
    return new Set();
  }

  return new Set(data?.map(row => row.outcode) || []);
}

// Check if a postcode falls within a surveyor's service area
export async function isPostcodeInServiceArea(
  surveyorId: string,
  postcode: string
): Promise<boolean> {
  const outcodes = await fetchServiceOutcodes(surveyorId);
  const postcode_outcode = extractOutcode(postcode);
  return outcodes.has(postcode_outcode);
}
