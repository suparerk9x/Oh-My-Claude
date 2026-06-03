import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { readStatsCache } from './statsReader.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import { z } from 'zod';

// Safe readline: event-based (not for-await) with proper error handlers on both stream and rl.
// Prevents silent crashes from Windows file locking / deleted files mid-read.
function safeReadLines(filePath, onLine) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    let streamError = null;

    stream.on('error', (err) => {
      streamError = err;
    });

    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      try { onLine(line); } catch { /* skip bad line */ }
    });

    rl.on('close', () => {
      if (streamError) reject(streamError);
      else resolve();
    });

    rl.on('error', (err) => {
      reject(err);
    });
  });
}

// Model context window limits (tokens)
const MODEL_CONTEXT_LIMITS = {
  'opus': 1000000, 'sonnet': 1000000, 'haiku': 200000,
  'claude-opus-4-8': 1000000, 'claude-opus-4-7': 1000000, 'claude-opus-4-6': 1000000, 'claude-sonnet-4-6': 1000000, 'claude-sonnet-4-5-20250929': 1000000, 'claude-haiku-4-5-20251001': 200000,
};
const DEFAULT_CONTEXT_LIMIT = 1000000;

// Single source of truth for context window limit by model
function getContextLimit(model){ return /haiku/i.test(model||'') ? 200000 : 1000000; }

// Claude projects directory
const CLAUDE_PROJECTS_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'projects');

// Claude Code OAuth credential file — lets the server read session/weekly usage directly
// from Anthropic's usage endpoint (no Chrome extension needed). Claude Code refreshes this file.
const CC_CREDENTIALS_PATH = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', '.credentials.json');
const CC_USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';

// Security configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:4825',
  'http://localhost:5173',
  'http://127.0.0.1:4825',
  'http://127.0.0.1:5173'
];

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (high for dashboard polling)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Stricter rate limit for event posting (prevents abuse)
const eventLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 events per minute max
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Event rate limit exceeded.' }
});

// Sanitize file paths to prevent path traversal attacks
function sanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;

  // Normalize path and resolve to absolute
  const normalized = path.normalize(filePath);

  // Check for path traversal attempts
  if (normalized.includes('..')) {
    console.warn(`[SECURITY] Blocked path traversal attempt: ${filePath}`);
    return null;
  }

  // Only allow paths within Claude directory or common safe locations
  const claudeDir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude');
  const resolved = path.resolve(normalized);

  // Allow Claude directory and subdirectories
  if (resolved.startsWith(claudeDir)) {
    return resolved;
  }

  // Block other paths
  console.warn(`[SECURITY] Blocked access to path outside allowed directories: ${filePath}`);
  return null;
}

// Event validation schema
const eventSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  timestamp: z.string().optional(),
  sessionId: z.string().optional().nullable(),
  toolName: z.string().optional().nullable(),
  toolInput: z.any().optional().nullable(),
  toolOutput: z.any().optional().nullable(),
  agentId: z.string().optional().nullable(),
  agentType: z.string().optional().nullable(),
  parentAgentId: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  cwd: z.string().optional().nullable(),
  stopReason: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  inputTokens: z.number().optional().nullable(),
  outputTokens: z.number().optional().nullable(),
  error: z.any().optional().nullable(),
  isError: z.boolean().optional().nullable(),
  errorSummary: z.string().optional().nullable(),
  effort: z.string().optional().nullable(),
  permissionMode: z.string().optional().nullable(),
  durationMs: z.number().optional().nullable(),
  trigger: z.string().optional().nullable(),
  sessionSource: z.string().optional().nullable(),
  backgroundTasks: z.any().optional().nullable(),
  sessionCrons: z.any().optional().nullable(),
  lastAssistantMessage: z.string().optional().nullable(),
  raw: z.any().optional(),
  source: z.string().optional(),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4825;

// Initialize Express
const app = express();

// Security middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, but log unknown origins
      console.log(`[CORS] Request from unknown origin: ${origin}`);
    }
  },
  credentials: true
}));

// ── Serve the built dashboard UI (single-origin: UI + API + WS all on one port) ──
// Static assets are served BEFORE the rate limiter so loading the page never eats API quota.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));
// Friendly URLs for the display modes (also reachable directly as /mini.html etc.)
for (const mode of ['mini', 'medium', 'full']) {
  app.get(`/${mode}`, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, `${mode}.html`)));
}

app.use(limiter); // Apply rate limiting
app.use(express.json({ limit: '10mb' }));

// The built UI calls /api/* (the same prefix the Vite dev proxy uses in development). Strip it here so
// the existing root-level routes match identically whether the request arrives via the dev proxy (4825)
// or same-origin from the static build (4825).
app.use((req, _res, next) => {
  if (req.url === '/api' || req.url === '/api/') req.url = '/';
  else if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
  next();
});

// Initialize HTTP server
const server = createServer(app);

