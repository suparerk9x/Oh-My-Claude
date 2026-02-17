// Oh My Claude - Content Script
// Runs on claude.ai to extract org ID and trigger sync

(function() {
  'use strict';

  console.log('[Oh My Claude] Content script loaded');

  // Method 1: Fetch account profile to get org ID directly
  async function fetchOrgId() {
    try {
      const response = await fetch('https://claude.ai/api/organizations', {
        credentials: 'include'
      });

      if (response.ok) {
        const orgs = await response.json();
        if (orgs && orgs.length > 0) {
          const orgId = orgs[0].uuid;
          console.log('[Oh My Claude] Found org ID from API:', orgId);
          chrome.runtime.sendMessage({
            type: 'ORG_ID_FOUND',
            orgId: orgId
          });
          return orgId;
        }
      }
    } catch (e) {
      console.log('[Oh My Claude] API fetch failed:', e.message);
    }
    return null;
  }

  // Method 2: Look in URL for org ID pattern
  function findOrgIdInUrl() {
    const urlMatch = window.location.href.match(/organizations\/([a-f0-9-]{36})/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return null;
  }

  // Method 3: Intercept fetch requests to find org ID
  function interceptRequests() {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (url && url.includes('/api/organizations/')) {
          const match = url.match(/organizations\/([a-f0-9-]{36})/);
          if (match) {
            console.log('[Oh My Claude] Found org ID from fetch:', match[1]);
            chrome.runtime.sendMessage({
              type: 'ORG_ID_FOUND',
              orgId: match[1]
            });
          }
        }
      } catch (e) {
        // Ignore errors
      }

      return response;
    };
  }

  // Initialize
  async function init() {
    // Try URL first
    let orgId = findOrgIdInUrl();
    if (orgId) {
      console.log('[Oh My Claude] Found org ID in URL:', orgId);
      chrome.runtime.sendMessage({ type: 'ORG_ID_FOUND', orgId });
      return;
    }

    // Try API
    orgId = await fetchOrgId();
    if (orgId) return;

    // Set up interceptor for future requests
    interceptRequests();

    // Retry API after page fully loads
    if (document.readyState !== 'complete') {
      window.addEventListener('load', async () => {
        await fetchOrgId();
      });
    }
  }

  // Run after a short delay to ensure page is ready
  setTimeout(init, 1000);
})();
