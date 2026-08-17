# THAC Projects Monorepo

A unified repository containing all THAC (The Housing Authority of Canada) projects.

## Project Structure

```
thac-enquiry-form/
├── admin/           # THAC Admin Dashboard
│   ├── .github/     # GitHub Actions workflows
│   ├── css/         # Stylesheets
│   ├── js/          # JavaScript files
│   └── supabase/    # Supabase functions
│
└── enquiry-form/    # THAC Enquiry Form
    └── index.html   # Main form page
```

## Projects

### Admin Dashboard (`/admin`)
The THAC admin dashboard for managing clients, jobs, surveyors, and enquiries.

**Features:**
- Client management
- Job tracking
- Surveyor management
- Enquiry tracking
- Real-time updates via Supabase

**Key Files:**
- `dashboard.html` - Main dashboard
- `clients.html` - Client management
- `jobs.html` - Job management
- `surveyors.html` - Surveyor management
- `enquiries.html` - Enquiry tracking

### Enquiry Form (`/enquiry-form`)
Public-facing enquiry form for submitting THAC requests.

**Files:**
- `index.html` - Main enquiry form

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Aut-AI/thac-enquiry-form.git
   cd thac-enquiry-form
   ```

2. Install dependencies (if needed):
   - Admin dashboard requires Supabase configuration
   - Refer to individual project documentation

## Local Supabase CLI

Use the portable Supabase CLI wrappers in the repo root:

```cmd
supabase-version.cmd
supabase-start.cmd
supabase-link.cmd
supabase-login.cmd
```

If the normal wrapper does not show output, you can also verify the bundled Node-based CLI directly:

```cmd
run-supabase.cmd --version
```

If your triggers are not firing after inserts, run the combined webhook migration in Supabase SQL Editor:

```text
admin/supabase/migrations/000_create_webhooks_and_schema.sql
```

> Important: Supabase SQL Editor expects raw SQL. Open the file, copy its content, paste it into SQL Editor, then execute it.

If Docker is installed, run:

```cmd
supabase-start.cmd
```

Then log in if needed:

```cmd
supabase-login.cmd
```

Then link the project:

```cmd
supabase-link.cmd
```

## Environment Configuration

### Supabase
Create a `.env` file in the project root with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Development

Each project can be developed independently within this monorepo structure.

### Admin Dashboard
Navigate to `admin/` and check the local documentation for build/run instructions.

### Enquiry Form
Navigate to `enquiry-form/` and open `index.html` in a browser.

## Deployment

- **`enquiry-form/`** deploys straight to GitHub Pages from this repo (`deploy-pages.yml`, in `.github/workflows/`) on every push to `main` — live at `aut-ai.github.io/thac-enquiry-form/`.
- **`admin/`** is served by Railway, not GitHub Pages. `Dockerfile` builds an nginx image that serves the entire repo as static files (`railway.toml` points Railway at that Dockerfile); Railway is connected directly to this repo (`Aut-AI/thac-enquiry-form`) and redeploys automatically on every push to `main`. Live at `thac-enquiry-form-production.up.railway.app/admin/`. There is no separate admin repo and nothing to keep in sync — this repo is the only source.
- **Edge Functions** (`admin/supabase/functions/`) deploy from this repo directly to Supabase (`deploy-functions.yml`).

Note: because the Dockerfile copies the whole repo (`COPY . /usr/share/nginx/html`) with no `.dockerignore`, everything in the repo is publicly reachable over HTTP at its file path on the Railway domain — including `admin/supabase/migrations/*.sql` and the edge function source under `admin/supabase/functions/`. Nothing secret is committed (Supabase creds are the public anon key by design), but this is more surface area than intended and worth tightening with a `.dockerignore` at some point.

## Contributing

1. Create a feature branch
2. Make your changes
3. Commit with descriptive messages
4. Push and create a pull request

## License

[Add your license information here]
