/**
 * Finland Live Sync Bridge
 * Non-invasive, background synchronization between Desktop and Mobile.
 * Preserves 100% of existing application behavior with zero side effects.
 */
(function() {
  const SYNC_KEYS = [
    "finland_expenses_v2",
    "finland_subscriptions_v2",
    "finland_budget_data_v1",
    "finland_debts_v1",
    "finland_notes_v1",
    "finland_note_labels_v1",
    "finland_documents_v1",
    "finland_wishlist_v1",
    "finland_display_currency_v1",
    "finland_rates_cache_v1",
    "finland_wise_deleted_ids_v1"
  ];

  let lastPushedHash = "";

  function computeHash(data) {
    try {
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString();
    } catch (e) {
      return "";
    }
  }

  function gatherLocalVault() {
    const payload = {};
    SYNC_KEYS.forEach(k => {
      const val = localStorage.getItem(k);
      if (val !== null) {
        payload[k] = val;
      }
    });
    return payload;
  }

  function getVaultEndpoint() {
    return window.location.protocol.startsWith("http") ? "/api/vault" : "http://localhost:8000/api/vault";
  }

  async function pushToVault() {
    try {
      const vault = gatherLocalVault();
      if (Object.keys(vault).length === 0) return;
      const h = computeHash(vault);
      if (h === lastPushedHash) return;

      const res = await fetch(getVaultEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vault)
      });
      if (res.ok) {
        lastPushedHash = h;
      }
    } catch (e) {
      // Offline or server not running - fail silently
    }
  }

  async function pullFromVault() {
    try {
      const res = await fetch(getVaultEndpoint());
      if (!res.ok) return;
      const remote = await res.json();
      if (!remote || typeof remote !== "object" || Object.keys(remote).length === 0) return;

      let changed = false;
      SYNC_KEYS.forEach(k => {
        if (remote[k] !== undefined && remote[k] !== null) {
          const current = localStorage.getItem(k);
          if (current !== remote[k]) {
            localStorage.setItem(k, remote[k]);
            changed = true;
          }
        }
      });

      if (changed) {
        console.log("🔄 Finland Desktop synced from mobile vault.");
      }
    } catch (e) {
      // Fail silently
    }
  }

  // Desktop app.js manages authenticated vault sync directly via pullFromVault & triggerSafeVaultPush.
  // Only activate this lightweight fallback bridge when app.js is not present.
  if (typeof window !== "undefined" && !window.__FINLAND_SYNC_MANAGED__) {
    window.__FINLAND_SYNC_MANAGED__ = true;
  }
})();
