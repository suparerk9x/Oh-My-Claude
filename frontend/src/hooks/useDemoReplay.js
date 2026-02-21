import { useState, useRef, useCallback, useEffect } from 'react';
import { DEMO_EVENTS, DEMO_SESSION_META, DEMO_AGENT_META, DEMO_TEAM_COMMS } from '../data/demoData';

// Timing per event type (ms)
const DELAY = {
  UserPromptSubmit: 600,
  SubagentStart: 400,
  SubagentStop: 400,
  Stop: 400,
  PermissionRequest: 300,
  PreCompact: 200,
  TeammateIdle: 250,
  _default: 80, // PreToolUse, PostToolUse
};

function getDelay(event) {
  // SendMessage/TeamCreate/Task tool calls get medium delay
  if (event.type === 'PreToolUse' && ['SendMessage', 'TeamCreate', 'TeamDelete', 'Task'].includes(event.toolName)) {
    return 250;
  }
  return DELAY[event.type] || DELAY._default;
}

// Format duration from ms
function formatDuration(ms) {
  if (!ms) return null;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return `${mins}m ${rem}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// Pre-compute events per agent for token simulation
function buildTokenSchedule() {
  const eventsPerAgent = {}; // agentId -> count of events
  const agentSessionMap = {}; // track which session each agent belongs to

  // Count events per main session (events without agentId)
  const eventsPerSession = {};
  DEMO_EVENTS.forEach(e => {
    if (e.agentId) {
      eventsPerAgent[e.agentId] = (eventsPerAgent[e.agentId] || 0) + 1;
    } else if (e.sessionId) {
      eventsPerSession[e.sessionId] = (eventsPerSession[e.sessionId] || 0) + 1;
    }
  });

  // Build tokensPerEvent for each agent
  const tokensPerEvent = {};
  for (const [agentId, meta] of Object.entries(DEMO_AGENT_META)) {
    const count = eventsPerAgent[agentId] || 1;
    tokensPerEvent[agentId] = Math.floor((meta.tokens || 100000) / count);
  }

  // Build tokensPerEvent for each main session
  const sessionTokensPerEvent = {};
  for (const [sid, meta] of Object.entries(DEMO_SESSION_META)) {
    const count = eventsPerSession[sid] || 1;
    sessionTokensPerEvent[sid] = Math.floor((meta.totalTokens || 500000) / count);
  }

  return { tokensPerEvent, sessionTokensPerEvent };
}

// Pre-compute team comms schedule: map event indices to team comm entries
function buildTeamCommsSchedule() {
  if (DEMO_TEAM_COMMS.length === 0) return [];

  // Find the first SubagentStart after TeamCreate (team members spawned)
  let teamStartIdx = -1;
  for (let i = 0; i < DEMO_EVENTS.length; i++) {
    if (DEMO_EVENTS[i].toolName === 'TeamCreate') { teamStartIdx = i; break; }
  }
  if (teamStartIdx < 0) return [];

  // Space comms evenly between team start and ~60% through the events
  const rangeEnd = Math.min(teamStartIdx + Math.floor(DEMO_EVENTS.length * 0.6), DEMO_EVENTS.length - 1);
  const spacing = Math.floor((rangeEnd - teamStartIdx) / (DEMO_TEAM_COMMS.length + 1));

  return DEMO_TEAM_COMMS.map((comm, i) => ({
    eventIdx: teamStartIdx + spacing * (i + 1),
    comm,
  }));
}

const tokenSchedule = buildTokenSchedule();
const teamCommsSchedule = buildTeamCommsSchedule();

export function useDemoReplay(demoMode) {
  const [replayState, setReplayState] = useState('idle'); // idle | playing | paused | finished
  const [progress, setProgress] = useState({ current: 0, total: DEMO_EVENTS.length, pct: 0 });
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamComms, setTeamComms] = useState([]);

  const timerRef = useRef(null);
  const stateRef = useRef({
    agentsMap: new Map(), // id -> agent object
    eventsBuffer: [],     // newest-first, max 100
    teamsMap: new Map(),
    teamCommsBuffer: [],
    currentIdx: 0,
  });

  // Cleanup when demo mode disabled
  useEffect(() => {
    if (!demoMode) {
      stop();
      resetState();
    }
  }, [demoMode]);

  function resetState() {
    stateRef.current = {
      agentsMap: new Map(),
      eventsBuffer: [],
      teamsMap: new Map(),
      teamCommsBuffer: [],
      currentIdx: 0,
    };
    setAgents([]);
    setEvents([]);
    setTeams([]);
    setTeamComms([]);
    setProgress({ current: 0, total: DEMO_EVENTS.length, pct: 0 });
  }

  // Process a single event and update state
  function processEventDemo(event, eventIdx) {
    const s = stateRef.current;
    const now = new Date().toISOString();

    // Rebase timestamp to current time
    const rebasedEvent = { ...event, timestamp: now };

    // Add to events buffer (newest-first, max 100)
    s.eventsBuffer.unshift(rebasedEvent);
    if (s.eventsBuffer.length > 100) s.eventsBuffer.pop();

    // Track/update main agent for this session
    if (event.sessionId && !event.agentId) {
      const mainId = `main_${event.sessionId}`;
      const existing = s.agentsMap.get(mainId) || {};
      const meta = DEMO_SESSION_META[event.sessionId] || {};

      // Calculate token increment for main agent
      const tokenIncrement = tokenSchedule.sessionTokensPerEvent[event.sessionId] || 500;
      const newTokens = (existing.tokens || 0) + tokenIncrement;
      const inputRatio = 0.85; // ~85% input tokens

      const updated = {
        ...existing,
        id: mainId,
        sessionId: event.sessionId,
        type: 'main',
        model: event.model || existing.model || meta.model || 'claude-opus-4-6',
        startedAt: existing.startedAt || now,
        lastSeen: now,
        status: event.type === 'Stop' ? 'stopped' : 'active',
        tokens: newTokens,
        inputTokens: Math.floor(newTokens * inputRatio),
        outputTokens: Math.floor(newTokens * (1 - inputRatio)),
        cwd: event.cwd || existing.cwd || meta.cwd,
        gitDiff: existing.gitDiff || { additions: 0, deletions: 0, files: 0 },
      };

      // Update lastTask from tool events
      if (event.type === 'PreToolUse' && event.toolName) {
        const target = getToolTarget(event);
        updated.lastTask = `${event.toolName}${target ? ` ${target}` : ''}`;
      } else if (event.type === 'UserPromptSubmit' && event.prompt) {
        updated.lastTask = event.prompt.slice(0, 60);
      }

      // Track Stop with reason
      if (event.type === 'Stop') {
        updated.stoppedAt = now;
        updated.stopReason = event.stopReason;
      }

      s.agentsMap.set(mainId, updated);

      // Simulate concurrent token growth for active team members
      // (they work in parallel but have no dedicated tool events in demo data)
      const teamToolTasks = [
        'Read auth.guard.ts', 'Grep validateToken', 'Read middleware.ts',
        'Grep cors config', 'Edit routes.ts', 'Read api/staff.ts',
        'Grep tenant isolation', 'Bash npm test', 'Read test/auth.spec.ts',
        'Glob **/*.guard.ts', 'Edit api/auth.ts', 'Read config.ts',
      ];
      for (const [id, agent] of s.agentsMap.entries()) {
        if (agent.teamName && agent.status === 'active' && id !== mainId) {
          const meta = DEMO_AGENT_META[id] || {};
          const targetTokens = meta.tokens || 200000;
          if ((agent.tokens || 0) < targetTokens) {
            const increment = Math.max(Math.floor(targetTokens / 600), 100);
            const newTokens = Math.min((agent.tokens || 0) + increment, targetTokens);
            const taskIdx = Math.floor((newTokens / targetTokens) * teamToolTasks.length) % teamToolTasks.length;
            s.agentsMap.set(id, {
              ...agent,
              tokens: newTokens,
              inputTokens: Math.floor(newTokens * 0.85),
              outputTokens: Math.floor(newTokens * 0.15),
              lastSeen: now,
              lastTask: teamToolTasks[taskIdx],
              toolsUsed: meta.toolsUsed || agent.toolsUsed || ['Read', 'Grep'],
            });
          }
        }
      }
    }

    // SubagentStart: create agent entry
    if (event.type === 'SubagentStart' && event.agentId) {
      const meta = DEMO_AGENT_META[event.agentId] || {};
      const parentId = event.parentAgentId || (event.sessionId ? `main_${event.sessionId}` : 'main');

      s.agentsMap.set(event.agentId, {
        id: event.agentId,
        type: meta.agentType || event.agentType || 'subagent',
        model: meta.model || event.model || 'claude-opus-4-6',
        sessionId: event.sessionId,
        parentId: parentId,
        startedAt: now,
        lastSeen: now,
        status: 'active',
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        description: meta.description?.slice(0, 80),
        toolsUsed: [],
        teamName: null,
        agentName: null,
      });
    }

    // SubagentStop: mark stopped with final tokens
    if (event.type === 'SubagentStop' && event.agentId) {
      const existing = s.agentsMap.get(event.agentId);
      if (existing) {
        const meta = DEMO_AGENT_META[event.agentId] || {};
        s.agentsMap.set(event.agentId, {
          ...existing,
          status: 'stopped',
          lastSeen: now,
          stoppedAt: now,
          tokens: meta.tokens || existing.tokens,
          inputTokens: meta.inputTokens || existing.inputTokens,
          outputTokens: meta.outputTokens || existing.outputTokens,
          toolsUsed: meta.toolsUsed || existing.toolsUsed,
          duration: existing.startedAt ? Date.now() - new Date(existing.startedAt).getTime() : null,
          durationFormatted: existing.startedAt ? formatDuration(Date.now() - new Date(existing.startedAt).getTime()) : null,
        });
      }
    }

    // PreToolUse/PostToolUse: update active agents
    if ((event.type === 'PreToolUse' || event.type === 'PostToolUse') && event.agentId) {
      const existing = s.agentsMap.get(event.agentId);
      if (existing && existing.status !== 'stopped') {
        const toolsSet = new Set(existing.toolsUsed || []);
        if (event.toolName) toolsSet.add(event.toolName);

        const tokenIncrement = tokenSchedule.tokensPerEvent[event.agentId] || 5000;
        const newTokens = (existing.tokens || 0) + tokenIncrement;

        s.agentsMap.set(event.agentId, {
          ...existing,
          status: 'active',
          lastSeen: now,
          toolsUsed: Array.from(toolsSet).slice(0, 8),
          tokens: newTokens,
          inputTokens: Math.floor(newTokens * 0.85),
          outputTokens: Math.floor(newTokens * 0.15),
          lastTask: event.toolName ? `${event.toolName} ${getToolTarget(event) || ''}`.trim() : existing.lastTask,
        });
      }
    }

    // TeammateIdle: mark agent idle
    if (event.type === 'TeammateIdle' && event.agentId) {
      const existing = s.agentsMap.get(event.agentId);
      if (existing) {
        s.agentsMap.set(event.agentId, { ...existing, status: 'idle', lastSeen: now });
      }
    }

    // TeamCreate tool: create team
    if (event.type === 'PreToolUse' && event.toolName === 'TeamCreate') {
      const teamName = event.toolInput?.team_name || 'demo-team';
      const mainAgentId = event.sessionId ? `main_${event.sessionId}` : null;
      s.teamsMap.set(teamName, {
        name: teamName,
        leadSessionId: event.sessionId,
        status: 'active',
        memberCount: 0,
      });
      // Mark main agent as team lead
      if (mainAgentId) {
        const main = s.agentsMap.get(mainAgentId);
        if (main) s.agentsMap.set(mainAgentId, { ...main, teamName: teamName, isTeamLead: true });
      }
    }

    // TeamDelete tool: mark team deleted
    if (event.type === 'PreToolUse' && event.toolName === 'TeamDelete') {
      for (const [name, team] of s.teamsMap.entries()) {
        if (team.leadSessionId === event.sessionId) {
          s.teamsMap.set(name, { ...team, status: 'deleted' });
          break;
        }
      }
    }

    // SendMessage tool: handled via pre-computed schedule
    // Task tool: assign team name to spawned subagent
    if (event.type === 'PreToolUse' && event.toolName === 'Task') {
      const teamName = event.toolInput?.team_name;
      const agentName = event.toolInput?.name;
      // Store for correlation with next SubagentStart
      if (!stateRef.current._pendingTask) stateRef.current._pendingTask = [];
      stateRef.current._pendingTask.push({ teamName, agentName, timestamp: now });
    }

    // Correlate SubagentStart with pending Task (for team assignment)
    if (event.type === 'SubagentStart' && event.agentId) {
      const pending = stateRef.current._pendingTask;
      if (pending && pending.length > 0) {
        const task = pending.shift();
        const agent = s.agentsMap.get(event.agentId);
        if (agent && task) {
          s.agentsMap.set(event.agentId, {
            ...agent,
            teamName: task.teamName || agent.teamName,
            agentName: task.agentName || agent.agentName,
          });
          // Add to team member count
          if (task.teamName && s.teamsMap.has(task.teamName)) {
            const team = s.teamsMap.get(task.teamName);
            s.teamsMap.set(task.teamName, { ...team, memberCount: (team.memberCount || 0) + 1 });
          }
        }
      }
    }

    // Check team comms schedule
    const commEntry = teamCommsSchedule.find(c => c.eventIdx === eventIdx);
    if (commEntry) {
      s.teamCommsBuffer.push({ ...commEntry.comm, timestamp: now });
      if (s.teamCommsBuffer.length > 50) s.teamCommsBuffer.shift();
    }

    // Update git diff gradually for main agents
    if (event.type === 'PostToolUse' && ['Write', 'Edit'].includes(event.toolName) && event.sessionId) {
      const mainId = `main_${event.sessionId}`;
      const main = s.agentsMap.get(mainId);
      if (main) {
        const diff = main.gitDiff || { additions: 0, deletions: 0, files: 0 };
        s.agentsMap.set(mainId, {
          ...main,
          gitDiff: {
            additions: diff.additions + Math.floor(Math.random() * 20 + 5),
            deletions: diff.deletions + Math.floor(Math.random() * 8),
            files: diff.files + (Math.random() > 0.7 ? 1 : 0),
          }
        });
      }
    }
  }

  // Get tool target for lastTask display
  function getToolTarget(event) {
    const ti = event.toolInput;
    if (!ti) return '';
    if (typeof ti === 'string') {
      try { return getToolTarget({ toolInput: JSON.parse(ti) }); } catch { return ''; }
    }
    if (ti.file_path) {
      const parts = ti.file_path.replace(/\\/g, '/').split('/');
      return parts.slice(-2).join('/');
    }
    if (ti.command) return ti.command.slice(0, 40);
    if (ti.pattern) return ti.pattern.slice(0, 30);
    return '';
  }

  // Flush state to React state
  function flushState() {
    const s = stateRef.current;
    setAgents(Array.from(s.agentsMap.values()));
    setEvents([...s.eventsBuffer]);
    setTeams(Array.from(s.teamsMap.values()));
    setTeamComms([...s.teamCommsBuffer]);
  }

  // Internal step function (reusable for play & resume)
  const stepRef = useRef(null);
  stepRef.current = function step() {
    const s = stateRef.current;
    const idx = s.currentIdx;
    if (idx >= DEMO_EVENTS.length) {
      setReplayState('finished');
      flushState();
      return;
    }

    const event = DEMO_EVENTS[idx];
    processEventDemo(event, idx);
    s.currentIdx = idx + 1;

    const pct = Math.round(((idx + 1) / DEMO_EVENTS.length) * 100);
    setProgress({ current: idx + 1, total: DEMO_EVENTS.length, pct });
    flushState();

    const delay = getDelay(event);
    timerRef.current = setTimeout(() => stepRef.current(), delay);
  };

  // Play from beginning
  const play = useCallback(() => {
    resetState();
    setReplayState('playing');
    stateRef.current.currentIdx = 0;
    stepRef.current();
  }, []);

  // Pause (freeze in place, keep state)
  const pause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setReplayState('paused');
  }, []);

  // Resume from paused position
  const resume = useCallback(() => {
    setReplayState('playing');
    stepRef.current();
  }, []);

  // Reset to idle (clear everything)
  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    resetState();
    setReplayState('idle');
    setProgress({ current: 0, total: DEMO_EVENTS.length, pct: 0 });
    setAgents([]);
    setEvents([]);
    setTeams([]);
    setTeamComms([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    replayState,
    progress,
    agents,
    events,
    teams,
    teamComms,
    play,
    pause,
    resume,
    reset,
  };
}
