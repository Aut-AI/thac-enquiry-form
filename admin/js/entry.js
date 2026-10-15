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
    o.addEventListener('mousedown', (e) => { if (e.target === o) closeModal(); });
    return o;
  }

  // ----------------------------------------------------------
  // Customers
  // ----------------------------------------------------------

  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Finds a customer by email (case-insensitive).
  async function clientByEmail(email) {
    if (!email) return null;
    const safe = email.replace(/[%*,()]/g, '');
    const rows = await dbGet('clients', { select: 'id,full_name,company_name,email', email: `ilike.${safe}`, limit: 1 });
    return rows?.[0] || null;
  }

  // Adds a customer unless one with the same email already exists.
  // Returns { id, existing } so callers can tell which happened.
  async function createClientRecord(c) {
    const dup = await clientByEmail(c.email);
    if (dup) return { id: dup.id, existing: true, client: dup };
    const user = getUser();
    const inserted = await dbInsert('clients', {
      client_type: c.type || 'individual',
      client_category: 'other',
      full_name: c.full_name || null,
      company_name: c.company_name || null,
      email: c.email || null,
      phone: c.phone || null,
      address_line_1: c.address_line_1 || null,
      address_line_2: c.address_line_2 || null,
      address_city: c.address_city || null,
      address_county: c.address_county || null,
      address_postcode: c.address_postcode ? c.address_postcode.toUpperCase() : null,
      notes: c.notes || null,
      created_by_user_id: user?.id || null,
    });
    const id = inserted?.[0]?.id;
    if (!id) throw new Error('The customer was not saved');
    return { id, existing: false, client: inserted[0] };
  }

  function customerFields(p) {
    return `
      <div class="ent-grid">
        <div class="form-group"><label>Type</label>
          <select class="form-control" id="${p}type">
            <option value="individual">Individual</option>
            <option value="company">Company</option>
            <option value="agent">Introducer / Agent</option>
            <option value="developer">Developer</option>
          </select></div>
        <div class="form-group"><label>Full name <span class="req">*</span></label>
          <input class="form-control" id="${p}name" autocomplete="off"></div>
        <div class="form-group"><label>Company</label>
          <input class="form-control" id="${p}company" autocomplete="off"></div>
        <div class="form-group"><label>Email</label>
          <input class="form-control" id="${p}email" type="email" autocomplete="off"></div>
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
    if (!c.full_name && !c.company_name) return 'Enter a name or a company';
    if (c.email && !validEmail(c.email)) return 'That email address does not look right';
    return null;
  }

  window.openNewCustomerModal = function (opts = {}) {
    openShell('New customer', 'Add a customer. They can be given jobs straight away, from the Jobs page or their own page.', `
      ${customerFields('nc_')}
      <div id="nc_msg"></div>
      <div class="ent-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('entModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nc_save">Add customer</button>
      </div>`);
    $('nc_name').focus();
    $('nc_save').onclick = async () => {
      const c = readCustomer('nc_');
      const problem = checkCustomer(c);
      if (problem) { showToast(problem, 'error'); return; }
      const btn = $('nc_save');
      btn.disabled = true;
      try {
        const r = await createClientRecord(c);
        if (r.existing) {
          $('nc_msg').innerHTML = `<div class="ent-warn">A customer with that email is already on the system:
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
  const SURCHARGE = { '3days': 200, '5days': 150, '10days': 75, '15days': 0 };

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

  // Next TH number: one above the highest TH reference already used, so a typed
  // job never collides with the imported ones.
  function nextReference(refs) {
    let max = 0;
    refs.forEach(r => { const m = /^TH\s*(\d+)/i.exec(r || ''); if (m) max = Math.max(max, Number(m[1])); });
    return max ? `TH ${max + 1}` : '';
  }

  window.openNewJobModal = async function (opts = {}) {
    const o = openShell('New job', 'Add a job to an existing customer, or add the customer and the job together.', `
      <div class="loading" style="padding:30px"><div class="spinner"></div><br>Loading...</div>`);

    let clients = [], introducers = [], refs = [];
    try {
      [clients, introducers, refs] = await Promise.all([
        dbGet('clients', { select: 'id,client_type,full_name,company_name,email,phone,address_postcode', order: 'created_at.desc', limit: 2000 }),
        loadIntroducers(),
        dbGet('jobs', { select: 'reference', order: 'created_at.desc', limit: 2000 }),
      ]);
    } catch (e) {
      closeModal();
      showToast('Could not load: ' + e.message, 'error');
      return;
    }
    clients = (clients || []).filter(c => c.client_type !== 'agent');
    const usedRefs = new Set((refs || []).map(j => (j.reference || '').toLowerCase()).filter(Boolean));
    let mode = 'existing';
    let chosen = clients.find(c => c.id === opts.clientId) || null;

    const typeOpts = JOB_TYPES.map(([k, l]) => `<option value="${k}">${escapeHtml(l)}</option>`).join('');
    const introOpts = introducers.map(i => `<option value="${i.id}">${escapeHtml(introducerLabel(i))}</option>`).join('');

    o.querySelector('.ent-modal').innerHTML = `
      <div class="ent-title">New job</div>
      <div class="ent-sub">Add a job to an existing customer, or add the customer and the job together.</div>

      <div class="ent-section">Customer</div>
      <div class="ent-seg" role="group" aria-label="Customer">
        <button type="button" id="nj_modeExisting">Existing customer</button>
        <button type="button" id="nj_modeNew">New customer</button>
      </div>
      <div id="nj_existing"></div>
      <div id="nj_new" hidden>${customerFields('nj_c_')}<div id="nj_msg"></div></div>

      <div class="ent-section">Job</div>
      <div class="ent-grid">
        <div class="form-group"><label>Reference</label>
          <input class="form-control" id="nj_ref" value="${escapeHtml(nextReference([...usedRefs].map(r => r.toUpperCase())))}" autocomplete="off">
          <div class="ent-hint">Next free TH number. Change it to use your own.</div></div>
        <div class="form-group"><label>Survey type <span class="req">*</span></label>
          <select class="form-control" id="nj_type"><option value="">Select...</option>${typeOpts}</select></div>
        <div class="form-group"><label>Site postcode <span class="req">*</span></label>
          <input class="form-control" id="nj_pc" style="text-transform:uppercase" autocomplete="off"></div>
        <div class="form-group"><label>Site address</label>
          <input class="form-control" id="nj_street" autocomplete="off" placeholder="Street and number"></div>
        <div class="form-group"><label>Deadline <span class="req">*</span></label>
          <select class="form-control" id="nj_deadline">
            <option value="10days">10 working days (Standard)</option>
            <option value="3days">3 working days (Urgent)</option>
            <option value="5days">5 working days (Elevated)</option>
            <option value="15days">15 working days or more (Low)</option>
          </select></div>
        <div class="form-group"><label>Survey date</label>
          <input class="form-control" id="nj_date" type="date"></div>
        <div class="form-group"><label>Agreed fee (£)</label>
          <input class="form-control" id="nj_amount" type="number" min="0" step="0.01" inputmode="decimal"></div>
        <div class="form-group"><label>Introducer</label>
          <select class="form-control" id="nj_intro"><option value="">Direct (no introducer)</option>${introOpts}</select></div>
        <div class="form-group"><label>Site contact / end client</label>
          <input class="form-control" id="nj_endname" autocomplete="off" placeholder="If different from the customer"></div>
        <div class="form-group"><label>Site contact email</label>
          <input class="form-control" id="nj_endemail" type="email" autocomplete="off"></div>
        <div class="form-group"><label>Start as</label>
          <select class="form-control" id="nj_dispatch">
            <option value="pending_approval">Pending approval</option>
            <option value="waiting_for_plans">Waiting for plans</option>
          </select></div>
        <div class="form-group full"><label>Notes</label>
          <textarea class="form-control" id="nj_notes" rows="3" placeholder="Internal notes"></textarea></div>
      </div>
      <div class="ent-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('entModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nj_save">Create job</button>
      </div>`;

    function renderExisting() {
      const box = $('nj_existing');
      if (chosen) {
        box.innerHTML = `<div class="ent-chosen"><span><b>${escapeHtml(clientName(chosen))}</b>
          <span class="muted"> ${escapeHtml([chosen.email, chosen.address_postcode].filter(Boolean).join(' · '))}</span></span>
          <button type="button" id="nj_change">Change</button></div>`;
        $('nj_change').onclick = () => { chosen = null; renderExisting(); };
        return;
      }
      box.innerHTML = `<input class="form-control" id="nj_search" placeholder="Search by name, company, email or phone" autocomplete="off">
        <div class="ent-results" id="nj_results" hidden></div>`;
      const inp = $('nj_search'), res = $('nj_results');
      inp.oninput = () => {
        const q = inp.value.trim().toLowerCase();
        if (q.length < 2) { res.hidden = true; return; }
        const hits = clients.filter(c => [c.full_name, c.company_name, c.email, c.phone, c.address_postcode]
          .some(v => (v || '').toLowerCase().includes(q))).slice(0, 8);
        res.innerHTML = hits.length
          ? hits.map(c => `<div data-id="${c.id}">${escapeHtml(clientName(c))}<small>${escapeHtml([c.email, c.phone, c.address_postcode].filter(Boolean).join(' · '))}</small></div>`).join('')
          : `<div style="cursor:default">No match. Use "New customer" above to add them.</div>`;
        res.hidden = false;
        res.querySelectorAll('[data-id]').forEach(d => {
          d.onclick = () => { chosen = clients.find(c => c.id === d.dataset.id); renderExisting(); };
        });
      };
      if (!opts.clientId) inp.focus();
    }

    function setMode(m) {
      mode = m;
      $('nj_modeExisting').classList.toggle('on', m === 'existing');
      $('nj_modeNew').classList.toggle('on', m === 'new');
      $('nj_existing').hidden = m !== 'existing';
      $('nj_new').hidden = m !== 'new';
      if (m === 'new') $('nj_c_name').focus();
    }
    $('nj_modeExisting').onclick = () => setMode('existing');
    $('nj_modeNew').onclick = () => setMode('new');
    renderExisting();
    setMode('existing');

    $('nj_save').onclick = async () => {
      const btn = $('nj_save');
      const survey_type = val('nj_type'), pc = val('nj_pc'), deadline = val('nj_deadline');
      const reference = val('nj_ref');
      let c = null;
      if (mode === 'new') {
        c = readCustomer('nj_c_');
        const problem = checkCustomer(c);
        if (problem) { showToast(problem, 'error'); return; }
      } else if (!chosen) { showToast('Choose a customer, or switch to New customer', 'error'); return; }
      if (!survey_type) { showToast('Choose a survey type', 'error'); return; }
      if (!pc) { showToast('Enter the site postcode', 'error'); return; }
      if (reference && usedRefs.has(reference.toLowerCase())) {
        showToast(`${reference} is already used by another job`, 'error'); return;
      }
      btn.disabled = true;
      try {
        let clientId = chosen?.id, reusedNote = '';
        if (mode === 'new') {
          const r = await createClientRecord(c);
          clientId = r.id;
          if (r.existing) reusedNote = ` (used the existing customer ${clientName(r.client)})`;
        }
        const geo = await lookupPostcode(pc);
        const dispatch_state = val('nj_dispatch') || 'pending_approval';
        const urgency_state = urgencyFromTier(deadline);
        const days = (URGENCY_TIERS[urgency_state] || {}).days;
        const amount = val('nj_amount');
        const payload = {
          reference: reference || null,
          survey_type,
          job_type: 'new',
          site_postcode: pc.toUpperCase(),
          site_street: val('nj_street') || null,
          site_city: geo?.city || null,
          site_lat: geo?.lat ?? null,
          site_lng: geo?.lng ?? null,
          dispatch_state,
          urgency_state,
          deadline_tier: deadline,
          // The SLA clock starts at once, unless the job is waiting for plans
          // (it starts when the job is activated, as for Stage 2).
          sla_deadline: dispatch_state === 'waiting_for_plans' || !days ? null : addWorkingDays(new Date(), days),
          urgency_surcharge: SURCHARGE[deadline] ?? 0,
          billing_mode: 'single',
          arranging_client_id: clientId,
          introducer_client_id: val('nj_intro') || null,
          end_client_name: val('nj_endname') || null,
          end_client_email: val('nj_endemail') || null,
          survey_date: val('nj_date') || null,
          agreed_amount: amount === '' ? null : Number(amount),
          internal_notes: val('nj_notes') || null,
        };
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
})();
