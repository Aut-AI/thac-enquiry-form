// ============================================================
// THAC — notify-surveyors
// Trigger: pg_cron every 5 minutes (migration 20261116006)
// Sends:   1. "New job available" to surveyors whose coverage includes the
//             job. First-pick surveyors get it first; everyone else once the
//             First Pick Window (pricing_settings.first_pick_hours) is over.
//          2. "Job allocated to you" to the surveyor Trevor allocated it to.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { serviceKeyHeaders } from '../_shared/service-key.ts';
import { sendEmail, emailWrapper, detailBlock, detailRow, SURVEY_LABELS } from '../_shared/email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SB_THAC_SERVICE_ROLE_KEY')!;
const headers = { ...serviceKeyHeaders(SERVICE_ROLE_KEY), 'Content-Type': 'application/json' };

function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function get(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
  return await r.json();
}
async function patch(path: string, body: unknown) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

function jobBlock(j: any): string {
  const deadline = j.sla_deadline
    ? new Date(j.sla_deadline).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Not set';
  return detailBlock([
    detailRow('Survey Type', SURVEY_LABELS[j.survey_type] || j.survey_type || '—'),
    detailRow('Site Postcode', j.site_postcode || '—'),
    detailRow('Report Due', deadline),
  ].join(''));
}

serve(async () => {
  let availableSent = 0, allocatedSent = 0;
  try {
    const nowIso = new Date().toISOString();

    // ---- 1. New jobs available ----
    const settings = (await get('pricing_settings?select=first_pick_hours&limit=1'))[0];
    const windowHours = Number(settings?.first_pick_hours ?? 0);
    const surveyors: any[] = await get(
      'surveyors?select=id,full_name,email,first_pick,home_lat,home_lng,radius_miles&is_active=eq.true&is_paused=eq.false&email=not.is.null');
    const jobs: any[] = await get(
      'jobs?select=id,reference,survey_type,site_postcode,site_lat,site_lng,sla_deadline,deadline_tier,red_at,first_pick_alerted_at,surveyors_alerted_at' +
      '&dispatch_state=eq.red&surveyor_id=is.null&allocated_surveyor_id=is.null&is_archived=not.eq.true' +
      '&surveyors_alerted_at=is.null&site_lat=not.is.null&site_lng=not.is.null');

    for (const j of jobs) {
      const covering = surveyors.filter(s =>
        s.home_lat != null && s.home_lng != null && s.radius_miles != null &&
        miles(Number(s.home_lat), Number(s.home_lng), Number(j.site_lat), Number(j.site_lng)) <= Number(s.radius_miles));
      const firstPickers = covering.filter(s => s.first_pick);
      const inWindow = windowHours > 0 && j.deadline_tier !== '1day' && firstPickers.length > 0 && j.red_at &&
        new Date(j.red_at).getTime() + windowHours * 3600000 > Date.now();

      let recipients: any[];
      if (inWindow) {
        if (j.first_pick_alerted_at) continue;
        recipients = firstPickers;
      } else {
        recipients = j.first_pick_alerted_at ? covering.filter(s => !s.first_pick) : covering;
      }

      const early = inWindow;
      for (const s of recipients) {
        const html = emailWrapper(`
          <h2>New job available near you</h2>
          <p>Hi ${(s.full_name || '').split(' ')[0] || 'there'}, a new job is available in your area${early ? ', and you have first pick of it for the next ' + windowHours + (windowHours === 1 ? ' hour' : ' hours') + '.' : '.'}</p>
          ${jobBlock(j)}
          <p>Open the Heaps Arboriculture app and look under Available Jobs to see the details and the pay. It is first come, first served.</p>
        `);
        try { await sendEmail(s.email, `New job available — ${SURVEY_LABELS[j.survey_type] || j.survey_type || 'Survey'}, ${j.site_postcode || ''}`.trim(), html); availableSent++; } catch (e) { console.error('email failed', s.email, e); }
      }
      await patch(`jobs?id=eq.${j.id}`, inWindow ? { first_pick_alerted_at: nowIso } : { surveyors_alerted_at: nowIso });
    }

    // ---- 2. Allocated to a surveyor ----
    const allocated: any[] = await get(
      'jobs?select=id,reference,survey_type,site_postcode,sla_deadline,allocated_surveyor_id,allocated_at,allocation_alerted_at,allocation_timeout_hours' +
      '&allocated_surveyor_id=not.is.null&surveyor_id=is.null&allocation_rejected_at=is.null&is_archived=not.eq.true');
    for (const j of allocated) {
      if (j.allocation_alerted_at && j.allocated_at && new Date(j.allocation_alerted_at) >= new Date(j.allocated_at + 'Z')) continue;
      if (j.allocation_alerted_at && !j.allocated_at) continue;
      const s = surveyors.find(x => x.id === j.allocated_surveyor_id);
      if (!s) continue;
      const hrs = j.allocation_timeout_hours || 48;
      const html = emailWrapper(`
        <h2>A job has been allocated to you</h2>
        <p>Hi ${(s.full_name || '').split(' ')[0] || 'there'}, Trevor has allocated you this job.</p>
        ${jobBlock(j)}
        <p>Please open the Heaps Arboriculture app and accept it within ${hrs} hours, or hand it back if you can't take it.</p>
      `);
      try { await sendEmail(s.email, `Job allocated to you — ${j.site_postcode || SURVEY_LABELS[j.survey_type] || ''}`.trim(), html); allocatedSent++; } catch (e) { console.error('email failed', s.email, e); continue; }
      await patch(`jobs?id=eq.${j.id}`, { allocation_alerted_at: nowIso });
    }

    return new Response(JSON.stringify({ availableSent, allocatedSent }), { status: 200 });
  } catch (err) {
    console.error('notify-surveyors error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message, availableSent, allocatedSent }), { status: 500 });
  }
});
