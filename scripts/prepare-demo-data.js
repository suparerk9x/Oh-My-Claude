#!/usr/bin/env node
/**
 * Prepare demo data from real events.json + transcript files.
 * Run once: node scripts/prepare-demo-data.js
 * Output: frontend/src/data/demoData.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const EVENTS_FILE = path.join(__dirname, '..', 'backend', 'events.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'frontend', 'src', 'data', 'demoData.js');

// Fields to keep per event (trim everything else from raw)
const KEEP_RAW_FIELDS = ['tool_use_id', 'tool_response', 'tool_response_summary',
  'tool_response_type', 'agent_name', 'subagent_type', 'agent_transcript_path'];

// Fields to completely remove from events
const REMOVE_TOP_FIELDS = ['receivedAt', 'source'];

// Seeded random for reproducible output generation
let seed = 42;
function seededRandom() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randInt(min, max) {
  return min + Math.floor(seededRandom() * (max - min + 1));
}

/**
 * Generate realistic tool output string for a PostToolUse event.
 * Returns null if no output should be generated.
 */
function generateToolOutput(toolName, input) {
  if (!toolName) return null;
  const inp = input || {};
  const basename = (p) => p ? p.split(/[/\\]/).pop() : null;

  switch (toolName) {
    case 'Read': {
      const file = basename(inp.file_path);
      const lines = inp.limit || randInt(50, 200);
      return file ? `[File: ${file}, ${lines} lines]` : `Read ${randInt(30, 180)} lines`;
    }
    case 'Grep': {
      if (seededRandom() < 0.12) return 'No matches found';
      const matches = randInt(1, 18);
      const files = Math.min(matches, randInt(1, 6));
      const pattern = inp.pattern ? inp.pattern.slice(0, 40) : 'pattern';
      return `Found ${matches} matches in ${files} files for /${pattern}/`;
    }
    case 'Glob': {
      const count = randInt(1, 15);
      const pattern = inp.pattern ? inp.pattern.slice(0, 50) : '*';
      return `Matched ${count} files for ${pattern}`;
    }
    case 'Edit': {
      const file = basename(inp.file_path);
      return file ? `Applied edit to ${file}` : 'Edit applied successfully';
    }
    case 'Write': {
      const file = basename(inp.file_path);
      const lines = randInt(15, 120);
      return file ? `Wrote ${lines} lines to ${file}` : `Wrote ${lines} lines`;
    }
    case 'Bash': {
      const cmd = inp.command || '';
      if (cmd.includes('npm run build') || cmd.includes('npm run dev')) return 'Build completed successfully';
      if (cmd.includes('npm install') || cmd.includes('npm i')) return 'Packages installed successfully';
      if (cmd.includes('npx')) return 'npx command completed (exit code 0)';
      if (cmd.includes('prisma')) return 'Prisma command completed successfully';
      if (cmd.includes('git ')) return 'Git operation completed';
      if (cmd.includes('sleep')) return 'Command completed';
      if (cmd.includes('wc')) return String(randInt(10, 500));
      if (cmd.includes('ls')) return `Listed ${randInt(3, 20)} items`;
      if (cmd.includes('mkdir')) return 'Directory created';
      return `Command completed (exit code 0)`;
    }
    case 'TodoWrite':
      return `Updated ${randInt(2, 6)} todos`;
    case 'SendMessage': {
      if (inp.type === 'broadcast') return 'Broadcast sent to all teammates';
      const recip = inp.recipient || 'teammate';
      return `Message sent to ${recip}`;
    }
    case 'TeamCreate': {
      const name = inp.team_name || 'team';
      return `Team '${name}' created successfully`;
    }
    case 'TeamDelete':
      return 'Team deleted';
    case 'Task': {
      const name = inp.name || inp.subagent_type || 'agent';
      return `Agent spawned: ${name}`;
    }
    case 'TaskOutput':
      return 'Task output retrieved';
    case 'EnterPlanMode':
      return 'Entered plan mode';
    case 'ExitPlanMode':
      return 'Plan approved, exited plan mode';
    case 'WebSearch':
      return `Found ${randInt(5, 20)} search results`;
    case 'WebFetch':
      return `Fetched page content (${randInt(2, 45)}KB)`;
    case 'NotebookEdit':
      return 'Notebook cell updated';
    default:
      // MCP/Playwright tools
      if (toolName.includes('navigate')) return `Navigated to page`;
      if (toolName.includes('click')) return `Clicked element`;
      if (toolName.includes('snapshot')) return 'Page snapshot captured';
      if (toolName.includes('screenshot')) return 'Screenshot saved';
      if (toolName.includes('press_key')) return `Key pressed: ${inp.key || 'Enter'}`;
      if (toolName.includes('wait_for')) return 'Wait condition met';
      if (toolName.includes('evaluate')) return 'Script evaluated';
      if (toolName.includes('type')) return 'Text entered';
      if (toolName.includes('close')) return 'Browser closed';
      if (toolName.includes('install')) return 'Browser installed';
      if (toolName.includes('console')) return 'Console messages retrieved';
      if (toolName.includes('network')) return 'Network requests captured';
      if (toolName.includes('tabs')) return 'Tab operation completed';
      if (toolName.includes('fill_form')) return 'Form fields filled';
      if (toolName.includes('select_option')) return 'Option selected';
      if (toolName.includes('hover')) return 'Hovered over element';
      if (toolName.includes('resize')) return 'Browser resized';
      if (toolName.includes('resolve-library')) return 'Library resolved';
      if (toolName.includes('query-docs')) return 'Documentation retrieved';
      return `${toolName} completed`;
  }
}

