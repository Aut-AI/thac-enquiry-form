/* ============================================================
   THAC Admin CRM — Shared Utilities
   ============================================================ */

// Google Maps API key — AIzaSyBf06LywaBHDNOCzj4Z8Cm0W6XAwk7iETc
const GOOGLE_MAPS_KEY = 'AIzaSyBf06LywaBHDNOCzj4Z8Cm0W6XAwk7iETc';

// ============================================================
// ICON SYSTEM — inline line icons (24x24 grid, currentColor), replacing
// the emoji that used to be hand-typed into every page. Single shared
// source so e.g. "Archived" is always the same glyph everywhere.
// ============================================================

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8V7.5"/><line x1="3" y1="13" x2="21" y2="13"/>',
  map: '<path d="M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7l-6-2Z"/><line x1="9" y1="5" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="19"/>',
  mapPin: '<path d="M12 21s7-7.6 7-12.4A7 7 0 0 0 5 8.6C5 13.4 12 21 12 21Z"/><circle cx="12" cy="8.6" r="2.4"/>',
  users: '<circle cx="8.5" cy="8" r="3"/><path d="M3 19.5c0-3.3 2.5-5.7 5.5-5.7s5.5 2.4 5.5 5.7"/><circle cx="17" cy="9" r="2.4"/><path d="M15.3 14c2.3.4 3.7 2.3 3.7 5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-4 3.2-6.6 7.2-6.6s7.2 2.6 7.2 6.6"/>',
  userCheck: '<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 20c0-3.7 2.7-6.1 6-6.1"/><path d="M14.5 15.5l2 2 4-4.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><line x1="3.5" y1="9.8" x2="20.5" y2="9.8"/><line x1="8" y1="3" x2="8" y2="6.6"/><line x1="16" y1="3" x2="16" y2="6.6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><line x1="12" y1="2.5" x2="12" y2="5.3"/><line x1="12" y1="18.7" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5.3" y2="12"/><line x1="18.7" y1="12" x2="21.5" y2="12"/><line x1="5.4" y1="5.4" x2="7.4" y2="7.4"/><line x1="16.6" y1="16.6" x2="18.6" y2="18.6"/><line x1="5.4" y1="18.6" x2="7.4" y2="16.6"/><line x1="16.6" y1="7.4" x2="18.6" y2="5.4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.3" y1="15.3" x2="21" y2="21"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  menu: '<line x1="4" y1="6.5" x2="20" y2="6.5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17.5" x2="20" y2="17.5"/>',
  check: '<path d="M4.5 12.5l5 5L20 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12.3l2.7 2.7L16.4 9"/>',
  alertTriangle: '<path d="M12 3.3 21.5 20H2.5Z"/><line x1="12" y1="9.3" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
  helpCircle: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.9.4-1.4 1-1.4 2.1"/><circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none"/>',
  infoCircle: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.4" r="1" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.6 2.1"/>',
  alarm: '<circle cx="12" cy="12.5" r="8"/><path d="M12 8.5v4.5l3 1.8"/><line x1="6.5" y1="4" x2="4.7" y2="2.3"/><line x1="17.5" y1="4" x2="19.3" y2="2.3"/>',
  pause: '<rect x="7.5" y="5" width="3.2" height="14" rx="1"/><rect x="13.3" y="5" width="3.2" height="14" rx="1"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4" rx="1"/><path d="M4.8 8v10.5a1.5 1.5 0 0 0 1.5 1.5h11.4a1.5 1.5 0 0 0 1.5-1.5V8"/><line x1="10" y1="12.2" x2="14" y2="12.2"/>',
  pencil: '<path d="M4 20l0.8-3.6L15.4 5.8l2.8 2.8L7.6 19.2 4 20Z"/><line x1="13.8" y1="7.4" x2="16.6" y2="10.2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  refresh: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1l1.5 1.6"/><polyline points="18.5 4.5 19 8.5 15 8.5"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L5 15.5"/><polyline points="5.5 19.5 5 15.5 9 15.5"/>',
  link: '<rect x="4.3" y="10" width="8" height="4" rx="2" transform="rotate(-45 8.3 12)"/><rect x="11.7" y="10" width="8" height="4" rx="2" transform="rotate(-45 15.7 12)"/>',
  paperclip: '<path d="M8 12.8V6.5a3 3 0 0 1 6 0v9.3a1.7 1.7 0 0 1-3.4 0V7.8"/>',
  download: '<path d="M12 3.5v11.5"/><polyline points="7.5 11 12 15.5 16.5 11"/><line x1="5" y1="20" x2="19" y2="20"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><polyline points="4 7 12 13 20 7"/>',
  currency: '<circle cx="12" cy="12" r="9"/><text x="12" y="16" font-size="10.5" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="700" stroke="none" fill="currentColor">£</text>',
  chartBar: '<line x1="3.5" y1="20.5" x2="20.5" y2="20.5"/><rect x="5" y="14" width="3.6" height="6.3" rx="0.6"/><rect x="10.2" y="9.5" width="3.6" height="10.8" rx="0.6"/><rect x="15.4" y="4.5" width="3.6" height="15.8" rx="0.6"/>',
  receipt: '<path d="M6 3h12v17.5l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z"/><line x1="8.6" y1="8" x2="15.4" y2="8"/><line x1="8.6" y1="12" x2="15.4" y2="12"/>',
  document: '<path d="M7 3h6.5l4.5 4.5V21H7Z"/><path d="M13.5 3v4.5H18"/><line x1="9.5" y1="13" x2="15" y2="13"/><line x1="9.5" y1="16.5" x2="15" y2="16.5"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><polyline points="4.5 17 9 12.5 12.5 16 16 12 20 16.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l4.5-2.6v9.2L16 14Z"/>',
  lightbulb: '<path d="M9.2 18.2h5.6"/><path d="M12 3.3a6 6 0 0 0-3.4 10.9c.6.5 1 1.2 1 2h4.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.3Z"/><line x1="10.2" y1="21" x2="13.8" y2="21"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="8"/><line x1="12" y1="13.5" x2="12" y2="9.3"/><line x1="9.7" y1="2" x2="14.3" y2="2"/><line x1="12" y1="2" x2="12" y2="4.3"/>',
  flag: '<line x1="6" y1="3" x2="6" y2="21"/><path d="M6 4.5h12l-3.2 4.2 3.2 4.2H6Z"/>',
  arrowLeft: '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="10.5 6.5 5 12 10.5 17.5"/>',
  chevronUp: '<polyline points="5.5 15.5 12 9 18.5 15.5"/>',
  chevronDown: '<polyline points="5.5 8.5 12 15 18.5 8.5"/>',
};

