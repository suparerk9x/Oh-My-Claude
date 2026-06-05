#!/usr/bin/env node
/**
 * Universal Event Sender for Claude Code Hooks
 * Sends hook events to the observability server via HTTP POST.
 * Also reads transcript tail on PostToolUse/Stop to extract real-time context window data.
 */

const http = require('http');
const fs = require('fs');

const SERVER_URL = process.env.MONITOR_SERVER || 'http://localhost:4825';
const SOURCE_APP = process.env.MONITOR_SOURCE || 'claude-monitor';

// Track pending HTTP requests — exit only when all complete
let pendingRequests = 0;
function requestDone() {
  pendingRequests--;
  if (pendingRequests <= 0) process.exit(0);
}

// Read event type from command line
const args = process.argv.slice(2);
const eventTypeIndex = args.indexOf('--event-type');
const eventType = eventTypeIndex !== -1 ? args[eventTypeIndex + 1] : 'Unknown';

// Read JSON from stdin
let inputData = '';
let dataReceived = false;
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  dataReceived = true;
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
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
      // CLAUDE_PROJECT (optional env) lets a caller label the session (e.g. a proxy that runs
      // `claude -p` for many projects in one cwd). Falls back to the real cwd. For pretty names,
      // swap this for a map, e.g. ({'tts-web':'TTS Director'}[process.env.CLAUDE_PROJECT] || ...).
      cwd: process.env.CLAUDE_PROJECT || hookData.cwd || process.cwd(),

      // For Stop events
      stopReason: hookData.stop_reason || hookData.reason || null,

      // For UserPromptSubmit
      prompt: hookData.prompt || hookData.user_prompt || null,

      // Token usage (if available)
      inputTokens: hookData.input_tokens || null,
      outputTokens: hookData.output_tokens || null,

      // Error info
      error: hookData.error || null,

      // Extended hook metadata
      effort: hookData.effort?.level || null,
      permissionMode: hookData.permission_mode || null,
      durationMs: hookData.duration_ms || null,
      trigger: hookData.trigger || null,
      sessionSource: hookData.source || null,

      // Background jobs / scheduled crons / last turn message (Stop, SubagentStop)
      backgroundTasks: Array.isArray(hookData.background_tasks)
        ? hookData.background_tasks.map(t => ({ id: t.id, type: t.type, status: t.status, description: t.description, command: (t.command || '').slice(0, 120) }))
        : null,
      sessionCrons: Array.isArray(hookData.session_crons) ? hookData.session_crons : null,
      lastAssistantMessage: hookData.last_assistant_message ? String(hookData.last_assistant_message).slice(0, 400) : null,

      // Raw data for debugging
      raw: hookData
    };

    // For PostToolUse/Stop events with transcript_path, read context data and send separately
    if ((eventType === 'PostToolUse' || eventType === 'Stop') && hookData.transcript_path && hookData.session_id) {
      sendContextUpdate(hookData.session_id, hookData.transcript_path);
    }

    // Send event to server
    sendEvent(event);
  } catch (err) {
    process.exit(0);
  }
});

/**
 * Read the last 32KB of the transcript file and extract the latest context window fill.
 * Computes lastInputTokens = input_tokens + cache_creation + cache_read and POSTs it with the
 * model id to /context-update; the server now computes the % per-model (1M vs 200k limit).
 */
function sendContextUpdate(sessionId, transcriptPath) {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const stats = fs.fstatSync(fd);
    const tailSize = Math.min(stats.size, 32768);
    const buffer = Buffer.alloc(tailSize);
    fs.readSync(fd, buffer, 0, tailSize, stats.size - tailSize);
    fs.closeSync(fd);

    const tail = buffer.toString('utf-8');
    const lines = tail.split('\n');

    // Scan from end for last real assistant usage (skip synthetic/compact)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || !line.includes('"usage"')) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'assistant' && parsed.message?.usage && parsed.message.model !== '<synthetic>') {
          const u = parsed.message.usage;
          const lastInputTokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);

          // Send to /context-update — server computes the % per-model
          pendingRequests++;
          const payload = JSON.stringify({
            sessionId,
            lastInputTokens,
            model: (parsed.message.model || null)
          });
          // Use SERVER_URL (MONITOR_SERVER) like /events — hardcoding 127.0.0.1 fails silently
          // when the hook runs inside a container that must reach the host via a bridge gateway.
          const cu = new URL('/context-update', SERVER_URL);
          const req = http.request({
            hostname: cu.hostname, port: cu.port || 4825,
            path: cu.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 500
          });
          req.on('error', () => requestDone());
          req.on('timeout', () => { req.destroy(); requestDone(); });
          req.on('response', () => requestDone());
          req.write(payload);
          req.end();
          return;
        }
      } catch {}
    }
  } catch {}
}

function sendEvent(event) {
  pendingRequests++;
  const url = new URL('/events', SERVER_URL);
  const postData = JSON.stringify(event);

  const options = {
    hostname: url.hostname,
    port: url.port || 4825,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 2000
  };

  const req = http.request(options, () => requestDone());
  req.on('error', () => requestDone());
  req.on('timeout', () => { req.destroy(); requestDone(); });
  req.write(postData);
  req.end();
}

// Safety: exit after 3s no matter what
setTimeout(() => process.exit(0), 3000);
