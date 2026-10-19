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
| `notify-quote-accepted` | `enquiries` UPDATE (status → accepted) | Alert admin: quote accepted, job now on the map, create the database |
| `notify-job-created` | `jobs` INSERT | Alert admin when a job is added straight onto the map (skips website jobs awaiting acceptance) |
| `notify-job-approved` | `jobs` UPDATE (dispatch → red) | Now only emails on a hand-back (orange → red); there is no approval step |
| `notify-surveyor-claimed` | `jobs` UPDATE (dispatch → orange) | Alert admin: job allocated, create/send the database |
| `notify-field-data-uploaded` | `jobs` UPDATE (field_data_uploaded → true) | Alert admin: survey data received (surveyor tapped Data Sent) |
| `notify-report-sent` | `jobs` UPDATE (report_finalised → true) | Retired 2026-10-19 (stub, sends nothing): report and invoice are one step |

### Job Lifecycle

Trevor's process, agreed 2026-10-19 (in-app guide: `admin/help/job-journey.html`; stage labels and hover help: `DISPATCH_META` / `STATUS_HELP` in `admin/js/thac.js`). `jobs.dispatch_state` keeps its original colour-code values so app builds already on phones keep working:

| `dispatch_state` | Shown as | Set by |
|---|---|---|
| `pending_approval` | Awaiting go-ahead (off map) | `submit-enquiry` creates the job here; Remove from Map |
| `waiting_for_plans` | Waiting for plans (off map) | Stage 2 / New job |
| `red` | Unallocated (red pin) | quote accepted (`respond-to-quote`), New job, Put on Map, Stage 2 activate, hand-back |
| `orange` | Allocated (green pin) | `claim_job` RPC |
| `yellow` | Survey done, awaiting data | surveyor app: Survey Done |
| `data_received` | Data received, report to complete | surveyor app: Data Sent (data is in SharePoint) |
| `awaiting_client` | Awaiting client · part invoiced / not invoiced | job page: Tree Data Sent |
| `archived` | Job complete (or Archived if declined) | job page: Report & Invoice Sent (records invoice + report_finalised) |

There is no approval step: a claim is final. Office to-dos are the database (`axi_prepared` + `database_plan`: digital plan or JPEG awaiting the digital plan) and `report_drafted`, shown from creation. `guard_surveyor_job_update` limits what surveyors can write, and maps old app builds' one-tap "Mark Field Data Uploaded" to `data_received`. `green` (Report sent) is legacy and no longer set.

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