function icon(name, size = 16) {
  const body = ICON_PATHS[name];
  if (!body) return '';
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// Flat fir-silhouette brand mark, replacing the 🌳 emoji logo.
function brandMark(size = 20) {
  return `<svg class="brand-mark" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" stroke="none"><polygon points="12,2 6.2,11.5 17.8,11.5"/><polygon points="12,7 4.2,18.5 19.8,18.5"/><rect x="10.4" y="18.5" width="3.2" height="3.6" rx="0.5"/></svg>`;
}

// Small solid-colour dot for severity/urgency, replacing 🔴🟠🟡🟢⚫ — the
// colour comes from the CSS custom properties below instead of however the
// viewer's OS happens to render an emoji.
function dot(tone) {
  return `<span class="status-dot status-dot-${tone}"></span>`;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================
// DATE FORMATTING
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

// ============================================================
// URGENCY CALCULATION
// ============================================================

function getUrgencyTier(deadlineTier) {
  switch (deadlineTier) {
    case '3days':   return { tier: 'urgent',   label: 'Urgent',    class: 'badge-urgent' };
    case '5days':   return { tier: 'elevated', label: 'Elevated',  class: 'badge-elevated' };
    case '7days':   return { tier: 'standard', label: 'Standard',  class: 'badge-standard' };
    case '10days':  return { tier: 'low',      label: 'Low',       class: 'badge-low' };
    case 'no_rush': return { tier: 'low',      label: 'Low',       class: 'badge-low' };
    default:        return { tier: 'low',      label: 'Low',       class: 'badge-low' };
  }
}

function getUrgencyRowClass(deadlineTier) {
  switch (deadlineTier) {
    case '3days':   return 'urgency-urgent';
    case '5days':   return 'urgency-elevated';
    case '7days':   return 'urgency-standard';
    case '10days':  return 'urgency-low';
    case 'no_rush': return 'urgency-low';
    default:        return 'urgency-low';
  }
}

// ============================================================
// SURVEY TYPE LABELS
// ============================================================

const SURVEY_TYPE_LABELS = {
  // Admin CRM keys
  bs5837:      'BS5837 Tree Survey (Planning)',
  vta:         'Visual Tree Assessment',
  bc:          'BS5837 Stage 2 (AIA/AMS/TPP)',
  subs:        'Subsidence / Building Damage',
  ams:         'Arboricultural Method Statement',
  tpp:         'Tree Protection Plan',
  tpo:         'TPO Application',
  lscp:        'Landscaping Plans',
  mortgage:    'Mortgage / Insurer Report',
  supervision: 'Site Supervision',
  amendment:   'Amendment',
  other:       'Other',
  // Enquiry form keys
  planning_stage1:  'Planning — Stage 1 (BS5837)',
  planning_stage2:  'Planning — Stage 2 (AIA/AMS/TPP)',
  health_safety:    'Tree Condition / Risk Survey',
  insurer_mortgage: 'Insurer / Mortgage Lender',
  subsidence:       'Building Damage / Subsidence',
  nhbc:             'Foundation Depths (NHBC)',
  site_visit:       'Site Visit & Advice',
  resistograph:     'Resistograph Testing',
};

function getSurveyLabel(type) {
  return SURVEY_TYPE_LABELS[type] || type || '—';
}

// ============================================================
// DEADLINE LABELS
// ============================================================

const DEADLINE_LABELS = {
  '3days':   'Within 3 working days',
  '5days':   'Within 5 working days',
  '7days':   'Within 7 working days',
  '10days':  'Within 10 working days',
  '15days':  'Within 15 working days or more',
  'no_rush': 'No rush (just looking)',
};

function getDeadlineLabel(tier) {
  return DEADLINE_LABELS[tier] || tier || '—';
}

// ============================================================
// STATUS BADGE HTML
// ============================================================

function statusBadge(status) {
  if (!status) return '<span class="badge badge-low">—</span>';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return `<span class="badge badge-${status}">${label}</span>`;
}

function urgencyBadge(deadlineTier) {
  const u = getUrgencyTier(deadlineTier);
  return `<span class="badge ${u.class}">${dot(u.tier)}${u.label}</span>`;
}

// ============================================================
// DISPATCH / SURVEYOR STATUS META — single source of truth for the
// red/orange/yellow/green traffic-light states, previously copy-pasted
// (with drifting emoji, e.g. 📦 vs 🗄 for "Archived") into 5+ pages.
// ============================================================

const DISPATCH_META = {
  pending_approval:  { label: 'Pending Approval',  cls: 'badge-low',      glyph: 'clock' },
  waiting_for_plans: { label: 'Waiting for Plans', cls: 'badge-low',      glyph: 'clock' },
  red:               { label: 'Unallocated',       cls: 'badge-urgent',   tone: 'urgent' },
  orange:            { label: 'Claimed',           cls: 'badge-elevated', tone: 'elevated' },
  yellow:            { label: 'Attended',          cls: 'badge-standard', tone: 'standard' },
  green:             { label: 'Report Sent',       cls: 'badge-accepted', tone: 'complete' },
  archived:          { label: 'Archived',          cls: 'badge-low',      glyph: 'archive' },
};

const URGENCY_COLOR_META = {
  red:    { label: 'Urgent',   cls: 'badge-urgent',   tone: 'urgent' },
  orange: { label: 'Elevated', cls: 'badge-elevated', tone: 'elevated' },
  yellow: { label: 'Standard', cls: 'badge-standard', tone: 'standard' },
  grey:   { label: 'Low',      cls: 'badge-low',      tone: 'low' },
  green:  { label: 'Complete', cls: 'badge-accepted', tone: 'complete' },
};

function getDispatchMeta(state) {
  return DISPATCH_META[state] || { label: state || '—', cls: 'badge-low', tone: 'low' };
}

function getUrgencyColorMeta(color) {
  return URGENCY_COLOR_META[color] || { label: color || '—', cls: 'badge-low', tone: 'low' };
}

function dispatchGlyph(state) {
  const m = getDispatchMeta(state);
  return m.glyph ? icon(m.glyph, 12) : dot(m.tone);
}

function dispatchBadge(state) {
  const m = getDispatchMeta(state);
  return `<span class="badge ${m.cls}">${dispatchGlyph(state)}${m.label}</span>`;
}

function urgencyColorBadge(color) {
  const m = getUrgencyColorMeta(color);
  return `<span class="badge ${m.cls}">${dot(m.tone)}${m.label}</span>`;
}

const SURVEYOR_STATUS_META = {
  pending:  { label: 'Pending Approval', cls: 'badge-elevated', glyph: 'clock' },
  active:   { label: 'Active',           cls: 'badge-accepted', glyph: 'checkCircle' },
  paused:   { label: 'Paused',           cls: 'badge-low',      glyph: 'pause' },
  archived: { label: 'Archived',         cls: 'badge-low',      glyph: 'archive' },
};

function surveyorStatusBadge(status) {
  const m = SURVEYOR_STATUS_META[status] || SURVEYOR_STATUS_META.paused;
  return `<span class="badge ${m.cls}">${icon(m.glyph, 12)}${m.label}</span>`;
}

// Login-account status for a surveyor's linked app account (separate from
// their CRM record status above).
function accountStatusBadge(account) {
  if (!account) return '<span class="badge badge-low">No login</span>';
  if (account.banned_until && new Date(account.banned_until) > new Date()) {
    return `<span class="badge badge-low">${icon('pause', 12)}Disabled</span>`;
  }
  if (!account.email_confirmed_at) {
    return `<span class="badge badge-elevated">${icon('clock', 12)}Invited</span>`;
  }
  return `<span class="badge badge-accepted">${icon('checkCircle', 12)}Active</span>`;
}

// Traffic-light status for an expiry date (insurance / DBS documents).
function expiryStatus(dateStr) {
  if (!dateStr) return { cls: 'badge-low', label: '— Not set', detail: '' };
  const days = Math.floor((new Date(dateStr) - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0)   return { cls: 'badge-urgent',   label: `${dot('urgent')}Expired`,        detail: `Expired ${Math.abs(days)}d ago` };
  if (days <= 30) return { cls: 'badge-elevated', label: `${dot('elevated')}${days}d left`, detail: `Expires ${formatDate(dateStr)}` };
  return             { cls: 'badge-accepted', label: `${dot('complete')}Valid`,          detail: `Expires ${formatDate(dateStr)}` };
}

// ============================================================
// SIDEBAR ACTIVE STATE
// ============================================================

function setActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageId) item.classList.add('active');
  });
}

