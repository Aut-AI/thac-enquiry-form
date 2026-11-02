// UK working days for the report request form (Trevor, 2 Nov 2026): skip
// weekends AND England & Wales bank holidays, and anything received after
// 3pm UK time counts as received the next working day.
//
// Survey SLAs still use addWorkingDays() in urgency.ts (weekends only).

const CUT_OFF_HOUR = 15; // 3pm, Europe/London

// England & Wales bank holidays, used if gov.uk can't be reached. Matches
// https://www.gov.uk/bank-holidays.json as of 2 Nov 2026; the live feed
// covers later years automatically.
const FALLBACK_BANK_HOLIDAYS = [
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
  "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29", "2028-08-28", "2028-12-25", "2028-12-26",
];

export async function loadBankHolidays(): Promise<Set<string>> {
  const days = new Set(FALLBACK_BANK_HOLIDAYS);
  try {
    const res = await fetch("https://www.gov.uk/bank-holidays.json", { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      for (const e of data?.["england-and-wales"]?.events ?? []) {
        if (typeof e.date === "string") days.add(e.date);
      }
    }
  } catch (e) {
    console.warn("Bank holidays: using fallback list:", e);
  }
  return days;
}

// Calendar date (YYYY-MM-DD) and hour in the UK for an instant
function londonNow(at: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Date arithmetic on plain YYYY-MM-DD strings (noon UTC, so no DST edge)
function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isWorkingDay(date: string, holidays: Set<string>): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(date);
}

// Due date (YYYY-MM-DD) for a request made at `at` that needs `n` working
// days. A request on a working day before 3pm counts from that day;
// otherwise it counts from the next working day. "Next working day" is n=1.
export function dueDate(at: Date, n: number, holidays: Set<string>): string {
  const { date, hour } = londonNow(at);
  let received = date;
  if (!isWorkingDay(received, holidays) || hour >= CUT_OFF_HOUR) {
    do { received = nextDay(received); } while (!isWorkingDay(received, holidays));
  }
  let due = received;
  for (let counted = 0; counted < n;) {
    due = nextDay(due);
    if (isWorkingDay(due, holidays)) counted++;
  }
  return due;
}
