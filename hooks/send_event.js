#!/usr/bin/env node
/**
 * Universal Event Sender for Claude Code Hooks
 * Sends hook events to the observability server via HTTP POST
 */

const http = require('http');

const SERVER_URL = process.env.MONITOR_SERVER || 'http://localhost:4000';
const SOURCE_APP = process.env.MONITOR_SOURCE || 'claude-monitor';

// Read event type from command line
const args = process.argv.slice(2);
const eventTypeIndex = args.indexOf('--event-type');
const eventType = eventTypeIndex !== -1 ? args[eventTypeIndex + 1] : 'Unknown';

// Read JSON from stdin
let inputData = '';
let dataReceived = false;  // Track if any data was received
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  dataReceived = true;
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Only parse if we actually received data
    const hookData = (dataReceived && inputData) ? JSON.parse(inputData) : {};

    // Build event payload
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      source: SOURCE_APP,
      sessionId: hookData.session_id || hookData.sessionId || null,

      // Extract common fields
      toolName: hookData.tool_name || hookData.toolName || null,
      toolInput: hookData.tool_input || hookData.input || null,
      toolOutput: hookData.tool_output || hookData.output || null,

      // Agent info
      agentId: hookData.agent_id || hookData.agentId || null,
      agentType: hookData.agent_type || hookData.agentType || null,
      parentAgentId: hookData.parent_agent_id || null,

      // Session info
      model: hookData.model || null,
      cwd: hookData.cwd || process.cwd(),

      // For Stop events
      stopReason: hookData.stop_reason || hookData.reason || null,

      // For UserPromptSubmit
      prompt: hookData.prompt || hookData.user_prompt || null,

      // Token usage (if available)
      inputTokens: hookData.input_tokens || null,
      outputTokens: hookData.output_tokens || null,

      // Error info
      error: hookData.error || null,

      // Raw data for debugging
      raw: hookData
    };

    // Send to server
    sendEvent(event);
  } catch (err) {
    // Silent fail - don't block Claude Code
    process.exit(0);
  }
});

function sendEvent(event) {
  const url = new URL('/events', SERVER_URL);
  const postData = JSON.stringify(event);

  const options = {
    hostname: url.hostname,
    port: url.port || 4000,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    // Success - exit cleanly
    process.exit(0);
  });

  req.on('error', () => {
    // Silent fail - server might not be running
    process.exit(0);
  });

  req.on('timeout', () => {
    req.destroy();
    process.exit(0);
  });

  req.write(postData);
  req.end();
}

// NOTE: setTimeout fallback REMOVED - it caused duplicate events
// The 'end' event handles both cases: with data and without data
