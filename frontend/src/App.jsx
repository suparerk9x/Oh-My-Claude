import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EVENT_CONFIG } from './config/eventTypes';
import { getThemeColors } from './config/theme';
import { formatTokens, formatRelativeTime, getUsageBadge, burnSpeedPct, formatEta, rateLimitEta } from './utils/format';
import { TokenGauge, AgentTree, HelpGuide, ActivityItem, HourlyBreakdown, TokenStats, getEventTarget } from './components';
import { useNotifications } from './hooks/useNotifications';
import { useDemoReplay } from './hooks/useDemoReplay';
import MiniApp from './MiniApp.jsx';
import MediumApp from './MediumApp.jsx';

const WS_URL = import.meta.env.VITE_WS_URL ||
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

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
  const [mediumMode, setMediumMode] = useState(false);

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
  const [teams, setTeams] = useState([]);
  const [teamComms, setTeamComms] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null); // null = show all
  const [selectedEventType, setSelectedEventType] = useState(null); // null = show all, 'tools' | 'success' | 'errors' | 'prompts'
  const [selectedEvent, setSelectedEvent] = useState(null); // For viewing event details
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false); // Collapse event detail panel
  const [isTeamCommsCollapsed, setIsTeamCommsCollapsed] = useState(() => localStorage.getItem('teamCommsCollapsed') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [agentViewMode, setAgentViewMode] = useState(() => localStorage.getItem('agentViewMode') || 'full');
  const [isAgentsCollapsed, setIsAgentsCollapsed] = useState(() => localStorage.getItem('agentsCollapsed') === 'true');
  const [showHelp, setShowHelp] = useState(() => new URLSearchParams(window.location.search).has('guide'));
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem('demoMode') === 'true');
  const demo = useDemoReplay(demoMode);

  // Sync demoMode to localStorage (bidirectional with Mini Pop-out)
  useEffect(() => {
    localStorage.setItem('demoMode', demoMode ? 'true' : 'false');
  }, [demoMode]);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'demoMode') setDemoMode(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    // Poll for same-origin (PWA inline mini) changes
    const poll = setInterval(() => {
      const stored = localStorage.getItem('demoMode') === 'true';
      if (stored !== demoMode) setDemoMode(stored);
    }, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(poll); };
  }, [demoMode]);
  // Team Comms collapse: persist + auto-collapse/expand
  useEffect(() => {
    localStorage.setItem('teamCommsCollapsed', isTeamCommsCollapsed ? 'true' : 'false');
  }, [isTeamCommsCollapsed]);
  const prevTeamCommsCount = useRef(0);

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

  const clearTeamComms = () => setTeamComms([]);

  // Toggle agent view mode: full -> compact -> compact-expanded -> expanded -> collapsed -> full
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
      // compact -> compact-expanded (compact details, full width, no activity)
      setAgentViewMode('compact-expanded');
      localStorage.setItem('agentViewMode', 'compact-expanded');
    } else if (agentViewMode === 'compact-expanded') {
      // compact-expanded -> expanded (full details, full width, no activity)
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
              // Preserve context window data from full refresh
              if (merged.contextPct == null && old.contextPct != null) {
                merged.contextPct = old.contextPct;
                merged.lastInputTokens = old.lastInputTokens;
              }
              // Preserve live-pushed last message if a lightweight update lacks it
              if (merged.lastAssistantMessage == null && old.lastAssistantMessage) {
                merged.lastAssistantMessage = old.lastAssistantMessage;
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
          if (data.teams) setTeams(data.teams);
          if (data.teamComms) setTeamComms(data.teamComms);
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
          if (data.teams) setTeams(data.teams);
          if (data.teamComms) setTeamComms(data.teamComms);
        } else if (data.type === 'agents_update') {
          mergeAgents(data.agents || []);
          checkAgentChangesRef.current(data.agents || []);
        } else if (data.type === 'usage') {
          setClaudeUsage(data.usage);
        } else if (data.type === 'last-message') {
          // Live push from transcript watcher — update the matching main agent instantly (no poll wait)
          setAgents(prev => prev.map(a =>
            (a.type === 'main' && a.sessionId === data.sessionId)
              ? { ...a, ...(data.message != null ? { lastAssistantMessage: data.message } : {}), awaitingReply: !!data.awaitingReply }
              : a
          ));
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

  const displayAgents = demoMode ? demo.agents : agents;
  const displayEvents = demoMode ? demo.events : events;
  const displayTeams = demoMode ? demo.teams : teams;
  const displayTeamComms = demoMode ? demo.teamComms : teamComms;

  // Auto-collapse Team Comms when no active teams, auto-expand on new messages
  useEffect(() => {
    const hasActiveTeam = displayTeams?.some(t => t.status === 'active');
    if (!hasActiveTeam && displayTeamComms.length > 0) {
      setIsTeamCommsCollapsed(true);
    }
  }, [displayTeams]);
  useEffect(() => {
    if (displayTeamComms.length > prevTeamCommsCount.current) {
      setIsTeamCommsCollapsed(false);
    }
    prevTeamCommsCount.current = displayTeamComms.length;
  }, [displayTeamComms.length]);

  // Fixed demo data for Token Usage panel & footer
  const DEMO_TOKENS = demoMode ? {
    session_hourly: (() => {
      const now = new Date();
      const h = now.getHours();
      // offset -> { opus, sonnet, haiku } — mixed realistic pattern
      const pattern = [
        { opus: 500, sonnet: 0, haiku: 800 },         // current hour (just started)
        { opus: 12000, sonnet: 1500, haiku: 18000 },  // -1h (heavy, haiku cache)
        { opus: 8500, sonnet: 0, haiku: 0 },          // -2h (opus only)
        { opus: 6000, sonnet: 2200, haiku: 14000 },   // -3h (mixed)
        { opus: 3500, sonnet: 0, haiku: 0 },          // -4h (opus only, light)
        { opus: 0, sonnet: 0, haiku: 0 },             // -5h (break)
        { opus: 0, sonnet: 0, haiku: 0 },             // -6h
        { opus: 9000, sonnet: 0, haiku: 0 },          // -7h (opus only session)
        { opus: 5500, sonnet: 3200, haiku: 22000 },   // -8h (morning peak, haiku heavy)
        { opus: 7200, sonnet: 800, haiku: 12000 },    // -9h (mixed)
        { opus: 4000, sonnet: 0, haiku: 0 },          // -10h (opus only warm-up)
        { opus: 1500, sonnet: 0, haiku: 2000 },       // -11h (light start)
      ];
      return pattern.map((m, i) => {
        const hr = (h - i + 24) % 24;
        return { hour: hr, timeLabel: `${hr.toString().padStart(2, '0')}:00`, tokens: m.opus + m.sonnet + m.haiku, isCurrentHour: i === 0, byModel: m };
      });
    })(),
    modelUsage: {
      Opus:   { inputTokens: 458700, outputTokens: 110000, totalTokens: 568700, cacheReadTokens: 1108400000, estimatedCost: 2759.98 },
      Haiku:  { inputTokens: 231700, outputTokens: 1200, totalTokens: 232900, cacheReadTokens: 9700000, estimatedCost: 0.84 },
      Sonnet: { inputTokens: 3400, outputTokens: 208, totalTokens: 3608, cacheReadTokens: 1700000, estimatedCost: 6.13 },
    },
    month_cost: 7866.65,
    monthModelUsage: {
      Opus:   { estimatedCost: 7786 },
      Sonnet: { estimatedCost: 76 },
      Haiku:  { estimatedCost: 5 },
    },
  } : null;
  const DEMO_EVENT_COUNTS = demoMode ? { PreToolUse: 481, PostToolUse: 446, PostToolUseFailure: 0, UserPromptSubmit: 19 } : null;

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
        const tc = colors.semantic?.violet || {};
        map[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: tc.text || 'text-violet-400', bg: tc.bg || 'bg-violet-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreToolUse') {
        if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
          const tc = colors.tool?.read || {};
          map[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: tc.text || 'text-sky-400', bg: tc.bg || 'bg-sky-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'Edit' || tool === 'Write') {
          const tc = colors.tool?.edit || {};
          map[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: tc.text || 'text-orange-400', bg: tc.bg || 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'Bash') {
          const tc = colors.tool?.bash || {};
          map[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: tc.text || 'text-amber-400', bg: tc.bg || 'bg-amber-500/15', animation: 'animate-bounce', since: evt.timestamp };
        } else if (tool === 'Task') {
          const tc = colors.tool?.task || {};
          map[sid] = { status: 'spawning', label: 'Spawning', icon: '🔀', color: tc.text || 'text-violet-400', bg: tc.bg || 'bg-violet-500/15', animation: 'animate-spin', since: evt.timestamp };
        } else if (tool === 'WebSearch' || tool === 'WebFetch') {
          const tc = colors.tool?.web || {};
          map[sid] = { status: 'searching', label: 'Searching', icon: '🌐', color: tc.text || 'text-cyan-400', bg: tc.bg || 'bg-cyan-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'TeamCreate') {
          const tc = colors.tool?.team || {};
          map[sid] = { status: 'teaming', label: 'Creating Team', icon: '👥', color: tc.text || 'text-indigo-400', bg: tc.bg || 'bg-indigo-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'SendMessage') {
          const tc = colors.tool?.web || {};
          map[sid] = { status: 'messaging', label: 'Messaging', icon: '📨', color: tc.text || 'text-cyan-400', bg: tc.bg || 'bg-cyan-500/15', animation: 'animate-pulse', since: evt.timestamp };
        } else if (tool === 'TeamDelete') {
          const tc = colors.tool?.teamDel || {};
          map[sid] = { status: 'teaming', label: 'Team Cleanup', icon: '🧹', color: tc.text || 'text-gray-400', bg: tc.bg || 'bg-gray-500/15', animation: '', since: evt.timestamp };
        } else {
          const tc = colors.semantic?.blue || {};
          map[sid] = { status: 'processing', label: 'Processing', icon: '⚙️', color: tc.text || 'text-blue-400', bg: tc.bg || 'bg-blue-500/15', animation: 'animate-pulse', since: evt.timestamp };
        }
      } else if (type === 'PermissionRequest') {
        const tc = colors.semantic?.orange || {};
        map[sid] = { status: 'waiting', label: 'Waiting', icon: '⏳', color: tc.text || 'text-orange-400', bg: tc.bg || 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreCompact') {
        const tc = colors.semantic?.gray || {};
        map[sid] = { status: 'compacting', label: 'Compacting', icon: '📦', color: tc.text || 'text-slate-400', bg: tc.bg || 'bg-slate-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'Stop' || type === 'SessionEnd') {
        const tc = colors.agentStatus?.stopped || {};
        map[sid] = { status: 'stopped', label: 'Stopped', icon: '○', color: tc.text || 'text-gray-500', bg: tc.bg || 'bg-gray-500/15', animation: '', since: evt.timestamp };
      }
    }
    return map;
  }, [displayEvents, colors]);

  // Token percentages - ONLY from claudeUsage (Claude Code OAuth sync, or the fallback extension)
  // If no usage data, show N/A (null = N/A)
  const tokens = DEMO_TOKENS || (stats?.tokens || {});
  const hasRealUsage = demoMode || claudeUsage?.five_hour != null;
  // Only show Sync indicator if extension synced within last 2 minutes
  // Uses lastSync timestamp from backend (set when extension actually syncs)
  const USAGE_TIMEOUT_MS = 5 * 60 * 1000; // 2 minutes
  const lastSyncTime = claudeUsage?.lastSync ? new Date(claudeUsage.lastSync).getTime() : 0;
  const isSyncActive = hasRealUsage && lastSyncTime && (Date.now() - lastSyncTime) < USAGE_TIMEOUT_MS;
  const sessionPct = demoMode ? 30 : (hasRealUsage ? claudeUsage.five_hour.utilization : null);
  const weeklyPct = demoMode ? 17 : (claudeUsage?.seven_day?.utilization ?? null);

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

  // Session reset time - only from claudeUsage (OAuth sync or fallback extension)
  const getSessionResetTime = () => {
    if (demoMode) return '3h 8m';
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

  // Weekly reset time - only from claudeUsage (OAuth sync or fallback extension)
  const getWeeklyAllModelsReset = () => {
    if (demoMode) return '6d 1h';
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
  const eventCounts = DEMO_EVENT_COUNTS || (stats?.eventCounts || {});
  const totalEvents = demoMode ? 1000 : Object.values(eventCounts).reduce((a, b) => a + b, 0);

  // Filter events by selected session and event type
  const filteredEvents = displayEvents.filter(e => {
    if (selectedSession && e.sessionId !== selectedSession) return false;
    if (selectedEventType) {
      if (selectedEventType === 'tools' && e.type !== 'PreToolUse') return false;
      if (selectedEventType === 'success' && e.type !== 'PostToolUse') return false;
      if (selectedEventType === 'errors' && !((e.type === 'PostToolUse' && e.isError) || e.type === 'PostToolUseFailure')) return false;
      if (selectedEventType === 'prompts' && e.type !== 'UserPromptSubmit') return false;
    }
    return true;
  });

  // PWA mini mode: render MiniApp inline with switch-back button
  if (isPWA && miniMode) {
    return (
      <MiniApp onSwitchToFull={() => {
        setMiniMode(false);
        try { window.resizeTo(965, 870); } catch {}
      }} />
    );
  }

  // PWA medium mode: render MediumApp inline with switch-back button
  if (isPWA && mediumMode) {
    return (
      <MediumApp onSwitchToFull={() => {
        setMediumMode(false);
        try { window.resizeTo(965, 870); } catch {}
      }} />
    );
  }

  return (
    <div className={`h-screen w-full min-w-[950px] mx-auto ${colors.bg.primary} ${colors.text.primary} flex flex-col overflow-hidden font-['Inter',system-ui,sans-serif]`}>
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
          {demoMode && (
            <div className="flex items-center gap-px ml-2.5">
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
                @keyframes digitSpinUp {
                  0% { transform: translateY(60%); opacity: 0; }
                  60% { opacity: 1; }
                  100% { transform: translateY(0); opacity: 1; }
                }
              `}</style>
              {/* Retro tape counter */}
              <div className="flex items-center rounded-sm overflow-hidden mr-0.5" style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #0a0a0a 60%, #1a1a1a 100%)',
                border: '1px solid #555',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 0 4px rgba(100,100,100,0.3)',
                height: '20px',
              }}>
                {String(demo.progress.current).padStart(4, '0').split('').map((d, i) => (
                  <span key={`${i}_${d}`} className="inline-flex items-center justify-center" style={{
                    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                    fontSize: '14px',
                    fontWeight: 400,
                    width: '13px',
                    height: '20px',
                    lineHeight: '20px',
                    paddingTop: '2px',
                    overflow: 'hidden',
                    color: '#c8f0c8',
                    textShadow: '0 0 4px rgba(100,255,100,0.4)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.04) 100%)',
                    borderLeft: i > 0 ? '1px solid #555' : 'none',
                    animation: 'digitSpinUp 0.18s ease-out',
                  }}>{d}</span>
                ))}
              </div>
              <button
                onClick={() => {
                  if (demo.replayState === 'playing') demo.pause();
                  else if (demo.replayState === 'paused') demo.resume();
                  else demo.play();
                }}
                className="flex items-center justify-center w-5 h-5 border transition-all duration-100 active:scale-90"
                style={{
                  borderColor: demo.replayState === 'playing' ? '#facc15' : '#22c55e',
                  background: demo.replayState === 'playing'
                    ? 'rgba(250,204,21,0.15)' : 'rgba(34,197,94,0.15)',
                  boxShadow: demo.replayState === 'playing'
                    ? '0 0 4px rgba(250,204,21,0.3)' : '0 0 4px rgba(34,197,94,0.3)',
                }}
                title={demo.replayState === 'playing' ? 'Pause' : demo.replayState === 'paused' ? 'Resume' : 'Play'}
              >
                {demo.replayState === 'playing' ? (
                  <svg width="8" height="9" viewBox="0 0 10 12" fill="#facc15">
                    <rect x="1" y="0" width="3" height="12" />
                    <rect x="6" y="0" width="3" height="12" />
                  </svg>
                ) : (
                  <svg width="8" height="9" viewBox="0 0 10 12" fill="#22c55e">
                    <polygon points="0,0 10,6 0,12" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => demo.reset()}
                className="flex items-center justify-center w-5 h-5 border transition-all duration-100 active:scale-90"
                style={{
                  borderColor: '#ef4444',
                  background: 'rgba(239,68,68,0.12)',
                  boxShadow: '0 0 3px rgba(239,68,68,0.2)',
                }}
                title="Reset"
              >
                <svg width="7" height="7" viewBox="0 0 10 10" fill="#ef4444">
                  <rect x="0" y="0" width="10" height="10" />
                </svg>
              </button>
            </div>
          )}
          {!demoMode && (isSyncActive ? (
            <div className={`flex items-center gap-1.5 text-xs ${colors.status.info}`} title="Usage % synced from Claude Code (OAuth), or the optional extension">
              <svg className="w-3.5 h-3.5 animate-spin" style={{animationDuration: '20s'}} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              <span className="font-medium">Houston, We Have Sync</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-xs ${colors.status.error}`} title="No usage data - make sure Claude Code is logged in on this machine (or enable the fallback extension)">
              <span className="text-sm">💀</span>
              <span className="font-medium">RIP Sync</span>
            </div>
          ))}
        </div>

        {/* Right: Live Clock + Theme + Guide + Status */}
        <div className="flex items-center gap-0.5">
          {/* ─── Group 1: Layout Controls ─── */}
          {/* Agent View Mode (icon + label, most complex toggle) */}
          <button
            onClick={toggleAgentViewMode}
            className={`flex items-center gap-1 px-1.5 h-7 rounded-lg ${colors.button.base} border transition-all text-[10px] ${colors.button.text}`}
            title={isAgentsCollapsed ? 'Show Agents Panel' : agentViewMode === 'full' ? 'Switch to Compact' : agentViewMode === 'compact' ? 'Switch to Focus' : agentViewMode === 'compact-expanded' ? 'Switch to Expanded' : 'Hide Agents'}
          >
            {isAgentsCollapsed ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            ) : agentViewMode === 'full' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : agentViewMode === 'compact' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : agentViewMode === 'compact-expanded' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 18h16" />
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
            <span className="font-medium">{isAgentsCollapsed ? 'Hidden' : agentViewMode === 'full' ? 'Full' : agentViewMode === 'compact' ? 'Compact' : agentViewMode === 'compact-expanded' ? 'Focus' : 'Expanded'}</span>
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
          {/* Medium switch — popup (300px) even in PWA; user closes the host window manually */}
          <button
            onClick={() => {
              window.open('/medium.html', '_blank', 'popup,width=300,height=870');
            }}
            className={`p-1 rounded-lg ${colors.button.base} border transition-all ${colors.button.text} h-7 w-7 flex items-center justify-center`}
            title="Open Medium View (300px popup)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9h6M14 13h6M14 17h4" opacity={0.4} />
            </svg>
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
      {(() => {
        const f = claudeUsage?.five_hour;
        const speed = burnSpeedPct(f);
        if (!f || speed == null || speed <= 100 || f.etaMinutes == null || f.etaMinutes >= 15) return null;
        return (
          <div className="flex-shrink-0 px-3 py-1 bg-red-500/15 border-b border-red-500/30 flex items-center gap-2 text-[11px] text-red-300">
            <span className="animate-pulse">🔴</span>
            <span className="font-semibold">ใกล้ชน rate limit — Burn {speed}% · limit ETA ~{formatEta(f.etaMinutes)}</span>
          </div>
        );
      })()}

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
              {(() => {
                const f = claudeUsage?.five_hour;
                if (!f) return null;
                const speed = burnSpeedPct(f);
                if (speed == null) return (
                  <div className="-mt-1 px-1 text-[9px] font-medium text-gray-500 flex items-center gap-1" title="กำลังวัด burn rate (ต้องมี sample ~3 นาที)"><span>⏳</span><span>วัดความเร็ว…</span></div>
                );
                if (speed <= 0) return (
                  <div className="-mt-1 px-1 text-[9px] font-medium text-emerald-400/80 flex items-center gap-1" title="ตอนนี้ไม่ได้ใช้ token — utilization จะค่อยๆ ลดลงเมื่อ window เลื่อน"><span>🟢</span><span>ไม่ได้ใช้งาน</span></div>
                );
                const willHit = f.etaMinutes != null; // show ETA whenever a burn rate is measured
                const sev = speed < 100 ? 'safe' : speed < 150 ? 'warn' : 'crit';
                const c = sev === 'crit' ? 'text-red-400' : sev === 'warn' ? 'text-amber-400' : 'text-emerald-400';
                const dotBg = sev === 'crit' ? 'bg-red-400' : sev === 'warn' ? 'bg-amber-400' : 'bg-emerald-400';
                // ETA colours by *actual* risk, independent of speed: green when the window resets before the
                // limit would be hit (safe no matter how fast); amber/red only when it'll really hit first.
                const etaStatus = rateLimitEta(f)?.status;
                const etaColor = etaStatus === 'critical' ? 'text-red-400' : etaStatus === 'safe' ? 'text-emerald-400' : 'text-amber-400';
                return (
                  <div className="-mt-1 px-1 flex flex-col gap-0.5 text-[9px] font-medium leading-tight" title="Burn = ความเร็วใช้ token เทียบเพดาน 20%/ชม. (>100% = เผาเกินอัตราที่ยั่งยืน) · limit ETA = อีกนานเท่าไรจะแตะ 100% — เขียว = window reset ก่อน ไม่ชนแน่นอน">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBg} ${sev === 'crit' ? 'animate-pulse' : ''}`} />
                      <span className={c}>Burn {speed}%</span>
                    </span>
                    {willHit && <span className={`pl-2.5 whitespace-nowrap ${etaColor}`}>limit ETA ~{formatEta(f.etaMinutes)}</span>}
                  </div>
                );
              })()}
              <TokenGauge
                label="Weekly"
                pct={weeklyPct}
                resetTime={getWeeklyAllModelsReset()}
                resetType="rolling"
                colors={colors}
              />
              {claudeUsage?.seven_day_opus?.utilization != null && (
                <TokenGauge
                  label="Opus wk"
                  pct={claudeUsage.seven_day_opus.utilization}
                  resetType="rolling"
                  colors={colors}
                />
              )}
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
          <aside className={`${agentViewMode === 'expanded' || agentViewMode === 'compact-expanded' ? 'flex-1' : 'w-[500px] flex-shrink-0'} ${colors.bg.secondary} border-r ${colors.border} flex flex-col overflow-hidden`}>
            <div className={`h-8 min-h-[32px] px-3 flex items-center justify-between border-b ${colors.border} ${colors.sectionHeader.agents} flex-shrink-0`}>
              <h2 className={`text-[11px] font-medium ${colors.accent.agents} uppercase tracking-wider leading-none`}>
                Agents <span className={`font-mono ${colors.accent.agentsCount} normal-case`}>({displayAgents.length})</span>
              </h2>
              {!demoMode && displayAgents.some(a => a.status === 'stopped' || a.status === 'timeout') && (
                <button
                  onClick={() => fetch('/api/agents/stopped', { method: 'DELETE' })}
                  className={`text-[9px] px-1.5 py-0.5 rounded ${colors.text.muted} opacity-40 hover:opacity-100 ${colors.semantic?.red?.bgHover || 'hover:bg-red-500/20'} hover:${colors.status?.error || 'text-red-400'} transition-all`}
                  title="Remove stopped agents"
                >Clear Stopped</button>
              )}
            </div>
            <AgentTree agents={displayAgents} colors={colors} compact={agentViewMode === 'compact' || agentViewMode === 'compact-expanded'} expanded={agentViewMode === 'expanded' || agentViewMode === 'compact-expanded'} smartStatus={smartStatus} teams={displayTeams} />
          </aside>
        )}

        {/* Right: Live Events */}
        <section className={`${isAgentsCollapsed ? 'flex-1' : 'min-w-[250px] flex-1'} flex flex-col overflow-hidden ${(agentViewMode === 'expanded' || agentViewMode === 'compact-expanded') && !isAgentsCollapsed ? 'hidden' : ''}`}>
          {/* Header - Same height as other panels */}
          <div className={`h-8 min-h-[32px] px-3 flex items-center justify-between border-b ${colors.border} ${colors.sectionHeader.activity} flex-shrink-0`}>
            <h2 className={`text-[11px] font-medium ${colors.accent.activity} uppercase tracking-wider leading-none`}>
              Activity Feed
            </h2>
            {/* Quick Stats - Clickable Filters */}
            {(() => {
              const sessionEvents = selectedSession ? displayEvents.filter(e => e.sessionId === selectedSession) : displayEvents;
              return (
                <div className="flex items-center flex-nowrap shrink-0 gap-px text-[8px] leading-none">
                  <button onClick={() => setSelectedEventType(null)} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${!selectedEventType ? `${colors.semantic?.gray?.bg || 'bg-gray-500/20'} ring-1 ${colors.semantic?.gray?.ring || 'ring-gray-500/50'}` : (colors.semantic?.gray?.bgHover || 'hover:bg-gray-500/10')}`} title="Show all">
                    <span className={`font-mono ${colors.semantic?.gray?.text || 'text-gray-400'}`}>{sessionEvents.length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'tools' ? null : 'tools')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'tools' ? `${colors.semantic?.cyan?.bg || 'bg-cyan-500/20'} ring-1 ${colors.semantic?.cyan?.ring || 'ring-cyan-500/50'}` : (colors.semantic?.cyan?.bgHover || 'hover:bg-cyan-500/10')}`} title="Tools">
                    <span className="text-[7px]">🔧</span><span className={`font-mono ${colors.semantic?.cyan?.text || 'text-cyan-400'}`}>{sessionEvents.filter(e => e.type === 'PreToolUse').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'success' ? null : 'success')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'success' ? `${colors.semantic?.emerald?.bg || 'bg-emerald-500/20'} ring-1 ${colors.semantic?.emerald?.ring || 'ring-emerald-500/50'}` : (colors.semantic?.emerald?.bgHover || 'hover:bg-emerald-500/10')}`} title="Success">
                    <span className="text-[7px]">✅</span><span className={`font-mono ${colors.semantic?.emerald?.text || 'text-emerald-400'}`}>{sessionEvents.filter(e => e.type === 'PostToolUse').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'errors' ? null : 'errors')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'errors' ? `${colors.semantic?.red?.bg || 'bg-red-500/20'} ring-1 ${colors.semantic?.red?.ring || 'ring-red-500/50'}` : (colors.semantic?.red?.bgHover || 'hover:bg-red-500/10')}`} title="Errors">
                    <span className="text-[7px]">❌</span><span className={`font-mono ${colors.semantic?.red?.text || 'text-red-400'}`}>{sessionEvents.filter(e => (e.type === 'PostToolUse' && e.isError) || e.type === 'PostToolUseFailure').length}</span>
                  </button>
                  <button onClick={() => setSelectedEventType(selectedEventType === 'prompts' ? null : 'prompts')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'prompts' ? `${colors.semantic?.amber?.bg || 'bg-amber-500/20'} ring-1 ${colors.semantic?.amber?.ring || 'ring-amber-500/50'}` : (colors.semantic?.amber?.bgHover || 'hover:bg-amber-500/10')}`} title="Prompts">
                    <span className="text-[7px]">💬</span><span className={`font-mono ${colors.semantic?.amber?.text || 'text-amber-400'}`}>{sessionEvents.filter(e => e.type === 'UserPromptSubmit').length}</span>
                  </button>
                </div>
              );
            })()}
          </div>
          {/* Team Comms Timeline */}
          {displayTeamComms.length > 0 && (
            <div className={`group border-b ${colors.border} ${colors.bg.secondary}`}>
              {/* Header Row - clickable to toggle */}
              <div
                className={`px-2 py-1 flex items-center gap-1 cursor-pointer select-none ${colors.cardHover}`}
                onClick={() => setIsTeamCommsCollapsed(!isTeamCommsCollapsed)}
              >
                <svg className={`w-3 h-3 ${colors.text.muted} transition-transform ${isTeamCommsCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[9px]">📨</span>
                <span className={`text-[9px] font-medium ${colors.semantic?.indigo?.text || 'text-indigo-400'} uppercase tracking-wider`}>Team Comms</span>
                <span className={`text-[8px] font-mono ${colors.text.muted}`}>({displayTeamComms.length})</span>
                <div className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); clearTeamComms(); }}
                  className={`p-0.5 rounded ${colors.text.muted} opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all`}
                  title="Clear team comms"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Collapsible content */}
              {!isTeamCommsCollapsed && (
                <div className="max-h-[200px] overflow-y-auto px-1 pb-1 space-y-0.5">
                  {displayTeamComms.slice(0, 30).map((comm, i) => {
                    const ct = colors.commType || {};
                    return (
                      <div key={i} className="flex items-center gap-1.5 px-1 py-0.5 text-[11px]">
                        <span className={`font-mono ${colors.text.muted} shrink-0 w-[38px]`}>
                          {new Date(comm.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`font-medium ${ct.message || 'text-cyan-400'} shrink-0`}>{comm.from}</span>
                        <span className={colors.text.muted}>→</span>
                        <span className={`font-medium ${ct[comm.type] || ct.fallback || 'text-gray-400'} shrink-0`}>{comm.to}</span>
                        <span className={`${colors.text.muted} truncate flex-1 min-w-0`}>{comm.summary}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Activity Feed */}
          <div className={`flex-1 overflow-hidden ${colors.bg.secondary}`}>
            <ActivityFeed
              events={filteredEvents}
              colors={colors}
              selectedEvent={selectedEvent || (filteredEvents.length > 0 ? filteredEvents[0] : null)}
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
          event={selectedEvent || (filteredEvents.length > 0 ? filteredEvents[0] : null)}
          colors={colors}
          isCollapsed={isDetailCollapsed}
          onToggleCollapse={() => setIsDetailCollapsed(!isDetailCollapsed)}
        />
        {/* Row 2: Status Bar */}
        <div className={`h-5 flex items-center justify-between px-2 text-[10px] border-t ${colors.border}`}>
          {/* Left: Events Summary */}
          <div className="flex items-center flex-nowrap shrink-0 gap-1">
            <span className={`${colors.text.muted} text-[9px] whitespace-nowrap`}>Events <span className={`font-mono ${colors.text.tertiary}`}>{totalEvents}</span></span>
            <div className="flex items-center gap-px text-[9px]">
              <button onClick={() => setSelectedEventType(selectedEventType === 'tools' ? null : 'tools')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'tools' ? `${colors.semantic?.cyan?.bg || 'bg-cyan-500/20'} ring-1 ${colors.semantic?.cyan?.ring || 'ring-cyan-500/50'}` : (colors.semantic?.cyan?.bgHover || 'hover:bg-cyan-500/10')}`} title="Tools">
                <span className="text-[7px]">🔧</span><span className={`font-mono ${colors.semantic?.cyan?.text || 'text-cyan-400'}`}>{eventCounts.PreToolUse || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'success' ? null : 'success')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'success' ? `${colors.semantic?.emerald?.bg || 'bg-emerald-500/20'} ring-1 ${colors.semantic?.emerald?.ring || 'ring-emerald-500/50'}` : (colors.semantic?.emerald?.bgHover || 'hover:bg-emerald-500/10')}`} title="Success">
                <span className="text-[7px]">✅</span><span className={`font-mono ${colors.semantic?.emerald?.text || 'text-emerald-400'}`}>{eventCounts.PostToolUse || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'errors' ? null : 'errors')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'errors' ? `${colors.semantic?.red?.bg || 'bg-red-500/20'} ring-1 ${colors.semantic?.red?.ring || 'ring-red-500/50'}` : (colors.semantic?.red?.bgHover || 'hover:bg-red-500/10')}`} title="Errors">
                <span className="text-[7px]">❌</span><span className={`font-mono ${colors.semantic?.red?.text || 'text-red-400'}`}>{displayEvents.filter(e => (e.type === 'PostToolUse' && e.isError) || e.type === 'PostToolUseFailure').length || 0}</span>
              </button>
              <button onClick={() => setSelectedEventType(selectedEventType === 'prompts' ? null : 'prompts')} className={`px-0.5 py-0.5 rounded transition-all whitespace-nowrap ${selectedEventType === 'prompts' ? `${colors.semantic?.amber?.bg || 'bg-amber-500/20'} ring-1 ${colors.semantic?.amber?.ring || 'ring-amber-500/50'}` : (colors.semantic?.amber?.bgHover || 'hover:bg-amber-500/10')}`} title="Prompts">
                <span className="text-[7px]">💬</span><span className={`font-mono ${colors.semantic?.amber?.text || 'text-amber-400'}`}>{eventCounts.UserPromptSubmit || 0}</span>
              </button>
            </div>
          </div>
          {/* Center: Spacer */}
          <div className="flex-1" />
          {/* Right: Monthly Cost + Clock */}
          <div className="flex items-center flex-nowrap shrink-0 gap-1.5 text-[9px]">
            <span className={colors.text.muted}>Month</span>
            <span className={`font-mono font-bold ${colors.status.success}`}>${(tokens.month_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            <span className="flex items-center gap-0.5" title="Opus"><span className={colors.model?.opus?.text || 'text-violet-400'}>◆</span><span className={`font-mono ${colors.model?.opus?.text || 'text-violet-400'}`}>${(tokens.monthModelUsage?.Opus?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
            <span className="flex items-center gap-0.5" title="Sonnet"><span className={colors.model?.sonnet?.text || 'text-blue-400'}>●</span><span className={`font-mono ${colors.model?.sonnet?.text || 'text-blue-400'}`}>${(tokens.monthModelUsage?.Sonnet?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
            <span className="flex items-center gap-0.5" title="Haiku"><span className={colors.model?.haiku?.text || 'text-emerald-400'}>▪</span><span className={`font-mono ${colors.model?.haiku?.text || 'text-emerald-400'}`}>${(tokens.monthModelUsage?.Haiku?.estimatedCost || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</span></span>
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

  // Event type styling (theme-aware text)
  const sm = colors.semantic || {};
  const typeStyles = {
    PostToolUse: { gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent', gradientSub: 'from-emerald-500/10 via-emerald-500/5 to-transparent', accent: 'bg-emerald-500', text: sm.emerald?.text || 'text-emerald-400', icon: '✓' },
    PreToolUse: { gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent', gradientSub: 'from-cyan-500/10 via-cyan-500/5 to-transparent', accent: 'bg-cyan-500', text: sm.cyan?.text || 'text-cyan-400', icon: '◈' },
    UserPromptSubmit: { gradient: 'from-amber-500/20 via-amber-500/10 to-transparent', gradientSub: 'from-amber-500/10 via-amber-500/5 to-transparent', accent: 'bg-amber-500', text: sm.amber?.text || 'text-amber-400', icon: '▸' },
    Stop: { gradient: 'from-red-500/20 via-red-500/10 to-transparent', gradientSub: 'from-red-500/10 via-red-500/5 to-transparent', accent: 'bg-red-500', text: sm.red?.text || 'text-red-400', icon: '■' },
    SessionStart: { gradient: 'from-violet-500/20 via-violet-500/10 to-transparent', gradientSub: 'from-violet-500/10 via-violet-500/5 to-transparent', accent: 'bg-violet-500', text: sm.violet?.text || 'text-violet-400', icon: '●' },
    SubagentStart: { gradient: 'from-blue-500/20 via-blue-500/10 to-transparent', gradientSub: 'from-blue-500/10 via-blue-500/5 to-transparent', accent: 'bg-blue-500', text: sm.blue?.text || 'text-blue-400', icon: '◆' },
    SubagentStop: { gradient: 'from-orange-500/20 via-orange-500/10 to-transparent', gradientSub: 'from-orange-500/10 via-orange-500/5 to-transparent', accent: 'bg-orange-500', text: sm.orange?.text || 'text-orange-400', icon: '◇' },
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
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${colors.model?.opus?.bg || 'bg-violet-500/15'} ${colors.model?.opus?.text || 'text-violet-400'} border ${colors.border}`}>
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
