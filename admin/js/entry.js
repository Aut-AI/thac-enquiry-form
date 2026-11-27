// ============================================================
// QUICK DATA ENTRY
// openNewCustomerModal() and openNewJobModal() let Trevor add customers and
// jobs directly, without going through the public enquiry form.
// Needs js/supabase.js and js/thac.js loaded first.
//
//   openNewCustomerModal({ onCreated(id) })   // defaults to opening the customer
//   openNewJobModal({ clientId })             // clientId pre-selects a customer
//
// A job can be added to an existing customer, or add a new customer at the
// same time. Customers are matched by email so nobody is added twice.
// ============================================================

(function () {
  const CSS = `
  .ent-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex;
    align-items: flex-start; justify-content: center; padding: 24px 16px; overflow-y: auto; }
  .ent-modal { background: #fff; border-radius: 16px; padding: 28px; width: 100%; max-width: 640px;
    box-shadow: 0 20px 60px rgba(0,0,0,.3); }
  .ent-title { font-size: 18px; font-weight: 700; color: var(--green-dark); margin-bottom: 4px; }
  .ent-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  .ent-section { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--text-muted); margin: 22px 0 10px; padding-top: 16px; border-top: 1px solid var(--border); }
  .ent-section:first-of-type { border-top: 0; margin-top: 0; padding-top: 0; }
  .ent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .ent-grid .full { grid-column: 1 / -1; }
  .ent-modal .form-group { margin-bottom: 14px; }
  .ent-footer { display: flex; gap: 10px; margin-top: 22px; }
  .ent-footer .btn { flex: 1; justify-content: center; }
  .ent-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
  .ent-seg button { border: 0; background: #fff; padding: 8px 16px; font-weight: 500; font-size: 13px; font-family: inherit; cursor: pointer; color: var(--text-muted); }
  .ent-seg button.on { background: var(--green-dark); color: #fff; }
  .ent-results { border: 1px solid var(--border); border-radius: 10px; margin-top: 6px; max-height: 220px; overflow-y: auto; }
  .ent-results div { padding: 9px 12px; cursor: pointer; font-size: 13.5px; border-bottom: 1px solid var(--border); }
  .ent-results div:last-child { border-bottom: 0; }
  .ent-results div:hover { background: #f3f6f4; }
  .ent-results small { color: var(--text-muted); display: block; }
  .ent-chosen { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 10px; background: #eef6f1; font-size: 14px; }
  .ent-chosen button { border: 0; background: none; color: var(--green-dark); cursor: pointer; font-weight: 600; }
  .ent-warn { background: #fff7e6; border: 1px solid #f3d9a4; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 14px; }
  .ent-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  @media (max-width: 560px) { .ent-grid { grid-template-columns: 1fr; } .ent-modal { padding: 20px; } }`;

  function injectCss() {
    if (document.getElementById('entCss')) return;
    const s = document.createElement('style');
    s.id = 'entCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id)?.value || '').trim();
  const clientName = (c) => c.company_name && c.full_name ? `${c.full_name} (${c.company_name})` : (c.company_name || c.full_name || c.email || 'Unnamed');

  function closeModal() { document.getElementById('entModal')?.remove(); }

  function openShell(title, sub, bodyHtml) {
    injectCss();
    closeModal();
    const o = document.createElement('div');
    o.id = 'entModal';
    o.className = 'ent-overlay';
    o.innerHTML = `<div class="ent-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="ent-title">${escapeHtml(title)}</div>
      <div class="ent-sub">${sub}</div>
      ${bodyHtml}
    </div>`;
    document.body.appendChild(o);
    // Close on a click on the dark backdrop, but only one that starts and ends
    // there. The backdrop scrolls, so its scrollbar belongs to it: pressing the
    // scrollbar used to count as a backdrop press and closed the form mid-entry
    // (Trevor's D2-D4 test notes, 11 Nov 2026). And once anything is typed, ask
    // before throwing it away.
    let dirty = false, pressedBackdrop = false;
    o.addEventListener('input', () => { dirty = true; });
    o.addEventListener('mousedown', (e) => {
      pressedBackdrop = e.target === o && e.offsetX < o.clientWidth && e.offsetY < o.clientHeight;
    });
    o.addEventListener('click', (e) => {
      const close = pressedBackdrop && e.target === o;
      pressedBackdrop = false;
      if (close && (!dirty || confirm('Close this form? What you have typed will be lost.'))) closeModal();
    });
    return o;
  }

  // ----------------------------------------------------------
  // Customers / contacts
  // ----------------------------------------------------------
  // One list of contacts (the clients table). What a contact IS on a job is
  // set per job (Trevor's scenarios, 27 Nov 2026):
  //   introducer  = the firm that sent the work (Heritage Trees, Trinity...)
  //   who asked   = a person at that firm (clients.parent_client_id = firm)
  //   end client  = the person whose site it is (details kept on the job)
  //   bill to     = the introducer or the end client
  // Type is just a label now; any contact can be picked in any role.

  // Finds a contact by any of its email addresses (case-insensitive).
  async function clientByEmail(email) {
    const first = splitEmails(email)[0];
    if (!first) return null;
    const safe = first.replace(/[%*,()"\\]/g, '');
    let rows;
    try {
      rows = await dbGet('clients', { select: 'id,full_name,company_name,email', or: `(email.ilike.${safe},other_emails.ilike.*${safe}*)`, limit: 1 });
    } catch (e) {
      rows = await dbGet('clients', { select: 'id,full_name,company_name,email', email: `ilike.${safe}`, limit: 1 });
    }
    return rows?.[0] || null;
  }

  // Adds a contact unless one with the same email already exists.
  // Returns { id, existing } so callers can tell which happened.
  async function createClientRecord(c) {
    const dup = await clientByEmail(c.email);
    if (dup) return { id: dup.id, existing: true, client: dup };
    const user = getUser();
    const emails = splitEmails(c.email);
    const row = {
      client_type: c.type || 'individual',
      client_category: 'other',
      full_name: c.full_name || null,
      company_name: c.company_name || null,
      email: emails[0] || null,
      phone: c.phone || null,
      address_line_1: c.address_line_1 || null,
      address_line_2: c.address_line_2 || null,
      address_city: c.address_city || null,
      address_county: c.address_county || null,
      address_postcode: c.address_postcode ? c.address_postcode.toUpperCase() : null,
      notes: c.notes || null,
      created_by_user_id: user?.id || null,
    };
    if (emails.length > 1) row.other_emails = emails.slice(1).join(', ');
    if (c.parent_client_id) row.parent_client_id = c.parent_client_id;
    if (c.default_fee != null && c.default_fee !== '') row.default_fee = Number(c.default_fee);
    if (c.default_bill_to) row.default_bill_to = c.default_bill_to;
    const inserted = await dbInsert('clients', row);
    const id = inserted?.[0]?.id;
    if (!id) throw new Error('The contact was not saved');
    return { id, existing: false, client: inserted[0] };
  }

  function customerFields(p) {
    return `
      <div class="ent-grid">
        <div class="form-group"><label>Type</label>
          <select class="form-control" id="${p}type">
            <option value="individual">Individual (e.g. a homeowner)</option>
            <option value="company">Company</option>
            <option value="agent">Introducer firm (sends you work)</option>
            <option value="developer">Developer</option>
          </select></div>
        <div class="form-group"></div>
        <div class="form-group"><label>Company</label>
          <input class="form-control" id="${p}company" autocomplete="off" placeholder="e.g. Trinity Claims"></div>
        <div class="form-group"><label>Contact name</label>
          <input class="form-control" id="${p}name" autocomplete="off" placeholder="e.g. Sarah Jones"></div>
        <div class="full ent-hint" style="margin:-8px 0 12px;">A person's name, a company name, or both. At least one is needed.</div>
        <div class="form-group"><label>Email(s)</label>
          <input class="form-control" id="${p}email" autocomplete="off" placeholder="Separate several with commas">
          </div>
        <div class="form-group"><label>Phone</label>
          <input class="form-control" id="${p}phone" type="tel" autocomplete="off"></div>
        <div class="form-group"><label>Postcode</label>
          <input class="form-control" id="${p}pc" style="text-transform:uppercase" autocomplete="off"></div>
        <div class="form-group full"><label>Address line 1</label>
          <input class="form-control" id="${p}a1" autocomplete="off"></div>
        <div class="form-group"><label>City</label>
          <input class="form-control" id="${p}city" autocomplete="off"></div>
        <div class="form-group"><label>County</label>
          <input class="form-control" id="${p}county" autocomplete="off"></div>
      </div>`;
  }

  // Cursor goes to Company for firms, to Contact name for people.
  function wireTypeFocus(p) {
    const t = $(p + 'type');
    if (!t) return;
    const go = () => $(['company', 'agent', 'developer'].includes(t.value) ? p + 'company' : p + 'name')?.focus();
    t.onchange = go;
    go();
  }

  function readCustomer(p) {
    return {
      type: val(p + 'type') || 'individual',
      full_name: val(p + 'name'),
      company_name: val(p + 'company'),
      email: val(p + 'email'),
      phone: val(p + 'phone'),
      address_line_1: val(p + 'a1'),
      address_city: val(p + 'city'),
      address_county: val(p + 'county'),
      address_postcode: val(p + 'pc'),
    };
  }

  function checkCustomer(c) {
    if (!c.full_name && !c.company_name) return 'Enter a contact name or a company';
    const bad = badEmail(c.email);
    if (bad) return `"${bad}" does not look like an email address`;
    return null;
  }

  window.openNewCustomerModal = function (opts = {}) {
    openShell('New customer', 'Add a person or a firm. They can then be picked as an introducer, the person who asked, or who to bill.', `
      ${customerFields('nc_')}
      <div id="nc_msg"></div>
      <div class="ent-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('entModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nc_save">Add customer</button>
      </div>`);
    if (opts.type) $('nc_type').value = opts.type;
    wireTypeFocus('nc_');
    $('nc_save').onclick = async () => {
      const c = readCustomer('nc_');
      if (opts.parentId) c.parent_client_id = opts.parentId;
      const problem = checkCustomer(c);
      if (problem) { showToast(problem, 'error'); return; }
      const btn = $('nc_save');
      btn.disabled = true;
      try {
        const r = await createClientRecord(c);
        if (r.existing) {
          $('nc_msg').innerHTML = `<div class="ent-warn">Someone with that email is already on the system:
            <b>${escapeHtml(clientName(r.client))}</b>. <a href="client-detail.html?id=${r.id}">Open them</a> instead of adding a second one.</div>`;
          btn.disabled = false;
          return;
        }
        showToast('Customer added');
        closeModal();
        if (opts.onCreated) opts.onCreated(r.id);
        else window.location.href = `client-detail.html?id=${r.id}`;
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
        btn.disabled = false;
      }
    };
  };

  // ----------------------------------------------------------
  // Map pin picker (Leaflet, loaded on demand)
  // ----------------------------------------------------------
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (window._leafletLoading) return window._leafletLoading;
    window._leafletLoading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = resolve; js.onerror = reject;
      document.head.appendChild(js);
    });
    return window._leafletLoading;
  }

  // "51.5, -0.12", a Google Maps link (@51.5,-0.12 / q=51.5,-0.12 / !3d51.5!4d-0.12)
  function parseLatLng(text) {
    const t = String(text || '');
    let m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t)
      || /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t)
      || /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t)
      || /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/.exec(t);
    if (!m) return null;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  // Draws a map with a draggable pin in `el`. Returns { set(lat,lng,zoom), get() }.
  // onChange({lat,lng}) fires whenever the pin moves.
  async function mountPinMap(el, start, onChange) {
    await loadLeaflet();
    const has = start && start.lat != null && start.lng != null;
    const map = L.map(el, { scrollWheelZoom: false }).setView(has ? [start.lat, start.lng] : [51.2, -1.3], has ? 16 : 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    let marker = null, cur = has ? { lat: Number(start.lat), lng: Number(start.lng) } : null;
    function place(lat, lng) {
      cur = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => { const p = marker.getLatLng(); place(p.lat, p.lng); });
      } else marker.setLatLng([lat, lng]);
      onChange && onChange(cur);
    }
    if (has) place(cur.lat, cur.lng);
    map.on('click', e => place(e.latlng.lat, e.latlng.lng));
    setTimeout(() => map.invalidateSize(), 150);
    return {
      set(lat, lng, zoom) { map.setView([lat, lng], zoom || 16); place(lat, lng); },
      get() { return cur; },
    };
  }

  function pinBlock(p) {
    return `
      <div class="form-group full">
        <label>Site pin <span class="ent-hint" style="display:inline;font-weight:400;">drag the pin, or click the map, to the exact spot</span></label>
        <div id="${p}map" style="height:230px;border-radius:10px;border:1px solid var(--border);"></div>
        <input class="form-control" id="${p}paste" autocomplete="off" style="margin-top:8px;"
          placeholder="Or paste a Google Maps link, or coordinates like 50.7412, -1.6301">
        <div class="ent-hint" id="${p}pinmsg"></div>
      </div>`;
  }

  async function wirePin(p, start) {
    const msg = $(p + 'pinmsg');
    const show = c => { if (msg) msg.textContent = c ? `Pin at ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : 'No pin yet: enter the postcode or click the map.'; };
    const pin = await mountPinMap($(p + 'map'), start, show);
    show(pin.get());
    $(p + 'paste').oninput = e => {
      const c = parseLatLng(e.target.value);
      if (c) pin.set(c.lat, c.lng, 17);
    };
    return pin;
  }

  // Map pin editor for an existing job (job page "Move pin").
  window.openPinEditor = async function ({ lat, lng, postcode, onSave }) {
    openShell('Site pin', 'Drag the pin, or click the map, to the exact spot. You can also paste a Google Maps link.', `
      ${pinBlock('pe_')}
      <div class="ent-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('entModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="pe_save">Save pin</button>
      </div>`);
    let start = (lat != null && lng != null) ? { lat, lng } : null;
    if (!start && postcode) start = await lookupPostcode(postcode);
    const pin = await wirePin('pe_', start);
    $('pe_save').onclick = async () => {
      const c = pin.get();
      if (!c) { showToast('Place the pin first', 'error'); return; }
      $('pe_save').disabled = true;
      try { await onSave(c); closeModal(); }
      catch (e) { showToast('Error: ' + e.message, 'error'); $('pe_save').disabled = false; }
    };
  };

  // ----------------------------------------------------------
  // Jobs
  // ----------------------------------------------------------

  const JOB_TYPES = [
    ['planning_stage1', 'Planning, Stage 1 (BS5837)'],
    ['planning_stage2', 'Planning, Stage 2 (AIA/AMS/TPP)'],
    ['subsidence', 'Building Damage / Subsidence'],
    ['health_safety', 'Tree Condition / Risk Survey'],
    ['insurer_mortgage', 'Insurer / Mortgage Lender'],
    ['nhbc', 'Foundation Depths (NHBC)'],
    ['site_visit', 'Site Visit & Advice'],
    ['resistograph', 'Resistograph Testing'],
    ['lscp', 'Landscaping Plans'],
    ['supervision', 'Site Supervision'],
    ['tpo', 'TPO Application'],
    ['amendment', 'Amendment'],
    ['other', 'Other'],
  ];

  const LEAD_SOURCES = ['Google', 'Instagram', 'AA website', 'Referral', 'Repeat customer', 'Other'];

  // Postcode to coordinates, from the free postcodes.io service. If it fails the
  // job is still saved; job-detail looks the coordinates up when the job is opened.
  async function lookupPostcode(pc) {
    try {
      const r = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc.toUpperCase().replace(/\s+/g, ' ')));
      const d = await r.json();
      if (d?.status === 200 && d.result) {
        return { lat: d.result.latitude, lng: d.result.longitude, city: d.result.admin_district || null };
      }
    } catch (e) { /* fall through */ }
    return null;
  }
  window.lookupPostcode = lookupPostcode;

  // Next TH number: one above the highest TH reference already used, so a typed
  // job never collides with the imported ones.
  function nextReference(refs) {
    let max = 0;
    refs.forEach(r => { const m = /^TH\s*(\d+)/i.exec(r || ''); if (m) max = Math.max(max, Number(m[1])); });
    return max ? `TH ${max + 1}` : '';
  }

  window.openNewJobModal = async function (opts = {}) {
    const o = openShell('New job', '', `<div class="loading" style="padding:30px"><div class="spinner"></div><br>Loading...</div>`);

    let contacts = [], refs = [], tiers = [];
    try {
      [contacts, refs, tiers] = await Promise.all([
        loadIntroducers(),
        dbGet('jobs', { select: 'reference', order: 'created_at.desc', limit: 2000 }),
        loadSurchargeTiers(),
      ]);
    } catch (e) {
      closeModal();
      showToast('Could not load: ' + e.message, 'error');
      return;
    }
    const usedRefs = new Set((refs || []).map(j => (j.reference || '').toLowerCase()).filter(Boolean));

    // State
    let source = 'introducer';           // 'introducer' | 'direct'
    let firm = null;                     // chosen introducer contact
    let people = [];                     // people under the firm
    let directClient = contacts.find(c => c.id === opts.clientId) || null;   // existing customer for a direct job
    if (opts.clientId && directClient) {
      if (directClient.client_type === 'agent') { firm = directClient; directClient = null; }
      else source = 'direct';
    }
    let billTo = 'introducer';
    let pin = null;

    const typeOpts = JOB_TYPES.map(([k, l]) => `<option value="${k}">${escapeHtml(l)}</option>`).join('');
    const tierOpts = tiers.map(t => `<option value="${t.tier}" ${t.tier === '10days' ? 'selected' : ''}>${escapeHtml(t.label)}${t.surcharge ? ` (+£${t.surcharge})` : ''}</option>`).join('');

    o.querySelector('.ent-modal').innerHTML = `
      <div class="ent-title">New job</div>
      <div class="ent-sub">Fill it in the order the work comes in. Only the starred boxes are needed.</div>

      <div class="ent-section">1. Who sent the work?</div>
      <div class="ent-seg" role="group" aria-label="Who sent the work">
        <button type="button" id="nj_srcIntro">An introducer (Heritage, Plus Rooms, Trinity, an architect...)</button>
        <button type="button" id="nj_srcDirect">The client directly</button>
      </div>
      <div id="nj_introBox"></div>
      <div id="nj_directBox" hidden>
        <div class="ent-grid">
          <div class="form-group"><label>How did they find us?</label>
            <select class="form-control" id="nj_source"><option value="">Not known</option>${LEAD_SOURCES.map(s => `<option>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Already a customer?</label>
            <div id="nj_directPick"></div></div>
        </div>
      </div>

      <div class="ent-section">2. Site and end client</div>
      <div class="ent-grid">
        <div class="form-group"><label>Site postcode <span class="req">*</span></label>
          <input class="form-control" id="nj_pc" style="text-transform:uppercase" autocomplete="off"></div>
        <div class="form-group"><label>Site address</label>
          <input class="form-control" id="nj_street" autocomplete="off" placeholder="House number and street"></div>
        ${pinBlock('nj_')}
        <div class="form-group"><label>End client name</label>
          <input class="form-control" id="nj_endname" autocomplete="off" placeholder="Homeowner, policyholder..."></div>
        <div class="form-group"><label>End client phone(s)</label>
          <input class="form-control" id="nj_endphone" autocomplete="off" placeholder="Separate several with commas"></div>
        <div class="form-group full"><label>End client email(s)</label>
          <input class="form-control" id="nj_endemail" autocomplete="off" placeholder="Separate several with commas"></div>
      </div>

      <div class="ent-section">3. The job</div>
      <div class="ent-grid">
        <div class="form-group"><label>Survey type <span class="req">*</span></label>
          <select class="form-control" id="nj_type"><option value="">Select...</option>${typeOpts}</select></div>
        <div class="form-group"><label>Reference</label>
          <input class="form-control" id="nj_ref" value="${escapeHtml(nextReference([...usedRefs].map(r => r.toUpperCase())))}" autocomplete="off">
          <div class="ent-hint">Next free TH number. Change it to use your own.</div></div>
        <div class="form-group"><label>Deadline <span class="req">*</span></label>
          <select class="form-control" id="nj_deadline">${tierOpts}</select></div>
        <div class="form-group"><label>Instruction date</label>
          <input class="form-control" id="nj_instructed" type="date" value="${new Date().toLocaleDateString('en-CA')}"></div>
        <div class="form-group"><label>Survey date</label>
          <input class="form-control" id="nj_date" type="date"></div>
        <div class="form-group"><label>Start as</label>
          <select class="form-control" id="nj_dispatch">
            <option value="red">On the map (Unallocated)</option>
            <option value="plans">On the map, awaiting plans</option>
          </select></div>
      </div>

      <div class="ent-section">4. Price and who to bill</div>
      <div class="ent-grid">
        <div class="form-group"><label>Fee (£, excl VAT)</label>
          <input class="form-control" id="nj_base" type="number" min="0" step="0.01" inputmode="decimal">
          <div class="ent-hint" id="nj_feehint"></div></div>
        <div class="form-group"><label>Urgency fee (£)</label>
          <input class="form-control" id="nj_urg" type="number" min="0" step="0.01" inputmode="decimal">
          <div class="ent-hint">From your Settings for the deadline chosen. You can change it.</div></div>
        <div class="form-group full"><div class="ent-chosen" style="background:#eef6f1;"><span>Total agreed fee</span><b id="nj_total">£0</b></div></div>
        <div class="form-group full"><label>Bill to</label>
          <div class="ent-seg" role="group" aria-label="Bill to" style="margin-bottom:0;">
            <button type="button" id="nj_billIntro">The introducer</button>
            <button type="button" id="nj_billEnd">The end client</button>
          </div></div>
        <div class="form-group full"><label>Notes</label>
          <textarea class="form-control" id="nj_notes" rows="3" placeholder="Internal notes (access, parking, who to ring...)"></textarea></div>
      </div>
      <div class="ent-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('entModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nj_save">Create job</button>
      </div>`;

    // ---- price ----
    const tierBy = Object.fromEntries(tiers.map(t => [t.tier, t]));
    function setUrgencyFromDeadline() { $('nj_urg').value = tierBy[val('nj_deadline')]?.surcharge ?? 0; total(); }
    function total() {
      const t = (Number(val('nj_base')) || 0) + (Number(val('nj_urg')) || 0);
      $('nj_total').textContent = '£' + t.toLocaleString('en-GB', { maximumFractionDigits: 2 });
    }
    $('nj_deadline').onchange = setUrgencyFromDeadline;
    $('nj_base').oninput = total;
    $('nj_urg').oninput = total;
    setUrgencyFromDeadline();

    // ---- bill to ----
    function setBill(b) {
      billTo = b;
      $('nj_billIntro').classList.toggle('on', b === 'introducer');
      $('nj_billEnd').classList.toggle('on', b === 'end_client');
    }
    $('nj_billIntro').onclick = () => { if (source === 'direct') { showToast('A direct job has no introducer to bill', 'error'); return; } setBill('introducer'); };
    $('nj_billEnd').onclick = () => setBill('end_client');

    // ---- introducer picker ----
    function pickerHtml(id, placeholder) {
      return `<input class="form-control" id="${id}" placeholder="${placeholder}" autocomplete="off"><div class="ent-results" id="${id}_r" hidden></div>`;
    }
    function wirePicker(id, list, onPick, onAdd, addLabel) {
      const inp = $(id), res = $(id + '_r');
      inp.oninput = () => {
        const q = inp.value.trim().toLowerCase();
        if (q.length < 2) { res.hidden = true; return; }
        const hits = list.filter(c => [c.full_name, c.company_name, c.email, c.phone]
          .some(v => (v || '').toLowerCase().includes(q))).slice(0, 8);
        res.innerHTML = hits.map(c => `<div data-id="${c.id}">${escapeHtml(introducerLabel(c))}${c.client_type === 'agent' ? ' <small style="display:inline">· introducer</small>' : ''}<small>${escapeHtml([c.email, c.phone].filter(Boolean).join(' · '))}</small></div>`).join('')
          + `<div data-add="1" style="color:var(--green-dark);font-weight:600;">+ ${addLabel} "${escapeHtml(inp.value.trim())}"</div>`;
        res.hidden = false;
        res.querySelectorAll('[data-id]').forEach(d => { d.onclick = () => onPick(list.find(c => c.id === d.dataset.id)); });
        res.querySelector('[data-add]').onclick = () => onAdd(inp.value.trim());
      };
    }

    async function loadPeople() {
      people = [];
      if (!firm) return;
      try { people = await dbGet('clients', { select: 'id,full_name,email,phone', parent_client_id: `eq.${firm.id}`, is_archived: 'not.is.true', order: 'full_name.asc' }) || []; }
      catch (e) { people = []; }
    }

    async function renderIntro() {
      const box = $('nj_introBox');
      if (firm) {
        await loadPeople();
        box.innerHTML = `
          <div class="ent-chosen"><span><b>${escapeHtml(introducerLabel(firm))}</b>
            ${firm.default_fee ? `<span class="muted"> · usual fee £${Number(firm.default_fee).toLocaleString()}</span>` : ''}</span>
            <button type="button" id="nj_firmChange">Change</button></div>
          <div class="ent-grid" style="margin-top:12px;">
            <div class="form-group"><label>Who asked?</label>
              <select class="form-control" id="nj_person">
                <option value="">Not recorded</option>
                ${people.map(p => `<option value="${p.id}">${escapeHtml(p.full_name || p.email)}</option>`).join('')}
                <option value="__new">+ Add a person at ${escapeHtml(firm.company_name || firm.full_name || 'this firm')}...</option>
              </select></div>
            <div></div>
            <div class="full" id="nj_personNew" hidden>
              <div class="ent-grid">
                <div class="form-group"><label>Name</label><input class="form-control" id="nj_p_name" autocomplete="off"></div>
                <div class="form-group"><label>Email</label><input class="form-control" id="nj_p_email" autocomplete="off"></div>
                <div class="form-group"><label>Phone</label><input class="form-control" id="nj_p_phone" type="tel" autocomplete="off"></div>
              </div></div>
          </div>`;
        $('nj_firmChange').onclick = () => { firm = null; renderIntro(); };
        $('nj_person').onchange = () => { $('nj_personNew').hidden = val('nj_person') !== '__new'; };
        // The firm's usual fee and billing fill in, if set.
        if (firm.default_fee != null && !val('nj_base')) { $('nj_base').value = firm.default_fee; total(); }
        $('nj_feehint').textContent = firm.default_fee != null ? `${introducerLabel(firm)}'s usual fee.` : '';
        setBill(firm.default_bill_to === 'end_client' ? 'end_client' : 'introducer');
        return;
      }
      box.innerHTML = pickerHtml('nj_firmQ', 'Type the firm, e.g. Heritage Trees, Plus Rooms, Trinity Claims') +
        `<div id="nj_newFirm" hidden></div>`;
      wirePicker('nj_firmQ', contacts, c => { firm = c; renderIntro(); }, name => showNewFirm(name), 'Add new introducer');
      $('nj_feehint').textContent = '';
    }

    function showNewFirm(name) {
      $('nj_firmQ_r').hidden = true;
      const b = $('nj_newFirm');
      b.hidden = false;
      b.innerHTML = `
        <div class="ent-warn" style="background:#f7faf8;border-color:var(--border);margin-top:10px;">
          <div class="ent-grid">
            <div class="form-group"><label>Firm / company</label><input class="form-control" id="nj_f_company" value="${escapeHtml(name)}"></div>
            <div class="form-group"><label>Main email(s)</label><input class="form-control" id="nj_f_email" autocomplete="off"></div>
            <div class="form-group"><label>Phone</label><input class="form-control" id="nj_f_phone" type="tel" autocomplete="off"></div>
            <div class="form-group"><label>Usual fee (£, if fixed)</label><input class="form-control" id="nj_f_fee" type="number" min="0" step="0.01"></div>
            <div class="form-group full"><label>Usually bill</label>
              <select class="form-control" id="nj_f_bill"><option value="introducer">The firm</option><option value="end_client">Their client</option></select></div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="nj_f_add">Add introducer</button>
        </div>`;
      $('nj_f_add').onclick = async () => {
        const c = { type: 'agent', company_name: val('nj_f_company'), email: val('nj_f_email'), phone: val('nj_f_phone'),
          default_fee: val('nj_f_fee'), default_bill_to: val('nj_f_bill') };
        const problem = checkCustomer(c);
        if (problem) { showToast(problem, 'error'); return; }
        try {
          const r = await createClientRecord(c);
          const fresh = await dbGet('clients', { select: 'id,client_type,full_name,company_name,email,phone,default_fee,default_bill_to', id: `eq.${r.id}` });
          firm = fresh?.[0] || { id: r.id, company_name: c.company_name };
          if (!contacts.some(x => x.id === firm.id)) contacts.unshift(firm);
          if (r.existing) showToast(`${introducerLabel(firm)} was already on the system, so that one is used`);
          renderIntro();
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
      };
    }

    function renderDirectPick() {
      const box = $('nj_directPick');
      if (directClient) {
        box.innerHTML = `<div class="ent-chosen"><span><b>${escapeHtml(introducerLabel(directClient))}</b></span><button type="button" id="nj_dcChange">Change</button></div>`;
        $('nj_dcChange').onclick = () => { directClient = null; renderDirectPick(); };
        if (!val('nj_endname')) $('nj_endname').value = directClient.full_name || directClient.company_name || '';
        if (!val('nj_endemail')) $('nj_endemail').value = directClient.email || '';
        if (!val('nj_endphone')) $('nj_endphone').value = directClient.phone || '';
        return;
      }
      box.innerHTML = pickerHtml('nj_dcQ', 'Search, or leave blank for someone new');
      wirePicker('nj_dcQ', contacts, c => { directClient = c; renderDirectPick(); },
        name => { $('nj_dcQ_r').hidden = true; $('nj_endname').value = name; $('nj_endname').focus(); }, 'New client');
    }

    function setSource(s) {
      source = s;
      $('nj_srcIntro').classList.toggle('on', s === 'introducer');
      $('nj_srcDirect').classList.toggle('on', s === 'direct');
      $('nj_introBox').hidden = s !== 'introducer';
      $('nj_directBox').hidden = s !== 'direct';
      if (s === 'direct') { setBill('end_client'); renderDirectPick(); $('nj_feehint').textContent = ''; }
      else renderIntro();
    }
    setBill(billTo);
    $('nj_srcIntro').onclick = () => setSource('introducer');
    $('nj_srcDirect').onclick = () => setSource('direct');
    setSource(source);

    // ---- pin ----
    pin = await wirePin('nj_', null);
    let pcTimer = null;
    $('nj_pc').oninput = () => {
      clearTimeout(pcTimer);
      pcTimer = setTimeout(async () => {
        const pc = val('nj_pc');
        if (pc.replace(/\s/g, '').length < 5) return;
        const g = await lookupPostcode(pc);
        if (g && !$('nj_paste').value) pin.set(g.lat, g.lng, 16);
      }, 500);
    };

    // ---- save ----
    $('nj_save').onclick = async () => {
      const btn = $('nj_save');
      const survey_type = val('nj_type'), pc = val('nj_pc'), deadline = val('nj_deadline');
      const reference = val('nj_ref');
      if (source === 'introducer' && !firm) { showToast('Pick the introducer, or choose "The client directly"', 'error'); return; }
      if (!pc) { showToast('Enter the site postcode', 'error'); return; }
      if (!survey_type) { showToast('Choose a survey type', 'error'); return; }
      if (reference && usedRefs.has(reference.toLowerCase())) { showToast(`${reference} is already used by another job`, 'error'); return; }
      const bad = badEmail(val('nj_endemail'));
      if (bad) { showToast(`"${bad}" does not look like an email address`, 'error'); return; }
      if (source === 'direct' && !directClient && !val('nj_endname') && !val('nj_endemail')) {
        showToast('Enter the client\'s name or email', 'error'); return;
      }
      let newPerson = null;
      if (source === 'introducer' && val('nj_person') === '__new') {
        newPerson = { type: 'individual', full_name: val('nj_p_name'), email: val('nj_p_email'), phone: val('nj_p_phone'), parent_client_id: firm.id };
        const p = checkCustomer(newPerson);
        if (p) { showToast('Person who asked: ' + p, 'error'); return; }
      }
      btn.disabled = true;
      try {
        let personId = source === 'introducer' ? (val('nj_person') || null) : null;
        if (newPerson) personId = (await createClientRecord(newPerson)).id;
        const person = personId ? (people.find(p => p.id === personId) || { full_name: newPerson?.full_name, email: newPerson?.email }) : null;

        // The customer record: the firm, or (direct) the client themselves.
        let customerId = null, reusedNote = '';
        if (source === 'introducer') customerId = firm.id;
        else if (directClient) customerId = directClient.id;
        else {
          const r = await createClientRecord({ type: 'individual', full_name: val('nj_endname'), email: val('nj_endemail'), phone: val('nj_endphone') });
          customerId = r.id;
          if (r.existing) reusedNote = ` (matched the existing customer ${clientName(r.client)})`;
        }

        const geoPin = pin.get();
        const geo = await lookupPostcode(pc);
        const city = geo?.city || null;
        const startAs = val('nj_dispatch') || 'red';
        const urgency_state = urgencyFromTier(deadline);
        const days = (URGENCY_TIERS[urgency_state] || {}).days || tierBy[deadline]?.days;
        const base = val('nj_base'), urg = Number(val('nj_urg')) || 0;
        const billingName = billTo === 'introducer'
          ? (person?.full_name ? `${person.full_name} (${firm.company_name || firm.full_name || ''})`.replace(' ()', '') : introducerLabel(firm))
          : (val('nj_endname') || directClient?.full_name || null);
        const billingEmail = billTo === 'introducer'
          ? (person?.email || firm.email || null)
          : (val('nj_endemail') || directClient?.email || null);
        const payload = {
          reference: reference || null,
          survey_type,
          job_type: 'new',
          site_postcode: pc.toUpperCase(),
          site_street: val('nj_street') || null,
          site_city: city,
          site_lat: geoPin ? geoPin.lat : (geo?.lat ?? null),
          site_lng: geoPin ? geoPin.lng : (geo?.lng ?? null),
          dispatch_state: 'red',
          urgency_state,
          deadline_tier: deadline,
          plans_outstanding: startAs === 'plans',
          // The SLA clock starts as soon as the job is on the map, plans or not (Trevor, 16 Nov).
          sla_deadline: !days ? null : addWorkingDays(new Date(), days),
          urgency_surcharge: urg,
          quoted_amount: base === '' ? null : Number(base),
          agreed_amount: base === '' ? null : Number(base) + urg,
          billing_mode: 'single',
          arranging_client_id: customerId,
          introducer_client_id: source === 'introducer' ? firm.id : null,
          introducer_contact_id: personId,
          bill_to: billTo,
          lead_source: source === 'direct' ? (val('nj_source') || null) : null,
          end_client_name: val('nj_endname') || null,
          end_client_phone: val('nj_endphone') || null,
          end_client_email: splitEmails(val('nj_endemail')).join(', ') || null,
          billing_contact_name: billingName,
          billing_contact_email: billingEmail,
          survey_date: val('nj_date') || null,
          internal_notes: val('nj_notes') || null,
        };
        const instructed = val('nj_instructed');
        if (instructed && instructed !== new Date().toLocaleDateString('en-CA')) {
          payload.created_at = new Date(instructed + 'T09:00:00').toISOString();
        }
        const inserted = await dbInsert('jobs', payload);
        const job = inserted?.[0];
        if (!job?.id) throw new Error('The job was not saved');
        if (reference && job.reference && job.reference !== reference) {
          showToast(`Job created, but the system numbered it ${job.reference}, not ${reference}`, 'error');
        } else {
          showToast(`Job ${job.reference || ''} created${reusedNote}`);
        }
        closeModal();
        setTimeout(() => { window.location.href = `job-detail.html?id=${job.id}`; }, 700);
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
        btn.disabled = false;
      }
    };
  };

  // Deadline options + urgency fees from Settings (deadline_surcharges), so the
  // CRM charges what the public quote form charges. Falls back to the old
  // fixed amounts if the table can't be read.
  async function loadSurchargeTiers() {
    const DAYS = { '1day': 1, '3days': 3, '5days': 5, '7days': 7, '10days': 10, '15days': 15 };
    try {
      const rows = await dbGet('deadline_surcharges', { select: 'tier,label,surcharge,is_available', order: 'surcharge.desc' });
      const list = (rows || []).filter(r => r.is_available !== false && r.tier !== '1day')
        .map(r => ({ tier: r.tier, label: r.label || getDeadlineLabel(r.tier), surcharge: Number(r.surcharge) || 0, days: DAYS[r.tier] }));
      if (list.length) return list;
    } catch (e) { /* fall through */ }
    return [
      { tier: '3days', label: 'Within 3 working days', surcharge: 200, days: 3 },
      { tier: '5days', label: 'Within 5 working days', surcharge: 150, days: 5 },
      { tier: '10days', label: 'Within 10 working days', surcharge: 75, days: 10 },
      { tier: '15days', label: 'Within 15 working days or more', surcharge: 0, days: 15 },
    ];
  }
  window.loadSurchargeTiers = loadSurchargeTiers;
  window.createClientRecord = createClientRecord;
  window.clientByEmail = clientByEmail;
})();
