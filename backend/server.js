import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
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

// Claude projects directory
const CLAUDE_PROJECTS_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'projects');

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
  raw: z.any().optional(),
  source: z.string().optional(),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4824;

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
app.use(limiter); // Apply rate limiting
app.use(express.json({ limit: '10mb' }));

// Initialize HTTP server
const server = createServer(app);

// Initialize WebSocket
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

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
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
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
  lastSync: null,
  source: null
};

// Normalize short model names (from Task tool enum) to full model IDs
function normalizeModel(model) {
  if (!model) return model;
  const m = model.toLowerCase();
  // Already has version digits like "claude-haiku-4-5-20251001"
  if (/(?:opus|sonnet|haiku)-\d/.test(m)) return model;
  // Map short/partial names to full IDs
  if (m.includes('opus')) return 'claude-opus-4-6';
  if (m.includes('sonnet')) return 'claude-sonnet-4-5-20250929';
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
    if (!existsSync(transcriptPath)) return null;
    const stat = statSync(transcriptPath);
    const cached = subagentTokenCache.get(transcriptPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached;

    let inputTokens = 0;
    let outputTokens = 0;
    const rl = createInterface({
      input: createReadStream(transcriptPath, { highWaterMark: 64 * 1024 }),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.includes('"usage"')) continue; // fast skip
      try {
        const entry = JSON.parse(line);
        if (entry.message?.usage) {
          const u = entry.message.usage;
          inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
          outputTokens += u.output_tokens || 0;
        }
      } catch {}
    }
    const result = { mtimeMs: stat.mtimeMs, tokens: inputTokens + outputTokens, inputTokens, outputTokens };
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

        // Sum tokens from usage
        if (entry.message?.usage) {
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
      const agentType = event.agentType || event.raw?.subagent_type;
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
    if (!parentId) {
      parentId = 'main';
    }

    // Get model: event > pending task > default based on type > inherit from parent
    let model = normalizeModel(event.model) || normalizeModel(pendingTask?.model);
    if (!model) {
      const agentType = event.agentType || pendingTask?.subagentType || '';
      if (agentType.toLowerCase() === 'explore') model = 'claude-haiku-4-5-20251001';
      else if (agentType.toLowerCase() === 'plan') model = 'claude-sonnet-4-5-20250929';
    }
    if (!model) {
      // Inherit model from parent agent (Task tool spec: "inherits from parent")
      const parent = agents.get(parentId);
      if (parent?.model) model = parent.model;
    }

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
      transcriptPath: actualTranscriptPath || transcriptPath
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

  // Detect Task tool usage as subagent spawn (backup detection)
  if (event.toolName === 'Task' && event.type === 'PreToolUse') {
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
      const defaultModel = normalizeModel(event.model) || 'claude-sonnet-4-5-20250929';
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
        tokens: main.tokens + (event.inputTokens || 0) + (event.outputTokens || 0)
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
    if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
      smartStatusMap[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: 'text-violet-400' };
    } else if (type === 'PreToolUse') {
      if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
        smartStatusMap[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: 'text-sky-400' };
      } else if (tool === 'Edit' || tool === 'Write') {
        smartStatusMap[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: 'text-orange-400' };
      } else if (tool === 'Bash') {
        smartStatusMap[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: 'text-amber-400' };
      } else if (tool === 'Task') {
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

// Cache for session token data (refresh every 5 seconds for realtime)
const sessionTokenCache = new Map();
const SESSION_TOKEN_CACHE_TTL = 10000;

// Read tokens from a session transcript file using STREAMING
async function readSessionTokens(sessionId) {
  // Check cache first
  const cached = sessionTokenCache.get(sessionId);
  if (cached && (Date.now() - cached.timestamp) < SESSION_TOKEN_CACHE_TTL) {
    return cached.data;
  }

  // Find the session transcript file
  let allEntries;
  try {
    allEntries = await fs.promises.readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
  } catch { return null; }
  const projectDirs = allEntries.filter(d => d.isDirectory()).map(d => d.name);

  for (const projectDir of projectDirs) {
    const transcriptPath = path.join(CLAUDE_PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
    try { await fs.promises.access(transcriptPath); } catch { continue; }
    try {
      // Use readline streaming instead of loading entire file
      const rl = createInterface({
        input: fs.createReadStream(transcriptPath, { highWaterMark: 64 * 1024 }),
        crlfDelay: Infinity
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let cacheCreationTokens = 0;

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.usage) {
            const usage = parsed.message.usage;
            inputTokens += usage.input_tokens || 0;
            outputTokens += usage.output_tokens || 0;
            cacheReadTokens += usage.cache_read_input_tokens || 0;
            cacheCreationTokens += usage.cache_creation_input_tokens || 0;
          }
        } catch {
          // Skip invalid lines
        }
      }

      const data = {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        totalTokens: inputTokens + outputTokens
      };

      // Cache the result
      sessionTokenCache.set(sessionId, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.error(`Error reading session tokens for ${sessionId}:`, err.message);
    }
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
    const modelName = primaryModel === 'opus' ? 'claude-opus-4-6' :
                      primaryModel === 'sonnet' ? 'claude-sonnet-4-5-20250929' :
                      primaryModel === 'haiku' ? 'claude-haiku-4-5-20251001' : null;
    if (modelName) {
      for (const [id, agent] of agents.entries()) {
        if (agent.type === 'main') {
          agents.set(id, { ...agent, model: modelName });
        }
      }
    }
  }

  const now = Date.now();

  // Get all agents and fetch token data for main agents
  const agentList = Array.from(agents.values());

  // Fetch session tokens for all main agents in parallel
  const mainAgents = agentList.filter(a => a.type === 'main' && a.sessionId);
  const tokenPromises = mainAgents.map(async (agent) => {
    const sessionTokens = await readSessionTokens(agent.sessionId);
    return { sessionId: agent.sessionId, tokens: sessionTokens };
  });

  const tokenResults = await Promise.all(tokenPromises);
  const sessionTokenMap = new Map(tokenResults.map(r => [r.sessionId, r.tokens]));

  // Fetch tokens for active subagents with transcript paths (parallel, cached)
  const activeSubagents = agentList.filter(a => a.type !== 'main' && a.status !== 'stopped' && a.transcriptPath);
  const subagentTokenPromises = activeSubagents.map(async (agent) => {
    const tokens = await readSubagentTokens(agent.transcriptPath);
    return { id: agent.id, tokens };
  });
  const subagentTokenResults = await Promise.all(subagentTokenPromises);
  const subagentTokenMap = new Map(subagentTokenResults.filter(r => r.tokens).map(r => [r.id, r.tokens]));

  // Fetch git diff stats for main agents in parallel (non-blocking)
  const mainAgentsWithCwd = agentList.filter(a => a.type === 'main' && a.cwd);
  const gitDiffPromises = mainAgentsWithCwd.map(async (agent) => {
    const freshDiff = await getGitDiffStats(agent.cwd, agent.initialCommit);
    return { id: agent.id, gitDiff: freshDiff };
  });
  const gitDiffResults = await Promise.all(gitDiffPromises);
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
        }
      }

      // Add live tokens for active subagents (from transcript reading)
      if (agent.type !== 'main' && subagentTokenMap.has(agent.id)) {
        const st = subagentTokenMap.get(agent.id);
        result.tokens = st.tokens;
        result.inputTokens = st.inputTokens;
        result.outputTokens = st.outputTokens;
        // Persist back so lightweight reads also have tokens
        const current = agents.get(agent.id);
        if (current) agents.set(agent.id, { ...current, tokens: st.tokens, inputTokens: st.inputTokens, outputTokens: st.outputTokens });
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
  const key = `${event.type}|${event.sessionId || ''}|${event.toolName || ''}|${JSON.stringify(event.toolInput || {}).slice(0, 100)}`;
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

// Receive Claude.ai usage from extension
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

// Load existing data
loadEvents();
loadAgents();

// Rebuild smartStatusMap from loaded events (so MiniApp isn't empty after server restart)
for (const event of events) {
  const sid = event.sessionId;
  if (!sid) continue;
  const type = event.type;
  const tool = event.toolName;
  if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
    smartStatusMap[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: 'text-violet-400' };
  } else if (type === 'PreToolUse') {
    if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
      smartStatusMap[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: 'text-sky-400' };
    } else if (tool === 'Edit' || tool === 'Write') {
      smartStatusMap[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: 'text-orange-400' };
    } else if (tool === 'Bash') {
      smartStatusMap[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: 'text-amber-400' };
    } else if (tool === 'Task') {
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

// Periodic stats broadcast (async)
setInterval(async () => {
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
}, 5000);

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
   POST /usage      - Receive Claude.ai usage (from extension)
   GET  /usage      - Get Claude.ai usage
   GET  /health     - Health check

   Waiting for events from Claude Code hooks...
   Install Chrome extension for Claude.ai usage sync.
`);
});
