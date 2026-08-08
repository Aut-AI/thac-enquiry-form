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
   git clone https://github.com/Ciaran-aut-ai/thac-enquiry-form.git
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

GitHub Actions workflows are configured in `.github/workflows/` for automated deployments.

- **`enquiry-form/`** deploys straight to GitHub Pages from this repo (`deploy-pages.yml`) on every push to `main`.
- **`admin/`** is *not* served from this repo. The live CRM at `ciaran-aut-ai.github.io/thac-admin` is GitHub Pages on a separate repo, `Ciaran-aut-ai/thac-admin`. `sync-admin.yml` mirrors the Pages-served part of `admin/` (`*.html`, `css/`, `js/`) into that repo on every push to `main` that touches `admin/`.
- **Edge Functions** (`admin/supabase/functions/`) deploy from this repo directly to Supabase (`deploy-functions.yml`) — unrelated to which repo serves the admin pages.

`sync-admin.yml` needs a `THAC_ADMIN_SYNC_TOKEN` repo secret: a token with `contents: write` on `Ciaran-aut-ai/thac-admin` (this repo's own `GITHUB_TOKEN` has no access to a different repo). To set it up:

1. Someone with write access to `Ciaran-aut-ai/thac-admin` generates a token scoped to that repo only (GitHub → Settings → Developer settings → Fine-grained tokens → Repository access: `Ciaran-aut-ai/thac-admin` → Permissions: Contents: Read and write).
2. Set it as a secret on *this* repo (not the target repo): `gh secret set THAC_ADMIN_SYNC_TOKEN --repo Aut-AI/thac-enquiry-form`, or via GitHub → this repo → Settings → Secrets and variables → Actions.

Until that secret exists, `sync-admin.yml` runs on every relevant push but fails at the "Checkout target" step — admin/ changes still need a manual copy-and-push to `Ciaran-aut-ai/thac-admin` in the meantime.

## Contributing

1. Create a feature branch
2. Make your changes
3. Commit with descriptive messages
4. Push and create a pull request

## License

[Add your license information here]