// Initialize WebSocket
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

  ws.on('error', (err) => {
    console.error('[WS] Client error:', err.message);
    clients.delete(ws);
  });

  // Send recent events + stats on connect (async)
  (async () => {
    const initData = {
      type: 'init',
      events: getRecentEvents(100),
      stats: await getStats(),
      agents: await getAgents(),
      sessions: getSessions(),
      usage: claudeUsage,
      smartStatus: smartStatusMap,
      teams: getTeams(),
      teamComms: getRecentTeamComms()
    };
    ws.send(JSON.stringify(initData));
  })().catch(err => console.error('[WS] Init send failed:', err.message));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (${clients.size} total)`);
  });
});

// Broadcast to all clients
function broadcast(data) {
  let message;
  try {
    message = JSON.stringify(data);
  } catch (err) {
    console.error('[WS] Failed to serialize broadcast:', err.message);
    return;
  }
  clients.forEach((client) => {
    try {
      if (client.readyState === 1) {
        client.send(message);
      }
    } catch (err) {
      console.error('[WS] Send failed, removing client:', err.message);
      clients.delete(client);
    }
  });
}

// Simple in-memory event store (with file persistence)
const DB_FILE = path.join(__dirname, 'events.json');
const AGENTS_FILE = path.join(__dirname, 'agents.json');
let events = [];
let agents = new Map();
let sessions = new Map();
let smartStatusMap = {}; // sessionId -> { status, label, icon, color }

// Team tracking
let teams = new Map(); // teamName -> { name, description, leadSessionId, leadAgentId, createdAt, members: Set, status }
let teamComms = []; // { timestamp, teamName, from, to, type, summary }
let fileOwnership = new Map(); // filePath -> [{ agentId, agentName, teamName, timestamp }]

// Helper: resolve agent display name for team comms (matches demo format)
function getAgentDisplayName(agent) {
  return agent?.agentName || (agent?.isTeamLead ? 'team-lead' : agent?.id?.slice(0, 8) || 'unknown');
}

// Agent timeout settings (5-level status hierarchy)
const AGENT_IDLE_MS = 3 * 60 * 1000;      // 3 minutes - mark as idle
const AGENT_STALE_MS = 8 * 60 * 1000;     // 8 minutes - mark as stale
const AGENT_TIMEOUT_MS = 20 * 60 * 1000;  // 20 minutes - mark as timeout
const AGENT_CLEANUP_MS = 30 * 60 * 1000;  // 30 minutes - remove from list

// Claude.ai usage data (from extension)
let claudeUsage = {
  five_hour: null,
  seven_day: null,
  seven_day_sonnet: null,
  seven_day_opus: null,
  seven_day_cowork: null,
  extra_usage: null,
  lastSync: null,
  source: null
};

// Normalize short model names (from Task tool enum) to full model IDs
function normalizeModel(model) {
  if (!model) return model;
  // Strip a trailing window tag like "[1m]" -> "claude-opus-4-8[1m]" becomes "claude-opus-4-8"
  model = model.replace(/\[[^\]]*\]$/, '');
  const m = model.toLowerCase();
  // Already has version digits like "claude-haiku-4-5-20251001"
  if (/(?:opus|sonnet|haiku)-\d/.test(m)) return model;
  // Map short/partial names to full IDs
  if (m.includes('opus')) return 'claude-opus-4-8';
  if (m.includes('sonnet')) return 'claude-sonnet-4-6';
  if (m.includes('haiku')) return 'claude-haiku-4-5-20251001';
  return model;
}

// Try to find the actual transcript file (Claude Code sometimes reports wrong path)
function findAgentTranscript(reportedPath, agentId, startTime) {
  if (!reportedPath) return null;

  // First try the reported path
  if (fs.existsSync(reportedPath)) return reportedPath;

  // Extract the subagents directory from the reported path
  const subagentsDir = path.dirname(reportedPath);
  if (!fs.existsSync(subagentsDir)) return null;

  try {
    const files = fs.readdirSync(subagentsDir);

    // Look for files that might match this agent
    // Patterns: agent-{id}.jsonl, agent-acompact-{id}.jsonl, etc.
    const candidates = files
      .filter(f => f.endsWith('.jsonl') && f.startsWith('agent-'))
      .map(f => ({
        name: f,
        path: path.join(subagentsDir, f),
        stat: fs.statSync(path.join(subagentsDir, f))
      }))
      // Sort by modification time descending (most recent first)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    // If we have a start time, find files modified after that time
    if (startTime && candidates.length > 0) {
      const startMs = new Date(startTime).getTime();
      const matching = candidates.filter(c => c.stat.mtimeMs >= startMs);
      if (matching.length > 0) {
        console.log(`[AGENT] Found transcript by time: ${matching[0].name} (original: ${path.basename(reportedPath)})`);
        return matching[0].path;
      }
    }

    // Fallback: return most recently modified file
    if (candidates.length > 0) {
      console.log(`[AGENT] Using most recent transcript: ${candidates[0].name} (original: ${path.basename(reportedPath)})`);
      return candidates[0].path;
    }
  } catch (err) {
    console.error(`Error finding agent transcript: ${err.message}`);
  }

  return null;
}

// Lightweight async token reader for active subagents (streaming, cached by mtime)
const subagentTokenCache = new Map(); // transcriptPath -> { mtimeMs, tokens, inputTokens, outputTokens }

async function readSubagentTokens(transcriptPath) {
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const stat = fs.statSync(transcriptPath);
    const cached = subagentTokenCache.get(transcriptPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached;

    let inputTokens = 0;
    let outputTokens = 0;
    let lastInputTokens = 0;
    let model = null; // real model, read from the subagent's own transcript (verified, not guessed)

    await safeReadLines(transcriptPath, (line) => {
      if (!line.includes('"usage"')) return;
      const entry = JSON.parse(line);
      if (entry.type === 'assistant' && entry.message?.usage && entry.message.model !== '<synthetic>') {
        const u = entry.message.usage;
        inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
        outputTokens += u.output_tokens || 0;
        lastInputTokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        if (entry.message.model) model = entry.message.model; // last real model wins
      }
    });

    const result = { mtimeMs: stat.mtimeMs, tokens: inputTokens + outputTokens, inputTokens, outputTokens, lastInputTokens, model };
    subagentTokenCache.set(transcriptPath, result);
    return result;
  } catch {
    return null;
  }
}

// Parse agent transcript file to extract model, tokens, task
function parseAgentTranscript(transcriptPath) {
  try {
    if (!fs.existsSync(transcriptPath)) return null;

    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let model = null;
    let task = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let startTime = null;
    let endTime = null;
    let toolsUsed = new Set();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Get timestamp for duration
        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (!startTime || ts < startTime) startTime = ts;
          if (!endTime || ts > endTime) endTime = ts;
        }

        // Get first user message as task description
        if (!task && entry.type === 'user' && entry.message?.content) {
          const content = entry.message.content;
          if (typeof content === 'string') {
            task = content.slice(0, 100);
          } else if (Array.isArray(content)) {
            const textPart = content.find(p => p.type === 'text');
            if (textPart?.text) task = textPart.text.slice(0, 100);
          }
        }

        // Get model from assistant messages
        if (!model && entry.message?.model) {
          model = entry.message.model;
        }

        // Sum tokens from usage (skip synthetic messages)
        if (entry.message?.usage && entry.message.model !== '<synthetic>') {
          const usage = entry.message.usage;
          totalInputTokens += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
          totalOutputTokens += usage.output_tokens || 0;
        }

        // Track tools used
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          for (const part of entry.message.content) {
            if (part.type === 'tool_use' && part.name) {
              toolsUsed.add(part.name);
            }
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    return {
      model,
      task,
      tokens: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      startTime,
      endTime,
      duration: startTime && endTime ? endTime - startTime : null,
      toolsUsed: Array.from(toolsUsed).slice(0, 5) // Top 5 tools
    };
  } catch (err) {
    console.error(`Error parsing agent transcript ${transcriptPath}:`, err.message);
    return null;
  }
}

// Format duration in human readable form
function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Load existing events
function loadEvents() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      events = data.events || [];
      // Strip bloated raw.tool_input from loaded events (contains full file content)
      let stripped = 0;
      events.forEach(e => {
        if (e.raw?.tool_input) { delete e.raw.tool_input; stripped++; }
      });
      console.log(`[LOAD] Loaded ${events.length} events from disk${stripped ? ` (stripped ${stripped} bloated raw fields)` : ''}`);
    }
  } catch (err) {
    console.error('Error loading events:', err.message);
  }
}

// Sanitize event for storage (remove large payloads)
function sanitizeEventForStorage(event) {
  const sanitized = { ...event };

  // Remove large raw data but keep essential fields
  if (sanitized.raw) {
    const { tool_response, tool_output, tool_input, ...essentialRaw } = sanitized.raw;
    sanitized.raw = essentialRaw;

    // Keep only summary of tool response if it exists
    if (tool_response?.file?.content) {
      sanitized.raw.tool_response_summary = `[File: ${tool_response.file.filePath}, ${tool_response.file.content.length} chars]`;
    } else if (tool_response?.type) {
      sanitized.raw.tool_response_type = tool_response.type;
    }
  }

  // Truncate large toolInput/toolOutput (preserve essential small fields)
  if (sanitized.toolInput && JSON.stringify(sanitized.toolInput).length > 500) {
    const preserved = {};
    const keepFields = ['type', 'recipient', 'summary', 'team_name', 'name',
                        'subagent_type', 'description', 'file_path', 'command',
                        'pattern', 'status', 'task_id', 'owner', 'skill'];
    for (const key of keepFields) {
      if (sanitized.toolInput[key] !== undefined) {
        const val = sanitized.toolInput[key];
        if (typeof val === 'string' && val.length > 200) {
          preserved[key] = val.slice(0, 200) + '...';
        } else {
          preserved[key] = val;
        }
      }
    }
    sanitized.toolInput = { _truncated: true, keys: Object.keys(sanitized.toolInput), ...preserved };
  }
  if (sanitized.toolOutput && JSON.stringify(sanitized.toolOutput).length > 500) {
    sanitized.toolOutput = { _truncated: true, length: JSON.stringify(sanitized.toolOutput).length };
  }

  return sanitized;
}

// Save events to disk (debounced, sanitized)
let saveTimeout = null;
function saveEvents() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const sanitizedEvents = events.slice(-1000).map(sanitizeEventForStorage);
      fs.writeFileSync(DB_FILE, JSON.stringify({ events: sanitizedEvents }));
      console.log(`[SAVE] Saved ${sanitizedEvents.length} events to disk`);
    } catch (err) {
      console.error('Error saving events:', err.message);
    }
  }, 1000);
}

// Save agents to disk (debounced)
let saveAgentsTimeout = null;
function saveAgents() {
  if (saveAgentsTimeout) clearTimeout(saveAgentsTimeout);
  saveAgentsTimeout = setTimeout(() => {
    try {
      const agentsArray = Array.from(agents.entries()).map(([id, agent]) => ({ id, ...agent }));
      fs.writeFileSync(AGENTS_FILE, JSON.stringify({ agents: agentsArray, savedAt: new Date().toISOString() }));
      console.log(`[SAVE] Saved ${agentsArray.length} agents to disk`);
    } catch (err) {
      console.error('Error saving agents:', err.message);
    }
  }, 1000);
}

// Load agents from disk
function loadAgents() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
      if (data.agents && Array.isArray(data.agents)) {
        agents.clear();
        let skipped = 0;
        data.agents.forEach(agent => {
          // Skip zombie agents (created by race condition, missing required fields)
          if (!agent.type || !agent.status) { skipped++; return; }
          agent.model = normalizeModel(agent.model) || agent.model;
          agents.set(agent.id, agent);
        });
        console.log(`[LOAD] Loaded ${agents.size} agents from disk${skipped ? ` (skipped ${skipped} invalid)` : ''}`);
      }
    }
  } catch (err) {
    console.error('Error loading agents:', err.message);
  }
}

// Check and update agent timeouts (5-level: active → idle → stale → timeout → cleanup)
function checkAgentTimeouts() {
  const now = Date.now();
  let changed = false;

  for (const [id, agent] of agents.entries()) {
    const lastSeen = agent.lastSeen ? new Date(agent.lastSeen).getTime() : 0;
    const elapsed = now - lastSeen;

    // 5-level status transitions for active/idle/stale agents
    if (agent.status === 'active' && elapsed > AGENT_IDLE_MS) {
      agents.set(id, { ...agent, status: 'idle' });
      console.log(`[AGENT] ${id} → idle (${Math.round(elapsed / 60000)}m inactive)`);
      changed = true;
    }
    if (agent.status === 'idle' && elapsed > AGENT_STALE_MS) {
      agents.set(id, { ...agent, status: 'stale' });
      console.log(`[AGENT] ${id} → stale (${Math.round(elapsed / 60000)}m inactive)`);
      changed = true;
    }
    if ((agent.status === 'stale' || agent.status === 'active') && elapsed > AGENT_TIMEOUT_MS) {
      agents.set(id, { ...agent, status: 'timeout', timeoutAt: new Date().toISOString() });
      console.log(`[AGENT] ${id} → timeout (${Math.round(elapsed / 60000)}m inactive)`);
      changed = true;
    }

    // Sync smartStatus when agent goes inactive
    if (agent.sessionId && smartStatusMap[agent.sessionId]) {
      const ss = smartStatusMap[agent.sessionId];
      if (ss.status !== 'stopped' && (agent.status === 'idle' || agent.status === 'stale' || agent.status === 'timeout' || agent.status === 'stopped')) {
        smartStatusMap[agent.sessionId] = { status: 'stopped', label: 'Stopped', icon: '○', color: 'text-gray-500' };
      }
    }

    // Remove old stopped/timeout agents after 60 min
    if ((agent.status === 'stopped' || agent.status === 'timeout') && elapsed > AGENT_CLEANUP_MS) {
      if (agent.sessionId) delete smartStatusMap[agent.sessionId];
      // Remove from team if applicable
      if (agent.teamName && teams.has(agent.teamName)) {
        teams.get(agent.teamName).members.delete(id);
      }
      agents.delete(id);
      console.log(`[AGENT] ${id} removed (cleanup after ${Math.round(elapsed / 60000)}m)`);
      changed = true;
    }
  }

  if (changed) {
    saveAgents();
  }
}

// Run timeout check every minute
setInterval(checkAgentTimeouts, 60 * 1000);

// Process incoming event
function processEvent(event) {
  // Add to events list
  events.push(event);
  if (events.length > 1000) events.shift();

  // Track agents from SubagentStart events
  if (event.type === 'SubagentStart' && event.agentId) {
    const agentId = event.agentId;
    const existing = agents.get(agentId) || {};

    // Try to correlate with pending Task tool call to get model/description
    let pendingTask = null;
    if (!processEvent.pendingTasks) processEvent.pendingTasks = [];
    if (processEvent.pendingTasks.length > 0) {
      // Find matching pending task by subagent_type or agentName
      // When Task tool uses `name` param (e.g. name:"scan-backend"), Claude Code
      // sets agent_type to that name, but subagent_type stays "general-purpose"
      const agentType = event.agentType;
      pendingTask = processEvent.pendingTasks.find(t =>
        t.subagentType?.toLowerCase() === agentType?.toLowerCase() ||
        t.agentName?.toLowerCase() === agentType?.toLowerCase() ||
        t.subagentType === 'subagent'
      );
      if (pendingTask) {
        // Remove from pending
        processEvent.pendingTasks = processEvent.pendingTasks.filter(t => t !== pendingTask);
      }
    }

    // Determine parentId - prefer event.parentAgentId, then construct from pending task's sessionId
    let parentId = event.parentAgentId;
    if (!parentId && pendingTask?.sessionId) {
      // Use the session that spawned this Task as the parent
      parentId = `main_${pendingTask.sessionId}`;
    }
    if (!parentId && event.sessionId) parentId = 'main_' + event.sessionId;
    if (!parentId) {
      parentId = 'main';
    }

    // Get model: event > pending task > reliable type default. Otherwise leave UNSET.
    // SubagentStart carries no model, so we must not guess. Agents like Explore / Plan /
    // claude-code-guide pin their own model (often Haiku), so inheriting the parent's model
    // (e.g. Opus) shows a wrong badge that flips to the real model only when the agent stops.
    // Instead, the verified model is read from the subagent's own transcript while it runs
    // (readSubagentTokens → applied in getAgents), so we display the real model — or none yet.
    let model = normalizeModel(event.model) || normalizeModel(pendingTask?.model);
    if (!model) {
      const agentType = event.agentType || pendingTask?.subagentType || '';
      if (agentType.toLowerCase() === 'explore') model = 'claude-haiku-4-5-20251001';
      else if (agentType.toLowerCase() === 'plan') model = 'claude-sonnet-4-6';
    }
    // NOTE: deliberately no parent-model inheritance fallback (caused false "Opus" badges).

    // Use parent's sessionId for grouping (subagent should be grouped with parent)
    const effectiveSessionId = pendingTask?.sessionId || event.sessionId;

    // Initialize toolsUsed Set for tracking tools from events (not just transcript)
    const toolsUsedSet = new Set(existing.toolsUsed || []);

    const agentTeamName = pendingTask?.teamName || event.raw?.team_name || existing.teamName || null;
    const agentName = pendingTask?.agentName || event.raw?.agent_name || existing.agentName || null;

    // Derive subagent transcript path from parent's transcript_path
    // Pattern: {parentDir}/{parentSessionId}/subagents/agent-{agentId}.jsonl
    let subagentTranscriptPath = existing.transcriptPath || null;
    if (!subagentTranscriptPath && event.raw?.transcript_path) {
      const parentTranscript = event.raw.transcript_path;
      const parentDir = path.dirname(parentTranscript);
      const parentBase = path.basename(parentTranscript, '.jsonl');
      subagentTranscriptPath = path.join(parentDir, parentBase, 'subagents', `agent-${agentId}.jsonl`);
    }

    agents.set(agentId, {
      ...existing,
      id: agentId,
      type: event.agentType || pendingTask?.subagentType || existing.type || 'subagent',
      model: model || existing.model,
      // verified = came from an explicit/type-default source (not a guess). Transcript read upgrades it later.
      modelVerified: model ? true : (existing.modelVerified || false),
      sessionId: effectiveSessionId,
      parentId: parentId,
      startedAt: event.timestamp,
      lastSeen: event.timestamp,
      status: 'active',
      tokens: existing.tokens || 0,
      description: pendingTask?.description || existing.description,
      toolsUsed: Array.from(toolsUsedSet), // Store as array but track as Set
      teamName: agentTeamName,
      agentName: agentName,
      transcriptPath: subagentTranscriptPath
    });

    // Add to team if team_name specified
    if (agentTeamName && teams.has(agentTeamName)) {
      teams.get(agentTeamName).members.add(agentId);
    }

    console.log(`[AGENT] Agent ${agentId} started (${event.agentType || pendingTask?.subagentType || 'subagent'}, model: ${model || 'unknown'}${agentTeamName ? `, team: ${agentTeamName}` : ''}${agentName ? `, name: ${agentName}` : ''})`);
  }

  // Track agents from SubagentStop events - parse transcript for rich data
  if (event.type === 'SubagentStop' && event.agentId) {
    const agentId = event.agentId;
    const existing = agents.get(agentId) || {};
    const rawTranscriptPath = event.raw?.agent_transcript_path;
    const transcriptPath = sanitizePath(rawTranscriptPath);

    // Try to find the actual transcript file (may differ from reported path)
    const actualTranscriptPath = transcriptPath
      ? findAgentTranscript(transcriptPath, agentId, existing.startedAt)
      : null;

    // Parse transcript for model, tokens, task info (only if path is safe)
    let transcriptData = null;
    if (actualTranscriptPath) {
      transcriptData = parseAgentTranscript(actualTranscriptPath);
      if (!transcriptData) {
        console.log(`[AGENT] Failed to parse transcript for ${agentId}: ${actualTranscriptPath}`);
      }
    } else if (transcriptPath) {
      console.log(`[AGENT] Transcript not found for ${agentId}: ${transcriptPath}`);
    }

    // Calculate duration
    const startTime = existing.startedAt ? new Date(existing.startedAt).getTime() : null;
    const endTime = new Date(event.timestamp).getTime();
    const duration = startTime ? endTime - startTime : transcriptData?.duration;

    // Merge toolsUsed: prefer transcript data, but fall back to existing (from events)
    // Also merge both sets if both exist
    const existingTools = new Set(existing.toolsUsed || []);
    const transcriptTools = transcriptData?.toolsUsed || [];
    transcriptTools.forEach(t => existingTools.add(t));
    const mergedToolsUsed = Array.from(existingTools).slice(0, 8); // Limit to 8 tools

    agents.set(agentId, {
      ...existing,
      id: agentId,
      type: event.agentType || existing.type || 'subagent',
      model: normalizeModel(transcriptData?.model) || existing.model,
      modelVerified: transcriptData?.model ? true : (existing.modelVerified || false),
      // Preserve the sessionId from SubagentStart (which has correct parent grouping)
      sessionId: existing.sessionId || event.sessionId,
      parentId: event.parentAgentId || existing.parentId || 'main',
      lastSeen: event.timestamp,
      stoppedAt: event.timestamp,
      status: 'stopped',
      // Preserve description from SubagentStart, use transcript task as fallback
      description: existing.description || transcriptData?.task,
      lastTask: transcriptData?.task || existing.lastTask || existing.description,
      tokens: transcriptData?.tokens || existing.tokens || 0,
      inputTokens: transcriptData?.inputTokens || existing.inputTokens || 0,
      outputTokens: transcriptData?.outputTokens || existing.outputTokens || 0,
      duration: duration,
      durationFormatted: formatDuration(duration),
      toolsUsed: mergedToolsUsed,
      transcriptPath: actualTranscriptPath || transcriptPath,
      lastAssistantMessage: event.lastAssistantMessage ? event.lastAssistantMessage.slice(0, 280) : existing.lastAssistantMessage
    });
    console.log(`[AGENT] Agent ${agentId} stopped (${formatDuration(duration) || 'unknown duration'}, ${transcriptData?.tokens || 0} tokens, tools: ${mergedToolsUsed.join(', ') || 'none'})`);
  }

  // Invalidate git diff cache when file-modifying tools complete
  if (event.type === 'PostToolUse' && ['Write', 'Edit', 'Bash', 'NotebookEdit'].includes(event.toolName)) {
    if (event.cwd) {
      // Clear all cache entries for this cwd
      for (const key of gitDiffCache.keys()) {
        if (key.startsWith(event.cwd)) gitDiffCache.delete(key);
      }
    }
  }

  // Track tools used + tokens for subagents from PreToolUse events
  if (event.type === 'PreToolUse' && event.agentId && event.toolName) {
    const agentId = event.agentId;
    const existing = agents.get(agentId);
    if (existing && existing.status !== 'stopped') {
      const toolsSet = new Set(existing.toolsUsed || []);
      toolsSet.add(event.toolName);
      const eventTokens = (event.inputTokens || 0) + (event.outputTokens || 0);
      agents.set(agentId, {
        ...existing,
        status: 'active', // Reset idle/stale back to active
        toolsUsed: Array.from(toolsSet).slice(0, 8),
        lastSeen: event.timestamp,
        tokens: (existing.tokens || 0) + eventTokens,
        inputTokens: (existing.inputTokens || 0) + (event.inputTokens || 0),
        outputTokens: (existing.outputTokens || 0) + (event.outputTokens || 0)
      });
    }
  }

  // Accumulate tokens for subagents from PostToolUse events
  if (event.type === 'PostToolUse' && event.agentId) {
    const agentId = event.agentId;
    const existing = agents.get(agentId);
    if (existing && existing.status !== 'stopped') {
      const eventTokens = (event.inputTokens || 0) + (event.outputTokens || 0);
      if (eventTokens > 0) {
        agents.set(agentId, {
          ...existing,
          lastSeen: event.timestamp,
          tokens: (existing.tokens || 0) + eventTokens,
          inputTokens: (existing.inputTokens || 0) + (event.inputTokens || 0),
          outputTokens: (existing.outputTokens || 0) + (event.outputTokens || 0)
        });
      }
    }
  }

  // Track file ownership for conflict detection
  if (event.type === 'PreToolUse' && (event.toolName === 'Edit' || event.toolName === 'Write')) {
    const filePath = event.toolInput?.file_path;
    if (filePath) {
      const ownerAgentId = event.agentId || (event.sessionId ? `main_${event.sessionId}` : null);
      const ownerAgent = ownerAgentId ? agents.get(ownerAgentId) : null;
      if (ownerAgent?.teamName) {
        const owners = fileOwnership.get(filePath) || [];
        if (!owners.some(o => o.agentId === ownerAgentId)) {
          owners.push({
            agentId: ownerAgentId,
            agentName: getAgentDisplayName(ownerAgent),
            teamName: ownerAgent.teamName,
            timestamp: event.timestamp
          });
          fileOwnership.set(filePath, owners);
          const teamAgents = owners.filter(o => o.teamName === ownerAgent.teamName);
          const uniqueAgents = new Set(teamAgents.map(o => o.agentId));
          if (uniqueAgents.size > 1) {
            console.log(`[TEAM] File conflict: ${filePath} edited by ${uniqueAgents.size} agents in team "${ownerAgent.teamName}"`);
          }
        }
      }
    }
  }

  // Detect Agent/Task tool usage as subagent spawn (backup detection)
  // Claude Code renamed "Task" to "Agent" — support both
  if ((event.toolName === 'Agent' || event.toolName === 'Task') && event.type === 'PreToolUse') {
    const taskInput = event.toolInput || {};
    // Don't create duplicate - SubagentStart will handle it
    // But store the task description for later correlation
    const description = taskInput.description || taskInput.prompt?.slice(0, 100) || 'Task';
    const subagentType = taskInput.subagent_type || 'subagent';
    const model = normalizeModel(taskInput.model) || null;

    // Store pending task info for correlation with SubagentStart
    if (!processEvent.pendingTasks) processEvent.pendingTasks = [];
    processEvent.pendingTasks.push({
      timestamp: event.timestamp,
      description,
      subagentType,
      model,
      sessionId: event.sessionId,
      teamName: taskInput.team_name || null,
      agentName: taskInput.name || null
    });

    // Clean up old pending tasks (older than 1 minute)
    const oneMinAgo = Date.now() - 60 * 1000;
    processEvent.pendingTasks = processEvent.pendingTasks.filter(
      t => new Date(t.timestamp).getTime() > oneMinAgo
    );
  }

  // Track team operations from team tools
  if (event.type === 'PreToolUse') {
    const toolInput = event.toolInput || {};

    // TeamCreate: create a new team
    if (event.toolName === 'TeamCreate') {
      const teamName = toolInput.team_name;
      if (teamName && !teams.has(teamName)) {
        const mainAgentId = event.sessionId ? `main_${event.sessionId}` : null;
        teams.set(teamName, {
          name: teamName,
          description: toolInput.description || '',
          leadSessionId: event.sessionId,
          leadAgentId: mainAgentId,
          createdAt: event.timestamp,
          members: new Set(),
          status: 'active'
        });
        // Mark main agent as team lead
        if (mainAgentId && agents.has(mainAgentId)) {
          const main = agents.get(mainAgentId);
          agents.set(mainAgentId, { ...main, teamName: teamName, isTeamLead: true });
        }
        console.log(`[TEAM] Team "${teamName}" created by session ${event.sessionId?.slice(0, 8)}`);
      }
    }

    // SendMessage: track team communications
    if (event.toolName === 'SendMessage') {
      const senderAgent = event.agentId
        ? agents.get(event.agentId)
        : (event.sessionId ? agents.get(`main_${event.sessionId}`) : null);
      const senderTeam = senderAgent?.teamName;
      if (senderTeam || toolInput.type) {
        teamComms.push({
          timestamp: event.timestamp,
          teamName: senderTeam || 'unknown',
          from: getAgentDisplayName(senderAgent),
          to: toolInput.recipient || (toolInput.type === 'broadcast' ? 'ALL' : (toolInput.type === 'shutdown_response' ? 'team-lead' : 'unknown')),
          type: toolInput.type || 'message',
          summary: toolInput.summary || toolInput.content?.slice(0, 80) || ''
        });
        if (teamComms.length > 200) teamComms = teamComms.slice(-200);
      }
    }

    // TeamDelete: mark team as deleted
    if (event.toolName === 'TeamDelete') {
      for (const [name, team] of teams.entries()) {
        if (team.leadSessionId === event.sessionId) {
          team.status = 'deleted';
          teams.set(name, team);
          console.log(`[TEAM] Team "${name}" deleted`);
          break;
        }
      }
    }

    // TaskUpdate: track task completion within teams
    if (event.toolName === 'TaskUpdate') {
      const status = toolInput.status;
      const owner = toolInput.owner;
      if (status === 'completed') {
        const senderAgent = event.agentId
          ? agents.get(event.agentId)
          : (event.sessionId ? agents.get(`main_${event.sessionId}`) : null);
        if (senderAgent?.teamName) {
          teamComms.push({
            timestamp: event.timestamp,
            teamName: senderAgent.teamName,
            from: getAgentDisplayName(senderAgent),
            to: 'task-list',
            type: 'task_completed',
            summary: toolInput.description || toolInput.content || `Task ${toolInput.task_id || ''} completed`
          });
          if (teamComms.length > 200) teamComms = teamComms.slice(-200);
          console.log(`[TEAM] Task completed by ${getAgentDisplayName(senderAgent)} in team "${senderAgent.teamName}"`);
        }
      }
    }
  }

  // TeammateIdle: mark teammate as idle in team context
  if (event.type === 'TeammateIdle') {
    const agentId = event.agentId;
    const existing = agentId ? agents.get(agentId) : null;
    if (existing?.teamName) {
      agents.set(agentId, { ...existing, status: 'idle', lastSeen: event.timestamp, teammateIdleSince: event.timestamp });
      teamComms.push({
        timestamp: event.timestamp,
        teamName: existing.teamName,
        from: getAgentDisplayName(existing),
        to: 'system',
        type: 'idle',
        summary: 'Teammate went idle'
      });
      if (teamComms.length > 200) teamComms = teamComms.slice(-200);
      console.log(`[TEAM] Teammate ${getAgentDisplayName(existing)} idle in team "${existing.teamName}"`);
    }
  }

  // TaskCompleted hook event: track task completion
  if (event.type === 'TaskCompleted') {
    const agentId = event.agentId;
    const existing = agentId ? agents.get(agentId) : null;
    if (existing?.teamName) {
      teamComms.push({
        timestamp: event.timestamp,
        teamName: existing.teamName,
        from: getAgentDisplayName(existing),
        to: 'task-list',
        type: 'task_completed',
        summary: event.raw?.task_description || event.raw?.content || 'Task completed'
      });
      if (teamComms.length > 200) teamComms = teamComms.slice(-200);
      console.log(`[TEAM] TaskCompleted by ${getAgentDisplayName(existing)} in team "${existing.teamName}"`);
    }
  }

  // Track main session as an "agent" for visibility
  // Use session-specific main agent ID to support multiple sessions
  if (event.sessionId) {
    const mainAgentId = `main_${event.sessionId}`;

    if (!agents.has(mainAgentId)) {
      const defaultModel = normalizeModel(event.model) || 'claude-opus-4-8';
      // Capture git HEAD at session start to track total session diff
      let initialCommit = null;
      const cwd = event.cwd;
      if (cwd) {
        try {
          initialCommit = execSync('git rev-parse HEAD', {
            cwd, encoding: 'utf-8', timeout: 3000, windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
          }).trim();
        } catch {
          // New repo or no commits — use empty tree hash
          initialCommit = '4b825dc642cb6eb9a060e54bf899d15363d7d628';
        }
      }
      agents.set(mainAgentId, {
        id: mainAgentId,
        type: 'main',
        model: defaultModel,
        sessionId: event.sessionId,
        startedAt: event.timestamp,
        lastSeen: event.timestamp,
        status: 'active',
        tokens: 0,
        lastTask: 'Main Session',
        initialCommit
      });
      console.log(`[AGENT] Main agent created for session ${event.sessionId.slice(0, 8)}... (baseline: ${initialCommit?.slice(0, 7) || 'none'})`);
    }

    // Update main agent activity
    const main = agents.get(mainAgentId);
    if (main) {
      // Determine agent status based on event type
      // Stop fires at end of each turn (not session end), so any new event should reactivate
      let reactivatedStatus;
      if (event.type === 'Stop' || event.type === 'SessionEnd') {
        reactivatedStatus = 'stopped';
      } else {
        // Any non-Stop event reactivates the agent (even from stopped state)
        reactivatedStatus = 'active';
      }
      // Update model if event has more specific info
      const updatedModel = event.model || main.model;

      // Get last tool or prompt as activity indicator with details
      let activity = main.lastTask;
      if (event.type === 'UserPromptSubmit' && event.prompt) {
        activity = event.prompt.slice(0, 50) + (event.prompt.length > 50 ? '...' : '');
      } else if (event.toolName && event.type === 'PreToolUse') {
        // Build detailed activity string based on tool type
        const input = event.toolInput || {};
        let detail = '';

        switch (event.toolName) {
          case 'Edit':
          case 'Read':
          case 'Write':
            // Show filename from path
            if (input.file_path) {
              const filename = input.file_path.split(/[\\/]/).pop();
              detail = filename;
            }
            break;
          case 'Bash':
            // Show command (truncated)
            if (input.command) {
              detail = input.command.slice(0, 40) + (input.command.length > 40 ? '...' : '');
            }
            break;
          case 'Task':
          case 'Agent':
            // Show description
            if (input.description) {
              detail = input.description;
            }
            break;
          case 'Grep':
            // Show pattern
            if (input.pattern) {
              detail = `"${input.pattern.slice(0, 30)}"`;
            }
            break;
          case 'Glob':
            // Show pattern
            if (input.pattern) {
              detail = input.pattern;
            }
            break;
          case 'WebFetch':
          case 'WebSearch':
            // Show query or url
            detail = input.query || input.url?.slice(0, 40) || '';
            break;
          case 'TeamCreate':
            if (input.team_name) detail = input.team_name;
            break;
          case 'SendMessage':
            if (input.summary) detail = input.summary;
            else if (input.recipient) detail = `-> ${input.recipient}`;
            break;
          case 'TeamDelete':
            detail = 'cleanup';
            break;
          default:
            // For other tools, try to get a meaningful detail
            if (input.description) detail = input.description;
            else if (input.prompt) detail = input.prompt.slice(0, 40);
            else if (input.file_path) detail = input.file_path.split(/[\\/]/).pop();
        }

        activity = detail ? `${event.toolName} ${detail}` : event.toolName;
      }

      const agentUpdate = {
        ...main,
        status: reactivatedStatus,
        lastSeen: event.timestamp,
        model: updatedModel,
        lastTask: activity,
        cwd: event.cwd || main.cwd,
        tokens: main.tokens + (event.inputTokens || 0) + (event.outputTokens || 0),
        // Tier-1 signals (Claude Code 2.1.154): background jobs, scheduled crons, last turn message, TODO list
        ...(event.backgroundTasks != null ? { backgroundTasks: event.backgroundTasks } : {}),
        ...(event.sessionCrons != null ? { sessionCrons: event.sessionCrons } : {}),
        ...(event.lastAssistantMessage ? { lastAssistantMessage: event.lastAssistantMessage.slice(0, 280) } : {}),
        ...(event.effort ? { effort: event.effort } : {}),
        ...(event.toolName === 'TodoWrite' && Array.isArray(event.toolInput?.todos)
          ? { todos: event.toolInput.todos.map(t => ({ content: String(t.content || '').slice(0, 100), status: t.status, activeForm: String(t.activeForm || '').slice(0, 100) })) }
          : {})
      };
      // Add stoppedAt when transitioning to stopped
      if (reactivatedStatus === 'stopped' && !main.stoppedAt) {
        agentUpdate.stoppedAt = event.timestamp;
      }
      agents.set(mainAgentId, agentUpdate);
    }
  }

  // Track sessions - use cwd as fallback key if sessionId not provided
  const sessionKey = event.sessionId || event.cwd;
  if (sessionKey) {
    const existing = sessions.get(sessionKey) || {
      id: event.sessionId || `session_${Buffer.from(event.cwd || '').toString('base64').slice(0, 16)}`,
      startedAt: event.timestamp,
      eventCount: 0,
      tokens: 0
    };
    sessions.set(sessionKey, {
      ...existing,
      lastActivity: event.timestamp,
      eventCount: existing.eventCount + 1,
      tokens: existing.tokens + (event.inputTokens || 0) + (event.outputTokens || 0),
      model: event.model || existing.model,
      cwd: event.cwd || existing.cwd
    });
  }

  // Update smart status for this session
  if (event.sessionId) {
    const sid = event.sessionId;
    const type = event.type;
    const tool = event.toolName;
    if (type === 'PostToolUse' && event.isError) {
      smartStatusMap[sid] = { status: 'failed', label: 'Error', icon: '❌', color: 'text-red-400' };
    } else if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
      smartStatusMap[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: 'text-violet-400' };
    } else if (type === 'PreToolUse') {
      if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
        smartStatusMap[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: 'text-sky-400' };
      } else if (tool === 'Edit' || tool === 'Write') {
        smartStatusMap[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: 'text-orange-400' };
      } else if (tool === 'Bash') {
        smartStatusMap[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: 'text-amber-400' };
      } else if (tool === 'Task' || tool === 'Agent') {
        smartStatusMap[sid] = { status: 'spawning', label: 'Spawning', icon: '🔀', color: 'text-violet-400' };
      } else if (tool === 'WebSearch' || tool === 'WebFetch') {
        smartStatusMap[sid] = { status: 'searching', label: 'Searching', icon: '🌐', color: 'text-cyan-400' };
      } else if (tool === 'TeamCreate') {
        smartStatusMap[sid] = { status: 'teaming', label: 'Creating Team', icon: '👥', color: 'text-indigo-400' };
      } else if (tool === 'SendMessage') {
        smartStatusMap[sid] = { status: 'messaging', label: 'Messaging', icon: '📨', color: 'text-cyan-400' };
      } else if (tool === 'TeamDelete') {
        smartStatusMap[sid] = { status: 'teaming', label: 'Team Cleanup', icon: '🧹', color: 'text-gray-400' };
      } else {
        smartStatusMap[sid] = { status: 'processing', label: 'Processing', icon: '⚙️', color: 'text-blue-400' };
      }
    } else if (type === 'PermissionRequest') {
      smartStatusMap[sid] = { status: 'waiting', label: 'Waiting', icon: '⏳', color: 'text-orange-400' };
    } else if (type === 'PreCompact') {
      smartStatusMap[sid] = { status: 'compacting', label: 'Compacting', icon: '📦', color: 'text-slate-400' };
    } else if (type === 'Stop' || type === 'SessionEnd') {
      smartStatusMap[sid] = { status: 'stopped', label: 'Stopped', icon: '○', color: 'text-gray-500' };
    }
  }

  // Save to disk (cleanup handled by checkAgentTimeouts interval)
  saveEvents();
  saveAgents();
}

// Get recent events
function getRecentEvents(limit = 100) {
  return events.slice(-limit).reverse();
}

// Get stats (async - statsReader uses async file I/O)
async function getStats() {
  const tokens = await readStatsCache();
  const eventCounts = {};
  events.forEach(e => {
    eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
  });

  return {
    eventCounts,
    tokens: tokens || {
      today_used: 0,
      daily_limit: 1000000,
      week_used: 0,
      weekly_limit: 5000000,
      modelUsage: {}
    }
  };
}

// Cache for session token cumulative data (refresh every 10 seconds)
const sessionTokenCache = new Map();
const SESSION_TOKEN_CACHE_TTL = 10000;

// Cache for session context % (fast tail-read, refresh every 2 seconds)
const sessionContextCache = new Map();
const SESSION_CONTEXT_CACHE_TTL = 1000;

// Resolve session ID to transcript file path (cached indefinitely per session)
const sessionPathCache = new Map();
async function resolveSessionPath(sessionId) {
  const cached = sessionPathCache.get(sessionId);
  if (cached) return cached;
  let allEntries;
  try {
    allEntries = await fs.promises.readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
  } catch { return null; }
  for (const d of allEntries.filter(d => d.isDirectory())) {
    const p = path.join(CLAUDE_PROJECTS_DIR, d.name, `${sessionId}.jsonl`);
    try { await fs.promises.access(p); sessionPathCache.set(sessionId, p); return p; } catch { continue; }
  }
  return null;
}

// Fast tail-read: read last 64KB of transcript to get the latest context window fill
// Matches Claude Code's exact formula: (input_tokens + cache_creation + cache_read) / contextWindow
async function readSessionContext(sessionId) {
  const cached = sessionContextCache.get(sessionId);
  if (cached && (Date.now() - cached.timestamp) < SESSION_CONTEXT_CACHE_TTL) {
    return { lastInputTokens: cached.lastInputTokens, meta: cached.meta || null, lastMessage: cached.lastMessage || null, awaitingReply: cached.awaitingReply || false };
  }
  const transcriptPath = await resolveSessionPath(sessionId);
  if (!transcriptPath) return { lastInputTokens: 0, meta: null, lastMessage: null, awaitingReply: false };
  try {
    const fd = await fs.promises.open(transcriptPath, 'r');
    const stats = await fd.stat();
    const tailSize = Math.min(stats.size, 65536); // Read last 64KB
    const buffer = Buffer.alloc(tailSize);
    const { bytesRead } = await fd.read(buffer, 0, tailSize, stats.size - tailSize);
    await fd.close();
    const tail = buffer.toString('utf-8', 0, bytesRead);
    const lines = tail.split('\n');
    // Single backward scan: last assistant usage (ctx%) + last assistant text (inline) + awaitingReply.
    // awaitingReply = a real typed user prompt appears NEWER than the last assistant text → the shown
    // answer is the previous turn's (stale) and a reply is pending → the UI dims it.
    let lastInputTokens = 0, meta = null, lastMessage = null, haveCtx = false, awaitingReply = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || (line.indexOf('"assistant"') === -1 && line.indexOf('"user"') === -1)) continue;
      let parsed;
      try { parsed = JSON.parse(line); } catch { continue; }
      const m = parsed.message;
      if (!m) continue;
      // User line seen before any assistant text (scanning from the end) → a prompt is pending
      if (parsed.type === 'user' && !lastMessage) {
        const c = m.content;
        const isPrompt = typeof c === 'string'
          ? c.trim().length > 0
          : Array.isArray(c) && c.some(b => b?.text || b?.type === 'text') && !c.some(b => b?.type === 'tool_result');
        if (isPrompt) awaitingReply = true;
        continue;
      }
      if (parsed.type !== 'assistant' || m.model === '<synthetic>') continue;
      if (!haveCtx && m.usage) {
        const u = m.usage;
        lastInputTokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        meta = {
          gitBranch: parsed.gitBranch || null,
          ccVersion: parsed.version || null,
          entrypoint: parsed.entrypoint || null,
          stopReason: m.stop_reason || null
        };
        haveCtx = true;
      }
      if (!lastMessage) {
        let t = '';
        if (typeof m.content === 'string') t = m.content;
        else if (Array.isArray(m.content)) t = m.content.filter(b => b?.text).map(b => b.text).join('\n').trim();
        if (t) lastMessage = t.slice(0, 280);
      }
      if (haveCtx && lastMessage) break;
    }
    sessionContextCache.set(sessionId, { lastInputTokens, meta, lastMessage, awaitingReply, timestamp: Date.now() });
    return { lastInputTokens, meta, lastMessage, awaitingReply };
  } catch { return { lastInputTokens: 0, meta: null, lastMessage: null, awaitingReply: false }; }
}

// ── Live last-message push ──────────────────────────────────────────────────────────
// Watch each active session's transcript; when Claude Code flushes new lines, parse them
// and push the assistant text (and awaitingReply on a new prompt) over WebSocket immediately.
// Removes the poll/cache delay — floor is Claude Code's ~1s transcript flush. Parses EVERY new
// line so fast intermediate messages aren't skipped.
const transcriptWatchers = new Map(); // sessionId -> { close }

function watchSessionTranscript(sessionId, filePath) {
  if (transcriptWatchers.has(sessionId)) return;
  let offset; try { offset = fs.statSync(filePath).size; } catch { return; } // start at EOF — only new content
  let partial = '';
  let timer = null;
  const readNew = () => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size < offset) { offset = 0; partial = ''; } // truncated/rotated
      if (stat.size <= offset) return;
      const len = stat.size - offset;
      const buf = Buffer.alloc(len);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, len, offset);
      fs.closeSync(fd);
      offset = stat.size;
      const lines = (partial + buf.toString('utf-8')).split('\n');
      partial = lines.pop(); // last line may be incomplete — carry over
      for (const line of lines) {
        const l = line.trim(); if (!l) continue;
        let p; try { p = JSON.parse(l); } catch { continue; }
        const m = p.message; if (!m) continue;
        if (p.type === 'user') {
          const c = m.content;
          const isPrompt = typeof c === 'string'
            ? c.trim().length > 0
            : Array.isArray(c) && c.some(b => b?.text || b?.type === 'text') && !c.some(b => b?.type === 'tool_result');
          if (isPrompt) broadcast({ type: 'last-message', sessionId, awaitingReply: true });
        } else if (p.type === 'assistant' && m.model !== '<synthetic>') {
          const c = m.content; let t = '';
          if (typeof c === 'string') t = c;
          else if (Array.isArray(c)) t = c.filter(b => b?.text).map(b => b.text).join('\n').trim();
          if (t) broadcast({ type: 'last-message', sessionId, message: t.slice(0, 280), awaitingReply: false });
        }
      }
    } catch { /* transient read error — next change retries */ }
  };
  let watcher;
  try { watcher = fs.watch(filePath, () => { clearTimeout(timer); timer = setTimeout(readNew, 120); }); }
  catch { return; }
  transcriptWatchers.set(sessionId, { close: () => { clearTimeout(timer); try { watcher.close(); } catch {} } });
}

// Keep watchers in sync with active main sessions (start new, prune gone)
async function manageTranscriptWatchers() {
  const wanted = new Set();
  for (const a of agents.values()) {
    if (a.type === 'main' && a.sessionId && (a.status === 'active' || a.status === 'idle')) {
      const fp = await resolveSessionPath(a.sessionId);
      if (fp) { wanted.add(a.sessionId); watchSessionTranscript(a.sessionId, fp); }
    }
  }
  for (const [sid, w] of transcriptWatchers) {
    if (!wanted.has(sid)) { w.close(); transcriptWatchers.delete(sid); }
  }
}
setTimeout(manageTranscriptWatchers, 3000);
setInterval(manageTranscriptWatchers, 5000);

// Read cumulative tokens from a session transcript file using STREAMING
async function readSessionTokens(sessionId) {
  // Check cache first
  const cached = sessionTokenCache.get(sessionId);
  if (cached && (Date.now() - cached.timestamp) < SESSION_TOKEN_CACHE_TTL) {
    return cached.data;
  }

  const transcriptPath = await resolveSessionPath(sessionId);
  if (!transcriptPath) return null;

  try {
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    // Tier-2 session stats (same single stream — no extra I/O)
    let webSearches = 0;
    let webFetches = 0;
    let cacheCreation1h = 0;
    let cacheCreation5m = 0;
    const filesTouched = new Set();
    let hookTotal = 0, hookFailures = 0, hookMaxMs = 0, hookSlowest = null;

    await safeReadLines(transcriptPath, (line) => {
      if (!line.trim()) return;
      const parsed = JSON.parse(line);
      if (parsed.message?.usage && parsed.message.model !== '<synthetic>') {
        const usage = parsed.message.usage;
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
        cacheReadTokens += usage.cache_read_input_tokens || 0;
        cacheCreationTokens += usage.cache_creation_input_tokens || 0;
        webSearches += usage.server_tool_use?.web_search_requests || 0;
        webFetches += usage.server_tool_use?.web_fetch_requests || 0;
        cacheCreation1h += usage.cache_creation?.ephemeral_1h_input_tokens || 0;
        cacheCreation5m += usage.cache_creation?.ephemeral_5m_input_tokens || 0;
      } else if (parsed.type === 'file-history-snapshot') {
        const backups = parsed.snapshot?.trackedFileBackups;
        if (backups) for (const fp of Object.keys(backups)) filesTouched.add(fp);
      } else if (parsed.type === 'attachment' && parsed.attachment?.hookName) {
        const at = parsed.attachment;
        hookTotal++;
        if (at.exitCode != null && at.exitCode !== 0) hookFailures++;
        if ((at.durationMs || 0) > hookMaxMs) { hookMaxMs = at.durationMs || 0; hookSlowest = at.hookName; }
      }
    });

    const data = {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalTokens: inputTokens + outputTokens,
      webSearches,
      webFetches,
      cacheCreation1h,
      cacheCreation5m,
      filesTouched: filesTouched.size,
      hookHealth: hookTotal > 0 ? { total: hookTotal, failures: hookFailures, maxMs: hookMaxMs, slowest: hookSlowest } : null
    };

    sessionTokenCache.set(sessionId, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.error(`Error reading session tokens for ${sessionId}:`, err.message);
  }

  return null;
}

// Git diff stats cache (per cwd, TTL 5 seconds)
const gitDiffCache = new Map();
const GIT_DIFF_CACHE_TTL = 10000;

async function getGitDiffStats(cwd, initialCommit) {
  if (!cwd) return null;

  // Cache key includes initialCommit to separate session-based vs HEAD-based diffs
  const cacheKey = `${cwd}::${initialCommit || 'HEAD'}`;
  const cached = gitDiffCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < GIT_DIFF_CACHE_TTL) {
    return cached.data;
  }

  try {
    // If initialCommit is set, diff from session start (includes committed + uncommitted)
    // Otherwise fall back to HEAD (uncommitted only)
    const diffBase = initialCommit || 'HEAD';
    const { stdout: output } = await execAsync(`git diff --numstat ${diffBase}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true
    });

    let additions = 0;
    let deletions = 0;
    let files = 0;

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;
      const [add, del] = line.split('\t');
      if (add !== '-') additions += parseInt(add) || 0;
      if (del !== '-') deletions += parseInt(del) || 0;
      files++;
    }

    const data = files > 0 ? { additions, deletions, files } : null;
    gitDiffCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch {
    gitDiffCache.set(cacheKey, { data: null, timestamp: Date.now() });
    return null;
  }
}

