// Oh My Claude - Usage Sync Extension
// Background service worker - fetches usage directly or via content script, sends to backend

const BACKEND_URL = 'http://localhost:4824';
const SYNC_INTERVAL_MINUTES = 1;

// Initialize alarm for periodic sync
chrome.alarms.create('syncUsage', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsage') {
    syncUsage();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USAGE_DATA') {
    // Content script fetched usage data, send to backend
    sendToBackend(message.usage).then(result => {
      if (result?.success) {
        console.log(`[Oh My Claude] Synced via tab: Session ${message.usage.five_hour?.utilization || 0}%, Weekly ${message.usage.seven_day?.utilization || 0}%`);
      }
      sendResponse({ ok: true });
    });
    return true; // async sendResponse
  }

  if (message.type === 'ORG_ID_FOUND') {
    chrome.storage.local.set({ orgId: message.orgId });
    console.log('[Oh My Claude] Org ID saved:', message.orgId);
    sendResponse({ ok: true });
  }

  return false;
});

// ── Direct fetch from background (no tab needed) ──────────────────

async function fetchOrgIdDirect() {
  try {
    const response = await fetch('https://claude.ai/api/organizations', {
      credentials: 'include'
    });
    if (response.ok) {
      const orgs = await response.json();
      if (orgs && orgs.length > 0) {
        const id = orgs[0].uuid;
        chrome.storage.local.set({ orgId: id });
        console.log('[Oh My Claude] Org ID fetched directly:', id);
        return id;
      }
    }
  } catch (e) {
    // Not logged in or network error
  }
  return null;
}

async function fetchUsageDirect(orgId) {
  const response = await fetch(
    `https://claude.ai/api/organizations/${orgId}/usage`,
    { credentials: 'include' }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ── Main sync logic ───────────────────────────────────────────────

async function syncUsage() {
  // Strategy 1: Try direct fetch from background (works without tab)
  try {
    let { orgId } = await chrome.storage.local.get('orgId');
    if (!orgId) {
      orgId = await fetchOrgIdDirect();
    }
    if (orgId) {
      const usageData = await fetchUsageDirect(orgId);
      const result = await sendToBackend(usageData);
      if (result?.success) {
        console.log(`[Oh My Claude] Synced direct: Session ${usageData.five_hour?.utilization || 0}%, Weekly ${usageData.seven_day?.utilization || 0}%`);
      }
      return; // Success — no need for tab fallback
    }
  } catch (e) {
    // Direct fetch failed (cookie expired, 401, etc.) — fall through to tab
    console.log('[Oh My Claude] Direct fetch failed, trying tab:', e.message);
  }

  // Strategy 2: Fall back to content script in claude.ai tab
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_USAGE' }).catch(() => {});
    }
  });
}

// Send usage data to backend
async function sendToBackend(usageData) {
  try {
    const response = await fetch(`${BACKEND_URL}/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usage: usageData,
        timestamp: new Date().toISOString(),
        source: 'extension'
      })
    });

    if (!response.ok) {
      throw new Error(`Backend HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[Oh My Claude] Backend error:', err);
    return null;
  }
}

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Oh My Claude] Extension installed - syncs automatically (no tab required after first login)');
});