// ============================================================
// SIDEBAR HTML (shared across all pages)
// ============================================================

function renderSidebar(activePage) {
  const user = getUser();
  const initials = user?.email ? user.email[0].toUpperCase() : 'T';

  setTimeout(() => {
    const topbar = document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.menu-toggle')) {
      const btn = document.createElement('button');
      btn.className = 'menu-toggle';
      btn.innerHTML = icon('menu', 18);
      btn.setAttribute('onclick', 'toggleSidebar()');
      btn.setAttribute('aria-label', 'Open menu');
      topbar.insertBefore(btn, topbar.firstChild);
    }
    refreshSidebarUser();
  }, 0);

  return `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div style="display:flex;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${brandMark(18)}
            <div>
              <div class="logo-name">THAC</div>
              <div class="logo-sub">Heaps Arboriculture</div>
            </div>
          </div>
          <button class="sidebar-close" onclick="closeSidebar()" aria-label="Close menu">${icon('x', 16)}</button>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
          <span class="nav-icon">${icon('dashboard', 16)}</span> Dashboard
        </a>
        <a href="jobs.html" class="nav-item ${activePage === 'jobs' ? 'active' : ''}" data-page="jobs">
          <span class="nav-icon">${icon('briefcase', 16)}</span> Jobs
        </a>
        <a href="map.html" class="nav-item ${activePage === 'map' ? 'active' : ''}" data-page="map">
          <span class="nav-icon">${icon('map', 16)}</span> Live Map
        </a>
        <a href="clients.html" class="nav-item ${activePage === 'clients' ? 'active' : ''}" data-page="clients">
          <span class="nav-icon">${icon('users', 16)}</span> Clients
        </a>
        <div class="nav-section">System</div>
        <a href="surveyors.html" class="nav-item ${activePage === 'surveyors' ? 'active' : ''}" data-page="surveyors">
          <span class="nav-icon">${icon('userCheck', 16)}</span> Surveyors
        </a>
        <a href="outcodes.html" class="nav-item ${activePage === 'outcodes' ? 'active' : ''}" data-page="outcodes">
          <span class="nav-icon">${icon('mapPin', 16)}</span> Postcode Areas
        </a>
        <a href="surveyor-time-off.html" class="nav-item ${activePage === 'availability' ? 'active' : ''}" data-page="availability">
          <span class="nav-icon">${icon('calendar', 16)}</span> Availability
        </a>
        <a href="users.html" class="nav-item nav-admin-only ${activePage === 'users' ? 'active' : ''}" data-page="users">
          <span class="nav-icon">${icon('user', 16)}</span> System Users
        </a>
        <a href="settings.html" class="nav-item nav-admin-only ${activePage === 'settings' ? 'active' : ''}" data-page="settings">
          <span class="nav-icon">${icon('gear', 16)}</span> Settings
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar" id="sidebarAvatar">${initials}</div>
          <div>
            <div class="user-name" id="sidebarUserName">${user?.email || ''}</div>
            <div class="user-role" id="sidebarUserRole">&nbsp;</div>
          </div>
        </div>
        <button class="btn-logout" onclick="logout()">Sign Out</button>
      </div>
    </aside>
  `;
}