// Get agents lightweight (sync, no I/O) - for immediate broadcast after events
function getAgentsLightweight() {
  const now = Date.now();
  return Array.from(agents.values())
    .map(agent => {
      const result = { ...agent, model: normalizeModel(agent.model) || agent.model };
      if (agent.status === 'active' && agent.startedAt) {
        const elapsed = now - new Date(agent.startedAt).getTime();
        result.elapsed = elapsed;
        result.elapsedFormatted = formatDuration(elapsed);
      }
      // Use persisted gitDiff only (no execSync here — refreshed by periodic broadcast)
      if (agent.type === 'main') {
        result.gitDiff = agent.gitDiff || null;
      }
      // Mirror getAgents: suppress unverified model for still-running subagents (no guessed badge)
      if (agent.type !== 'main' && (agent.status === 'active' || agent.status === 'idle' || agent.status === 'stale') && !agent.modelVerified) {
        result.model = null;
      }
      return result;
    })
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      if (a.type === 'main' && b.type !== 'main') return -1;
      if (b.type === 'main' && a.type !== 'main') return 1;
      return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
}

// Get agents (async - statsReader uses async file I/O, enriched with tokens/git)
async function getAgents() {
  // Get primary model from stats
  const tokens = await readStatsCache();
  const primaryModel = tokens?.session_primary_model;

  // Update main agents' model based on actual usage
  if (primaryModel) {
    const modelName = primaryModel === 'opus' ? 'claude-opus-4-8' :
                      primaryModel === 'sonnet' ? 'claude-sonnet-4-6' :
                      primaryModel === 'haiku' ? 'claude-haiku-4-5-20251001' : null;
    if (modelName) {
      for (const [id, agent] of agents.entries()) {
        // Skip overwrite if agent already has a versioned real id (preserves transcript-derived model)
        if (agent.type === 'main' && !/(?:opus|sonnet|haiku)-\d/.test(agent.model)) {
          agents.set(id, { ...agent, model: modelName });
        }
      }
    }
  }

  const now = Date.now();

  // Get all agents and fetch token data for main agents
  const agentList = Array.from(agents.values());

  // Fetch session tokens + context % for all main agents in parallel
  const mainAgents = agentList.filter(a => a.type === 'main' && a.sessionId);
  const tokenPromises = mainAgents.map(async (agent) => {
    const [sessionTokens, ctx] = await Promise.all([
      readSessionTokens(agent.sessionId),
      readSessionContext(agent.sessionId), // fast tail-read — { lastInputTokens, meta }
    ]);
    return { sessionId: agent.sessionId, tokens: sessionTokens, lastInputTokens: ctx.lastInputTokens, meta: ctx.meta, lastMessage: ctx.lastMessage, awaitingReply: ctx.awaitingReply };
  });

  const tokenResults = (await Promise.allSettled(tokenPromises))
    .filter(r => r.status === 'fulfilled').map(r => r.value);
  const sessionTokenMap = new Map(tokenResults.map(r => [r.sessionId, r.tokens]));
  const sessionContextMap = new Map(tokenResults.map(r => [r.sessionId, r.lastInputTokens]));
  const sessionMetaMap = new Map(tokenResults.map(r => [r.sessionId, r.meta]));
  const sessionLastMsgMap = new Map(tokenResults.map(r => [r.sessionId, r.lastMessage]));
  const sessionAwaitingMap = new Map(tokenResults.map(r => [r.sessionId, r.awaitingReply]));

  // Fetch tokens for subagents with transcript paths (including stopped — for contextPct)
  const activeSubagents = agentList.filter(a => a.type !== 'main' && a.transcriptPath && (a.status !== 'stopped' || !a.contextPct));
  const subagentTokenPromises = activeSubagents.map(async (agent) => {
    const tokens = await readSubagentTokens(agent.transcriptPath);
    return { id: agent.id, tokens };
  });
  const subagentTokenResults = (await Promise.allSettled(subagentTokenPromises))
    .filter(r => r.status === 'fulfilled').map(r => r.value);
  const subagentTokenMap = new Map(subagentTokenResults.filter(r => r.tokens).map(r => [r.id, r.tokens]));

  // Fetch git diff stats for main agents in parallel (non-blocking)
  const mainAgentsWithCwd = agentList.filter(a => a.type === 'main' && a.cwd);
  const gitDiffPromises = mainAgentsWithCwd.map(async (agent) => {
    const freshDiff = await getGitDiffStats(agent.cwd, agent.initialCommit);
    return { id: agent.id, gitDiff: freshDiff };
  });
  const gitDiffResults = (await Promise.allSettled(gitDiffPromises))
    .filter(r => r.status === 'fulfilled').map(r => r.value);
  const gitDiffMap = new Map(gitDiffResults.map(r => [r.id, r.gitDiff]));

  return agentList
    .map(agent => {
      // Calculate elapsed time for active agents
      const result = { ...agent, model: normalizeModel(agent.model) || agent.model };

      if (agent.status === 'active' && agent.startedAt) {
        const startTime = new Date(agent.startedAt).getTime();
        const elapsed = now - startTime;
        result.elapsed = elapsed;
        result.elapsedFormatted = formatDuration(elapsed);
      }

      // Add session tokens for main agents
      if (agent.type === 'main' && agent.sessionId) {
        const sessionTokens = sessionTokenMap.get(agent.sessionId);
        if (sessionTokens) {
          result.tokens = sessionTokens.totalTokens;
          result.inputTokens = sessionTokens.inputTokens;
          result.outputTokens = sessionTokens.outputTokens;
          result.cacheReadTokens = sessionTokens.cacheReadTokens;
          result.cacheCreationTokens = sessionTokens.cacheCreationTokens;
          // Tier-2 session stats
          result.webSearches = sessionTokens.webSearches || 0;
          result.webFetches = sessionTokens.webFetches || 0;
          result.cacheCreation1h = sessionTokens.cacheCreation1h || 0;
          result.cacheCreation5m = sessionTokens.cacheCreation5m || 0;
          result.filesTouched = sessionTokens.filesTouched || 0;
          result.hookHealth = sessionTokens.hookHealth || null;
          const curT = agents.get(agent.id);
          if (curT) agents.set(agent.id, { ...curT, webSearches: result.webSearches, webFetches: result.webFetches, cacheCreation1h: result.cacheCreation1h, cacheCreation5m: result.cacheCreation5m, filesTouched: result.filesTouched, hookHealth: result.hookHealth });
        }
        // Use fast tail-read context % (cache, reads last 64KB only)
        const lastInput = sessionContextMap.get(agent.sessionId) || 0;
        if (lastInput > 0) result.lastInputTokens = lastInput;
        // Attach Claude Code session meta (git branch, CC version, entrypoint, last stop_reason)
        const meta = sessionMetaMap.get(agent.sessionId);
        if (meta) {
          if (meta.gitBranch) result.gitBranch = meta.gitBranch;
          if (meta.ccVersion) result.ccVersion = meta.ccVersion;
          if (meta.entrypoint) result.entrypoint = meta.entrypoint;
          result.stopReason = meta.stopReason || null;
          const cur = agents.get(agent.id);
          if (cur) agents.set(agent.id, { ...cur, gitBranch: result.gitBranch, ccVersion: result.ccVersion, entrypoint: result.entrypoint, stopReason: result.stopReason });
        }
        // Fresh last assistant message from the tail-read — overrides the slower hook value
        const freshMsg = sessionLastMsgMap.get(agent.sessionId);
        if (freshMsg) {
          result.lastAssistantMessage = freshMsg;
          const cur2 = agents.get(agent.id);
          if (cur2) agents.set(agent.id, { ...cur2, lastAssistantMessage: freshMsg });
        }
        // awaitingReply: a new user prompt is pending (no assistant text since) → UI dims the stale answer
        result.awaitingReply = sessionAwaitingMap.get(agent.sessionId) || false;
      }

      // Add live tokens for active subagents (from transcript reading)
      if (agent.type !== 'main' && subagentTokenMap.has(agent.id)) {
        const st = subagentTokenMap.get(agent.id);
        result.tokens = st.tokens;
        result.inputTokens = st.inputTokens;
        result.outputTokens = st.outputTokens;
        result.lastInputTokens = st.lastInputTokens;
        // Verified model from the subagent's own transcript overrides any spawn-time default
        const realModel = normalizeModel(st.model);
        if (realModel) { result.model = realModel; result.modelVerified = true; }
        // Persist back so lightweight reads also have tokens + the verified model
        const current = agents.get(agent.id);
        if (current) agents.set(agent.id, { ...current, tokens: st.tokens, inputTokens: st.inputTokens, outputTokens: st.outputTokens, lastInputTokens: st.lastInputTokens, ...(realModel ? { model: realModel, modelVerified: true } : {}) });
      }

      // Never show an UNVERIFIED model for a still-running subagent — better no badge than a wrong guess
      if (agent.type !== 'main' && (agent.status === 'active' || agent.status === 'idle' || agent.status === 'stale') && !result.modelVerified) {
        result.model = null;
      }

      // Calculate context window usage %
      // Prefer real-time statusLine data (from Claude Code's in-memory state) over transcript tail-read
      if (agent.type === 'main' && agent.sessionId) {
        const statusLine = statusLineContextCache.get(agent.sessionId);
        if (statusLine && (Date.now() - statusLine.timestamp) < STATUSLINE_CONTEXT_TTL) {
          // Use real-time value from statusLine — this matches Claude Code exactly
          result.contextPct = statusLine.contextPct;
          const current = agents.get(agent.id);
          if (current) agents.set(agent.id, { ...current, contextPct: result.contextPct });
        } else if (result.lastInputTokens > 0) {
          // Fallback: calculate from transcript data
          const limit = MODEL_CONTEXT_LIMITS[result.model] || DEFAULT_CONTEXT_LIMIT;
          result.contextPct = Math.round((result.lastInputTokens / limit) * 100);
          const current = agents.get(agent.id);
          if (current) agents.set(agent.id, { ...current, lastInputTokens: result.lastInputTokens, contextPct: result.contextPct });
        }
      } else if (result.lastInputTokens > 0) {
        // Subagents: always calculate from transcript (no statusLine for subagents)
        const limit = MODEL_CONTEXT_LIMITS[result.model] || DEFAULT_CONTEXT_LIMIT;
        result.contextPct = Math.round((result.lastInputTokens / limit) * 100);
        const current = agents.get(agent.id);
        if (current) agents.set(agent.id, { ...current, lastInputTokens: result.lastInputTokens, contextPct: result.contextPct });
      }

      // Add git diff stats - persist on agent so it survives status changes
      if (agent.type === 'main' && agent.cwd) {
        const freshDiff = gitDiffMap.get(agent.id);
        if (freshDiff) {
          result.gitDiff = freshDiff;
          const current = agents.get(agent.id);
          if (current) agents.set(agent.id, { ...current, gitDiff: freshDiff });
        } else {
          result.gitDiff = agent.gitDiff || null;
        }
      }

      return result;
    })
    .sort((a, b) => {
      // Sort: active first, then by lastSeen
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      // Main agents always first among active (sorted by type)
      if (a.type === 'main' && b.type !== 'main') return -1;
      if (b.type === 'main' && a.type !== 'main') return 1;
      return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
}

// Get teams
function getTeams() {
  return Array.from(teams.entries()).map(([name, team]) => {
    // Detect file conflicts for this team
    const conflicts = [];
    for (const [filePath, owners] of fileOwnership.entries()) {
      const teamOwners = owners.filter(o => o.teamName === name);
      const uniqueAgents = new Set(teamOwners.map(o => o.agentId));
      if (uniqueAgents.size > 1) {
        conflicts.push({ path: filePath, agents: teamOwners.map(o => o.agentName) });
      }
    }

    return {
      name,
      description: team.description,
      leadSessionId: team.leadSessionId,
      leadAgentId: team.leadAgentId,
      createdAt: team.createdAt,
      memberCount: team.members.size,
      members: Array.from(team.members).map(id => {
        const agent = agents.get(id);
        return agent ? { id, name: agent.agentName, type: agent.type, status: agent.status, tokens: agent.tokens || 0 } : { id };
      }),
      status: team.status,
      fileConflicts: conflicts
    };
  });
}

// Get recent team communications
function getRecentTeamComms(limit = 50) {
  return teamComms.slice(-limit).reverse();
}

// Get file ownership for a team
function getTeamFiles(teamName) {
  const files = [];
  for (const [filePath, owners] of fileOwnership.entries()) {
    const teamOwners = owners.filter(o => o.teamName === teamName);
    if (teamOwners.length > 0) {
      const uniqueAgents = new Set(teamOwners.map(o => o.agentId));
      files.push({
        path: filePath,
        owners: teamOwners,
        hasConflict: uniqueAgents.size > 1
      });
    }
  }
  return files;
}

// Get sessions
function getSessions() {
  return Array.from(sessions.values())
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
    .slice(0, 20);
}

// API Routes

// Deduplicate events - track recent event hashes
const recentEventHashes = new Map(); // hash -> timestamp
const EVENT_DEDUP_WINDOW_MS = 5000; // 5 second window for deduplication

// Generate hash from event content for deduplication
// NOTE: Do NOT include timestamp - hooks may be called multiple times with different timestamps
function getEventHash(event) {
  // Use tool_use_id if available (unique per tool call from Claude Code)
  const toolUseId = event.raw?.tool_use_id || '';

  // For tool events, use tool_use_id as primary dedup key
  if (toolUseId) {
    return `tid_${toolUseId}_${event.type}`;
  }

  // For non-tool events (SessionStart, Stop, etc.), use content-based hash WITHOUT timestamp
  // Include agent id so parallel subagent lifecycle events (same type/session) don't collide
  const agentKey = event.raw?.agent_id || event.agentId || '';
  const key = `${event.type}|${event.sessionId || ''}|${agentKey}|${event.toolName || ''}|${JSON.stringify(event.toolInput || {}).slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// Clean old hashes periodically
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of recentEventHashes.entries()) {
    if (now - timestamp > EVENT_DEDUP_WINDOW_MS * 2) {
      recentEventHashes.delete(hash);
    }
  }
}, 10000);

// Cache for real-time context data from statusLine wrapper
// Key: sessionId, Value: { contextPct, timestamp }
const statusLineContextCache = new Map();
const STATUSLINE_CONTEXT_TTL = 10000; // Trust statusLine data for 10 seconds

// Receive real-time context window updates from statusLine wrapper
app.post('/context-update', (req, res) => {
  try {
    const { sessionId, contextWindow } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    // Dual-shape: prefer authoritative used_percentage (statusline_wrapper.js path);
    // else compute from lastInputTokens against the model's context limit.
    let usedPct = null;
    let lastInputTokens = null;
    if (contextWindow?.used_percentage != null) {
      usedPct = contextWindow.used_percentage;
    } else if (req.body.lastInputTokens != null) {
      lastInputTokens = req.body.lastInputTokens;
      usedPct = Math.round(lastInputTokens / getContextLimit(normalizeModel(req.body.model)) * 100);
    }
    if (usedPct == null) return res.json({ success: true });

    // Cache the real-time context % from Claude Code's in-memory state
    statusLineContextCache.set(sessionId, { contextPct: usedPct, lastInputTokens, timestamp: Date.now() });

    // Find main agent with this sessionId and update context data
    for (const [id, agent] of agents.entries()) {
      if (agent.type === 'main' && agent.sessionId === sessionId) {
        agents.set(id, {
          ...agent,
          contextPct: usedPct,
          ...(lastInputTokens != null ? { lastInputTokens } : {}),
          lastSeen: new Date().toISOString()
        });
        break;
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receive events from hook scripts (with stricter rate limiting)
app.post('/events', eventLimiter, (req, res) => {
  try {
    // Validate incoming event
    const parseResult = eventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid event format',
        details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      });
    }

    // Check for duplicate event
    const eventHash = getEventHash(parseResult.data);
    const now = Date.now();

    if (recentEventHashes.has(eventHash)) {
      const lastSeen = recentEventHashes.get(eventHash);
      if (now - lastSeen < EVENT_DEDUP_WINDOW_MS) {
        console.log(`[DEDUP] Skipping duplicate event: ${parseResult.data.type} (hash: ${eventHash})`);
        return res.json({ success: true, id: 'duplicate', skipped: true });
      }
    }
    recentEventHashes.set(eventHash, now);

    const event = {
      id: req.body.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...parseResult.data,
      receivedAt: new Date().toISOString()
    };

    // Compute failed-tool flags server-side BEFORE raw.tool_input is stripped
    const tr = event.raw?.tool_response;
    if (event.type === 'PostToolUse' && tr && tr.is_error) {
      event.isError = true;
      let c = tr.content;
      if (Array.isArray(c)) c = c.map(b => b?.text || b?.content || '').join(' ');
      event.errorSummary = (typeof c === 'string' ? c : JSON.stringify(c || '')).slice(0, 200);
    }

    processEvent(event);

    // Strip large raw.tool_input after processing (contains full file content for Write/Edit)
    if (event.raw?.tool_input) {
      delete event.raw.tool_input;
    }

    broadcast({ type: 'event', event });

    // Broadcast lightweight agents immediately (no I/O) for realtime UI
    broadcast({ type: 'agents_update', agents: getAgentsLightweight() });

    res.json({ success: true, id: event.id });
  } catch (err) {
    console.error('Error processing event:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get recent events
app.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const type = req.query.type;

  let result = getRecentEvents(limit);
  if (type) {
    result = result.filter(e => e.type === type);
  }
  res.json(result);
});

// Get stats
app.get('/stats', async (req, res) => {
  res.json(await getStats());
});

// Get agents
app.get('/agents', async (req, res) => {
  res.json(await getAgents());
});

// Read the FULL latest assistant message from a session transcript — on-demand only
// (the /agents payload keeps just a 280-char preview; full text is read here when the user clicks).
async function readLastAssistantMessageFull(sessionId) {
  const transcriptPath = await resolveSessionPath(sessionId);
  if (!transcriptPath) return null;
  let last = null;
  await safeReadLines(transcriptPath, (line) => {
    if (!line.trim()) return;
    let parsed;
    try { parsed = JSON.parse(line); } catch { return; }
    const msg = parsed.message;
    const isAssistant = parsed.type === 'assistant' || msg?.role === 'assistant';
    if (!isAssistant || !msg || msg.model === '<synthetic>') return;
    let text = '';
    if (typeof msg.content === 'string') text = msg.content;
    else if (Array.isArray(msg.content)) {
      text = msg.content.filter(b => b?.text).map(b => b.text).join('\n').trim();
    }
    if (text) last = text;
  });
  return last;
}

// Full last assistant message (no truncation) — read on click, not on every poll
app.get('/session/:sessionId/last-message', async (req, res) => {
  try {
    const message = await readLastAssistantMessageFull(req.params.sessionId);
    if (message == null) return res.status(404).json({ error: 'No assistant message found' });
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reply timeline: all assistant text messages (chronological) — read on demand for the timeline view
app.get('/session/:sessionId/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const transcriptPath = await resolveSessionPath(req.params.sessionId);
    if (!transcriptPath) return res.status(404).json({ error: 'No transcript found' });
    const all = [];
    await safeReadLines(transcriptPath, (line) => {
      if (!line.trim()) return;
      let p; try { p = JSON.parse(line); } catch { return; }
      const m = p.message;
      if (p.type !== 'assistant' || !m || m.model === '<synthetic>') return;
      let t = ''; const c = m.content;
      if (typeof c === 'string') t = c;
      else if (Array.isArray(c)) t = c.filter(b => b?.text).map(b => b.text).join('\n').trim();
      if (t) all.push({ ts: p.timestamp || null, text: t.slice(0, 4000) });
    });
    res.json({ messages: all.slice(-limit), total: all.length }); // most recent `limit`, chronological
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sessions
app.get('/sessions', (req, res) => {
  res.json(getSessions());
});

// Get teams
app.get('/teams', (req, res) => {
  res.json(getTeams());
});

// Get team communications
app.get('/teams/:name/comms', (req, res) => {
  const teamName = req.params.name;
  const comms = teamComms.filter(c => c.teamName === teamName).slice(-50).reverse();
  res.json(comms);
});

// Get team file ownership
app.get('/teams/:name/files', (req, res) => {
  const teamName = req.params.name;
  res.json(getTeamFiles(teamName));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: clients.size,
    events: events.length,
    uptime: process.uptime()
  });
});

// Clear all events
app.delete('/events', (req, res) => {
  events = [];
  agents.clear();
  sessions.clear();
  smartStatusMap = {};
  teams.clear();
  teamComms = [];
  fileOwnership.clear();
  saveEvents();
  saveAgents();
  broadcast({ type: 'clear' });
  res.json({ success: true });
});

// Clear only agents (keep events)
app.delete('/agents', (req, res) => {
  const agentCount = agents.size;
  agents.clear();
  smartStatusMap = {};
  saveAgents();
  broadcast({ type: 'agents_cleared' });
  console.log(`[CLEAR] Cleared ${agentCount} agents`);
  res.json({ success: true, cleared: agentCount });
});

// Clear only stopped agents (keep active ones)
app.delete('/agents/stopped', (req, res) => {
  let cleared = 0;
  for (const [id, agent] of agents.entries()) {
    if (agent.status === 'stopped' || agent.status === 'timeout') {
      if (agent.sessionId) delete smartStatusMap[agent.sessionId];
      agents.delete(id);
      cleared++;
    }
  }
  saveAgents();
  broadcast({ type: 'agents_update', agents: getAgentsLightweight() });
  console.log(`[CLEAR] Cleared ${cleared} stopped agents`);
  res.json({ success: true, cleared });
});

// Receive Claude.ai usage from extension (OPTIONAL FALLBACK).
// The primary usage source is the OAuth sync below (fetchClaudeCodeUsage), which needs
// no browser. This endpoint stays for the edge case where Claude Code is NOT on this
// machine but a browser logged into claude.ai is — the extension can POST usage here.
// If both run, whichever wrote claudeUsage most recently wins (OAuth refreshes every 60s).
app.post('/usage', (req, res) => {
  try {
    const { usage, timestamp, source } = req.body;

    if (!usage) {
      return res.status(400).json({ error: 'Missing usage data' });
    }

    // Update usage data
    claudeUsage = {
      five_hour: usage.five_hour || null,
      seven_day: usage.seven_day || null,
      seven_day_sonnet: usage.seven_day_sonnet || null,
      seven_day_opus: usage.seven_day_opus || null,
      seven_day_cowork: usage.seven_day_cowork || null,
      extra_usage: usage.extra_usage || null,
      lastSync: timestamp || new Date().toISOString(),
      source: source || 'extension'
    };

    console.log(`[USAGE] Claude usage updated: Session ${usage.five_hour?.utilization || 0}%, Weekly ${usage.seven_day?.utilization || 0}%`);

    // Broadcast to all clients
    broadcast({
      type: 'usage',
      usage: claudeUsage
    });

    res.json({ success: true, received: claudeUsage });
  } catch (err) {
    console.error('Error processing usage:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Claude.ai usage
app.get('/usage', (req, res) => {
  res.json(claudeUsage);
});

// Restart server (graceful — save state, then exit so process manager restarts)
app.post('/restart', (req, res) => {
  console.log('[RESTART] Restart requested via API');
  saveEvents();
  saveAgents();
  res.json({ ok: true, message: 'Server restarting...' });
  // Give response time to flush, then exit
  setTimeout(() => {
    console.log('[RESTART] Exiting for restart...');
    process.exit(0);
  }, 500);
});

// Load existing data
loadEvents();
loadAgents();

// Rebuild teams from loaded agents (teams Map is in-memory only, not persisted to disk)
(function rebuildTeams() {
  // Collect all teamNames from agents
  const teamNames = new Set();
  for (const [, agent] of agents.entries()) {
    if (agent.teamName) teamNames.add(agent.teamName);
  }

  for (const teamName of teamNames) {
    // Find the team lead (main agent with isTeamLead)
    let leadId = null;
    let leadSessionId = null;
    let createdAt = null;

    for (const [id, agent] of agents.entries()) {
      if (agent.teamName === teamName && agent.isTeamLead) {
        leadId = id;
        leadSessionId = agent.sessionId;
        createdAt = agent.startedAt;
        break;
      }
    }

    // If no explicit lead found, infer from subagents' parent session
    if (!leadId) {
      for (const [, agent] of agents.entries()) {
        if (agent.teamName === teamName && agent.type !== 'main' && agent.sessionId) {
          leadSessionId = agent.sessionId;
          leadId = `main_${agent.sessionId}`;
          createdAt = agent.startedAt;
          // Also mark the main agent as team lead
          const mainAgent = agents.get(leadId);
          if (mainAgent) {
            agents.set(leadId, { ...mainAgent, teamName, isTeamLead: true });
          }
          break;
        }
      }
    }

    // Create the team entry
    const members = new Set();
    for (const [id, agent] of agents.entries()) {
      if (agent.teamName === teamName && agent.type !== 'main') {
        members.add(id);
      }
    }

    teams.set(teamName, {
      name: teamName,
      description: '',
      leadSessionId,
      leadAgentId: leadId,
      createdAt,
      members,
      status: 'active'
    });
  }

  if (teams.size > 0) {
    console.log(`[LOAD] Rebuilt ${teams.size} team(s): ${Array.from(teamNames).join(', ')}`);
  }
})();

// Rebuild smartStatusMap from loaded events (so MiniApp isn't empty after server restart)
for (const event of events) {
  const sid = event.sessionId;
  if (!sid) continue;
  const type = event.type;
  const tool = event.toolName;
  if (type === 'PostToolUse' && event.isError) {
    smartStatusMap[sid] = { status: 'failed', label: 'Error', icon: '❌', color: 'text-red-400' };
  } else if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
    smartStatusMap[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: 'text-violet-400' };
  } else if (type === 'PreToolUse') {
    if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
      smartStatusMap[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: 'text-sky-400' };
    } else if (tool === 'Edit' || tool === 'Write') {
      smartStatusMap[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: 'text-orange-400' };
    } else if (tool === 'Bash') {
      smartStatusMap[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: 'text-amber-400' };
    } else if (tool === 'Task' || tool === 'Agent') {
      smartStatusMap[sid] = { status: 'spawning', label: 'Spawning', icon: '🔀', color: 'text-violet-400' };
    } else if (tool === 'WebSearch' || tool === 'WebFetch') {
      smartStatusMap[sid] = { status: 'searching', label: 'Searching', icon: '🌐', color: 'text-cyan-400' };
    } else if (tool === 'TeamCreate') {
      smartStatusMap[sid] = { status: 'teaming', label: 'Creating Team', icon: '👥', color: 'text-indigo-400' };
    } else if (tool === 'SendMessage') {
      smartStatusMap[sid] = { status: 'messaging', label: 'Messaging', icon: '📨', color: 'text-cyan-400' };
    } else if (tool === 'TeamDelete') {
      smartStatusMap[sid] = { status: 'teaming', label: 'Team Cleanup', icon: '🧹', color: 'text-gray-400' };
    } else {
      smartStatusMap[sid] = { status: 'processing', label: 'Processing', icon: '⚙️', color: 'text-blue-400' };
    }
  } else if (type === 'Stop' || type === 'SessionEnd') {
    smartStatusMap[sid] = { status: 'stopped', label: 'Stopped', icon: '○', color: 'text-gray-500' };
  }
}
// Clean up smartStatus for sessions without agents (ghost sessions from history)
for (const sid of Object.keys(smartStatusMap)) {
  if (!agents.has(`main_${sid}`)) delete smartStatusMap[sid];
}
console.log(`[LOAD] Rebuilt smartStatus for ${Object.keys(smartStatusMap).length} sessions`);

// Pre-warm stats cache so first WebSocket client doesn't wait for cold-cache scan
readStatsCache().then(() => console.log('[INIT] Stats cache pre-warmed')).catch(() => {});

// Periodic stats broadcast (async, crash-safe, non-overlapping)
let broadcastInProgress = false;
setInterval(async () => {
  if (broadcastInProgress) {
    console.warn('[Broadcast] Skipping — previous broadcast still in progress');
    return;
  }
  broadcastInProgress = true;
  try {
    broadcast({
      type: 'stats',
      stats: await getStats(),
      agents: await getAgents(),
      sessions: getSessions(),
      usage: claudeUsage,
      smartStatus: smartStatusMap,
      teams: getTeams(),
      teamComms: getRecentTeamComms()
    });
  } catch (err) {
    console.error('[Broadcast] Periodic update failed:', err.message);
  } finally {
    broadcastInProgress = false;
  }
}, 10000);

// ── Claude Code usage sync (extension-free) ───────────────────────
// Reads the local OAuth token Claude Code already maintains and queries Anthropic's
// usage endpoint — same numbers shown in Claude Code's "Account & Usage" panel
// (5-hour %, weekly %, weekly Sonnet/Opus, extra usage). Re-reads the token each cycle
// so it stays valid after Claude Code refreshes it. Falls back silently on error.
// Backoff state — Anthropic's /oauth/usage endpoint rate-limits (429); don't hammer it every 60s.
let usageBackoffUntil = 0;
let usageBackoffMs = 0;
let usageFetchInFlight = false;           // prevent overlapping fetches (60s tick + watchdog can both fire)
let lastGoodUsageSyncMs = Date.now();     // timestamp of last SUCCESSFUL sync — watched for staleness
const USAGE_HISTORY_FILE = path.join(__dirname, 'usage-history.json');
const usageHistory = []; // recent [{ t, util }] samples of 5h utilization → burn rate / ETA to 100%
// Restore samples across restarts so burn rate survives deploys instead of resetting to "measuring…"
// for ~3 min on every restart. Drop anything older than the 12-min window (e.g. stale after hibernate).
try {
  if (fs.existsSync(USAGE_HISTORY_FILE)) {
    const saved = JSON.parse(fs.readFileSync(USAGE_HISTORY_FILE, 'utf-8'));
    const now = Date.now();
    for (const s of (Array.isArray(saved?.history) ? saved.history : [])) {
      if (typeof s?.t === 'number' && typeof s?.util === 'number' && now - s.t <= 12 * 60000) usageHistory.push(s);
    }
    if (usageHistory.length) console.log(`[USAGE] Restored ${usageHistory.length} burn-rate samples from disk`);
  }
} catch (err) {
  console.warn('[USAGE] Could not restore usage history:', err.message);
}

function saveUsageHistory() {
  try { fs.writeFileSync(USAGE_HISTORY_FILE, JSON.stringify({ history: usageHistory })); }
  catch (err) { console.warn('[USAGE] Could not save usage history:', err.message); }
}

// Fresh-connection HTTPS GET. We deliberately avoid the global fetch (undici) here: its keep-alive
// connection pool holds a TLS socket to api.anthropic.com that dies silently when the NIC drops during
// hibernate/sleep. On resume undici reuses the dead socket, every request hangs→aborts, and the usage
// sync freezes forever (the exact "RIP Sync after hibernate" bug). `agent: false` opens a brand-new
// connection each call, so a resume can never strand us on a poisoned socket. At a 60s cadence the
// extra TLS handshake is negligible.
function httpsGetJson(url, headers, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

async function fetchClaudeCodeUsage() {
  if (usageFetchInFlight) return;              // don't pile up if a previous fetch is still running
  if (Date.now() < usageBackoffUntil) return;  // still backing off after a 429
  usageFetchInFlight = true;
  try {
    if (!fs.existsSync(CC_CREDENTIALS_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(CC_CREDENTIALS_PATH, 'utf-8'));
    const oauth = raw.claudeAiOauth || raw;
    const token = oauth.accessToken || oauth.access_token;
    if (!token) return;

    const { status, headers, body } = await httpsGetJson(CC_USAGE_ENDPOINT, {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json'
    }, 8000);

    if (status === 429) {
      // Rate limited — back off (respect Retry-After, else exponential 1.5m→30m cap). Keep last-known usage.
      const ra = parseInt(headers['retry-after'] || '', 10);
      usageBackoffMs = ra > 0 ? ra * 1000 : Math.min(Math.max(usageBackoffMs * 2, 90000), 1800000);
      usageBackoffUntil = Date.now() + usageBackoffMs;
      console.warn(`[USAGE] OAuth usage rate-limited (429) — backing off ${Math.round(usageBackoffMs / 1000)}s`);
      return;
    }
    if (status < 200 || status >= 300) {
      // 401 => token rotated/expired; Claude Code will refresh it. Keep last-known, retry next cycle.
      console.warn(`[USAGE] OAuth usage fetch failed: HTTP ${status}`);
      return;
    }
    usageBackoffMs = 0; usageBackoffUntil = 0; // healthy — reset backoff
    const u = JSON.parse(body);
    // ── Burn rate + ETA for the 5h window ──
    // Sample utilization over time; rate = Δutil/Δt (%/min). ETA to 100% only when actively rising
    // (rolling window can decay when idle → rate ≤ 0 → "safe/cooling", no ETA).
    let etaMinutes = null, burnRatePerMin = null;
    const util = u.five_hour?.utilization;
    if (typeof util === 'number') {
      const now = Date.now();
      usageHistory.push({ t: now, util });
      while (usageHistory.length && now - usageHistory[0].t > 12 * 60000) usageHistory.shift(); // keep ~12 min
      saveUsageHistory(); // persist so a restart/deploy doesn't reset burn rate to "measuring…"
      const past = usageHistory.find(s => now - s.t >= 3 * 60000); // compare to ~3min+ ago for a stable rate
      if (past && now > past.t) {
        const rate = (util - past.util) / ((now - past.t) / 60000); // %/min
        burnRatePerMin = Math.round(rate * 100) / 100;
        if (rate > 0.05 && util < 100) etaMinutes = Math.max(0, Math.round((100 - util) / rate));
      }
    }
    const fiveHour = u.five_hour ? { ...u.five_hour, etaMinutes, burnRatePerMin } : null;
    // Endpoint shape matches the dashboard's existing claudeUsage shape 1:1
    claudeUsage = {
      five_hour: fiveHour,
      seven_day: u.seven_day || null,
      seven_day_sonnet: u.seven_day_sonnet || null,
      seven_day_opus: u.seven_day_opus || null,
      seven_day_cowork: u.seven_day_cowork || null,
      extra_usage: u.extra_usage || null,
      lastSync: new Date().toISOString(),
      source: 'claude-code-oauth'
    };
    lastGoodUsageSyncMs = Date.now();
    broadcast({ type: 'usage', usage: claudeUsage });
    console.log(`[USAGE] Synced from Claude Code OAuth — 5h ${u.five_hour?.utilization ?? '?'}%, 7d ${u.seven_day?.utilization ?? '?'}%`);
  } catch (err) {
    console.warn('[USAGE] OAuth usage fetch error:', err.message);
  } finally {
    usageFetchInFlight = false;
  }
}
setTimeout(fetchClaudeCodeUsage, 2000);           // initial fetch shortly after boot
setInterval(fetchClaudeCodeUsage, 60 * 1000);     // refresh every 60s

// ── Wake-from-sleep + staleness watchdog ─────────────────────────────
// Guards the usage sync against two failure modes a plain 60s interval can't recover from:
//   1) Hibernate/sleep — timers freeze while suspended, so the first tick after resume arrives wildly
//      late. We detect that drift, clear any stale backoff, and force an immediate resync.
//   2) Any silent stall — if the last *successful* sync is older than SYNC_STALE_MS (and we're not
//      intentionally backing off), force a resync. Together with the fresh-connection fetch above, the
//      usage % can no longer stay frozen after a resume.
let lastWatchdogTick = Date.now();
const WATCHDOG_INTERVAL_MS = 30 * 1000;
const SYNC_STALE_MS = 3 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  const drift = now - lastWatchdogTick;
  lastWatchdogTick = now;

  // Drift far beyond the interval ⇒ the machine just woke from sleep/hibernate.
  const wokeFromSleep = drift > WATCHDOG_INTERVAL_MS * 2.5;
  if (wokeFromSleep) {
    console.warn(`[WAKE] Resume detected (timer drift ${Math.round(drift / 1000)}s) — clearing backoff & forcing usage resync`);
    usageBackoffUntil = 0;
    usageBackoffMs = 0;
  }

  const syncAge = now - lastGoodUsageSyncMs;
  if (wokeFromSleep || (syncAge > SYNC_STALE_MS && now >= usageBackoffUntil)) {
    fetchClaudeCodeUsage();
  }
}, WATCHDOG_INTERVAL_MS);

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 Oh My Claude! v2.2

   HTTP:      http://localhost:${PORT}
   WebSocket: ws://localhost:${PORT}

   Endpoints:
   POST /events     - Receive hook events
   GET  /events     - Get recent events
   GET  /stats      - Get stats + tokens
   GET  /agents     - Get active agents
   GET  /sessions   - Get sessions
   GET  /teams      - Get team data
   GET  /usage      - Get Claude.ai usage
   POST /usage      - Receive usage (optional extension fallback)
   GET  /health     - Health check

   Waiting for events from Claude Code hooks...
   Usage % syncs automatically from Claude Code's OAuth token — no browser needed.
   (Chrome extension remains available as a fallback if Claude Code isn't on this machine.)
`);
});

