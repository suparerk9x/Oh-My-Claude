import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getThemeColors } from './config/theme';
import { formatTokens, getUsageBadge } from './utils/format';
import { useDemoReplay } from './hooks/useDemoReplay';
import { useNotifications } from './hooks/useNotifications';
import { AgentTree } from './components/AgentTree';
import { ActivityItem } from './components/ActivityItem';
import { TokenGauge } from './components/TokenGauge';
import { HelpGuide } from './components';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4824';
const STATUS_PRIORITY = { waiting: 8, thinking: 7, writing: 6, executing: 5, spawning: 4, searching: 3, reading: 2, processing: 1, compacting: 0, stopped: -1 };

export default function MediumApp({ onSwitchToFull }) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([]);
  const [claudeUsage, setClaudeUsage] = useState(null);
  // smartStatus is now computed from displayEvents via useMemo (like App.jsx)
  const [teams, setTeams] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem('demoMode') === 'true');
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [agentViewMode, setAgentViewMode] = useState(() => localStorage.getItem('agentViewMode') || 'full');
  const [clock, setClock] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const demo = useDemoReplay(demoMode);
  const { mode, cycleMode, checkAgentChanges, getModeInfo } = useNotifications();
  const notifInfo = getModeInfo();
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const colors = getThemeColors(theme);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Sync theme + demoMode from localStorage
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme' && e.newValue) setTheme(e.newValue);
      if (e.key === 'demoMode') setDemoMode(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    const poll = setInterval(() => {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme && storedTheme !== theme) setTheme(storedTheme);
      const storedDemo = localStorage.getItem('demoMode') === 'true';
      if (storedDemo !== demoMode) setDemoMode(storedDemo);
      const storedView = localStorage.getItem('agentViewMode');
      if (storedView && storedView !== agentViewMode) setAgentViewMode(storedView);
    }, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(poll); };
  }, [theme, demoMode]);

  useEffect(() => { localStorage.setItem('demoMode', demoMode ? 'true' : 'false'); }, [demoMode]);
  useEffect(() => { document.body.classList.remove('dark', 'light'); document.body.classList.add(theme); }, [theme]);

  // WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); reconnectRef.current = setTimeout(connect, 2000); };
    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const mergeAgents = (incoming) => {
          setAgents(prev => {
            if (!prev.length) return incoming;
            const prevMap = new Map(prev.map(a => [a.id, a]));
            return incoming.map(a => {
              const old = prevMap.get(a.id);
              if (!old) return a;
              const merged = { ...a };
              if (!merged.gitDiff && old.gitDiff) merged.gitDiff = old.gitDiff;
              if (!merged.inputTokens && old.inputTokens) {
                merged.tokens = old.tokens;
                merged.inputTokens = old.inputTokens;
                merged.outputTokens = old.outputTokens;
                merged.cacheReadTokens = old.cacheReadTokens;
              }
              if (merged.contextPct == null && old.contextPct != null) {
                merged.contextPct = old.contextPct;
                merged.lastInputTokens = old.lastInputTokens;
              }
              return merged;
            });
          });
        };
        if (data.type === 'init') {
          setStats(data.stats);
          setAgents(data.agents || []);
          setEvents(data.events || []);
          if (data.usage) setClaudeUsage(data.usage);
          if (data.teams) setTeams(data.teams);
        } else if (data.type === 'stats') {
          setStats(data.stats);
          mergeAgents(data.agents || []);
          if (data.usage) setClaudeUsage(data.usage);
          if (data.teams) setTeams(data.teams);
        } else if (data.type === 'agents_update') {
          mergeAgents(data.agents || []);
        } else if (data.type === 'event') {
          if (data.event) {
            setEvents(prev => [data.event, ...prev].slice(0, 500));
          }
        } else if (data.type === 'usage') {
          setClaudeUsage(data.usage);
        } else if (data.type === 'clear') {
          setEvents([]);
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnectRef.current); wsRef.current?.close(); };
  }, [connect]);

  // Demo overrides
  const displayAgents = demoMode ? demo.agents : agents;
  const displayEvents = demoMode ? demo.events : events;
  const displayTeams = demoMode ? demo.teams : teams;

  // Compute smartStatus from displayEvents (same logic as App.jsx)
  const displaySmartStatus = useMemo(() => {
    const map = {};
    const lastBySession = {};
    for (const evt of displayEvents) {
      const sid = evt.sessionId;
      if (!sid) continue;
      if (!lastBySession[sid] || new Date(evt.timestamp) > new Date(lastBySession[sid].timestamp)) {
        lastBySession[sid] = evt;
      }
    }
    for (const [sid, evt] of Object.entries(lastBySession)) {
      const type = evt.type;
      const tool = evt.toolName;
      if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
        map[sid] = { status: 'thinking', label: 'Thinking', icon: '🧠', color: colors.semantic?.violet?.text || 'text-violet-400', bg: colors.semantic?.violet?.bg || 'bg-violet-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreToolUse') {
        if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') map[sid] = { status: 'reading', label: 'Reading', icon: '👁', color: colors.tool?.read?.text || 'text-sky-400', bg: colors.tool?.read?.bg || 'bg-sky-500/15', animation: 'animate-pulse', since: evt.timestamp };
        else if (tool === 'Edit' || tool === 'Write') map[sid] = { status: 'writing', label: 'Writing', icon: '✍️', color: colors.tool?.edit?.text || 'text-orange-400', bg: colors.tool?.edit?.bg || 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
        else if (tool === 'Bash') map[sid] = { status: 'executing', label: 'Executing', icon: '⚡', color: colors.tool?.bash?.text || 'text-amber-400', bg: colors.tool?.bash?.bg || 'bg-amber-500/15', animation: 'animate-bounce', since: evt.timestamp };
        else if (tool === 'Task' || tool === 'Agent') map[sid] = { status: 'spawning', label: 'Spawning', icon: '🔀', color: colors.tool?.task?.text || 'text-violet-400', bg: colors.tool?.task?.bg || 'bg-violet-500/15', animation: 'animate-spin', since: evt.timestamp };
        else if (tool === 'WebSearch' || tool === 'WebFetch') map[sid] = { status: 'searching', label: 'Searching', icon: '🌐', color: colors.tool?.web?.text || 'text-cyan-400', bg: colors.tool?.web?.bg || 'bg-cyan-500/15', animation: 'animate-pulse', since: evt.timestamp };
        else if (tool === 'TeamCreate') map[sid] = { status: 'teaming', label: 'Creating Team', icon: '👥', color: colors.tool?.team?.text || 'text-indigo-400', bg: colors.tool?.team?.bg || 'bg-indigo-500/15', animation: 'animate-pulse', since: evt.timestamp };
        else if (tool === 'SendMessage') map[sid] = { status: 'messaging', label: 'Messaging', icon: '📨', color: colors.tool?.web?.text || 'text-cyan-400', bg: colors.tool?.web?.bg || 'bg-cyan-500/15', animation: 'animate-pulse', since: evt.timestamp };
        else if (tool === 'TeamDelete') map[sid] = { status: 'teaming', label: 'Team Cleanup', icon: '🧹', color: colors.tool?.teamDel?.text || 'text-gray-400', bg: colors.tool?.teamDel?.bg || 'bg-gray-500/15', animation: '', since: evt.timestamp };
        else map[sid] = { status: 'processing', label: 'Processing', icon: '⚙️', color: colors.semantic?.blue?.text || 'text-blue-400', bg: colors.semantic?.blue?.bg || 'bg-blue-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PermissionRequest') {
        map[sid] = { status: 'waiting', label: 'Waiting', icon: '⏳', color: colors.semantic?.orange?.text || 'text-orange-400', bg: colors.semantic?.orange?.bg || 'bg-orange-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'PreCompact') {
        map[sid] = { status: 'compacting', label: 'Compacting', icon: '📦', color: colors.semantic?.gray?.text || 'text-slate-400', bg: colors.semantic?.gray?.bg || 'bg-slate-500/15', animation: 'animate-pulse', since: evt.timestamp };
      } else if (type === 'Stop' || type === 'SessionEnd') {
        map[sid] = { status: 'stopped', label: 'Stopped', icon: '○', color: colors.agentStatus?.stopped?.text || 'text-gray-500', bg: colors.agentStatus?.stopped?.bg || 'bg-gray-500/15', animation: '', since: evt.timestamp };
      }
    }
    return map;
  }, [displayEvents, colors]);

  // Usage
  const hasRealUsage = demoMode || claudeUsage?.five_hour != null;
  const USAGE_TIMEOUT_MS = 2 * 60 * 1000;
  const lastSyncTime = claudeUsage?.lastSync ? new Date(claudeUsage.lastSync).getTime() : 0;
  const isSyncActive = hasRealUsage && lastSyncTime && (Date.now() - lastSyncTime) < USAGE_TIMEOUT_MS;
  const sessionPct = demoMode ? 30 : (hasRealUsage ? claudeUsage.five_hour.utilization : null);
  const weeklyPct = demoMode ? 17 : (claudeUsage?.seven_day?.utilization ?? null);

  const getSessionResetTime = () => {
    if (demoMode) return '3h 8m';
    if (!claudeUsage?.five_hour?.resets_at) return null;
    const diff = new Date(claudeUsage.five_hour.resets_at) - new Date();
    if (diff > 0) { const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); return `${h}h ${m}m`; }
    return 'soon';
  };
  const getWeeklyResetTime = () => {
    if (demoMode) return '6d 1h';
    if (!claudeUsage?.seven_day?.resets_at) return null;
    const diff = new Date(claudeUsage.seven_day.resets_at) - new Date();
    if (diff > 0) { const totalH = Math.floor(diff / 3600000); const d = Math.floor(totalH / 24); const h = totalH % 24; const m = Math.floor((diff % 3600000) / 60000); return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`; }
    return 'soon';
  };

  // Round up to the next 10-minute mark (e.g. 14:23 → 14:30, 14:31 → 14:40, 14:59 → 15:00)
  const roundUpToTenMinutes = (d) => {
    const m = d.getMinutes();
    if (d.getSeconds() > 0 || d.getMilliseconds() > 0 || m % 10 !== 0) {
      d.setMinutes(Math.floor(m / 10) * 10 + 10, 0, 0);
    }
    return d;
  };

  const formatResetAt = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = roundUpToTenMinutes(new Date(isoStr));
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  };
  const sessionResetAt = demoMode ? '17:00' : formatResetAt(claudeUsage?.five_hour?.resets_at);
  const weeklyResetAt = demoMode ? 'Sat 15:00' : (() => {
    if (!claudeUsage?.seven_day?.resets_at) return null;
    try {
      const d = roundUpToTenMinutes(new Date(claudeUsage.seven_day.resets_at));
      const diff = d - new Date();
      const days = Math.floor(diff / 86400000);
      if (days > 0) return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  })();

  // Page title
  useEffect(() => {
    const mainAgents = displayAgents.filter(a => a.type === 'main');
    const activeAgents = mainAgents.filter(a => ['active', 'idle', 'stale'].includes(a.status));
    let statusLabel = '';
    let statusIcon = '';
    let best = -2;
    for (const agent of (activeAgents.length > 0 ? activeAgents : mainAgents)) {
      const s = displaySmartStatus[agent.sessionId];
      if (s && (STATUS_PRIORITY[s.status] ?? 0) > best) { best = STATUS_PRIORITY[s.status] ?? 0; statusIcon = s.icon; statusLabel = s.label; }
    }
    if (!statusLabel) statusLabel = demoMode ? 'DEMO' : (mainAgents.length > 0 ? 'Stopped' : 'Idle');
    const cnt = (activeAgents.length || mainAgents.length);
    const badge = getUsageBadge(sessionPct);
    const pctStr = sessionPct !== null ? (sessionPct >= 100 ? `${badge.emoji} ${badge.label}` : `${badge.emoji}${Math.round(sessionPct)}%`) : '';
    document.title = [(cnt > 1 ? `${cnt}x ` : '') + (statusIcon ? `${statusIcon} ${statusLabel}` : statusLabel), pctStr, 'OMC!'].filter(Boolean).join(' \u00b7 ');
  }, [displayAgents, displaySmartStatus, sessionPct, demoMode]);

  // Sessions list for filter tags
  const sessions = useMemo(() => {
    const map = {};
    displayAgents.forEach(a => {
      const sid = a.type === 'main' ? a.sessionId : (a.parentId?.startsWith('main_') ? a.parentId.replace('main_', '') : a.sessionId) || 'unknown';
      if (!map[sid]) map[sid] = { id: sid, main: null };
      if (a.type === 'main') map[sid].main = a;
    });
    return Object.values(map).sort((a, b) => {
      const at = a.main?.startedAt ? new Date(a.main.startedAt).getTime() : 0;
      const bt = b.main?.startedAt ? new Date(b.main.startedAt).getTime() : 0;
      return at - bt;
    });
  }, [displayAgents]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return displayEvents.filter(e => {
      if (selectedSession && e.sessionId !== selectedSession) return false;
      if (selectedEventType) {
        if (selectedEventType === 'tools' && e.type !== 'PreToolUse') return false;
        if (selectedEventType === 'success' && e.type !== 'PostToolUse') return false;
        if (selectedEventType === 'errors' && !((e.type === 'PostToolUse' && e.isError) || e.type === 'PostToolUseFailure')) return false;
        if (selectedEventType === 'prompts' && e.type !== 'UserPromptSubmit') return false;
      }
      return true;
    });
  }, [displayEvents, selectedSession, selectedEventType]);

  // Counts
  const tokens = stats?.tokens || {};
  const monthCost = demoMode ? 7866.65 : (tokens.month_cost || 0);
  const eventCounts = stats?.eventCounts || {};
  const totalEvents = demoMode ? 1000 : Object.values(eventCounts).reduce((a, b) => a + b, 0);

  return (
    <div className={`h-screen w-full ${colors.bg.primary} ${colors.text.primary} flex flex-col overflow-hidden font-['Inter',system-ui,sans-serif]`}>
      {/* Accent line */}
      <div className="h-0.5 bg-gradient-to-r from-[#d97757] via-[#e8956f] to-[#d97757] flex-shrink-0" />

      {/* Header */}
      <div className={`h-7 flex items-center justify-between px-2 border-b ${colors.border} ${colors.bg.header} flex-shrink-0`}>
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 -.01 39.5 39.53" xmlns="http://www.w3.org/2000/svg">
            <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="#d97757"/>
          </svg>
          <span className={`text-[12px] font-bold ${colors.text.title}`}>OMC<span className="text-[#d97757]">!</span></span>
          <div className={`w-1.5 h-1.5 rounded-full ${demoMode ? 'bg-amber-400 animate-pulse' : connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {demoMode ? (
            <span className={`text-[8px] font-bold ${colors.status.warning} uppercase tracking-wider`}>DEMO</span>
          ) : isSyncActive ? (
            <svg className={`w-2.5 h-2.5 ${colors.status.info} animate-spin`} style={{ animationDuration: '20s' }} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          ) : (
            <span className={`text-[8px] ${colors.status.error}`} title="Extension not syncing">💀</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const modes = ['compact', 'full'];
              const next = modes[(modes.indexOf(agentViewMode) + 1) % modes.length] || 'compact';
              setAgentViewMode(next);
              localStorage.setItem('agentViewMode', next);
            }}
            className={`flex items-center gap-0.5 px-1 h-5 rounded ${colors.button.base} border transition-all text-[8px] ${colors.button.text}`}
            title={agentViewMode === 'compact' ? 'Switch to Full' : 'Switch to Compact'}
          >
            {agentViewMode === 'compact' ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 18h16" />
              </svg>
            )}
            <span className="font-medium">{agentViewMode === 'compact' ? 'Compact' : 'Full'}</span>
          </button>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-0.5 rounded ${colors.button.text} ${colors.cardHover} transition-colors h-5 w-5 flex items-center justify-center`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
              </svg>
            )}
          </button>
          {/* Popup Medium (300px narrow window) — close the host window manually after */}
          <button
            onClick={() => {
              window.open('/medium.html', '_blank', 'popup,width=300,height=870');
            }}
            className={`p-0.5 rounded ${colors.button.text} ${colors.cardHover} transition-colors h-5 w-5 flex items-center justify-center`}
            title="Pop out as 300px narrow window"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h10a1 1 0 011 1v14a1 1 0 01-1 1h-4M4 8h10a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (onSwitchToFull) {
                onSwitchToFull();
              } else {
                try { window.resizeTo(965, 870); } catch {}
                window.location.href = '/full.html';
              }
            }}
            className={`p-0.5 rounded ${colors.button.text} ${colors.cardHover} transition-colors`}
            title="Switch to Full Dashboard"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          {/* Notification Toggle */}
          <button
            onClick={cycleMode}
            className={`p-0.5 rounded ${colors.button.text} ${colors.cardHover} transition-colors h-5 w-5 flex items-center justify-center`}
            title={`Notifications: ${notifInfo.label} (click to cycle)`}
          >
            <svg className={`w-3 h-3 ${mode === 'bell' ? 'text-amber-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* Guide — open in full view */}
          <button
            onClick={() => window.open('/full.html?guide=1', '_blank', 'popup,width=965,height=870')}
            className={`p-0.5 rounded ${colors.button.text} ${colors.cardHover} transition-colors h-5 w-5 flex items-center justify-center`}
            title="Open Guide (Full View)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {(() => {
            const badge = getUsageBadge(sessionPct);
            return (
              <div className={`px-1 h-5 flex items-center rounded text-[8px] font-semibold ${
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
      </div>

      {/* Token Gauges Row */}
      <div className={`grid grid-cols-2 gap-4 px-3 py-2 border-b ${colors.border} ${colors.bg.secondary} flex-shrink-0`}>
        <TokenGauge label="Session" pct={sessionPct} resetTime={getSessionResetTime()} resetAt={sessionResetAt} resetType="rolling" colors={colors} />
        <TokenGauge label="Weekly" pct={weeklyPct} resetTime={getWeeklyResetTime()} resetAt={weeklyResetAt} resetType="rolling" colors={colors} />
      </div>

      {/* Agents Panel — 75% */}
      <div className={`flex-[3] min-h-0 flex flex-col border-b ${colors.border}`}>
        {(() => {
          const activeMainCount = displayAgents.filter(a => a.type === 'main' && a.status === 'active').length;
          const activeTaskCount = displayAgents.filter(a => a.type !== 'main' && a.status === 'active').length;
          const stoppedTaskCount = displayAgents.filter(a => a.type !== 'main' && (a.status === 'stopped' || a.status === 'timeout')).length;
          const totalTokens = displayAgents.reduce((sum, a) => sum + (a.tokens || (a.inputTokens || 0) + (a.outputTokens || 0) || 0), 0);
          return (
            <div className={`h-6 min-h-[24px] px-2 flex items-center justify-between border-b ${colors.border} ${colors.sectionHeader?.agents || 'bg-gradient-to-r from-violet-500/[0.08] via-purple-500/[0.05] to-transparent'} flex-shrink-0`}>
              <div className="flex items-center gap-2 text-[10px]">
                <h2 className={`font-medium ${colors.accent?.agents || 'text-violet-400'} uppercase tracking-wider leading-none`}>
                  Agents <span className={`font-mono ${colors.accent?.agentsCount || 'text-violet-300/60'} normal-case`}>({displayAgents.length})</span>
                </h2>
                <span className={`w-1.5 h-1.5 rounded-full ${activeMainCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className={activeMainCount > 0 ? 'text-emerald-400' : 'text-gray-500'}>
                  {activeMainCount} session{activeMainCount !== 1 ? 's' : ''}
                </span>
                {(activeTaskCount > 0 || stoppedTaskCount > 0) && (
                  <span className="text-gray-500">
                    {activeTaskCount > 0 && <span className="text-emerald-400">{activeTaskCount} running</span>}
                    {activeTaskCount > 0 && stoppedTaskCount > 0 && ' · '}
                    {stoppedTaskCount > 0 && <span className="text-gray-500">{stoppedTaskCount} done</span>}
                  </span>
                )}
                {totalTokens > 0 && (
                  <span className="font-mono tabular-nums text-amber-500">{formatTokens(totalTokens)}</span>
                )}
              </div>
              {!demoMode && displayAgents.some(a => a.status === 'stopped' || a.status === 'timeout') && (
                <button
                  onClick={() => fetch('http://localhost:4824/agents/stopped', { method: 'DELETE' })}
                  className={`text-[8px] px-1 py-0.5 rounded ${colors.text.muted} opacity-40 hover:opacity-100 ${colors.semantic?.red?.bgHover || 'hover:bg-red-500/20'} hover:${colors.status?.error || 'text-red-400'} transition-all`}
                  title="Remove stopped agents"
                >Clear Stopped</button>
              )}
            </div>
          );
        })()}
        <div className="flex-1 overflow-y-auto">
        <AgentTree
          agents={displayAgents}
          colors={colors}
          compact={agentViewMode === 'compact'}
          expanded={false}
          smartStatus={displaySmartStatus}
          teams={displayTeams}
          hideFooter={true}
        />
        </div>
      </div>

      {/* Activity Feed — 25% */}
      <div className="flex-[1] min-h-0 flex flex-col">
        {/* Filter bar */}
        <div className={`flex items-center gap-1 px-1.5 py-1 border-b ${colors.border} ${colors.sectionHeader?.activity || 'bg-gradient-to-r from-cyan-500/[0.08] via-sky-500/[0.05] to-transparent'} flex-shrink-0 overflow-x-auto`}>
          <h2 className={`text-[10px] font-medium ${colors.accent?.activity || 'text-cyan-400'} uppercase tracking-wider leading-none shrink-0`}>
            Activity Feed
          </h2>
          <div className="flex-1" />
          <button onClick={() => { setSelectedSession(null); setSelectedEventType(null); }}
            className={`px-1.5 py-0.5 text-[8px] rounded-full transition-all shrink-0 ${!selectedSession && !selectedEventType ? colors.tag.active : colors.tag.inactive}`}>
            All
          </button>
          <div className={`w-px h-3 ${colors.border.replace('border-', 'bg-')}`} />
          {[
            { key: 'tools', icon: '🔧', color: 'cyan' },
            { key: 'success', icon: '✅', color: 'emerald' },
            { key: 'errors', icon: '❌', color: 'red' },
            { key: 'prompts', icon: '💬', color: 'amber' },
          ].map(f => (
            <button key={f.key} onClick={() => setSelectedEventType(selectedEventType === f.key ? null : f.key)}
              className={`px-1 py-0.5 text-[8px] rounded transition-all shrink-0 ${selectedEventType === f.key ? `${colors.semantic?.[f.color]?.bg || `bg-${f.color}-500/20`} ring-1 ${colors.semantic?.[f.color]?.ring || `ring-${f.color}-500/50`}` : (colors.semantic?.[f.color]?.bgHover || `hover:bg-${f.color}-500/10`)}`}>
              <span className="text-[7px]">{f.icon}</span>
            </button>
          ))}
          {sessions.length > 1 && (
            <>
              <div className={`w-px h-3 ${colors.border.replace('border-', 'bg-')}`} />
              {sessions.map(s => (
                <button key={s.id} onClick={() => setSelectedSession(selectedSession === s.id ? null : s.id)}
                  className={`px-1.5 py-0.5 text-[7px] font-mono rounded-full transition-all shrink-0 ${selectedSession === s.id ? colors.tag.active : colors.tag.inactive}`}>
                  {s.id?.slice(-6)}
                </button>
              ))}
            </>
          )}
        </div>
        {/* Event list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className={`flex items-center justify-center h-full text-[10px] ${colors.text.muted}`}>Waiting for events...</div>
          ) : (
            <div className="p-1 space-y-0.5">
              {filteredEvents.map((event, i) => (
                <ActivityItem key={event.id || i} event={event} colors={colors} isSelected={false} onSelect={() => {}} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`h-5 flex items-center justify-between px-2 text-[9px] border-t ${colors.border} ${colors.bg.footer} flex-shrink-0`}>
        {/* Left: Events + type counts */}
        <div className="flex items-center flex-nowrap shrink-0 gap-1">
          <span className={`${colors.text.muted} whitespace-nowrap`}>Events <span className={`font-mono ${colors.text.tertiary}`}>{totalEvents}</span></span>
          <div className="flex items-center gap-px">
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
        <div className="flex-1" />
        {/* Right: Monthly Cost (hover for breakdown) + Clock */}
        <div className="flex items-center flex-nowrap shrink-0 gap-1.5">
          <span className="relative group cursor-default">
            <span className={`font-mono font-bold ${colors.status.success}`}>${monthCost.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
            <span className={`absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col gap-1 px-2.5 py-2 rounded-lg shadow-xl border ${colors.border} ${colors.bg.header} text-[10px] whitespace-nowrap z-50`}>
              <span className={`font-mono font-bold text-[12px] ${colors.status.success} border-b ${colors.border} pb-1 mb-0.5`}>${monthCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}<span className={`text-[8px] ${colors.text.muted} ml-1 font-normal`}>this month</span></span>
              <span className="flex items-center gap-1.5"><span className={colors.model?.opus?.text || 'text-violet-400'}>◆</span><span className={colors.text.muted}>Opus</span><span className={`font-mono ml-auto ${colors.model?.opus?.text || 'text-violet-400'}`}>${(tokens.monthModelUsage?.Opus?.estimatedCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
              <span className="flex items-center gap-1.5"><span className={colors.model?.sonnet?.text || 'text-blue-400'}>●</span><span className={colors.text.muted}>Sonnet</span><span className={`font-mono ml-auto ${colors.model?.sonnet?.text || 'text-blue-400'}`}>${(tokens.monthModelUsage?.Sonnet?.estimatedCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
              <span className="flex items-center gap-1.5"><span className={colors.model?.haiku?.text || 'text-emerald-400'}>▪</span><span className={colors.text.muted}>Haiku</span><span className={`font-mono ml-auto ${colors.model?.haiku?.text || 'text-emerald-400'}`}>${(tokens.monthModelUsage?.Haiku?.estimatedCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
            </span>
          </span>
          <span className={colors.text.muted}>|</span>
          <span className={`font-mono ${colors.text.clock}`}>{clock}</span>
        </div>
      </div>

      {/* Help Guide Modal */}
      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} theme={theme} demoMode={demoMode} onDemoToggle={() => setDemoMode(d => !d)} />}
    </div>
  );
}
