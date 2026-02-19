import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EVENT_CONFIG } from './config/eventTypes';
import { getThemeColors } from './config/theme';
import { formatTokens, formatRelativeTime, getUsageBadge } from './utils/format';
import { TokenGauge, AgentTree, HelpGuide, ActivityItem, HourlyBreakdown, TokenStats, getEventTarget } from './components';
import { useNotifications } from './hooks/useNotifications';
import MiniApp from './MiniApp.jsx';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4824';

// Module-level constant (no need to recreate per render)
const STATUS_PRIORITY = { waiting: 8, thinking: 7, writing: 6, executing: 5, spawning: 4, searching: 3, reading: 2, processing: 1, compacting: 0, stopped: -1 };

// Extracted Clock component to avoid re-rendering entire App every second
function LiveClock({ colors }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className={`${colors.text.clock} font-mono tabular-nums`}>
      {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// Detect if running as installed PWA (standalone = no address bar)
function detectPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://')
    || !window.menubar?.visible;
}

export default function App() {
  const [isPWA, setIsPWA] = useState(detectPWA);
  const [miniMode, setMiniMode] = useState(false);

  // Re-check PWA mode when display-mode changes (e.g. after install)
  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const handler = (e) => setIsPWA(e.matches || detectPWA());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [claudeUsage, setClaudeUsage] = useState(null); // Claude.ai usage from extension (includes lastSync from backend)
  const [selectedSession, setSelectedSession] = useState(null); // null = show all
  const [selectedEventType, setSelectedEventType] = useState(null); // null = show all, 'tools' | 'success' | 'errors' | 'prompts'
  const [selectedEvent, setSelectedEvent] = useState(null); // For viewing event details
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false); // Collapse event detail panel
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [agentViewMode, setAgentViewMode] = useState(() => localStorage.getItem('agentViewMode') || 'full');
  const [isAgentsCollapsed, setIsAgentsCollapsed] = useState(() => localStorage.getItem('agentsCollapsed') === 'true');
  const [showHelp, setShowHelp] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const seenEventIds = useRef(new Set()); // Deduplicate events

  // Notification system
  const { mode, cycleMode, checkAgentChanges, getModeInfo } = useNotifications();
  const notifInfo = getModeInfo();

  // Stable ref for checkAgentChanges to avoid stale closure in WebSocket handler
  const checkAgentChangesRef = useRef(checkAgentChanges);
  useEffect(() => { checkAgentChangesRef.current = checkAgentChanges; }, [checkAgentChanges]);

  // Get theme colors from config
  const colors = getThemeColors(theme);

  // Update body class when theme changes
  useEffect(() => {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(theme);
  }, [theme]);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Toggle agent view mode: full -> compact -> expanded -> collapsed -> full
  const toggleAgentViewMode = () => {
    if (isAgentsCollapsed) {
      // collapsed -> full
      setIsAgentsCollapsed(false);
      localStorage.setItem('agentsCollapsed', 'false');
      setAgentViewMode('full');
      localStorage.setItem('agentViewMode', 'full');
    } else if (agentViewMode === 'full') {
      // full -> compact
      setAgentViewMode('compact');
      localStorage.setItem('agentViewMode', 'compact');
    } else if (agentViewMode === 'compact') {
      // compact -> expanded (agents full width, activity hidden)
      setAgentViewMode('expanded');
      localStorage.setItem('agentViewMode', 'expanded');
    } else {
      // expanded -> collapsed
      setAgentViewMode('full');
      localStorage.setItem('agentViewMode', 'full');
      setIsAgentsCollapsed(true);
      localStorage.setItem('agentsCollapsed', 'true');
    }
  };

  // WebSocket connection
  const connect = useCallback(() => {
    // Prevent duplicate connections (check both OPEN and CONNECTING states)
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      console.log('🟢 Connected to monitor server');
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('🔴 Disconnected - reconnecting in 2s...');
      reconnectRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        // Merge agents: preserve enriched fields (gitDiff, tokens) from previous state
        // when new data doesn't include them (e.g. lightweight updates)
        const mergeAgents = (incoming) => {
          setAgents(prev => {
            if (!prev.length) return incoming;
            const prevMap = new Map(prev.map(a => [a.id, a]));
            return incoming.map(a => {
              const old = prevMap.get(a.id);
              if (!old) return a;
              const merged = { ...a };
              // Preserve gitDiff if new data doesn't have it
              if (!merged.gitDiff && old.gitDiff) merged.gitDiff = old.gitDiff;
              // Preserve enriched token data if new data has less info
              if (!merged.inputTokens && old.inputTokens) {
                merged.tokens = old.tokens;
                merged.inputTokens = old.inputTokens;
                merged.outputTokens = old.outputTokens;
                merged.cacheReadTokens = old.cacheReadTokens;
              }
              return merged;
            });
          });
        };

        if (data.type === 'init') {
          // Reset seen IDs and populate with init events
          seenEventIds.current.clear();
          (data.events || []).forEach(e => e.id && seenEventIds.current.add(e.id));
          setEvents(data.events || []);
          setStats(data.stats);
          setAgents(data.agents || []);
          setSessions(data.sessions || []);
          if (data.usage) setClaudeUsage(data.usage);
        } else if (data.type === 'event') {
          // Deduplicate: skip if we've seen this event ID before
          const eventId = data.event?.id;
          if (eventId && seenEventIds.current.has(eventId)) {
            console.log('[WS] Skipping duplicate event:', eventId);
            return;
          }
          if (eventId) seenEventIds.current.add(eventId);
          // Limit seen IDs cache size
          if (seenEventIds.current.size > 200) {
            const arr = Array.from(seenEventIds.current);
            seenEventIds.current = new Set(arr.slice(-100));
          }
          setEvents(prev => [data.event, ...prev].slice(0, 100));
        } else if (data.type === 'stats') {
          setStats(data.stats);
          mergeAgents(data.agents || []);
          checkAgentChangesRef.current(data.agents || []);
          setSessions(data.sessions || []);
          if (data.usage) setClaudeUsage(data.usage);
        } else if (data.type === 'agents_update') {
          mergeAgents(data.agents || []);
          checkAgentChangesRef.current(data.agents || []);
        } else if (data.type === 'usage') {
          setClaudeUsage(data.usage);
        } else if (data.type === 'clear') {
          seenEventIds.current.clear();
          setEvents([]);
        }
      } catch (err) {
        console.error('Parse error:', err);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Demo mode - mock data for testing layout
  const demoAgents = demoMode ? [
    { id: 'main_sess-001', sessionId: 'sess-001', type: 'main', status: 'active', model: 'claude-opus-4-6', tokens: 45200, inputTokens: 38000, outputTokens: 7200, lastSeen: new Date().toISOString(), lastTask: 'Edit frontend/src/App.jsx', elapsedFormatted: '12m 34s', gitDiff: { additions: 142, deletions: 38, files: 5 } },
    { id: 'task_001', sessionId: 'sess-001', type: 'general-purpose', parentId: 'main_sess-001', status: 'active', model: 'claude-sonnet-4-5-20250929', tokens: 12800, lastSeen: new Date().toISOString(), lastTask: 'Grep searching for patterns', description: 'Search for component references across the codebase', toolsUsed: ['Grep', 'Glob', 'Read'], startedAt: new Date(Date.now() - 180000).toISOString() },
    { id: 'task_002', sessionId: 'sess-001', type: 'code-reviewer', parentId: 'main_sess-001', status: 'active', model: 'claude-opus-4-6', tokens: 8400, lastSeen: new Date().toISOString(), lastTask: 'Read src/components/AgentTree.jsx', description: 'Review code changes for quality and security', toolsUsed: ['Read', 'Grep'], startedAt: new Date(Date.now() - 120000).toISOString() },
    { id: 'task_003', sessionId: 'sess-001', type: 'bash', parentId: 'main_sess-001', status: 'stopped', model: 'claude-haiku-4-5-20251001', tokens: 3200, lastSeen: new Date(Date.now() - 300000).toISOString(), lastTask: 'Bash npm test', description: 'Run test suite', toolsUsed: ['Bash'], startedAt: new Date(Date.now() - 360000).toISOString(), stoppedAt: new Date(Date.now() - 300000).toISOString() },
    { id: 'main_sess-002', sessionId: 'sess-002', type: 'main', status: 'active', model: 'claude-sonnet-4-5-20250929', tokens: 28600, inputTokens: 24000, outputTokens: 4600, lastSeen: new Date().toISOString(), lastTask: 'Write backend/routes/api.js', elapsedFormatted: '8m 15s', gitDiff: { additions: 89, deletions: 12, files: 3 } },
    { id: 'task_004', sessionId: 'sess-002', type: 'explore', parentId: 'main_sess-002', status: 'idle', model: 'claude-haiku-4-5-20251001', tokens: 5100, lastSeen: new Date(Date.now() - 30000).toISOString(), lastTask: 'Glob **/*.test.js', description: 'Explore test file structure', toolsUsed: ['Glob', 'Read'], startedAt: new Date(Date.now() - 90000).toISOString() },
    { id: 'task_005', sessionId: 'sess-002', type: 'plan', parentId: 'main_sess-002', status: 'stopped', model: 'claude-sonnet-4-5-20250929', tokens: 6800, lastSeen: new Date(Date.now() - 600000).toISOString(), lastTask: 'Read docs/architecture.md', description: 'Plan implementation strategy for new API endpoints', toolsUsed: ['Read', 'Grep', 'Glob'], startedAt: new Date(Date.now() - 900000).toISOString(), stoppedAt: new Date(Date.now() - 600000).toISOString() },
    { id: 'main_sess-003', sessionId: 'sess-003', type: 'main', status: 'stopped', model: 'claude-opus-4-6', tokens: 67500, inputTokens: 58000, outputTokens: 9500, lastSeen: new Date(Date.now() - 1800000).toISOString(), lastTask: 'Main Session', elapsedFormatted: '25m 10s' },
    { id: 'task_006', sessionId: 'sess-003', type: 'general-purpose', parentId: 'main_sess-003', status: 'stopped', model: 'claude-sonnet-4-5-20250929', tokens: 15200, lastSeen: new Date(Date.now() - 1800000).toISOString(), lastTask: 'Edit backend/server.js', description: 'Refactor WebSocket connection handler with retry logic', toolsUsed: ['Read', 'Edit', 'Write', 'Bash'], startedAt: new Date(Date.now() - 2400000).toISOString(), stoppedAt: new Date(Date.now() - 1800000).toISOString() },
  ] : [];

  const demoEvents = demoMode ? [
    { id: 'evt-1', type: 'PreToolUse', toolName: 'Edit', timestamp: new Date(Date.now() - 5000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Edit', input: { file_path: 'frontend/src/App.jsx' } } },
    { id: 'evt-2', type: 'PostToolUse', toolName: 'Edit', timestamp: new Date(Date.now() - 8000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Edit', input: { file_path: 'frontend/src/App.jsx' } } },
    { id: 'evt-3', type: 'PreToolUse', toolName: 'Grep', timestamp: new Date(Date.now() - 12000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Grep', input: { pattern: 'ActivityFeed' } } },
    { id: 'evt-4', type: 'UserPromptSubmit', timestamp: new Date(Date.now() - 20000).toISOString(), sessionId: 'sess-001', data: { prompt: 'Fix the expanded layout for AgentTree cards' } },
    { id: 'evt-5', type: 'PostToolUse', toolName: 'Read', timestamp: new Date(Date.now() - 25000).toISOString(), sessionId: 'sess-002', data: { tool_name: 'Read', input: { file_path: 'backend/routes/api.js' } } },
    { id: 'evt-6', type: 'PreToolUse', toolName: 'Write', timestamp: new Date(Date.now() - 30000).toISOString(), sessionId: 'sess-002', data: { tool_name: 'Write', input: { file_path: 'backend/routes/api.js' } } },
    { id: 'evt-7', type: 'PreToolUse', toolName: 'Bash', timestamp: new Date(Date.now() - 45000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Bash', input: { command: 'npm test' } } },
    { id: 'evt-8', type: 'PostToolUseFailure', toolName: 'Bash', timestamp: new Date(Date.now() - 50000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Bash', input: { command: 'npm test' }, error: '2 tests failed' } },
    { id: 'evt-9', type: 'PreToolUse', toolName: 'Task', timestamp: new Date(Date.now() - 60000).toISOString(), sessionId: 'sess-001', data: { tool_name: 'Task', input: { description: 'Review code changes' } } },
    { id: 'evt-10', type: 'PostToolUse', toolName: 'Glob', timestamp: new Date(Date.now() - 75000).toISOString(), sessionId: 'sess-002', data: { tool_name: 'Glob', input: { pattern: '**/*.test.js' } } },
    { id: 'evt-11', type: 'UserPromptSubmit', timestamp: new Date(Date.now() - 90000).toISOString(), sessionId: 'sess-002', data: { prompt: 'Add new API endpoints for user management' } },
    { id: 'evt-12', type: 'PreCompact', timestamp: new Date(Date.now() - 100000).toISOString(), sessionId: 'sess-001', data: {} },
    { id: 'evt-13', type: 'Stop', timestamp: new Date(Date.now() - 1800000).toISOString(), sessionId: 'sess-003', data: { reason: 'completed' } },
  ] : [];

  const displayAgents = demoMode ? demoAgents : agents;
  const displayEvents = demoMode ? demoEvents : events;

  // Smart status: derive granular status per session from last event (memoized)
  const smartStatus = useMemo(() => {
    const map = {}; // sessionId -> { status, label, icon, color, animation, since }
    // Find the most recent event per session
    const lastEventBySession = {};
    for (const evt of displayEvents) {
      const sid = evt.sessionId;
      if (!sid) continue;
      if (!lastEventBySession[sid] || new Date(evt.timestamp) > new Date(lastEventBySession[sid].timestamp)) {
        lastEventBySession[sid] = evt;
      }
    }
    for (const [sid, evt] of Object.entries(lastEventBySession)) {
      const type = evt.type;
      const tool = evt.toolName;
      if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
        map[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: 'text-violet-400', bg: 'bg-violet-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreToolUse') {
        if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
          map[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: 'text-sky-400', bg: 'bg-sky-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'Edit' || tool === 'Write') {
          map[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: 'text-orange-400', bg: 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'Bash') {
          map[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: 'text-amber-400', bg: 'bg-amber-500/15', animation: 'animate-bounce', since: evt.timestamp };
        } else if (tool === 'Task') {
          map[sid] = { status: 'spawning', label: 'Spawning', icon: '🔀', color: 'text-violet-400', bg: 'bg-violet-500/15', animation: 'animate-spin', since: evt.timestamp };
        } else if (tool === 'WebSearch' || tool === 'WebFetch') {
          map[sid] = { status: 'searching', label: 'Searching', icon: '🌐', color: 'text-cyan-400', bg: 'bg-cyan-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else {
          map[sid] = { status: 'processing', label: 'Processing', icon: '⚙️', color: 'text-blue-400', bg: 'bg-blue-500/15', animation: 'animate-pulse', since: evt.timestamp };
        }
      } else if (type === 'PermissionRequest') {
        map[sid] = { status: 'waiting', label: 'Waiting', icon: '⏳', color: 'text-orange-400', bg: 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreCompact') {
        map[sid] = { status: 'compacting', label: 'Compacting', icon: '📦', color: 'text-slate-400', bg: 'bg-slate-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'Stop' || type === 'SessionEnd') {
        map[sid] = { status: 'stopped', label: 'Stopped', icon: '○', color: 'text-gray-500', bg: 'bg-gray-500/15', animation: '', since: evt.timestamp };
      }
    }
    return map;
  }, [displayEvents]);

  // Token percentages - ONLY from Chrome extension (claudeUsage)
  // If no extension data, show N/A (null = N/A)
  const tokens = stats?.tokens || {};
  const hasRealUsage = claudeUsage?.five_hour != null;
  // Only show Sync indicator if extension synced within last 2 minutes
  // Uses lastSync timestamp from backend (set when extension actually syncs)
  const USAGE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  const lastSyncTime = claudeUsage?.lastSync ? new Date(claudeUsage.lastSync).getTime() : 0;
  const isSyncActive = hasRealUsage && lastSyncTime && (Date.now() - lastSyncTime) < USAGE_TIMEOUT_MS;
  const sessionPct = hasRealUsage ? claudeUsage.five_hour.utilization : null;
  const weeklyPct = claudeUsage?.seven_day?.utilization ?? null;

  // Dynamic page title: smart status (priority) + count + usage% + OMC!
  useEffect(() => {
    const mainAgents = displayAgents.filter(a => a.type === 'main');
    const activeAgents = mainAgents.filter(a => ['active', 'idle', 'stale'].includes(a.status));

    let statusIcon = '';
    let statusLabel = '';
    let bestPriority = -2;
    const agentsToCheck = activeAgents.length > 0 ? activeAgents : mainAgents;
    for (const agent of agentsToCheck) {
      const smart = smartStatus[agent.sessionId];
      if (smart) {
        const p = STATUS_PRIORITY[smart.status] ?? 0;
        if (p > bestPriority) {
          bestPriority = p;
          statusIcon = smart.icon;
          statusLabel = smart.label;
        }
      }
    }
    if (!statusLabel) statusLabel = mainAgents.length > 0 ? 'Stopped' : 'Idle';

    const activeCount = activeAgents.length > 0 ? activeAgents.length : mainAgents.length;
    const countPrefix = activeCount > 1 ? `${activeCount}x ` : '';
    const badge = getUsageBadge(sessionPct);
    const pctStr = sessionPct !== null
      ? (sessionPct >= 100 ? `${badge.emoji} ${badge.label}` : `${badge.emoji}${Math.round(sessionPct)}%`)
      : '';

    const parts = [countPrefix + (statusIcon ? `${statusIcon} ${statusLabel}` : statusLabel), pctStr, 'OMC!'].filter(Boolean);
    document.title = parts.join(' \u00b7 ');
  }, [displayAgents, smartStatus, sessionPct]);

  // Session reset time - only from Chrome extension
  const getSessionResetTime = () => {
    if (!claudeUsage?.five_hour?.resets_at) return 'N/A';

    const resetTime = new Date(claudeUsage.five_hour.resets_at);
    const now = new Date();
    const diff = resetTime - now;

    if (diff > 0) {
      const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hoursLeft}h ${minutesLeft}m`;
    }
    return 'soon';
  };

  // Weekly reset time - only from Chrome extension
  const getWeeklyAllModelsReset = () => {
    if (!claudeUsage?.seven_day?.resets_at) return 'N/A';

    const resetTime = new Date(claudeUsage.seven_day.resets_at);
    const now = new Date();
    const diff = resetTime - now;

    if (diff > 0) {
      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) return `${days}d ${hours}h`;
      return `${hours}h ${minutes}m`;
    }
    return 'soon';
  };

  // Event counts
  const eventCounts = stats?.eventCounts || {};
  const totalEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);

  // Filter events by selected session and event type
  const filteredEvents = displayEvents.filter(e => {
    if (selectedSession && e.sessionId !== selectedSession) return false;
    if (selectedEventType) {
      if (selectedEventType === 'tools' && e.type !== 'PreToolUse') return false;
      if (selectedEventType === 'success' && e.type !== 'PostToolUse') return false;
      if (selectedEventType === 'errors' && e.type !== 'PostToolUseFailure') return false;
      if (selectedEventType === 'prompts' && e.type !== 'UserPromptSubmit') return false;
    }
    return true;
  });

  // PWA mini mode: render MiniApp inline with switch-back button
  if (isPWA && miniMode) {
    return (
      <MiniApp onSwitchToFull={() => {
        setMiniMode(false);
        try { window.resizeTo(765, 870); } catch {}
      }} />
    );
  }

  return (
    <div className={`h-screen w-[750px] mx-auto ${colors.bg.primary} ${colors.text.primary} flex flex-col overflow-hidden font-['Inter',system-ui,sans-serif]`}>
      {/* Top accent line - Claude coral */}
      <div className="h-0.5 bg-gradient-to-r from-[#d97757] via-[#e8956f] to-[#d97757] flex-shrink-0" />

      {/* Top Status Bar - Distinct from panels */}
      <header className={`h-10 border-b flex items-center justify-between px-1 flex-shrink-0 ${
        theme === 'light'
          ? 'bg-gradient-to-b from-white to-slate-50/80 border-slate-200/80 shadow-sm'
          : 'bg-[#0d0d14] border-[#2a2a3f]'
      }`}>
        {/* Left: Title + Live + Sync */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 -.01 39.5 39.53" xmlns="http://www.w3.org/2000/svg">
              <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="#d97757"/>
            </svg>
            <span className={colors.text.title}>Oh My Claude<span className="text-[#d97757]">!</span></span>
          </h1>
          <div className="flex items-center gap-1.5 ml-3">
            <div className={`w-2 h-2 rounded-full ${demoMode ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse' : connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
            <span className={`text-xs font-semibold ${demoMode ? 'text-amber-400' : connected ? 'text-green-500' : 'text-red-500'} uppercase tracking-wider`}>{demoMode ? 'DEMO' : connected ? 'LIVE' : 'OFF'}</span>
          </div>
          {isSyncActive ? (
            <div className={`flex items-center gap-1.5 text-xs ${colors.status.info}`} title="Synced from Claude.ai via extension">
              <svg className="w-3.5 h-3.5 animate-spin" style={{animationDuration: '20s'}} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              <span className="font-medium">Houston, We Have Sync</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-xs ${colors.status.error}`} title="Extension not syncing - enable Chrome extension on claude.ai">
              <span className="text-sm">💀</span>
              <span className="font-medium">RIP Sync</span>
            </div>
          )}
        </div>

        {/* Right: Live Clock + Theme + Guide + Status */}
        <div className="flex items-center gap-0.5">
          {/* ─── Group 1: Layout Controls ─── */}
          {/* Agent View Mode (icon + label, most complex toggle) */}
          <button
            onClick={toggleAgentViewMode}
            className={`flex items-center gap-1 px-1.5 h-7 rounded-lg ${colors.button.base} border transition-all text-[10px] ${colors.button.text}`}
            title={isAgentsCollapsed ? 'Show Agents Panel' : agentViewMode === 'full' ? 'Switch to Compact' : agentViewMode === 'compact' ? 'Switch to Expanded' : 'Hide Agents'}
          >
            {isAgentsCollapsed ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            ) : agentViewMode === 'full' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : agentViewMode === 'expanded' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
              </svg>
            )}
            <span className="font-medium">{isAgentsCollapsed ? 'Hidden' : agentViewMode === 'full' ? 'Full' : agentViewMode === 'compact' ? 'Compact' : 'Expanded'}</span>
          </button>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-1 rounded-lg ${colors.button.base} border transition-all ${colors.button.text} h-7 w-7 flex items-center justify-center`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
              </svg>
            )}
          </button>
          {/* Mini toggle (PWA) / Pop-out (browser) */}
          <button
            onClick={() => {
              if (isPWA) {
                setMiniMode(true);
                try { window.resizeTo(280, 400); } catch {}
              } else {
                window.open('/mini.html', '_blank', 'popup,width=280,height=400');
              }
            }}
            className={`p-1 rounded-lg ${colors.button.base} border transition-all ${colors.button.text} h-7 w-7 flex items-center justify-center`}
            title={isPWA ? "Switch to Mini View" : "Open Mini View (popup)"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          {/* Notification Toggle */}
          <button
            onClick={cycleMode}
            className={`p-1 rounded-lg ${colors.button.base} border transition-all ${colors.button.text} h-7 w-7 flex items-center justify-center`}
            title={`Notifications: ${notifInfo.label} (click to cycle)`}
          >
            <svg className={`w-3.5 h-3.5 ${mode === 'bell' ? 'text-amber-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* Guide */}
          <button
            onClick={() => setShowHelp(true)}
            className={`p-1 rounded-lg ${colors.button.base} border transition-all ${colors.button.text} h-7 w-7 flex items-center justify-center`}
            title="Dashboard Guide"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {/* Status Badge */}
          {(() => {
            const badge = getUsageBadge(sessionPct);
            return (
              <div className={`px-1.5 h-7 flex items-center rounded-lg text-[10px] font-semibold ${
                badge.level === 'neutral' ? colors.badge.neutral :
                badge.level === 'danger' ? colors.badge.danger :
                badge.level === 'warning' ? colors.badge.warning :
                colors.badge.normal
              }`}>
                {`${badge.emoji} ${badge.label}`}
              </div>
            );
          })()}
        </div>
      </header>

      {/* Help Guide Modal */}
      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} theme={theme} demoMode={demoMode} onDemoToggle={() => setDemoMode(d => !d)} />}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Token Stats - All token info consolidated */}
        <aside className={`w-[200px] ${colors.bg.secondary} border-r ${colors.border} flex flex-col flex-shrink-0`}>
          <div className={`h-8 min-h-[32px] px-3 flex items-center border-b ${colors.border} ${colors.sectionHeader.token} flex-shrink-0`}>
            <h2 className={`text-[11px] font-medium ${colors.accent.token} uppercase tracking-wider leading-none`}>Token Usage</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* Token Gauges */}
            <div className="space-y-2">
              <TokenGauge
                label="Session"
                pct={sessionPct}
                resetTime={getSessionResetTime()}
                resetType="rolling"
                colors={colors}
              />
              <TokenGauge
                label="Weekly"
                pct={weeklyPct}
                resetTime={getWeeklyAllModelsReset()}
                resetType="rolling"
                colors={colors}
              />
            </div>

            {/* Divider */}
            <div className={`border-t ${colors.border}`} />

            {/* Last 12 Hours Breakdown */}
            <div>
              <div className={`text-[10px] ${colors.text.muted} uppercase tracking-wider font-medium mb-1`}>Last 12 Hours</div>
              <HourlyBreakdown hourly={tokens.session_hourly || []} colors={colors} />
            </div>

            {/* Divider */}
            <div className={`border-t ${colors.border}`} />

            {/* By Model Stats */}
            <TokenStats tokens={tokens} colors={colors} />
          </div>
        </aside>

        {/* Center: Agents */}
        {!isAgentsCollapsed && (
          <aside className={`${agentViewMode === 'expanded' ? 'flex-1' : 'w-[340px] flex-shrink-0'} ${colors.bg.secondary} border-r ${colors.border} flex flex-col overflow-hidden`}>
            <div className={`h-8 min-h-[32px] px-3 flex items-center border-b ${colors.border} ${colors.sectionHeader.agents} flex-shrink-0`}>
              <h2 className={`text-[11px] font-medium ${colors.accent.agents} uppercase tracking-wider leading-none`}>
                Agents <span className={`font-mono ${colors.accent.agentsCount} normal-case`}>({displayAgents.length})</span>
              </h2>
            </div>
            <AgentTree agents={displayAgents} colors={colors} compact={agentViewMode === 'compact'} expanded={agentViewMode === 'expanded'} smartStatus={smartStatus} />
          </aside>
        )}

        {/* Right: Live Events */}
        <section className={`${isAgentsCollapsed ? 'flex-1' : 'w-[210px] flex-shrink-0'} flex flex-col overflow-hidden ${agentViewMode === 'expanded' && !isAgentsCollapsed ? 'hidden' : ''}`}>
          {/* Header - Same height as other panels */}
          <div className={`h-8 min-h-[32px] px-3 flex items-center justify-between border-b ${colors.border} ${colors.sectionHeader.activity} flex-shrink-0`}>
            <h2 className={`text-[11px] font-medium ${colors.accent.activity} uppercase tracking-wider leading-none`}>
              Activity
            </h2>
            {/* Quick Stats - Clickable Filters */}
            {(() => {
              const sessionEvents = selectedSession ? displayEvents.filter(e => e.sessionId === selectedSession) : displayEvents;
              return (
                <div className="flex items-center flex-nowrap shrink-0 gap-px text-[8px] leading-none">
                  <button onClick={() => setSelectedEventType(null)} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${!selectedEventType ? 'bg-gray-500/20 ring-1 ring-gray-500/50' : 'hover:bg-gray-500/10'}`} title="Show all">
                    <span className="font-mono text-gray-400">{sessionEvents.length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'tools' ? null : 'tools')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'tools' ? 'bg-cyan-500/20 ring-1 ring-cyan-500/50' : 'hover:bg-cyan-500/10'}`} title="Tools">
                    <span className="text-[7px]">🔧</span><span className="font-mono text-cyan-400">{sessionEvents.filter(e => e.type === 'PreToolUse').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'success' ? null : 'success')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'success' ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'hover:bg-emerald-500/10'}`} title="Success">
                    <span className="text-[7px]">✅</span><span className="font-mono text-emerald-400">{sessionEvents.filter(e => e.type === 'PostToolUse').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'errors' ? null : 'errors')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'errors' ? 'bg-red-500/20 ring-1 ring-red-500/50' : 'hover:bg-red-500/10'}`} title="Errors">
                    <span className="text-[7px]">❌</span><span className="font-mono text-red-400">{sessionEvents.filter(e => e.type === 'PostToolUseFailure').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'prompts' ? null : 'prompts')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'prompts' ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'hover:bg-amber-500/10'}`} title="Prompts">
                    <span className="text-[7px]">💬</span><span className="font-mono text-amber-400">{sessionEvents.filter(e => e.type === 'UserPromptSubmit').length}</span>
                  </button>
                </div>
              );
            })()}
          </div>
          {/* Activity Feed */}
          <div className={`flex-1 overflow-hidden ${colors.bg.secondary}`}>
            <ActivityFeed
              events={filteredEvents}
              colors={colors}
              selectedEvent={selectedEvent || filteredEvents[0]}
              onSelectEvent={setSelectedEvent}
            />
          </div>
          {/* Session Selector - Tag Style */}
          <div className={`min-h-8 max-h-20 px-2 py-1.5 flex flex-wrap-reverse items-end gap-1 border-t ${colors.border} ${colors.bg.secondary} overflow-y-auto`}>
            {/* All Sessions button */}
            <button
              onClick={() => setSelectedSession(null)}
              className={`px-2 py-0.5 text-[9px] rounded-full transition-all ${
                selectedSession === null
                  ? colors.tag.active
                  : colors.tag.inactive
              }`}
            >
              All ({sessions.length})
            </button>
            {/* Individual session buttons */}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s.id)}
                className={`px-2 py-0.5 text-[9px] font-mono rounded-full transition-all ${
                  selectedSession === s.id
                    ? colors.tag.active
                    : colors.tag.inactive
                }`}
              >
                {s.id?.slice(-8)}
              </button>
            ))}
          </div>
        </section>

      </main>

      {/* Footer: 2 Rows - Event Detail + Status Bar */}
      <footer className={`${colors.bg.footer} border-t ${colors.border} flex-shrink-0 ${theme === 'light' ? 'shadow-[0_-2px_10px_rgba(0,0,0,0.03)]' : ''}`}>
        {/* Row 1: Event Detail Panel */}
        <EventDetailPanel
          event={selectedEvent || filteredEvents[0]}
          colors={colors}
          isCollapsed={isDetailCollapsed}
          onToggleCollapse={() => setIsDetailCollapsed(!isDetailCollapsed)}
        />
        {/* Row 2: Status Bar */}
        <div className={`h-8 flex items-center justify-between px-2 text-[10px] border-t ${colors.border}`}>
          {/* Left: Events Summary */}
          <div className="flex items-center flex-nowrap shrink-0 gap-1">
            <span className={`${colors.text.muted} text-[9px] whitespace-nowrap`}>Events <span className={`font-mono ${colors.text.tertiary}`}>{totalEvents}</span></span>
            <div className="flex items-center gap-px text-[9px]">
              <button onClick={() => setSelectedEventType(selectedEventType === 'tools' ? null : 'tools')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'tools' ? 'bg-cyan-500/20 ring-1 ring-cyan-500/50' : 'hover:bg-cyan-500/10'}`} title="Tools">
                <span className="text-[7px]">🔧</span><span className="font-mono text-cyan-400">{eventCounts.PreToolUse || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'success' ? null : 'success')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'success' ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'hover:bg-emerald-500/10'}`} title="Success">
                <span className="text-[7px]">✅</span><span className="font-mono text-emerald-400">{eventCounts.PostToolUse || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'errors' ? null : 'errors')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'errors' ? 'bg-red-500/20 ring-1 ring-red-500/50' : 'hover:bg-red-500/10'}`} title="Errors">
                <span className="text-[7px]">❌</span><span className="font-mono text-red-400">{eventCounts.PostToolUseFailure || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'prompts' ? null : 'prompts')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'prompts' ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'hover:bg-amber-500/10'}`} title="Prompts">
                <span className="text-[7px]">💬</span><span className="font-mono text-amber-400">{eventCounts.UserPromptSubmit || 0}</span>
              </button>
            </div>
          </div>
          {/* Center: Spacer */}
          <div className="flex-1" />
          {/* Right: Monthly Cost + Clock */}
          <div className="flex items-center flex-nowrap shrink-0 gap-1.5 text-[9px]">
            <span className={colors.text.muted}>Month</span>
            <span className="font-mono font-bold text-emerald-400">${(tokens.month_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            <span className="flex items-center gap-0.5" title="Opus"><span className="text-violet-400">◆</span><span className="font-mono text-violet-400">${(tokens.monthModelUsage?.Opus?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
            <span className="flex items-center gap-0.5" title="Sonnet"><span className="text-blue-400">●</span><span className="font-mono text-blue-400">${(tokens.monthModelUsage?.Sonnet?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
            <span className="flex items-center gap-0.5" title="Haiku"><span className="text-emerald-400">▪</span><span className="font-mono text-emerald-400">${(tokens.monthModelUsage?.Haiku?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
            <span className={`${colors.text.muted}`}>|</span>
            <LiveClock colors={colors} />
          </div>
        </div>
      </footer>
    </div>
  );
}

// TokenGauge and AgentCard imported from ./components

// Event Detail Panel Component
function EventDetailPanel({ event, colors, isCollapsed, onToggleCollapse }) {
  if (!event) {
    return (
      <div className={`h-6 border-b ${colors.border} ${colors.eventDetail} flex items-center justify-center`}>
        <span className={`text-[10px] ${colors.text.muted} opacity-50`}>Select an event to view details</span>
      </div>
    );
  }

  const formatValue = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  // Extract additional data from raw
  const raw = event.raw || {};
  const toolUseId = raw.tool_use_id;
  const permissionMode = raw.permission_mode;
  const toolResponse = raw.tool_response;

  // Event type styling
  const typeStyles = {
    PostToolUse: { gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent', gradientSub: 'from-emerald-500/10 via-emerald-500/5 to-transparent', accent: 'bg-emerald-500', text: 'text-emerald-400', icon: '✓' },
    PreToolUse: { gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent', gradientSub: 'from-cyan-500/10 via-cyan-500/5 to-transparent', accent: 'bg-cyan-500', text: 'text-cyan-400', icon: '◈' },
    UserPromptSubmit: { gradient: 'from-amber-500/20 via-amber-500/10 to-transparent', gradientSub: 'from-amber-500/10 via-amber-500/5 to-transparent', accent: 'bg-amber-500', text: 'text-amber-400', icon: '▸' },
    Stop: { gradient: 'from-red-500/20 via-red-500/10 to-transparent', gradientSub: 'from-red-500/10 via-red-500/5 to-transparent', accent: 'bg-red-500', text: 'text-red-400', icon: '■' },
    SessionStart: { gradient: 'from-violet-500/20 via-violet-500/10 to-transparent', gradientSub: 'from-violet-500/10 via-violet-500/5 to-transparent', accent: 'bg-violet-500', text: 'text-violet-400', icon: '●' },
    SubagentStart: { gradient: 'from-blue-500/20 via-blue-500/10 to-transparent', gradientSub: 'from-blue-500/10 via-blue-500/5 to-transparent', accent: 'bg-blue-500', text: 'text-blue-400', icon: '◆' },
    SubagentStop: { gradient: 'from-orange-500/20 via-orange-500/10 to-transparent', gradientSub: 'from-orange-500/10 via-orange-500/5 to-transparent', accent: 'bg-orange-500', text: 'text-orange-400', icon: '◇' },
  };
  const style = typeStyles[event.type] || typeStyles.PreToolUse;

  // Build metadata items for single line
  const metaItems = [];
  if (event.sessionId) metaItems.push({ label: 'Session', value: event.sessionId.slice(-8), mono: true });
  if (toolUseId) metaItems.push({ label: 'Tool', value: toolUseId.slice(-8), mono: true });
  if (event.model) metaItems.push({ label: 'Model', value: event.model });
  if (event.agentType) metaItems.push({ label: 'Agent', value: event.agentType });
  if (event.cwd) metaItems.push({ label: 'Dir', value: event.cwd.split(/[/\\]/).slice(-2).join('/'), mono: true });

  // Build content rows (Input, Output, Error, etc.) - NO truncation for full copy
  const contentRows = [];
  if (event.prompt) contentRows.push({ label: 'Prompt', value: event.prompt });
  if (event.toolInput) contentRows.push({ label: 'Input', value: formatValue(event.toolInput), mono: true });
  if (toolResponse) contentRows.push({ label: 'Output', value: formatValue(toolResponse), mono: true, highlight: 'emerald' });
  if (event.error) contentRows.push({ label: 'Error', value: event.error, highlight: 'red' });
  if (event.stopReason) contentRows.push({ label: 'Reason', value: event.stopReason });

  return (
    <div className={`border-b ${colors.border} overflow-hidden`}>
      {/* Collapsed: Tab bar only */}
      {isCollapsed ? (
        <div
          className={`h-px ${colors.border.replace('border-', 'bg-')} cursor-pointer hover:brightness-110 hover:h-1 transition-all`}
          onClick={onToggleCollapse}
          title="Click to expand"
        />
      ) : (
        <>
          {/* Accent line */}
          <div className={`h-0.5 ${style.accent} opacity-80`} />

          {/* Single Line Header with all metadata */}
          <div
            className={`flex items-center gap-3 px-3 py-0.5 bg-gradient-to-r ${style.gradient} cursor-pointer hover:brightness-110 transition-all`}
            onClick={onToggleCollapse}
          >
            {/* Type indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-5 h-5 rounded ${style.accent}/20 flex items-center justify-center`}>
                <span className={`text-[10px] ${style.text}`}>{style.icon}</span>
              </div>
              <span className={`text-[10px] font-semibold ${style.text}`}>{event.type}</span>
              {event.toolName && <span className={`text-[10px] ${colors.text.muted}`}>{event.toolName}</span>}
              {permissionMode && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
                  {permissionMode}
                </span>
              )}
            </div>

            {/* Separator */}
            <div className={`w-px h-4 ${colors.border.replace('border-', 'bg-')}`} />

            {/* Metadata items inline */}
            <div className="flex items-center gap-3 flex-1 min-w-0 text-[9px]">
              {metaItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <span className={colors.text.muted}>{item.label}</span>
                  <span className={`${item.mono ? 'font-mono' : ''} ${colors.text.tertiary}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div className={`flex items-center gap-2 text-[9px] ${colors.text.muted} font-mono shrink-0`}>
              <span>{new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className={colors.text.muted}>{new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>

          {/* Content rows - click to copy */}
          <div className={`px-3 py-1 h-10 overflow-hidden bg-gradient-to-r ${style.gradientSub}`}>
            {contentRows.map((row, i) => (
              <div
                key={i}
                className={`flex gap-2 text-[9px] h-4 items-center cursor-pointer ${colors.cardHover} rounded transition-colors`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(row.value || '');
                }}
                title="Click to copy"
              >
                <span className={`${colors.text.muted} shrink-0 w-10`}>{row.label}</span>
                <span className={`${row.mono ? 'font-mono' : ''} ${row.highlight === 'emerald' ? colors.status.success : row.highlight === 'red' ? colors.status.error : colors.text.tertiary} truncate`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Activity Feed Component (Professional Design)
function ActivityFeed({ events, colors, selectedEvent, onSelectEvent }) {
  const textMuted = colors?.text?.muted || 'text-gray-400';
  const textTertiary = colors?.text?.tertiary || 'text-gray-500';

  if (events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <span className="text-3xl">📡</span>
        </div>
        <div className={`${textMuted} font-medium mb-1`}>Waiting for activity...</div>
        <div className={`text-[11px] ${textTertiary} max-w-[210px]`}>
          Events will appear here as Claude Code processes your requests
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-1.5 space-y-0.5">
        {events.map((event, i) => (
          <ActivityItem
            key={event.id || i}
            event={event}
            colors={colors}
            isSelected={selectedEvent?.id === event.id}
            onSelect={() => onSelectEvent(selectedEvent?.id === event.id ? null : event)}
          />
        ))}
      </div>
    </div>
  );
}
