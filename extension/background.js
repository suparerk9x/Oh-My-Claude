// Oh My Claude - Usage Sync Extension
// Background service worker - fetches usage directly or via content script, sends to backend

const BACKEND_URL = 'http://localhost:4825';
const SYNC_INTERVAL_MINUTES = 1;
const MAX_BACKOFF_MINUTES = 16;

// Backoff state — persisted to storage so it survives SW restarts
let backendFailCount = 0;
let lastAttemptTime = 0;

// Restore state when service worker wakes up
chrome.storage.local.get(['_bf', '_la'], (d) => {
  backendFailCount = d._bf || 0;
  lastAttemptTime = d._la || 0;
});

function saveBackoffState() {
  chrome.storage.local.set({ _bf: backendFailCount, _la: lastAttemptTime });
}

// Initialize alarm for periodic sync
chrome.alarms.create('syncUsage', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsage') {
    // Exponential backoff: check if enough time has passed since last attempt
    if (backendFailCount > 0) {
      const backoffMs = Math.min(2 ** backendFailCount, MAX_BACKOFF_MINUTES) * 60_000;
      const elapsed = Date.now() - lastAttemptTime;
      if (elapsed < backoffMs) {
        return; // Too soon, skip this cycle
      }
    }
    syncUsage();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USAGE_DATA') {
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
    sendResponse({ ok: true });
  }

  return false;
});

// ── Direct fetch from background (no tab needed) ──────────────────

async function fetchOrgIdDirect() {
  try {
    const response = await fetch('https://claude.ai/api/organizations', {
      credentials: 'include',
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const orgs = await response.json();
      if (orgs && orgs.length > 0) {
        const id = orgs[0].uuid;
        chrome.storage.local.set({ orgId: id });
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
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ── Main sync logic ───────────────────────────────────────────────

async function syncUsage() {
  lastAttemptTime = Date.now();

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
        console.log(`[Oh My Claude] Synced: Session ${usageData.five_hour?.utilization || 0}%, Weekly ${usageData.seven_day?.utilization || 0}%`);
      }
      return;
    }
  } catch (e) {
    console.log('[Oh My Claude] Direct fetch failed, trying tab:', e.message);
  }

  // Strategy 2: Fall back to content script in claude.ai tab
  try {
    const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'FETCH_USAGE' });
        return; // One tab responding is enough
      } catch {
        // Content script not injected in this tab, try next
      }
    }
  } catch {
    // No tabs or query failed
  }
}

// ── Send to backend ───────────────────────────────────────────────

async function sendToBackend(usageData) {
  try {
    const response = await fetch(`${BACKEND_URL}/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        usage: usageData,
        timestamp: new Date().toISOString(),
        source: 'extension'
      })
    });

    if (!response.ok) {
      throw new Error(`Backend HTTP ${response.status}`);
    }

    const result = await response.json();

    // Success — reset backoff
    if (backendFailCount > 0) {
      backendFailCount = 0;
      saveBackoffState();
    }

    return result;
  } catch (err) {
    backendFailCount = Math.min(backendFailCount + 1, 10);
    saveBackoffState();
    const nextRetry = Math.min(2 ** backendFailCount, MAX_BACKOFF_MINUTES);
    console.error(`[Oh My Claude] Backend error (#${backendFailCount}, retry in ${nextRetry}m):`, err.message);
    return null;
  }
}

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Oh My Claude] Extension installed');
  backendFailCount = 0;
  lastAttemptTime = 0;
  saveBackoffState();
});
