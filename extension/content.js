// Oh My Claude - Content Script
// Runs on claude.ai - fetches usage data (has cookie access) and sends to background

(function() {
  'use strict';

  let orgId = null;

  // Safe wrapper — SW may not be ready (e.g. after extension update)
  function sendToBackground(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      // Extension context invalidated
    }
  }

  // Extract org ID from API
  async function fetchOrgId() {
    try {
      const response = await fetch('https://claude.ai/api/organizations', {
        credentials: 'include'
      });
      if (response.ok) {
        const orgs = await response.json();
        if (orgs && orgs.length > 0) {
          orgId = orgs[0].uuid;
          sendToBackground({ type: 'ORG_ID_FOUND', orgId });
          return orgId;
        }
      }
    } catch {
      // Not logged in or network error
    }
    return null;
  }

  // Extract org ID from URL
  function findOrgIdInUrl() {
    const match = window.location.href.match(/organizations\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }

  // Ensure we have an org ID (URL first, then API)
  async function ensureOrgId() {
    if (orgId) return orgId;
    orgId = findOrgIdInUrl();
    if (orgId) {
      sendToBackground({ type: 'ORG_ID_FOUND', orgId });
      return orgId;
    }
    return await fetchOrgId();
  }

  // Fetch usage data and send to background script
  async function fetchAndSendUsage() {
    await ensureOrgId();
    if (!orgId) return;

    try {
      const response = await fetch(
        `https://claude.ai/api/organizations/${orgId}/usage`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          orgId = null; // Clear stale org ID so next attempt re-fetches
        }
        return;
      }

      const usageData = await response.json();
      sendToBackground({ type: 'USAGE_DATA', usage: usageData });
    } catch {
      // Network error
    }
  }

  // Listen for sync requests from background script (alarm-triggered)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_USAGE') {
      fetchAndSendUsage();
      sendResponse({ ok: true });
    }
    return false;
  });

  // Initialize after page settles
  setTimeout(() => fetchAndSendUsage(), 2000);
})();
