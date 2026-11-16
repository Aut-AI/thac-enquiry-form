import { supabase } from './supabase';

// What a surveyor will be paid for a job, shown BEFORE they claim it
// (Trevor, 16 Nov 2026). Same maths as the claim_job database function:
// (1 + on-site hours x tree band) x the surveyor's own hourly rate. If the
// office has already set a figure on the job (surveyor_pay_amount), that wins.
const BAND_INDEX: Record<string, number> = { '1-20': 1, '21-40': 2, '41-60': 3, '61-80': 4, '81-100': 5 };

export interface PayContext {
  hourlyRate: number | null;
  hoursPerBand: Record<string, number>;
  hoursOnSite: Record<string, number>;
}

export async function loadPayContext(surveyorId: string | null): Promise<PayContext> {
  const [{ data: types }, { data: me }] = await Promise.all([
    supabase.from('survey_types').select('survey_type,hours_per_band,hours_on_site'),
    surveyorId ? supabase.from('surveyors').select('hourly_rate').eq('id', surveyorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const hoursPerBand: Record<string, number> = {};
  const hoursOnSite: Record<string, number> = {};
  (types || []).forEach((t: any) => {
    hoursPerBand[t.survey_type] = Number(t.hours_per_band);
    hoursOnSite[t.survey_type] = Number(t.hours_on_site);
  });
  return { hourlyRate: (me as any)?.hourly_rate != null ? Number((me as any).hourly_rate) : null, hoursPerBand, hoursOnSite };
}

export function payFor(
  job: { survey_type: string; surveyor_pay_amount?: number | null },
  band: string | null | undefined,
  ctx: PayContext,
): number | null {
  if (job.surveyor_pay_amount) return Number(job.surveyor_pay_amount);
  if (!ctx.hourlyRate) return null;
  const idx = band ? BAND_INDEX[band] : undefined;
  const hours = idx && ctx.hoursPerBand[job.survey_type]
    ? ctx.hoursPerBand[job.survey_type] * idx
    : ctx.hoursOnSite[job.survey_type] ?? 1;
  return Math.round((1 + hours) * ctx.hourlyRate * 100) / 100;
}
