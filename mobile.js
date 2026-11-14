(function () {
  'use strict';

  const KEYS = {
    EXPENSES: 'finland_expenses_v2',
    SUBSCRIPTIONS: 'finland_subscriptions_v2',
    BUDGET: 'finland_budget_data_v1',
    NOTES: 'finland_notes_v1',
    NOTE_LABELS: 'finland_note_labels_v1',
    CALENDAR_PLAN: 'finland_calendar_plan_v1',
    DISPLAY_CURRENCY: 'finland_display_currency_v1',
    RATES_CACHE: 'finland_rates_cache_v1',
    APP_PREFS: 'finland_app_prefs_v1'
  };

  const CURRENCIES = ['EUR', 'USD', 'ILS'];
  const CURRENCY_SYMBOLS = { EUR: '€', USD: '$', ILS: '₪' };

  const state = {
    activeTab: 'followups',
    followupSubTab: 'projects',
    displayCurrency: 'EUR',
    rates: { EUR: 1, USD: 1.08, ILS: 3.95 },
    appPrefs: {},
    expenses: [],
    subscriptions: [],
    budget: { projects: [], leads: [] },
    notes: [],
    noteLabels: [],
    calendarPlan: { items: [], sources: {} },
    restoreEpoch: '',
    calMonth: new Date(),
    selectedDate: toYMD(new Date()),
    moneyMonth: toYM(new Date()),
    notesSearch: '',
    notesLabelFilter: 'ALL',
    authToken: localStorage.getItem('finland_mobile_token') || '',
    txType: 'expense',
    calKind: 'plan'
  };

  // ---------- Utilities ----------
  function toYMD(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function toYM(d) {
    return toYMD(d).slice(0, 7);
  }

  function parseJSON(raw, fallback) {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null) continue;
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, String(v));
      }
    }
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      arr.forEach(c => {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function formatMoney(amount, currency) {
    const cur = currency || state.displayCurrency || 'EUR';
    const symbol = CURRENCY_SYMBOLS[cur] || '$';
    const num = Number(amount) || 0;
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const hasCents = (Math.round(abs * 100) % 100) !== 0;
    const digits = hasCents ? 2 : 0;
    const locale = state.appPrefs && state.appPrefs.numberFormatLocale === 'european' ? 'de-DE' : 'en-US';
    const str = abs.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return isNeg ? `-${symbol}${str}` : `${symbol}${str}`;
  }

  function convertCurrency(amount, fromCur, toCur) {
    const val = Number(amount) || 0;
    if (!fromCur || fromCur === toCur) return val;
    const rates = state.rates || { EUR: 1, USD: 1.08, ILS: 3.95 };
    const fromRate = Number(rates[fromCur]) || 1;
    const toRate = Number(rates[toCur]) || 1;
    return (val / fromRate) * toRate;
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  function setSyncStatus(status, label) {
    const dot = document.getElementById('syncDot');
    const lbl = document.getElementById('syncLabel');
    dot.className = 'sync-dot' + (status === 'syncing' ? ' syncing' : status === 'error' ? ' error' : '');
    lbl.textContent = label;
  }

  // ---------- Dialog Helpers & Safari closedby Fallback ----------
  function setupDialogFallbacks() {
    document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        const outside = (e) => {
          const r = dialog.getBoundingClientRect();
          return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        };
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
        dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e)) dialog.close(); });
      }
      dialog.addEventListener('close', () => { dialog.returnValue = ''; });
    });

    document.querySelectorAll('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-dialog');
        const dlg = document.getElementById(id);
        if (dlg && dlg.open) dlg.close();
      });
    });
  }

  function openDialog(id) {
    const dlg = document.getElementById(id);
    if (dlg && !dlg.open) dlg.showModal();
  }

  function closeDialog(id) {
    const dlg = document.getElementById(id);
    if (dlg && dlg.open) dlg.close();
  }

  // ---------- Vault Auth & Sync ----------
  function apiHeaders(extra) {
    const h = Object.assign({}, extra || {});
    if (state.authToken) h['Authorization'] = `Bearer ${state.authToken}`;
    return h;
  }

  async function ensureAuth() {
    try {
      const res = await fetch('/api/auth/status', { headers: apiHeaders() });
      const data = await res.json();
      if (data && data.authenticated) return true;
    } catch {
      return false;
    }

    // Try localhost auto-token first
    try {
      const localRes = await fetch('/api/auth/local-token');
      if (localRes.ok) {
        const ld = await localRes.json();
        if (ld && ld.token) {
          state.authToken = ld.token;
          localStorage.setItem('finland_mobile_token', ld.token);
          return true;
        }
      }
    } catch { /* ignore */ }

    openDialog('pinDialog');
    return false;
  }

  function loadFromLocalStorage() {
    state.displayCurrency = localStorage.getItem(KEYS.DISPLAY_CURRENCY) || 'EUR';
    if (!CURRENCIES.includes(state.displayCurrency)) state.displayCurrency = 'EUR';
    state.rates = parseJSON(localStorage.getItem(KEYS.RATES_CACHE), { EUR: 1, USD: 1.08, ILS: 3.95 });
    state.appPrefs = parseJSON(localStorage.getItem(KEYS.APP_PREFS), {});
    state.expenses = parseJSON(localStorage.getItem(KEYS.EXPENSES), []);
    state.subscriptions = parseJSON(localStorage.getItem(KEYS.SUBSCRIPTIONS), []);
    state.budget = parseJSON(localStorage.getItem(KEYS.BUDGET), { projects: [], leads: [] });
    if (!Array.isArray(state.budget.projects)) state.budget.projects = [];
    if (!Array.isArray(state.budget.leads)) state.budget.leads = [];
    state.notes = parseJSON(localStorage.getItem(KEYS.NOTES), []);
    state.noteLabels = parseJSON(localStorage.getItem(KEYS.NOTE_LABELS), []);
    state.calendarPlan = parseJSON(localStorage.getItem(KEYS.CALENDAR_PLAN), { items: [], sources: {} });
    if (!Array.isArray(state.calendarPlan.items)) state.calendarPlan.items = [];
    document.getElementById('currencyBtn').textContent = state.displayCurrency;
  }

  function applyVaultPayload(remote) {
    if (!remote || typeof remote !== 'object') return;
    if (remote._restore_epoch) state.restoreEpoch = String(remote._restore_epoch);
    Object.values(KEYS).forEach(k => {
      if (remote[k] !== undefined && remote[k] !== null) {
        const str = typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]);
        localStorage.setItem(k, str);
      }
    });
    loadFromLocalStorage();
    renderAll();
  }

  async function pullVault(silent) {
    if (!silent) setSyncStatus('syncing', 'Syncing...');
    try {
      const res = await fetch('/api/vault', { headers: apiHeaders(), cache: 'no-store' });
      if (res.status === 401) {
        setSyncStatus('error', 'Locked');
        openDialog('pinDialog');
        return false;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      applyVaultPayload(data);
      setSyncStatus('ok', 'Synced');
      return true;
    } catch {
      setSyncStatus('error', 'Offline');
      return false;
    }
  }

  async function saveAndPushKey(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    setSyncStatus('syncing', 'Saving...');
    try {
      const payload = { [key]: serialized };
      if (state.restoreEpoch) payload._restore_epoch = state.restoreEpoch;
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (res.status === 401) {
        setSyncStatus('error', 'Locked');
        openDialog('pinDialog');
        return;
      }
      const out = await res.json().catch(() => ({}));
      if (out && out.status === 'ignored_stale_epoch') {
        await pullVault(true);
        return;
      }
      setSyncStatus('ok', 'Synced');
    } catch {
      setSyncStatus('error', 'Offline');
    }
  }

  // ---------- Domain Helpers (Matching Desktop App) ----------
  function isProjectDone(p) {
    if (!p) return false;
    if (p.isDone === true || p.status === 'completed' || p.status === 'done') return true;
    if (p.isDone === false) return false;
    if (p.status === 'paid') {
      if (Array.isArray(p.steps) && p.steps.length > 0) return p.steps.every(s => s.completed);
      return true;
    }
    return false;
  }

  function isProjectWorkDone(p) {
    return !!p && (isProjectDone(p) || p.isWorkDone === true);
  }

  function normalizeServiceName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function isSubscriptionPaidInMonth(sub, ym) {
    if (!sub) return false;
    if (sub.manualPaidMonths && typeof sub.manualPaidMonths === 'object') {
      if (sub.manualPaidMonths[ym] === true) return true;
      if (sub.manualPaidMonths[ym] === false) return false;
    }
    const normSub = normalizeServiceName(sub.name);
    return state.expenses.some(e => {
      if (!e.date || !e.date.startsWith(ym)) return false;
      if (e.subscriptionId === sub.id || e.generatedFromSubId === sub.id) return true;
      const normExp = normalizeServiceName(e.title || '');
      if (normSub && normExp && normExp === normSub) return true;
      return e.title && sub.name && e.title.trim().toLowerCase() === sub.name.trim().toLowerCase();
    });
  }

  function getNoteColor(note) {
    const lbl = String(note.label || '').trim().toLowerCase();
    const found = (state.noteLabels || []).find(l => l && String(l.name || '').trim().toLowerCase() === lbl);
    if (found && found.color) return found.color;
    if (note.color) return note.color;
    return '#f59e0b';
  }

  // Collect ALL calendar items for a given YYYY-MM-DD (100% parity with desktop)
  function collectCalendarEntriesForDate(ymd) {
    const entries = [];
    const parts = ymd.split('-');
    const mNum = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    const ym = ymd.slice(0, 7);

    // 1. Custom Plan, Meetings & GCal items
    (state.calendarPlan.items || []).forEach(item => {
      if (!item || item.date !== ymd) return;
      const isMeeting = item.source === 'meetings' || item.subType === 'meetings' || item.kind === 'meeting' || (item.source === 'gcal' && (item.subType === 'meetings' || !item.subType));
      entries.push({
        id: item.id,
        kind: 'custom_item',
        raw: item,
        title: item.title || 'Untitled',
        time: item.time || '',
        badge: isMeeting ? 'Meeting' : 'Plan',
        color: item.customColor || (isMeeting ? '#0ea5e9' : '#16a34a'),
        completed: !!item.completed,
        toggleable: true
      });
    });

    // 2. Project Deadlines, Payment Due Dates & Stepstones
    (state.budget.projects || []).forEach(proj => {
      if (!proj || isProjectDone(proj)) return;
      const name = proj.title || proj.name || proj.client || 'Project';
      const projDate = proj.dueDate || proj.expectedDate || '';
      const workDone = isProjectWorkDone(proj);
      const totalAmt = parseFloat(proj.amount !== undefined ? proj.amount : proj.fee) || 0;
      const paidAmt = parseFloat(proj.paidAmount) || 0;
      const isPaidInFull = proj.status === 'paid' || (paidAmt >= totalAmt && totalAmt > 0);
      const payDue = proj.paymentDueDate || (proj.proformaInvoice && proj.proformaInvoice.validUntil) || '';

      if (projDate === ymd) {
        entries.push({
          id: `proj_deadline_${proj.id}`,
          kind: 'project',
          projectId: proj.id,
          title: `Deadline: ${name}`,
          time: 'Deadline',
          badge: 'Work Deadline',
          color: '#0284c7',
          completed: workDone,
          toggleable: false
        });
      }
      if (payDue === ymd && !isPaidInFull) {
        entries.push({
          id: `proj_pay_${proj.id}`,
          kind: 'project',
          projectId: proj.id,
          title: `Payment Due: ${name}`,
          time: 'Payment Due',
          badge: 'Payment Due',
          color: '#0284c7',
          completed: false,
          toggleable: false
        });
      }
      if (Array.isArray(proj.steps)) {
        proj.steps.forEach((step, idx) => {
          if (!step) return;
          const sd = step.dueDate || step.plannedDate || '';
          if (sd === ymd) {
            entries.push({
              id: `proj_step_${proj.id}_${idx}`,
              kind: 'project_step',
              projectId: proj.id,
              stepIdx: idx,
              title: step.title || step.text || 'Project Step',
              time: name,
              badge: 'Project Step',
              color: '#0284c7',
              completed: !!(step.completed || step.done),
              toggleable: true
            });
          }
        });
      }
    });

    // 3. Lead Follow-Ups & Lead Stepstones
    (state.budget.leads || []).forEach(lead => {
      if (!lead || lead.status === 'archived' || lead.status === 'lost') return;
      const leadDate = lead.targetDate || lead.followUpDate || lead.dueDate || lead.expectedDate || '';
      const leadTitle = lead.title || lead.name || lead.client || 'Inquiry';

      if (leadDate === ymd) {
        entries.push({
          id: `lead_${lead.id}`,
          kind: 'lead',
          leadId: lead.id,
          title: `Lead: ${leadTitle}`,
          time: lead.client || '',
          badge: 'Lead Follow-Up',
          color: '#d97706',
          completed: lead.status === 'won',
          toggleable: false
        });
      }
      if (Array.isArray(lead.steps)) {
        lead.steps.forEach((step, idx) => {
          if (!step) return;
          const sd = step.dueDate || step.plannedDate || '';
          if (sd === ymd) {
            entries.push({
              id: `lead_step_${lead.id}_${idx}`,
              kind: 'lead_step',
              leadId: lead.id,
              stepIdx: idx,
              title: step.title || step.text || 'Lead Step',
              time: leadTitle,
              badge: 'Lead Step',
              color: '#d97706',
              completed: !!(step.completed || step.done),
              toggleable: true
            });
          }
        });
      }
    });

    // 4. Notes with Due Dates
    (state.notes || []).forEach(note => {
      if (!note || note.dueDate !== ymd) return;
      entries.push({
        id: `note_${note.id}`,
        kind: 'note',
        noteId: note.id,
        title: note.title || 'Untitled Note',
        time: note.label || 'Note',
        badge: note.label || 'Note',
        color: getNoteColor(note),
        completed: !!(note.isDone || note.completed),
        toggleable: true
      });
    });

    // 5. Monthly & Yearly Bills / Subscriptions
    (state.subscriptions || []).forEach(sub => {
      if (!sub || sub.isFrozen) return;
      const nameLower = (sub.name || '').toLowerCase();
      if (nameLower.includes('proforma') || nameLower.includes('price offering') || nameLower.includes('tax receipt') || nameLower.includes('deposit / upfront') || nameLower.includes('project deliverables')) {
        return;
      }
      const bDay = sub.billingDay ? parseInt(sub.billingDay, 10) : (sub.lastBilledDate ? parseInt(sub.lastBilledDate.split('-')[2], 10) : null);
      if (bDay === dNum) {
        if (sub.billingCycle === 'yearly' && sub.lastBilledDate) {
          const subMonth = parseInt(sub.lastBilledDate.split('-')[1], 10) - 1;
          if (subMonth !== mNum) return;
        }
        const paid = isSubscriptionPaidInMonth(sub, ym);
        entries.push({
          id: `bill_${sub.id}_${ymd}`,
          kind: 'bill',
          title: `${sub.name} (${formatMoney(sub.amount, sub.currency)})`,
          time: paid ? 'Paid' : 'Due',
          badge: 'Monthly Bill',
          color: '#9333ea',
          completed: paid,
          toggleable: false
        });
      }
    });

    return entries;
  }

  // ---------- Rendering: Follow-Ups ----------
  function renderFollowUps() {
    const projects = state.budget.projects || [];
    const leads = (state.budget.leads || []).filter(l => l && l.status !== 'archived' && l.status !== 'lost');

    document.getElementById('projectsCount').textContent = String(projects.filter(p => !isProjectDone(p)).length);
    document.getElementById('leadsCount').textContent = String(leads.length);

    const listEl = document.getElementById('followupsList');
    const nodes = [];

    if (state.followupSubTab === 'projects') {
      const sorted = [...projects].sort((a, b) => Number(isProjectDone(a)) - Number(isProjectDone(b)));
      if (sorted.length === 0) {
        listEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'No projects yet.' }));
        return;
      }
      sorted.forEach(p => {
        const done = isProjectDone(p);
        const steps = Array.isArray(p.steps) ? p.steps : [];
        const doneSteps = steps.filter(s => s && (s.completed || s.done)).length;
        const due = p.dueDate || p.expectedDate || '';
        const fee = p.amount !== undefined ? p.amount : p.fee;

        nodes.push(el('button', {
          type: 'button',
          className: 'card',
          onClick: () => openProjectDetail(p.id)
        }, [
          el('div', { className: 'card-top' }, [
            el('h3', { className: 'card-title', textContent: p.title || p.name || p.client || 'Untitled Project' }),
            el('span', { className: `badge ${done ? 'green' : 'blue'}`, textContent: done ? 'Done' : (p.status || 'Active') })
          ]),
          p.client ? el('p', { className: 'card-sub', textContent: p.client }) : null,
          el('div', { className: 'card-meta' }, [
            due ? el('span', { className: 'mono', textContent: `Due ${due}` }) : null,
            steps.length ? el('span', { textContent: `${doneSteps}/${steps.length} steps` }) : null,
            fee ? el('span', { className: 'mono', textContent: formatMoney(fee, p.currency || state.displayCurrency) }) : null
          ])
        ]));
      });
    } else {
      if (leads.length === 0) {
        listEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'No active leads.' }));
        return;
      }
      leads.forEach(l => {
        const steps = Array.isArray(l.steps) ? l.steps : [];
        const doneSteps = steps.filter(s => s && (s.completed || s.done)).length;
        const due = l.targetDate || l.followUpDate || l.dueDate || '';

        nodes.push(el('button', {
          type: 'button',
          className: 'card',
          onClick: () => openLeadDetail(l.id)
        }, [
          el('div', { className: 'card-top' }, [
            el('h3', { className: 'card-title', textContent: l.title || l.name || l.client || 'Untitled Lead' }),
            el('span', { className: 'badge amber', textContent: l.status || 'Lead' })
          ]),
          l.client ? el('p', { className: 'card-sub', textContent: l.client }) : null,
          el('div', { className: 'card-meta' }, [
            due ? el('span', { className: 'mono', textContent: `Follow-up ${due}` }) : null,
            steps.length ? el('span', { textContent: `${doneSteps}/${steps.length} steps` }) : null
          ])
        ]));
      });
    }

    listEl.replaceChildren(...nodes);
  }

  function openProjectDetail(projectId) {
    const p = (state.budget.projects || []).find(x => x && x.id === projectId);
    if (!p) return;
    document.getElementById('detailBadge').textContent = 'Project';
    document.getElementById('detailDialogTitle').textContent = p.title || p.name || p.client || 'Project';

    const body = document.getElementById('detailBody');
    const done = isProjectDone(p);
    const fee = p.amount !== undefined ? p.amount : p.fee;
    const steps = Array.isArray(p.steps) ? p.steps : [];

    const metaBox = el('div', { className: 'detail-meta-box' }, [
      p.client ? el('span', { textContent: `Client: ${p.client}` }) : null,
      (p.dueDate || p.expectedDate) ? el('span', { className: 'mono', textContent: `Due: ${p.dueDate || p.expectedDate}` }) : null,
      fee ? el('span', { className: 'mono', textContent: `Fee: ${formatMoney(fee, p.currency || state.displayCurrency)}` }) : null
    ]);

    const stepNodes = steps.map((s, idx) => {
      const sDone = !!(s.completed || s.done);
      return el('button', {
        type: 'button',
        className: `step-row${sDone ? ' done' : ''}`,
        onClick: async () => {
          s.completed = !sDone;
          s.done = s.completed;
          await saveAndPushKey(KEYS.BUDGET, state.budget);
          openProjectDetail(projectId);
          renderAll();
        }
      }, [
        el('span', { className: `check-circle${sDone ? ' checked' : ''}`, textContent: sDone ? '✓' : '' }),
        el('span', { className: 'step-title', textContent: s.title || s.text || `Step ${idx + 1}` }),
        (s.dueDate || s.plannedDate) ? el('span', { className: 'step-date mono', textContent: s.dueDate || s.plannedDate }) : null
      ]);
    });

    const toggleDoneBtn = el('button', {
      type: 'button',
      className: done ? 'btn-secondary' : 'btn-primary',
      textContent: done ? 'Reopen Project' : 'Mark Project Done',
      onClick: async () => {
        p.isDone = !done;
        p.status = p.isDone ? 'completed' : 'active';
        await saveAndPushKey(KEYS.BUDGET, state.budget);
        closeDialog('detailDialog');
        renderAll();
        showToast(p.isDone ? 'Project marked done' : 'Project reopened');
      }
    });

    body.replaceChildren(
      metaBox,
      steps.length ? el('div', { className: 'card-stack' }, stepNodes) : el('p', { className: 'card-sub', textContent: 'No checklist steps yet.' }),
      toggleDoneBtn
    );
    openDialog('detailDialog');
  }

  function openLeadDetail(leadId) {
    const l = (state.budget.leads || []).find(x => x && x.id === leadId);
    if (!l) return;
    document.getElementById('detailBadge').textContent = 'Lead';
    document.getElementById('detailDialogTitle').textContent = l.title || l.name || l.client || 'Lead';

    const body = document.getElementById('detailBody');
    const steps = Array.isArray(l.steps) ? l.steps : [];
    const due = l.targetDate || l.followUpDate || l.dueDate || '';

    const metaBox = el('div', { className: 'detail-meta-box' }, [
      l.client ? el('span', { textContent: `Client: ${l.client}` }) : null,
      due ? el('span', { className: 'mono', textContent: `Follow-up: ${due}` }) : null,
      el('span', { textContent: `Status: ${l.status || 'new'}` })
    ]);

    const stepNodes = steps.map((s, idx) => {
      const sDone = !!(s.completed || s.done);
      return el('button', {
        type: 'button',
        className: `step-row${sDone ? ' done' : ''}`,
        onClick: async () => {
          s.completed = !sDone;
          s.done = s.completed;
          await saveAndPushKey(KEYS.BUDGET, state.budget);
          openLeadDetail(leadId);
          renderAll();
        }
      }, [
        el('span', { className: `check-circle${sDone ? ' checked' : ''}`, textContent: sDone ? '✓' : '' }),
        el('span', { className: 'step-title', textContent: s.title || s.text || `Step ${idx + 1}` }),
        (s.dueDate || s.plannedDate) ? el('span', { className: 'step-date mono', textContent: s.dueDate || s.plannedDate }) : null
      ]);
    });

    body.replaceChildren(
      metaBox,
      steps.length ? el('div', { className: 'card-stack' }, stepNodes) : el('p', { className: 'card-sub', textContent: 'No checklist steps yet.' })
    );
    openDialog('detailDialog');
  }

  // ---------- Rendering: Calendar ----------
  function renderCalendar() {
    const year = state.calMonth.getFullYear();
    const month = state.calMonth.getMonth();
    const todayYMD = toYMD(new Date());

    document.getElementById('calMonthLabel').textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const gridStart = new Date(year, month, 1 - startOffset);

    const dayNodes = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const ymd = toYMD(d);
      const isOther = d.getMonth() !== month;
      const isToday = ymd === todayYMD;
      const isSelected = ymd === state.selectedDate;

      const entries = collectCalendarEntriesForDate(ymd);
      const uniqueColors = [...new Set(entries.map(e => e.color))].slice(0, 3);

      const cls = ['cal-day'];
      if (isOther) cls.push('other-month');
      if (isToday && !isSelected) cls.push('today');
      if (isSelected) cls.push('selected');

      dayNodes.push(el('button', {
        type: 'button',
        className: cls.join(' '),
        onClick: () => {
          state.selectedDate = ymd;
          if (isOther) state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
          renderCalendar();
        }
      }, [
        el('span', { textContent: String(d.getDate()) }),
        el('span', { className: 'cal-dots' }, uniqueColors.map(c =>
          el('span', { className: 'cal-dot', style: `background:${isSelected ? '#ffffff' : c}` })
        ))
      ]));
    }
    document.getElementById('calGrid').replaceChildren(...dayNodes);

    // Render Agenda for selectedDate
    const selEntries = collectCalendarEntriesForDate(state.selectedDate);
    const selDateObj = new Date(state.selectedDate + 'T00:00:00');
    document.getElementById('agendaDateTitle').textContent = state.selectedDate === todayYMD
      ? 'Today'
      : selDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('agendaCount').textContent = `${selEntries.length} ${selEntries.length === 1 ? 'item' : 'items'}`;

    const agendaEl = document.getElementById('agendaList');
    if (selEntries.length === 0) {
      agendaEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'Nothing scheduled for this day.' }));
      return;
    }

    const itemNodes = selEntries.map(entry => {
      const checkBtn = el('button', {
        type: 'button',
        className: `check-circle${entry.completed ? ' checked' : ''}`,
        'aria-label': entry.toggleable ? 'Toggle complete' : entry.badge,
        textContent: entry.completed ? '✓' : '',
        onClick: (e) => {
          e.stopPropagation();
          if (entry.toggleable) toggleCalendarEntry(entry);
        }
      });
      if (!entry.toggleable) {
        checkBtn.style.borderColor = entry.color;
        if (!entry.completed) checkBtn.style.background = 'transparent';
      }

      const mainBtn = el('button', {
        type: 'button',
        className: 'agenda-item-main',
        onClick: () => openCalendarEntry(entry)
      }, [
        el('p', { className: 'agenda-item-title', textContent: entry.title }),
        el('div', { className: 'agenda-item-sub' }, [
          el('span', { className: 'source-dot', style: `background:${entry.color}` }),
          el('span', { textContent: entry.badge }),
          entry.time ? el('span', { className: 'mono', textContent: `· ${entry.time}` }) : null
        ])
      ]);

      return el('div', { className: `agenda-item${entry.completed ? ' done' : ''}` }, [checkBtn, mainBtn]);
    });

    agendaEl.replaceChildren(...itemNodes);
  }

  async function toggleCalendarEntry(entry) {
    if (entry.kind === 'custom_item') {
      const item = (state.calendarPlan.items || []).find(x => x && x.id === entry.id);
      if (item) {
        item.completed = !item.completed;
        await saveAndPushKey(KEYS.CALENDAR_PLAN, state.calendarPlan);
      }
    } else if (entry.kind === 'project_step') {
      const proj = (state.budget.projects || []).find(x => x && x.id === entry.projectId);
      if (proj && Array.isArray(proj.steps) && proj.steps[entry.stepIdx]) {
        const s = proj.steps[entry.stepIdx];
        s.completed = !(s.completed || s.done);
        s.done = s.completed;
        await saveAndPushKey(KEYS.BUDGET, state.budget);
      }
    } else if (entry.kind === 'lead_step') {
      const lead = (state.budget.leads || []).find(x => x && x.id === entry.leadId);
      if (lead && Array.isArray(lead.steps) && lead.steps[entry.stepIdx]) {
        const s = lead.steps[entry.stepIdx];
        s.completed = !(s.completed || s.done);
        s.done = s.completed;
        await saveAndPushKey(KEYS.BUDGET, state.budget);
      }
    } else if (entry.kind === 'note') {
      const note = (state.notes || []).find(x => x && x.id === entry.noteId);
      if (note) {
        note.isDone = !(note.isDone || note.completed);
        note.completed = note.isDone;
        await saveAndPushKey(KEYS.NOTES, state.notes);
      }
    }
    renderAll();
  }

  function openCalendarEntry(entry) {
    if (entry.kind === 'custom_item') openCalItemForm(entry.raw);
    else if (entry.kind === 'project' || entry.kind === 'project_step') openProjectDetail(entry.projectId);
    else if (entry.kind === 'lead' || entry.kind === 'lead_step') openLeadDetail(entry.leadId);
    else if (entry.kind === 'note') {
      const note = (state.notes || []).find(n => n && n.id === entry.noteId);
      if (note) openNoteForm(note);
    }
  }

  // ---------- Rendering: Notes ----------
  function renderNotes() {
    const notes = Array.isArray(state.notes) ? state.notes : [];
    const labels = new Set(['ALL']);
    notes.forEach(n => { if (n && n.label) labels.add(n.label); });

    const bar = document.getElementById('notesLabelsBar');
    bar.replaceChildren(...[...labels].map(lbl =>
      el('button', {
        type: 'button',
        className: `filter-chip${state.notesLabelFilter === lbl ? ' active' : ''}`,
        textContent: lbl === 'ALL' ? 'All' : lbl,
        onClick: () => {
          state.notesLabelFilter = lbl;
          renderNotes();
        }
      })
    ));

    const q = state.notesSearch.trim().toLowerCase();
    const filtered = notes.filter(n => {
      if (!n) return false;
      if (state.notesLabelFilter !== 'ALL' && (n.label || '') !== state.notesLabelFilter) return false;
      if (q) {
        const text = `${n.title || ''} ${n.body || ''} ${n.content || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    const listEl = document.getElementById('notesList');
    if (filtered.length === 0) {
      listEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'No notes match your filter.' }));
      return;
    }

    const pinned = filtered.filter(n => n.isPinned || n.pinned);
    const others = filtered.filter(n => !(n.isPinned || n.pinned));

    const buildNoteCard = (n) => {
      const bodyStr = n.body || (Array.isArray(n.bodyBlocks) ? n.bodyBlocks.filter(Boolean).join(' ') : '') || n.content || '';
      const preview = bodyStr.length > 110 ? bodyStr.slice(0, 110) + '...' : bodyStr;
      return el('button', {
        type: 'button',
        className: 'card',
        onClick: () => openNoteForm(n)
      }, [
        el('div', { className: 'card-top' }, [
          el('h3', { className: 'card-title', textContent: n.title || 'Untitled Note' }),
          n.label ? el('span', { className: 'badge', textContent: n.label }) : null
        ]),
        preview ? el('p', { className: 'card-sub', textContent: preview }) : null,
        n.dueDate ? el('div', { className: 'card-meta' }, [
          el('span', { className: 'mono', textContent: `Due ${n.dueDate}` })
        ]) : null
      ]);
    };

    const out = [];
    if (pinned.length) {
      out.push(el('div', { className: 'section-label', textContent: 'Pinned' }));
      pinned.forEach(n => out.push(buildNoteCard(n)));
    }
    if (others.length) {
      if (pinned.length) out.push(el('div', { className: 'section-label', textContent: 'Notes' }));
      others.forEach(n => out.push(buildNoteCard(n)));
    }
    listEl.replaceChildren(...out);
  }

  // ---------- Rendering: Money (Transactions) ----------
  function renderMoney() {
    const ym = state.moneyMonth;
    const [y, m] = ym.split('-').map(Number);
    document.getElementById('moneyMonthLabel').textContent = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const monthTx = (state.expenses || [])
      .filter(e => e && e.date && e.date.startsWith(ym))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let spent = 0;
    let income = 0;
    monthTx.forEach(t => {
      const conv = convertCurrency(t.amount, t.currency || 'EUR', state.displayCurrency);
      if (t.type === 'income') income += conv;
      else spent += conv;
    });

    document.getElementById('moneySpentVal').textContent = formatMoney(spent, state.displayCurrency);
    document.getElementById('moneyIncomeVal').textContent = formatMoney(income, state.displayCurrency);

    const listEl = document.getElementById('transactionsList');
    if (monthTx.length === 0) {
      listEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'No transactions this month.' }));
      return;
    }

    const nodes = monthTx.map(t => {
      const isInc = t.type === 'income';
      return el('button', {
        type: 'button',
        className: 'tx-row',
        onClick: () => openTxForm(t)
      }, [
        el('div', { className: 'tx-left' }, [
          el('p', { className: 'tx-title', textContent: t.title || 'Untitled' }),
          el('p', { className: 'tx-sub', textContent: `${t.category || 'General'} · ${t.date}` })
        ]),
        el('span', {
          className: `tx-amount mono${isInc ? ' income' : ''}`,
          textContent: `${isInc ? '+' : '-'}${formatMoney(t.amount, t.currency || 'EUR')}`
        })
      ]);
    });

    listEl.replaceChildren(...nodes);
  }

  // ---------- Forms: Transaction, Calendar Item, Note ----------
  function openTxForm(existing) {
    const isEdit = !!existing;
    document.getElementById('txDialogTitle').textContent = isEdit ? 'Edit Transaction' : 'New Transaction';
    document.getElementById('txIdInput').value = isEdit ? existing.id : '';
    state.txType = isEdit && existing.type === 'income' ? 'income' : 'expense';
    document.querySelectorAll('[data-tx-type]').forEach(b => b.classList.toggle('active', b.getAttribute('data-tx-type') === state.txType));
    document.getElementById('txAmountInput').value = isEdit ? existing.amount : '';
    document.getElementById('txCurrencyInput').value = isEdit ? (existing.currency || 'EUR') : state.displayCurrency;
    document.getElementById('txTitleInput').value = isEdit ? (existing.title || '') : '';
    document.getElementById('txCategoryInput').value = isEdit ? (existing.category || '') : '';
    document.getElementById('txDateInput').value = isEdit ? (existing.date || toYMD(new Date())) : toYMD(new Date());
    document.getElementById('txDeleteBtn').hidden = !isEdit;

    const cats = [...new Set((state.expenses || []).map(e => e && e.category).filter(Boolean))];
    document.getElementById('txCategoryDatalist').replaceChildren(...cats.map(c => el('option', { value: c })));
    openDialog('txDialog');
  }

  function openCalItemForm(existing) {
    const isEdit = !!existing;
    document.getElementById('calItemDialogTitle').textContent = isEdit ? 'Edit Calendar Item' : 'New Calendar Item';
    document.getElementById('calItemIdInput').value = isEdit ? existing.id : '';
    const isMtg = isEdit && (existing.source === 'meetings' || existing.subType === 'meetings' || existing.kind === 'meeting');
    state.calKind = isMtg ? 'meetings' : 'plan';
    document.querySelectorAll('[data-cal-kind]').forEach(b => b.classList.toggle('active', b.getAttribute('data-cal-kind') === state.calKind));
    document.getElementById('calItemTitleInput').value = isEdit ? (existing.title || '') : '';
    document.getElementById('calItemDateInput').value = isEdit ? (existing.date || state.selectedDate) : state.selectedDate;
    document.getElementById('calItemTimeInput').value = isEdit ? (existing.time || '') : '';
    document.getElementById('calItemDeleteBtn').hidden = !isEdit;
    openDialog('calItemDialog');
  }

  function openNoteForm(existing) {
    const isEdit = !!existing;
    document.getElementById('noteDialogTitle').textContent = isEdit ? 'Edit Note' : 'New Note';
    document.getElementById('noteIdInput').value = isEdit ? existing.id : '';
    document.getElementById('noteTitleInput').value = isEdit ? (existing.title || '') : '';
    const bodyStr = isEdit ? (existing.body || (Array.isArray(existing.bodyBlocks) ? existing.bodyBlocks.filter(Boolean).join('\n') : '') || existing.content || '') : '';
    document.getElementById('noteBodyInput').value = bodyStr;
    document.getElementById('noteLabelInput').value = isEdit ? (existing.label || '') : '';
    document.getElementById('noteDueDateInput').value = isEdit ? (existing.dueDate || '') : '';
    document.getElementById('notePinnedInput').checked = isEdit ? !!(existing.isPinned || existing.pinned) : false;
    document.getElementById('noteDeleteBtn').hidden = !isEdit;

    const lbls = [...new Set((state.notes || []).map(n => n && n.label).filter(Boolean))];
    document.getElementById('noteLabelDatalist').replaceChildren(...lbls.map(l => el('option', { value: l })));
    openDialog('noteDialog');
  }

  // ---------- Tab Navigation & Render ----------
  const TAB_META = {
    followups: { title: 'Follow-Ups', sub: 'Projects & Leads' },
    calendar: { title: 'Calendar', sub: 'Schedule & Milestones' },
    notes: { title: 'Notes', sub: 'Quick Notes & Tasks' },
    money: { title: 'Money', sub: 'Transactions' }
  };

  function setTab(tab) {
    state.activeTab = tab;
    const meta = TAB_META[tab] || TAB_META.followups;
    document.getElementById('headerTitle').textContent = meta.title;
    document.getElementById('headerSubtitle').textContent = meta.sub;

    document.querySelectorAll('.tab-view').forEach(sec => {
      sec.hidden = sec.id !== `view-${tab}`;
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    renderAll();
  }

  function renderAll() {
    if (state.activeTab === 'followups') renderFollowUps();
    else if (state.activeTab === 'calendar') renderCalendar();
    else if (state.activeTab === 'notes') renderNotes();
    else if (state.activeTab === 'money') renderMoney();
  }

  // ---------- Event Wiring ----------
  function bindEvents() {
    setupDialogFallbacks();

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab')));
    });

    document.querySelectorAll('[data-followup-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.followupSubTab = btn.getAttribute('data-followup-tab');
        document.querySelectorAll('[data-followup-tab]').forEach(b => {
          const act = b === btn;
          b.classList.toggle('active', act);
          b.setAttribute('aria-selected', String(act));
        });
        renderFollowUps();
      });
    });

    document.getElementById('currencyBtn').addEventListener('click', () => {
      const idx = (CURRENCIES.indexOf(state.displayCurrency) + 1) % CURRENCIES.length;
      state.displayCurrency = CURRENCIES[idx];
      document.getElementById('currencyBtn').textContent = state.displayCurrency;
      saveAndPushKey(KEYS.DISPLAY_CURRENCY, state.displayCurrency);
      renderAll();
    });

    document.getElementById('syncBtn').addEventListener('click', () => pullVault(false));

    // Calendar controls
    document.getElementById('calPrevBtn').addEventListener('click', () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      renderCalendar();
    });
    document.getElementById('calNextBtn').addEventListener('click', () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      renderCalendar();
    });
    document.getElementById('calTodayBtn').addEventListener('click', () => {
      const now = new Date();
      state.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      state.selectedDate = toYMD(now);
      renderCalendar();
    });

    // Notes search
    document.getElementById('notesSearchInput').addEventListener('input', (e) => {
      state.notesSearch = e.target.value;
      renderNotes();
    });

    // Money month controls
    document.getElementById('moneyPrevBtn').addEventListener('click', () => {
      const [y, m] = state.moneyMonth.split('-').map(Number);
      state.moneyMonth = toYM(new Date(y, m - 2, 1));
      renderMoney();
    });
    document.getElementById('moneyNextBtn').addEventListener('click', () => {
      const [y, m] = state.moneyMonth.split('-').map(Number);
      state.moneyMonth = toYM(new Date(y, m, 1));
      renderMoney();
    });

    // Quick Add (+)
    document.getElementById('quickAddBtn').addEventListener('click', () => openDialog('quickAddDialog'));
    document.querySelectorAll('[data-open-form]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-open-form');
        closeDialog('quickAddDialog');
        if (kind === 'transaction') openTxForm(null);
        else if (kind === 'calendar') openCalItemForm(null);
        else if (kind === 'note') openNoteForm(null);
      });
    });

    // Transaction Form
    document.querySelectorAll('[data-tx-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.txType = btn.getAttribute('data-tx-type');
        document.querySelectorAll('[data-tx-type]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('txForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('txIdInput').value;
      const amount = parseFloat(document.getElementById('txAmountInput').value);
      if (!amount || amount <= 0) return;

      const entry = {
        id: id || uid('exp'),
        type: state.txType,
        amount,
        currency: document.getElementById('txCurrencyInput').value,
        title: document.getElementById('txTitleInput').value.trim(),
        category: document.getElementById('txCategoryInput').value.trim() || 'General',
        date: document.getElementById('txDateInput').value,
        updatedAt: new Date().toISOString()
      };

      if (id) {
        const idx = state.expenses.findIndex(x => x && x.id === id);
        if (idx !== -1) state.expenses[idx] = Object.assign({}, state.expenses[idx], entry);
      } else {
        entry.createdAt = new Date().toISOString();
        state.expenses.unshift(entry);
      }

      closeDialog('txDialog');
      await saveAndPushKey(KEYS.EXPENSES, state.expenses);
      renderAll();
      showToast('Transaction saved');
    });

    document.getElementById('txDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('txIdInput').value;
      if (!id) return;
      state.expenses = state.expenses.filter(x => x && x.id !== id);
      closeDialog('txDialog');
      await saveAndPushKey(KEYS.EXPENSES, state.expenses);
      renderAll();
      showToast('Transaction deleted');
    });

    // Calendar Item Form
    document.querySelectorAll('[data-cal-kind]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.calKind = btn.getAttribute('data-cal-kind');
        document.querySelectorAll('[data-cal-kind]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('calItemForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('calItemIdInput').value;
      const isMtg = state.calKind === 'meetings';
      const item = {
        id: id || uid('cal'),
        title: document.getElementById('calItemTitleInput').value.trim(),
        date: document.getElementById('calItemDateInput').value,
        time: document.getElementById('calItemTimeInput').value.trim(),
        source: isMtg ? 'meetings' : 'my_plan',
        subType: isMtg ? 'meetings' : 'plan',
        kind: isMtg ? 'calendar' : 'plan',
        completed: false
      };

      if (id) {
        const idx = state.calendarPlan.items.findIndex(x => x && x.id === id);
        if (idx !== -1) state.calendarPlan.items[idx] = Object.assign({}, state.calendarPlan.items[idx], item);
      } else {
        state.calendarPlan.items.push(item);
      }

      state.selectedDate = item.date;
      closeDialog('calItemDialog');
      await saveAndPushKey(KEYS.CALENDAR_PLAN, state.calendarPlan);
      renderAll();
      showToast('Saved to calendar');
    });

    document.getElementById('calItemDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('calItemIdInput').value;
      if (!id) return;
      state.calendarPlan.items = state.calendarPlan.items.filter(x => x && x.id !== id);
      closeDialog('calItemDialog');
      await saveAndPushKey(KEYS.CALENDAR_PLAN, state.calendarPlan);
      renderAll();
      showToast('Calendar item deleted');
    });

    // Note Form
    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('noteIdInput').value;
      const bodyText = document.getElementById('noteBodyInput').value;
      const note = {
        id: id || uid('note'),
        title: document.getElementById('noteTitleInput').value.trim(),
        body: bodyText,
        content: bodyText,
        label: document.getElementById('noteLabelInput').value.trim() || 'General',
        dueDate: document.getElementById('noteDueDateInput').value || '',
        isPinned: document.getElementById('notePinnedInput').checked,
        pinned: document.getElementById('notePinnedInput').checked,
        updatedAt: new Date().toISOString()
      };

      if (id) {
        const idx = state.notes.findIndex(x => x && x.id === id);
        if (idx !== -1) state.notes[idx] = Object.assign({}, state.notes[idx], note);
      } else {
        note.createdAt = new Date().toISOString();
        state.notes.unshift(note);
      }

      closeDialog('noteDialog');
      await saveAndPushKey(KEYS.NOTES, state.notes);
      renderAll();
      showToast('Note saved');
    });

    document.getElementById('noteDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('noteIdInput').value;
      if (!id) return;
      state.notes = state.notes.filter(x => x && x.id !== id);
      closeDialog('noteDialog');
      await saveAndPushKey(KEYS.NOTES, state.notes);
      renderAll();
      showToast('Note deleted');
    });

    // PIN Form
    document.getElementById('pinForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = document.getElementById('pinInput').value.trim();
      const err = document.getElementById('pinError');
      err.hidden = true;
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, token: pin })
        });
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        if (data && data.token) {
          state.authToken = data.token;
          localStorage.setItem('finland_mobile_token', data.token);
        }
        closeDialog('pinDialog');
        await pullVault(false);
      } catch {
        err.hidden = false;
      }
    });

    // Gentle background sync on focus / visibility / interval
    window.addEventListener('focus', () => pullVault(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pullVault(true);
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') pullVault(true);
    }, 15000);
  }

  // ---------- Init ----------
  async function init() {
    loadFromLocalStorage();
    bindEvents();
    renderAll();
    const ok = await ensureAuth();
    if (ok) await pullVault(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
