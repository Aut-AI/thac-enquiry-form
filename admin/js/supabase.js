/* ============================================================
   THAC Admin CRM — Supabase Connection & Auth
   ============================================================ */

const SUPABASE_URL = 'https://lemppaqgpntadeylzzwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbXBwYXFncG50YWRleWx6enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTUzOTMsImV4cCI6MjA5NDg5MTM5M30.SU2M7e5OSwqIjRJfM15uKLHTqSrLadcY46MR51twosU';

// ============================================================
// SUPABASE API HELPERS
// ============================================================

async function supabaseRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
    ...options.headers
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error ${response.status}: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// GET — fetch rows
async function dbGet(table, params = {}) {
  const query = new URLSearchParams(params).toString();
  return supabaseRequest(`${table}${query ? '?' + query : ''}`, {
    headers: { 'Prefer': 'return=representation' }
  });
}

// POST — insert row
async function dbInsert(table, data) {
  return supabaseRequest(table, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Prefer': 'return=representation' }
  });
}

// PATCH — update row
async function dbUpdate(table, filter, data) {
  return supabaseRequest(`${table}?${filter}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Prefer': 'return=representation' }
  });
}

// DELETE — delete row
async function dbDelete(table, filter) {
  return supabaseRequest(`${table}?${filter}`, { method: 'DELETE' });
}

// ============================================================
// STORAGE
// ============================================================

// Signed URL for a private bucket object. The admin CRM doesn't load the
// supabase-js SDK at all, so supabase.storage.*() isn't available here --
// this hits the Storage REST API directly with the signed-in admin's token,
// which the bucket policies check the same way.
async function storageSignedUrl(bucket, path, expiresIn = 3600) {
  const token = getAuthToken();
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ expiresIn }),
    }
  );

  if (!response.ok) {
    throw new Error(`Could not create signed URL (${response.status})`);
  }

  // The API returns a root-relative path like "/object/sign/<bucket>/<path>?token=..."
  const { signedURL } = await response.json();
  return `${SUPABASE_URL}/storage/v1${signedURL.replace(/^\/storage\/v1/, '')}`;
}

// ============================================================
// AUTH
// ============================================================

function getAuthToken() {
  const session = JSON.parse(localStorage.getItem('thac_session') || 'null');
  return session?.access_token || null;
}

function getUser() {
  const session = JSON.parse(localStorage.getItem('thac_session') || 'null');
  return session?.user || null;
}

function isLoggedIn() {
  const session = JSON.parse(localStorage.getItem('thac_session') || 'null');
  if (!session) return false;
  // Check expiry
  const expiresAt = session.expires_at * 1000;
  return Date.now() < expiresAt;
}

async function login(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.message || 'Login failed');
  }

  localStorage.setItem('thac_session', JSON.stringify(data));
  return data;
}

async function logout() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) { /* ignore */ }
  }
  localStorage.removeItem('thac_session');
  window.location.href = 'index.html';
}

// Guard — redirect to login if not authenticated
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
  }
}
