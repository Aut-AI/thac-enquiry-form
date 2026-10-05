// Urgency <-> enquiry-form deadline option <-> SLA. Keep in step with
// URGENCY_TIERS in admin/js/thac.js. The form offers 3 / 5 / 10 / 15 working
// days; each option is one urgency, and the SLA is that many working days out.

export function urgencyFromTier(tier: string | null | undefined): string {
  if (tier === "3days") return "red";
  if (tier === "5days") return "orange";
  if (tier === "7days" || tier === "10days") return "yellow"; // 7days: retired option
  return "grey";
}

export function daysForTier(tier: string | null | undefined): number {
  const m = /^(\d+)days$/.exec(tier ?? "");
  return m ? Number(m[1]) : 15;
}

// N working days (Mon-Fri) after `from`, as an ISO string
export function addWorkingDays(from: Date, n: number): string {
  const d = new Date(from);
  let counted = 0;
  while (counted < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) counted++;
  }
  return d.toISOString();
}