async function readTranscriptTokens(transcriptPath) {
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    let inputTokens = 0, outputTokens = 0, model = null, task = null;
    const toolsUsed = new Set();

    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath, { highWaterMark: 64 * 1024 }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        // Extract tokens from usage
        if (entry.message?.usage) {
          const u = entry.message.usage;
          inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
          outputTokens += u.output_tokens || 0;
        }
        // Extract model
        if (entry.message?.model && !model) {
          model = entry.message.model;
        }
        // Extract task from first assistant message
        if (entry.message?.role === 'assistant' && entry.message?.content && !task) {
          const text = Array.isArray(entry.message.content)
            ? entry.message.content.find(b => b.type === 'text')?.text
            : entry.message.content;
          if (text && text.length > 10) {
            task = text.slice(0, 100);
          }
        }
        // Extract tools used
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          entry.message.content.forEach(block => {
            if (block.type === 'tool_use' && block.name) {
              toolsUsed.add(block.name);
            }
          });
        }
      } catch {}
    }

    return { inputTokens, outputTokens, tokens: inputTokens + outputTokens, model, task, toolsUsed: Array.from(toolsUsed).slice(0, 8) };
  } catch {
    return null;
  }
}

async function main() {
  console.log('Reading events.json...');
  const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  const events = data.events;
  console.log(`  ${events.length} events loaded`);

  // Sort chronologically (oldest first) — events.json stores newest-first
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Collect session and agent IDs
  const sessionIds = new Set();
  const agentStopMap = {}; // agentId -> SubagentStop event data

  events.forEach(e => {
    if (e.sessionId) sessionIds.add(e.sessionId);
    if (e.type === 'SubagentStop' && e.agentId) {
      agentStopMap[e.agentId] = {
        transcriptPath: e.raw?.agent_transcript_path,
        agentType: e.agentType
      };
    }
  });

  console.log(`  Sessions: ${[...sessionIds].map(s => s.slice(0, 8)).join(', ')}`);
  console.log(`  Subagents: ${Object.keys(agentStopMap).length}`);

  // Read transcripts for subagent metadata
  console.log('\nReading subagent transcripts...');
  const agentMeta = {};
  for (const [agentId, info] of Object.entries(agentStopMap)) {
    const tp = info.transcriptPath;
    if (!tp) { console.log(`  ${agentId}: no transcript path`); continue; }
    const data = await readTranscriptTokens(tp);
    if (data) {
      agentMeta[agentId] = {
        model: data.model,
        tokens: data.tokens,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        toolsUsed: data.toolsUsed,
        description: data.task,
        agentType: info.agentType || 'subagent'
      };
      console.log(`  ${agentId}: ${data.tokens} tokens, model: ${(data.model || 'unknown').slice(-15)}, tools: ${data.toolsUsed.join(',')}`);
    } else {
      console.log(`  ${agentId}: transcript not readable`);
    }
  }

  // Also read SubagentStart events for additional metadata
  events.filter(e => e.type === 'SubagentStart').forEach(e => {
    if (e.agentId && !agentMeta[e.agentId]) {
      agentMeta[e.agentId] = { agentType: e.agentType || 'subagent' };
    } else if (e.agentId && agentMeta[e.agentId]) {
      agentMeta[e.agentId].agentType = agentMeta[e.agentId].agentType || e.agentType || 'subagent';
    }
  });

  // === INJECT TEAM EVENTS FOR REALISTIC DEMO ===
  // Real data has no TeamCreate — team members existed before the 1000-event window.
  // We inject: TeamCreate → 2x Task+SubagentStart → ... activity ... → 2x SubagentStop
  console.log('\nInjecting team events...');
  const SESSION_1 = [...sessionIds][0]; // First session (CatStay Platform)
  const TEAM_NAME = 'audit-crew';
  const TEAM_CR_ID = 'team_cr01';
  const TEAM_GP_ID = 'team_gp01';

  // Find insertion point: after ~15 events of session 1
  let insertIdx = 0;
  let s1Count = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].sessionId === SESSION_1) {
      s1Count++;
      if (s1Count >= 15) { insertIdx = i + 1; break; }
    }
  }
  const baseTs = new Date(events[insertIdx].timestamp);
  const ts = (offset) => new Date(baseTs.getTime() + offset).toISOString();
  const baseCwd = events.find(e => e.cwd)?.cwd || '/home/user/project';

  // Inject TeamCreate + 2 team member spawns
  const teamEvents = [
    { type: 'PreToolUse', toolName: 'TeamCreate', sessionId: SESSION_1,
      timestamp: ts(0), toolInput: { team_name: TEAM_NAME, description: 'Codebase security audit team' },
      cwd: baseCwd, raw: {} },
    { type: 'PostToolUse', toolName: 'TeamCreate', sessionId: SESSION_1,
      timestamp: ts(200), cwd: baseCwd, raw: {} },
    { type: 'PreToolUse', toolName: 'Task', sessionId: SESSION_1,
      timestamp: ts(500), toolInput: { team_name: TEAM_NAME, name: 'code-reviewer', subagent_type: 'code-reviewer', description: 'Review auth middleware and security' },
      cwd: baseCwd, raw: {} },
    { type: 'SubagentStart', agentId: TEAM_CR_ID, agentType: 'code-reviewer', sessionId: SESSION_1,
      timestamp: ts(800), raw: {} },
    { type: 'PreToolUse', toolName: 'Task', sessionId: SESSION_1,
      timestamp: ts(1200), toolInput: { team_name: TEAM_NAME, name: 'worker', subagent_type: 'general-purpose', description: 'Apply security fixes from audit findings' },
      cwd: baseCwd, raw: {} },
    { type: 'SubagentStart', agentId: TEAM_GP_ID, agentType: 'general-purpose', sessionId: SESSION_1,
      timestamp: ts(1500), raw: {} },
  ];
  events.splice(insertIdx, 0, ...teamEvents);
  console.log(`  Inserted ${teamEvents.length} team creation events at index ${insertIdx}`);

  // Inject SubagentStop for team members after last TeammateIdle
  let lastTIIdx = -1;
  events.forEach((e, i) => {
    if (e.type === 'TeammateIdle' && e.sessionId === SESSION_1) lastTIIdx = i;
  });
  if (lastTIIdx > 0) {
    const stopTs = new Date(events[lastTIIdx].timestamp);
    const stopEvents = [
      { type: 'SubagentStop', agentId: TEAM_GP_ID, agentType: 'general-purpose', sessionId: SESSION_1,
        timestamp: new Date(stopTs.getTime() + 2000).toISOString(), raw: {} },
      { type: 'SubagentStop', agentId: TEAM_CR_ID, agentType: 'code-reviewer', sessionId: SESSION_1,
        timestamp: new Date(stopTs.getTime() + 4000).toISOString(), raw: {} },
    ];
    events.splice(lastTIIdx + 1, 0, ...stopEvents);
    console.log(`  Inserted ${stopEvents.length} team stop events at index ${lastTIIdx + 1}`);
  }

  // Fix TeammateIdle events: assign agentId to team worker
  events.forEach(e => {
    if (e.type === 'TeammateIdle' && !e.agentId && e.sessionId === SESSION_1) {
      e.agentId = TEAM_GP_ID;
    }
  });

  // Fix existing (truncated) Task events in session 1: add team_name so spawned agents join team
  const taskAgentNames = ['reviewer-2', 'researcher', 'reviewer-3'];
  let realTaskIdx = 0;
  events.forEach(e => {
    if (e.toolName === 'Task' && e.type === 'PreToolUse' && e.sessionId === SESSION_1
        && e.toolInput && e.toolInput._truncated) {
      e.toolInput.team_name = TEAM_NAME;
      e.toolInput.name = taskAgentNames[realTaskIdx] || 'task-agent';
      realTaskIdx++;
    }
  });

  // Fix SendMessage toolInput to show proper fields (matching commTemplates)
  const sendMsgInputs = [
    { type: 'message', recipient: 'code-reviewer', summary: 'Review the authentication middleware for security vulnerabilities' },
    { type: 'broadcast', summary: 'Starting codebase audit phase — focus on input validation' },
    { type: 'message', recipient: 'team-lead', summary: 'Found 3 issues: missing CSRF, unescaped SQL params, weak JWT config' },
    { type: 'message', recipient: 'worker', summary: 'Apply fixes for the SQL injection vulnerabilities identified' },
    { type: 'message', recipient: 'team-lead', summary: 'SQL fixes applied across 4 files, ready for review' },
    { type: 'message', recipient: 'team-lead', summary: 'Second pass complete — XSS vectors patched in template renderer' },
    { type: 'broadcast', summary: 'Phase 1 audit complete, moving to performance optimization' },
    { type: 'message', recipient: 'team-lead', summary: 'Database queries optimized — N+1 queries eliminated' },
    { type: 'message', recipient: 'task-list', summary: 'Task #2 done: comprehensive error handling audit' },
    { type: 'message', recipient: 'team-lead', summary: 'Waiting for next task assignment' },
  ];
  let smIdx = 0;
  events.forEach(e => {
    if (e.toolName === 'SendMessage' && smIdx < sendMsgInputs.length) {
      e.toolInput = sendMsgInputs[smIdx];
      smIdx++;
    }
  });
  console.log(`  Fixed ${smIdx} SendMessage toolInputs`);

  // Add synthetic team member metadata
  agentMeta[TEAM_CR_ID] = {
    model: 'claude-opus-4-6', tokens: 350000, inputTokens: 300000, outputTokens: 50000,
    toolsUsed: ['Read', 'Grep', 'Glob'],
    description: 'Reviewing authentication middleware and security vulnerabilities',
    agentType: 'code-reviewer'
  };
  agentMeta[TEAM_GP_ID] = {
    model: 'claude-opus-4-6', tokens: 280000, inputTokens: 240000, outputTokens: 40000,
    toolsUsed: ['Read', 'Edit', 'Write', 'Bash'],
    description: 'Applying security fixes identified during codebase audit',
    agentType: 'general-purpose'
  };
  console.log(`  Added metadata for ${TEAM_CR_ID}, ${TEAM_GP_ID}`);

  // Build session metadata
  console.log('\nBuilding session metadata...');
  const sessionMeta = {};
  for (const sid of sessionIds) {
    const sessionEvents = events.filter(e => e.sessionId === sid);
    const models = sessionEvents.filter(e => e.model).map(e => e.model);
    const mainModel = models[0] || 'claude-opus-4-6';
    const cwds = sessionEvents.filter(e => e.cwd).map(e => e.cwd);
    const mainCwd = cwds[0] || '/home/user/project';

    // Count total tokens from transcript reading (main agents)
    let totalTokens = 0;
    sessionEvents.forEach(e => {
      totalTokens += (e.inputTokens || 0) + (e.outputTokens || 0);
    });

    sessionMeta[sid] = {
      model: mainModel,
      cwd: mainCwd,
      projectName: path.basename(mainCwd),
      totalTokens: totalTokens || 500000 // fallback estimate
    };
    console.log(`  ${sid.slice(0, 8)}: model=${mainModel.slice(-15)}, cwd=${mainCwd.slice(-30)}`);
  }

  // Pre-compute team comms from real events
  // Since SendMessage toolInput was truncated, reconstruct realistic comms
  console.log('\nPre-computing team comms...');
  const teamComms = [];
  const sendMessages = events.filter(e => e.toolName === 'SendMessage');

  // Build a mapping of agents and their types for realistic names
  const agentNames = {};
  for (const [id, meta] of Object.entries(agentMeta)) {
    const type = meta.agentType || 'subagent';
    if (type === 'code-reviewer') agentNames[id] = 'code-reviewer';
    else if (type === 'general-purpose') agentNames[id] = 'worker';
    else if (type === 'Plan') agentNames[id] = 'planner';
    else agentNames[id] = type;
  }

  // Create realistic team comms based on SendMessage events
  const commTemplates = [
    { from: 'team-lead', to: 'code-reviewer', type: 'message', summary: 'Review the authentication middleware for security vulnerabilities' },
    { from: 'team-lead', to: 'ALL', type: 'broadcast', summary: 'Starting codebase audit phase — focus on input validation' },
    { from: 'code-reviewer', to: 'team-lead', type: 'message', summary: 'Found 3 issues: missing CSRF, unescaped SQL params, weak JWT config' },
    { from: 'team-lead', to: 'worker', type: 'message', summary: 'Apply fixes for the SQL injection vulnerabilities identified' },
    { from: 'worker', to: 'team-lead', type: 'message', summary: 'SQL fixes applied across 4 files, ready for review' },
    { from: 'code-reviewer', to: 'team-lead', type: 'message', summary: 'Second pass complete — XSS vectors patched in template renderer' },
    { from: 'team-lead', to: 'ALL', type: 'broadcast', summary: 'Phase 1 audit complete, moving to performance optimization' },
    { from: 'worker', to: 'team-lead', type: 'message', summary: 'Database queries optimized — N+1 queries eliminated' },
    { from: 'code-reviewer', to: 'task-list', type: 'task_completed', summary: 'Task #2 done: comprehensive error handling audit' },
    { from: 'worker', to: 'team-lead', type: 'idle', summary: 'Waiting for next task assignment' },
  ];

  sendMessages.forEach((e, i) => {
    const template = commTemplates[i % commTemplates.length];
    teamComms.push({
      timestamp: e.timestamp,
      teamName: 'audit-crew',
      ...template
    });
  });

  // Also add TeammateIdle events as comms
  events.filter(e => e.type === 'TeammateIdle').forEach(e => {
    teamComms.push({
      timestamp: e.timestamp,
      teamName: 'audit-crew',
      from: 'worker',
      to: 'system',
      type: 'idle',
      summary: 'Teammate went idle'
    });
  });

  // Sort comms chronologically
  teamComms.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // === GENERATE TOOL OUTPUTS FOR POSTTOOLUSE EVENTS ===
  console.log('\nGenerating tool outputs for PostToolUse events...');
  seed = 42; // Reset seed for reproducibility
  let outputCount = 0;
  events.forEach(e => {
    if (e.type !== 'PostToolUse') return;
    if (e.error) return; // failed tools don't produce output
    const output = generateToolOutput(e.toolName, e.toolInput);
    if (output) {
      if (!e.raw) e.raw = {};
      e.raw.tool_response = output;
      outputCount++;
    }
  });
  console.log(`  Generated ${outputCount} tool outputs`);

  // Clean events for export
  console.log('\nCleaning events for export...');
  const cleanEvents = events.map(e => {
    const clean = { ...e };
    // Remove unnecessary top-level fields
    REMOVE_TOP_FIELDS.forEach(f => delete clean[f]);
    // Remove toolOutput (too large, not needed for display)
    delete clean.toolOutput;
    // Clean raw: keep only essential fields
    if (clean.raw) {
      const newRaw = {};
      KEEP_RAW_FIELDS.forEach(f => {
        if (clean.raw[f] !== undefined) newRaw[f] = clean.raw[f];
      });
      // Keep raw only if it has content
      clean.raw = Object.keys(newRaw).length > 0 ? newRaw : {};
    }
    return clean;
  });

  // Calculate output size
  const output = `// Auto-generated by scripts/prepare-demo-data.js — do not edit manually
// Generated: ${new Date().toISOString()}
// Source: ${events.length} events from backend/events.json

export const DEMO_EVENTS = ${JSON.stringify(cleanEvents, null, 0)};

export const DEMO_SESSION_META = ${JSON.stringify(sessionMeta, null, 2)};

export const DEMO_AGENT_META = ${JSON.stringify(agentMeta, null, 2)};

export const DEMO_TEAM_COMMS = ${JSON.stringify(teamComms, null, 0)};
`;

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, output);
  const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
  console.log(`\nWrote ${OUTPUT_FILE}`);
  console.log(`  Size: ${sizeKB} KB`);
  console.log(`  Events: ${cleanEvents.length}`);
  console.log(`  Agents: ${Object.keys(agentMeta).length}`);
  console.log(`  Sessions: ${Object.keys(sessionMeta).length}`);
  console.log(`  Team Comms: ${teamComms.length}`);
  console.log('\nDone!');
}

main().catch(console.error);