// Fetches the signed-in user's own public.users row fresh on every page
// load (rather than trusting whatever was cached in thac_session at login
// time) so the sidebar name/role and the nav-admin-only items reflect the
// current DB state, not stale data from whenever they last logged in.
let currentUserRole = null;

async function refreshSidebarUser() {
  const user = getUser();
  if (!user) return;

  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');

  try {
    const rows = await dbGet('users', { select: 'full_name,role,is_active', id: `eq.${user.id}` });
    const me = rows?.[0];

    if (me && me.is_active) {
      currentUserRole = me.role;
      if (nameEl) nameEl.textContent = me.full_name || user.email;
      if (roleEl) roleEl.textContent = me.role.charAt(0).toUpperCase() + me.role.slice(1);
      if (avatarEl) avatarEl.textContent = (me.full_name || user.email)[0].toUpperCase();
    } else {
      // No public.users row (or deactivated) -- not CRM staff, e.g. a
      // surveyor-only login. They have no RLS access to anything admin-only
      // regardless of what this page shows, but hide the links too.
      currentUserRole = null;
      if (roleEl) roleEl.textContent = me ? 'Disabled' : 'No CRM Access';
    }

    if (currentUserRole !== 'admin') {
      document.querySelectorAll('.nav-admin-only').forEach(el => el.style.display = 'none');
    }
  } catch (e) {
    console.error('Failed to load current user:', e);
  }
}

