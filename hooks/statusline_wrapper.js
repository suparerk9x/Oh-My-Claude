#!/usr/bin/env node
/**
 * StatusLine wrapper for Oh-My-Claude
 * 1. Reads JSON from stdin (Claude Code statusLine data)
 * 2. Extracts context_window data and sends to monitoring backend (fire-and-forget)
 * 3. Outputs statusLine text for display
 */

const http = require('http');

const SERVER_URL = process.env.MONITOR_SERVER || 'http://localhost:4825';

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(inputData);

    // Send context_window data to backend (non-blocking, fire-and-forget)
    if (data.context_window && data.session_id) {
      const payload = JSON.stringify({
        sessionId: data.session_id,
        contextWindow: data.context_window
      });
      const req = http.request({
        hostname: '127.0.0.1',
        port: 4825,
        path: '/context-update',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 500
      });
      req.on('error', () => {}); // silent fail
      req.on('timeout', () => req.destroy());
      req.write(payload);
      req.end();
    }

    // Build statusLine output
    const parts = [];

    // Context remaining
    const ctx = data.context_window;
    if (ctx && ctx.remaining_percentage != null) {
      parts.push(`ctx ${ctx.used_percentage}%`);
    }

    // Cost
    if (data.cost?.total_cost_usd > 0) {
      parts.push(`$${data.cost.total_cost_usd.toFixed(2)}`);
    }

    process.stdout.write(parts.join('  ') || '');
  } catch {
    // Silent fail
  }
  process.exit(0);
});
