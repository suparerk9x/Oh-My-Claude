// Oh My Claude - Content Script
// Runs on claude.ai - fetches usage data (has cookie access) and sends to background

(function() {
  'use strict';

  console.log('[Oh My Claude] Content script loaded');

  let orgId = null;

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
          console.log('[Oh My Claude] Found org ID:', orgId);
          chrome.runtime.sendMessage({ type: 'ORG_ID_FOUND', orgId });
          return orgId;
        }
      }
    } catch (e) {
      console.log('[Oh My Claude] API fetch failed:', e.message);
    }
    return null;
  }

  // Extract org ID from URL
  function findOrgIdInUrl() {
    const match = window.location.href.match(/organizations\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }

  // Fetch usage data and send to background script
  async function fetchAndSendUsage() {
    if (!orgId) {
      // Try to get org ID first
      const urlId = findOrgIdInUrl();
      if (urlId) {
        orgId = urlId;
      } else {
        await fetchOrgId();
      }
    }

    if (!orgId) {
      console.log('[Oh My Claude] No org ID, cannot fetch usage');
      return;
    }

    try {
      const response = await fetch(
        `https://claude.ai/api/organizations/${orgId}/usage`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.log('[Oh My Claude] Not logged in to Claude.ai');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const usageData = await response.json();
      chrome.runtime.sendMessage({ type: 'USAGE_DATA', usage: usageData });
      console.log(`[Oh My Claude] Usage fetched: Session ${usageData.five_hour?.utilization || 0}%`);
    } catch (err) {
      console.error('[Oh My Claude] Fetch usage error:', err);
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

  // Initialize: get org ID then do first sync
  async function init() {
    const urlId = findOrgIdInUrl();
    if (urlId) {
      orgId = urlId;
      chrome.runtime.sendMessage({ type: 'ORG_ID_FOUND', orgId });
    } else {
      await fetchOrgId();
    }

    // First sync
    fetchAndSendUsage();
  }

  setTimeout(init, 1000);
})();
