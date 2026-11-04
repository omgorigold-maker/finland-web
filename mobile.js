/**
 * Finland Mobile Engine
 * Complete feature & data parity with Desktop Finland.
 * Real-time two-way synchronization via /api/vault.
 */

(function() {
  "use strict";

  // ==========================================
  // 1. STORAGE KEYS (MATCHES APP.JS 100%)
  // ==========================================
  const STORAGE_KEYS = {
    EXPENSES: "finland_expenses_v2",
    SUBSCRIPTIONS: "finland_subscriptions_v2",
    BUDGET: "finland_budget_data_v1",
    DEBTS: "finland_debts_v1",
    NOTES: "finland_notes_v1",
    WISHLIST: "finland_wishlist_v1",
    DISPLAY_CURRENCY: "finland_display_currency_v1",
    RATES_CACHE: "finland_rates_cache_v1",
    NAV_CONFIG: "finland_nav_config_v1",
    APP_PREFS: "finland_app_prefs_v1",
    WISE_DELETED_IDS: "finland_wise_deleted_ids_v1"
  };

  const DEFAULT_APP_PREFS = {
    displayedCurrencies: ['EUR', 'ILS', 'USD'], // Cap at 3
    defaultStartupCurrency: 'EUR',
    decimalMode: 'cents', // 'cents' (.00) or 'whole'
    numberFormatLocale: 'standard', // 'standard' (1,250.00) or 'european' (1.250,00)
    paymentMethods: [
      { id: 'pm_1', name: 'Debit Card', last4: '8718', isDefault: true },
      { id: 'pm_2', name: 'Credit Card', last4: '4959', isDefault: false },
      { id: 'pm_3', name: 'Bank Transfer', last4: '', isDefault: false }
    ],
    defaultPaymentMethodId: 'pm_1',
    advanceAlertDays: 7, // 3, 7, or 14 days
    calendarWeekStart: 'sunday',
    calendarDotColor: '#9333ea',
    calendarBillingStyle: 'badge',
    calendarTodayStyle: 'ring',
    calendarAdjacentDays: 'faded',
    calendarSummaryMode: 'count'
  };

  const DEFAULT_NAV_CONFIG = {
    expenses: {
      id: 'expenses',
      tabId: 'sidebarTabExpenses',
      defaultName: 'Transactions',
      name: 'Transactions',
      defaultIcon: 'arrow-left-right',
      icon: 'arrow-left-right',
      defaultColor: '#10b981', // Emerald
      color: '#10b981',
      visible: true
    },
    subscriptions: {
      id: 'subscriptions',
      tabId: 'sidebarTabSubscriptions',
      defaultName: 'Calendar',
      name: 'Calendar',
      defaultIcon: 'calendar',
      icon: 'calendar',
      defaultColor: '#9333ea', // Purple
      color: '#9333ea',
      visible: true
    },
    budget: {
      id: 'budget',
      tabId: 'sidebarTabBudget',
      defaultName: 'Budget & Cash Flow',
      name: 'Budget & Cash Flow',
      defaultIcon: 'piggy-bank',
      icon: 'piggy-bank',
      defaultColor: '#ec4899', // Customized on web (Pink / Rose)
      color: '#ec4899',
      visible: true
    },
    project_followup: {
      id: 'project_followup',
      tabId: 'sidebarTabProjectFollowup',
      defaultName: 'Project Followup',
      name: 'Project Followup',
      defaultIcon: 'folder-kanban',
      icon: 'folder-kanban',
      defaultColor: '#0ea5e9', // Sky Blue
      color: '#0ea5e9',
      visible: true
    },
    needs_to_pay: {
      id: 'needs_to_pay',
      tabId: 'sidebarTabNeedsToPay',
      defaultName: 'Needa Pay',
      name: 'Needa Pay',
      defaultIcon: 'hourglass',
      icon: 'hourglass',
      defaultColor: '#ef4444', // Red
      color: '#ef4444',
      visible: true
    },
    wishlist: {
      id: 'wishlist',
      tabId: 'sidebarTabWishlist',
      defaultName: 'Wishlist',
      name: 'Wishlist',
      defaultIcon: 'sparkles',
      icon: 'sparkles',
      defaultColor: '#eab308', // Customized on web (Yellow)
      color: '#eab308',
      visible: true
    },
    notes: {
      id: 'notes',
      tabId: 'sidebarTabNotes',
      defaultName: 'Notes',
      name: 'Notes',
      defaultIcon: 'clipboard-list',
      icon: 'clipboard-list',
      defaultColor: '#d97706', // Warm Amber
      color: '#d97706',
      visible: true
    },
    reports: {
      id: 'reports',
      tabId: 'sidebarTabReports',
      defaultName: 'Reports',
      name: 'Reports',
      defaultIcon: 'pie-chart',
      icon: 'pie-chart',
      defaultColor: '#3b82f6', // Azure Blue
      color: '#3b82f6',
      visible: true
    }
  };

  const MOBILE_VIEW_TO_NAV = {
    viewExpenses: 'expenses',
    viewSubscriptions: 'subscriptions',
    viewBudget: 'budget',
    viewProjectFollowup: 'project_followup',
    viewNeedsToPay: 'needs_to_pay',
    viewWishlist: 'wishlist',
    viewNotes: 'notes',
    viewReports: 'reports'
  };

  const NAV_TO_MOBILE_VIEW = {
    expenses: 'viewExpenses',
    subscriptions: 'viewSubscriptions',
    budget: 'viewBudget',
    project_followup: 'viewProjectFollowup',
    needs_to_pay: 'viewNeedsToPay',
    wishlist: 'viewWishlist',
    notes: 'viewNotes',
    reports: 'viewReports'
  };

  const ALL_SUPPORTED_CURRENCIES = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' }
  ];

  const DEFAULT_RATES = {
    USD: 1.0,
    EUR: 0.92,
    ILS: 3.72,
    GBP: 0.77,
    CAD: 1.36,
    AUD: 1.50,
    JPY: 152.0,
    CHF: 0.86
  };

  const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    ILS: '₪',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    CHF: 'CHF'
  };

  const CATEGORY_COLORS = {
    Groceries: '#059669',    // Friendly Emerald
    Dining: '#d97706',       // Warm Amber
    Housing: '#4f46e5',      // Soft Indigo
    Utilities: '#0891b2',    // Clean Cyan
    Transport: '#db2777',    // Rose
    Subscriptions: '#7c3aed',// Violet
    Shopping: '#e11d48',     // Crimson
    Health: '#0d9488',       // Teal
    Entertainment: '#ca8a04',// Golden Honey
    Travel: '#2563eb',       // Sky Blue
    Other: '#475569'         // Slate
  };

  const DEFAULT_BUDGET_CATEGORIES = [
    { id: 'cat_groceries', name: 'Groceries', icon: 'shopping-cart', color: '#10b981', limit: 0 },
    { id: 'cat_dining', name: 'Dining', icon: 'utensils', color: '#f59e0b', limit: 0 },
    { id: 'cat_shopping', name: 'Shopping', icon: 'shopping-bag', color: '#ec4899', limit: 0 },
    { id: 'cat_transport', name: 'Transport', icon: 'car', color: '#06b6d4', limit: 0 },
    { id: 'cat_entertainment', name: 'Entertainment', icon: 'ticket', color: '#8b5cf6', limit: 0 },
    { id: 'cat_health', name: 'Health', icon: 'activity', color: '#ef4444', limit: 0 },
    { id: 'cat_travel', name: 'Travel', icon: 'plane', color: '#3b82f6', limit: 0 },
    { id: 'cat_other', name: 'Other', icon: 'tag', color: '#64748b', limit: 0 }
  ];

  const DEFAULT_STARTER_NOTES = [
    {
      id: "note_1",
      title: "Clear out storage unit",
      label: "Storage",
      dueDate: "2026-10-11",
      body: "Need to clear out storage unit until October 11th. Finish packing remaining boxes, hand over key and finalize deposit return.",
      color: "#f59e0b",
      isPinned: true,
      isDone: false,
      createdAt: "2026-10-07"
    },
    {
      id: "note_2",
      title: "Follow up on Feather insurance emails",
      label: "Insurance",
      dueDate: "2026-10-15",
      body: "Check inbox for claim approval status from Feather. Reply with medical receipt PDF if requested.",
      color: "#3b82f6",
      isPinned: false,
      isDone: false,
      createdAt: "2026-10-07"
    },
    {
      id: "note_3",
      title: "Quarterly freelance tax reserve check",
      label: "Taxes",
      dueDate: "2026-10-31",
      body: "Verify 20% freelance tax buffer is safely transferred to savings sub-account before end of month.",
      color: "#10b981",
      isPinned: false,
      isDone: false,
      createdAt: "2026-10-07"
    }
  ];

  // ==========================================
  // 2. STATE
  // ==========================================
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const state = {
    expenses: [],
    subscriptions: [],
    debts: [],
    wishlist: [],
    notes: JSON.parse(JSON.stringify(DEFAULT_STARTER_NOTES)),
    budget: {
      isFreelancer: true,
      taxReservePercent: 0,
      projects: [],
      incomes: [],
      leads: [],
      categories: JSON.parse(JSON.stringify(DEFAULT_BUDGET_CATEGORIES)),
      categoryBudgets: {}
    },
    displayCurrency: "EUR",
    rates: Object.assign({}, DEFAULT_RATES),
    selectedMonth: currentMonthStr,
    activeTab: "viewExpenses",
    filter: "all",
    categoryFilter: "ALL",
    sort: "date-desc",
    searchQuery: "",
    projectFilter: "all",
    pendingExpenseReceipt: null,
    pendingExpenseReceiptName: null,
    pendingNoteAttachments: [],
    pendingNoteLinks: [],
    charts: {
      category: null,
      trend: null,
      cashflow: null
    },
    appPrefs: Object.assign({}, DEFAULT_APP_PREFS),
    navConfig: JSON.parse(JSON.stringify(DEFAULT_NAV_CONFIG))
  };

  function confirmAction(optionsOrMessage, extraOptions = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('globalConfirmModal');
      if (!modal) {
        const msg = typeof optionsOrMessage === 'string' ? optionsOrMessage : (optionsOrMessage?.message || optionsOrMessage?.title || 'Are you sure?');
        resolve(window.confirm(msg));
        return;
      }

      let title = 'Are you sure?';
      let message = 'Please confirm if you want to proceed.';
      let confirmText = 'Confirm';
      let cancelText = 'Cancel';
      let type = 'danger'; // 'danger' | 'warning' | 'primary'

      if (typeof optionsOrMessage === 'string') {
        const str = optionsOrMessage.trim();
        title = str;
        if (/delete|remove|clear/i.test(str)) {
          type = 'danger';
          confirmText = /remove/i.test(str) ? 'Remove' : 'Delete';
          message = 'This action cannot be undone.';
        } else if (/convert/i.test(str)) {
          type = 'warning';
          confirmText = 'Convert';
          message = 'You can convert it back anytime.';
        } else {
          type = 'primary';
          confirmText = 'Confirm';
          message = 'Please confirm if you want to proceed.';
        }
      } else if (typeof optionsOrMessage === 'object' && optionsOrMessage !== null) {
        title = optionsOrMessage.title || title;
        message = optionsOrMessage.message || message;
        confirmText = optionsOrMessage.confirmText || confirmText;
        cancelText = optionsOrMessage.cancelText || cancelText;
        type = optionsOrMessage.type || type;
      }

      if (extraOptions) {
        if (extraOptions.title) title = extraOptions.title;
        if (extraOptions.message) message = extraOptions.message;
        if (extraOptions.confirmText) confirmText = extraOptions.confirmText;
        if (extraOptions.cancelText) cancelText = extraOptions.cancelText;
        if (extraOptions.type) type = extraOptions.type;
      }

      const iconBox = document.getElementById('globalConfirmIconBox');
      const titleEl = document.getElementById('globalConfirmTitle');
      const messageEl = document.getElementById('globalConfirmMessage');
      const okBtn = document.getElementById('globalConfirmOkBtn');
      const cancelBtn = document.getElementById('globalConfirmCancelBtn');

      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;

      if (iconBox) {
        if (type === 'danger') {
          iconBox.className = 'w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0';
          iconBox.innerHTML = '<i data-lucide="trash-2" class="w-5 h-5"></i>';
        } else if (type === 'warning') {
          iconBox.className = 'w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0';
          iconBox.innerHTML = '<i data-lucide="arrow-left-right" class="w-5 h-5"></i>';
        } else {
          iconBox.className = 'w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center shrink-0';
          iconBox.innerHTML = '<i data-lucide="help-circle" class="w-5 h-5"></i>';
        }
      }

      if (okBtn) {
        okBtn.textContent = confirmText;
        if (type === 'danger') {
          okBtn.className = 'flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs shadow-rose-600/20';
        } else if (type === 'warning') {
          okBtn.className = 'flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs shadow-amber-600/20';
        } else {
          okBtn.className = 'flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs shadow-indigo-600/20';
        }
      }

      if (cancelBtn) cancelBtn.textContent = cancelText;

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }

      let isSettled = false;
      const cleanup = (result) => {
        if (isSettled) return;
        isSettled = true;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.removeEventListener('click', handleBackdrop);
        window.removeEventListener('keydown', handleKey, true);
        if (okBtn) okBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        resolve(result);
      };

      const handleBackdrop = (e) => {
        if (e.target === modal || !e.target.closest('#globalConfirmModal .modal-card')) {
          cleanup(false);
        }
      };

      const handleKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cleanup(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          cleanup(true);
        }
      };

      if (okBtn) okBtn.onclick = (e) => { e.preventDefault(); cleanup(true); };
      if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); cleanup(false); };
      modal.addEventListener('click', handleBackdrop);
      window.addEventListener('keydown', handleKey, true);

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
  }

  function refreshIcons(container) {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        if (container && (container instanceof Element || container.nodeType === 1)) {
          window.lucide.createIcons({ root: container });
        } else {
          window.lucide.createIcons();
        }
      } catch (e) {
        try { window.lucide.createIcons(); } catch (err) {}
      }
    }
  }

  // ==========================================
  // 3. CURRENCY HELPERS
  // ==========================================
  function convertCurrency(amount, from, to) {
    if (!amount || isNaN(amount)) return 0;
    if (from === to) return amount;
    const rates = state.rates;
    const amountInUSD = amount / (rates[from] || 1.0);
    return amountInUSD * (rates[to] || 1.0);
  }

  function formatMoney(amount, currency = state.displayCurrency) {
    const sym = CURRENCY_SYMBOLS[currency] || currency;
    const num = Number(amount || 0);
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    const prefs = state.appPrefs || {};
    const isWhole = (prefs.decimalMode === 'whole');
    const isEuroLocale = (prefs.numberFormatLocale === 'european');

    const minDigits = isWhole ? 0 : 2;
    const maxDigits = isWhole ? 0 : 2;
    const localeCode = isEuroLocale ? 'de-DE' : 'en-US';

    const val = absNum.toLocaleString(localeCode, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    });

    return isNegative ? `-${sym}${val}` : `${sym}${val}`;
  }

  function getActiveDisplayedCurrencies() {
    if (state.appPrefs?.displayedCurrencies && Array.isArray(state.appPrefs.displayedCurrencies) && state.appPrefs.displayedCurrencies.length > 0) {
      return state.appPrefs.displayedCurrencies.slice(0, 3);
    }
    return ['EUR', 'ILS', 'USD'];
  }

  function getTriCurrencyValues(amount, fromCurrency = state.displayCurrency) {
    const list = getActiveDisplayedCurrencies();
    const res = {};
    list.forEach(c => {
      res[c] = convertCurrency(amount, fromCurrency, c);
    });
    if (!res.USD) res.USD = convertCurrency(amount, fromCurrency, "USD");
    if (!res.EUR) res.EUR = convertCurrency(amount, fromCurrency, "EUR");
    if (!res.ILS) res.ILS = convertCurrency(amount, fromCurrency, "ILS");
    return res;
  }

  function formatTriEquiv(amount, fromCurrency = state.displayCurrency) {
    const activeList = getActiveDisplayedCurrencies();
    const tri = getTriCurrencyValues(amount, fromCurrency);
    const nonActive = activeList.filter(c => c !== state.displayCurrency);
    if (nonActive.length === 0) return '';
    return '≈ ' + nonActive.map(c => {
      const sym = CURRENCY_SYMBOLS[c] || c;
      return `${sym}${(tri[c] !== undefined ? tri[c] : convertCurrency(amount, fromCurrency, c)).toFixed(2)}`;
    }).join(' • ');
  }

  // Freelance Project Helpers
  function getProjectPaidDate(p) {
    if (!p) return '';
    if (p.paidDate) return p.paidDate;
    if (Array.isArray(p.payments) && p.payments.length > 0) {
      const lastPay = p.payments[p.payments.length - 1];
      if (lastPay && lastPay.date) return lastPay.date;
    }
    return p.dueDate || '';
  }

  function isLeadLost(lead) {
    if (!lead) return false;
    const s = String(lead.status || '').trim().toLowerCase();
    return s === 'lost' || s === 'passed / lost' || s.includes('lost') || s.includes('passed') || s.includes('declined') || s.includes('rejected');
  }

  function leadMatchesMonth(lead, monthKey) {
    if (!lead) return false;
    if (!monthKey || monthKey === 'ALL' || monthKey === 'all') {
      return true;
    }
    const createdMonth = (lead.createdAt || lead.statusDate || lead.targetDate || '').substring(0, 7);
    if (createdMonth && monthKey < createdMonth) {
      return false; // Did not exist yet in prior months
    }

    if (isLeadLost(lead)) {
      const lostMonth = (lead.lostDate || lead.statusDate || lead.createdAt || '').substring(0, 7);
      return (lostMonth || createdMonth) === monthKey; // Stays strictly in the month it was lost in
    }

    // Active leads continue to roll forward into subsequent months
    return true;
  }

  function projectMatchesMonth(p, monthKey) {
    if (!p) return false;
    if (!monthKey || monthKey === 'ALL' || monthKey === 'all') {
      return true;
    }
    const total = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
    const paid = parseFloat(p.paidAmount) || 0;
    const isPaid = p.status === 'paid' || (paid >= total && total > 0);
    const isDone = (typeof isProjectDone === 'function' && isProjectDone(p)) || isPaid;
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (isDone) {
      if (p.completedAt && p.completedAt.startsWith(monthKey)) return true;
      const paidDate = getProjectPaidDate(p);
      if (paidDate && paidDate.startsWith(monthKey)) return true;
      if (Array.isArray(p.payments) && p.payments.some(pay => pay.date && pay.date.startsWith(monthKey))) return true;
      if (!p.completedAt && !paidDate && p.dueDate && p.dueDate.startsWith(monthKey)) return true;
      if (!p.completedAt && !paidDate && !p.dueDate && p.createdAt && p.createdAt.startsWith(monthKey)) return true;
      return false;
    } else {
      if (p.dueDate && p.dueDate.startsWith(monthKey)) return true;
      if (Array.isArray(p.payments) && p.payments.some(pay => pay.date && pay.date.startsWith(monthKey))) return true;
      if (Array.isArray(p.steps) && p.steps.some(s => (s.completedDate && s.completedDate.startsWith(monthKey)) || (s.date && s.date.startsWith(monthKey)))) return true;
      if (p.createdAt && p.createdAt.startsWith(monthKey)) return true;
      const startMonth = (p.startDate || p.createdAt || '').substring(0, 7);
      const endMonth = (p.dueDate || '').substring(0, 7);
      if (startMonth && endMonth && startMonth <= monthKey && monthKey <= endMonth) return true;
      if (!p.dueDate && !p.createdAt && monthKey === curMonthKey) return true;
      return false;
    }
  }

  window.isLeadLost = isLeadLost;
  window.leadMatchesMonth = leadMatchesMonth;
  window.projectMatchesMonth = projectMatchesMonth;

  function formatNoteDueDateHierarchy(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  function formatLinkDomain(rawUrl) {
    if (!rawUrl) return 'Link';
    try {
      const u = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
      const parsed = new URL(u);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return rawUrl.length > 22 ? rawUrl.substring(0, 20) + '...' : rawUrl;
    }
  }

  function normalizeServiceName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/(subscription|premium|family plan|monthly|annual|pro|plus|service|bill|plan|inc\.|llc|corp)/gi, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();
  }

  function isSubscriptionPaidInMonth(sub, yearMonthStr) {
    if (!sub) return false;
    const targetMonth = yearMonthStr || new Date().toISOString().slice(0, 7);
    if (sub.manualPaidMonths && typeof sub.manualPaidMonths === 'object') {
      if (sub.manualPaidMonths[targetMonth] === true) return true;
      if (sub.manualPaidMonths[targetMonth] === false) return false;
    }
    const normSub = normalizeServiceName(sub.name);
    return (state.expenses || []).some(e => {
      const eDate = e.date || '';
      if (!eDate.startsWith(targetMonth)) return false;
      if (e.subscriptionId || e.generatedFromSubId) {
        return (e.subscriptionId === sub.id || e.generatedFromSubId === sub.id);
      }
      const normExp = normalizeServiceName(e.title || '');
      if (normSub && normExp && normExp === normSub) return true;
      if (e.title && sub.name && e.title.trim().toLowerCase() === sub.name.trim().toLowerCase()) return true;
      return false;
    });
  }

  function isSubscriptionCountedInMonth(sub, yearMonthStr) {
    if (!sub) return false;
    if (!sub.isFrozen) return true;
    return isSubscriptionPaidInMonth(sub, yearMonthStr);
  }

  function isBasicRecurringCategory(category, title = '') {
    const text = `${category || ''} ${title || ''}`.toLowerCase();
    return /housing|rent|utilities|utility|bill|phone|internet|mobile|cell|wifi|electric|water|gas|insurance/i.test(text);
  }

  const FIXED_CATEGORIES = ['Subscriptions', 'Housing', 'Utilities'];

  function isFlexibleExpense(exp) {
    if (!exp || exp.isIncome || exp.type === 'income' || exp.category === 'Income') return false;
    return !exp.isSubscription && !FIXED_CATEGORIES.includes(exp.category);
  }

  function getOrdinalNum(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getSubMonthlyAmount(sub, targetCur = state.displayCurrency) {
    if (!sub) return 0;
    const amtInTarget = convertCurrency(sub.amount || 0, sub.currency || "EUR", targetCur);
    return sub.billingCycle === 'yearly' ? (amtInTarget / 12) : amtInTarget;
  }

  function calculateSubNextDate(sub) {
    if (!sub) return { nextDate: new Date(), diffDays: 0, nextBillingDate: '', bDay: 1 };
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed
    const curDay = now.getDate();
    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const curYearMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    let bDay = sub.billingDay ? parseInt(sub.billingDay, 10) : null;
    if (!bDay && sub.lastBilledDate) {
      const parts = sub.lastBilledDate.split('-');
      if (parts.length === 3) bDay = parseInt(parts[2], 10);
    }
    if (!bDay && sub.nextBillingDate) {
      const parts = sub.nextBillingDate.split('-');
      if (parts.length === 3) bDay = parseInt(parts[2], 10);
    }
    if (!bDay || isNaN(bDay)) bDay = 1;

    const isYearly = sub.billingCycle === 'yearly';
    const paidThisMonth = isSubscriptionPaidInMonth(sub, curYearMonthStr);

    let nextDate;
    if (isYearly) {
      let renewalMonth = curMonth;
      if (sub.lastBilledDate) {
        const parts = sub.lastBilledDate.split('-');
        if (parts.length >= 2) renewalMonth = parseInt(parts[1], 10) - 1;
      } else if (sub.nextBillingDate) {
        const parts = sub.nextBillingDate.split('-');
        if (parts.length >= 2) renewalMonth = parseInt(parts[1], 10) - 1;
      }
      const daysInTargetMonth = new Date(curYear, renewalMonth + 1, 0).getDate();
      const targetDay = Math.min(bDay, daysInTargetMonth);
      let targetDate = new Date(curYear, renewalMonth, targetDay);

      const targetPassed = (curMonth > renewalMonth) || (curMonth === renewalMonth && (curDay > targetDay || paidThisMonth));
      if (targetPassed) {
        const daysInNextYearMonth = new Date(curYear + 1, renewalMonth + 1, 0).getDate();
        targetDate = new Date(curYear + 1, renewalMonth, Math.min(bDay, daysInNextYearMonth));
      }
      nextDate = targetDate;
    } else {
      // Monthly renewal
      const isBilledThisMonth = paidThisMonth || (bDay <= curDay);
      if (isBilledThisMonth) {
        // Roll to next month
        const nextMonthDays = new Date(curYear, curMonth + 2, 0).getDate();
        nextDate = new Date(curYear, curMonth + 1, Math.min(bDay, nextMonthDays));
      } else {
        // Due later this month
        nextDate = new Date(curYear, curMonth, Math.min(bDay, daysInCurMonth));
      }
    }

    const diffTime = nextDate.setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    const diffDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(nextDate.getDate()).padStart(2, '0');
    const nextBillingDate = `${yStr}-${mStr}-${dStr}`;

    return { nextDate, diffDays, nextBillingDate, bDay };
  }

  function toggleFreezeSubscription(subId) {
    const sub = (state.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayDay = today.getDate();

    if (!sub.isFrozen) {
      sub.isFrozen = true;
      sub.frozenAt = new Date().toISOString();
      showMobileToast(`❄️ "${sub.name}" frozen (excluded this month)`);
    } else {
      sub.isFrozen = false;
      delete sub.frozenAt;
      sub.unfrozenAt = new Date().toISOString();
      sub.billingDay = todayDay;
      sub.lastBilledDate = todayStr;
      sub.nextBillingDate = todayStr;
      showMobileToast(`⚡ "${sub.name}" resubscribed (starts today)`);
    }

    saveAllToLocalStorage();
    renderSubscriptionsView();
    renderBudgetView();
    renderNeedsToPayView();
    pushToVault();
  }
  // 4. DATA PERSISTENCE & LOCAL VAULT
  // ==========================================
  function loadLocalData() {
    try {
      const rawPrefs = localStorage.getItem(STORAGE_KEYS.APP_PREFS);
      if (rawPrefs) {
        state.appPrefs = Object.assign({}, DEFAULT_APP_PREFS, JSON.parse(rawPrefs));
      } else {
        state.appPrefs = Object.assign({}, DEFAULT_APP_PREFS);
      }

      const defaultStartCur = state.appPrefs?.defaultStartupCurrency;
      const cur = localStorage.getItem(STORAGE_KEYS.DISPLAY_CURRENCY);
      if (defaultStartCur && CURRENCY_SYMBOLS[defaultStartCur]) {
        state.displayCurrency = defaultStartCur;
      } else if (cur && CURRENCY_SYMBOLS[cur]) {
        state.displayCurrency = cur;
      }

      const rates = localStorage.getItem(STORAGE_KEYS.RATES_CACHE);
      if (rates) state.rates = Object.assign(state.rates, JSON.parse(rates));

      const exp = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      state.expenses = exp ? JSON.parse(exp) : [];

      const subs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      state.subscriptions = subs ? JSON.parse(subs) : [];

      const debts = localStorage.getItem(STORAGE_KEYS.DEBTS);
      state.debts = debts ? JSON.parse(debts) : [];

      const wish = localStorage.getItem(STORAGE_KEYS.WISHLIST);
      state.wishlist = wish ? JSON.parse(wish) : [];

      const notes = localStorage.getItem(STORAGE_KEYS.NOTES);
      state.notes = notes ? JSON.parse(notes) : [];

      const bud = localStorage.getItem(STORAGE_KEYS.BUDGET);
      if (bud) {
        const parsedBud = JSON.parse(bud);
        state.budget = Object.assign(state.budget, parsedBud);
        if (parsedBud.taxReservePercent !== undefined) {
          state.budget.taxReservePercent = parseInt(parsedBud.taxReservePercent, 10) || 0;
        }
        if (!Array.isArray(state.budget.projects)) state.budget.projects = [];
        if (!Array.isArray(state.budget.leads)) state.budget.leads = [];
        state.budget.projects.forEach(p => {
          const total = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
          if (p.fee === undefined && p.amount !== undefined) p.fee = p.amount;
          if (p.amount === undefined && p.fee !== undefined) p.amount = p.fee;
          const paid = parseFloat(p.paidAmount) || 0;
          if ((p.status === 'paid' || (paid >= total && total > 0)) && !p.paidDate) {
            p.paidDate = getProjectPaidDate(p);
          }
          if (!Array.isArray(p.steps) || p.steps.length === 0) {
            p.steps = [
              { id: "step_quote", title: "Sent price offering / quote", completed: true, completedDate: p.createdAt ? p.createdAt.split("T")[0] : "", isDefault: true },
              { id: "step_proforma", title: "Sent proforma invoice", completed: !!p.hasProformaDoc, isDefault: true },
              { id: "step_deadline", title: "Project deadline & final delivery", completed: false, isDefault: true, isMandatory: true },
              { id: "step_payment", title: "Got paid (full amount received)", completed: p.status === 'paid' || paid >= total, completedDate: p.paidDate || "", isDefault: true, isMandatory: true },
              { id: "step_receipt", title: "Sent official tax receipt", completed: !!p.hasReceiptDoc || !!p.hasInvoiceDoc, isDefault: true, isMandatory: true }
            ];
          }
        });
      }

      const nav = localStorage.getItem(STORAGE_KEYS.NAV_CONFIG);
      state.navConfig = JSON.parse(JSON.stringify(DEFAULT_NAV_CONFIG));
      if (nav) {
        try {
          const parsed = JSON.parse(nav);
          if (parsed && typeof parsed === 'object') {
            Object.keys(DEFAULT_NAV_CONFIG).forEach(id => {
              state.navConfig[id] = {
                ...DEFAULT_NAV_CONFIG[id],
                ...(parsed[id] || {})
              };
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Could not load local storage:", e);
    }
  }

  function saveAllToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(state.subscriptions));
      localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(state.debts));
      localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(state.wishlist));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(state.budget));
      localStorage.setItem(STORAGE_KEYS.DISPLAY_CURRENCY, state.displayCurrency);
      localStorage.setItem(STORAGE_KEYS.RATES_CACHE, JSON.stringify(state.rates));
      localStorage.setItem(STORAGE_KEYS.APP_PREFS, JSON.stringify(state.appPrefs));
      if (state.navConfig) {
        localStorage.setItem(STORAGE_KEYS.NAV_CONFIG, JSON.stringify(state.navConfig));
      }
    } catch (e) {
      console.warn("Local storage save error:", e);
    }
  }

  // ==========================================
  // 5. LIVE REFRESH & SYNC ENGINE (/api/vault)
  // ==========================================
  function getMobileAuthToken() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('vault_auth_token', urlToken);
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        return urlToken;
      }
    } catch (e) {}
    return localStorage.getItem('vault_auth_token') || '';
  }

  function getMobileAuthHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = getMobileAuthToken();
    if (token) headers['X-Vault-Token'] = token;
    return headers;
  }

  function showMobileAuthModal() {
    // PIN requirement disabled per user request
    hideMobileAuthModal();
  }

  function hideMobileAuthModal() {
    const modal = document.getElementById('vaultAuthModal');
    if (modal) modal.classList.add('hidden');
    const err = document.getElementById('vaultAuthErrorMsg');
    if (err) err.classList.add('hidden');
  }

  async function pushToVault() {
    if (!window.location.protocol.startsWith("http")) return;
    try {
      const payload = {
        [STORAGE_KEYS.EXPENSES]: JSON.stringify(state.expenses),
        [STORAGE_KEYS.SUBSCRIPTIONS]: JSON.stringify(state.subscriptions),
        [STORAGE_KEYS.BUDGET]: JSON.stringify(state.budget),
        [STORAGE_KEYS.DEBTS]: JSON.stringify(state.debts),
        [STORAGE_KEYS.NOTES]: JSON.stringify(state.notes),
        [STORAGE_KEYS.WISHLIST]: JSON.stringify(state.wishlist),
        [STORAGE_KEYS.DISPLAY_CURRENCY]: state.displayCurrency,
        [STORAGE_KEYS.RATES_CACHE]: JSON.stringify(state.rates),
        [STORAGE_KEYS.NAV_CONFIG]: localStorage.getItem(STORAGE_KEYS.NAV_CONFIG) || "{}",
        [STORAGE_KEYS.APP_PREFS]: JSON.stringify(state.appPrefs),
        [STORAGE_KEYS.WISE_DELETED_IDS]: localStorage.getItem(STORAGE_KEYS.WISE_DELETED_IDS) || "[]"
      };

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: getMobileAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res && res.status === 401) {
        showMobileAuthModal();
      }
    } catch (e) {
      // Offline fallback
    }
  }

  let lastKnownMobileSyncTime = "";
  let isMobileSyncing = false;

  async function syncFromVault(showToast = false) {
    if (isMobileSyncing) return;
    isMobileSyncing = true;
    const icon = document.getElementById("syncSpinnerIcon");
    if (icon) icon.classList.add("is-syncing");

    try {
      let res;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
      try {
        res = await fetch("/api/vault", {
          cache: "no-store",
          headers: getMobileAuthHeaders(),
          signal: controller ? controller.signal : undefined
        });
      } catch (err) {
        try {
          const fallbackCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const fallbackTimeout = fallbackCtrl ? setTimeout(() => fallbackCtrl.abort(), 2500) : null;
          res = await fetch("vault_data.json", {
            cache: "no-store",
            signal: fallbackCtrl ? fallbackCtrl.signal : undefined
          });
          if (fallbackTimeout) clearTimeout(fallbackTimeout);
        } catch (e2) {
          res = null;
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (res && res.status === 401) {
        showMobileAuthModal();
        return;
      }
      hideMobileAuthModal();

      if (res && res.ok) {
        const remote = await res.json();
        if (remote && typeof remote === "object" && Object.keys(remote).length > 0) {
          const remoteTime = remote._last_synced || "";
          if (!showToast && remoteTime && remoteTime === lastKnownMobileSyncTime) {
            return;
          }

          let changed = false;
          Object.keys(STORAGE_KEYS).forEach(k => {
            const key = STORAGE_KEYS[k];
            if (remote[key] !== undefined && remote[key] !== null) {
              const current = localStorage.getItem(key);
              const remoteVal = typeof remote[key] === "string" ? remote[key] : JSON.stringify(remote[key]);
              if (current !== remoteVal) {
                if (remoteVal.trim() !== "[]" && remoteVal.trim() !== "{}" && remoteVal.trim() !== "") {
                  localStorage.setItem(key, remoteVal);
                  changed = true;
                } else if (!current || current.trim() === "[]" || current.trim() === "{}" || current.trim() === "") {
                  localStorage.setItem(key, remoteVal);
                }
              }
            }
          });

          if (changed || showToast) {
            lastKnownMobileSyncTime = remoteTime;
            loadLocalData();
            applyMobileNavConfig();

            const isModalOpen = document.querySelector(".bottom-sheet:not(.closed)");
            if (!isModalOpen || showToast) {
              renderActiveView();
            }

            if (showToast) {
              showMobileToast(`✨ Synced with Web (${state.expenses.length} tx)`);
            }
          }
        }
      }
    } catch (e) {
      console.log("Sync notice:", e);
      if (showToast) showMobileToast("Loaded offline cache");
    } finally {
      isMobileSyncing = false;
      setTimeout(() => {
        if (icon) icon.classList.remove("is-syncing");
      }, 400);
    }
  }

  // Automatic live background sync: poll every 4 seconds and on focus/visibility change
  setInterval(() => {
    const isModalOpen = document.querySelector(".mobile-modal:not(.hidden), .bottom-sheet:not(.closed), .bottom-sheet-backdrop:not(.closed)");
    if (!isModalOpen) {
      syncFromVault(false);
    }
  }, 4000);

  window.addEventListener("focus", () => syncFromVault(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncFromVault(false);
    }
  });

  // ==========================================
  // 6. VIEW NAVIGATION & MONTH SWITCHER
  // ==========================================
  const HUB_CHILD_TABS = ['viewExpenses', 'viewSubscriptions', 'viewNeedsToPay', 'viewWishlist', 'viewReports'];

  function applyMobileNavConfig() {
    if (!state.navConfig) return;

    // 1. Update top scrollable tab buttons (#topTabsStrip .top-tab-btn[data-tab])
    document.querySelectorAll(".top-tab-btn[data-tab]").forEach(btn => {
      const tabId = btn.getAttribute("data-tab");
      const navId = MOBILE_VIEW_TO_NAV[tabId];
      if (!navId || !state.navConfig[navId]) return;
      const cfg = state.navConfig[navId];

      if (cfg.visible === false) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }

      const label = btn.querySelector("span");
      if (label) {
        label.textContent = cfg.name || cfg.defaultName;
      }

      const existingIcon = btn.querySelector("i, svg");
      if (existingIcon) {
        const newIcon = document.createElement("i");
        newIcon.setAttribute("data-lucide", cfg.icon || cfg.defaultIcon);
        newIcon.className = "w-3.5 h-3.5 shrink-0";
        if (cfg.color) {
          newIcon.style.color = cfg.color;
        }
        existingIcon.replaceWith(newIcon);
      }
    });

    // 2. Update bottom navigation buttons (.mobile-nav-btn[data-tab])
    const SHORT_BOTTOM_LABELS = {
      viewNotes: 'Notes',
      viewProjectFollowup: 'Projects',
      viewBudget: 'Budget',
      viewHub: 'Hub'
    };
    document.querySelectorAll(".mobile-nav-btn[data-tab]").forEach(btn => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId === 'viewHub') return;
      const navId = MOBILE_VIEW_TO_NAV[tabId];
      if (!navId || !state.navConfig[navId]) return;
      const cfg = state.navConfig[navId];

      const label = btn.querySelector("span");
      const shortName = SHORT_BOTTOM_LABELS[tabId] || cfg.name || cfg.defaultName;
      if (label) {
        label.textContent = shortName;
      }
      btn.setAttribute("title", shortName);
      btn.setAttribute("aria-label", shortName);

      const existingIcon = btn.querySelector("i, svg");
      if (existingIcon) {
        const newIcon = document.createElement("i");
        const iconName = cfg.icon || cfg.defaultIcon;
        newIcon.setAttribute("data-lucide", iconName);
        newIcon.className = "w-5 h-5 shrink-0 transition-transform duration-200";
        if (cfg.color) {
          newIcon.style.color = cfg.color;
        }
        existingIcon.replaceWith(newIcon);
      }
    });

    // 3. Update More menu items (#moreMenuSheet .switch-to-tab-btn[data-tab])
    document.querySelectorAll("#moreMenuSheet .switch-to-tab-btn[data-tab]").forEach(btn => {
      const tabId = btn.getAttribute("data-tab");
      const navId = MOBILE_VIEW_TO_NAV[tabId];
      if (!navId || !state.navConfig[navId]) return;
      const cfg = state.navConfig[navId];

      if (cfg.visible === false) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }

      const label = btn.querySelector("span");
      if (label) {
        label.textContent = cfg.name || cfg.defaultName;
      }

      const iconBox = btn.querySelector("div");
      if (iconBox) {
        iconBox.className = "w-9 h-9 rounded-xl flex items-center justify-center shrink-0";
        if (cfg.color) {
          iconBox.style.backgroundColor = cfg.color + "18";
          iconBox.style.color = cfg.color;
          iconBox.style.border = `1px solid ${cfg.color}30`;
        }
        const existingIcon = iconBox.querySelector("i, svg");
        if (existingIcon) {
          const newIcon = document.createElement("i");
          newIcon.setAttribute("data-lucide", cfg.icon || cfg.defaultIcon);
          newIcon.className = "w-4 h-4";
          if (cfg.color) newIcon.style.color = cfg.color;
          existingIcon.replaceWith(newIcon);
        }
      }
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    document.querySelectorAll(".top-tab-btn[data-tab], .mobile-nav-btn[data-tab], #moreMenuSheet .switch-to-tab-btn[data-tab]").forEach(btn => {
      const tabId = btn.getAttribute("data-tab");
      const navId = MOBILE_VIEW_TO_NAV[tabId];
      if (!navId || !state.navConfig[navId]) return;
      const cfg = state.navConfig[navId];
      const iconSvg = btn.querySelector("svg");
      if (iconSvg && cfg.color) {
        iconSvg.style.color = cfg.color;
      }
    });
  }

  function renderHubView() {
    const disp = state.displayCurrency || "EUR";
    const curMonth = (state.selectedMonth && state.selectedMonth !== "ALL") ? state.selectedMonth : new Date().toISOString().slice(0, 7);

    // 1. Transactions (Expenses this month)
    let monthSpent = 0;
    (state.expenses || []).forEach(e => {
      if (e.isIncome || e.category === "Income" || Number(e.amount) < 0) return;
      if (state.selectedMonth === "ALL" || (e.date && e.date.startsWith(curMonth))) {
        monthSpent += convertCurrency(Math.abs(Number(e.amount) || 0), e.currency || "EUR", disp);
      }
    });
    const elExp = document.getElementById("hubStatExpenses");
    if (elExp) elExp.textContent = formatMoney(monthSpent, disp);

    // 2. Calendar & Bills (Monthly Recurring Total)
    const curMonthKey = new Date().toISOString().slice(0, 7);
    let monthlySubTotal = 0;
    (state.subscriptions || []).forEach(s => {
      if (isSubscriptionCountedInMonth(s, curMonthKey)) {
        monthlySubTotal += getSubMonthlyAmount(s, disp);
      }
    });
    const elSub = document.getElementById("hubStatSubscriptions");
    if (elSub) elSub.textContent = formatMoney(monthlySubTotal, disp);

    // 3. Needa Pay (Unpaid Debts + Unpaid Monthly Commitments)
    let totalOwed = 0;
    (state.debts || []).filter(d => !d.isSettled && !d.isPaid).forEach(d => {
      const rem = Math.max(0, (parseFloat(d.amount) || 0) - (parseFloat(d.paidAmount) || 0));
      totalOwed += convertCurrency(rem, d.currency || "EUR", disp);
    });
    const shortfalls = calculateMobileMonthlyShortfalls();
    shortfalls.forEach(s => {
      totalOwed += convertCurrency(s.remainingOwed, s.currency || "EUR", disp);
    });
    const elDebt = document.getElementById("hubStatNeedsToPay");
    if (elDebt) elDebt.textContent = formatMoney(totalOwed, disp);

    // 4. Wishlist (Total Planned Cost)
    let wishTotal = 0;
    (state.wishlist || []).forEach(w => {
      wishTotal += convertCurrency(Number(w.price || w.amount) || 0, w.currency || "EUR", disp);
    });
    const elWish = document.getElementById("hubStatWishlist");
    if (elWish) elWish.textContent = formatMoney(wishTotal, disp);

    // 5. Reports (Total Spent)
    const elRep = document.getElementById("hubStatReports");
    if (elRep) elRep.textContent = formatMoney(monthSpent, disp);
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    try {
      localStorage.setItem('mobile_active_tab', tabId);
      if (window.location.hash !== '#' + tabId) {
        history.replaceState(null, '', '#' + tabId);
      }
    } catch (e) {}
    document.querySelectorAll(".mobile-view").forEach(el => el.classList.add("hidden"));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove("hidden");
    const early = document.getElementById("earlyMobileTabStyle");
    if (early) {
      if (typeof early.remove === 'function') early.remove();
      else if (early.parentNode) early.parentNode.removeChild(early);
    }

    const scrollContainer = document.getElementById("mobileMainScroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // Update bottom nav buttons
    const TAB_ACTIVE_COLORS = {
      viewExpenses: "#10b981",
      viewSubscriptions: "#9333ea",
      viewBudget: "#ec4899",
      viewNeedsToPay: "#ef4444",
      viewProjectFollowup: "#0ea5e9",
      viewWishlist: "#eab308",
      viewNotes: "#d97706",
      viewReports: "#3b82f6",
      viewHub: "#6366f1"
    };

    const isHubChild = HUB_CHILD_TABS.includes(tabId);

    document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
      const btnTabId = btn.getAttribute("data-tab");
      if (!btnTabId) return;
      const match = (btnTabId === tabId) || (btnTabId === "viewHub" && isHubChild);
      btn.classList.toggle("active", match);

      const navId = MOBILE_VIEW_TO_NAV[btnTabId];
      const cfg = (state.navConfig && navId) ? state.navConfig[navId] : null;
      const label = btn.querySelector("span");
      const icon = btn.querySelector("i, svg");

      if (match) {
        btn.classList.remove("text-slate-400");
        btn.classList.add("bg-slate-100");
        const activeColor = (cfg && cfg.color) ? cfg.color : (TAB_ACTIVE_COLORS[btnTabId] || "#0f172a");
        if (label) {
          label.classList.add("font-bold");
          label.classList.remove("font-medium");
          label.style.color = activeColor;
        }
        if (icon) {
          icon.style.color = activeColor;
          icon.style.transform = "none";
        }
      } else {
        btn.classList.add("text-slate-400");
        btn.classList.remove("bg-slate-100");
        if (label) {
          label.classList.remove("font-bold");
          label.classList.add("font-medium");
          label.style.color = "";
        }
        if (icon) {
          icon.style.color = "#94a3b8";
          icon.style.transform = "none";
        }
      }
    });

    // Update Header View Title Badge
    const headerTitleEl = document.getElementById("mobileHeaderViewTitle");
    if (headerTitleEl) {
      const names = {
        viewExpenses: "Transactions",
        viewSubscriptions: "Calendar",
        viewBudget: "Budget",
        viewNeedsToPay: "Needa Pay",
        viewProjectFollowup: "Projects",
        viewWishlist: "Wishlist",
        viewNotes: "Notes",
        viewReports: "Reports",
        viewHub: "Hub"
      };
      headerTitleEl.textContent = names[tabId] || "Finland";
    }

    // Update Secondary Views Sub-Navigation Bar (shown when inside a Hub child view)
    const hubBar = document.getElementById("mobileSecondaryHubBar");
    if (hubBar) {
      hubBar.classList.toggle("hidden", !isHubChild);
      hubBar.querySelectorAll(".hub-sub-tab-btn").forEach(pill => {
        const isCurrent = pill.getAttribute("data-tab") === tabId;
        pill.classList.toggle("active", isCurrent);
      });
    }

    renderActiveView();

    // Toggle FAB based on quickAddFabVisibility preference
    const fabBtn = document.getElementById("mobileFabBtn");
    if (fabBtn) {
      if (state.appPrefs?.quickAddFabVisibility === 'transactions') {
        const isTxTab = (tabId === 'viewExpenses');
        fabBtn.classList.toggle('hidden', !isTxTab);
      } else {
        fabBtn.classList.remove('hidden');
      }
    }
  }

  function setMonth(offset) {
    if (state.selectedMonth === "ALL") {
      const now = new Date();
      state.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    const [y, m] = state.selectedMonth.split("-").map(Number);
    const dt = new Date(y, m - 1 + offset, 1);
    state.selectedMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    updateMonthLabel();
    renderActiveView();
  }

  function updateMonthLabel() {
    const el = document.getElementById("mobileMonthLabel");
    const allBtn = document.getElementById("mobileBudgetAllTimeBtn");
    if (state.selectedMonth === "ALL") {
      if (el) el.textContent = "All Time";
      if (allBtn) {
        allBtn.classList.add("bg-slate-900", "text-white", "font-bold", "border-slate-900");
        allBtn.classList.remove("bg-white", "text-slate-600", "border-slate-200/80");
      }
      return;
    }
    const [y, m] = (state.selectedMonth || "").split("-").map(Number);
    if (!isNaN(y) && !isNaN(m)) {
      const dt = new Date(y, m - 1, 1);
      const label = dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (el) el.textContent = label;
    } else {
      if (el) el.textContent = "All Time";
    }
    if (allBtn) {
      allBtn.classList.remove("bg-slate-900", "text-white", "font-bold", "border-slate-900");
      allBtn.classList.add("bg-white", "text-slate-600", "border-slate-200/80");
    }
  }

  function updateMobileCurrencyButtonsUI() {
    const switcher = document.getElementById("mobileTopCurrencySwitcher");
    if (!switcher) return;
    const activeCurrencies = getActiveDisplayedCurrencies();
    switcher.innerHTML = "";
    activeCurrencies.forEach(cur => {
      const sym = CURRENCY_SYMBOLS[cur] || cur;
      const isActive = (cur === state.displayCurrency);
      const btn = document.createElement("button");
      btn.className = `mobile-curr-btn px-1.5 py-0.5 rounded-lg font-mono text-xs transition-all ${
        isActive 
          ? "active bg-white text-slate-900 shadow-2xs font-bold" 
          : "text-slate-500 hover:text-slate-800"
      }`;
      btn.setAttribute("data-currency", cur);
      btn.textContent = sym;
      btn.title = cur;
      btn.addEventListener("click", () => setCurrency(cur));
      switcher.appendChild(btn);
    });
  }

  function setCurrency(cur) {
    state.displayCurrency = cur;
    localStorage.setItem(STORAGE_KEYS.DISPLAY_CURRENCY, cur);
    updateMobileCurrencyButtonsUI();
    renderActiveView();
    pushToVault();
  }

  // ==========================================
  // 7. EXPENSES RENDER ENGINE & RECEIVED PAYMENTS
  // ==========================================
  function getAllReceivedPayments() {
    const list = [];
    const projects = (state.budget && Array.isArray(state.budget.projects)) ? state.budget.projects : [];
    projects.forEach(p => {
      const displayTitle = p.client ? `${p.client} – ${p.title || 'Project'}` : (p.title || 'Freelance Project');
      if (Array.isArray(p.payments) && p.payments.length > 0) {
        p.payments.forEach((pay, idx) => {
          list.push({
            id: pay.id || `proj_pay_${p.id}_${idx}`,
            title: displayTitle,
            amount: parseFloat(pay.amount) || 0,
            currency: pay.currency || p.currency || 'EUR',
            category: 'Income',
            date: pay.date || p.paidDate || p.dueDate || '',
            paymentMethod: pay.method || 'Bank Transfer',
            notes: pay.notes || (p.invoiceNumber ? `Invoice: ${p.invoiceNumber}${p.receiptNumber ? ` | Receipt: ${p.receiptNumber}` : ''}` : (p.receiptNumber ? `Receipt: ${p.receiptNumber}` : 'Freelance Project Payment')),
            isIncome: true,
            isProjectPayment: true,
            projectId: p.id,
            paymentId: pay.id,
            hasAttachment: !!(p.hasInvoiceDoc || p.hasReceiptDoc),
            attachmentFileName: p.invoiceDocName || p.receiptDocName || ''
          });
        });
      } else if (p.status === 'paid') {
        const amt = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
        if (amt > 0) {
          list.push({
            id: `proj_paid_${p.id}`,
            title: displayTitle,
            amount: amt,
            currency: p.currency || 'EUR',
            category: 'Income',
            date: p.paidDate || p.dueDate || '',
            paymentMethod: 'Bank Transfer',
            notes: p.notes || (p.invoiceNumber ? `Invoice: ${p.invoiceNumber}${p.receiptNumber ? ` | Receipt: ${p.receiptNumber}` : ''}` : (p.receiptNumber ? `Receipt: ${p.receiptNumber}` : 'Freelance Project Payment')),
            isIncome: true,
            isProjectPayment: true,
            projectId: p.id,
            hasAttachment: !!(p.hasInvoiceDoc || p.hasReceiptDoc),
            attachmentFileName: p.invoiceDocName || p.receiptDocName || ''
          });
        }
      }
    });

    const directIncomes = (state.budget && Array.isArray(state.budget.incomes)) ? state.budget.incomes : [];
    const todayStr = new Date().toISOString().split('T')[0];
    directIncomes.forEach((inc, idx) => {
      const isExpected = inc.status === 'expected' || inc.status === 'pending' || (inc.status !== 'received' && inc.date && inc.date > todayStr);
      if (isExpected) return;
      list.push({
        id: inc.id || `inc_${idx}`,
        title: inc.title || inc.source || inc.client || 'Received Payment',
        amount: parseFloat(inc.amount) || 0,
        currency: inc.currency || state.displayCurrency || 'EUR',
        category: 'Income',
        date: inc.date || '',
        paymentMethod: inc.method || inc.paymentMethod || 'Bank Transfer',
        notes: inc.notes || '',
        isIncome: true,
        isDirectIncome: true,
        incomeId: inc.id,
        hasAttachment: false
      });
    });

    return list;
  }

  function renderExpensesView() {
    updateMobileCategoryFilterOptions();
    updateMobileExpenseCategoryOptions();

    const isAllTime = (state.selectedMonth === "ALL");
    const allReceived = getAllReceivedPayments();
    const allTx = [...state.expenses, ...allReceived];

    const monthItems = allTx.filter(e => {
      if (isAllTime) return true;
      const expDate = e.date || "";
      return expDate.startsWith(state.selectedMonth);
    });

    // Summary calculations
    let totalSpend = 0;
    let maxExpense = 0;
    let missingReceiptCount = 0;
    let businessCount = 0;
    let incomeCount = 0;
    let totalIncome = 0;

    monthItems.forEach(e => {
      const amtInActive = convertCurrency(e.amount, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
      if (e.isIncome) {
        incomeCount++;
        totalIncome += amtInActive;
      } else {
        totalSpend += amtInActive;
        if (amtInActive > maxExpense) maxExpense = amtInActive;

        const isBusiness = !!e.isBusiness;
        if (isBusiness) businessCount++;
        const hasReceipt = !!e.hasAttachment || !!e.receiptImage || !!e.receiptId;
        const isWaived = !isBusiness && !!e.noReceiptNeeded;
        if (!hasReceipt && !isWaived) missingReceiptCount++;
      }
    });

    const expenseOnlyCount = monthItems.filter(e => !e.isIncome).length;
    const avgExpense = expenseOnlyCount > 0 ? (totalSpend / expenseOnlyCount) : 0;

    // Update Summary Card
    const elTotal = document.getElementById("mobileTotalSpendPrimary");
    const elEquiv = document.getElementById("mobileTotalSpendEquiv");
    const elTxCount = document.getElementById("mobileExpenseTxCountBadge");
    const elMax = document.getElementById("mobileLargestExpense");
    const elAvg = document.getElementById("mobileAverageExpense");
    const elMissingBadge = document.getElementById("mobileMissingBadge");
    const elBizBadge = document.getElementById("mobileBusinessBadge");
    const elIncomeBadge = document.getElementById("mobileIncomeBadge");

    if (elTotal) elTotal.textContent = formatMoney(totalSpend);
    if (elEquiv) elEquiv.textContent = formatTriEquiv(totalSpend);
    if (elTxCount) elTxCount.textContent = `${expenseOnlyCount} tx`;
    if (elMax) elMax.textContent = formatMoney(maxExpense);
    if (elAvg) elAvg.textContent = formatMoney(avgExpense);
    if (elMissingBadge) elMissingBadge.textContent = missingReceiptCount;
    if (elBizBadge) elBizBadge.textContent = businessCount;
    if (elIncomeBadge) elIncomeBadge.textContent = incomeCount;

    // Filter & Sort
    let filtered = monthItems.filter(e => {
      // Search
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchTitle = (e.title || "").toLowerCase().includes(q);
        const matchCat = (e.category || "").toLowerCase().includes(q);
        const matchNotes = (e.notes || "").toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchNotes) return false;
      }

      // Filter Pill
      const hasReceipt = !!e.hasAttachment || !!e.receiptImage || !!e.receiptId;
      const isWaived = !e.isBusiness && !e.isIncome && !!e.noReceiptNeeded;

      if (state.filter === "income") return !!e.isIncome;
      if (e.isIncome) return false; // For other expense filters, exclude income

      if (state.filter === "missing_receipts") return !hasReceipt && !isWaived;
      if (state.filter === "business") return !!e.isBusiness;
      if (state.filter === "subscriptions") return !!e.isSubscription || e.category === "Subscriptions";
      if (state.filter === "onetime") return !e.isSubscription && e.category !== "Subscriptions";
      if (state.filter === "receipts") return hasReceipt;
      return true;
    });

    if (state.categoryFilter !== "ALL") {
      if (state.categoryFilter === "Income") {
        filtered = filtered.filter(e => e.isIncome);
      } else {
        filtered = filtered.filter(e => !e.isIncome && e.category === state.categoryFilter);
      }
    }

    filtered.sort((a, b) => {
      if (state.sort === "date-desc") return (b.date || "").localeCompare(a.date || "");
      if (state.sort === "date-asc") return (a.date || "").localeCompare(b.date || "");
      if (state.sort === "amount-desc") {
        const valA = convertCurrency(a.amount, a.currency || state.displayCurrency || "EUR", state.displayCurrency);
        const valB = convertCurrency(b.amount, b.currency || state.displayCurrency || "EUR", state.displayCurrency);
        return valB - valA;
      }
      if (state.sort === "amount-asc") {
        const valA = convertCurrency(a.amount, a.currency || state.displayCurrency || "EUR", state.displayCurrency);
        const valB = convertCurrency(b.amount, b.currency || state.displayCurrency || "EUR", state.displayCurrency);
        return valA - valB;
      }
      if (state.sort === "provider-asc") return (a.title || "").localeCompare(b.title || "");
      return 0;
    });

    const feed = document.getElementById("mobileTransactionsFeed");
    const empty = document.getElementById("mobileExpensesEmpty");

    if (!feed) return;
    feed.innerHTML = "";

    if (filtered.length === 0) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    const fragment = document.createDocumentFragment();

    // Group by Date
    const groups = {};
    filtered.forEach(e => {
      const d = e.date || "Unknown";
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    });

    const groupKeys = Object.keys(groups);
    if (state.sort === "date-asc") {
      groupKeys.sort((a, b) => {
        if (a === "Unknown") return 1;
        if (b === "Unknown") return -1;
        return a.localeCompare(b);
      });
    } else if (state.sort === "date-desc") {
      groupKeys.sort((a, b) => {
        if (a === "Unknown") return 1;
        if (b === "Unknown") return -1;
        return b.localeCompare(a);
      });
    }

    groupKeys.forEach(dateStr => {
      const dateHeader = document.createElement("div");
      dateHeader.className = "flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-3 pb-1";
      
      let headerText = dateStr;
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const now = new Date();
        const isToday = (dObj.toDateString() === now.toDateString());
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = (dObj.toDateString() === yesterday.toDateString());
        if (isToday) headerText = "Today";
        else if (isYesterday) headerText = "Yesterday";
        else headerText = dObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      }

      let dayTotal = 0;
      groups[dateStr].forEach(item => {
        if (!item.isIncome) {
          dayTotal += convertCurrency(item.amount, item.currency || state.displayCurrency || "EUR", state.displayCurrency);
        }
      });

      dateHeader.innerHTML = `
        <span>${headerText}</span>
        ${dayTotal > 0 ? `<span class="font-mono font-semibold text-slate-400 text-[10px] tracking-normal">${formatMoney(dayTotal)}</span>` : ''}
      `;
      fragment.appendChild(dateHeader);

      const dayCard = document.createElement("div");
      dayCard.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs overflow-hidden divide-y divide-slate-100/90";

      groups[dateStr].forEach(exp => {
        const isIncome = !!exp.isIncome;
        const amtInActive = convertCurrency(exp.amount, exp.currency || state.displayCurrency || "EUR", state.displayCurrency);
        const catColor = isIncome ? '#059669' : getCategoryColor(exp.category);

        const row = document.createElement("div");
        row.className = "px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors tap-bounce cursor-pointer";
        row.setAttribute("data-id", exp.id);

        const amtDisplay = isIncome
          ? `<div class="font-mono font-bold text-sm text-emerald-600">+${formatMoney(amtInActive)}</div>`
          : `<div class="font-mono font-bold text-sm text-slate-900">${formatMoney(amtInActive)}</div>`;

        row.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${catColor};"></span>
            <div class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(exp.title || (isIncome ? "Payment" : "Expense"))}</div>
          </div>
          <div class="text-right shrink-0">
            ${amtDisplay}
          </div>
        `;

        row.addEventListener("click", () => {
          if (exp.isIncome) {
            if (exp.projectId) {
              openEditProjectSheet(exp.projectId);
            }
          } else {
            openEditExpenseSheet(exp.id);
          }
        });

        dayCard.appendChild(row);
      });

      fragment.appendChild(dayCard);
    });

    feed.appendChild(fragment);
    refreshIcons(feed);
  }

  function getCategoryIcon(cat) {
    if (state && state.budget && Array.isArray(state.budget.categories)) {
      const match = state.budget.categories.find(c => (c.name || '').toLowerCase() === (cat || '').toLowerCase());
      if (match && match.icon) return match.icon;
    }
    const map = {
      Groceries: "shopping-cart",
      "Groceries & Essentials": "shopping-cart",
      Dining: "utensils",
      Outings: "utensils",
      Subscriptions: "calendar-clock",
      Shopping: "shopping-bag",
      Transport: "car",
      Entertainment: "ticket",
      Health: "activity",
      Travel: "plane",
      Housing: "home",
      Utilities: "zap",
      "Digital Utilities": "laptop",
      Other: "tag"
    };
    return map[cat] || "tag";
  }

  function getCategoryColor(cat) {
    if (state && state.budget && Array.isArray(state.budget.categories)) {
      const match = state.budget.categories.find(c => (c.name || '').toLowerCase() === (cat || '').toLowerCase());
      if (match && match.color) return match.color;
    }
    return CATEGORY_COLORS[cat] || "#475569";
  }

  function getCategoryEmoji(cat) {
    const map = {
      Groceries: "🛒",
      "Groceries & Essentials": "🛒",
      Dining: "🍽️",
      Outings: "🍽️",
      Subscriptions: "📱",
      Shopping: "🛍️",
      Transport: "🚗",
      Health: "💊",
      Housing: "🏠",
      Utilities: "💡",
      "Digital Utilities": "💻",
      Entertainment: "🎟️",
      Travel: "✈️",
      Other: "📦"
    };
    return map[cat] || "🏷️";
  }

  function updateMobileCategoryFilterOptions() {
    const sel = document.getElementById("mobileFilterCategory");
    if (!sel) return;
    const currentVal = state.categoryFilter || "ALL";
    const available = new Set();
    (state.budget.categories || []).forEach(c => { if (c.name) available.add(c.name); });
    (state.expenses || []).forEach(e => { if (e.category) available.add(e.category); });

    const sorted = Array.from(available).sort();
    sel.innerHTML = '<option value="ALL">All Categories</option>';
    sorted.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${getCategoryEmoji(cat)} ${cat}`;
      if (cat === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function updateMobileExpenseCategoryOptions() {
    const sel = document.getElementById("mobileExpenseCategory");
    if (!sel) return;
    const currentVal = sel.value || "";
    const available = new Set();
    (state.budget.categories || []).forEach(c => { if (c.name) available.add(c.name); });
    (state.expenses || []).forEach(e => { if (e.category) available.add(e.category); });

    if (available.size === 0) return;
    const sorted = Array.from(available).sort();
    sel.innerHTML = "";
    sorted.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${getCategoryEmoji(cat)} ${cat}`;
      if (cat === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ==========================================
  // 8. BUDGET & CASH FLOW RENDER ENGINE
  // ==========================================
  function getMobileActiveBudgetMonthsList(monthKey) {
    if (monthKey && monthKey !== "ALL" && monthKey !== "all") {
      return [monthKey];
    }
    const monthsSet = new Set();
    (state.expenses || []).forEach(e => {
      if (e && e.date && e.date.length >= 7) monthsSet.add(e.date.slice(0, 7));
    });
    (state.budget && state.budget.incomes || []).forEach(inc => {
      if (inc && inc.date && inc.date.length >= 7) monthsSet.add(inc.date.slice(0, 7));
    });
    (state.budget && state.budget.projects || []).forEach(p => {
      if (!p) return;
      const pd = getProjectPaidDate(p);
      if (pd && pd.length >= 7) monthsSet.add(pd.slice(0, 7));
      if (p.dueDate && p.dueDate.length >= 7) monthsSet.add(p.dueDate.slice(0, 7));
      if (Array.isArray(p.payments)) {
        p.payments.forEach(pay => {
          if (pay && pay.date && pay.date.length >= 7) monthsSet.add(pay.date.slice(0, 7));
        });
      }
    });
    (state.budget && state.budget.leads || []).forEach(l => {
      if (!l) return;
      if (l.createdAt && l.createdAt.length >= 7) monthsSet.add(l.createdAt.slice(0, 7));
      if (l.statusDate && l.statusDate.length >= 7) monthsSet.add(l.statusDate.slice(0, 7));
      if (l.targetDate && l.targetDate.length >= 7) monthsSet.add(l.targetDate.slice(0, 7));
    });
    if (monthsSet.size === 0) {
      monthsSet.add(new Date().toISOString().slice(0, 7));
    }
    return Array.from(monthsSet);
  }

  function renderBudgetView() {
    const projects = state.budget.projects || [];
    const curTax = (state.budget && state.budget.taxReservePercent !== undefined && state.budget.taxReservePercent !== null)
      ? parseInt(state.budget.taxReservePercent, 10)
      : 0;
    const taxRate = isNaN(curTax) ? 0 : Math.max(0, curTax);
    const isAllTime = (!state.selectedMonth || state.selectedMonth === "ALL" || state.selectedMonth === "all");
    const monthKey = state.selectedMonth || new Date().toISOString().slice(0, 7);

    // 1. Calculate Collected Income In-Hand
    let projectCollected = 0;
    let miscCollected = 0;
    let pendingReceivables = 0;
    let pendingCount = 0;

    projects.forEach(p => {
      const totalFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
      const feeInActive = convertCurrency(totalFee, p.currency || "EUR", state.displayCurrency);
      const paidInActive = convertCurrency(parseFloat(p.paidAmount) || 0, p.currency || "EUR", state.displayCurrency);

      if (Array.isArray(p.payments) && p.payments.length > 0) {
        p.payments.forEach(pay => {
          if (isAllTime || (pay.date && pay.date.startsWith(monthKey))) {
            projectCollected += convertCurrency(parseFloat(pay.amount) || 0, pay.currency || p.currency || "EUR", state.displayCurrency);
          }
        });
      } else if (p.status === "paid") {
        const pd = getProjectPaidDate(p);
        if (isAllTime || (pd && pd.startsWith(monthKey))) {
          projectCollected += feeInActive;
        }
      } else if (parseFloat(p.paidAmount) > 0) {
        const pd = getProjectPaidDate(p);
        if (isAllTime || (pd && pd.startsWith(monthKey))) {
          projectCollected += paidInActive;
        }
      }

      const remaining = Math.max(0, feeInActive - paidInActive);
      if (remaining > 0 && p.status !== "paid") {
        if (projectMatchesMonth(p, monthKey)) {
          pendingReceivables += remaining;
          pendingCount++;
        }
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    (state.budget.incomes || []).forEach(inc => {
      const isExpected = inc.status === 'expected' || inc.status === 'pending' || (inc.status !== 'received' && inc.date && inc.date > todayStr);
      if (isAllTime || (inc.date && inc.date.startsWith(monthKey))) {
        const amt = convertCurrency(parseFloat(inc.amount) || 0, inc.currency || "EUR", state.displayCurrency);
        if (isExpected) {
          pendingReceivables += amt;
          pendingCount++;
        } else {
          miscCollected += amt;
        }
      }
    });

    // Check any direct incomes in state.expenses
    (state.expenses || []).forEach(exp => {
      if (exp && (exp.isIncome || exp.category === 'Income' || exp.type === 'income')) {
        if (exp.isDirectIncome || exp.isProjectPayment) return;
        if (isAllTime || (exp.date && exp.date.startsWith(monthKey))) {
          miscCollected += convertCurrency(parseFloat(exp.amount) || 0, exp.currency || "EUR", state.displayCurrency);
        }
      }
    });

    const collectedIncome = projectCollected + miscCollected;

    // 2. Fixed Bills & Subscriptions (including one-off FIXED_CATEGORIES expenses)
    let fixedBillsTotal = 0;
    const activeMonths = getMobileActiveBudgetMonthsList(monthKey);
    activeMonths.forEach(mKey => {
      (state.subscriptions || []).forEach(s => {
        if (!isSubscriptionCountedInMonth(s, mKey)) return;
        fixedBillsTotal += getSubMonthlyAmount(s, state.displayCurrency);
      });
    });

    (state.expenses || []).forEach(exp => {
      if (!exp || exp.isSubscription || exp.isIncome || exp.type === 'income' || exp.category === 'Income') return;
      if (!FIXED_CATEGORIES.includes(exp.category)) return;
      if (!exp.date || (!isAllTime && !exp.date.startsWith(monthKey))) return;
      fixedBillsTotal += convertCurrency(parseFloat(exp.amount) || 0, exp.currency || state.displayCurrency || "EUR", state.displayCurrency);
    });

    // Tax Buffer
    const taxBuffer = (collectedIncome * (taxRate / 100));
    const billsAndTax = fixedBillsTotal + taxBuffer;

    // Living Expenses & Category Budgets this month (excludes recurring bills and direct incomes)
    let livingSpend = 0;
    const categorySpendMap = {};
    state.expenses.filter(e => (isAllTime || (e.date || "").startsWith(monthKey)) && isFlexibleExpense(e)).forEach(e => {
      const amt = convertCurrency(parseFloat(e.amount) || 0, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
      livingSpend += amt;
      const catKey = (e.category || "Other").toLowerCase().trim();
      categorySpendMap[catKey] = (categorySpendMap[catKey] || 0) + amt;
    });

    const configuredCategories = state.budget.categories || DEFAULT_BUDGET_CATEGORIES;
    const monthsMultiplier = isAllTime ? Math.max(1, activeMonths.length) : 1;
    let totalBudgetLimit = 0;
    let totalSpentInBudgeted = 0;
    const seenCats = new Set();
    configuredCategories.forEach(catObj => {
      const cat = catObj.name;
      if (!cat) return;
      const catKey = cat.toLowerCase().trim();
      if (seenCats.has(catKey)) return;
      seenCats.add(catKey);
      const rawLimit = (catObj.limit !== undefined && parseFloat(catObj.limit) > 0)
        ? parseFloat(catObj.limit)
        : ((state.budget.categoryBudgets && state.budget.categoryBudgets[cat] > 0) ? parseFloat(state.budget.categoryBudgets[cat]) : 0);
      const limitCurrency = catObj.currency || state.budget.incomeCurrency || "EUR";
      const targetBudget = rawLimit > 0 ? convertCurrency(rawLimit, limitCurrency, state.displayCurrency) * monthsMultiplier : 0;
      if (targetBudget > 0) {
        totalBudgetLimit += targetBudget;
        totalSpentInBudgeted += (categorySpendMap[catKey] || 0);
      }
    });

    const reservedForBudgeted = Math.max(totalBudgetLimit, totalSpentInBudgeted);
    const unbudgetedSpent = Math.max(0, livingSpend - totalSpentInBudgeted);
    const categoryBudgetDeduction = totalBudgetLimit > 0
      ? (reservedForBudgeted + unbudgetedSpent)
      : livingSpend;

    const safeLeft = collectedIncome - billsAndTax - categoryBudgetDeduction;

    // Days remaining in selected month
    const today = new Date();
    const curYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    let daysLeft = 0;
    if (!isAllTime) {
      const [y, m] = monthKey.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      if (monthKey === curYearMonth) {
        daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
      } else if (monthKey > curYearMonth) {
        daysLeft = daysInMonth;
      }
    }
    const dailySafeBurn = (daysLeft > 0 && safeLeft > 0) ? (safeLeft / daysLeft) : 0;

    // Update DOM Metrics
    const elIncome = document.getElementById("mobileBudgetIncomePrimary");
    const elIncomeEquiv = document.getElementById("mobileBudgetIncomeEquiv");
    const elPending = document.getElementById("mobileBudgetPendingPrimary");
    const elPendingEquiv = document.getElementById("mobileBudgetPendingEquiv");
    const elFixed = document.getElementById("mobileBudgetFixedPrimary");
    const elTaxBadge = document.getElementById("mobileBudgetTaxRateTag");
    const elLeft = document.getElementById("mobileBudgetLeftPrimary");
    const elDaily = document.getElementById("mobileBudgetDailySafeBurn");

    if (elIncome) elIncome.textContent = formatMoney(collectedIncome);
    if (elIncomeEquiv) elIncomeEquiv.textContent = `Proj ${formatMoney(projectCollected)} • Misc ${formatMoney(miscCollected)}`;
    if (elPending) elPending.textContent = formatMoney(pendingReceivables);
    if (elPendingEquiv) elPendingEquiv.textContent = `Total w/ paid: ${formatMoney(collectedIncome + pendingReceivables)}`;
    if (elFixed) elFixed.textContent = formatMoney(billsAndTax);
    if (elTaxBadge) elTaxBadge.textContent = `${taxRate}% Tax`;
    if (elLeft) {
      elLeft.textContent = formatMoney(safeLeft);
      elLeft.className = `text-3xl font-black font-mono tracking-tight mt-0.5 ${safeLeft < 0 ? 'text-rose-600' : 'text-slate-900'}`;
    }
    const leftTag = document.getElementById("mobileBudgetLeftTag");
    if (leftTag) {
      if (safeLeft < 0) {
        leftTag.textContent = "Deficit";
        leftTag.className = "text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60";
      } else {
        leftTag.textContent = "In Hand";
        leftTag.className = "text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60";
      }
    }
    if (elDaily) {
      if (daysLeft > 0 && safeLeft > 0) {
        elDaily.textContent = `≈ ${formatMoney(dailySafeBurn)}/day (${daysLeft}d left)`;
      } else if (pendingReceivables > 0) {
        const projectedCollected = collectedIncome + pendingReceivables;
        const projectedTax = projectedCollected * (taxRate / 100);
        const projectedLeft = projectedCollected - (fixedBillsTotal + projectedTax) - categoryBudgetDeduction;
        elDaily.textContent = `If invoices clear: ${formatMoney(projectedLeft)}`;
      } else {
        elDaily.textContent = formatTriEquiv(safeLeft);
      }
    }

    // Cash flow split bar
    const flowBar = document.getElementById("mobileBudgetFlowBar");
    const flowText = document.getElementById("mobileBudgetFlowText");
    const runwayText = document.getElementById("mobileBudgetRunwayText");

    if (flowBar) {
      flowBar.innerHTML = "";
      if (collectedIncome > 0) {
        const totalObligations = fixedBillsTotal + taxBuffer + categoryBudgetDeduction;
        const denom = safeLeft < 0 && totalObligations > 0 ? totalObligations : collectedIncome;
        const pBills = Math.min(100, (fixedBillsTotal / denom) * 100);
        const pTax = Math.min(100 - pBills, (taxBuffer / denom) * 100);
        const pSpent = Math.min(100 - pBills - pTax, (categoryBudgetDeduction / denom) * 100);
        const pSafe = safeLeft > 0 ? Math.max(0, 100 - pBills - pTax - pSpent) : 0;

        flowBar.innerHTML = `
          <div style="width: ${pBills}%;" class="bg-purple-500 h-full" title="Bills"></div>
          <div style="width: ${pTax}%;" class="bg-slate-400 h-full" title="Tax Buffer"></div>
          <div style="width: ${pSpent}%;" class="bg-rose-400 h-full" title="Category Budget"></div>
          <div style="width: ${pSafe}%;" class="bg-emerald-500 h-full" title="Safe Left"></div>
        `;
        const billsPct = Math.round((fixedBillsTotal / collectedIncome) * 100);
        const taxPct = Math.round((taxBuffer / collectedIncome) * 100);
        if (flowText) {
          flowText.textContent = safeLeft < 0
            ? `Bills: ${billsPct}% • Tax: ${taxPct}% • Deficit: -${formatMoney(Math.abs(safeLeft))}`
            : `Bills: ${billsPct}% • Tax: ${taxPct}% • Safe: ${pSafe.toFixed(0)}%`;
        }
      } else {
        flowBar.innerHTML = `<div class="w-full bg-slate-200 h-full"></div>`;
        if (flowText) flowText.textContent = "Awaiting client deposits";
      }
      if (runwayText) {
        runwayText.textContent = safeLeft > 0 && daysLeft > 0 ? `Safe burn: ${formatMoney(dailySafeBurn)}/day` : "Baseline survival mode";
      }
    }

    // Render Freelance Projects
    renderFreelanceProjectsFeed();

    // Render Everyday Living Categories
    renderCategoryBudgetsFeed(livingSpend);
  }

  function renderFreelanceProjectsFeed() {
    const list = document.getElementById("mobileFreelanceProjectsList");
    const countBadge = document.getElementById("mobileBudgetProjectsCount");
    if (!list) return;

    let projects = (state.budget.projects || []).filter(p => projectMatchesMonth(p, state.selectedMonth));
    if (countBadge) countBadge.textContent = projects.length;

    if (state.projectFilter === "pending") {
      projects = projects.filter(p => {
        const fee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
        return p.status !== "paid" && (parseFloat(p.paidAmount) || 0) < fee;
      });
    } else if (state.projectFilter === "paid") {
      projects = projects.filter(p => {
        const fee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
        return p.status === "paid" || ((parseFloat(p.paidAmount) || 0) >= fee && fee > 0);
      });
    }

    list.innerHTML = "";
    if (projects.length === 0) {
      let periodLabel = "this month";
      if (state.selectedMonth === "ALL") {
        periodLabel = "all time";
      } else if (state.selectedMonth) {
        const [y, m] = state.selectedMonth.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          periodLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        }
      }
      list.innerHTML = `
        <div class="py-6 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 p-4">
          <p class="text-xs">No projects for ${escapeHtml(periodLabel)}.</p>
        </div>
      `;
      return;
    }

    const cardBox = document.createElement("div");
    cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";

    projects.forEach(p => {
      const totalFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
      const feeInActive = convertCurrency(totalFee, p.currency || "EUR", state.displayCurrency);
      const paidInActive = convertCurrency(parseFloat(p.paidAmount) || 0, p.currency || "EUR", state.displayCurrency);
      const isPaid = p.status === 'paid' || (paidInActive >= feeInActive && feeInActive > 0);
      const dotColor = isPaid ? "#10b981" : "#0ea5e9";
      const rowTitle = p.client && p.title ? `${p.client} — ${p.title}` : (p.client || p.title || p.description || "Project");

      const row = document.createElement("div");
      row.className = "px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors tap-bounce cursor-pointer";
      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${dotColor};"></span>
          <div class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(rowTitle)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono font-bold text-sm ${isPaid ? 'text-emerald-600' : 'text-slate-900'}">${formatMoney(feeInActive)}</div>
        </div>
      `;
      row.addEventListener("click", () => openEditProjectSheet(p.id));
      cardBox.appendChild(row);
    });

    list.appendChild(cardBox);
  }

  function renderCategoryBudgetsFeed(livingSpend) {
    const list = document.getElementById("mobileCategoryBudgetsList");
    const countBadge = document.getElementById("mobileCategoryCountHeader");
    if (!list) return;

    const categories = state.budget.categories || DEFAULT_BUDGET_CATEGORIES;
    if (countBadge) countBadge.textContent = categories.length;

    list.innerHTML = "";

    // Calculate flexible spend per category (excludes recurring subscriptions and fixed bills)
    const isAllTime = (!state.selectedMonth || state.selectedMonth === "ALL" || state.selectedMonth === "all");
    const monthsMultiplier = isAllTime ? Math.max(1, getMobileActiveBudgetMonthsList(state.selectedMonth).length) : 1;
    const categorySpend = {};
    state.expenses.filter(e => isFlexibleExpense(e) && (isAllTime || (e.date || "").startsWith(state.selectedMonth))).forEach(e => {
      const cat = (e.category || "Other").toLowerCase().trim();
      const amt = convertCurrency(parseFloat(e.amount) || 0, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
      categorySpend[cat] = (categorySpend[cat] || 0) + amt;
    });

    const cardBox = document.createElement("div");
    cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";

    categories.forEach(c => {
      const catKey = (c.name || "").toLowerCase().trim();
      const spent = categorySpend[catKey] || 0;
      const catColor = getCategoryColor(c.name);
      const rawLimit = (c.limit !== undefined && parseFloat(c.limit) > 0)
        ? parseFloat(c.limit)
        : ((state.budget.categoryBudgets && state.budget.categoryBudgets[c.name] > 0) ? parseFloat(state.budget.categoryBudgets[c.name]) : 0);
      const limitCurrency = c.currency || state.budget.incomeCurrency || "EUR";
      const targetBudget = rawLimit > 0 ? convertCurrency(rawLimit, limitCurrency, state.displayCurrency) * monthsMultiplier : 0;

      const row = document.createElement("div");
      row.className = "px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors tap-bounce cursor-pointer";
      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${catColor};"></span>
          <span class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(c.name)}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-mono font-bold text-sm ${targetBudget > 0 && spent > targetBudget ? 'text-rose-600' : 'text-slate-900'}">${formatMoney(spent)}</span>
          ${targetBudget > 0 ? `<span class="text-[11px] font-mono text-slate-400"> / ${formatMoney(targetBudget)}</span>` : ''}
        </div>
      `;
      row.addEventListener("click", () => openCategoryPurchasesSheet(c.name));
      cardBox.appendChild(row);
    });

    list.appendChild(cardBox);
  }

  // ==========================================
  // 9. NEEDA PAY RENDER ENGINE
  // ==========================================
  function calculateMobileMonthlyShortfalls() {
    const primaryCur = state.displayCurrency;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentYearMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

    const shortfalls = [];
    (state.subscriptions || []).forEach(sub => {
      if (sub.isFrozen && !isSubscriptionPaidInMonth(sub, currentYearMonth)) {
        return;
      }
      const normSubName = normalizeServiceName(sub.name);
      const paidThisMonthExpenses = (state.expenses || []).filter(e => {
        if (!e.date || !e.date.startsWith(currentYearMonth)) return false;
        if (e.subscriptionId || e.generatedFromSubId) {
          return (e.subscriptionId === sub.id || e.generatedFromSubId === sub.id);
        }
        const normExpName = normalizeServiceName(e.title || '');
        if (normSubName && normExpName && normExpName === normSubName) return true;
        if (e.title && sub.name && e.title.trim().toLowerCase() === sub.name.trim().toLowerCase()) return true;
        return false;
      });

      let paidInSubCur = 0;
      paidThisMonthExpenses.forEach(e => {
        paidInSubCur += convertCurrency(e.amount || 0, e.currency || 'EUR', sub.currency || 'EUR');
      });

      const rawAmt = parseFloat(sub.amount) || 0;
      const expectedAmount = sub.billingCycle === 'yearly' ? (rawAmt / 12) : rawAmt;
      const remainingOwedInSubCur = expectedAmount - paidInSubCur;

      if (remainingOwedInSubCur > 0.01) {
        shortfalls.push({
          subscriptionId: sub.id,
          name: sub.name,
          category: sub.category || 'Housing',
          currency: sub.currency || 'EUR',
          expectedAmount: expectedAmount,
          paidAmount: paidInSubCur,
          remainingOwed: remainingOwedInSubCur,
          billingCycle: sub.billingCycle || 'monthly'
        });
      }
    });
    return shortfalls;
  }

  function renderNeedsToPayView() {
    const debts = state.debts || [];
    const unpaidDebts = debts.filter(d => !d.isSettled && !d.isPaid);
    const shortfalls = calculateMobileMonthlyShortfalls();

    let totalDebts = 0;
    unpaidDebts.forEach(d => {
      const origAmt = parseFloat(d.amount) || 0;
      const paidAmt = parseFloat(d.paidAmount) || 0;
      const rem = Math.max(0, origAmt - paidAmt);
      totalDebts += convertCurrency(rem, d.currency || "EUR", state.displayCurrency);
    });

    let totalMonthlyBills = 0;
    shortfalls.forEach(s => {
      totalMonthlyBills += convertCurrency(s.remainingOwed, s.currency, state.displayCurrency);
    });

    const totalUnpaid = totalDebts + totalMonthlyBills;

    const elTotal = document.getElementById("mobileNeedsTotalPrimary");
    const elTotalEquiv = document.getElementById("mobileNeedsTotalEquiv");
    const elDebts = document.getElementById("mobileNeedsDebtsPrimary");
    const elBills = document.getElementById("mobileNeedsBillsPrimary");
    const debtsCountBadge = document.getElementById("mobileStandaloneDebtsCount");
    const billsCountBadge = document.getElementById("mobileMonthlyBillsCount");

    if (elTotal) elTotal.textContent = formatMoney(totalUnpaid);
    if (elTotalEquiv) elTotalEquiv.textContent = formatTriEquiv(totalUnpaid);
    if (elDebts) elDebts.textContent = formatMoney(totalDebts);
    if (elBills) elBills.textContent = formatMoney(totalMonthlyBills);
    if (debtsCountBadge) debtsCountBadge.textContent = unpaidDebts.length;
    if (billsCountBadge) billsCountBadge.textContent = shortfalls.length;

    const debtsSubtotalEl = document.getElementById("mobileStandaloneDebtsSubtotal");
    if (debtsSubtotalEl) debtsSubtotalEl.textContent = `${formatMoney(totalDebts)} needed`;

    const billsSubtotalEl = document.getElementById("mobileMonthlyBillsSubtotal");
    if (billsSubtotalEl) billsSubtotalEl.textContent = `${formatMoney(totalMonthlyBills)} needed`;

    const emptyNeedsEl = document.getElementById("mobileNeedsToPayEmpty");
    if (emptyNeedsEl) {
      if (unpaidDebts.length === 0 && shortfalls.length === 0) {
        emptyNeedsEl.classList.remove("hidden");
      } else {
        emptyNeedsEl.classList.add("hidden");
      }
    }

    // Render Past Debts List
    const debtsList = document.getElementById("mobileStandaloneDebtsList");
    if (debtsList) {
      debtsList.innerHTML = "";
      if (unpaidDebts.length === 0) {
        debtsList.innerHTML = `<div class="py-6 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-4 text-xs">All past debts cleared! 🎉</div>`;
      } else {
        const cardBox = document.createElement("div");
        cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
        const todayStr = new Date().toISOString().split("T")[0];
        unpaidDebts.forEach(d => {
          const debtTitle = d.title || d.name || "Debt";
          const origAmt = parseFloat(d.amount) || 0;
          const paidAmt = parseFloat(d.paidAmount) || 0;
          const rem = Math.max(0, origAmt - paidAmt);
          const remInActive = convertCurrency(rem, d.currency || "EUR", state.displayCurrency);
          const isOverdue = d.dueDate && d.dueDate < todayStr;
          const isDueToday = d.dueDate && d.dueDate === todayStr;
          const dotColor = isOverdue ? "#ef4444" : (isDueToday ? "#f59e0b" : "#94a3b8");

          const row = document.createElement("div");
          row.className = "px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors tap-bounce cursor-pointer";
          row.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${dotColor};"></span>
              <div class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(debtTitle)}</div>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono font-bold text-sm ${isOverdue ? 'text-rose-600' : 'text-slate-900'}">${formatMoney(remInActive)}</span>
            </div>
          `;
          row.addEventListener("click", () => openEditDebtSheet(d));
          cardBox.appendChild(row);
        });
        debtsList.appendChild(cardBox);
      }
    }

    // Render Monthly Bills List
    const billsList = document.getElementById("mobileMonthlyBillsList");
    if (billsList) {
      billsList.innerHTML = "";
      if (shortfalls.length === 0) {
        billsList.innerHTML = `<div class="py-6 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-4 text-xs">All monthly commitments paid this month! ✨</div>`;
      } else {
        const cardBox = document.createElement("div");
        cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
        shortfalls.forEach(s => {
          const owedInActive = convertCurrency(s.remainingOwed, s.currency || "EUR", state.displayCurrency);
          const row = document.createElement("div");
          row.className = "px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors tap-bounce cursor-pointer";
          row.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 bg-purple-500"></span>
              <div class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(s.name)}</div>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono font-bold text-sm text-slate-900">${formatMoney(owedInActive)}</span>
            </div>
          `;
          row.addEventListener("click", () => {
            const subObj = (state.subscriptions || []).find(sub => sub.id === s.subscriptionId);
            if (subObj) openEditSubSheet(subObj);
          });
          cardBox.appendChild(row);
        });
        billsList.appendChild(cardBox);
      }
    }
  }

  async function settleDebtItem(id) {
    const idx = state.debts.findIndex(d => d.id === id);
    if (idx === -1) return;
    const d = state.debts[idx];
    const debtTitle = d.title || d.name || "Debt";
    const origAmt = parseFloat(d.amount) || 0;
    const paidAmt = parseFloat(d.paidAmount) || 0;
    const rem = Math.max(0, origAmt - paidAmt);
    const debtCur = d.currency || state.displayCurrency;

    if (!await confirmAction({
      title: `Mark "${debtTitle}" as fully paid?`,
      message: `${formatMoney(rem, debtCur)} remaining. This will log it as a completed transaction.`,
      confirmText: 'Mark as Paid',
      type: 'primary'
    })) return;

    state.debts[idx].isPaid = true;
    state.debts[idx].isSettled = true;
    state.debts[idx].paidAmount = origAmt;

    // Log transaction into ledger
    const newExpense = {
      id: "exp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      title: paidAmt > 0 ? `${debtTitle} (Final Balance)` : debtTitle,
      amount: rem,
      currency: debtCur,
      category: d.category || "Utilities",
      date: new Date().toISOString().split("T")[0],
      isSubscription: false,
      billingCycle: "monthly",
      paymentMethod: "Bank Transfer",
      notes: d.notes ? `Fully settled debt (${formatMoney(rem, debtCur)}): ${d.notes}` : `Fully settled debt (${formatMoney(rem, debtCur)})`,
      hasAttachment: false
    };
    state.expenses.unshift(newExpense);

    saveAllToLocalStorage();
    renderNeedsToPayView();
    pushToVault();
    showMobileToast("Debt settled & logged to transactions!");
  }

  // ==========================================
  // 10. SUBSCRIPTIONS RENDER ENGINE
  // ==========================================
  function renderSubscriptionsView() {
    const subs = state.subscriptions || [];
    const curMonthKey = new Date().toISOString().slice(0, 7);
    let monthlyBurn = 0;
    const upcomingSchedule = [];

    subs.forEach(s => {
      const isCounted = isSubscriptionCountedInMonth(s, curMonthKey);
      if (isCounted) {
        monthlyBurn += getSubMonthlyAmount(s, state.displayCurrency);
      }

      const isPaid = isSubscriptionPaidInMonth(s, curMonthKey);
      if (s.isFrozen && !isPaid) return;

      const nextInfo = calculateSubNextDate(s);
      s.nextBillingDate = nextInfo.nextBillingDate;
      if (!s.billingDay) s.billingDay = nextInfo.bDay;

      upcomingSchedule.push({
        sub: s,
        nextDate: nextInfo.nextDate,
        diffDays: nextInfo.diffDays,
        nextBillingDate: nextInfo.nextBillingDate
      });
    });

    upcomingSchedule.sort((a, b) => a.diffDays - b.diffDays);
    const nextItem = upcomingSchedule.length > 0 ? upcomingSchedule[0] : null;

    const elBurn = document.getElementById("mobileSubBurnPrimary");
    const elEquiv = document.getElementById("mobileSubBurnEquiv");
    const elNextTitle = document.getElementById("mobileSubNextTitle");
    const elNextDate = document.getElementById("mobileSubNextDate");

    if (elBurn) elBurn.textContent = formatMoney(monthlyBurn);
    if (elEquiv) elEquiv.textContent = formatTriEquiv(monthlyBurn);
    if (elNextTitle) elNextTitle.textContent = nextItem ? nextItem.sub.name : "None imminent";
    if (elNextDate) {
      if (nextItem) {
        const diffDays = nextItem.diffDays;
        const countStr = diffDays === 0 ? 'Today!' : (diffDays === 1 ? 'Tomorrow' : `In ${diffDays}d`);
        const dateFormatted = nextItem.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        elNextDate.textContent = `${countStr} (${dateFormatted})`;
      } else {
        elNextDate.textContent = "No renewals";
      }
    }

    // Timeline strip (next 30 days upcoming renewals)
    const timeline = document.getElementById("mobileUpcomingTimelineStrip");
    if (timeline) {
      timeline.innerHTML = "";
      const next30Days = upcomingSchedule.filter(item => item.diffDays >= 0 && item.diffDays <= 30);
      if (next30Days.length === 0) {
        timeline.innerHTML = `<div class="text-[11px] text-slate-400 py-1 px-1">No upcoming renewals in the next 30 days</div>`;
      } else {
        next30Days.forEach(item => {
          const s = item.sub;
          const diffDays = item.diffDays;
          let badgeClass = 'text-slate-500 bg-slate-100';
          let diffLabel = `In ${diffDays}d`;
          if (diffDays === 0) {
            badgeClass = 'text-rose-700 bg-rose-50 font-bold';
            diffLabel = 'Today';
          } else if (diffDays === 1) {
            badgeClass = 'text-amber-700 bg-amber-50 font-bold';
            diffLabel = 'Tomorrow';
          } else if (diffDays <= 3) {
            badgeClass = 'text-amber-700 bg-amber-50 font-bold';
            diffLabel = `In ${diffDays}d`;
          }
          const dateStr = item.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const pill = document.createElement("div");
          pill.className = "px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0 flex flex-col gap-0.5 text-center min-w-[105px]";
          pill.innerHTML = `
            <div class="flex items-center justify-between gap-1">
              <span class="text-[9px] px-1 py-0.2 rounded ${badgeClass}">${diffLabel}</span>
              <span class="font-mono text-[9px] text-slate-400">${dateStr}</span>
            </div>
            <div class="font-bold text-[11px] text-slate-900 truncate max-w-[110px] text-left mt-0.5">${escapeHtml(s.name)}</div>
            <div class="font-mono text-[10px] text-slate-700 font-semibold text-left">${formatMoney(convertCurrency(s.amount || 0, s.currency || "EUR", state.displayCurrency))}</div>
          `;
          timeline.appendChild(pill);
        });
      }
    }

    // Render 7-column Calendar Grid
    renderMobileSubscriptionCalendar();

    // Separate subs into subsOnly and recurringBills
    const subsOnly = subs.filter(s => (s.recurringType !== 'basic_recurring' && !s.isBasicRecurring));
    const recurringBills = subs.filter(s => (s.recurringType === 'basic_recurring' || !!s.isBasicRecurring));

    let subsSubtotal = 0;
    subsOnly.forEach(s => {
      if (isSubscriptionCountedInMonth(s, curMonthKey)) {
        subsSubtotal += getSubMonthlyAmount(s, state.displayCurrency);
      }
    });

    let recurringSubtotal = 0;
    recurringBills.forEach(s => {
      if (isSubscriptionCountedInMonth(s, curMonthKey)) {
        recurringSubtotal += getSubMonthlyAmount(s, state.displayCurrency);
      }
    });

    // Update filter counts and badges
    const elCountAll = document.getElementById("mobileSubsCountAll");
    const elCountSubs = document.getElementById("mobileSubsCountSubs");
    const elCountFixed = document.getElementById("mobileSubsCountFixed");
    const elSubsHeaderCount = document.getElementById("categorySubsCountHeader");
    const elRecurringHeaderCount = document.getElementById("categoryRecurringCountHeader");
    const elSubsSubtotal = document.getElementById("categorySubsSubtotal");
    const elRecurringSubtotal = document.getElementById("categoryRecurringSubtotal");

    if (elCountAll) elCountAll.textContent = subs.length;
    if (elCountSubs) elCountSubs.textContent = subsOnly.length;
    if (elCountFixed) elCountFixed.textContent = recurringBills.length;
    if (elSubsHeaderCount) elSubsHeaderCount.textContent = subsOnly.length;
    if (elRecurringHeaderCount) elRecurringHeaderCount.textContent = recurringBills.length;
    if (elSubsSubtotal) elSubsSubtotal.textContent = `${formatMoney(subsSubtotal)} / mo`;
    if (elRecurringSubtotal) elRecurringSubtotal.textContent = `${formatMoney(recurringSubtotal)} / mo`;

    // Handle sub-filter visibility
    const activeSubFilter = state.monthlySubFilter || "all";
    const subsGroup = document.getElementById("mobileSubsCategoryGroup");
    const recurringGroup = document.getElementById("mobileRecurringCategoryGroup");

    if (subsGroup) {
      if (activeSubFilter === "recurring") subsGroup.classList.add("hidden");
      else subsGroup.classList.remove("hidden");
    }
    if (recurringGroup) {
      if (activeSubFilter === "subscriptions") recurringGroup.classList.add("hidden");
      else recurringGroup.classList.remove("hidden");
    }

    // Helper card builder (Ultra-minimal Title + Amount)
    function buildSubCard(s) {
      const nextInfo = calculateSubNextDate(s);
      s.nextBillingDate = nextInfo.nextBillingDate;
      const convAmt = convertCurrency(s.amount || 0, s.currency || "EUR", state.displayCurrency);
      const isPaid = isSubscriptionPaidInMonth(s, curMonthKey);
      const isFrozen = !!s.isFrozen;
      const dotColor = isPaid ? "#10b981" : (isFrozen ? "#38bdf8" : (s.recurringType === 'basic_recurring' ? "#3b82f6" : "#9333ea"));

      const card = document.createElement("div");
      card.className = `px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer tap-bounce ${isFrozen ? 'bg-sky-50/20' : ''}`;
      card.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${dotColor};"></span>
          <span class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(s.name)}</span>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono font-bold text-sm ${isFrozen && !isPaid ? 'text-slate-400 line-through' : (isPaid ? 'text-emerald-600' : 'text-slate-900')}">${formatMoney(convAmt)}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        openEditSubSheet(s);
      });

      return card;
    }

    // Render Subscriptions list
    const subsList = document.getElementById("mobileSubscriptionsList");
    if (subsList) {
      subsList.innerHTML = "";
      if (subsOnly.length === 0) {
        subsList.innerHTML = `<div class="py-6 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 p-4 text-xs">No digital subscriptions added yet.</div>`;
      } else {
        const cardBox = document.createElement("div");
        cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
        const sortedSubs = subsOnly.slice().sort((a, b) => (a.isFrozen ? 1 : 0) - (b.isFrozen ? 1 : 0));
        sortedSubs.forEach(s => cardBox.appendChild(buildSubCard(s)));
        subsList.appendChild(cardBox);
      }
    }

    // Render Fixed Bills list
    const recList = document.getElementById("mobileRecurringBillsList");
    if (recList) {
      recList.innerHTML = "";
      if (recurringBills.length === 0) {
        recList.innerHTML = `<div class="py-6 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 p-4 text-xs">No fixed bills added yet.</div>`;
      } else {
        const cardBox = document.createElement("div");
        cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
        const sortedRec = recurringBills.slice().sort((a, b) => (a.isFrozen ? 1 : 0) - (b.isFrozen ? 1 : 0));
        sortedRec.forEach(s => cardBox.appendChild(buildSubCard(s)));
        recList.appendChild(cardBox);
      }
    }

    refreshIcons(subsList);
    refreshIcons(recList);
  }

  // ==========================================
  // 11. NOTES RENDER ENGINE (WITH ATTACHMENTS)
  // ==========================================
  function createMobileNoteCard(note, isArchived) {
    const isDone = !!(note.completed || note.isDone);
    const color = note.color || "#6366f1";

    const card = document.createElement("div");
    card.className = `px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer tap-bounce ${isArchived ? "bg-slate-50/40 opacity-75" : ""}`;
    card.setAttribute("data-note-id", note.id);

    card.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color};"></span>
        <span class="font-semibold text-xs text-slate-900 truncate ${isArchived ? "line-through text-slate-400" : ""}">${escapeHtml(note.title)}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${note.dueDate ? `<span class="text-[10px] font-mono text-slate-400">${escapeHtml(note.dueDate.slice(5))}</span>` : ""}
        <button type="button" class="mobile-toggle-note-done p-1 text-slate-400 hover:text-emerald-600 tap-bounce" data-id="${note.id}" title="${isArchived ? 'Restore note' : 'Mark complete'}">
          <i data-lucide="${isDone ? "check-square" : "square"}" class="w-4 h-4 ${isDone ? "text-emerald-600" : ""}"></i>
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      openEditNoteSheet(note);
    });

    const toggleBtn = card.querySelector(".mobile-toggle-note-done");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        note.completed = !isDone;
        note.isDone = note.completed;
        saveAllToLocalStorage();
        renderNotesView();
        pushToVault();
        showMobileToast(note.isDone ? "Moved to Archive 📦" : "Restored to Active ✨");
      });
    }

    return card;
  }

  function renderNotesView() {
    const notes = state.notes || [];
    const activeNotes = notes.filter(n => !(n.completed || n.isDone));
    const doneNotes = notes.filter(n => !!(n.completed || n.isDone));

    const countBadge = document.getElementById("mobileNotesActiveCountBadge");
    if (countBadge) countBadge.textContent = activeNotes.length;

    const grid = document.getElementById("mobileNotesGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (activeNotes.length === 0) {
      grid.innerHTML = `<div class="py-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-4 text-xs">No active notes.</div>`;
    } else {
      const cardBox = document.createElement("div");
      cardBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
      activeNotes.forEach(note => {
        cardBox.appendChild(createMobileNoteCard(note, false));
      });
      grid.appendChild(cardBox);
    }

    // Archive Section Rendering
    const archiveSec = document.getElementById("mobileNotesArchiveSection");
    const archiveGrid = document.getElementById("mobileNotesArchiveGrid");
    const archiveBadge = document.getElementById("mobileNotesArchiveCountBadge");

    if (archiveSec && archiveGrid) {
      if (doneNotes.length === 0) {
        archiveSec.classList.add("hidden");
        archiveGrid.innerHTML = "";
      } else {
        archiveSec.classList.remove("hidden");
        if (archiveBadge) archiveBadge.textContent = String(doneNotes.length);
        archiveGrid.innerHTML = "";
        const archiveBox = document.createElement("div");
        archiveBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden";
        doneNotes.forEach(note => {
          archiveBox.appendChild(createMobileNoteCard(note, true));
        });
        archiveGrid.appendChild(archiveBox);
      }
    }

    // Mobile Archive Toggle
    const toggleMobileArchiveBtn = document.getElementById("toggleMobileNotesArchiveBtn");
    if (toggleMobileArchiveBtn && !toggleMobileArchiveBtn._hasArchiveListener) {
      toggleMobileArchiveBtn._hasArchiveListener = true;
      toggleMobileArchiveBtn.addEventListener("click", () => {
        const ag = document.getElementById("mobileNotesArchiveGrid");
        const text = document.getElementById("toggleMobileNotesArchiveText");
        if (!ag) return;
        const isHidden = ag.classList.toggle("hidden");
        if (text) text.textContent = isHidden ? "Show" : "Hide";
      });
    }

    refreshIcons(grid);
    if (archiveGrid) refreshIcons(archiveGrid);
  }

  async function openNoteAttachmentQuickView(note, attIdx) {
    const att = (note.attachments || [])[attIdx];
    if (!att) return;

    const titleEl = document.getElementById("quickViewDocTitle");
    const metaEl = document.getElementById("quickViewDocMeta");
    const contentEl = document.getElementById("quickViewModalContent");
    const downloadBtn = document.getElementById("quickViewDownloadDocBtn");

    if (titleEl) titleEl.textContent = att.name || "Attachment";
    if (metaEl) metaEl.textContent = `${note.title} • ${(att.size ? (att.size / 1024).toFixed(1) + " KB" : "")}`;

    let dataUrl = att.dataUrl || att.data || "";
    if (!dataUrl && att.id) {
      try {
        const res = await fetch(`/api/attachments/${encodeURIComponent(att.id)}`);
        if (res.ok) {
          const remote = await res.json();
          if (remote && remote.data) {
            dataUrl = remote.data;
          }
        }
      } catch (e) {}
    }

    if (downloadBtn) {
      downloadBtn.href = dataUrl || "#";
      downloadBtn.download = att.name || "attachment";
    }

    if (contentEl) {
      if (att.type && (att.type.startsWith("image/") || att.type === "image")) {
        contentEl.innerHTML = `<img src="${dataUrl || att.thumbData || ''}" class="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md">`;
      } else {
        contentEl.innerHTML = `
          <div class="text-center p-6 space-y-2">
            <i data-lucide="file-text" class="w-12 h-12 text-rose-500 mx-auto"></i>
            <p class="text-xs font-bold text-slate-800">${escapeHtml(att.name)}</p>
            <p class="text-[10px] text-slate-400">PDF / Document File</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }

    openBottomSheet("noteAttachmentQuickViewSheet", "noteAttachmentQuickViewBackdrop");
  }

  async function openMobileProjectDoc(p) {
    if (!p) return;
    const titleEl = document.getElementById("quickViewDocTitle");
    const metaEl = document.getElementById("quickViewDocMeta");
    const contentEl = document.getElementById("quickViewModalContent");
    const downloadBtn = document.getElementById("quickViewDownloadDocBtn");

    let docName = (p.invoiceDoc && p.invoiceDoc.fileName) || (p.attachment && p.attachment.fileName) || "receipt.pdf";
    let docData = (p.invoiceDoc && p.invoiceDoc.data) || (p.attachment && p.attachment.data) || null;

    if (!docData) {
      try {
        const res = await fetch(`/api/attachments/${encodeURIComponent(p.id)}`);
        if (res.ok) {
          const remote = await res.json();
          if (remote && remote.data) {
            docData = remote.data;
            if (remote.fileName) docName = remote.fileName;
          }
        }
      } catch (e) {}
    }

    if (titleEl) titleEl.textContent = `${p.client || 'Project'} — Receipt`;
    if (metaEl) metaEl.textContent = `${p.description || 'Project Receipt'} • ${p.invoiceNumber ? '#' + p.invoiceNumber : ''}`;
    if (downloadBtn) {
      downloadBtn.href = docData || "#";
      downloadBtn.download = docName;
      if (docData) downloadBtn.classList.remove("hidden");
      else downloadBtn.classList.add("hidden");
    }

    if (contentEl) {
      if (docData) {
        if (docData.startsWith("data:image/") || (p.invoiceDoc && p.invoiceDoc.type === "image")) {
          contentEl.innerHTML = `<img src="${docData}" class="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md">`;
        } else {
          contentEl.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center p-2 space-y-2">
              <object data="${docData}" type="application/pdf" class="w-full h-[52vh] rounded-xl border border-slate-200">
                <iframe src="${docData}" class="w-full h-[52vh] rounded-xl border border-slate-200">
                  <div class="text-center p-6 space-y-2">
                    <i data-lucide="file-text" class="w-12 h-12 text-rose-500 mx-auto"></i>
                    <p class="text-xs font-bold text-slate-800">${escapeHtml(docName)}</p>
                    <a href="${docData}" download="${escapeHtml(docName)}" class="inline-block mt-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Download PDF</a>
                  </div>
                </iframe>
              </object>
              <a href="${docData}" target="_blank" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                <span>Open PDF in new tab</span>
              </a>
            </div>
          `;
        }
      } else {
        contentEl.innerHTML = `
          <div class="text-center p-6 space-y-2">
            <i data-lucide="file-text" class="w-12 h-12 text-rose-500 mx-auto"></i>
            <p class="text-xs font-bold text-slate-800">${escapeHtml(docName)}</p>
            <p class="text-[10px] text-slate-400">Attached to project on desktop</p>
          </div>
        `;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    openBottomSheet("noteAttachmentQuickViewSheet", "noteAttachmentQuickViewBackdrop");
  }

  // ==========================================
  // 12. REPORTS & CHARTS RENDER ENGINE
  // ==========================================
  function renderReportsView() {
    const isAllTime = state.selectedMonth === "ALL";
    const monthExpenses = state.expenses.filter(e => isAllTime || (e.date || "").startsWith(state.selectedMonth));
    const breakdownList = document.getElementById("mobileReportsBreakdownList");
    const noDataEl = document.getElementById("mobileNoReportsData");

    const categoryMap = {};
    let totalSpend = 0;

    monthExpenses.forEach(e => {
      const amt = convertCurrency(e.amount, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
      const cat = e.category || "Other";
      categoryMap[cat] = (categoryMap[cat] || 0) + amt;
      totalSpend += amt;
    });

    const categories = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);

    if (breakdownList) {
      breakdownList.innerHTML = "";
      if (categories.length === 0) {
        if (noDataEl) noDataEl.classList.remove("hidden");
      } else {
        if (noDataEl) noDataEl.classList.add("hidden");
        const bFrag = document.createDocumentFragment();
        categories.forEach(cat => {
          const amt = categoryMap[cat];
          const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : "0";
          const catCol = getCategoryColor(cat);
          const row = document.createElement("div");
          row.className = "px-4 py-2.5 flex items-center justify-between";
          row.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${catCol};"></span>
              <i data-lucide="${getCategoryIcon(cat)}" class="w-3.5 h-3.5 text-slate-500"></i>
              <span class="font-semibold text-slate-800 text-xs">${escapeHtml(cat)}</span>
            </div>
            <div class="flex items-center gap-6">
              <span class="font-mono font-bold text-slate-900 text-xs">${formatMoney(amt)}</span>
              <span class="font-mono text-slate-400 w-8 text-right text-[11px]">${pct}%</span>
            </div>
          `;
          bFrag.appendChild(row);
        });
        breakdownList.appendChild(bFrag);
        refreshIcons(breakdownList);
      }
    }

    // Chart.js Category Donut Chart
    const chartCanvas = document.getElementById("mobileCategoryChart");
    if (chartCanvas && window.Chart) {
      if (state.charts.category) {
        state.charts.category.destroy();
        state.charts.category = null;
      }

      if (categories.length > 0) {
        const bgColors = categories.map(c => getCategoryColor(c));
        state.charts.category = new window.Chart(chartCanvas, {
          type: "doughnut",
          data: {
            labels: categories,
            datasets: [{
              data: categories.map(c => categoryMap[c]),
              backgroundColor: bgColors,
              borderWidth: 2,
              borderColor: "#ffffff"
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            cutout: "70%"
          }
        });
      }
    }

    // 2. Mobile Cash Flow & Net Savings Trend (Income vs Spending, Last 6 Months)
    renderMobileReportCashflow();

    // 3. Mobile Tax Deductions & Audit Ready Receipts
    renderMobileReportTaxDeductions();

    // 4. Mobile Fixed Overhead vs Discretionary Burn & Runway
    renderMobileReportOverheadRunway();

    refreshIcons(document.getElementById("viewReports"));
  }

  function renderMobileReportCashflow() {
    const canvas = document.getElementById("mobileCashflowChart");
    const noDataEl = document.getElementById("mobileNoCashflowData");
    const badgeEl = document.getElementById("mobileReportCashflowDeltaBadge");
    if (!canvas || !window.Chart) return;

    if (state.charts.cashflow) {
      state.charts.cashflow.destroy();
      state.charts.cashflow = null;
    }

    const cur = state.displayCurrency;
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      months.push({ key, label, income: 0, spending: 0 });
    }

    const allIncomes = getAllReceivedPayments();
    allIncomes.forEach(inc => {
      if (!inc.date) return;
      const mKey = inc.date.slice(0, 7);
      const targetMonth = months.find(m => m.key === mKey);
      if (targetMonth) {
        targetMonth.income += convertCurrency(inc.amount, inc.currency || cur, cur);
      }
    });

    state.expenses.forEach(exp => {
      if (!exp.date || exp.isIncome) return;
      const mKey = exp.date.slice(0, 7);
      const targetMonth = months.find(m => m.key === mKey);
      if (targetMonth) {
        targetMonth.spending += convertCurrency(exp.amount, exp.currency || cur, cur);
      }
    });

    const totalInflow = months.reduce((acc, m) => acc + m.income, 0);
    const totalOutflow = months.reduce((acc, m) => acc + m.spending, 0);
    const netDelta = totalInflow - totalOutflow;

    if (badgeEl) {
      badgeEl.textContent = `${netDelta >= 0 ? '+' : ''}${formatMoney(netDelta)}`;
      badgeEl.className = `text-xs font-bold font-mono ${netDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
    }

    const hasData = (totalInflow > 0 || totalOutflow > 0);
    if (!hasData) {
      if (noDataEl) noDataEl.classList.remove("hidden");
      canvas.classList.add("hidden");
      return;
    }

    if (noDataEl) noDataEl.classList.add("hidden");
    canvas.classList.remove("hidden");

    const labels = months.map(m => m.label);
    const incomeData = months.map(m => Math.round(m.income * 100) / 100);
    const spendingData = months.map(m => Math.round(m.spending * 100) / 100);

    state.charts.cashflow = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Inflow",
            data: incomeData,
            backgroundColor: "#10b981",
            borderRadius: 4,
            maxBarThickness: 14
          },
          {
            label: "Outflow",
            data: spendingData,
            backgroundColor: "#f43f5e",
            borderRadius: 4,
            maxBarThickness: 14
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              font: { size: 10 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 } }
          },
          y: {
            grid: { color: "rgba(226, 232, 240, 0.6)" },
            ticks: {
              font: { size: 9 },
              callback: (v) => formatMoney(v),
              maxTicksLimit: 5
            }
          }
        }
      }
    });
  }

  function renderMobileReportTaxDeductions() {
    const cur = state.displayCurrency;
    const isAllTime = (state.selectedMonth === "ALL");
    const monthExpenses = state.expenses.filter(e => isAllTime || (e.date || "").startsWith(state.selectedMonth));

    let businessTotal = 0;
    let personalTotal = 0;
    let businessReceiptsCount = 0;
    let businessTotalCount = 0;
    let missingTaxReceiptsCount = 0;

    monthExpenses.forEach(e => {
      if (e.isIncome) return;
      const amt = convertCurrency(e.amount, e.currency || cur, cur);
      if (e.isBusiness) {
        businessTotal += amt;
        businessTotalCount++;
        if (e.hasAttachment) {
          businessReceiptsCount++;
        } else {
          missingTaxReceiptsCount++;
        }
      } else {
        personalTotal += amt;
      }
    });

    const totalSpend = businessTotal + personalTotal;
    const deductiblePct = totalSpend > 0 ? ((businessTotal / totalSpend) * 100).toFixed(0) : 0;
    const receiptHealthPct = businessTotalCount > 0 ? ((businessReceiptsCount / businessTotalCount) * 100).toFixed(0) : 100;

    const dedTotalEl = document.getElementById("mobileReportDeductibleTotal");
    if (dedTotalEl) dedTotalEl.textContent = formatMoney(businessTotal);
    const dedPctEl = document.getElementById("mobileReportDeductiblePercent");
    if (dedPctEl) dedPctEl.textContent = `${deductiblePct}% of total`;

    const rCountEl = document.getElementById("mobileReportTaxReceiptCount");
    if (rCountEl) rCountEl.textContent = `${businessReceiptsCount} / ${businessTotalCount}`;
    const rPctEl = document.getElementById("mobileReportTaxReceiptPercent");
    if (rPctEl) rPctEl.textContent = `${receiptHealthPct}% documented`;

    const rMissEl = document.getElementById("mobileReportMissingTaxCount");
    if (rMissEl) rMissEl.textContent = `${missingTaxReceiptsCount} missing`;

    const badgeEl = document.getElementById("mobileReportTaxHealthBadge");
    if (badgeEl) {
      if (businessTotalCount === 0) {
        badgeEl.textContent = "No Biz Expenses";
        badgeEl.className = "text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full";
      } else if (missingTaxReceiptsCount === 0) {
        badgeEl.textContent = "100% Tax Ready";
        badgeEl.className = "text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80";
      } else {
        badgeEl.textContent = `${missingTaxReceiptsCount} Missing`;
        badgeEl.className = "text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80";
      }
    }
  }

  function renderMobileReportOverheadRunway() {
    const cur = state.displayCurrency;
    const isAllTime = (state.selectedMonth === "ALL");
    const monthExpenses = state.expenses.filter(e => isAllTime || (e.date || "").startsWith(state.selectedMonth));

    let fixedMonthlyOverhead = 0;
    const currentMonthKey = !isAllTime ? state.selectedMonth : new Date().toISOString().slice(0, 7);
    state.subscriptions.forEach(sub => {
      if (isSubscriptionCountedInMonth(sub, currentMonthKey)) {
        const amt = convertCurrency(sub.amount, sub.currency || cur, cur);
        fixedMonthlyOverhead += (sub.billingCycle === "yearly" ? amt / 12 : amt);
      }
    });

    let discretionarySpend = 0;
    monthExpenses.forEach(e => {
      if (e.isIncome) return;
      if (!e.isSubscription) {
        discretionarySpend += convertCurrency(e.amount, e.currency || cur, cur);
      }
    });

    const totalOperationalBurn = fixedMonthlyOverhead + discretionarySpend;
    const fixedRatio = totalOperationalBurn > 0 ? ((fixedMonthlyOverhead / totalOperationalBurn) * 100).toFixed(0) : 0;
    const discRatio = totalOperationalBurn > 0 ? (100 - fixedRatio) : 100;

    let pendingReceivables = 0;
    const projects = (state.budget && Array.isArray(state.budget.projects)) ? state.budget.projects : [];
    projects.forEach(p => {
      if (p.status === "paid" || p.status === "cancelled") return;
      const totalFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
      let paidSoFar = p.paidAmount !== undefined ? (parseFloat(p.paidAmount) || 0) : 0;
      if (!p.paidAmount && Array.isArray(p.payments)) {
        paidSoFar = p.payments.reduce((acc, pay) => {
          const pCur = pay.currency || p.currency || "EUR";
          const pAmt = parseFloat(pay.amount) || 0;
          const cAmt = pay.creditedAmount !== undefined ? parseFloat(pay.creditedAmount) : (pCur === (p.currency || "EUR") ? pAmt : convertCurrency(pAmt, pCur, p.currency || "EUR"));
          return acc + cAmt;
        }, 0);
      }
      const remaining = Math.max(0, totalFee - paidSoFar);
      pendingReceivables += convertCurrency(remaining, p.currency || cur, cur);
    });

    const runwayMonths = fixedMonthlyOverhead > 0 ? (pendingReceivables / fixedMonthlyOverhead).toFixed(1) : "∞";

    const fixedAmtEl = document.getElementById("mobileReportFixedOverheadAmount");
    if (fixedAmtEl) fixedAmtEl.textContent = formatMoney(fixedMonthlyOverhead);
    const fixedRatioEl = document.getElementById("mobileReportFixedOverheadRatio");
    if (fixedRatioEl) fixedRatioEl.textContent = `${fixedRatio}% monthly`;

    const runwayMoEl = document.getElementById("mobileReportRunwayMonths");
    if (runwayMoEl) runwayMoEl.textContent = `${runwayMonths} mo`;

    const fixedBar = document.getElementById("mobileReportOverheadFixedBar");
    const discBar = document.getElementById("mobileReportOverheadDiscretionaryBar");
    if (fixedBar) fixedBar.style.width = `${fixedRatio}%`;
    if (discBar) discBar.style.width = `${discRatio}%`;

    const fixedBarLbl = document.getElementById("mobileReportFixedBarLabel");
    if (fixedBarLbl) fixedBarLbl.textContent = `Fixed: ${formatMoney(fixedMonthlyOverhead)}`;
    const discBarLbl = document.getElementById("mobileReportDiscretionaryBarLabel");
    if (discBarLbl) discBarLbl.textContent = `Variable: ${formatMoney(discretionarySpend)}`;

    const badgeEl = document.getElementById("mobileReportRunwayBadge");
    if (badgeEl) {
      badgeEl.textContent = `${runwayMonths} Mo Runway`;
      badgeEl.className = `text-xs font-bold font-mono ${runwayMonths === "∞" || parseFloat(runwayMonths) >= 3 ? "text-emerald-600" : "text-amber-600"}`;
    }
  }

  // ==========================================
  // 13. WISHLIST RENDER ENGINE (WITH SIMULATOR)
  // ==========================================
  function isMobileWishSubscription(w) {
    if (!w) return false;
    if (w.category === "Subscriptions") return true;
    if (w.billingCycle === "monthly" || w.billingCycle === "yearly") return true;
    return false;
  }

  function getMobileWishMonthlyEquiv(w, targetCur) {
    const rawAmt = Number(w.amount !== undefined && w.amount !== null ? w.amount : (w.price || 0)) || 0;
    const amt = convertCurrency(rawAmt, w.currency || targetCur, targetCur);
    if (w.billingCycle === "yearly") return amt / 12;
    if (w.billingCycle === "monthly") return amt;
    return amt / 12; // One-time amortized over 12 months for simulated burn
  }

  function renderWishlistView() {
    const primaryCur = state.displayCurrency;
    const items = state.wishlist || [];

    // 1. Current active monthly burn
    let activeMonthlyBurn = 0;
    const curMonthKey = new Date().toISOString().slice(0, 7);
    (state.subscriptions || []).forEach(s => {
      if (!isSubscriptionCountedInMonth(s, curMonthKey)) return;
      const rawAmt = Number(s.amount) || 0;
      const amt = convertCurrency(rawAmt, s.currency || "EUR", primaryCur);
      if (s.billingCycle === "yearly") activeMonthlyBurn += (amt / 12);
      else activeMonthlyBurn += amt;
    });

    // 2. Partition into Subscriptions and Items
    const subsWish = [];
    const itemsWish = [];
    let wishlistMonthlyAddition = 0;
    let subsSimSubtotal = 0;
    let itemsSimSubtotal = 0;

    items.forEach(w => {
      const isSub = isMobileWishSubscription(w);
      const isSim = (w.isSimulated !== false);
      const monthlyEquiv = getMobileWishMonthlyEquiv(w, primaryCur);

      if (isSub) {
        subsWish.push(w);
        if (isSim) subsSimSubtotal += monthlyEquiv;
      } else {
        itemsWish.push(w);
        if (isSim) itemsSimSubtotal += monthlyEquiv;
      }

      if (isSim) {
        wishlistMonthlyAddition += monthlyEquiv;
      }
    });

    const projectedTotalBurn = activeMonthlyBurn + wishlistMonthlyAddition;

    // Simulation metrics update
    const elSimAdd = document.getElementById("mobileWishlistTotalPrimary");
    const elSimAddEq = document.getElementById("mobileWishlistTotalEquiv");
    const elProj = document.getElementById("mobileWishlistProjectedPrimary");
    const elProjEq = document.getElementById("mobileWishlistProjectedEquiv");

    if (elSimAdd) elSimAdd.textContent = `+ ${formatMoney(wishlistMonthlyAddition)}`;
    if (elSimAddEq) elSimAddEq.textContent = formatTriEquiv(wishlistMonthlyAddition);
    if (elProj) elProj.textContent = formatMoney(projectedTotalBurn);
    if (elProjEq) elProjEq.textContent = formatTriEquiv(projectedTotalBurn);

    const subsCountBadge = document.getElementById("mobileWishlistSubsCount");
    const subsSimText = document.getElementById("mobileWishlistSubsSimText");
    if (subsCountBadge) subsCountBadge.textContent = subsWish.length;
    if (subsSimText) subsSimText.textContent = `+${formatMoney(subsSimSubtotal)}/mo`;

    const itemsCountBadge = document.getElementById("mobileWishlistItemsCount");
    const itemsSimText = document.getElementById("mobileWishlistItemsSimText");
    if (itemsCountBadge) itemsCountBadge.textContent = itemsWish.length;
    if (itemsSimText) itemsSimText.textContent = `+${formatMoney(itemsSimSubtotal)}/mo`;

    const subsList = document.getElementById("mobileWishlistSubsList");
    const itemsList = document.getElementById("mobileWishlistItemsList");

    function createMobileWishCard(w, isSub) {
      const rawAmt = Number(w.amount !== undefined && w.amount !== null ? w.amount : (w.price || 0)) || 0;
      const amtInActive = convertCurrency(rawAmt, w.currency || primaryCur, primaryCur);
      const isSim = (w.isSimulated !== false);

      const card = document.createElement("div");
      card.className = `px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer tap-bounce ${isSim ? '' : 'opacity-60'}`;
      card.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <input type="checkbox" class="mobile-wish-sim-toggle w-4 h-4 rounded text-slate-900 border-slate-300 shrink-0 cursor-pointer" data-id="${w.id}" ${isSim ? 'checked' : ''}>
          <span class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(w.name || "Item")}</span>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono font-bold text-sm ${isSim ? 'text-slate-900' : 'text-slate-400'}">${formatMoney(amtInActive)}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        openMobileEditWishSheet(w);
      });

      const simToggle = card.querySelector(".mobile-wish-sim-toggle");
      if (simToggle) {
        simToggle.addEventListener("click", (e) => e.stopPropagation());
        simToggle.addEventListener("change", (e) => {
          e.stopPropagation();
          w.isSimulated = simToggle.checked;
          saveAllToLocalStorage();
          renderWishlistView();
          pushToVault();
        });
      }

      return card;
    }

    if (subsList) {
      subsList.innerHTML = "";
      if (subsWish.length > 0) {
        const subsBox = document.createElement("div");
        subsBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden mb-2.5";
        subsWish.forEach(w => subsBox.appendChild(createMobileWishCard(w, true)));
        subsList.appendChild(subsBox);
      }

      const addSubBtn = document.createElement("button");
      addSubBtn.type = "button";
      addSubBtn.className = "w-full py-3 px-4 rounded-2xl border border-dashed border-slate-300 bg-white text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 tap-bounce";
      addSubBtn.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Add Subscription</span>`;
      addSubBtn.addEventListener("click", () => {
        openMobileWishSheetWithDefaults("Subscriptions", "monthly");
      });
      subsList.appendChild(addSubBtn);
      refreshIcons(subsList);
    }

    if (itemsList) {
      itemsList.innerHTML = "";
      if (itemsWish.length > 0) {
        const itemsBox = document.createElement("div");
        itemsBox.className = "bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden mb-2.5";
        itemsWish.forEach(w => itemsBox.appendChild(createMobileWishCard(w, false)));
        itemsList.appendChild(itemsBox);
      }

      const addItemBtn = document.createElement("button");
      addItemBtn.type = "button";
      addItemBtn.className = "w-full py-3 px-4 rounded-2xl border border-dashed border-slate-300 bg-white text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 tap-bounce";
      addItemBtn.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Add Item / Service</span>`;
      addItemBtn.addEventListener("click", () => {
        openMobileWishSheetWithDefaults("Shopping", "onetime");
      });
      itemsList.appendChild(addItemBtn);
      refreshIcons(itemsList);
    }
  }

  // ==========================================
  // 14. MODALS & BOTTOM SHEETS LOGIC
  // ==========================================
  function openBottomSheet(sheetId, backdropId) {
    const s = document.getElementById(sheetId);
    const b = document.getElementById(backdropId);
    if (s && b) {
      s.classList.remove("closed");
      b.classList.remove("closed");
    }
  }

  function closeBottomSheet(sheetId, backdropId) {
    const s = document.getElementById(sheetId);
    const b = document.getElementById(backdropId);
    if (s && b) {
      s.classList.add("closed");
      b.classList.add("closed");
    }
  }

  function setupBottomSheets() {
    // Backdrop dismissals
    const backdrops = [
      ["fabActionSheet", "fabActionBackdrop"],
      ["moreMenuSheet", "moreMenuBackdrop"],
      ["expenseSheet", "expenseSheetBackdrop"],
      ["budgetAdjustSheet", "budgetAdjustBackdrop"],
      ["projectSheet", "projectSheetBackdrop"],
      ["paymentSheet", "paymentSheetBackdrop"],
      ["debtSheet", "debtSheetBackdrop"],
      ["subSheet", "subSheetBackdrop"],
      ["noteSheet", "noteSheetBackdrop"],
      ["wishSheet", "wishSheetBackdrop"],
      ["receiptViewerSheet", "receiptViewerBackdrop"],
      ["noteAttachmentQuickViewSheet", "noteAttachmentQuickViewBackdrop"],
      ["syncSheet", "syncSheetBackdrop"],
      ["monthPickerSheet", "monthPickerBackdrop"],
      ["settingsSheet", "settingsSheetBackdrop"],
      ["categoryPurchasesSheet", "categoryPurchasesBackdrop"],
      ["quickAddPmModal", "quickAddPmBackdrop"],
      ["partialDebtSheet", "partialDebtBackdrop"]
    ];

    backdrops.forEach(([sheet, backdrop]) => {
      const bEl = document.getElementById(backdrop);
      if (bEl) {
        bEl.addEventListener("click", () => closeBottomSheet(sheet, backdrop));
      }
    });

    // Close buttons
    const closeBindings = [
      ["closeFabActionBtn", "fabActionSheet", "fabActionBackdrop"],
      ["closeMoreMenuBtn", "moreMenuSheet", "moreMenuBackdrop"],
      ["closeExpenseSheetBtn", "expenseSheet", "expenseSheetBackdrop"],
      ["closeBudgetAdjustBtn", "budgetAdjustSheet", "budgetAdjustBackdrop"],
      ["closeProjectSheetBtn", "projectSheet", "projectSheetBackdrop"],
      ["closePaymentSheetBtn", "paymentSheet", "paymentSheetBackdrop"],
      ["closeDebtSheetBtn", "debtSheet", "debtSheetBackdrop"],
      ["closeSubSheetBtn", "subSheet", "subSheetBackdrop"],
      ["closeNoteSheetBtn", "noteSheet", "noteSheetBackdrop"],
      ["closeWishSheetBtn", "wishSheet", "wishSheetBackdrop"],
      ["closeMobileReceiptViewerBtn", "receiptViewerSheet", "receiptViewerBackdrop"],
      ["closeMobileReceiptViewerBtn2", "receiptViewerSheet", "receiptViewerBackdrop"],
      ["closeNoteQuickViewBtn", "noteAttachmentQuickViewSheet", "noteAttachmentQuickViewBackdrop"],
      ["closeNoteQuickViewBtn2", "noteAttachmentQuickViewSheet", "noteAttachmentQuickViewBackdrop"],
      ["closeSyncSheetBtn", "syncSheet", "syncSheetBackdrop"],
      ["closeMonthPickerSheetBtn", "monthPickerSheet", "monthPickerBackdrop"],
      ["closeSettingsSheetBtn", "settingsSheet", "settingsSheetBackdrop"],
      ["closeCategoryPurchasesBtn", "categoryPurchasesSheet", "categoryPurchasesBackdrop"],
      ["closeQuickAddPmBtn", "quickAddPmModal", "quickAddPmBackdrop"],
      ["cancelQuickAddPmBtn", "quickAddPmModal", "quickAddPmBackdrop"],
      ["closePartialDebtSheetBtn", "partialDebtSheet", "partialDebtBackdrop"]
    ];

    closeBindings.forEach(([btnId, sId, bId]) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.addEventListener("click", () => closeBottomSheet(sId, bId));
    });
  }

  // ==========================================
  // 15. FORMS & ACTIONS HANDLERS
  // ==========================================
  function getAppPaymentMethods() {
    if (state.appPrefs && Array.isArray(state.appPrefs.paymentMethods) && state.appPrefs.paymentMethods.length > 0) {
      return state.appPrefs.paymentMethods.map(m => typeof m === 'object' ? (m.name || 'Card') : m);
    }
    return ['Card', 'Cash', 'Bank Transfer', 'PayPal'];
  }

  function populatePaymentMethodsDropdown(selectEl, selectedVal) {
    if (!selectEl) return;
    const methods = getAppPaymentMethods();
    selectEl.innerHTML = "";
    methods.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      selectEl.appendChild(opt);
    });
    if (selectedVal && methods.includes(selectedVal)) {
      selectEl.value = selectedVal;
    } else if (selectedVal) {
      const opt = document.createElement("option");
      opt.value = selectedVal;
      opt.textContent = selectedVal;
      selectEl.appendChild(opt);
      selectEl.value = selectedVal;
    } else if (methods.length > 0) {
      selectEl.value = methods[0];
    }
  }

  function openAddExpenseSheet(isIncome = false) {
    document.getElementById("mobileExpenseModalTitle").textContent = isIncome ? "Log Income" : "Log Expense";
    document.getElementById("mobileEditExpenseId").value = "";
    document.getElementById("mobileExpenseTitle").value = "";
    document.getElementById("mobileExpenseAmount").value = "";
    document.getElementById("mobileExpenseCurrency").value = state.displayCurrency;
    document.getElementById("mobileExpenseCategory").value = isIncome ? "Income" : "Groceries";
    document.getElementById("mobileExpenseDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("mobileExpenseIsBusiness").checked = false;

    const notesEl = document.getElementById("mobileExpenseNotes");
    if (notesEl) notesEl.value = "";
    const incEl = document.getElementById("mobileExpenseIsIncome");
    if (incEl) incEl.checked = isIncome;

    const submitBtn = document.getElementById("mobileExpenseSubmitBtn");
    if (submitBtn) submitBtn.textContent = isIncome ? "Save Income (+)" : "Save Expense";

    populatePaymentMethodsDropdown(document.getElementById("mobileExpensePaymentMethod"));

    const delBtn = document.getElementById("mobileDeleteExpenseBtn");
    if (delBtn) delBtn.classList.add("hidden");
    const dupBtn = document.getElementById("mobileDuplicateExpenseBtn");
    if (dupBtn) dupBtn.classList.add("hidden");
    const recBtn = document.getElementById("mobileMakeRecurringBtn");
    if (recBtn) recBtn.classList.add("hidden");

    state.currentExpenseBeingEdited = null;
    state.modalNoReceiptNeeded = false;
    state.pendingExpenseReceipt = null;
    state.pendingExpenseReceiptName = null;
    updateReceiptBadgeUI(null);

    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("expenseSheet", "expenseSheetBackdrop");
  }

  function openEditExpenseSheet(id) {
    const exp = state.expenses.find(e => e.id === id);
    if (!exp) return;

    const isInc = !!exp.isIncome;
    document.getElementById("mobileExpenseModalTitle").textContent = isInc ? "Edit Income" : "Edit Expense";
    document.getElementById("mobileEditExpenseId").value = exp.id;
    document.getElementById("mobileExpenseTitle").value = exp.title || "";
    document.getElementById("mobileExpenseAmount").value = exp.amount || "";
    document.getElementById("mobileExpenseCurrency").value = exp.currency || state.displayCurrency || "EUR";
    document.getElementById("mobileExpenseCategory").value = exp.category || "Other";
    document.getElementById("mobileExpenseDate").value = exp.date || "";
    document.getElementById("mobileExpenseIsBusiness").checked = !!exp.isBusiness;

    const notesEl = document.getElementById("mobileExpenseNotes");
    if (notesEl) notesEl.value = exp.notes || "";
    const incEl = document.getElementById("mobileExpenseIsIncome");
    if (incEl) incEl.checked = isInc;

    const submitBtn = document.getElementById("mobileExpenseSubmitBtn");
    if (submitBtn) submitBtn.textContent = isInc ? "Save Income (+)" : "Save Expense";

    populatePaymentMethodsDropdown(document.getElementById("mobileExpensePaymentMethod"), exp.paymentMethod || "Card");

    const delBtn = document.getElementById("mobileDeleteExpenseBtn");
    if (delBtn) delBtn.classList.remove("hidden");
    const dupBtn = document.getElementById("mobileDuplicateExpenseBtn");
    if (dupBtn) dupBtn.classList.remove("hidden");
    const recBtn = document.getElementById("mobileMakeRecurringBtn");
    if (recBtn) recBtn.classList.remove("hidden");

    state.currentExpenseBeingEdited = exp;
    state.modalNoReceiptNeeded = !!exp.noReceiptNeeded;
    state.pendingExpenseReceipt = exp.receiptImage || null;
    state.pendingExpenseReceiptName = exp.receiptName || exp.attachmentFileName || null;
    updateReceiptBadgeUI(exp);

    openBottomSheet("expenseSheet", "expenseSheetBackdrop");
  }

  function updateReceiptBadgeUI(exp) {
    const badge = document.getElementById("mobileReceiptStatusBadge");
    const waiveLabel = document.getElementById("mobileToggleWaiveLabel");
    const previewBtn = document.getElementById("mobilePreviewReceiptBtn");

    const hasAtt = !!state.pendingExpenseReceipt || (exp && (exp.hasAttachment || exp.receiptImage));
    const isWaived = !hasAtt && !!state.modalNoReceiptNeeded;

    if (previewBtn) {
      previewBtn.classList.toggle("hidden", !hasAtt);
    }

    if (badge) {
      if (hasAtt) {
        badge.textContent = "Attached ✓";
        badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
      } else if (isWaived) {
        badge.textContent = "Waived";
        badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700";
      } else {
        badge.textContent = "None attached";
        badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700";
      }
    }

    if (waiveLabel) {
      waiveLabel.textContent = isWaived ? "Receipt waived (tap to require)" : "Don't need receipt (remove from missing)";
    }
  }

  function duplicateCurrentExpense() {
    if (!state.currentExpenseBeingEdited) return;
    const exp = state.currentExpenseBeingEdited;
    const copy = Object.assign({}, exp, {
      id: "exp_" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    });
    delete copy.receiptImage;
    delete copy.receiptName;
    copy.hasAttachment = false;
    state.expenses.unshift(copy);
    saveAllToLocalStorage();
    renderExpensesView();
    renderBudgetView();
    pushToVault();
    closeBottomSheet("expenseSheet", "expenseSheetBackdrop");
    showMobileToast("Expense duplicated for today! 📋");
  }

  function makeCurrentExpenseRecurring() {
    if (!state.currentExpenseBeingEdited) return;
    const exp = state.currentExpenseBeingEdited;
    closeBottomSheet("expenseSheet", "expenseSheetBackdrop");

    // Pre-fill subscription sheet
    openAddSubSheet();
    const nameEl = document.getElementById("mobileSubName");
    const amtEl = document.getElementById("mobileSubAmount");
    const curEl = document.getElementById("mobileSubCurrency");
    const catEl = document.getElementById("mobileSubCategory");
    if (nameEl) nameEl.value = exp.title || "";
    if (amtEl) amtEl.value = exp.amount || "";
    if (curEl) curEl.value = exp.currency || state.displayCurrency || "EUR";
    if (catEl) catEl.value = exp.category || "Subscriptions";
    showMobileToast("Pre-filled recurring commitment! 🔁");
  }

  function handleExpenseFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("mobileEditExpenseId").value;
    const title = document.getElementById("mobileExpenseTitle").value.trim();
    const amount = parseFloat(document.getElementById("mobileExpenseAmount").value) || 0;
    const currency = document.getElementById("mobileExpenseCurrency").value;
    const category = document.getElementById("mobileExpenseCategory").value;
    const date = document.getElementById("mobileExpenseDate").value;
    const isBusiness = document.getElementById("mobileExpenseIsBusiness").checked;
    const notes = document.getElementById("mobileExpenseNotes")?.value?.trim() || "";
    const isIncome = !!document.getElementById("mobileExpenseIsIncome")?.checked;
    const paymentMethod = document.getElementById("mobileExpensePaymentMethod")?.value || "Card";

    if (!title || amount <= 0) return;

    const existingExp = id ? state.expenses.find(x => x.id === id) : null;
    const hasAtt = !!state.pendingExpenseReceipt || (existingExp && (existingExp.hasAttachment || existingExp.receiptImage));
    const attFileName = state.pendingExpenseReceiptName || (existingExp && existingExp.attachmentFileName) || "receipt.jpg";
    const noRec = isBusiness ? false : !!state.modalNoReceiptNeeded;

    const targetId = id || ("exp_" + Date.now());

    if (id) {
      const idx = state.expenses.findIndex(x => x.id === id);
      if (idx !== -1) {
        state.expenses[idx] = Object.assign(state.expenses[idx], {
          title, amount, currency, category, date, isBusiness,
          paymentMethod, notes, isIncome,
          hasAttachment: hasAtt,
          attachmentFileName: attFileName,
          noReceiptNeeded: noRec,
          receiptImage: state.pendingExpenseReceipt || state.expenses[idx].receiptImage || null,
          receiptName: state.pendingExpenseReceiptName || state.expenses[idx].receiptName || null
        });
      }
    } else {
      state.expenses.unshift({
        id: targetId,
        title, amount, currency, category, date, isBusiness,
        paymentMethod, notes, isIncome,
        hasAttachment: hasAtt,
        attachmentFileName: attFileName,
        noReceiptNeeded: noRec,
        receiptImage: state.pendingExpenseReceipt || null,
        receiptName: state.pendingExpenseReceiptName || null,
        createdAt: new Date().toISOString()
      });
    }

    if (state.pendingExpenseReceipt && window.location.protocol.startsWith("http")) {
      const isPdf = state.pendingExpenseReceipt.startsWith("data:application/pdf");
      fetch(`/api/attachments/${targetId}`, {
        method: "POST",
        headers: getMobileAuthHeaders(),
        body: JSON.stringify({
          id: targetId,
          type: isPdf ? "pdf" : "image",
          mimeType: isPdf ? "application/pdf" : "image/jpeg",
          fileName: attFileName,
          data: state.pendingExpenseReceipt
        })
      }).catch(err => console.warn("Failed to push attachment:", err));
    }

    saveAllToLocalStorage();
    renderExpensesView();
    renderBudgetView();
    pushToVault();
    closeBottomSheet("expenseSheet", "expenseSheetBackdrop");
    showMobileToast(id ? (isIncome ? "Income updated!" : "Expense updated!") : (isIncome ? "Income saved!" : "Expense saved!"));
  }

  function updateMobilePaymentConversionPreview() {
    const pid = (document.getElementById("mobilePaymentProjectId") || {}).value;
    const p = (state.budget.projects || []).find(x => x.id === pid);
    if (!p) return;
    const projCur = p.currency || state.displayCurrency || "EUR";
    const payCurSelect = document.getElementById("mobilePaymentCurrency");
    const payCur = payCurSelect ? payCurSelect.value : projCur;
    const amtInput = document.getElementById("mobilePaymentAmount");
    const payAmt = parseFloat(amtInput ? amtInput.value : 0) || 0;
    const previewEl = document.getElementById("mobilePaymentConvertedPreview");
    if (!previewEl) return;

    if (payCur !== projCur && payAmt > 0) {
      const credAmt = convertCurrency(payAmt, payCur, projCur);
      previewEl.textContent = `≈ ${formatMoney(credAmt, projCur)} toward project fee`;
      previewEl.classList.remove("hidden");
    } else {
      previewEl.classList.add("hidden");
      previewEl.textContent = "";
    }
  }

  // Log Payment Sheet for Client Projects
  function openLogPaymentSheet(projectId) {
    const p = (state.budget.projects || []).find(x => x.id === projectId);
    if (!p) return;

    const projCur = p.currency || state.displayCurrency || "EUR";
    document.getElementById("mobilePaymentProjectId").value = p.id;
    document.getElementById("mobilePaymentClientSub").textContent = `${p.client} • ${p.title}`;
    const targetFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
    const rem = Math.max(0, targetFee - (parseFloat(p.paidAmount) || 0));
    document.getElementById("mobilePaymentAmount").value = rem > 0 ? rem : "";
    document.getElementById("mobilePaymentDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("mobilePaymentNotes").value = "";

    const curSelect = document.getElementById("mobilePaymentCurrency");
    if (curSelect) {
      curSelect.value = projCur;
      curSelect.dataset.prevCur = projCur;
    }
    updateMobilePaymentConversionPreview();

    openBottomSheet("paymentSheet", "paymentSheetBackdrop");
  }

  function handlePaymentFormSubmit(e) {
    e.preventDefault();
    const pid = document.getElementById("mobilePaymentProjectId").value;
    const amt = parseFloat(document.getElementById("mobilePaymentAmount").value) || 0;
    const date = document.getElementById("mobilePaymentDate").value;
    const method = document.getElementById("mobilePaymentMethod").value;
    const notes = document.getElementById("mobilePaymentNotes").value;

    const p = (state.budget.projects || []).find(x => x.id === pid);
    if (!p || amt <= 0) return;

    const payCurSelect = document.getElementById("mobilePaymentCurrency");
    const payCur = payCurSelect ? payCurSelect.value : (p.currency || "EUR");
    const projCur = p.currency || "EUR";
    const credAmt = (payCur === projCur) ? amt : convertCurrency(amt, payCur, projCur);

    p.paidAmount = (parseFloat(p.paidAmount) || 0) + credAmt;
    if (!p.payments) p.payments = [];
    p.payments.push({
      id: "pay_" + Date.now(),
      amount: amt,
      currency: payCur,
      creditedAmount: credAmt,
      date,
      method,
      notes
    });
    const targetFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
    if (p.paidAmount >= targetFee && targetFee > 0) {
      p.status = 'paid';
      p.paidDate = date;
    }

    saveAllToLocalStorage();
    renderBudgetView();
    pushToVault();
    closeBottomSheet("paymentSheet", "paymentSheetBackdrop");
    showMobileToast(`+${formatMoney(amt, payCur)} deposit recorded!`);
  }

  // Adjust Budgets & Tax Modal
  function openBudgetAdjustSheet() {
    const taxInput = document.getElementById("mobileTaxInput");
    const taxSlider = document.getElementById("mobileTaxSlider");
    const curTax = state.budget.taxReservePercent !== undefined ? state.budget.taxReservePercent : 0;

    if (taxInput) taxInput.value = curTax;
    if (taxSlider) taxSlider.value = curTax;

    document.querySelectorAll(".mobile-tax-preset").forEach(b => {
      const match = parseInt(b.getAttribute("data-tax"), 10) === curTax;
      b.classList.toggle("active", match);
      b.classList.toggle("bg-slate-900", match);
      b.classList.toggle("text-white", match);
      b.classList.toggle("bg-white", !match);
    });

    const catList = document.getElementById("mobileAdjustCategoriesList");
    if (catList) {
      catList.innerHTML = "";
      const categories = state.budget.categories || DEFAULT_BUDGET_CATEGORIES;
      categories.forEach(c => {
        const rawLimit = (c.limit !== undefined && parseFloat(c.limit) > 0)
          ? parseFloat(c.limit)
          : ((state.budget.categoryBudgets && state.budget.categoryBudgets[c.name] > 0) ? parseFloat(state.budget.categoryBudgets[c.name]) : 0);
        const limitCur = c.currency || state.budget.incomeCurrency || "EUR";
        const converted = rawLimit > 0 ? (Math.round(convertCurrency(rawLimit, limitCur, state.displayCurrency) * 100) / 100) : "";
        const row = document.createElement("div");
        row.className = "flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl";
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <i data-lucide="${getCategoryIcon(c.name)}" class="w-3.5 h-3.5 text-slate-600"></i>
            <span class="text-xs font-semibold text-slate-800">${escapeHtml(c.name)}</span>
          </div>
          <div class="flex items-center gap-1 font-mono font-bold text-xs text-slate-900">
            <span>${CURRENCY_SYMBOLS[state.displayCurrency] || state.displayCurrency}</span>
            <input type="number" min="0" step="any" placeholder="0" value="${converted}" class="adjust-cat-limit-input w-16 text-right bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold font-mono" data-cat="${escapeHtml(c.name)}">
          </div>
        `;
        catList.appendChild(row);
      });
      if (window.lucide) window.lucide.createIcons();
    }

    openBottomSheet("budgetAdjustSheet", "budgetAdjustBackdrop");
  }

  function handleSaveBudgetAdjust() {
    const taxVal = parseInt(document.getElementById("mobileTaxInput")?.value || "0", 10);
    state.budget.taxReservePercent = isNaN(taxVal) ? 0 : Math.max(0, taxVal);

    document.querySelectorAll(".adjust-cat-limit-input").forEach(input => {
      const catName = input.getAttribute("data-cat");
      const lim = parseFloat(input.value) || 0;
      let c = (state.budget.categories || []).find(x => (x.name || "").toLowerCase() === (catName || "").toLowerCase());
      if (c) {
        c.limit = lim;
        c.currency = state.displayCurrency;
      }
      if (!state.budget.categoryBudgets) state.budget.categoryBudgets = {};
      state.budget.categoryBudgets[catName] = lim;
    });

    saveAllToLocalStorage();
    renderBudgetView();
    pushToVault();
    closeBottomSheet("budgetAdjustSheet", "budgetAdjustBackdrop");
    showMobileToast("Budget limits & tax updated!");
  }

  // Add / Edit Project Sheet
  function openAddProjectSheet() {
    document.getElementById("mobileProjectModalTitle").textContent = "Add Freelance Project";
    document.getElementById("mobileEditProjectId").value = "";
    document.getElementById("mobileProjectClient").value = "";
    document.getElementById("mobileProjectTitle").value = "";
    document.getElementById("mobileProjectFee").value = "";
    document.getElementById("mobileProjectCurrency").value = state.displayCurrency;
    document.getElementById("mobileProjectInvoiceNum").value = "";
    document.getElementById("mobileProjectDueDate").value = new Date().toISOString().split("T")[0];
    const statusSelect = document.getElementById("mobileProjectStatus");
    if (statusSelect) statusSelect.value = "invoiced";
    const paidContainer = document.getElementById("mobileProjectPaidDateContainer");
    const paidInput = document.getElementById("mobileProjectPaidDate");
    if (paidContainer) paidContainer.classList.add("hidden");
    if (paidInput) paidInput.value = new Date().toISOString().split("T")[0];
    document.getElementById("mobileDeleteProjectBtn").classList.add("hidden");
    const depBtn = document.getElementById("mobileProjectLogDepositSheetBtn");
    if (depBtn) depBtn.classList.add("hidden");
    const docBtn = document.getElementById("mobileProjectViewDocSheetBtn");
    if (docBtn) docBtn.classList.add("hidden");

    openBottomSheet("projectSheet", "projectSheetBackdrop");
  }

  function openEditProjectSheet(id) {
    const p = (state.budget.projects || []).find(x => x.id === id);
    if (!p) return;

    const totalFee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
    const isPaid = p.status === "paid" || ((parseFloat(p.paidAmount) || 0) >= totalFee && totalFee > 0);
    const normalizedStatus = isPaid ? "paid" : (p.status === "expected" ? "expected" : "invoiced");

    document.getElementById("mobileProjectModalTitle").textContent = "Edit Project";
    document.getElementById("mobileEditProjectId").value = p.id;
    document.getElementById("mobileProjectClient").value = p.client || "";
    document.getElementById("mobileProjectTitle").value = p.title || p.description || "";
    document.getElementById("mobileProjectFee").value = p.amount !== undefined ? p.amount : (p.fee || "");
    document.getElementById("mobileProjectCurrency").value = p.currency || "EUR";
    document.getElementById("mobileProjectInvoiceNum").value = p.invoiceNumber || "";
    document.getElementById("mobileProjectDueDate").value = p.dueDate || "";

    const statusSelect = document.getElementById("mobileProjectStatus");
    if (statusSelect) statusSelect.value = normalizedStatus;
    const paidContainer = document.getElementById("mobileProjectPaidDateContainer");
    const paidInput = document.getElementById("mobileProjectPaidDate");
    if (paidContainer && paidInput) {
      if (isPaid) {
        paidContainer.classList.remove("hidden");
        paidInput.value = getProjectPaidDate(p) || new Date().toISOString().split("T")[0];
      } else {
        paidContainer.classList.add("hidden");
        paidInput.value = p.paidDate || p.dueDate || new Date().toISOString().split("T")[0];
      }
    }
    document.getElementById("mobileDeleteProjectBtn").classList.remove("hidden");

    const depBtn = document.getElementById("mobileProjectLogDepositSheetBtn");
    if (depBtn) {
      depBtn.classList.toggle("hidden", isPaid);
      depBtn.onclick = () => {
        closeBottomSheet("projectSheet", "projectSheetBackdrop");
        openLogPaymentSheet(p.id);
      };
    }

    const docBtn = document.getElementById("mobileProjectViewDocSheetBtn");
    if (docBtn) {
      const hasDoc = !!(p.hasInvoiceDoc || p.hasReceiptDoc || p.hasProformaDoc);
      docBtn.classList.toggle("hidden", !hasDoc);
      docBtn.onclick = () => {
        closeBottomSheet("projectSheet", "projectSheetBackdrop");
        openMobileProjectDoc(p);
      };
    }

    openBottomSheet("projectSheet", "projectSheetBackdrop");
  }

  function handleProjectFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("mobileEditProjectId").value;
    const client = document.getElementById("mobileProjectClient").value.trim();
    const title = document.getElementById("mobileProjectTitle").value.trim();
    const fee = parseFloat(document.getElementById("mobileProjectFee").value) || 0;
    const currency = document.getElementById("mobileProjectCurrency").value;
    const invoiceNumber = document.getElementById("mobileProjectInvoiceNum").value.trim();
    const dueDate = document.getElementById("mobileProjectDueDate").value;
    const status = document.getElementById("mobileProjectStatus") ? document.getElementById("mobileProjectStatus").value : "invoiced";
    const paidInput = document.getElementById("mobileProjectPaidDate");
    const existing = id ? (state.budget.projects || []).find(p => p.id === id) : null;
    const effectivePaidDate = (paidInput && paidInput.value) || (existing && existing.paidDate) || dueDate || new Date().toISOString().split("T")[0];
    const paidDate = status === "paid" ? effectivePaidDate : "";

    if (!client || !title || fee <= 0) return;

    if (!state.budget.projects) state.budget.projects = [];

    if (id) {
      const idx = state.budget.projects.findIndex(p => p.id === id);
      if (idx !== -1) {
        const curProj = state.budget.projects[idx];
        const existingPayments = Array.isArray(curProj.payments)
          ? curProj.payments.map(pay => Object.assign({}, pay))
          : [];
        const existingTotalFee = parseFloat(curProj.amount !== undefined ? curProj.amount : curProj.fee) || 0;
        const wasPaid = curProj.status === "paid" || ((parseFloat(curProj.paidAmount) || 0) >= existingTotalFee && existingTotalFee > 0);

        let nextPaidAmount = 0;
        let nextPayments = existingPayments;

        if (status === "paid") {
          nextPaidAmount = fee;
          if (nextPayments.length === 0) {
            nextPayments = [{ id: "pay_init", amount: fee, currency, creditedAmount: fee, date: effectivePaidDate, notes: "Full fee" }];
          } else if (nextPayments.length === 1 && nextPayments[0].id === "pay_init") {
            nextPayments[0] = Object.assign({}, nextPayments[0], {
              amount: fee,
              currency,
              creditedAmount: fee,
              date: paidDate || nextPayments[0].date || effectivePaidDate
            });
          } else {
            const sumCredited = nextPayments.reduce((s, pay) => {
              const pAmt = parseFloat(pay.creditedAmount !== undefined ? pay.creditedAmount : pay.amount) || 0;
              return s + pAmt;
            }, 0);
            const diffRem = fee - sumCredited;
            if (diffRem > 0.01) {
              nextPayments.push({
                id: "pay_" + Date.now(),
                amount: diffRem,
                currency,
                creditedAmount: diffRem,
                date: effectivePaidDate,
                notes: "Balance settled"
              });
            }
          }
        } else {
          if (wasPaid) {
            nextPayments = nextPayments.filter(pay => pay.id !== "pay_init");
          }
          nextPaidAmount = nextPayments.reduce((s, pay) => {
            const pAmt = parseFloat(pay.creditedAmount !== undefined ? pay.creditedAmount : pay.amount) || 0;
            return s + pAmt;
          }, 0);
          if (wasPaid && nextPaidAmount >= fee) {
            nextPaidAmount = 0;
            nextPayments = [];
          }
        }

        state.budget.projects[idx] = Object.assign(curProj, {
          client,
          title,
          description: title,
          fee,
          amount: fee,
          currency,
          invoiceNumber,
          dueDate,
          status,
          paidDate,
          paidAmount: nextPaidAmount,
          payments: nextPayments
        });
      }
    } else {
      state.budget.projects.unshift({
        id: "proj_" + Date.now(),
        client,
        title,
        description: title,
        fee,
        amount: fee,
        currency,
        invoiceNumber,
        dueDate,
        status,
        paidDate,
        paidAmount: status === "paid" ? fee : 0,
        payments: status === "paid" ? [{ id: "pay_init", amount: fee, currency, creditedAmount: fee, date: effectivePaidDate, notes: "Full fee" }] : [],
        steps: [
          { id: "step_quote", title: "Sent price offering / quote", completed: true, completedDate: new Date().toISOString().split("T")[0], isDefault: true },
          { id: "step_proforma", title: "Sent proforma invoice", completed: false, isDefault: true },
          { id: "step_deadline", title: "Project deadline & final delivery", completed: false, isDefault: true, isMandatory: true },
          { id: "step_payment", title: "Got paid (full amount received)", completed: status === "paid", completedDate: status === "paid" ? effectivePaidDate : "", isDefault: true, isMandatory: true },
          { id: "step_receipt", title: "Sent official tax receipt", completed: false, isDefault: true, isMandatory: true }
        ],
        createdAt: new Date().toISOString()
      });
    }

    saveAllToLocalStorage();
    renderBudgetView();
    renderProjectFollowupView();
    pushToVault();
    closeBottomSheet("projectSheet", "projectSheetBackdrop");
    showMobileToast("Project saved!");
  }

  // ==========================================
  // 13.5. PROJECT FOLLOWUP & LEADS ENGINE
  // ==========================================
  function isProjectDone(p) {
    if (!p) return false;
    if (p.isDone === true || p.status === 'completed' || p.status === 'done') return true;
    if (p.isDone === false) return false;
    if (p.status === 'paid') {
      if (Array.isArray(p.steps) && p.steps.length > 0) {
        return p.steps.every(s => s.completed);
      }
      return true;
    }
    return false;
  }

  function renderProjectFollowupView() {
    if (!state.budget) state.budget = {};
    if (!Array.isArray(state.budget.leads)) state.budget.leads = [];
    if (!Array.isArray(state.budget.projects)) state.budget.projects = [];

    const cur = state.displayCurrency || 'EUR';
    const selectedMonth = state.selectedMonth || 'ALL';
    const isAllTime = (!selectedMonth || selectedMonth === 'ALL' || selectedMonth === 'all');

    const allLeads = state.budget.leads || [];
    const allProjects = state.budget.projects || [];

    const leads = isAllTime ? allLeads : allLeads.filter(l => leadMatchesMonth(l, selectedMonth));
    const projects = isAllTime ? allProjects : allProjects.filter(p => projectMatchesMonth(p, selectedMonth));

    // Calculate Summary Metrics
    let totalLeadsMoney = 0;
    leads.forEach(l => {
      const amt = parseFloat(l.amount) || 0;
      totalLeadsMoney += convertCurrency(amt, l.currency || cur, cur);
    });

    const activeProjects = [];
    const completedProjects = [];
    let totalProjectsMoney = 0;
    let totalCompletedMoney = 0;
    let dueSoonCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourteenDaysLater = new Date(today.getTime() + 14 * 86400000);

    projects.forEach(p => {
      const fee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
      const feeConverted = convertCurrency(fee, p.currency || cur, cur);
      const done = isProjectDone(p);

      if (done) {
        completedProjects.push(p);
        totalCompletedMoney += feeConverted;
      } else {
        activeProjects.push(p);
        totalProjectsMoney += feeConverted;

        if (p.dueDate) {
          const d = new Date(p.dueDate + 'T00:00:00');
          if (!isNaN(d.getTime()) && d <= fourteenDaysLater) {
            dueSoonCount++;
          }
        }
      }
    });

    // Populate summary strip
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('mobileFollowupLeadsCount', String(leads.length));
    setTxt('mobileFollowupLeadsMoney', formatMoney(totalLeadsMoney, cur));
    setTxt('mobileFollowupProjectsCount', String(activeProjects.length));
    setTxt('mobileFollowupProjectsMoney', formatMoney(totalProjectsMoney, cur));
    setTxt('mobileFollowupDueCount', String(dueSoonCount));

    setTxt('mobileFollowupLeadsBadge', String(leads.length));
    const leadsPill = document.getElementById('mobileFollowupLeadsMoneyPill');
    if (leadsPill) {
      if (totalLeadsMoney > 0) {
        leadsPill.textContent = `+${formatMoney(totalLeadsMoney, cur)}`;
        leadsPill.classList.remove('hidden');
      } else {
        leadsPill.classList.add('hidden');
      }
    }

    setTxt('mobileFollowupProjectsBadge', String(activeProjects.length));
    const projectsPill = document.getElementById('mobileFollowupProjectsMoneyPill');
    if (projectsPill) {
      if (totalProjectsMoney > 0) {
        projectsPill.textContent = `${formatMoney(totalProjectsMoney, cur)}`;
        projectsPill.classList.remove('hidden');
      } else {
        projectsPill.classList.add('hidden');
      }
    }

    setTxt('mobileFollowupCompletedBadge', String(completedProjects.length));
    const completedPill = document.getElementById('mobileFollowupCompletedMoneyPill');
    if (completedPill) {
      if (totalCompletedMoney > 0) {
        completedPill.textContent = `${formatMoney(totalCompletedMoney, cur)}`;
        completedPill.classList.remove('hidden');
      } else {
        completedPill.classList.add('hidden');
      }
    }

    // Render Leads List
    renderMobileLeadsList(leads, cur);

    // Render Ongoing Projects List
    renderMobileFollowupProjectsList(activeProjects, cur, false);

    // Render Completed Projects List
    renderMobileFollowupProjectsList(completedProjects, cur, true);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  const TAG_COLOR_PALETTE = {
    black: { id: 'black', dotClass: 'bg-slate-900', textClass: 'text-slate-900', hex: '#0f172a' },
    slate: { id: 'slate', dotClass: 'bg-slate-400', textClass: 'text-slate-600', hex: '#64748b' },
    brown: { id: 'brown', dotClass: 'bg-amber-900', textClass: 'text-amber-900', hex: '#78350f' },
    red: { id: 'red', dotClass: 'bg-red-500', textClass: 'text-red-600', hex: '#ef4444' },
    orange: { id: 'orange', dotClass: 'bg-orange-500', textClass: 'text-orange-600', hex: '#f97316' },
    amber: { id: 'amber', dotClass: 'bg-amber-500', textClass: 'text-amber-600', hex: '#f59e0b' },
    yellow: { id: 'yellow', dotClass: 'bg-yellow-400', textClass: 'text-yellow-700', hex: '#ca8a04' },
    lime: { id: 'lime', dotClass: 'bg-lime-500', textClass: 'text-lime-600', hex: '#84cc16' },
    emerald: { id: 'emerald', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600', hex: '#10b981' },
    teal: { id: 'teal', dotClass: 'bg-teal-600', textClass: 'text-teal-700', hex: '#0d9488' },
    cyan: { id: 'cyan', dotClass: 'bg-cyan-500', textClass: 'text-cyan-600', hex: '#06b6d4' },
    blue: { id: 'blue', dotClass: 'bg-blue-500', textClass: 'text-blue-600', hex: '#3b82f6' },
    indigo: { id: 'indigo', dotClass: 'bg-indigo-500', textClass: 'text-indigo-600', hex: '#6366f1' },
    purple: { id: 'purple', dotClass: 'bg-purple-500', textClass: 'text-purple-600', hex: '#a855f7' },
    pink: { id: 'pink', dotClass: 'bg-pink-500', textClass: 'text-pink-600', hex: '#ec4899' }
  };

  const COLOR_ALIASES = {
    rose: 'red',
    fuchsia: 'pink',
    violet: 'purple'
  };

  const DEFAULT_LEAD_TAG_DEFINITIONS = [
    { name: 'Emailing', defaultColor: 'amber' },
    { name: 'Quote Sent', defaultColor: 'blue' },
    { name: 'Waiting for Answer', defaultColor: 'purple' },
    { name: 'Negotiating', defaultColor: 'emerald' },
    { name: 'Passed / Lost', defaultColor: 'slate' }
  ];

  function resolveLeadTagColor(tagName, fallbackColor = 'indigo') {
    if (!tagName) return TAG_COLOR_PALETTE[fallbackColor] || TAG_COLOR_PALETTE.indigo;
    const sLower = tagName.toLowerCase();
    if (state.budget && state.budget.leadTagColors && state.budget.leadTagColors[sLower]) {
      let cKey = state.budget.leadTagColors[sLower];
      if (COLOR_ALIASES[cKey]) cKey = COLOR_ALIASES[cKey];
      if (TAG_COLOR_PALETTE[cKey]) return TAG_COLOR_PALETTE[cKey];
    }
    if (state.budget && Array.isArray(state.budget.leadTags)) {
      const custom = state.budget.leadTags.find(t => (typeof t === 'object' && t && t.name && t.name.toLowerCase() === sLower));
      if (custom && custom.color) {
        const cKey = COLOR_ALIASES[custom.color] || custom.color;
        if (TAG_COLOR_PALETTE[cKey]) return TAG_COLOR_PALETTE[cKey];
      }
    }
    const def = DEFAULT_LEAD_TAG_DEFINITIONS.find(d => d.name.toLowerCase() === sLower || (d.name.toLowerCase().startsWith('passed') && sLower.startsWith('passed')));
    if (def) {
      const dColor = COLOR_ALIASES[def.defaultColor] || def.defaultColor;
      if (TAG_COLOR_PALETTE[dColor]) return TAG_COLOR_PALETTE[dColor];
    }
    const fColor = COLOR_ALIASES[fallbackColor] || fallbackColor;
    return TAG_COLOR_PALETTE[fColor] || TAG_COLOR_PALETTE.indigo;
  }

  function syncMobileLeadStatusOptions(currentStatus) {
    const select = document.getElementById('mobileLeadStatus');
    if (!select) return;
    const defaultOptions = [
      { value: 'Emailing', label: '💬 Initial Emailing / Chatting' },
      { value: 'Quote Sent', label: '📄 Price Offering Sent' },
      { value: 'Waiting for Answer', label: '⏳ Waiting for Answer' },
      { value: 'Negotiating', label: '🤝 Negotiating Scope' },
      { value: 'Passed / Lost', label: '❌ Passed / Lost' }
    ];
    const customTags = (state.budget && Array.isArray(state.budget.leadTags)) ? state.budget.leadTags : [];
    const customList = customTags.map(t => typeof t === 'string' ? t : (t && t.name ? t.name : '')).filter(Boolean);

    let html = defaultOptions.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    customList.forEach(ct => {
      if (!defaultOptions.some(d => d.value.toLowerCase() === ct.toLowerCase())) {
        html += `<option value="${escapeHtml(ct)}">🏷️ ${escapeHtml(ct)}</option>`;
      }
    });
    if (currentStatus && !defaultOptions.some(d => d.value.toLowerCase() === currentStatus.toLowerCase()) && !customList.some(ct => ct.toLowerCase() === currentStatus.toLowerCase())) {
      html += `<option value="${escapeHtml(currentStatus)}">🏷️ ${escapeHtml(currentStatus)}</option>`;
    }
    select.innerHTML = html;
    if (currentStatus) select.value = currentStatus;
  }

  function renderMobileLeadsList(leads, cur) {
    const list = document.getElementById('mobileFollowupLeadsList');
    const empty = document.getElementById('mobileFollowupLeadsEmpty');
    if (!list) return;

    list.innerHTML = '';
    if (!leads || leads.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    const cardBox = document.createElement('div');
    cardBox.className = 'bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden';

    leads.forEach(lead => {
      const amt = parseFloat(lead.amount) || 0;
      const leadCur = lead.currency || cur;
      const amtInActive = convertCurrency(amt, leadCur, cur);
      const rowTitle = lead.client && lead.title ? `${lead.client} — ${lead.title}` : (lead.client || lead.title || 'Untitled Lead');
      const tagColor = resolveLeadTagColor(lead.status || 'Emailing');

      const row = document.createElement('div');
      row.className = 'px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer tap-bounce';
      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0 ${tagColor.dotClass}"></span>
          <span class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(rowTitle)}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-mono font-bold text-sm text-slate-900">${amt > 0 ? formatMoney(amtInActive, cur) : '—'}</span>
        </div>
      `;

      row.addEventListener('click', () => {
        openEditLeadSheet(lead);
      });

      cardBox.appendChild(row);
    });

    list.appendChild(cardBox);
  }

  function renderMobileFollowupProjectsList(projects, cur, isCompleted) {
    const list = isCompleted
      ? document.getElementById('mobileFollowupCompletedList')
      : document.getElementById('mobileFollowupProjectsList');
    const empty = isCompleted
      ? null
      : document.getElementById('mobileFollowupProjectsEmpty');
    if (!list) return;

    list.innerHTML = '';
    if (!projects || projects.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    const cardBox = document.createElement('div');
    cardBox.className = 'bg-white rounded-3xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100 overflow-hidden';

    projects.forEach(p => {
      const fee = parseFloat(p.amount !== undefined ? p.amount : p.fee) || 0;
      const feeConverted = convertCurrency(fee, p.currency || cur, cur);
      const rowTitle = p.client && p.title ? `${p.client} — ${p.title}` : (p.client || p.title || 'Untitled Project');
      const dotColor = isCompleted ? '#10b981' : (p.status === 'invoiced' ? '#f59e0b' : '#0ea5e9');

      const row = document.createElement('div');
      row.className = 'px-4 py-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors cursor-pointer tap-bounce';
      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${dotColor};"></span>
          <span class="font-semibold text-xs text-slate-900 truncate">${escapeHtml(rowTitle)}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-mono font-bold text-sm ${isCompleted ? 'text-emerald-600' : 'text-slate-900'}">${formatMoney(feeConverted, cur)}</span>
        </div>
      `;

      row.addEventListener('click', () => {
        openEditProjectSheet(p.id);
      });

      cardBox.appendChild(row);
    });

    list.appendChild(cardBox);
  }

  // Leads Sheets & Operations
  function openAddLeadSheet() {
    const titleEl = document.getElementById('mobileLeadModalTitle');
    if (titleEl) titleEl.textContent = 'Add New Lead';
    document.getElementById('mobileLeadId').value = '';
    document.getElementById('mobileLeadClient').value = '';
    document.getElementById('mobileLeadTitle').value = '';
    document.getElementById('mobileLeadAmount').value = '';
    document.getElementById('mobileLeadCurrency').value = state.displayCurrency || 'EUR';
    syncMobileLeadStatusOptions('Emailing');
    document.getElementById('mobileLeadNotes').value = '';

    const delBtn = document.getElementById('mobileDeleteLeadBtn');
    if (delBtn) delBtn.classList.add('hidden');
    const convertBtn = document.getElementById('mobileConvertLeadToProjectBtn');
    if (convertBtn) convertBtn.classList.add('hidden');

    openBottomSheet('leadSheet', 'leadSheetBackdrop');
  }

  function openEditLeadSheet(lead) {
    if (!lead) return;
    const titleEl = document.getElementById('mobileLeadModalTitle');
    if (titleEl) titleEl.textContent = 'Edit Lead';
    document.getElementById('mobileLeadId').value = lead.id || '';
    document.getElementById('mobileLeadClient').value = lead.client || '';
    document.getElementById('mobileLeadTitle').value = lead.title || '';
    document.getElementById('mobileLeadAmount').value = lead.amount || '';
    document.getElementById('mobileLeadCurrency').value = lead.currency || state.displayCurrency || 'EUR';
    syncMobileLeadStatusOptions(lead.status || 'Emailing');
    document.getElementById('mobileLeadNotes').value = lead.notes || '';

    const delBtn = document.getElementById('mobileDeleteLeadBtn');
    if (delBtn) delBtn.classList.remove('hidden');
    const convertBtn = document.getElementById('mobileConvertLeadToProjectBtn');
    if (convertBtn) convertBtn.classList.remove('hidden');

  }

  function closeLeadSheet() {
    closeBottomSheet('leadSheet', 'leadSheetBackdrop');
  }

  function handleLeadFormSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!state.budget) state.budget = {};
    if (!Array.isArray(state.budget.leads)) state.budget.leads = [];

    const id = document.getElementById('mobileLeadId').value;
    const client = document.getElementById('mobileLeadClient').value.trim();
    const title = document.getElementById('mobileLeadTitle').value.trim();
    const amount = parseFloat(document.getElementById('mobileLeadAmount').value) || 0;
    const currency = document.getElementById('mobileLeadCurrency').value;
    const status = document.getElementById('mobileLeadStatus').value;
    const notes = document.getElementById('mobileLeadNotes').value.trim();

    if (!client || !title) return;

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const isLost = isLeadLost({ status });

    if (id) {
      const idx = state.budget.leads.findIndex(l => l.id === id);
      if (idx !== -1) {
        const existing = state.budget.leads[idx];
        const statusDate = (existing.status === status && existing.statusDate) ? existing.statusDate : todayStr;
        const lostDate = isLost ? ((existing.status === status && existing.lostDate) ? existing.lostDate : statusDate) : null;
        state.budget.leads[idx] = Object.assign(state.budget.leads[idx], {
          client, title, amount, currency, status, notes, statusDate, lostDate
        });
      }
    } else {
      let initialCreatedAt = nowIso;
      if (state.selectedMonth && state.selectedMonth !== 'ALL' && state.selectedMonth !== 'all') {
        if (!todayStr.startsWith(state.selectedMonth)) {
          initialCreatedAt = `${state.selectedMonth}-01T12:00:00.000Z`;
        }
      }
      const newLead = {
        id: 'lead_' + Date.now(),
        client,
        title,
        amount,
        currency,
        status,
        notes,
        statusDate: todayStr,
        lostDate: isLost ? todayStr : null,
        createdAt: initialCreatedAt
      };
      state.budget.leads.unshift(newLead);
    }

    saveAllToLocalStorage();
    renderProjectFollowupView();
    pushToVault();
    closeLeadSheet();
    showMobileToast('Lead saved!');
  }

  async function deleteLead(leadId) {
    if (!state.budget || !Array.isArray(state.budget.leads)) return;
    if (!await confirmAction('Delete this lead?')) return;
    state.budget.leads = state.budget.leads.filter(l => l.id !== leadId);
    saveAllToLocalStorage();
    renderProjectFollowupView();
    pushToVault();
    closeLeadSheet();
    showMobileToast('Lead deleted');
  }

  function convertLeadToProject(leadId) {
    if (!state.budget || !Array.isArray(state.budget.leads)) return;
    const lead = state.budget.leads.find(l => l.id === leadId);
    if (!lead) return;

    if (!Array.isArray(state.budget.projects)) state.budget.projects = [];
    const projId = 'proj_' + Date.now();
    const newProj = {
      id: projId,
      client: lead.client || '',
      title: lead.title || '',
      amount: parseFloat(lead.amount) || 0,
      fee: parseFloat(lead.amount) || 0,
      currency: lead.currency || state.displayCurrency || 'EUR',
      status: 'expected',
      dueDate: '',
      notes: lead.notes || '',
      payments: [],
      steps: [
        { id: 'step_quote', title: 'Sent price offering / quote', completed: true, completedDate: new Date().toISOString().split('T')[0], isDefault: true },
        { id: 'step_proforma', title: 'Sent proforma invoice', completed: false, isDefault: true },
        { id: 'step_deadline', title: 'Project deadline & final delivery', completed: false, isDefault: true, isMandatory: true },
        { id: 'step_payment', title: 'Got paid (full amount received)', completed: false, isDefault: true, isMandatory: true },
        { id: 'step_receipt', title: 'Sent official tax receipt', completed: false, isDefault: true, isMandatory: true }
      ],
      links: Array.isArray(lead.links) ? JSON.parse(JSON.stringify(lead.links)) : [],
      images: Array.isArray(lead.images) ? JSON.parse(JSON.stringify(lead.images)) : [],
      createdAt: new Date().toISOString()
    };
    state.budget.projects.unshift(newProj);
    state.budget.leads = state.budget.leads.filter(l => l.id !== leadId);

    saveAllToLocalStorage();
    renderProjectFollowupView();
    renderBudgetView();
    pushToVault();
    closeLeadSheet();
    showMobileToast('Project started! 🚀');
  }

  function convertProjectToLead(projId) {
    if (!state.budget || !Array.isArray(state.budget.projects)) return;
    const project = state.budget.projects.find(p => p.id === projId);
    if (!project) return;

    if (!Array.isArray(state.budget.leads)) state.budget.leads = [];
    const leadId = 'lead_' + Date.now();
    const newLead = {
      id: leadId,
      client: project.client || '',
      title: project.title || project.description || '',
      amount: parseFloat(project.amount !== undefined ? project.amount : project.fee) || 0,
      currency: project.currency || state.displayCurrency || 'EUR',
      status: project.leadStatus || 'Negotiating',
      notes: project.notes || '',
      notesList: Array.isArray(project.notesList) ? JSON.parse(JSON.stringify(project.notesList)) : undefined,
      targetDate: project.dueDate || '',
      statusDate: new Date().toISOString().split('T')[0],
      steps: Array.isArray(project.steps) ? JSON.parse(JSON.stringify(project.steps)) : [],
      links: Array.isArray(project.links) ? JSON.parse(JSON.stringify(project.links)) : [],
      images: Array.isArray(project.images) ? JSON.parse(JSON.stringify(project.images)) : [],
      hasQuoteDoc: !!(project.hasProformaDoc || project.hasInvoiceDoc || project.hasQuoteDoc),
      quoteDocName: project.proformaDocName || project.invoiceDocName || project.quoteDocName || '',
      hasBriefDoc: !!(project.hasReceiptDoc || project.hasBriefDoc),
      briefDocName: project.briefDocName || project.receiptDocName || '',
      createdAt: project.createdAt || new Date().toISOString()
    };

    state.budget.leads.unshift(newLead);
    state.budget.projects = state.budget.projects.filter(p => p.id !== projId);

    saveAllToLocalStorage();
    renderProjectFollowupView();
    renderBudgetView();
    pushToVault();
    closeBottomSheet('projectSheet', 'projectSheetBackdrop');
    showMobileToast('Converted to Lead 💡');
  }

  function updateMobileColorPickerActive(color) {
    document.querySelectorAll("#mobileNoteColorPicker button").forEach(b => {
      const c = b.getAttribute("data-color");
      if (c && c.toLowerCase() === (color || '').toLowerCase()) {
        b.classList.remove("border-transparent");
        b.classList.add("border-slate-900", "ring-2", "ring-slate-900/20");
      } else {
        b.classList.remove("border-slate-900", "ring-2", "ring-slate-900/20");
        b.classList.add("border-transparent");
      }
    });
  }

  function getMobileNoteBodyBlocks(note) {
    if (!note) return [];
    if (Array.isArray(note.bodyBlocks) && note.bodyBlocks.length > 0) {
      return note.bodyBlocks.map(b => String(b || ""));
    }
    if (note.body !== undefined && note.body !== null && String(note.body).trim() !== "") {
      return [String(note.body)];
    }
    return [];
  }

  function getMobileBodyBoxesFromDOM() {
    const container = document.getElementById("mobileNoteBodyBoxesContainer");
    if (!container) {
      const single = document.getElementById("mobileNoteBody");
      return single ? [single.value || ""] : [""];
    }
    const inputs = Array.from(container.querySelectorAll(".mobile-note-body-box-input"));
    if (inputs.length === 0) return [""];
    return inputs.map(el => el.value || "");
  }

  function renderMobileNoteBodyBoxes(boxes = [""]) {
    const container = document.getElementById("mobileNoteBodyBoxesContainer");
    if (!container) return;
    const list = (Array.isArray(boxes) && boxes.length > 0) ? boxes : [""];
    const hasMultiple = list.length > 1;
    container.innerHTML = list.map((val, idx) => `
      <div class="relative">
        <textarea ${idx === 0 ? 'id="mobileNoteBody"' : ''} data-box-idx="${idx}" rows="${hasMultiple ? 2 : 3}" placeholder="${idx === 0 ? 'Add details, steps or context...' : `Text box ${idx + 1}...`}" class="mobile-note-body-box-input w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 ${hasMultiple ? 'pr-16' : ''} text-xs text-slate-900 focus:bg-white focus:outline-none resize-none">${escapeHtml(val || "")}</textarea>
        ${hasMultiple ? `
          <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5">
            ${idx > 0 ? `<button type="button" class="mobile-move-note-body-box-btn text-slate-300 hover:text-slate-600 p-1 rounded-lg" data-idx="${idx}" data-dir="-1" title="Move box up"><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i></button>` : ''}
            ${idx < list.length - 1 ? `<button type="button" class="mobile-move-note-body-box-btn text-slate-300 hover:text-slate-600 p-1 rounded-lg" data-idx="${idx}" data-dir="1" title="Move box down"><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button>` : ''}
            <button type="button" class="mobile-remove-note-body-box-btn text-slate-300 hover:text-rose-600 p-1 rounded-lg" data-idx="${idx}" title="Remove text box">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `).join("");
    if (window.lucide) window.lucide.createIcons();
  }

  function openAddNoteSheet() {
    const titleEl = document.getElementById("mobileNoteModalTitle");
    if (titleEl) titleEl.textContent = "Add Note";
    const editIdEl = document.getElementById("mobileEditNoteId");
    if (editIdEl) editIdEl.value = "";
    const noteTitleEl = document.getElementById("mobileNoteTitle");
    if (noteTitleEl) noteTitleEl.value = "";
    const noteLabelEl = document.getElementById("mobileNoteLabel");
    if (noteLabelEl) noteLabelEl.value = "";
    const dueDateEl = document.getElementById("mobileNoteDueDate");
    if (dueDateEl) dueDateEl.value = "";
    renderMobileNoteBodyBoxes([""]);
    const colorIn = document.getElementById("mobileNoteColorInput");
    if (colorIn) colorIn.value = "#f59e0b";
    updateMobileColorPickerActive("#f59e0b");
    const delBtn = document.getElementById("mobileDeleteNoteBtn");
    if (delBtn) delBtn.classList.add("hidden");
    state.pendingNoteAttachments = [];
    state.pendingNoteLinks = [];
    cancelMobileEditingLink();
    const linkUrl = document.getElementById("mobileNoteLinkUrl");
    if (linkUrl) linkUrl.value = "";
    const linkTitle = document.getElementById("mobileNoteLinkTitle");
    if (linkTitle) linkTitle.value = "";
    renderPendingNoteAttachments();
    renderPendingNoteLinks();
    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("noteSheet", "noteSheetBackdrop");
  }

  function openEditNoteSheet(note) {
    if (!note) return;
    const titleEl = document.getElementById("mobileNoteModalTitle");
    if (titleEl) titleEl.textContent = "Edit Note";
    const editIdEl = document.getElementById("mobileEditNoteId");
    if (editIdEl) editIdEl.value = note.id;
    const noteTitleEl = document.getElementById("mobileNoteTitle");
    if (noteTitleEl) noteTitleEl.value = note.title || "";
    const noteLabelEl = document.getElementById("mobileNoteLabel");
    if (noteLabelEl) noteLabelEl.value = note.label || "";
    const dueDateEl = document.getElementById("mobileNoteDueDate");
    if (dueDateEl) dueDateEl.value = note.dueDate || "";
    const initialBoxes = getMobileNoteBodyBlocks(note);
    renderMobileNoteBodyBoxes(initialBoxes.length > 0 ? initialBoxes : [""]);
    const color = note.color || "#6366f1";
    const colorIn = document.getElementById("mobileNoteColorInput");
    if (colorIn) colorIn.value = color;
    updateMobileColorPickerActive(color);
    const delBtn = document.getElementById("mobileDeleteNoteBtn");
    if (delBtn) delBtn.classList.remove("hidden");
    state.pendingNoteAttachments = (note.attachments || []).slice();
    state.pendingNoteLinks = (note.links || []).slice();
    cancelMobileEditingLink();
    const linkUrl = document.getElementById("mobileNoteLinkUrl");
    if (linkUrl) linkUrl.value = "";
    const linkTitle = document.getElementById("mobileNoteLinkTitle");
    if (linkTitle) linkTitle.value = "";
    renderPendingNoteAttachments();
    renderPendingNoteLinks();
    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("noteSheet", "noteSheetBackdrop");
  }

  // ==========================================
  // 15b. GLOBAL MODAL OPENERS & ACTIONS (MODULE SCOPE)
  // ==========================================
  function openAddDebtSheet() {
    document.getElementById("mobileDebtModalTitle").textContent = "Add Bill / Debt";
    document.getElementById("mobileEditDebtId").value = "";
    document.getElementById("mobileDebtName").value = "";
    document.getElementById("mobileDebtAmount").value = "";
    document.getElementById("mobileDebtCurrency").value = state.displayCurrency;
    document.getElementById("mobileDebtCategory").value = "Bills";
    document.getElementById("mobileDebtDueDate").value = "";
    const delBtn = document.getElementById("mobileDeleteDebtBtn");
    if (delBtn) delBtn.classList.add("hidden");
    const partBtn = document.getElementById("mobilePartialDebtSheetBtn");
    if (partBtn) partBtn.classList.add("hidden");
    const settleBtn = document.getElementById("mobileSettleDebtSheetBtn");
    if (settleBtn) settleBtn.classList.add("hidden");
    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("debtSheet", "debtSheetBackdrop");
  }

  function openEditDebtSheet(d) {
    if (!d) return;
    const debtTitle = d.title || d.name || "Debt";
    document.getElementById("mobileDebtModalTitle").textContent = "Edit Bill / Debt";
    document.getElementById("mobileEditDebtId").value = d.id;
    document.getElementById("mobileDebtName").value = debtTitle;
    document.getElementById("mobileDebtAmount").value = d.amount !== undefined ? d.amount : "";
    document.getElementById("mobileDebtCurrency").value = d.currency || state.displayCurrency;
    document.getElementById("mobileDebtCategory").value = d.category || "Bills";
    document.getElementById("mobileDebtDueDate").value = d.dueDate || "";
    const delBtn = document.getElementById("mobileDeleteDebtBtn");
    if (delBtn) delBtn.classList.remove("hidden");

    const partBtn = document.getElementById("mobilePartialDebtSheetBtn");
    if (partBtn) {
      partBtn.classList.remove("hidden");
      partBtn.onclick = () => {
        closeBottomSheet("debtSheet", "debtSheetBackdrop");
        openPayDebtPartialSheet(d.id);
      };
    }

    const settleBtn = document.getElementById("mobileSettleDebtSheetBtn");
    if (settleBtn) {
      settleBtn.classList.remove("hidden");
      settleBtn.onclick = () => {
        closeBottomSheet("debtSheet", "debtSheetBackdrop");
        settleDebtItem(d.id);
      };
    }

    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("debtSheet", "debtSheetBackdrop");
  }

  function openAddSubSheet() {
    document.getElementById("mobileSubModalTitle").textContent = "Add Recurring";
    document.getElementById("mobileEditSubId").value = "";
    document.getElementById("mobileSubName").value = "";
    document.getElementById("mobileSubAmount").value = "";
    document.getElementById("mobileSubCurrency").value = state.displayCurrency;
    const catEl = document.getElementById("mobileSubCategory");
    if (catEl) catEl.value = "Subscriptions";
    document.getElementById("mobileSubCycle").value = "monthly";
    document.getElementById("mobileSubDate").value = new Date().toISOString().split("T")[0];

    const delBtn = document.getElementById("mobileDeleteSubBtn");
    if (delBtn) delBtn.classList.add("hidden");

    const freezeBtn = document.getElementById("mobileFreezeSubBtn");
    if (freezeBtn) freezeBtn.classList.add("hidden");

    const payBtn = document.getElementById("mobileMarkSubPaidSheetBtn");
    if (payBtn) payBtn.classList.add("hidden");

    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("subSheet", "subSheetBackdrop");
  }

  function openEditSubSheet(sub) {
    if (!sub) return;
    const nextInfo = calculateSubNextDate(sub);
    document.getElementById("mobileSubModalTitle").textContent = "Edit Recurring";
    document.getElementById("mobileEditSubId").value = sub.id;
    document.getElementById("mobileSubName").value = sub.name || "";
    document.getElementById("mobileSubAmount").value = sub.amount || "";
    document.getElementById("mobileSubCurrency").value = sub.currency || state.displayCurrency;
    const catEl = document.getElementById("mobileSubCategory");
    if (catEl) catEl.value = sub.category || "Subscriptions";
    document.getElementById("mobileSubCycle").value = sub.billingCycle || "monthly";
    document.getElementById("mobileSubDate").value = sub.nextBillingDate || nextInfo.nextBillingDate;

    const delBtn = document.getElementById("mobileDeleteSubBtn");
    if (delBtn) delBtn.classList.remove("hidden");

    const freezeBtn = document.getElementById("mobileFreezeSubBtn");
    const freezeText = document.getElementById("mobileFreezeSubBtnText");
    if (freezeBtn) {
      freezeBtn.classList.remove("hidden");
      if (freezeText) {
        freezeText.textContent = sub.isFrozen ? "🔥 Unfreeze" : "❄️ Freeze";
      }
    }

    const curMonthKey = new Date().toISOString().slice(0, 7);
    const isPaid = isSubscriptionPaidInMonth(sub, curMonthKey);
    const payBtn = document.getElementById("mobileMarkSubPaidSheetBtn");
    if (payBtn) {
      payBtn.classList.toggle("hidden", isPaid || !!sub.isFrozen);
      payBtn.onclick = () => {
        closeBottomSheet("subSheet", "subSheetBackdrop");
        markSubscriptionAsPaidQuick(sub);
      };
    }

    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("subSheet", "subSheetBackdrop");
  }

  function openMobileWishSheetWithDefaults(cat = "Subscriptions", cycle = "monthly") {
    const titleEl = document.getElementById("mobileWishModalTitle");
    if (titleEl) titleEl.textContent = cat === "Subscriptions" ? "Add Subscription" : "Add Wishlist Item";
    document.getElementById("mobileEditWishId").value = "";
    document.getElementById("mobileWishTitle").value = "";
    document.getElementById("mobileWishPrice").value = "";
    document.getElementById("mobileWishCurrency").value = state.displayCurrency;
    document.getElementById("mobileWishUrl").value = "";
    if (document.getElementById("mobileWishCategory")) document.getElementById("mobileWishCategory").value = cat;
    if (document.getElementById("mobileWishCycle")) document.getElementById("mobileWishCycle").value = cycle;
    const delBtn = document.getElementById("mobileDeleteWishBtn");
    if (delBtn) {
      delBtn.classList.add("hidden");
      delBtn.onclick = null;
    }
    const actBtn = document.getElementById("mobileActivateWishSheetBtn");
    if (actBtn) {
      actBtn.classList.add("hidden");
      actBtn.onclick = null;
    }
    closeBottomSheet("fabActionSheet", "fabActionBackdrop");
    openBottomSheet("wishSheet", "wishSheetBackdrop");
  }

  function openMobileEditWishSheet(w) {
    if (!w) return;
    const isSub = isMobileWishSubscription(w);
    const titleEl = document.getElementById("mobileWishModalTitle");
    if (titleEl) titleEl.textContent = isSub ? "Edit Subscription" : "Edit Wishlist Item";
    document.getElementById("mobileEditWishId").value = w.id;
    document.getElementById("mobileWishTitle").value = w.name || "";
    document.getElementById("mobileWishPrice").value = (w.amount !== undefined && w.amount !== null) ? w.amount : (w.price || "");
    document.getElementById("mobileWishCurrency").value = w.currency || state.displayCurrency;
    document.getElementById("mobileWishUrl").value = w.url || "";
    if (document.getElementById("mobileWishCategory")) document.getElementById("mobileWishCategory").value = w.category || (isSub ? "Subscriptions" : "Shopping");
    if (document.getElementById("mobileWishCycle")) document.getElementById("mobileWishCycle").value = w.billingCycle || "monthly";
    const delBtn = document.getElementById("mobileDeleteWishBtn");
    if (delBtn) {
      delBtn.classList.remove("hidden");
      delBtn.onclick = async () => {
        if (await confirmAction(`Remove "${w.name}" from wishlist?`)) {
          state.wishlist = state.wishlist.filter(x => x.id !== w.id);
          saveAllToLocalStorage();
          renderWishlistView();
          pushToVault();
          closeBottomSheet("wishSheet", "wishSheetBackdrop");
          showMobileToast("Wishlist item removed");
        }
      };
    }
    const actBtn = document.getElementById("mobileActivateWishSheetBtn");
    if (actBtn) {
      actBtn.classList.remove("hidden");
      actBtn.textContent = isSub ? "Activate Sub" : "Buy / Log Now";
      actBtn.onclick = () => {
        closeBottomSheet("wishSheet", "wishSheetBackdrop");
        activateWishlistItem(w.id);
      };
    }
    openBottomSheet("wishSheet", "wishSheetBackdrop");
  }

  async function activateWishlistItem(id) {
    const item = (state.wishlist || []).find(w => w.id === id);
    if (!item) return;

    if (!await confirmAction({
      title: `Subscribe to "${item.name}"?`,
      message: "This will add it to recurring subscriptions and log today's charge.",
      confirmText: 'Subscribe',
      type: 'primary'
    })) {
      return;
    }

    state.wishlist = state.wishlist.filter(w => w.id !== id);
    const rawAmt = Number(item.amount !== undefined && item.amount !== null ? item.amount : (item.price || 0)) || 0;
    const itemCur = item.currency || state.displayCurrency || 'EUR';
    const isSub = isMobileWishSubscription(item);
    const todayStr = new Date().toISOString().split('T')[0];

    if (isSub) {
      if (!state.subscriptions) state.subscriptions = [];
      const newSub = {
        id: "sub_" + Date.now(),
        name: item.name,
        amount: rawAmt,
        currency: itemCur,
        billingCycle: item.billingCycle === 'yearly' ? 'yearly' : 'monthly',
        nextBillingDate: todayStr,
        billingDay: new Date().getDate(),
        recurringType: 'subscription',
        lastBilledDate: todayStr,
        createdAt: new Date().toISOString()
      };
      const nextInfo = calculateSubNextDate(newSub);
      newSub.nextBillingDate = nextInfo.nextBillingDate;
      state.subscriptions.unshift(newSub);
    }

    const newExp = {
      id: "exp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      title: item.name,
      amount: rawAmt,
      currency: itemCur,
      category: item.category || 'Subscriptions',
      date: todayStr,
      isSubscription: isSub,
      billingCycle: item.billingCycle === 'yearly' ? 'yearly' : 'monthly',
      notes: 'Activated from Wishlist',
      createdAt: new Date().toISOString()
    };
    state.expenses.unshift(newExp);

    saveAllToLocalStorage();
    renderWishlistView();
    renderSubscriptionsView();
    renderExpensesView();
    renderBudgetView();
    renderNeedsToPayView();
    pushToVault();
    showMobileToast(`🎉 Activated ${item.name}!`);
  }

  async function openMobileReceiptViewer(item) {
    if (!item) return;
    const modal = document.getElementById("receiptViewerSheet");
    const titleEl = document.getElementById("mobileViewerTitle");
    const metaEl = document.getElementById("mobileViewerMeta");
    const contentEl = document.getElementById("mobileViewerContent");
    const dlBtn = document.getElementById("mobileViewerDownloadBtn");
    if (!modal || !contentEl) return;

    if (titleEl) titleEl.textContent = item.title ? `${item.title} — Receipt` : "Receipt Preview";
    if (metaEl) metaEl.textContent = `${item.date || new Date().toISOString().split("T")[0]} • ${formatMoney(item.amount || 0, item.currency || state.displayCurrency)}`;

    contentEl.innerHTML = '<div class="py-8 text-center text-xs text-slate-400">Loading document...</div>';
    openBottomSheet("receiptViewerSheet", "receiptViewerBackdrop");

    let attachmentData = null;
    let attachmentType = "image";
    let fileName = item.receiptName || item.attachmentFileName || "receipt.png";

    if (item.receiptImage) {
      attachmentData = item.receiptImage;
      attachmentType = item.receiptImage.startsWith("data:application/pdf") ? "pdf" : "image";
    } else if (state.pendingExpenseReceipt) {
      attachmentData = state.pendingExpenseReceipt;
      attachmentType = state.pendingExpenseReceipt.startsWith("data:application/pdf") ? "pdf" : "image";
      fileName = state.pendingExpenseReceiptName || fileName;
    } else if (item.id && (item.hasAttachment || item.attachmentFileName)) {
      try {
        const res = await fetch(`/api/attachments/${item.id}`, {
          headers: getMobileAuthHeaders()
        });
        if (res.ok) {
          const remote = await res.json();
          if (remote && remote.data) {
            attachmentData = remote.data;
            attachmentType = remote.type || (remote.data.startsWith("data:application/pdf") ? "pdf" : "image");
            fileName = remote.fileName || fileName;
          }
        }
      } catch (e) {
        console.warn("Could not fetch attachment:", e);
      }
    }

    if (!attachmentData) {
      contentEl.innerHTML = `
        <div class="py-10 text-center text-slate-400 space-y-2">
          <i data-lucide="file-question" class="w-10 h-10 mx-auto text-slate-400"></i>
          <p class="text-xs font-semibold">No digital document found</p>
          <p class="text-[11px] text-slate-400">The file is not available locally or on server.</p>
        </div>
      `;
      if (dlBtn) dlBtn.classList.add("hidden");
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (dlBtn) {
      dlBtn.classList.remove("hidden");
      dlBtn.href = attachmentData;
      dlBtn.download = fileName;
    }

    if (attachmentType === "pdf" || attachmentData.startsWith("data:application/pdf")) {
      contentEl.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-1 space-y-2">
          <iframe src="${attachmentData}" class="w-full h-[55vh] rounded-xl border border-slate-200"></iframe>
        </div>
      `;
    } else {
      contentEl.innerHTML = `
        <div class="w-full flex items-center justify-center p-2">
          <img src="${attachmentData}" class="max-h-[55vh] max-w-full rounded-xl border border-slate-200 shadow-md object-contain" alt="Receipt">
        </div>
      `;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function executeAutoSuggestBudgets() {
    const cur = state.displayCurrency;
    const catTotals = {};
    const catMonths = {};
    const curMonthTotals = {};
    const targetMonth = (!state.selectedMonth || state.selectedMonth === "ALL" || state.selectedMonth === "all")
      ? new Date().toISOString().slice(0, 7)
      : state.selectedMonth;

    (state.expenses || []).forEach(e => {
      if (!isFlexibleExpense(e)) return;
      const amt = convertCurrency(parseFloat(e.amount) || 0, e.currency || cur, cur);
      const cat = (e.category || "Other").toLowerCase().trim();
      const m = (e.date || "").slice(0, 7);
      if (!m) return;
      if (!catTotals[cat]) {
        catTotals[cat] = 0;
        catMonths[cat] = new Set();
      }
      catTotals[cat] += amt;
      catMonths[cat].add(m);
      if (m === targetMonth) {
        curMonthTotals[cat] = (curMonthTotals[cat] || 0) + amt;
      }
    });

    if (!state.budget.categoryBudgets) state.budget.categoryBudgets = {};
    if (!state.budget.categories) state.budget.categories = DEFAULT_BUDGET_CATEGORIES.slice();

    let count = 0;
    state.budget.categories.forEach(catObj => {
      const cat = catObj.name;
      const catKey = (cat || "").toLowerCase().trim();
      const total = catTotals[catKey] || 0;
      const activeM = (catMonths[catKey] && catMonths[catKey].size > 0) ? catMonths[catKey].size : 1;
      const monthlyAvg = total / activeM;
      const curSpent = curMonthTotals[catKey] || 0;
      const baseline = Math.max(monthlyAvg, curSpent);
      if (baseline > 0) {
        const suggested = Math.ceil((baseline * 1.10) / 10) * 10;
        catObj.limit = suggested;
        catObj.currency = cur;
        state.budget.categoryBudgets[cat] = suggested;
        count++;
      }
    });

    saveAllToLocalStorage();
    renderBudgetView();
    pushToVault();
    showMobileToast(`Smart Budgets Set! ✨ (${count} categories updated)`);
  }

  // ==========================================
  // 16. TOAST HELPER
  // ==========================================
  let toastTimer = null;
  function showMobileToast(msg) {
    const toast = document.getElementById("mobileToast");
    const label = document.getElementById("mobileToastText");
    if (!toast || !label) return;

    label.textContent = msg;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================
  // 17. ATTACHMENT UPLOAD & CAMERA ENGINES
  // ==========================================
  function setupFileAttachments() {
    // Camera direct receipt input
    const camInput = document.getElementById("cameraReceiptInput");
    if (camInput) {
      camInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          processReceiptFile(file, () => {
            closeBottomSheet("fabActionSheet", "fabActionBackdrop");
            openAddExpenseSheet();
          });
        }
      });
    }

    // Modal receipt file input
    const recInput = document.getElementById("mobileReceiptInput");
    if (recInput) {
      recInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) processReceiptFile(file);
      });
    }

    const modalCam = document.getElementById("mobileCameraInput");
    if (modalCam) {
      modalCam.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) processReceiptFile(file);
      });
    }

    // Note file attachment input
    const noteFileInput = document.getElementById("mobileNoteFileInput");
    if (noteFileInput) {
      noteFileInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target.result;
            const isImg = (file.type && file.type.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i.test(file.name || "");
            const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
            const attId = "att_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
            const attType = isImg ? "image" : (isPdf ? "pdf" : "doc");
            const mimeType = file.type || (isImg ? "image/png" : (isPdf ? "application/pdf" : "application/octet-stream"));
            const createdAt = new Date().toISOString();

            const fullAtt = {
              id: attId,
              name: file.name,
              size: file.size,
              type: attType,
              mimeType: mimeType,
              thumbData: isImg ? dataUrl : null,
              data: dataUrl,
              createdAt: createdAt
            };
            try {
              fetch(`/api/attachments/${encodeURIComponent(attId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullAtt)
              }).catch(() => {});
            } catch (err) {}

            state.pendingNoteAttachments.push({
              id: attId,
              name: file.name,
              size: file.size,
              type: attType,
              mimeType: mimeType,
              thumbData: isImg ? dataUrl : null,
              createdAt: createdAt
            });
            renderPendingNoteAttachments();
          };
          reader.readAsDataURL(file);
        });
        noteFileInput.value = "";
      });
    }

    // JSON Vault Export & Import
    const exportBtn = document.getElementById("mobileExportVaultBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const backup = {
          version: "finland_v2",
          exportedAt: new Date().toISOString(),
          expenses: state.expenses,
          subscriptions: state.subscriptions,
          budget: state.budget,
          debts: state.debts,
          notes: state.notes,
          wishlist: state.wishlist,
          currency: state.displayCurrency
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `finland_vault_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showMobileToast("Vault exported!");
      });
    }

    const importInput = document.getElementById("mobileImportVaultInput");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data.expenses) state.expenses = data.expenses;
            if (data.subscriptions) state.subscriptions = data.subscriptions;
            if (data.budget) state.budget = data.budget;
            if (data.debts) state.debts = data.debts;
            if (data.notes) state.notes = data.notes;
            if (data.wishlist) state.wishlist = data.wishlist;
            if (data.currency) state.displayCurrency = data.currency;

            saveAllToLocalStorage();
            renderActiveView();
            pushToVault();
            closeBottomSheet("syncSheet", "syncSheetBackdrop");
            showMobileToast("Vault successfully restored!");
          } catch (err) {
            alert("Invalid backup JSON file.");
          }
        };
        reader.readAsText(file);
      });
    }
  }

  function processReceiptFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      state.pendingExpenseReceipt = evt.target.result;
      state.pendingExpenseReceiptName = file.name;
      updateReceiptBadgeUI(null);
      showMobileToast("Receipt attached ✓");
      if (callback) callback();
    };
    reader.readAsDataURL(file);
  }

  function renderPendingNoteAttachments() {
    const container = document.getElementById("mobileNotePendingAttList");
    const countLabel = document.getElementById("mobileNoteAttCount");
    if (countLabel) countLabel.textContent = `${state.pendingNoteAttachments.length} files`;
    if (!container) return;

    container.innerHTML = "";
    state.pendingNoteAttachments.forEach((att, idx) => {
      const isImg = att.type === "image" || (att.type && att.type.startsWith("image/")) || (att.mimeType && att.mimeType.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i.test(att.name || "");
      const imgSrc = att.thumbData || att.dataUrl || att.data || "";
      const thumb = document.createElement("div");
      thumb.className = "w-10 h-10 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center relative";
      thumb.innerHTML = `
        ${(isImg && imgSrc) ? `<img src="${imgSrc}" class="w-full h-full object-cover">` : `<i data-lucide="file-text" class="w-4 h-4 text-rose-500"></i>`}
        <button type="button" class="absolute top-0 right-0 bg-rose-600 text-white w-3.5 h-3.5 rounded-bl flex items-center justify-center text-[9px]" data-idx="${idx}">×</button>
      `;
      thumb.querySelector("button").addEventListener("click", (e) => {
        e.stopPropagation();
        state.pendingNoteAttachments.splice(idx, 1);
        renderPendingNoteAttachments();
      });
      container.appendChild(thumb);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  let mobileEditingLinkIdx = -1;

  function cancelMobileEditingLink() {
    mobileEditingLinkIdx = -1;
    const urlIn = document.getElementById("mobileNoteLinkUrl");
    const titleIn = document.getElementById("mobileNoteLinkTitle");
    const txt = document.getElementById("mobileNoteAddLinkText");
    const icon = document.getElementById("mobileNoteAddLinkIcon");
    const cancelBtn = document.getElementById("mobileNoteCancelEditLinkBtn");
    if (urlIn) urlIn.value = "";
    if (titleIn) titleIn.value = "";
    if (txt) {
      txt.textContent = "";
      txt.classList.add("hidden");
    }
    if (icon) icon.setAttribute("data-lucide", "check");
    if (cancelBtn) cancelBtn.classList.add("hidden");
    const container = document.getElementById("mobileNoteLinksList");
    if (container) {
      container.querySelectorAll(".mobile-link-chip").forEach(el => {
        el.classList.remove("border-indigo-500", "ring-2", "ring-indigo-500/20", "bg-indigo-50/50");
        el.classList.add("border-slate-200");
      });
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function startMobileEditingLink(idx) {
    if (!state.pendingNoteLinks || idx < 0 || idx >= state.pendingNoteLinks.length) return;
    mobileEditingLinkIdx = idx;
    const link = state.pendingNoteLinks[idx];
    const urlIn = document.getElementById("mobileNoteLinkUrl");
    const titleIn = document.getElementById("mobileNoteLinkTitle");
    const txt = document.getElementById("mobileNoteAddLinkText");
    const icon = document.getElementById("mobileNoteAddLinkIcon");
    const cancelBtn = document.getElementById("mobileNoteCancelEditLinkBtn");
    if (urlIn) urlIn.value = link.url || "";
    if (titleIn) titleIn.value = link.title || "";
    if (txt) {
      txt.textContent = "Update";
      txt.classList.remove("hidden");
    }
    if (icon) icon.setAttribute("data-lucide", "check");
    if (cancelBtn) cancelBtn.classList.remove("hidden");
    renderPendingNoteLinks();
    if (urlIn) {
      urlIn.focus();
      urlIn.select();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function renderPendingNoteLinks() {
    const container = document.getElementById("mobileNoteLinksList");
    if (!container) return;
    container.innerHTML = "";
    const list = state.pendingNoteLinks || [];
    if (list.length === 0) {
      container.classList.add("hidden");
      container.classList.remove("flex");
      return;
    }
    container.classList.remove("hidden");
    container.classList.add("flex");
    list.forEach((link, idx) => {
      const chip = document.createElement("div");
      const isEditing = idx === mobileEditingLinkIdx;
      chip.className = `mobile-link-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-white border ${isEditing ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50' : 'border-slate-200'} text-slate-700 shadow-2xs transition-all cursor-pointer`;
      const disp = link.title || formatLinkDomain(link.url);
      chip.innerHTML = `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="mobile-open-link-anchor inline-flex items-center gap-1.5 text-indigo-600">
          <i data-lucide="link" class="w-3 h-3 ${isEditing ? 'text-indigo-600' : 'text-indigo-500'}"></i>
          <span class="max-w-[110px] truncate font-medium">${escapeHtml(disp)}</span>
        </a>
        <button type="button" class="mobile-edit-link-btn text-slate-400 hover:text-indigo-600 p-0.5 ml-1" data-idx="${idx}" title="Edit link URL &amp; title">
          <i data-lucide="pencil" class="w-3 h-3"></i>
        </button>
        <button type="button" class="mobile-remove-link-btn text-slate-300 hover:text-rose-600 p-0.5 ml-0.5" data-idx="${idx}" title="Remove link">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      `;
      chip.querySelector(".mobile-edit-link-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startMobileEditingLink(idx);
      });
      chip.querySelector(".mobile-remove-link-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const linkLabel = disp || "this link";
        if (await confirmAction(`Delete link "${linkLabel}"?`)) {
          if (mobileEditingLinkIdx === idx) cancelMobileEditingLink();
          else if (mobileEditingLinkIdx > idx) mobileEditingLinkIdx--;
          state.pendingNoteLinks.splice(idx, 1);
          renderPendingNoteLinks();
        }
      });
      chip.addEventListener("click", (e) => {
        if (e.target.closest(".mobile-remove-link-btn") || e.target.closest(".mobile-edit-link-btn") || e.target.closest(".mobile-open-link-anchor")) return;
        if (link.url) window.open(link.url, "_blank", "noopener,noreferrer");
      });
      container.appendChild(chip);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // 16. SUBSCRIPTION CALENDAR & QUICK PAY
  // ==========================================
  function getSubscriptionBilledDateForMonth(sub, targetMonth) {
    if (!sub) return new Date().toISOString().split('T')[0];
    const tMonthStr = targetMonth || new Date().toISOString().slice(0, 7);

    if (sub.lastBilledDate && sub.lastBilledDate.startsWith(tMonthStr)) {
      return sub.lastBilledDate;
    }

    let bDay = sub.billingDay ? parseInt(sub.billingDay, 10) : null;
    if (!bDay && sub.lastBilledDate) {
      const parts = sub.lastBilledDate.split('-');
      if (parts.length === 3) bDay = parseInt(parts[2], 10);
    }
    if (!bDay && sub.nextBillingDate) {
      const parts = sub.nextBillingDate.split('-');
      if (parts.length === 3) bDay = parseInt(parts[2], 10);
    }
    if (!bDay || isNaN(bDay)) bDay = 1;

    const parts = tMonthStr.split('-');
    const tYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const tMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const daysInTargetMonth = new Date(tYear, tMonth, 0).getDate();
    const targetDay = Math.min(Math.max(1, bDay), daysInTargetMonth);
    return `${tMonthStr}-${String(targetDay).padStart(2, '0')}`;
  }

  function markSubscriptionAsPaidQuick(sub) {
    if (!sub) return;
    const curMonthKey = (state.selectedMonth && state.selectedMonth !== 'ALL') ? state.selectedMonth : new Date().toISOString().slice(0, 7);
    const billedDate = getSubscriptionBilledDateForMonth(sub, curMonthKey);
    const expSubId = `exp_sub_${sub.id}_${curMonthKey.replace('-', '_')}`;

    const normSub = normalizeServiceName(sub.name);
    const existingExpense = (state.expenses || []).find(e => {
      if (!e.date || !e.date.startsWith(curMonthKey)) return false;
      if (e.id === expSubId || e.subscriptionId === sub.id) return true;
      if (e.generatedFromSubId === sub.id && e.generatedForMonth === curMonthKey) return true;
      const normExp = normalizeServiceName(e.title || '');
      if (normSub && normExp && normExp === normSub) return true;
      if (e.title && sub.name && e.title.trim().toLowerCase() === sub.name.trim().toLowerCase()) return true;
      return false;
    });

    if (!existingExpense) {
      const newExpense = {
        id: expSubId,
        title: sub.name,
        amount: parseFloat(sub.amount) || 0,
        currency: sub.currency || state.displayCurrency || "EUR",
        category: sub.category || "Subscriptions",
        date: billedDate,
        isSubscription: true,
        subscriptionId: sub.id,
        billingCycle: sub.billingCycle || "monthly",
        paymentMethod: sub.paymentMethod || "Card",
        cardLast4: sub.cardLast4 || '',
        notes: `Recorded renewal for ${sub.name}`,
        hasAttachment: false,
        createdAt: new Date().toISOString(),
        generatedFromSubId: sub.id,
        generatedForMonth: curMonthKey
      };
      state.expenses.unshift(newExpense);
    }

    if (!sub.manualPaidMonths) sub.manualPaidMonths = {};
    sub.manualPaidMonths[curMonthKey] = true;
    if (!sub.lastBilledDate || billedDate > sub.lastBilledDate) {
      sub.lastBilledDate = billedDate;
    }

    saveAllToLocalStorage();
    renderSubscriptionsView();
    renderExpensesView();
    renderBudgetView();
    pushToVault();
    showMobileToast(`Marked ${sub.name} as paid! 🎉`);
  }

  function renderMobileSubscriptionCalendar() {
    const gridEl = document.getElementById("mobileSubscriptionCalendarGrid");
    if (!gridEl) return;
    gridEl.innerHTML = "";

    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();

    if (state.selectedMonth && state.selectedMonth !== "ALL") {
      const parts = state.selectedMonth.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        year = parts[0];
        month = parts[1] - 1;
      }
    }

    const headingEl = document.getElementById("mobileCalMonthYearHeading");
    if (headingEl) {
      const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      headingEl.textContent = `${monthName} Calendar`;
    }

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Subscriptions mapped to day of month
    const subsByDay = {};
    (state.subscriptions || []).forEach(s => {
      if (s.isFrozen) return;
      let day = parseInt(s.billingDay, 10);
      if (!day && s.nextBillingDate) {
        day = parseInt(s.nextBillingDate.split("-")[2], 10);
      }
      if (day >= 1 && day <= 31) {
        const clampedDay = Math.min(day, daysInMonth);
        if (!subsByDay[clampedDay]) subsByDay[clampedDay] = [];
        subsByDay[clampedDay].push(s);
      }
    });

    // Active notes with due dates in this month
    const notesByDay = {};
    (state.notes || []).forEach(note => {
      if (note.isDone || note.completed) return; // Only active notes/tasks
      if (!note.dueDate) return;
      const parts = note.dueDate.split("-");
      if (parts.length === 3) {
        const nYear = parseInt(parts[0], 10);
        const nMonth = parseInt(parts[1], 10) - 1;
        const nDay = parseInt(parts[2], 10);
        if (nYear === year && nMonth === month && nDay >= 1 && nDay <= 31) {
          const clampedDay = Math.min(nDay, daysInMonth);
          if (!notesByDay[clampedDay]) notesByDay[clampedDay] = [];
          notesByDay[clampedDay].push(note);
        }
      }
    });

    // Blank cells before day 1
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "mobile-cal-cell opacity-20 pointer-events-none";
      gridEl.appendChild(emptyCell);
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.setAttribute("data-day", d);
      const currentDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = currentDayStr === todayStr;
      const daySubs = subsByDay[d] || [];
      const dayNotes = notesByDay[d] || [];
      const hasBill = daySubs.length > 0;
      const hasNote = dayNotes.length > 0;

      const curMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const isAllPaid = hasBill && daySubs.every(s => isSubscriptionPaidInMonth(s, curMonthKey));

      let cellClass = "mobile-cal-cell relative p-1.5 flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all tap-bounce border";
      if (isToday) {
        cellClass += " is-today border-purple-500 bg-purple-50/50 font-bold text-purple-900";
      } else if (hasBill && !isAllPaid) {
        cellClass += " has-bill font-bold";
      } else if (hasBill && isAllPaid) {
        cellClass += " has-bill is-paid";
      } else if (hasNote) {
        cellClass += " has-note";
      } else {
        cellClass += " bg-slate-50 text-slate-700 hover:bg-slate-100 border-transparent";
      }

      // Indicator dots
      let dotsHtml = "";
      const billDotColor = isAllPaid ? "#94a3b8" : "#9333ea";
      if (hasBill && hasNote) {
        dotsHtml = `
          <div class="flex items-center justify-center gap-0.5 mt-0.5 pointer-events-none">
            <span class="mobile-cal-dot w-1.5 h-1.5 rounded-full" style="background-color: ${billDotColor};"></span>
            <span class="mobile-cal-dot w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          </div>
        `;
      } else if (hasBill) {
        dotsHtml = `<span class="mobile-cal-dot w-1.5 h-1.5 rounded-full mt-0.5 pointer-events-none" style="background-color: ${billDotColor};"></span>`;
      } else if (hasNote) {
        dotsHtml = `<span class="mobile-cal-dot w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5 pointer-events-none"></span>`;
      }

      cell.className = cellClass;
      cell.innerHTML = `
        <span class="text-[11px]">${d}</span>
        ${dotsHtml}
      `;

      cell.addEventListener("click", () => {
        gridEl.querySelectorAll(".mobile-cal-cell").forEach(c => c.classList.remove("ring-2", "ring-slate-900"));
        cell.classList.add("ring-2", "ring-slate-900");
        showCalendarDayDetails(d, month, year, daySubs, dayNotes);
      });

      gridEl.appendChild(cell);
    }

    // Auto-select default day (today or imminent bill / note)
    let defaultDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : 1;
    const activeDays = Array.from(new Set([...Object.keys(subsByDay), ...Object.keys(notesByDay)].map(Number))).sort((a,b) => a - b);
    if (!subsByDay[defaultDay] && !notesByDay[defaultDay] && activeDays.length > 0) {
      const upcoming = activeDays.find(x => x >= defaultDay);
      defaultDay = upcoming || activeDays[0];
    }
    const defaultCell = gridEl.querySelector(`.mobile-cal-cell[data-day="${defaultDay}"]`);
    if (defaultCell) {
      defaultCell.classList.add("ring-2", "ring-slate-900");
    }
    showCalendarDayDetails(defaultDay, month, year, subsByDay[defaultDay] || [], notesByDay[defaultDay] || []);
  }

  function showCalendarDayDetails(day, month, year, daySubs = [], dayNotes = []) {
    const detailsContainer = document.getElementById("mobileCalSelectedDayDetails");
    if (!detailsContainer) return;
    detailsContainer.classList.remove("hidden");
    const dt = new Date(year, month, day);
    const dateFormatted = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    const totalEvents = (daySubs ? daySubs.length : 0) + (dayNotes ? dayNotes.length : 0);

    if (totalEvents === 0) {
      detailsContainer.innerHTML = `
        <div class="flex items-center justify-between text-xs py-1 px-1">
          <span class="font-bold text-slate-800">${dateFormatted}</span>
          <span class="text-[11px] text-slate-400">No renewals or notes scheduled</span>
        </div>
      `;
      return;
    }

    const curMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const itemsHtml = (daySubs || []).map(s => {
      const isPaid = isSubscriptionPaidInMonth(s, curMonthKey);
      const convAmt = convertCurrency(s.amount || 0, s.currency || "EUR", state.displayCurrency);
      return `
        <div class="p-2.5 rounded-xl bg-white border ${isPaid ? 'border-slate-200' : 'border-purple-200/80'} shadow-2xs flex items-center justify-between gap-2 text-xs">
          <div class="min-w-0 flex-1">
            <div class="font-bold ${isPaid ? 'text-slate-400 line-through' : 'text-slate-900'} truncate">${escapeHtml(s.name)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(s.category || 'Subscription')} • ${s.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-mono font-bold ${isPaid ? 'text-slate-400 line-through' : 'text-slate-900'}">${formatMoney(convAmt)}</span>
            ${isPaid 
              ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Paid ✓</span>` 
              : `<button type="button" class="mobile-cal-mark-paid-btn px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold tap-bounce" data-id="${s.id}">Pay</button>`}
          </div>
        </div>
      `;
    }).join("");

    const notesHtml = (dayNotes || []).map(n => {
      return `
        <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 shadow-2xs flex items-center justify-between gap-2 text-xs mobile-cal-note-item cursor-pointer tap-bounce" data-note-id="${n.id}">
          <div class="min-w-0 flex-1 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
            <div class="min-w-0">
              <div class="font-bold text-amber-950 truncate">${escapeHtml(n.title)}</div>
              ${n.label ? `<div class="text-[10px] text-amber-700 font-mono font-semibold">${escapeHtml(n.label)}</div>` : ''}
            </div>
          </div>
          <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Note ↗</span>
        </div>
      `;
    }).join("");

    let badges = [];
    if (daySubs.length > 0) {
      badges.push(`${daySubs.length} bill${daySubs.length > 1 ? 's' : ''}`);
    }
    if (dayNotes.length > 0) {
      badges.push(`${dayNotes.length} note${dayNotes.length > 1 ? 's' : ''}`);
    }

    detailsContainer.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-900">${dateFormatted}</span>
          <span class="text-[10px] font-semibold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full">${badges.join(' • ')}</span>
        </div>
        ${itemsHtml ? `<div class="space-y-1.5">${itemsHtml}</div>` : ''}
        ${notesHtml ? `<div class="space-y-1.5">${notesHtml}</div>` : ''}
      </div>
    `;

    detailsContainer.querySelectorAll(".mobile-cal-mark-paid-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sid = btn.getAttribute("data-id");
        const sub = (state.subscriptions || []).find(x => x.id === sid);
        if (sub) markSubscriptionAsPaidQuick(sub);
      });
    });

    detailsContainer.querySelectorAll(".mobile-cal-note-item").forEach(item => {
      item.addEventListener("click", () => {
        const nid = item.getAttribute("data-note-id");
        const note = (state.notes || []).find(x => x.id === nid);
        if (note) openEditNoteSheet(note);
      });
    });
  }

  // ==========================================
  // 17. ADVANCED SHEETS (MONTH PICKER, SETTINGS, CATEGORY LOG, PARTIAL DEBT)
  // ==========================================
  function openMonthPickerSheet() {
    const grid = document.getElementById("monthPickerGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const monthSet = new Set();
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    (state.expenses || []).forEach(e => {
      if (e.date && e.date.length >= 7) monthSet.add(e.date.slice(0, 7));
    });

    const sortedMonths = Array.from(monthSet).sort().reverse();

    sortedMonths.forEach(mKey => {
      const parts = mKey.split("-").map(Number);
      const dObj = new Date(parts[0], parts[1] - 1, 1);
      const monthLabel = dObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      let mSpend = 0;
      (state.expenses || []).forEach(e => {
        if (!e.isIncome && e.date && e.date.startsWith(mKey)) {
          mSpend += convertCurrency(e.amount || 0, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
        }
      });

      const isCurrentSelected = (state.selectedMonth === mKey);

      const row = document.createElement("button");
      row.type = "button";
      row.className = `w-full p-3 rounded-2xl border text-left flex items-center justify-between tap-bounce transition-all ${
        isCurrentSelected 
          ? 'bg-slate-900 text-white border-slate-900 shadow-md font-bold' 
          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
      }`;
      row.innerHTML = `
        <div>
          <div class="text-xs font-bold">${monthLabel}</div>
          <div class="text-[10px] ${isCurrentSelected ? 'text-slate-300' : 'text-slate-400'} font-mono mt-0.5">${formatMoney(mSpend)} spent</div>
        </div>
        ${isCurrentSelected ? `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i>` : `<i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>`}
      `;

      row.addEventListener("click", () => {
        state.selectedMonth = mKey;
        updateMonthLabel();
        renderActiveView();
        closeBottomSheet("monthPickerSheet", "monthPickerBackdrop");
        showMobileToast(`Viewing ${monthLabel}`);
      });

      grid.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
    openBottomSheet("monthPickerSheet", "monthPickerBackdrop");
  }

  function openSettingsSheet() {
    const prefs = state.appPrefs || DEFAULT_APP_PREFS;
    const activeCurs = getActiveDisplayedCurrencies();

    const curEur = document.getElementById("prefCurEUR");
    const curIls = document.getElementById("prefCurILS");
    const curUsd = document.getElementById("prefCurUSD");
    if (curEur) curEur.checked = activeCurs.includes("EUR");
    if (curIls) curIls.checked = activeCurs.includes("ILS");
    if (curUsd) curUsd.checked = activeCurs.includes("USD");

    const defaultCurSelect = document.getElementById("prefDefaultCur");
    if (defaultCurSelect) defaultCurSelect.value = prefs.defaultStartupCurrency || "EUR";

    const decMode = prefs.decimalMode || "cents";
    const decRadios = document.querySelectorAll("input[name='prefDecimalMode']");
    decRadios.forEach(r => { r.checked = (r.value === decMode); });

    const numFormat = prefs.numberFormatLocale || "standard";
    const numRadios = document.querySelectorAll("input[name='prefNumberFormat']");
    numRadios.forEach(r => {
      r.checked = (r.value === "de-DE" ? numFormat === "european" : numFormat !== "european");
    });

    const alertDaysInput = document.getElementById("prefAdvanceAlertDays");
    if (alertDaysInput) alertDaysInput.value = prefs.advanceAlertDays || 7;

    switchSettingsTab("prefs");
    renderSettingsPaymentMethods();

    openBottomSheet("settingsSheet", "settingsSheetBackdrop");
  }

  function switchSettingsTab(tabName) {
    const panePrefs = document.getElementById("settingsPanePrefs");
    const paneMethods = document.getElementById("settingsPaneMethods");
    const paneData = document.getElementById("settingsPaneData");

    const btnPrefs = document.getElementById("settingsTabPrefsBtn");
    const btnMethods = document.getElementById("settingsTabMethodsBtn");
    const btnData = document.getElementById("settingsTabDataBtn");

    if (panePrefs) panePrefs.classList.toggle("hidden", tabName !== "prefs");
    if (paneMethods) paneMethods.classList.toggle("hidden", tabName !== "methods");
    if (paneData) paneData.classList.toggle("hidden", tabName !== "data");

    const activeClasses = ["bg-white", "text-slate-900", "shadow-2xs"];
    const inactiveClasses = ["text-slate-500"];

    [
      [btnPrefs, tabName === "prefs"],
      [btnMethods, tabName === "methods"],
      [btnData, tabName === "data"]
    ].forEach(([btn, isActive]) => {
      if (!btn) return;
      if (isActive) {
        btn.classList.add(...activeClasses);
        btn.classList.remove(...inactiveClasses);
      } else {
        btn.classList.remove(...activeClasses);
        btn.classList.add(...inactiveClasses);
      }
    });
  }

  function renderSettingsPaymentMethods() {
    const list = document.getElementById("settingsPaymentMethodsList");
    if (!list) return;
    list.innerHTML = "";

    const methods = getAppPaymentMethods();
    if (methods.length === 0) {
      list.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">No payment methods added.</div>`;
      return;
    }

    methods.forEach((m, idx) => {
      const row = document.createElement("div");
      row.className = "p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between text-xs";
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <i data-lucide="credit-card" class="w-4 h-4 text-slate-500"></i>
          <span class="font-bold text-slate-800">${escapeHtml(m)}</span>
          ${idx === 0 ? `<span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Default</span>` : ''}
        </div>
        <button type="button" class="mobile-del-pm-btn p-1 text-slate-300 hover:text-rose-600 rounded-lg tap-bounce" data-name="${escapeHtml(m)}" title="Delete Method">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      const delBtn = row.querySelector(".mobile-del-pm-btn");
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (!await confirmAction(`Remove "${m}" from payment methods?`)) return;
          deletePaymentMethod(m);
        });
      }

      list.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function deletePaymentMethod(name) {
    if (!state.appPrefs) state.appPrefs = Object.assign({}, DEFAULT_APP_PREFS);
    if (!Array.isArray(state.appPrefs.paymentMethods)) state.appPrefs.paymentMethods = [];

    state.appPrefs.paymentMethods = state.appPrefs.paymentMethods.filter(item => {
      const val = typeof item === 'object' ? item.name : item;
      return val !== name;
    });

    saveAllToLocalStorage();
    renderSettingsPaymentMethods();
    populatePaymentMethodsDropdown(document.getElementById("mobileExpensePaymentMethod"));
    showMobileToast(`Removed ${name}`);
  }

  function addPaymentMethodDirect(newMethod) {
    if (!newMethod || !newMethod.trim()) return;
    const clean = newMethod.trim();
    if (!state.appPrefs) state.appPrefs = Object.assign({}, DEFAULT_APP_PREFS);
    if (!Array.isArray(state.appPrefs.paymentMethods)) state.appPrefs.paymentMethods = [];

    const existing = getAppPaymentMethods();
    if (existing.includes(clean)) {
      showMobileToast("Payment method already exists");
      return;
    }

    state.appPrefs.paymentMethods.push({
      id: "pm_" + Date.now(),
      name: clean,
      last4: "",
      isDefault: state.appPrefs.paymentMethods.length === 0
    });

    saveAllToLocalStorage();
    pushToVault();
    renderSettingsPaymentMethods();
    populatePaymentMethodsDropdown(document.getElementById("mobileExpensePaymentMethod"), clean);
    showMobileToast(`Added "${clean}"! 💳`);
  }

  function saveSettingsPreferences() {
    if (!state.appPrefs) state.appPrefs = Object.assign({}, DEFAULT_APP_PREFS);

    const chosenCurs = [];
    if (document.getElementById("prefCurEUR")?.checked) chosenCurs.push("EUR");
    if (document.getElementById("prefCurILS")?.checked) chosenCurs.push("ILS");
    if (document.getElementById("prefCurUSD")?.checked) chosenCurs.push("USD");

    if (chosenCurs.length === 0) {
      alert("Please select at least 1 currency.");
      return;
    }

    state.appPrefs.displayedCurrencies = chosenCurs.slice(0, 3);

    const defaultCur = document.getElementById("prefDefaultCur")?.value;
    if (defaultCur) state.appPrefs.defaultStartupCurrency = defaultCur;

    const decRadio = document.querySelector("input[name='prefDecimalMode']:checked");
    if (decRadio) state.appPrefs.decimalMode = decRadio.value;

    const numRadio = document.querySelector("input[name='prefNumberFormat']:checked");
    if (numRadio) {
      state.appPrefs.numberFormatLocale = (numRadio.value === "de-DE") ? "european" : "standard";
    }

    const alertDays = parseInt(document.getElementById("prefAdvanceAlertDays")?.value || "7", 10);
    state.appPrefs.advanceAlertDays = isNaN(alertDays) ? 7 : alertDays;

    saveAllToLocalStorage();
    pushToVault();
    updateMobileCurrencyButtonsUI();
    renderActiveView();
    closeBottomSheet("settingsSheet", "settingsSheetBackdrop");
    showMobileToast("Preferences updated! ⚙️");
  }

  function openCategoryPurchasesSheet(categoryName) {
    const sheet = document.getElementById("categoryPurchasesSheet");
    if (!sheet) return;

    sheet.setAttribute("data-category", categoryName);
    const titleEl = document.getElementById("categoryPurchasesTitle");
    const subEl = document.getElementById("categoryPurchasesSubtitle");
    const iconEl = document.getElementById("categoryPurchasesIcon");
    const countEl = document.getElementById("categoryPurchasesCount");
    const limitInput = document.getElementById("categoryPurchasesLimitInput");
    const listEl = document.getElementById("categoryPurchasesList");

    if (titleEl) titleEl.textContent = categoryName;
    if (iconEl) {
      const cColor = getCategoryColor(categoryName);
      iconEl.innerHTML = `<i data-lucide="${getCategoryIcon(categoryName)}" class="w-4 h-4" style="color: ${cColor};"></i>`;
      iconEl.style.backgroundColor = `${cColor}18`;
    }

    const isAllTime = (!state.selectedMonth || state.selectedMonth === "ALL" || state.selectedMonth === "all");
    const catExpenses = (state.expenses || []).filter(e => {
      if (!isFlexibleExpense(e)) return false;
      const isCat = (e.category || "Other").toLowerCase().trim() === categoryName.toLowerCase().trim();
      const inMonth = isAllTime || (e.date && e.date.startsWith(state.selectedMonth));
      return isCat && inMonth;
    });

    let catTotal = 0;
    catExpenses.forEach(e => {
      catTotal += convertCurrency(parseFloat(e.amount) || 0, e.currency || state.displayCurrency || "EUR", state.displayCurrency);
    });

    if (subEl) subEl.textContent = `Spent: ${formatMoney(catTotal)} this period`;
    if (countEl) countEl.textContent = `${catExpenses.length} purchases`;

    let rawLimit = 0;
    let limitCur = (state.budget && state.budget.incomeCurrency) || "EUR";
    if (state.budget && Array.isArray(state.budget.categories)) {
      const cObj = state.budget.categories.find(x => (x.name || "").toLowerCase().trim() === categoryName.toLowerCase().trim());
      if (cObj) {
        if (cObj.limit !== undefined && parseFloat(cObj.limit) > 0) rawLimit = parseFloat(cObj.limit);
        if (cObj.currency) limitCur = cObj.currency;
      }
    }
    if (!rawLimit && state.budget && state.budget.categoryBudgets && state.budget.categoryBudgets[categoryName] > 0) {
      rawLimit = parseFloat(state.budget.categoryBudgets[categoryName]) || 0;
    }
    const convertedLimit = rawLimit > 0
      ? (Math.round(convertCurrency(rawLimit, limitCur, state.displayCurrency) * 100) / 100)
      : "";
    if (limitInput) limitInput.value = convertedLimit;

    if (listEl) {
      listEl.innerHTML = "";
      if (catExpenses.length === 0) {
        listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">No transactions recorded for ${escapeHtml(categoryName)} this period.</div>`;
      } else {
        catExpenses.forEach(e => {
          const row = document.createElement("div");
          row.className = "p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5 tap-bounce cursor-pointer hover:border-slate-300";
          row.innerHTML = `
            <div class="min-w-0 flex-1">
              <div class="font-bold text-xs text-slate-900 truncate">${escapeHtml(e.title || 'Purchase')}</div>
              <div class="text-[10px] text-slate-400 font-mono mt-0.5">${e.date || 'No date'} ${e.paymentMethod ? `• ${escapeHtml(e.paymentMethod)}` : ''}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="font-mono font-bold text-xs text-slate-900">${formatMoney(convertCurrency(e.amount || 0, e.currency || state.displayCurrency || 'EUR', state.displayCurrency))}</div>
            </div>
          `;
          row.addEventListener("click", () => {
            closeBottomSheet("categoryPurchasesSheet", "categoryPurchasesBackdrop");
            openEditExpenseSheet(e.id);
          });
          listEl.appendChild(row);
        });
      }
    }

    if (window.lucide) window.lucide.createIcons();
    openBottomSheet("categoryPurchasesSheet", "categoryPurchasesBackdrop");
  }

  function handleSaveCategoryPurchasesLimit() {
    const sheet = document.getElementById("categoryPurchasesSheet");
    if (!sheet) return;
    const catName = sheet.getAttribute("data-category");
    if (!catName) return;

    const input = document.getElementById("categoryPurchasesLimitInput");
    const newLimit = parseFloat(input?.value) || 0;

    if (!state.budget) state.budget = {};
    if (!state.budget.categoryBudgets) state.budget.categoryBudgets = {};
    state.budget.categoryBudgets[catName] = newLimit;

    if (Array.isArray(state.budget.categories)) {
      const match = state.budget.categories.find(c => (c.name || '').toLowerCase() === catName.toLowerCase());
      if (match) {
        match.limit = newLimit;
        match.currency = state.displayCurrency;
      }
    }

    saveAllToLocalStorage();
    renderBudgetView();
    pushToVault();
    showMobileToast(`Budget limit updated for ${catName}! 🎯`);
  }

  function openPayDebtPartialSheet(debtId) {
    const debt = (state.debts || []).find(d => d.id === debtId);
    if (!debt) return;

    const debtTitle = debt.title || debt.name || "Debt";
    const origAmt = parseFloat(debt.amount) || 0;
    const paidAmt = parseFloat(debt.paidAmount) || 0;
    const rem = Math.max(0, origAmt - paidAmt);
    const debtCur = debt.currency || state.displayCurrency || "EUR";

    document.getElementById("partialDebtTargetId").value = debt.id;
    const titleEl = document.getElementById("partialDebtSheetTitle");
    if (titleEl) titleEl.textContent = `Record payment toward "${debtTitle}"`;

    const totalEl = document.getElementById("partialDebtTotalVal");
    const paidEl = document.getElementById("partialDebtPaidVal");
    const remEl = document.getElementById("partialDebtRemVal");
    const curBadge = document.getElementById("partialDebtCurrencyBadge");

    if (totalEl) totalEl.textContent = formatMoney(origAmt, debtCur);
    if (paidEl) paidEl.textContent = formatMoney(paidAmt, debtCur);
    if (remEl) remEl.textContent = formatMoney(rem, debtCur);
    if (curBadge) curBadge.textContent = debtCur;

    const amtInput = document.getElementById("partialDebtAmountInput");
    if (amtInput) {
      amtInput.value = "";
      amtInput.max = rem.toFixed(2);
      amtInput.placeholder = `e.g. ${(rem / 2).toFixed(2)}`;
    }

    const dateInput = document.getElementById("partialDebtDateInput");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const notesInput = document.getElementById("partialDebtNotesInput");
    if (notesInput) notesInput.value = "";

    populatePaymentMethodsDropdown(document.getElementById("partialDebtPaymentMethod"));

    openBottomSheet("partialDebtSheet", "partialDebtBackdrop");
  }

  function handlePartialDebtFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("partialDebtTargetId").value;
    const debt = (state.debts || []).find(d => d.id === id);
    if (!debt) return;

    const payAmt = parseFloat(document.getElementById("partialDebtAmountInput").value) || 0;
    const payDate = document.getElementById("partialDebtDateInput").value || new Date().toISOString().split("T")[0];
    const payMethod = document.getElementById("partialDebtPaymentMethod")?.value || "Bank Transfer";
    const payNotes = document.getElementById("partialDebtNotesInput")?.value?.trim() || "";

    if (payAmt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const debtTitle = debt.title || debt.name || "Debt";
    const debtCur = debt.currency || state.displayCurrency || "EUR";
    const origAmt = parseFloat(debt.amount) || 0;
    const currentPaid = parseFloat(debt.paidAmount) || 0;
    const currentRem = Math.max(0, origAmt - currentPaid);

    const actualPay = Math.min(payAmt, currentRem);
    const newPaidTotal = currentPaid + actualPay;
    const newRem = Math.max(0, origAmt - newPaidTotal);

    // 1. Create logged expense in transactions ledger
    const expenseId = "exp_" + Date.now();
    state.expenses.unshift({
      id: expenseId,
      title: `${debtTitle} (Payment)`,
      amount: actualPay,
      currency: debtCur,
      category: debt.category || "Utilities",
      date: payDate,
      paymentMethod: payMethod,
      notes: payNotes ? `Partial payment on ${debtTitle}: ${payNotes}` : `Partial payment on ${debtTitle}`,
      isSubscription: false,
      hasAttachment: false,
      createdAt: new Date().toISOString()
    });

    // 2. Update debt record
    if (newRem <= 0.01) {
      state.debts = state.debts.filter(d => d.id !== id);
      showMobileToast(`Debt fully settled! 🎉`);
    } else {
      debt.paidAmount = newPaidTotal;
      showMobileToast(`Payment recorded! ${formatMoney(newRem, debtCur)} left.`);
    }

    saveAllToLocalStorage();
    renderNeedsToPayView();
    renderExpensesView();
    renderBudgetView();
    pushToVault();
    closeBottomSheet("partialDebtSheet", "partialDebtBackdrop");
  }

  function exportExpensesToCsv() {
    const list = state.expenses || [];
    if (list.length === 0) {
      showMobileToast("No expenses to export");
      return;
    }
    const headers = ["Date", "Title", "Amount", "Currency", "Category", "Payment Method", "Type", "Notes"];
    const rows = list.map(e => [
      `"${(e.date || '').replace(/"/g, '""')}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.amount || 0)}"`,
      `"${(e.currency || state.displayCurrency || 'EUR').replace(/"/g, '""')}"`,
      `"${(e.category || 'Other').replace(/"/g, '""')}"`,
      `"${(e.paymentMethod || 'Card').replace(/"/g, '""')}"`,
      `"${e.isIncome ? 'Income' : (e.isSubscription ? 'Subscription' : 'Expense')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finland_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMobileToast("Expenses exported to CSV! 📊");
  }

  // ==========================================
  // 18. INITIALIZATION & BINDINGS
  // ==========================================
  function renderActiveView() {
    renderHubView();
    if (state.activeTab === "viewExpenses") renderExpensesView();
    else if (state.activeTab === "viewSubscriptions") renderSubscriptionsView();
    else if (state.activeTab === "viewBudget") renderBudgetView();
    else if (state.activeTab === "viewProjectFollowup") renderProjectFollowupView();
    else if (state.activeTab === "viewNeedsToPay") renderNeedsToPayView();
    else if (state.activeTab === "viewWishlist") renderWishlistView();
    else if (state.activeTab === "viewNotes") renderNotesView();
    else if (state.activeTab === "viewReports") renderReportsView();
  }

  function init() {
    loadLocalData();
    applyMobileNavConfig();
    updateMonthLabel();
    setupBottomSheets();
    setupFileAttachments();

    // Pull-and-sync from vault immediately on startup
    syncFromVault(false);

    // Initial render & restore saved active tab on refresh
    const rawHash = (window.location.hash || '').replace('#', '').trim();
    const savedTab = rawHash || localStorage.getItem('mobile_active_tab') || 'viewNotes';
    const validViews = ['viewExpenses', 'viewSubscriptions', 'viewBudget', 'viewProjectFollowup', 'viewNeedsToPay', 'viewWishlist', 'viewNotes', 'viewReports', 'viewHub'];
    if (validViews.includes(savedTab) && document.getElementById(savedTab)) {
      switchTab(savedTab);
    } else {
      switchTab('viewNotes');
    }
    const initFab = document.getElementById("mobileFabBtn");
    if (initFab) {
      if (state.appPrefs?.quickAddFabVisibility === 'transactions') {
        initFab.classList.toggle('hidden', state.activeTab !== 'viewExpenses');
      } else {
        initFab.classList.remove('hidden');
      }
    }

    // Tab Bar click events
    document.querySelectorAll(".mobile-nav-btn[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });

    document.querySelectorAll(".top-tab-btn[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });

    document.querySelectorAll(".switch-to-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        closeBottomSheet("moreMenuSheet", "moreMenuBackdrop");
        switchTab(btn.getAttribute("data-tab"));
      });
    });

    // Hub View Grid Cards
    document.querySelectorAll(".hub-card-btn[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });

    // Secondary Hub Navigation bar buttons
    document.querySelectorAll(".hub-sub-tab-btn[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });
    const backToHubBtn = document.getElementById("mobileBackToHubBtn");
    if (backToHubBtn) {
      backToHubBtn.addEventListener("click", () => switchTab("viewHub"));
    }
    const hubHomeBtn = document.querySelector('[data-hub-action="home"]');
    if (hubHomeBtn) {
      hubHomeBtn.addEventListener("click", () => switchTab("viewHub"));
    }

    // Hero Quick Action buttons
    const heroExpBtn = document.getElementById("mobileHeroAddExpenseBtn");
    if (heroExpBtn) {
      heroExpBtn.addEventListener("click", () => openAddExpenseSheet(false));
    }
    const heroIncBtn = document.getElementById("mobileHeroAddIncomeBtn");
    if (heroIncBtn) {
      heroIncBtn.addEventListener("click", () => openAddExpenseSheet(true));
    }

    // More menu button
    const moreBtn = document.getElementById("openMoreMenuBtn");
    if (moreBtn) moreBtn.addEventListener("click", () => openBottomSheet("moreMenuSheet", "moreMenuBackdrop"));

    const moreSyncBtn = document.getElementById("moreOpenSyncBtn");
    if (moreSyncBtn) moreSyncBtn.addEventListener("click", () => {
      closeBottomSheet("moreMenuSheet", "moreMenuBackdrop");
      openBottomSheet("syncSheet", "syncSheetBackdrop");
    });

    // Month Navigation
    const prevBtn = document.getElementById("mobilePrevMonthBtn");
    const nextBtn = document.getElementById("mobileNextMonthBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => setMonth(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => setMonth(1));

    const monthLbl = document.getElementById("mobileMonthLabel");
    if (monthLbl) {
      monthLbl.classList.add("cursor-pointer");
      monthLbl.addEventListener("click", () => {
        if (state.selectedMonth === "ALL") {
          const now = new Date();
          state.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        } else {
          state.selectedMonth = "ALL";
        }
        updateMonthLabel();
        renderActiveView();
      });
    }

    const budgetAllTimeBtn = document.getElementById("mobileBudgetAllTimeBtn");
    if (budgetAllTimeBtn) {
      budgetAllTimeBtn.addEventListener("click", () => {
        if (state.selectedMonth === "ALL") {
          const now = new Date();
          state.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        } else {
          state.selectedMonth = "ALL";
        }
        updateMonthLabel();
        renderActiveView();
      });
    }

    // Currency Switcher
    updateMobileCurrencyButtonsUI();

    // Refresh Sync Button
    const refreshBtn = document.getElementById("mobileRefreshSyncBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", () => syncFromVault(true));

    const forceSyncBtn = document.getElementById("mobileForceSyncBtn");
    if (forceSyncBtn) forceSyncBtn.addEventListener("click", () => syncFromVault(true));

    // FAB Button
    const fab = document.getElementById("mobileFabBtn");
    if (fab) fab.addEventListener("click", () => openBottomSheet("fabActionSheet", "fabActionBackdrop"));

    // Quick Action Add Expense
    const qaAddExp = document.getElementById("quickActionAddExpense");
    if (qaAddExp) qaAddExp.addEventListener("click", openAddExpenseSheet);

    // Expense Form
    const expForm = document.getElementById("mobileExpenseForm");
    if (expForm) expForm.addEventListener("submit", handleExpenseFormSubmit);

    // Delete Expense
    const delExpBtn = document.getElementById("mobileDeleteExpenseBtn");
    if (delExpBtn) {
      delExpBtn.addEventListener("click", async () => {
        const id = document.getElementById("mobileEditExpenseId").value;
        if (id) {
          if (!await confirmAction("Delete this transaction?")) return;
          const expToDelete = state.expenses.find(x => x.id === id);
          if (expToDelete && expToDelete.wise_id) {
            try {
              const rawIgnored = localStorage.getItem(STORAGE_KEYS.WISE_DELETED_IDS) || "[]";
              const ignoredList = JSON.parse(rawIgnored);
              if (!ignoredList.includes(expToDelete.wise_id)) {
                ignoredList.push(expToDelete.wise_id);
                localStorage.setItem(STORAGE_KEYS.WISE_DELETED_IDS, JSON.stringify(ignoredList));
              }
            } catch (e) {}
          }
          state.expenses = state.expenses.filter(x => x.id !== id);
          saveAllToLocalStorage();
          renderExpensesView();
          pushToVault();
          closeBottomSheet("expenseSheet", "expenseSheetBackdrop");
          showMobileToast("Expense deleted");
        }
      });
    }

    // Preview Receipt from Expense Sheet
    const previewReceiptBtn = document.getElementById("mobilePreviewReceiptBtn");
    if (previewReceiptBtn) {
      previewReceiptBtn.addEventListener("click", () => {
        if (state.currentExpenseBeingEdited) {
          openMobileReceiptViewer(state.currentExpenseBeingEdited);
        } else if (state.pendingExpenseReceipt) {
          openMobileReceiptViewer({
            title: document.getElementById("mobileExpenseTitle")?.value || "New Receipt",
            amount: parseFloat(document.getElementById("mobileExpenseAmount")?.value) || 0,
            currency: document.getElementById("mobileExpenseCurrency")?.value || state.displayCurrency,
            date: document.getElementById("mobileExpenseDate")?.value || new Date().toISOString().split("T")[0],
            receiptImage: state.pendingExpenseReceipt,
            receiptName: state.pendingExpenseReceiptName
          });
        }
      });
    }

    // Toggle Waive Receipt from Expense Sheet
    const toggleWaiveBtn = document.getElementById("mobileToggleWaiveReceiptBtn");
    if (toggleWaiveBtn) {
      toggleWaiveBtn.addEventListener("click", () => {
        state.modalNoReceiptNeeded = !state.modalNoReceiptNeeded;
        updateReceiptBadgeUI(state.currentExpenseBeingEdited);
        showMobileToast(state.modalNoReceiptNeeded ? "Receipt requirement waived" : "Receipt requirement restored");
      });
    }

    document.querySelectorAll(".mobile-filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".mobile-filter-pill").forEach(p => {
          p.classList.remove("active", "bg-slate-900", "text-white");
          p.classList.add("bg-slate-100", "text-slate-600");
          const b = p.querySelector("span[id$='Badge']");
          if (b) {
            b.classList.remove("bg-white/20", "text-white");
            b.classList.add("bg-slate-200", "text-slate-600");
          }
        });
        pill.classList.add("active", "bg-slate-900", "text-white");
        pill.classList.remove("bg-slate-100", "text-slate-600");
        const b = pill.querySelector("span[id$='Badge']");
        if (b) {
          b.classList.remove("bg-slate-200", "text-slate-600");
          b.classList.add("bg-white/20", "text-white");
        }
        state.filter = pill.getAttribute("data-filter");
        renderExpensesView();
      });
    });

    const searchInput = document.getElementById("mobileSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.trim();
        renderExpensesView();
      });
    }

    const catSelect = document.getElementById("mobileFilterCategory");
    if (catSelect) {
      catSelect.addEventListener("change", (e) => {
        state.categoryFilter = e.target.value;
        renderExpensesView();
      });
    }

    const sortSelect = document.getElementById("mobileSortDropdown");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.sort = e.target.value;
        renderExpensesView();
      });
    }

    // Project Filter Pills
    document.querySelectorAll(".mobile-project-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mobile-project-filter").forEach(b => {
          b.classList.remove("active", "bg-white", "text-slate-900", "shadow-2xs");
          b.classList.add("text-slate-500");
        });
        btn.classList.add("active", "bg-white", "text-slate-900", "shadow-2xs");
        btn.classList.remove("text-slate-500");
        state.projectFilter = btn.getAttribute("data-filter");
        renderFreelanceProjectsFeed();
      });
    });

    // Add Project
    const addProjBtn = document.getElementById("openMobileAddProjectBtn");
    if (addProjBtn) addProjBtn.addEventListener("click", openAddProjectSheet);

    const projForm = document.getElementById("mobileProjectForm");
    if (projForm) projForm.addEventListener("submit", handleProjectFormSubmit);

    const projStatusSelect = document.getElementById("mobileProjectStatus");
    if (projStatusSelect) {
      projStatusSelect.addEventListener("change", (e) => {
        const paidContainer = document.getElementById("mobileProjectPaidDateContainer");
        const paidInput = document.getElementById("mobileProjectPaidDate");
        if (paidContainer) {
          if (e.target.value === "paid") {
            paidContainer.classList.remove("hidden");
            if (paidInput && !paidInput.value) {
              paidInput.value = document.getElementById("mobileProjectDueDate").value || new Date().toISOString().split("T")[0];
            }
          } else {
            paidContainer.classList.add("hidden");
          }
        }
      });
    }

    const deleteProjBtn = document.getElementById("mobileDeleteProjectBtn");
    if (deleteProjBtn) {
      deleteProjBtn.addEventListener("click", async () => {
        const id = document.getElementById("mobileEditProjectId").value;
        if (!id) return;
        if (await confirmAction("Delete this freelance project?")) {
          state.budget.projects = (state.budget.projects || []).filter(p => p.id !== id);
          saveAllToLocalStorage();
          renderBudgetView();
          pushToVault();
          closeBottomSheet("projectSheet", "projectSheetBackdrop");
          showMobileToast("Project deleted");
        }
      });
    }

    // Payment Form
    const payForm = document.getElementById("mobilePaymentForm");
    if (payForm) payForm.addEventListener("submit", handlePaymentFormSubmit);

    const mobilePayCurSelect = document.getElementById("mobilePaymentCurrency");
    if (mobilePayCurSelect) {
      mobilePayCurSelect.addEventListener("change", () => {
        const prevCur = mobilePayCurSelect.dataset.prevCur || "EUR";
        const newCur = mobilePayCurSelect.value;
        const amtInput = document.getElementById("mobilePaymentAmount");
        if (amtInput && amtInput.value) {
          const curVal = parseFloat(amtInput.value) || 0;
          if (curVal > 0 && prevCur !== newCur) {
            amtInput.value = convertCurrency(curVal, prevCur, newCur).toFixed(2);
          }
        }
        mobilePayCurSelect.dataset.prevCur = newCur;
        updateMobilePaymentConversionPreview();
      });
    }

    const mobilePayAmtInput = document.getElementById("mobilePaymentAmount");
    if (mobilePayAmtInput) {
      mobilePayAmtInput.addEventListener("input", updateMobilePaymentConversionPreview);
    }

    // Adjust Budget & Tax
    const adjustBudBtn = document.getElementById("openMobileBudgetAdjustBtn");
    if (adjustBudBtn) adjustBudBtn.addEventListener("click", openBudgetAdjustSheet);

    const autoBudgetBtn = document.getElementById("mobileAutoBudgetBtn");
    if (autoBudgetBtn) autoBudgetBtn.addEventListener("click", executeAutoSuggestBudgets);

    const saveAdjustBtn = document.getElementById("saveBudgetAdjustBtn");
    if (saveAdjustBtn) saveAdjustBtn.addEventListener("click", handleSaveBudgetAdjust);

    // Tax slider & input sync
    const taxIn = document.getElementById("mobileTaxInput");
    const taxSl = document.getElementById("mobileTaxSlider");
    if (taxIn && taxSl) {
      taxIn.addEventListener("input", () => { taxSl.value = taxIn.value; });
      taxSl.addEventListener("input", () => { taxIn.value = taxSl.value; });
    }

    document.querySelectorAll(".mobile-tax-preset").forEach(b => {
      b.addEventListener("click", () => {
        const val = b.getAttribute("data-tax");
        if (taxIn) taxIn.value = val;
        if (taxSl) taxSl.value = val;
        document.querySelectorAll(".mobile-tax-preset").forEach(x => {
          x.classList.remove("active", "bg-slate-900", "text-white");
          x.classList.add("bg-white", "text-slate-700");
        });
        b.classList.add("active", "bg-slate-900", "text-white");
      });
    });

    // Notes Handlers
    const addNoteBtn = document.getElementById("openMobileAddNoteBtn");
    const qaAddNote = document.getElementById("quickActionAddNote");
    if (addNoteBtn) addNoteBtn.addEventListener("click", openAddNoteSheet);
    if (qaAddNote) qaAddNote.addEventListener("click", openAddNoteSheet);

    const closeNoteBtn = document.getElementById("closeNoteSheetBtn");
    if (closeNoteBtn) {
      closeNoteBtn.addEventListener("click", () => {
        closeBottomSheet("noteSheet", "noteSheetBackdrop");
      });
    }

    // Link attachment controls in note sheet
    const addNoteLinkBtn = document.getElementById("mobileNoteAddLinkBtn");
    const noteLinkUrlInput = document.getElementById("mobileNoteLinkUrl");
    const noteLinkTitleInput = document.getElementById("mobileNoteLinkTitle");
    const cancelMobileLinkBtn = document.getElementById("mobileNoteCancelEditLinkBtn");

    const addLinkFromSheetInput = () => {
      if (!noteLinkUrlInput) return;
      let rawUrl = noteLinkUrlInput.value.trim();
      if (!rawUrl) return;
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = "https://" + rawUrl;
      }
      const title = noteLinkTitleInput ? noteLinkTitleInput.value.trim() : "";
      if (!state.pendingNoteLinks) state.pendingNoteLinks = [];
      if (mobileEditingLinkIdx >= 0 && mobileEditingLinkIdx < state.pendingNoteLinks.length) {
        state.pendingNoteLinks[mobileEditingLinkIdx] = {
          ...state.pendingNoteLinks[mobileEditingLinkIdx],
          url: rawUrl,
          title: title || formatLinkDomain(rawUrl)
        };
        cancelMobileEditingLink();
      } else {
        state.pendingNoteLinks.push({
          id: "link_" + Date.now() + "_" + Math.random().toString(36).substr(2, 3),
          url: rawUrl,
          title: title || formatLinkDomain(rawUrl)
        });
        noteLinkUrlInput.value = "";
        if (noteLinkTitleInput) noteLinkTitleInput.value = "";
        renderPendingNoteLinks();
        noteLinkUrlInput.focus();
      }
    };

    if (addNoteLinkBtn) addNoteLinkBtn.addEventListener("click", addLinkFromSheetInput);
    if (cancelMobileLinkBtn) cancelMobileLinkBtn.addEventListener("click", cancelMobileEditingLink);
    if (noteLinkUrlInput) {
      noteLinkUrlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          addLinkFromSheetInput();
        }
      });
    }
    if (noteLinkTitleInput) {
      noteLinkTitleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          addLinkFromSheetInput();
        }
      });
    }

    // Delete note from sheet
    const deleteNoteSheetBtn = document.getElementById("mobileDeleteNoteBtn");
    if (deleteNoteSheetBtn) {
      deleteNoteSheetBtn.addEventListener("click", async () => {
        const id = document.getElementById("mobileEditNoteId").value;
        if (!id) return;
        if (await confirmAction("Delete this note?")) {
          state.notes = state.notes.filter(n => n.id !== id);
          saveAllToLocalStorage();
          renderNotesView();
          if (typeof renderMobileSubscriptionCalendar === 'function') renderMobileSubscriptionCalendar();
          pushToVault();
          closeBottomSheet("noteSheet", "noteSheetBackdrop");
          showMobileToast("Note deleted");
        }
      });
    }

    // Cancel note from sheet
    const cancelNoteSheetBtn = document.getElementById("mobileCancelNoteBtn");
    if (cancelNoteSheetBtn) {
      cancelNoteSheetBtn.addEventListener("click", () => {
        closeBottomSheet("noteSheet", "noteSheetBackdrop");
      });
    }

    const mobileBodyBoxesContainer = document.getElementById("mobileNoteBodyBoxesContainer");
    const mobileAddBodyBoxBtn = document.getElementById("mobileAddNoteBodyBoxBtn");
    if (mobileAddBodyBoxBtn) {
      mobileAddBodyBoxBtn.addEventListener("click", () => {
        const current = getMobileBodyBoxesFromDOM();
        current.push("");
        renderMobileNoteBodyBoxes(current);
        if (mobileBodyBoxesContainer) {
          const inputs = mobileBodyBoxesContainer.querySelectorAll(".mobile-note-body-box-input");
          const last = inputs[inputs.length - 1];
          if (last) last.focus();
        }
      });
    }
    if (mobileBodyBoxesContainer) {
      mobileBodyBoxesContainer.addEventListener("click", (e) => {
        const moveBtn = e.target.closest(".mobile-move-note-body-box-btn");
        if (moveBtn) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(moveBtn.getAttribute("data-idx"), 10);
          const dir = parseInt(moveBtn.getAttribute("data-dir"), 10);
          const current = getMobileBodyBoxesFromDOM();
          const targetIdx = idx + dir;
          if (!isNaN(idx) && !isNaN(dir) && targetIdx >= 0 && targetIdx < current.length) {
            const temp = current[idx];
            current[idx] = current[targetIdx];
            current[targetIdx] = temp;
            renderMobileNoteBodyBoxes(current);
          }
          return;
        }
        const rmBtn = e.target.closest(".mobile-remove-note-body-box-btn");
        if (!rmBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(rmBtn.getAttribute("data-idx"), 10);
        const current = getMobileBodyBoxesFromDOM();
        if (!isNaN(idx) && idx >= 0 && idx < current.length && current.length > 1) {
          current.splice(idx, 1);
          renderMobileNoteBodyBoxes(current);
        }
      });
    }

    // Save current mobile note directly
    const saveCurrentMobileNote = () => {
      const id = document.getElementById("mobileEditNoteId").value;
      const title = (document.getElementById("mobileNoteTitle").value || '').trim();
      const label = (document.getElementById("mobileNoteLabel").value || '').trim();
      const dueDate = document.getElementById("mobileNoteDueDate").value;
      const bodyBlocks = getMobileBodyBoxesFromDOM().map(b => (b || '').trim()).filter(Boolean);
      const body = bodyBlocks[0] || '';
      const color = document.getElementById("mobileNoteColorInput").value || "#6366f1";

      if (!title) {
        alert("Please enter a note headline.");
        document.getElementById("mobileNoteTitle").focus();
        return;
      }

      // Auto-commit any pending URL typed into the link input before saving
      if (noteLinkUrlInput && noteLinkUrlInput.value.trim()) {
        addLinkFromSheetInput();
      }

      if (id) {
        const idx = state.notes.findIndex(n => n.id === id);
        if (idx !== -1) {
          state.notes[idx] = Object.assign(state.notes[idx], {
            title,
            label,
            dueDate,
            body,
            bodyBlocks,
            color,
            attachments: (state.pendingNoteAttachments || []).slice(),
            links: (state.pendingNoteLinks || []).slice()
          });
        }
      } else {
        state.notes.unshift({
          id: "note_" + Date.now(),
          title,
          label,
          dueDate,
          body,
          bodyBlocks,
          color,
          isPinned: false,
          completed: false,
          isDone: false,
          attachments: (state.pendingNoteAttachments || []).slice(),
          links: (state.pendingNoteLinks || []).slice(),
          createdAt: new Date().toISOString()
        });
      }

      saveAllToLocalStorage();
      renderNotesView();
      if (typeof renderMobileSubscriptionCalendar === 'function') renderMobileSubscriptionCalendar();
      pushToVault();
      closeBottomSheet("noteSheet", "noteSheetBackdrop");
      showMobileToast("Note saved!");
    };

    const noteForm = document.getElementById("mobileNoteForm");
    if (noteForm) {
      noteForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveCurrentMobileNote();
      });
    }

    // Capture-phase keydown: Enter saves, Esc dismisses on mobile sheet
    window.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      const quickViewModal = document.getElementById("docQuickViewModal");
      if (quickViewModal && !quickViewModal.classList.contains("hidden")) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeMobileDocQuickView();
        }
        return;
      }

      const sheet = document.getElementById("noteSheet");
      if (!sheet || sheet.classList.contains("closed")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (mobileEditingLinkIdx >= 0 && (e.target === noteLinkUrlInput || e.target === noteLinkTitleInput)) {
          cancelMobileEditingLink();
          return;
        }
        closeBottomSheet("noteSheet", "noteSheetBackdrop");
        return;
      }

      if (e.key === "Enter") {
        if (e.target === noteLinkUrlInput || e.target === noteLinkTitleInput) {
          if (noteLinkUrlInput && noteLinkUrlInput.value.trim()) {
            e.preventDefault();
            e.stopPropagation();
            addLinkFromSheetInput();
            return;
          }
        }
        if (e.target && e.target.classList && e.target.classList.contains("mobile-note-body-box-input")) {
          if (e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          saveCurrentMobileNote();
          return;
        }
        if (e.target && e.target.tagName === 'BUTTON' && e.target.type !== 'submit') {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        saveCurrentMobileNote();
      }
    }, true);

    // Color picker
    document.querySelectorAll("#mobileNoteColorPicker button").forEach(b => {
      b.addEventListener("click", () => {
        const col = b.getAttribute("data-color");
        document.getElementById("mobileNoteColorInput").value = col;
        updateMobileColorPickerActive(col);
      });
    });

    // Debts Handlers
    const addDebtBtn = document.getElementById("openMobileAddDebtBtn");
    const qaAddDebt = document.getElementById("quickActionAddDebt");
    if (addDebtBtn) addDebtBtn.addEventListener("click", openAddDebtSheet);
    if (qaAddDebt) qaAddDebt.addEventListener("click", openAddDebtSheet);

    const mobileDelDebtBtn = document.getElementById("mobileDeleteDebtBtn");
    if (mobileDelDebtBtn) {
      mobileDelDebtBtn.addEventListener("click", async () => {
        const id = document.getElementById("mobileEditDebtId").value;
        if (!id) return;
        if (await confirmAction("Delete this bill/debt?")) {
          state.debts = state.debts.filter(d => d.id !== id);
          saveAllToLocalStorage();
          renderNeedsToPayView();
          pushToVault();
          closeBottomSheet("debtSheet", "debtSheetBackdrop");
          showMobileToast("Bill/Debt deleted");
        }
      });
    }

    const debtForm = document.getElementById("mobileDebtForm");
    if (debtForm) {
      debtForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("mobileEditDebtId").value;
        const name = document.getElementById("mobileDebtName").value.trim();
        const amount = parseFloat(document.getElementById("mobileDebtAmount").value) || 0;
        const currency = document.getElementById("mobileDebtCurrency").value;
        const category = document.getElementById("mobileDebtCategory").value;
        const dueDate = document.getElementById("mobileDebtDueDate").value;

        if (!name || amount <= 0) return;

        if (id) {
          const idx = state.debts.findIndex(d => d.id === id);
          if (idx !== -1) {
            const existing = state.debts[idx];
            const newPaid = Math.min(parseFloat(existing.paidAmount) || 0, amount);
            state.debts[idx] = {
              ...existing,
              name,
              title: name,
              amount,
              currency,
              category,
              dueDate,
              paidAmount: newPaid,
              isPaid: (amount - newPaid) <= 0.01,
              isSettled: (amount - newPaid) <= 0.01
            };
          }
        } else {
          state.debts.unshift({
            id: "debt_" + Date.now(),
            name,
            title: name,
            amount,
            paidAmount: 0,
            remainingAmount: amount,
            currency,
            category,
            dueDate,
            isPaid: false,
            isSettled: false,
            createdAt: new Date().toISOString()
          });
        }

        saveAllToLocalStorage();
        renderNeedsToPayView();
        pushToVault();
        closeBottomSheet("debtSheet", "debtSheetBackdrop");
        showMobileToast("Bill/Debt saved!");
      });
    }

    // Subscriptions Handlers
    const addSubBtn = document.getElementById("openMobileAddSubBtn");
    if (addSubBtn) addSubBtn.addEventListener("click", openAddSubSheet);

    const mobileDelSubBtn = document.getElementById("mobileDeleteSubBtn");
    if (mobileDelSubBtn) {
      mobileDelSubBtn.addEventListener("click", async () => {
        const id = document.getElementById("mobileEditSubId").value;
        if (!id) return;
        if (await confirmAction("Delete this subscription?")) {
          state.subscriptions = state.subscriptions.filter(s => s.id !== id);
          saveAllToLocalStorage();
          renderSubscriptionsView();
          renderBudgetView();
          renderNeedsToPayView();
          pushToVault();
          closeBottomSheet("subSheet", "subSheetBackdrop");
          showMobileToast("Recurring subscription deleted");
        }
      });
    }

    const mobileFreezeBtn = document.getElementById("mobileFreezeSubBtn");
    if (mobileFreezeBtn) {
      mobileFreezeBtn.addEventListener("click", () => {
        const id = document.getElementById("mobileEditSubId").value;
        if (!id) return;
        toggleFreezeSubscription(id);
        closeBottomSheet("subSheet", "subSheetBackdrop");
      });
    }

    const subForm = document.getElementById("mobileSubForm");
    if (subForm) {
      subForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("mobileEditSubId").value;
        const name = document.getElementById("mobileSubName").value.trim();
        const amount = parseFloat(document.getElementById("mobileSubAmount").value) || 0;
        const currency = document.getElementById("mobileSubCurrency").value;
        const catEl = document.getElementById("mobileSubCategory");
        const category = catEl ? catEl.value : "Subscriptions";
        const billingCycle = document.getElementById("mobileSubCycle").value;
        const nextBillingDate = document.getElementById("mobileSubDate").value;

        if (!name || amount <= 0) return;

        const billingDay = (nextBillingDate && nextBillingDate.includes('-')) 
          ? parseInt(nextBillingDate.split('-')[2], 10) 
          : new Date().getDate();
        const recurringType = isBasicRecurringCategory(category, name) ? 'basic_recurring' : 'subscription';

        if (id) {
          const idx = state.subscriptions.findIndex(s => s.id === id);
          if (idx !== -1) {
            state.subscriptions[idx] = Object.assign(state.subscriptions[idx], {
              name, amount, currency, category, billingCycle, nextBillingDate,
              billingDay,
              recurringType: state.subscriptions[idx].recurringType || recurringType,
              lastBilledDate: state.subscriptions[idx].lastBilledDate || nextBillingDate
            });
            const nextInfo = calculateSubNextDate(state.subscriptions[idx]);
            state.subscriptions[idx].nextBillingDate = nextInfo.nextBillingDate;
          }
        } else {
          const newSub = {
            id: "sub_" + Date.now(),
            name, amount, currency, category, billingCycle, nextBillingDate,
            billingDay,
            recurringType,
            lastBilledDate: nextBillingDate,
            createdAt: new Date().toISOString()
          };
          const nextInfo = calculateSubNextDate(newSub);
          newSub.nextBillingDate = nextInfo.nextBillingDate;
          state.subscriptions.unshift(newSub);
        }

        saveAllToLocalStorage();
        renderSubscriptionsView();
        renderBudgetView();
        renderNeedsToPayView();
        pushToVault();
        closeBottomSheet("subSheet", "subSheetBackdrop");
        showMobileToast("Recurring expense saved!");
      });
    }

    // Wishlist Handlers
    const addWishBtn = document.getElementById("openMobileAddWishBtn");
    if (addWishBtn) {
      addWishBtn.addEventListener("click", () => {
        openMobileWishSheetWithDefaults("Subscriptions", "monthly");
      });
    }

    const wishForm = document.getElementById("mobileWishForm");
    if (wishForm) {
      wishForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("mobileEditWishId").value;
        const name = document.getElementById("mobileWishTitle").value.trim();
        const price = parseFloat(document.getElementById("mobileWishPrice").value) || 0;
        const currency = document.getElementById("mobileWishCurrency").value;
        const url = document.getElementById("mobileWishUrl").value.trim();

        const category = document.getElementById("mobileWishCategory") ? document.getElementById("mobileWishCategory").value : "Subscriptions";
        const billingCycle = document.getElementById("mobileWishCycle") ? document.getElementById("mobileWishCycle").value : "monthly";

        if (!name || price <= 0) return;

        if (id) {
          const idx = state.wishlist.findIndex(w => w.id === id);
          if (idx !== -1) {
            state.wishlist[idx] = Object.assign({}, state.wishlist[idx], {
              name,
              amount: price,
              price,
              currency,
              url,
              category,
              billingCycle
            });
          }
        } else {
          state.wishlist.unshift({
            id: "wish_" + Date.now(),
            name,
            amount: price,
            price,
            currency,
            url,
            category,
            billingCycle,
            isSimulated: true,
            isPurchased: false,
            createdAt: new Date().toISOString()
          });
        }

        saveAllToLocalStorage();
        renderWishlistView();
        pushToVault();
        closeBottomSheet("wishSheet", "wishSheetBackdrop");
        showMobileToast(id ? "Wishlist item updated!" : "Wishlist item added!");
      });
    }

    // Lead Sheet & Project Followup Handlers
    const openLeadBtn = document.getElementById("openMobileNewLeadBtn");
    if (openLeadBtn) openLeadBtn.addEventListener("click", openAddLeadSheet);

    const openProjFromFollowupBtn = document.getElementById("openMobileNewProjectFromFollowupBtn");
    if (openProjFromFollowupBtn) openProjFromFollowupBtn.addEventListener("click", openAddProjectSheet);

    const closeLeadBtn = document.getElementById("closeLeadSheetBtn");
    if (closeLeadBtn) closeLeadBtn.addEventListener("click", closeLeadSheet);

    const leadBackdrop = document.getElementById("leadSheetBackdrop");
    if (leadBackdrop) leadBackdrop.addEventListener("click", closeLeadSheet);

    const leadForm = document.getElementById("mobileLeadForm");
    if (leadForm) leadForm.addEventListener("submit", handleLeadFormSubmit);

    const delLeadBtn = document.getElementById("mobileDeleteLeadBtn");
    if (delLeadBtn) {
      delLeadBtn.addEventListener("click", () => {
        const id = document.getElementById("mobileLeadId").value;
        if (id) deleteLead(id);
      });
    }

    const convertLeadBtn = document.getElementById("mobileConvertLeadToProjectBtn");
    if (convertLeadBtn) {
      convertLeadBtn.addEventListener("click", () => {
        const id = document.getElementById("mobileLeadId").value;
        if (id) convertLeadToProject(id);
      });
    }

    // Subscriptions View Sub-Category Filter Pills
    document.querySelectorAll(".mobile-subs-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        const filter = btn.getAttribute("data-sub-filter") || "all";
        state.monthlySubFilter = filter;
        document.querySelectorAll(".mobile-subs-filter").forEach(b => {
          const match = b.getAttribute("data-sub-filter") === filter;
          b.classList.toggle("active", match);
          b.classList.toggle("bg-white", match);
          b.classList.toggle("text-slate-900", match);
          b.classList.toggle("shadow-2xs", match);
          b.classList.toggle("text-slate-600", !match);
        });
        renderSubscriptionsView();
      });
    });

    // Advanced Bottom Sheets & Controls Event Listeners
    // Month Picker
    const monthPickerTrigger = document.getElementById("mobileMonthPickerTrigger");
    if (monthPickerTrigger) monthPickerTrigger.addEventListener("click", openMonthPickerSheet);

    const monthCurBtn = document.getElementById("monthPickerSelectCurrentBtn");
    if (monthCurBtn) {
      monthCurBtn.addEventListener("click", () => {
        const now = new Date();
        state.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        updateMonthLabel();
        renderActiveView();
        closeBottomSheet("monthPickerSheet", "monthPickerBackdrop");
        showMobileToast("Viewing Current Month");
      });
    }

    const monthAllBtn = document.getElementById("monthPickerSelectAllTimeBtn");
    if (monthAllBtn) {
      monthAllBtn.addEventListener("click", () => {
        state.selectedMonth = "ALL";
        updateMonthLabel();
        renderActiveView();
        closeBottomSheet("monthPickerSheet", "monthPickerBackdrop");
        showMobileToast("Viewing All Time");
      });
    }

    // Settings & Preferences
    const openSettingsBtn = document.getElementById("mobileOpenSettingsBtn");
    if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettingsSheet);

    const moreSettingsBtn = document.getElementById("moreOpenSettingsBtn");
    if (moreSettingsBtn) {
      moreSettingsBtn.addEventListener("click", () => {
        closeBottomSheet("moreMenuSheet", "moreMenuBackdrop");
        openSettingsSheet();
      });
    }

    const settingsTabPrefsBtn = document.getElementById("settingsTabPrefsBtn");
    if (settingsTabPrefsBtn) settingsTabPrefsBtn.addEventListener("click", () => switchSettingsTab("prefs"));
    const settingsTabMethodsBtn = document.getElementById("settingsTabMethodsBtn");
    if (settingsTabMethodsBtn) settingsTabMethodsBtn.addEventListener("click", () => switchSettingsTab("methods"));
    const settingsTabDataBtn = document.getElementById("settingsTabDataBtn");
    if (settingsTabDataBtn) settingsTabDataBtn.addEventListener("click", () => switchSettingsTab("data"));

    const savePrefsBtn = document.getElementById("savePrefsBtn");
    if (savePrefsBtn) savePrefsBtn.addEventListener("click", saveSettingsPreferences);

    const addNewPmBtn = document.getElementById("addNewPaymentMethodBtn");
    const newPmInput = document.getElementById("newPaymentMethodInput");
    if (addNewPmBtn && newPmInput) {
      addNewPmBtn.addEventListener("click", () => {
        const val = newPmInput.value.trim();
        if (val) {
          addPaymentMethodDirect(val);
          newPmInput.value = "";
        }
      });
    }

    // Settings Data & Vault buttons
    const settingsForceSyncBtn = document.getElementById("settingsForceSyncBtn");
    if (settingsForceSyncBtn) settingsForceSyncBtn.addEventListener("click", () => syncFromVault(true));

    const settingsExportVaultBtn = document.getElementById("settingsExportVaultBtn");
    if (settingsExportVaultBtn) {
      settingsExportVaultBtn.addEventListener("click", () => {
        const exportBtn = document.getElementById("mobileExportVaultBtn");
        if (exportBtn) exportBtn.click();
      });
    }

    const settingsExportCsvBtn = document.getElementById("settingsExportCsvBtn");
    if (settingsExportCsvBtn) settingsExportCsvBtn.addEventListener("click", exportExpensesToCsv);

    const settingsImportInput = document.getElementById("settingsImportVaultInput");
    if (settingsImportInput) {
      settingsImportInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              if (data.expenses) state.expenses = data.expenses;
              if (data.subscriptions) state.subscriptions = data.subscriptions;
              if (data.budget) state.budget = data.budget;
              if (data.debts) state.debts = data.debts;
              if (data.notes) state.notes = data.notes;
              if (data.wishlist) state.wishlist = data.wishlist;
              if (data.currency) state.displayCurrency = data.currency;
              saveAllToLocalStorage();
              pushToVault();
              renderActiveView();
              closeBottomSheet("settingsSheet", "settingsSheetBackdrop");
              showMobileToast("Vault successfully restored! 💾");
            } catch (err) {
              alert("Invalid JSON vault file.");
            }
          };
          reader.readAsText(file);
        }
      });
    }

    // Category Purchases Limit Setting
    const catSaveLimitBtn = document.getElementById("categoryPurchasesSaveLimitBtn");
    if (catSaveLimitBtn) catSaveLimitBtn.addEventListener("click", handleSaveCategoryPurchasesLimit);

    // Quick Add Payment Method Modal
    const quickAddPmBtn = document.getElementById("mobileAddPmQuickBtn");
    if (quickAddPmBtn) {
      quickAddPmBtn.addEventListener("click", () => {
        const qInput = document.getElementById("quickAddPmInput");
        if (qInput) qInput.value = "";
        openBottomSheet("quickAddPmModal", "quickAddPmBackdrop");
      });
    }

    const saveQuickAddPmBtn = document.getElementById("saveQuickAddPmBtn");
    if (saveQuickAddPmBtn) {
      saveQuickAddPmBtn.addEventListener("click", () => {
        const qInput = document.getElementById("quickAddPmInput");
        if (qInput && qInput.value.trim()) {
          addPaymentMethodDirect(qInput.value.trim());
          closeBottomSheet("quickAddPmModal", "quickAddPmBackdrop");
        }
      });
    }

    // Partial Debt Payment Form
    const partialDebtForm = document.getElementById("partialDebtForm");
    if (partialDebtForm) partialDebtForm.addEventListener("submit", handlePartialDebtFormSubmit);

    // Expense Form Extra Action Buttons
    const dupExpBtn = document.getElementById("mobileDuplicateExpenseBtn");
    if (dupExpBtn) dupExpBtn.addEventListener("click", duplicateCurrentExpense);

    const recExpBtn = document.getElementById("mobileMakeRecurringBtn");
    if (recExpBtn) recExpBtn.addEventListener("click", makeCurrentExpenseRecurring);

    const incToggle = document.getElementById("mobileExpenseIsIncome");
    if (incToggle) {
      incToggle.addEventListener("change", (e) => {
        const isInc = e.target.checked;
        const titleEl = document.getElementById("mobileExpenseModalTitle");
        const submitBtn = document.getElementById("mobileExpenseSubmitBtn");
        if (titleEl) {
          titleEl.textContent = isInc ? (state.currentExpenseBeingEdited ? "Edit Income" : "Log Income (+)") : (state.currentExpenseBeingEdited ? "Edit Expense" : "Log Expense");
        }
        if (submitBtn) {
          submitBtn.textContent = isInc ? "Save Income (+)" : "Save Expense";
        }
      });
    }


    // Mobile PIN Authentication Modal handlers
    const authPinInput = document.getElementById("vaultAuthPinInput");
    const authSubmitBtn = document.getElementById("vaultAuthSubmitBtn");
    const authErrorMsg = document.getElementById("vaultAuthErrorMsg");

    async function handleMobileAuthSubmit() {
      if (!authPinInput) return;
      const pin = authPinInput.value.trim();
      if (!pin) return;
      if (authErrorMsg) authErrorMsg.classList.add("hidden");
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.token) {
            localStorage.setItem("vault_auth_token", data.token);
            hideMobileAuthModal();
            authPinInput.value = "";
            syncFromVault(true);
            showMobileToast("Device Authorized! 🔒");
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (authErrorMsg) {
            authErrorMsg.textContent = errData.message || "Incorrect PIN. Please try again.";
            authErrorMsg.classList.remove("hidden");
          }
        }
      } catch (e) {
        if (authErrorMsg) {
          authErrorMsg.textContent = "Connection failed. Ensure host server is reachable.";
          authErrorMsg.classList.remove("hidden");
        }
      }
    }

    if (authSubmitBtn) authSubmitBtn.addEventListener("click", handleMobileAuthSubmit);
    if (authPinInput) {
      authPinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleMobileAuthSubmit();
      });
    }
  }

  // Run on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