// Guard for admin-only pages (Settings, System Users). Mirrors requireAuth()'s
// redirect-based pattern. Always re-checks against the DB -- never trusts a
// role cached from login time.
async function requireAdmin() {
  const user = getUser();
  if (!user) {
    window.location.href = 'index.html';
    return false;
  }
  try {
    const rows = await dbGet('users', { select: 'role,is_active', id: `eq.${user.id}` });
    const me = rows?.[0];
    if (!me || me.role !== 'admin' || !me.is_active) {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  } catch (e) {
    window.location.href = 'dashboard.html';
    return false;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ============================================================
// CLIENTS
// ============================================================

// Looks up an existing client by email (case-insensitive) so repeat
// customers don't get duplicate rows; creates one if none exists. Used to
// link jobs to clients at approval time, since nothing else in the app
// currently creates a `clients` row.
async function findOrCreateClient({ full_name, email, phone, address }) {
  if (email) {
    const existing = await dbGet('clients', {
      'select': 'id',
      'email': `ilike.${email}`,
      'limit': 1,
    });
    if (existing?.[0]) return existing[0].id;
  }

  const user = getUser();
  const inserted = await dbInsert('clients', {
    client_type: 'individual',
    client_category: 'other',
    full_name: full_name || null,
    email: email || null,
    phone: phone || null,
    address_line_1: address || null,
    created_by_user_id: user?.id || null,
  });
  return inserted?.[0]?.id || null;
}