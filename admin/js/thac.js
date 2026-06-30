/* ============================================================
   THAC Admin CRM — Shared Utilities
   ============================================================ */

// Google Maps API key — AIzaSyBf06LywaBHDNOCzj4Z8Cm0W6XAwk7iETc
const GOOGLE_MAPS_KEY = 'AIzaSyBf06LywaBHDNOCzj4Z8Cm0W6XAwk7iETc';

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
    case '1day':   return { tier: 'urgent',   label: 'Urgent',    class: 'badge-urgent' };
    case '3days':  return { tier: 'elevated', label: 'Elevated',  class: 'badge-elevated' };
    case '5days':  return { tier: 'standard', label: 'Standard',  class: 'badge-standard' };
    case '10days': return { tier: 'low',      label: 'Low',       class: 'badge-low' };
    default:       return { tier: 'low',      label: 'Low',       class: 'badge-low' };
  }
}

function getUrgencyRowClass(deadlineTier) {
  switch (deadlineTier) {
    case '1day':   return 'urgency-urgent';
    case '3days':  return 'urgency-elevated';
    case '5days':  return 'urgency-standard';
    case '10days': return 'urgency-low';
    default:       return 'urgency-low';
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
  '1day':   'Within 1 working day',
  '3days':  'Within 3 working days',
  '5days':  'Within 5 working days',
  '10days': 'Within 10 working days',
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
  return `<span class="badge ${u.class}">${u.label}</span>`;
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
      btn.innerHTML = '☰';
      btn.setAttribute('onclick', 'toggleSidebar()');
      btn.setAttribute('aria-label', 'Open menu');
      topbar.insertBefore(btn, topbar.firstChild);
    }
  }, 0);

  return `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div style="display:flex;align-items:center;">
          <div>
            <div class="logo-name">🌳 THAC</div>
            <div class="logo-sub">Trevor Heaps Arboricultural</div>
          </div>
          <button class="sidebar-close" onclick="closeSidebar()" aria-label="Close menu">✕</button>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
          <span class="nav-icon">📊</span> Dashboard
        </a>
        <a href="jobs.html" class="nav-item ${activePage === 'jobs' ? 'active' : ''}" data-page="jobs">
          <span class="nav-icon">💼</span> Jobs
        </a>
        <a href="map.html" class="nav-item ${activePage === 'map' ? 'active' : ''}" data-page="map">
          <span class="nav-icon">🗺️</span> Live Map
        </a>
        <a href="clients.html" class="nav-item ${activePage === 'clients' ? 'active' : ''}" data-page="clients">
          <span class="nav-icon">👥</span> Clients
        </a>
        <div class="nav-section">System</div>
        <a href="surveyors.html" class="nav-item ${activePage === 'surveyors' ? 'active' : ''}" data-page="surveyors">
          <span class="nav-icon">🔍</span> Surveyors
        </a>
        <a href="outcodes.html" class="nav-item ${activePage === 'outcodes' ? 'active' : ''}" data-page="outcodes">
          <span class="nav-icon">📍</span> Outcodes
        </a>
        <a href="surveyor-time-off.html" class="nav-item ${activePage === 'availability' ? 'active' : ''}" data-page="availability">
          <span class="nav-icon">📅</span> Availability
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${initials}</div>
          <div>
            <div class="user-name">Trevor</div>
            <div class="user-role">Admin</div>
          </div>
        </div>
        <button class="btn-logout" onclick="logout()">Sign Out</button>
      </div>
    </aside>
  `;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}