// ── Server error handling ─────────────────────────────────────────

server.on('error', (err) => {
  console.error('[SERVER] HTTP server error:', err.message);
  // Another instance already owns the port. Don't linger as a zombie that still runs every timer
  // (double OAuth polling → extra 429s, duplicate heartbeats) — exit so exactly one instance survives.
  if (err.code === 'EADDRINUSE') {
    logCrash(`[FATAL] Port ${PORT} already in use — another instance is running. Exiting to avoid a zombie duplicate.`);
    process.exit(1);
  }
});

wss.on('error', (err) => {
  console.error('[SERVER] WebSocket server error:', err.message);
});

// ── Global crash prevention ───────────────────────────────────────

process.on('uncaughtException', (err) => {
  logCrash(`[FATAL] Uncaught exception: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
  logCrash(`[FATAL] Unhandled rejection: ${reason}`);
});

// Crash log file — write directly to disk (survives even if console is broken)
const CRASH_LOG = path.join(__dirname, 'crash.log');
function logCrash(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(CRASH_LOG, line); } catch {}
  console.error(msg);
}

// Log when process is about to exit (helps diagnose silent crashes)
process.on('exit', (code) => {
  logCrash(`[EXIT] Process exiting with code ${code}`);
});

// Periodic heap + uptime check
const startTime = Date.now();
setInterval(() => {
  const heap = process.memoryUsage();
  const heapMB = Math.round(heap.heapUsed / 1048576);
  const rssMB = Math.round(heap.rss / 1048576);
  const uptimeMin = Math.round((Date.now() - startTime) / 60000);
  if (heapMB > 400) {
    console.warn(`[MEMORY] HIGH: heap ${heapMB}MB, RSS ${rssMB}MB — risk of OOM crash`);
  }
  // Log heartbeat to crash.log every 5 minutes so we know when it was last alive
  if (uptimeMin > 0 && uptimeMin % 5 === 0) {
    logCrash(`[HEARTBEAT] alive ${uptimeMin}m, heap ${heapMB}MB, RSS ${rssMB}MB`);
  }
}, 30000);

process.on('SIGTERM', () => {
  logCrash('[SIGNAL] Received SIGTERM');
});

process.on('SIGINT', () => {
  logCrash('[SIGNAL] Received SIGINT');
  process.exit(0);
});
