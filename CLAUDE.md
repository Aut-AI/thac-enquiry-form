# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

THAC (Trevor Heaps Arboricultural Consultancy) is a monorepo with two sub-projects:

- **`enquiry-form/`** — Public-facing multi-step quote form (`index.html`), self-contained
- **`admin/`** — Internal CRM dashboard (multi-page vanilla JS app backed by Supabase)

There is no build step, no bundler, and no package manager. Everything runs as static HTML opened directly in a browser. In production, the whole repo is served as static files by nginx inside a Docker container on Railway (`Dockerfile`, `nginx.conf`, `railway.toml`) — auto-deployed on every push to `main`. `enquiry-form/` is additionally deployed to GitHub Pages (`aut-ai.github.io/thac-enquiry-form/`) via `deploy-pages.yml`, but `admin/` is Railway-only; there is no separate admin repo or mirror.

## Running Locally

Open any HTML file directly in a browser — no server required for most development. To test Supabase interactions, all pages talk directly to the live Supabase project (credentials are hardcoded as the public anon key, which is intentional for a Supabase-pattern app).

## Deploying Edge Functions

Edge Functions live in `admin/supabase/functions/`. They are deployed via GitHub Actions on push to `main` when files under `supabase/functions/**` change. To deploy manually:

```bash
supabase functions deploy <function-name> --project-ref lemppaqgpntadeylzzwn
```

Secrets required (set in GitHub Actions and Supabase):
- `SUPABASE_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Architecture

### Admin CRM (`admin/`)

All admin pages follow the same pattern:

1. Two shared scripts loaded via `<script>` tags — `js/supabase.js` then `js/thac.js`
2. Page calls `requireAuth()` at the top (redirects to `index.html` if session expired)
3. `init()` renders the layout by calling `renderSidebar(activePage)` then fetches data from Supabase
4. Data is fetched via the REST helpers in `supabase.js`: `dbGet(table, params)`, `dbInsert(table, data)`, `dbUpdate(table, filter, data)` — these are thin wrappers around the Supabase REST API, not the Supabase JS SDK

**`js/supabase.js`** — Supabase connection, auth session management (`thac_session` in localStorage), `login()`, `logout()`, `requireAuth()`, and the three DB helpers above.

**`js/thac.js`** — Shared UI: `renderSidebar()`, `showToast()`, `formatDate()`, `timeAgo()`, `statusBadge()`, `urgencyBadge()`, `getUrgencyTier()`. Also defines `SURVEY_TYPE_LABELS` and `DEADLINE_LABELS` used for display.

### Enquiry Form (`enquiry-form/index.html`)

Entirely self-contained single HTML file. State is held in module-level JS variables (`branch`, `selectedSurveyType`, `currentStep`). Navigation between steps uses `goTo(stepId)` which toggles `.active` on `.step-panel` elements. Submissions hit the Supabase REST API directly (no shared `supabase.js`). Pricing constants (`BASE_PRICES`, `SURCHARGES`) are defined inline.

### Edge Functions (`admin/supabase/functions/`)

Deno/TypeScript functions deployed to Supabase. All share `_shared/email-templates.ts` for HTML email layout and `sendEmail()` (which calls the Resend API). Each function is a database webhook triggered by an `INSERT` or `UPDATE` on a specific table.

| Function | Trigger | Purpose |
|---|---|---|
| `notify-new-enquiry` | `enquiries` INSERT | Alert admin of new public form submission |
| `notify-job-created` | `jobs` INSERT | Alert admin when enquiry is accepted → job created |
| `notify-job-approved` | `jobs` UPDATE (status → approved) | Notify when Trevor approves |
| `notify-surveyor-claimed` | `jobs` UPDATE (surveyor assigned) | Notify surveyor of assignment |
| `notify-field-data-uploaded` | `jobs` UPDATE | Alert admin when surveyor uploads data |
| `notify-report-sent` | `jobs` UPDATE (status → report_sent) | Notify client when report is ready |

### Job Lifecycle

Enquiry (public form) → `enquiries` table (statuses: `new` → `reviewed` → `quoted` → `accepted` / `declined` / `spam`) → accepted enquiry becomes a row in `jobs` table → surveyor claims → field data uploaded → report sent.

### Key Production Values

- Supabase project ref: `lemppaqgpntadeylzzwn`
- Admin CRM URL: `https://thac-enquiry-form-production.up.railway.app/admin/`
- Email sending: Resend API via `_shared/email-templates.ts`
- `ADMIN_EMAIL` in `email-templates.ts` is currently a test address — swap to Trevor's when going live
- `FROM_ADDRESS` uses Resend's shared onboarding domain — swap to a verified custom domain for production

## Coverage & Travel Pricing Modes

The public enquiry form supports two switchable coverage/pricing modes, selected by `pricing_settings.coverage_mode`. **This switch is deliberately NOT exposed in the admin UI** — it is a developer-only setting (Ciaran/Nick), changed via SQL in the Supabase dashboard. Do not add an admin-facing toggle for it. Both systems stay intact, so switching back is a one-line update:

```sql
UPDATE pricing_settings SET coverage_mode = 'surveyor_coverage';  -- or 'travel_cost_areas'
```

- **`surveyor_coverage`** (original/default) — postcode gate is auto-computed from active surveyors' home locations + radius (`postcode_areas.is_covered` coarse check, `surveyor_service_outcodes` granular check). No travel cost in the quote.
- **`travel_cost_areas`** (Trevor's static list) — postcode gate checks the customer's postcode *area* (1–2 leading letters, e.g. "GL") against the `travel_cost_areas` table (seeded from Trevor's outcode travel-cost list, migration `20260731_travel_cost_areas.sql`). If covered, the area's `travel_cost` (£300/£400/£500 excl. VAT) is added to the quote as a separate line item, the area's `note` (the "consider a local consultant" text for £400/£500 areas) is shown to the customer, and the applied cost is stored on `enquiries.travel_cost`.

The mode only affects the public enquiry form's gate and quote. Surveyor registration, radius coverage, and the auto-sync triggers are unchanged and keep running in both modes.

## Logging Decisions and Requests

Trevor (the client) frequently asks for changes verbally or over other channels, not just in this repo. When a conversation surfaces a request, decision, or piece of context from Trevor (or anyone else) that isn't otherwise captured in code or commit history, save it as a memory immediately — don't wait to be asked to remember. This is the only durable record across sessions; without it, requests get lost between conversations.
