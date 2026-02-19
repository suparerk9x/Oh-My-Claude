// Oh My Claude - Usage Sync Extension
// Background service worker - receives usage data from content script and sends to backend

const BACKEND_URL = 'http://localhost:4824';
const SYNC_INTERVAL_MINUTES = 1;

// Initialize alarm for periodic sync
chrome.alarms.create('syncUsage', { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncUsage') {
    triggerContentScriptSync();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USAGE_DATA') {
    // Content script fetched usage data, send to backend
    sendToBackend(message.usage).then(result => {
      if (result?.success) {
        console.log(`[Oh My Claude] Synced: Session ${message.usage.five_hour?.utilization || 0}%, Weekly ${message.usage.seven_day?.utilization || 0}%`);
      }
      sendResponse({ ok: true });
    });
    return true; // async sendResponse
  }

  if (message.type === 'ORG_ID_FOUND') {
    chrome.storage.local.set({ orgId: message.orgId });
    console.log('[Oh My Claude] Org ID found:', message.orgId);
    sendResponse({ ok: true });
  }

  return false;
});

// Tell the content script on claude.ai to fetch usage
function triggerContentScriptSync() {
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_USAGE' }).catch(() => {
        // Content script not ready, ignore
      });
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
  console.log('[Oh My Claude] Extension installed - open claude.ai to start syncing');
});
