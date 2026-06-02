#!/usr/bin/env node
/**
 * Environment Variables Version - Claude Code Hook Event Sender
 * Reads hook data from environment variables instead of stdin
 */

const http = require('http');
const fs = require('fs');

const SERVER_URL = process.env.MONITOR_SERVER || 'http://localhost:4824';
const SOURCE_APP = process.env.MONITOR_SOURCE || 'claude-monitor';

// Read event type from command line
const args = process.argv.slice(2);
const eventTypeIndex = args.indexOf('--event-type');
const eventType = eventTypeIndex !== -1 ? args[eventTypeIndex + 1] : 'Unknown';

// Build hookData from environment variables (Claude Code provides these)
const hookData = {
  session_id: process.env.CLAUDE_SESSION_ID,
  sessionId: process.env.CLAUDE_SESSION_ID,
  transcript_path: process.env.CLAUDE_TRANSCRIPT_PATH,
  cwd: process.env.CLAUDE_CWD || process.cwd(),
  permission_mode: process.env.CLAUDE_PERMISSION_MODE,
  hook_event_name: eventType,

  // Tool-related
  tool_name: process.env.CLAUDE_TOOL_NAME,
  toolName: process.env.CLAUDE_TOOL_NAME,
  tool_use_id: process.env.CLAUDE_TOOL_USE_ID,
  tool_input: process.env.CLAUDE_TOOL_INPUT,
  tool_output: process.env.CLAUDE_TOOL_OUTPUT,
  tool_response: process.env.CLAUDE_TOOL_RESPONSE,

  // Agent info
  agent_id: process.env.CLAUDE_AGENT_ID,
  agentId: process.env.CLAUDE_AGENT_ID,
  agent_type: process.env.CLAUDE_AGENT_TYPE,
  agentType: process.env.CLAUDE_AGENT_TYPE,
  parent_agent_id: process.env.CLAUDE_PARENT_AGENT_ID,

  // Session/model
  model: process.env.CLAUDE_MODEL,

  // Stop event
  stop_reason: process.env.CLAUDE_STOP_REASON,
  stop_hook_active: process.env.CLAUDE_STOP_HOOK_ACTIVE,
  last_assistant_message: process.env.CLAUDE_LAST_ASSISTANT_MESSAGE,

  // UserPromptSubmit
  prompt: process.env.CLAUDE_PROMPT,
  user_prompt: process.env.CLAUDE_PROMPT,

  // Token usage
  input_tokens: process.env.CLAUDE_INPUT_TOKENS,
  output_tokens: process.env.CLAUDE_OUTPUT_TOKENS,

  // Error
  error: process.env.CLAUDE_ERROR,

  // Extended hook metadata (not all available via env)
  effort: null,
  duration_ms: null,
  trigger: null,
  source: null
};

// Track pending HTTP requests
let pendingRequests = 0;
function requestDone() {
  pendingRequests--;
  if (pendingRequests <= 0) process.exit(0);
}

// Build event payload
const event = {
  id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: eventType,
  timestamp: new Date().toISOString(),
  source: SOURCE_APP,
  sessionId: hookData.session_id || null,

  // Extract common fields
  toolName: hookData.tool_name || null,
  toolInput: hookData.tool_input || null,
  toolOutput: hookData.tool_output || null,

  // Agent info
  agentId: hookData.agent_id || null,
  agentType: hookData.agent_type || null,
  parentAgentId: hookData.parent_agent_id || null,

  // Session info
  model: hookData.model || null,
  cwd: hookData.cwd || process.cwd(),

  // For Stop events
  stopReason: hookData.stop_reason || null,

  // For UserPromptSubmit
  prompt: hookData.prompt || null,

  // Token usage
  inputTokens: hookData.input_tokens ? parseInt(hookData.input_tokens) : null,
  outputTokens: hookData.output_tokens ? parseInt(hookData.output_tokens) : null,

  // Error info
  error: hookData.error || null,

  // Extended hook metadata (effort/duration/trigger/source not available via env)
  effort: null,
  permissionMode: hookData.permission_mode || null,
  durationMs: null,
  trigger: null,
  sessionSource: null,

  // Background jobs / crons not available via env; last message is
  backgroundTasks: null,
  sessionCrons: null,
  lastAssistantMessage: hookData.last_assistant_message ? String(hookData.last_assistant_message).slice(0, 400) : null,

  // Raw data for debugging
  raw: hookData
};

// For PostToolUse/Stop events with transcript_path, read context data
if ((eventType === 'PostToolUse' || eventType === 'Stop') && hookData.transcript_path && hookData.session_id) {
  sendContextUpdate(hookData.session_id, hookData.transcript_path);
}

// Send event to server
sendEvent(event);

/**
 * Read the last 32KB of the transcript file and extract context window data.
 * POSTs lastInputTokens + model id to /context-update; the server now computes the % per-model.
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

    // Scan from end for last real assistant usage
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
          const req = http.request({
            hostname: '127.0.0.1', port: 4824,
            path: '/context-update', method: 'POST',
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
    port: url.port || 4824,
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
