// Oh My Claude - Usage Sync Extension
// Background service worker - syncs Claude.ai usage to dashboard

const BACKEND_URL = 'http://localhost:4000';
const SYNC_INTERVAL_MINUTES = 1;

let orgId = null;

// Initialize alarm for periodic sync
chrome.alarms.create('syncUsage', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsage') {
    syncUsage();
  }
});

// Listen for org ID from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ORG_ID_FOUND') {
    orgId = message.orgId;
    chrome.storage.local.set({ orgId: message.orgId });
    console.log('[Oh My Claude] Org ID found:', orgId);
    syncUsage();
    sendResponse({ ok: true });
  }
  return false;
});

// Get org ID from storage on startup
chrome.storage.local.get(['orgId'], (result) => {
  if (result.orgId) {
    orgId = result.orgId;
    console.log('[Oh My Claude] Loaded org ID:', orgId);
    syncUsage();
  }
});

// Fetch usage data from Claude.ai
async function fetchUsage() {
  if (!orgId) {
    console.log('[Oh My Claude] No org ID yet, waiting...');
    return null;
  }

  try {
    const response = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.log('[Oh My Claude] Not logged in to Claude.ai');
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[Oh My Claude] Fetch error:', err);
    return null;
  }
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

// Main sync function
async function syncUsage() {
  const usageData = await fetchUsage();

  if (!usageData) {
    return;
  }

  const result = await sendToBackend(usageData);

  if (result?.success) {
    console.log(`[Oh My Claude] Synced: Session ${usageData.five_hour?.utilization || 0}%, Weekly ${usageData.seven_day?.utilization || 0}%`);
  }
}

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Oh My Claude] Extension installed - open claude.ai to start syncing');
});
