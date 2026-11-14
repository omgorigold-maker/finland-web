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

  // ---------- Vault Auth & Sync (Local Server + Cloud Vault) ----------
  const CLOUD_VAULT_API = 'https://api.github.com/repos/omgorigold-maker/finland-vault/contents/vault_data.json';
  const CLOUD_TOKEN_KEY = 'vault_cloud_gh_token';
  let cloudVaultSha = '';

  function extractCloudKeyFromUrl() {
    try {
      const url = new URL(window.location.href);
      let key = url.searchParams.get('cloud_key') || '';
      if (!key && window.location.hash && window.location.hash.includes('cloud_key=')) {
        const m = window.location.hash.match(/cloud_key=([^&]+)/);
        if (m) key = decodeURIComponent(m[1]);
      }
      key = key.trim();
      if (key) {
        localStorage.setItem(CLOUD_TOKEN_KEY, key);
        url.searchParams.delete('cloud_key');
        const cleanHash = (window.location.hash || '').replace(/([?#&]?)cloud_key=[^&]+&?/, '$1').replace(/[?&]$/, '');
        history.replaceState(null, '', url.pathname + url.search + (cleanHash === '#' ? '' : cleanHash));
        return key;
      }
    } catch { /* ignore */ }
    return localStorage.getItem(CLOUD_TOKEN_KEY) || '';
  }

  function isCloudMode() {
    const h = (window.location && window.location.hostname) || '';
    if (h.endsWith('github.io')) return true;
    return !!(extractCloudKeyFromUrl() && h !== 'localhost' && h !== '127.0.0.1');
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const clean = String(b64 || '').replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function cloudHeaders(extra) {
    const token = extractCloudKeyFromUrl();
    return Object.assign({
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, extra || {});
  }

  function apiHeaders(extra) {
    const h = Object.assign({}, extra || {});
    if (state.authToken) h['Authorization'] = `Bearer ${state.authToken}`;
    return h;
  }

  async function ensureAuth() {
    if (isCloudMode()) {
      const key = extractCloudKeyFromUrl();
      if (key) return true;
      openDialog('pinDialog');
      return false;
    }

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

  const MOBILE_CACHE_PREFIX = 'finland_mobile_cache_';
  function mCacheGet(k) {
    return localStorage.getItem(MOBILE_CACHE_PREFIX + k);
  }
  function mCacheSet(k, val) {
    localStorage.setItem(MOBILE_CACHE_PREFIX + k, val);
  }

  function loadFromLocalStorage() {
    state.displayCurrency = mCacheGet(KEYS.DISPLAY_CURRENCY) || 'EUR';
    if (!CURRENCIES.includes(state.displayCurrency)) state.displayCurrency = 'EUR';
    state.rates = parseJSON(mCacheGet(KEYS.RATES_CACHE), { EUR: 1, USD: 1.08, ILS: 3.95 });
    state.appPrefs = parseJSON(mCacheGet(KEYS.APP_PREFS), {});
    state.expenses = parseJSON(mCacheGet(KEYS.EXPENSES), []);
    state.subscriptions = parseJSON(mCacheGet(KEYS.SUBSCRIPTIONS), []);
    state.budget = parseJSON(mCacheGet(KEYS.BUDGET), { projects: [], leads: [] });
    if (!Array.isArray(state.budget.projects)) state.budget.projects = [];
    if (!Array.isArray(state.budget.leads)) state.budget.leads = [];
    state.notes = parseJSON(mCacheGet(KEYS.NOTES), []);
    state.noteLabels = parseJSON(mCacheGet(KEYS.NOTE_LABELS), []);
    state.calendarPlan = parseJSON(mCacheGet(KEYS.CALENDAR_PLAN), { items: [], sources: {} });
    if (!Array.isArray(state.calendarPlan.items)) state.calendarPlan.items = [];
    document.getElementById('currencyBtn').textContent = state.displayCurrency;
  }

  function applyVaultPayload(remote) {
    if (!remote || typeof remote !== 'object') return;
    if (remote._restore_epoch) state.restoreEpoch = String(remote._restore_epoch);
    Object.values(KEYS).forEach(k => {
      if (remote[k] !== undefined && remote[k] !== null) {
        const str = typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]);
        mCacheSet(k, str);
      }
    });
    loadFromLocalStorage();
    renderAll();
  }

  const PENDING_OPS_KEY = 'finland_mobile_pending_ops_v1';

  function getPendingOps() {
    return parseJSON(localStorage.getItem(PENDING_OPS_KEY), []);
  }

  function setPendingOps(ops) {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
  }

  function applyOpToValue(key, currentVal, op) {
    if (op.type === 'set_raw') return op.value;

    if (key === KEYS.EXPENSES || key === KEYS.NOTES) {
      const list = Array.isArray(currentVal) ? [...currentVal] : [];
      if (op.type === 'upsert_item') {
        const idx = list.findIndex(x => x && x.id === op.item.id);
        if (idx !== -1) list[idx] = Object.assign({}, list[idx], op.item);
        else list.unshift(op.item);
      } else if (op.type === 'delete_item') {
        return list.filter(x => x && x.id !== op.id);
      } else if (op.type === 'toggle_note_done') {
        const note = list.find(x => x && x.id === op.id);
        if (note) {
          note.isDone = !(note.isDone || note.completed);
          note.completed = note.isDone;
          note.updatedAt = new Date().toISOString();
        }
      }
      return list;
    }

    if (key === KEYS.NOTE_LABELS) {
      const list = Array.isArray(currentVal) ? [...currentVal] : [];
      if (op.type === 'upsert_label' && op.label && op.label.name) {
        const target = op.label.name.trim().toLowerCase();
        const idx = list.findIndex(l => l && String(l.name || '').trim().toLowerCase() === target);
        if (idx !== -1) list[idx] = Object.assign({}, list[idx], op.label);
        else list.push(op.label);
      }
      return list;
    }

    if (key === KEYS.CALENDAR_PLAN) {
      const cp = (currentVal && typeof currentVal === 'object') ? Object.assign({}, currentVal) : {};
      const items = Array.isArray(cp.items) ? [...cp.items] : [];
      if (op.type === 'upsert_cal_item') {
        const idx = items.findIndex(x => x && x.id === op.item.id);
        if (idx !== -1) items[idx] = Object.assign({}, items[idx], op.item);
        else items.push(op.item);
      } else if (op.type === 'toggle_cal_item') {
        const it = items.find(x => x && x.id === op.id);
        if (it) it.completed = !it.completed;
      } else if (op.type === 'delete_cal_item') {
        cp.items = items.filter(x => x && x.id !== op.id);
        return cp;
      }
      cp.items = items;
      return cp;
    }

    if (key === KEYS.BUDGET) {
      const b = (currentVal && typeof currentVal === 'object') ? Object.assign({}, currentVal) : {};
      if (op.type === 'toggle_project_step' && Array.isArray(b.projects)) {
        b.projects = b.projects.map(p => {
          if (!p || p.id !== op.projectId || !Array.isArray(p.steps)) return p;
          const steps = p.steps.map((s, i) => {
            if (i !== op.stepIdx || !s) return s;
            const next = !(s.completed || s.done);
            return Object.assign({}, s, { completed: next, done: next });
          });
          return Object.assign({}, p, { steps });
        });
      } else if (op.type === 'toggle_project_done' && Array.isArray(b.projects)) {
        b.projects = b.projects.map(p => {
          if (!p || p.id !== op.projectId) return p;
          const next = !isProjectDone(p);
          return Object.assign({}, p, { isDone: next, status: next ? 'completed' : 'active' });
        });
      } else if (op.type === 'toggle_lead_step' && Array.isArray(b.leads)) {
        b.leads = b.leads.map(l => {
          if (!l || l.id !== op.leadId || !Array.isArray(l.steps)) return l;
          const steps = l.steps.map((s, i) => {
            if (i !== op.stepIdx || !s) return s;
            const next = !(s.completed || s.done);
            return Object.assign({}, s, { completed: next, done: next });
          });
          return Object.assign({}, l, { steps });
        });
      }
      return b;
    }

    return currentVal;
  }

  function applyOpLocally(key, op) {
    const fallback = (key === KEYS.EXPENSES || key === KEYS.NOTES) ? [] : (key === KEYS.DISPLAY_CURRENCY ? 'EUR' : {});
    const cur = key === KEYS.DISPLAY_CURRENCY ? (mCacheGet(key) || 'EUR') : parseJSON(mCacheGet(key), fallback);
    const next = applyOpToValue(key, cur, op);
    const serialized = typeof next === 'string' ? next : JSON.stringify(next);
    mCacheSet(key, serialized);
    loadFromLocalStorage();
  }

  async function fetchRemoteVault() {
    if (isCloudMode()) {
      const token = extractCloudKeyFromUrl();
      if (!token) return { status: 401, data: null };
      const res = await fetch(`${CLOUD_VAULT_API}?_t=${Date.now()}`, { headers: cloudHeaders(), cache: 'no-store' });
      if (res.status === 401 || res.status === 403) return { status: 401, data: null };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const meta = await res.json();
      cloudVaultSha = (meta && meta.sha) || '';
      let rawText = '';
      if (meta && meta.content) {
        rawText = base64ToUtf8(meta.content);
      } else {
        const rawRes = await fetch(`${CLOUD_VAULT_API}?_t=${Date.now()}`, {
          headers: cloudHeaders({ 'Accept': 'application/vnd.github.v3.raw' }),
          cache: 'no-store'
        });
        if (!rawRes.ok) throw new Error('HTTP ' + rawRes.status);
        rawText = await rawRes.text();
      }
      return { status: 200, data: JSON.parse(rawText || '{}') };
    }

    const res = await fetch('/api/vault', { headers: apiHeaders(), cache: 'no-store' });
    if (res.status === 401) return { status: 401, data: null };
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return { status: 200, data: await res.json() };
  }

  async function postVaultKeys(payloadObj, mergedFullVault) {
    if (isCloudMode()) {
      const outVault = Object.assign({}, mergedFullVault || {});
      outVault._last_synced = new Date().toISOString();
      const bodyObj = {
        message: 'sync(mobile): update vault_data.json',
        content: utf8ToBase64(JSON.stringify(outVault, null, 2))
      };
      if (cloudVaultSha) bodyObj.sha = cloudVaultSha;
      const res = await fetch(CLOUD_VAULT_API, {
        method: 'PUT',
        headers: cloudHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(bodyObj)
      });
      if (res.status === 401 || res.status === 403) {
        setSyncStatus('error', 'Locked');
        openDialog('pinDialog');
        return { ok: false, locked: true };
      }
      if (res.status === 409 || res.status === 422) {
        return { ok: false, conflict: true };
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const putOut = await res.json().catch(() => ({}));
      if (putOut && putOut.content && putOut.content.sha) cloudVaultSha = putOut.content.sha;
      return { ok: true, out: putOut };
    }

    const payload = Object.assign({}, payloadObj);
    if (state.restoreEpoch) payload._restore_epoch = state.restoreEpoch;
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      setSyncStatus('error', 'Locked');
      openDialog('pinDialog');
      return { ok: false, locked: true };
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const out = await res.json().catch(() => ({}));
    return { ok: true, out };
  }

  async function flushPendingOpsOnRemote(remoteData) {
    const ops = getPendingOps();
    if (!ops.length) return remoteData;
    const updatedKeys = {};
    const mergedRemote = Object.assign({}, remoteData);

    ops.forEach(({ key, op }) => {
      const fallback = (key === KEYS.EXPENSES || key === KEYS.NOTES) ? [] : (key === KEYS.DISPLAY_CURRENCY ? 'EUR' : {});
      const curVal = key === KEYS.DISPLAY_CURRENCY
        ? (mergedRemote[key] || 'EUR')
        : parseJSON(mergedRemote[key], fallback);
      const nextVal = applyOpToValue(key, curVal, op);
      const serialized = typeof nextVal === 'string' ? nextVal : JSON.stringify(nextVal);
      mergedRemote[key] = serialized;
      updatedKeys[key] = serialized;
    });

    const res = await postVaultKeys(updatedKeys, mergedRemote);
    if (res.conflict) {
      // SHA conflict on Cloud Vault: re-pull latest and retry once
      const fresh = await fetchRemoteVault();
      if (fresh.status === 200 && fresh.data) {
        return flushPendingOpsOnRemote(fresh.data);
      }
    }
    if (res.ok && (!res.out || res.out.status !== 'ignored_stale_epoch')) {
      setPendingOps([]);
    }
    return mergedRemote;
  }

  let syncQueue = Promise.resolve();
  function runSerializedSync(fn) {
    const next = syncQueue.then(fn, fn);
    syncQueue = next.catch(() => {});
    return next;
  }

  async function pullVault(silent) {
    return runSerializedSync(async () => {
      if (!silent) setSyncStatus('syncing', 'Syncing...');
      try {
        const fetched = await fetchRemoteVault();
        if (fetched.status === 401) {
          setSyncStatus('error', 'Locked');
          openDialog('pinDialog');
          return false;
        }
        let data = fetched.data;
        if (data && data._restore_epoch) state.restoreEpoch = String(data._restore_epoch);
        if (getPendingOps().length > 0) {
          data = await flushPendingOpsOnRemote(data);
        }
        applyVaultPayload(data);
        setSyncStatus('ok', 'Synced');
        return true;
      } catch {
        setSyncStatus('error', 'Offline');
        return false;
      }
    });
  }

  async function smartMutateAndPush(key, op) {
    // 1. Update isolated mobile cache immediately + queue op once (no duplicate on retry)
    applyOpLocally(key, op);
    const queued = getPendingOps();
    queued.push({ key, op });
    setPendingOps(queued);

    return runSerializedSync(async () => {
      setSyncStatus('syncing', 'Saving...');
      try {
        const fetched = await fetchRemoteVault();
        if (fetched.status === 401) {
          setSyncStatus('error', 'Locked');
          openDialog('pinDialog');
          return;
        }
        const remote = fetched.data;
        if (remote && remote._restore_epoch) state.restoreEpoch = String(remote._restore_epoch);

        const mergedRemote = await flushPendingOpsOnRemote(remote);
        applyVaultPayload(mergedRemote);
        setSyncStatus('ok', 'Synced');
      } catch {
        setSyncStatus('error', 'Offline');
      }
    });
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
          await smartMutateAndPush(KEYS.BUDGET, { type: 'toggle_project_step', projectId, stepIdx: idx });
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
        await smartMutateAndPush(KEYS.BUDGET, { type: 'toggle_project_done', projectId });
        closeDialog('detailDialog');
        renderAll();
        showToast(!done ? 'Project marked done' : 'Project reopened');
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
          await smartMutateAndPush(KEYS.BUDGET, { type: 'toggle_lead_step', leadId, stepIdx: idx });
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
  function getMiniCalSourceConfig(srcKey) {
    const defaults = {
      my_plan: { showOnMiniCal: true, miniStyle: 'dashed', color: '#0d9488', miniCalScope: 'week' },
      meetings: { showOnMiniCal: true, miniStyle: 'side-pill', color: '#2563eb' },
      projects: { showOnMiniCal: true, miniStyle: 'bold-number', color: '#0284c7', paymentShowOnMiniCal: true, paymentMiniStyle: 'bottom-arc', paymentColor: '#0284c7', sharePaymentColor: true },
      leads: { showOnMiniCal: true, miniStyle: 'star', color: '#d97706' },
      bills: { showOnMiniCal: true, miniStyle: 'highlight', color: '#9333ea' }
    };
    const cfg = state.calendarPlan && state.calendarPlan.sources && state.calendarPlan.sources[srcKey];
    return Object.assign({}, defaults[srcKey] || {}, cfg || {});
  }

  function createMiniSvg(paths, viewBox, styleStr) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('style', styleStr);
    paths.forEach(([tag, attrs]) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
      svg.appendChild(node);
    });
    return svg;
  }

  function renderCalendar() {
    const year = state.calMonth.getFullYear();
    const month = state.calMonth.getMonth();
    const ymStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const todayYMD = toYMD(new Date());

    const prefs = state.appPrefs || {};
    const billingStyle = prefs.calendarBillingStyle || 'badge';
    const todayStyle = prefs.calendarTodayStyle || 'ring';
    const todayColor = prefs.calendarTodayColor || '#f97315';
    const headerIconColor = prefs.calendarHeaderIconColor || '#9333ea';
    const adjacentDays = prefs.calendarAdjacentDays || 'faded';
    const summaryMode = prefs.calendarSummaryMode || 'count';
    const weekStart = prefs.calendarWeekStart || 'sunday';
    const dotColor = prefs.calendarDotColor || '#9333ea';

    document.getElementById('calMonthLabel').textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const headerIcon = document.getElementById('calHeaderIcon');
    if (headerIcon) headerIcon.style.color = headerIconColor;

    const weekHeadersEl = document.getElementById('calWeekHeaders');
    if (weekHeadersEl) {
      const labels = weekStart === 'monday'
        ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      weekHeadersEl.replaceChildren(...labels.map(lbl => el('span', { textContent: lbl })));
    }

    // 1. Map active bills & notes by day (matching desktop mini-calendar)
    const billsByDay = {};
    let totalSubsThisMonth = 0;
    let totalSubsAmount = 0;
    (state.subscriptions || []).forEach(sub => {
      if (!sub || sub.isFrozen) return;
      const nameLower = (sub.name || '').toLowerCase();
      if (nameLower.includes('proforma') || nameLower.includes('price offering') || nameLower.includes('tax receipt') || nameLower.includes('deposit / upfront') || nameLower.includes('project deliverables')) return;
      const bDay = sub.billingDay ? parseInt(sub.billingDay, 10) : (sub.lastBilledDate ? parseInt(sub.lastBilledDate.split('-')[2], 10) : null);
      if (bDay && bDay >= 1 && bDay <= 31) {
        if (sub.billingCycle === 'yearly' && sub.lastBilledDate) {
          const subMonth = parseInt(sub.lastBilledDate.split('-')[1], 10) - 1;
          if (subMonth !== month) return;
        }
        if (!billsByDay[bDay]) billsByDay[bDay] = [];
        billsByDay[bDay].push(sub);
        totalSubsThisMonth++;
        totalSubsAmount += convertCurrency(sub.amount, sub.currency, state.displayCurrency);
      }
    });

    const notesByDay = {};
    (state.notes || []).forEach(note => {
      if (!note || note.isDone || note.completed || !note.dueDate) return;
      const parts = note.dueDate.split('-');
      if (parts.length === 3 && parseInt(parts[0], 10) === year && (parseInt(parts[1], 10) - 1) === month) {
        const dNum = parseInt(parts[2], 10);
        if (!notesByDay[dNum]) notesByDay[dNum] = [];
        notesByDay[dNum].push(note);
      }
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const firstDayOffset = weekStart === 'monday' ? (firstDayIndex + 6) % 7 : firstDayIndex;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const billsMiniCfg = getMiniCalSourceConfig('bills');
    const billMiniMode = billsMiniCfg.miniStyle || 'highlight';
    const activeBillColor = billsMiniCfg.color || dotColor || '#9333ea';

    const legendSq = document.getElementById('calLegendSquare');
    if (legendSq) {
      legendSq.style.backgroundColor = `${activeBillColor}18`;
      legendSq.style.borderColor = `${activeBillColor}38`;
    }
    const subCountEl = document.getElementById('calSubCount');
    if (subCountEl) {
      subCountEl.style.color = activeBillColor;
      if (summaryMode === 'hidden') subCountEl.textContent = '';
      else if (summaryMode === 'amount') subCountEl.textContent = formatMoney(totalSubsAmount, state.displayCurrency);
      else subCountEl.textContent = `${totalSubsThisMonth} bill${totalSubsThisMonth === 1 ? '' : 's'}`;
    }

    const myPlanCfg = getMiniCalSourceConfig('my_plan');
    const meetingsCfg = getMiniCalSourceConfig('meetings');
    const projCfg = getMiniCalSourceConfig('projects');
    const leadCfg = getMiniCalSourceConfig('leads');

    // Week boundary for my_plan miniCalScope === 'week'
    let weekStartYmd = '';
    let weekEndYmd = '';
    if (myPlanCfg.showOnMiniCal !== false && (myPlanCfg.miniCalScope || 'week') === 'week') {
      const now = new Date();
      const refD = (now.getFullYear() === year && now.getMonth() === month) ? now : new Date(year, month, 1);
      const dayOfWeek = weekStart === 'monday' ? (refD.getDay() + 6) % 7 : refD.getDay();
      const ws = new Date(refD.getFullYear(), refD.getMonth(), refD.getDate() - dayOfWeek);
      const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
      weekStartYmd = toYMD(ws);
      weekEndYmd = toYMD(we);
    }

    const dayNodes = [];

    // Leading days
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const prevDate = daysInPrevMonth - i;
      const prevD = new Date(year, month - 1, prevDate);
      const prevYmd = toYMD(prevD);
      const cls = ['cal-day-cell', 'other-month'];
      if (adjacentDays === 'hidden') cls.push('is-hidden');
      dayNodes.push(el('button', {
        type: 'button',
        className: cls.join(' '),
        onClick: () => {
          state.selectedDate = prevYmd;
          state.calMonth = new Date(prevD.getFullYear(), prevD.getMonth(), 1);
          renderCalendar();
        }
      }, el('span', { className: 'cal-day-num', textContent: String(prevDate) })));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const ymd = `${ymStr}-${String(day).padStart(2, '0')}`;
      const isToday = ymd === todayYMD;
      const isSelected = ymd === state.selectedDate;
      const hasBill = !!(billsByDay[day] && billsByDay[day].length > 0);
      const hasNote = !!(notesByDay[day] && notesByDay[day].length > 0);

      const classes = ['cal-day-cell'];
      const styles = [];
      let boldNumberColor = null;

      // Extra mini-cal items from calendarPlan.sources
      const extraDayItems = [];
      const dayEntries = collectCalendarEntriesForDate(ymd);
      dayEntries.forEach(e => {
        if (e.completed) return;
        if (e.kind === 'custom_item') {
          const isMtg = e.badge === 'Meeting';
          const cfg = isMtg ? meetingsCfg : myPlanCfg;
          if (cfg.showOnMiniCal !== false) {
            if (!isMtg && weekStartYmd && (ymd < weekStartYmd || ymd > weekEndYmd)) return;
            extraDayItems.push({ miniStyle: cfg.miniStyle || (isMtg ? 'side-pill' : 'dashed'), color: e.color || cfg.color });
          }
        } else if (e.kind === 'project') {
          const isPay = e.badge === 'Payment Due';
          const show = isPay ? (projCfg.paymentShowOnMiniCal !== false && projCfg.showOnMiniCal !== false) : (projCfg.showOnMiniCal !== false);
          if (show) {
            const payClr = projCfg.sharePaymentColor === false ? (projCfg.paymentColor || projCfg.color) : projCfg.color;
            extraDayItems.push({
              miniStyle: isPay ? (projCfg.paymentMiniStyle || 'bottom-arc') : (projCfg.miniStyle || 'bold-number'),
              color: isPay ? payClr : projCfg.color
            });
          }
        } else if (e.kind === 'project_step' && projCfg.showOnMiniCal !== false) {
          extraDayItems.push({ miniStyle: projCfg.miniStyle || 'bold-number', color: projCfg.color });
        } else if ((e.kind === 'lead' || e.kind === 'lead_step') && leadCfg.showOnMiniCal !== false) {
          extraDayItems.push({ miniStyle: leadCfg.miniStyle || 'star', color: leadCfg.color });
        }
      });

      const billUsesHighlight = hasBill && billsMiniCfg.showOnMiniCal !== false && (billMiniMode === 'highlight' || billMiniMode === 'badge');
      const allLayerItems = [...extraDayItems];

      if (hasBill && billsMiniCfg.showOnMiniCal !== false) {
        const isAllBillsPaid = billsByDay[day].every(sub => isSubscriptionPaidInMonth(sub, ymStr));
        if (billMiniMode === 'highlight' || billMiniMode === 'badge') {
          classes.push('has-bill', `billing-${billingStyle}`);
          if (isAllBillsPaid) {
            classes.push('is-paid');
          } else {
            boldNumberColor = activeBillColor;
            if (activeBillColor && activeBillColor.toLowerCase() !== '#9333ea') {
              classes.push('custom-color');
              styles.push(`--cal-dot-color:${activeBillColor}`, `--cal-dot-bg:${activeBillColor}18`, `--cal-dot-border:${activeBillColor}35`);
            }
          }
        } else if (billMiniMode === 'dot') {
          billsByDay[day].forEach(() => {
            allLayerItems.unshift({ miniStyle: 'dot', color: isAllBillsPaid ? '#94a3b8' : activeBillColor });
          });
        } else {
          allLayerItems.unshift({ miniStyle: billMiniMode, color: isAllBillsPaid ? '#94a3b8' : activeBillColor });
        }
      }

      // Dots (Notes + dot-styled items; 1-4 bottom row, 5-8 halo ring)
      const allDots = [];
      if (hasNote) notesByDay[day].forEach(n => allDots.push(getNoteColor(n)));
      allLayerItems.forEach(ext => {
        if ((ext.miniStyle || 'dot') === 'dot') allDots.push(ext.color || '#0284c7');
      });

      const children = [];
      const appliedLayers = new Set();
      let hasBgFillLayer = billUsesHighlight;
      let hasFrameLayer = billUsesHighlight;
      let hasTopRight = false;

      allLayerItems.forEach(ext => {
        const mStyle = ext.miniStyle || 'dot';
        const mColor = ext.color || '#0284c7';
        if (mStyle === 'dot' || appliedLayers.has(mStyle)) return;
        appliedLayers.add(mStyle);

        if (mStyle === 'highlight') {
          if (!hasBgFillLayer) {
            hasBgFillLayer = true;
            styles.push(`background-color:${mColor}18`);
            if (!hasFrameLayer && !isToday) {
              hasFrameLayer = true;
              styles.push(`border:1px solid ${mColor}38`);
            }
            if (!boldNumberColor) boldNumberColor = mColor;
          } else if (!hasFrameLayer && !isToday) {
            hasFrameLayer = true;
            children.push(el('span', { style: `position:absolute;inset:0;border-radius:9px;border:1.5px solid ${mColor}48;pointer-events:none;z-index:2` }));
          }
        } else if (mStyle === 'glass-tint') {
          if (!hasBgFillLayer) {
            hasBgFillLayer = true;
            styles.push(`background:linear-gradient(135deg,${mColor}2e 0%,${mColor}10 55%,rgba(255,255,255,0.92) 100%)`);
            if (!hasFrameLayer && !isToday) {
              hasFrameLayer = true;
              styles.push(`border:1px solid ${mColor}38`);
            }
            if (!boldNumberColor) boldNumberColor = mColor;
          }
        } else if (mStyle === 'bold-number' || mStyle === 'diamond') {
          boldNumberColor = mColor;
        } else if (mStyle === 'circle' || mStyle === 'gradient') {
          children.push(el('span', { style: `position:absolute;width:30px;height:30px;border-radius:9999px;background:radial-gradient(circle closest-side at 50% 50%,${mColor}55 0%,${mColor}3a 28%,${mColor}20 56%,${mColor}00 94%,transparent 100%);pointer-events:none;z-index:0` }));
        } else if (mStyle === 'double-ring') {
          children.push(el('span', { style: `position:absolute;width:28px;height:28px;border-radius:9999px;background:radial-gradient(circle closest-side at 50% 50%,transparent 0%,transparent 34%,${mColor}16 50%,${mColor}46 66%,${mColor}00 95%,transparent 100%);pointer-events:none;z-index:0` }));
        } else if ((mStyle === 'soft-frame' || mStyle === 'framed' || mStyle === 'framed-highlight') && !isToday) {
          if (!hasFrameLayer) {
            hasFrameLayer = true;
            styles.push(`border-color:${mColor}38`);
          } else {
            children.push(el('span', { style: `position:absolute;inset:1px;border-radius:7px;border:1px solid ${mColor}38;pointer-events:none;z-index:2` }));
          }
        } else if (mStyle === 'dashed' && !isToday) {
          if (!hasFrameLayer) {
            hasFrameLayer = true;
            styles.push(`border:1px dashed ${mColor}75`);
          }
        } else if (mStyle === 'underline' || mStyle === 'top-bar' || mStyle === 'brackets') {
          children.push(el('span', { style: 'position:absolute;inset:2px;pointer-events:none;z-index:2' }, [
            el('span', { style: `position:absolute;top:0;left:0;width:6px;height:6px;border-top:1.5px solid ${mColor};border-left:1.5px solid ${mColor};border-top-left-radius:3px` }),
            el('span', { style: `position:absolute;bottom:0;right:0;width:6px;height:6px;border-bottom:1.5px solid ${mColor};border-right:1.5px solid ${mColor};border-bottom-right-radius:3px` })
          ]));
        } else if (mStyle === 'star' || mStyle === 'triangle') {
          hasTopRight = true;
          children.push(createMiniSvg([
            ['path', { d: 'M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z', fill: mColor }]
          ], '0 0 512 512', 'position:absolute;top:2px;right:2px;width:7px;height:7px;display:block;pointer-events:none;z-index:2'));
        } else if (mStyle === 'bottom-arc' || mStyle === 'star-bg') {
          children.push(createMiniSvg([
            ['polygon', { points: '12,1.5 15.3,7.9 22.3,9 17.2,14.1 18.4,21.2 12,17.8 5.6,21.2 6.8,14.1 1.7,9 8.7,7.9', fill: mColor }]
          ], '0 0 24 24', 'position:absolute;top:48%;left:50%;transform:translate(-50%,-50%);width:105%;height:105%;pointer-events:none;z-index:0;opacity:0.55'));
        } else if (mStyle === 'side-pill' || mStyle === 'fold') {
          children.push(createMiniSvg([
            ['polygon', { points: '0,0 8,0 0,8', fill: mColor }]
          ], '0 0 8 8', 'position:absolute;top:0;left:0;width:9px;height:9px;display:block;pointer-events:none;z-index:2'));
        } else if (mStyle === 'corner-pip') {
          const pos = hasTopRight ? 'top:3px;left:3px;' : 'top:3px;right:3px;';
          hasTopRight = true;
          children.push(el('span', { style: `position:absolute;${pos}width:5px;height:5px;border-radius:9999px;background-color:${mColor};box-shadow:0 0 0 1px #ffffff;pointer-events:none;z-index:2` }));
        }
      });

      if (isToday) {
        classes.push('is-today', `today-${todayStyle}`);
        styles.push(`--cal-today-color:${todayColor}`);
      }
      if (isSelected) classes.push('is-selected');

      const numSpan = el('span', { className: 'cal-day-num', textContent: String(day) });
      if (boldNumberColor && !(isToday && todayStyle === 'solid')) {
        numSpan.style.color = boldNumberColor;
        numSpan.style.fontWeight = '700';
      }
      children.push(numSpan);

      const cappedDots = allDots.slice(0, 8);
      if (cappedDots.length > 0 && cappedDots.length <= 4) {
        children.push(el('div', { className: 'cal-note-dots' }, cappedDots.map(c =>
          el('span', { className: 'cal-note-dot', style: `background-color:${c}` })
        )));
      } else if (cappedDots.length > 4) {
        const bDots = [cappedDots[0], cappedDots[1]];
        const rem = cappedDots.slice(2, 8);
        const rDots = [rem[0], rem[3]].filter(Boolean);
        const lDots = [rem[1], rem[4]].filter(Boolean);
        const tDots = [rem[2], rem[5]].filter(Boolean);
        children.push(el('div', { className: 'cal-note-dots' }, bDots.map(c => el('span', { className: 'cal-note-dot', style: `background-color:${c}` }))));
        if (rDots.length) children.push(el('div', { className: 'cal-ring-right' }, rDots.map(c => el('span', { className: 'cal-note-dot', style: `background-color:${c}` }))));
        if (lDots.length) children.push(el('div', { className: 'cal-ring-left' }, lDots.map(c => el('span', { className: 'cal-note-dot', style: `background-color:${c}` }))));
        if (tDots.length) children.push(el('div', { className: 'cal-ring-top' }, tDots.map(c => el('span', { className: 'cal-note-dot', style: `background-color:${c}` }))));
      }

      dayNodes.push(el('button', {
        type: 'button',
        className: classes.join(' '),
        style: styles.join(';'),
        onClick: () => {
          state.selectedDate = ymd;
          renderCalendar();
        }
      }, children));
    }

    // Trailing days to complete 6 rows (42 cells) or last week
    const totalCells = dayNodes.length;
    const remainder = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      const nextD = new Date(year, month + 1, i);
      const nextYmd = toYMD(nextD);
      const cls = ['cal-day-cell', 'other-month'];
      if (adjacentDays === 'hidden') cls.push('is-hidden');
      dayNodes.push(el('button', {
        type: 'button',
        className: cls.join(' '),
        onClick: () => {
          state.selectedDate = nextYmd;
          state.calMonth = new Date(nextD.getFullYear(), nextD.getMonth(), 1);
          renderCalendar();
        }
      }, el('span', { className: 'cal-day-num', textContent: String(i) })));
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
      await smartMutateAndPush(KEYS.CALENDAR_PLAN, { type: 'toggle_cal_item', id: entry.id });
    } else if (entry.kind === 'project_step') {
      await smartMutateAndPush(KEYS.BUDGET, { type: 'toggle_project_step', projectId: entry.projectId, stepIdx: entry.stepIdx });
    } else if (entry.kind === 'lead_step') {
      await smartMutateAndPush(KEYS.BUDGET, { type: 'toggle_lead_step', leadId: entry.leadId, stepIdx: entry.stepIdx });
    } else if (entry.kind === 'note') {
      await smartMutateAndPush(KEYS.NOTES, { type: 'toggle_note_done', id: entry.noteId });
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
  const NOTE_SWATCHES = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#16a34a', '#64748b'];

  function getLabelColorByName(name) {
    return getNoteColor({ label: name });
  }

  function getAllKnownLabels() {
    const map = new Map();
    (state.noteLabels || []).forEach(l => {
      if (!l || !l.name) return;
      const clean = String(l.name).trim();
      if (clean) map.set(clean.toLowerCase(), { name: clean, color: l.color || getLabelColorByName(clean) });
    });
    (state.notes || []).forEach(n => {
      if (!n || !n.label) return;
      const clean = String(n.label).trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), { name: clean, color: n.color || getLabelColorByName(clean) });
      }
    });
    return [...map.values()];
  }

  function renderNotes() {
    const notes = Array.isArray(state.notes) ? state.notes : [];
    const knownLabels = getAllKnownLabels();
    const labelItems = [{ name: 'ALL', color: '' }, ...knownLabels];

    const bar = document.getElementById('notesLabelsBar');
    bar.replaceChildren(...labelItems.map(item =>
      el('button', {
        type: 'button',
        className: `filter-chip${state.notesLabelFilter === item.name ? ' active' : ''}`,
        onClick: () => {
          state.notesLabelFilter = item.name;
          renderNotes();
        }
      }, [
        item.name !== 'ALL' ? el('span', { className: 'label-dot', style: `background:${item.color}` }) : null,
        el('span', { textContent: item.name === 'ALL' ? 'All' : item.name })
      ])
    ));

    const q = state.notesSearch.trim().toLowerCase();
    const filtered = notes.filter(n => {
      if (!n) return false;
      if (state.notesLabelFilter !== 'ALL' && (n.label || '').toLowerCase() !== state.notesLabelFilter.toLowerCase()) return false;
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
      const nColor = getNoteColor(n);
      return el('button', {
        type: 'button',
        className: 'card note-card-colored',
        style: `border-left-color:${nColor}`,
        onClick: () => openNoteForm(n)
      }, [
        el('div', { className: 'card-top' }, [
          el('h3', { className: 'card-title', textContent: n.title || 'Untitled Note' }),
          n.label ? el('span', {
            className: 'badge',
            style: `background:${nColor}18;color:${nColor}`,
            textContent: n.label
          }) : null
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

    const known = getAllKnownLabels();
    document.getElementById('noteLabelDatalist').replaceChildren(...known.map(l => el('option', { value: l.name })));
    const picker = document.getElementById('noteLabelPicker');
    if (picker) {
      picker.replaceChildren(...known.map(l =>
        el('button', {
          type: 'button',
          className: `filter-chip${(document.getElementById('noteLabelInput').value || '').toLowerCase() === l.name.toLowerCase() ? ' active' : ''}`,
          onClick: () => {
            document.getElementById('noteLabelInput').value = l.name;
            picker.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            // Mark clicked chip active
            const idx = known.findIndex(k => k.name === l.name);
            if (picker.children[idx]) picker.children[idx].classList.add('active');
          }
        }, [
          el('span', { className: 'label-dot', style: `background:${l.color}` }),
          el('span', { textContent: l.name })
        ])
      ));
    }
    openDialog('noteDialog');
  }

  function renderNoteLabelsManager() {
    const listEl = document.getElementById('noteLabelsManagerList');
    if (!listEl) return;
    const known = getAllKnownLabels();
    if (!known.length) {
      listEl.replaceChildren(el('div', { className: 'empty-state', textContent: 'No categories yet. Add one below.' }));
      return;
    }
    const rows = known.map(lbl => {
      const swatches = NOTE_SWATCHES.map(hex =>
        el('button', {
          type: 'button',
          className: `swatch-btn${lbl.color.toLowerCase() === hex ? ' active' : ''}`,
          style: `background:${hex}`,
          'aria-label': `Set ${lbl.name} color`,
          onClick: async () => {
            await smartMutateAndPush(KEYS.NOTE_LABELS, { type: 'upsert_label', label: { name: lbl.name, color: hex } });
            renderNoteLabelsManager();
            renderNotes();
          }
        })
      );
      return el('div', { className: 'label-mgr-row' }, [
        el('div', { className: 'label-mgr-top' }, [
          el('span', { className: 'label-mgr-name' }, [
            el('span', { className: 'label-dot', style: `background:${lbl.color}` }),
            el('span', { textContent: lbl.name })
          ])
        ]),
        el('div', { className: 'swatch-row' }, swatches)
      ]);
    });
    listEl.replaceChildren(...rows);
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
    const subEl = document.getElementById('headerSubtitle');
    if (subEl) subEl.textContent = meta.sub;

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
      smartMutateAndPush(KEYS.DISPLAY_CURRENCY, { type: 'set_raw', value: state.displayCurrency });
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

      if (!id) entry.createdAt = new Date().toISOString();

      closeDialog('txDialog');
      await smartMutateAndPush(KEYS.EXPENSES, { type: 'upsert_item', item: entry });
      renderAll();
      showToast('Transaction saved');
    });

    document.getElementById('txDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('txIdInput').value;
      if (!id) return;
      closeDialog('txDialog');
      await smartMutateAndPush(KEYS.EXPENSES, { type: 'delete_item', id });
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

      state.selectedDate = item.date;
      closeDialog('calItemDialog');
      await smartMutateAndPush(KEYS.CALENDAR_PLAN, { type: 'upsert_cal_item', item });
      renderAll();
      showToast('Saved to calendar');
    });

    document.getElementById('calItemDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('calItemIdInput').value;
      if (!id) return;
      closeDialog('calItemDialog');
      await smartMutateAndPush(KEYS.CALENDAR_PLAN, { type: 'delete_cal_item', id });
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

      if (!id) note.createdAt = new Date().toISOString();

      closeDialog('noteDialog');
      await smartMutateAndPush(KEYS.NOTES, { type: 'upsert_item', item: note });
      renderAll();
      showToast('Note saved');
    });

    document.getElementById('noteDeleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('noteIdInput').value;
      if (!id) return;
      closeDialog('noteDialog');
      await smartMutateAndPush(KEYS.NOTES, { type: 'delete_item', id });
      renderAll();
      showToast('Note deleted');
    });

    // PIN / Cloud Key Form
    document.getElementById('pinForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = document.getElementById('pinInput').value.trim();
      const err = document.getElementById('pinError');
      err.hidden = true;
      if (!val) return;

      if (isCloudMode()) {
        localStorage.setItem(CLOUD_TOKEN_KEY, val);
        const ok = await pullVault(false);
        if (ok) {
          closeDialog('pinDialog');
        } else {
          localStorage.removeItem(CLOUD_TOKEN_KEY);
          err.hidden = false;
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: val, token: val })
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

    // Notes Categories & Colors Customize Sheet
    const custBtn = document.getElementById('notesCustomizeBtn');
    if (custBtn) {
      custBtn.addEventListener('click', () => {
        renderNoteLabelsManager();
        openDialog('noteLabelsDialog');
      });
    }
    const newLblForm = document.getElementById('newNoteLabelForm');
    if (newLblForm) {
      newLblForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameEl = document.getElementById('newNoteLabelName');
        const colorEl = document.getElementById('newNoteLabelColor');
        const name = (nameEl.value || '').trim();
        if (!name) return;
        await smartMutateAndPush(KEYS.NOTE_LABELS, { type: 'upsert_label', label: { name, color: colorEl.value || '#3b82f6' } });
        nameEl.value = '';
        renderNoteLabelsManager();
        renderNotes();
        showToast('Category saved');
      });
    }

    // Pull-to-refresh on mainContent
    const mainEl = document.getElementById('mainContent');
    const ptrEl = document.getElementById('ptrIndicator');
    const ptrText = document.getElementById('ptrText');
    if (mainEl && ptrEl && ptrText) {
      let startY = 0;
      let pulling = false;
      let pullDist = 0;
      mainEl.addEventListener('touchstart', (e) => {
        if (mainEl.scrollTop <= 0 && e.touches.length === 1) {
          startY = e.touches[0].clientY;
          pulling = true;
          pullDist = 0;
        }
      }, { passive: true });
      mainEl.addEventListener('touchmove', (e) => {
        if (!pulling || mainEl.scrollTop > 0) {
          pulling = false;
          ptrEl.hidden = true;
          return;
        }
        const dy = e.touches[0].clientY - startY;
        if (dy > 14) {
          pullDist = dy;
          ptrEl.hidden = false;
          ptrText.textContent = dy >= 68 ? 'Release to refresh' : 'Pull to refresh';
        }
      }, { passive: true });
      mainEl.addEventListener('touchend', async () => {
        if (!pulling) return;
        pulling = false;
        if (pullDist >= 68) {
          ptrText.textContent = 'Syncing...';
          await pullVault(false);
          showToast('Synced');
        }
        ptrEl.hidden = true;
        pullDist = 0;
      });
    }

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
