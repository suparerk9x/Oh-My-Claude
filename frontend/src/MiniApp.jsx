import { useState, useEffect, useRef, useCallback } from 'react';
import { getThemeColors } from './config/theme';
import { formatTokens, getUsageBadge } from './utils/format';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4824';

// Module-level constant (no need to recreate per render)
const STATUS_PRIORITY = { waiting: 8, thinking: 7, writing: 6, executing: 5, spawning: 4, searching: 3, reading: 2, processing: 1, compacting: 0, stopped: -1 };

// Extracted outside MiniApp to prevent re-creation every render
function GaugeBar({ label, pct, resetTime, isSession = false, colors }) {
  const isNA = pct === null;
  const displayPct = isNA ? 0 : pct;

  const redThreshold = isSession ? 85 : 90;
  const yellowThreshold = isSession ? 60 : 75;

  // Session: traffic light colors, Weekly: neutral gray
  const pctColor = isNA ? colors.text.muted : isSession
    ? (pct >= redThreshold ? 'text-red-500' : pct >= yellowThreshold ? 'text-yellow-500' : 'text-green-500')
    : 'text-gray-400';

  // Session: gradient bar, Weekly: solid gray
  const progressBarClass = isNA ? 'bg-gray-600' : isSession
    ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'
    : 'bg-gray-400';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`text-[9px] ${colors.text.muted}`}>{label}</span>
          {resetTime && <span className={`text-[8px] ${colors.text.muted} opacity-60`}>Resets in {resetTime}</span>}
        </div>
        <span className={`text-[9px] font-mono font-bold ${pctColor}`}>
          {isNA ? 'N/A' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className={`h-1.5 rounded-full ${colors.progressBg} overflow-hidden relative`}>
        <div className={`absolute inset-0 ${progressBarClass} rounded-full`} />
        <div
          className={`absolute inset-0 ${colors.progressBg} rounded-r-full transition-all duration-500 ease-out`}
          style={{ left: `${Math.min(displayPct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function MiniApp({ onSwitchToFull }) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [claudeUsage, setClaudeUsage] = useState(null);
  const [smartStatus, setSmartStatus] = useState({});
  const [teams, setTeams] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const colors = getThemeColors(theme);

  // Sync theme from localStorage (when main app changes it)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'theme' && e.newValue) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    // Also poll localStorage for same-origin changes
    const poll = setInterval(() => {
      const stored = localStorage.getItem('theme');
      if (stored && stored !== theme) setTheme(stored);
    }, 1000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(poll);
    };
  }, [theme]);

  // Update body class
  useEffect(() => {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(theme);
  }, [theme]);

  // WebSocket connection (same protocol as App.jsx)
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Merge agents: preserve enriched fields from previous state
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
              return merged;
            });
          });
        };
        if (data.type === 'init') {
          setStats(data.stats);
          setAgents(data.agents || []);
          if (data.usage) setClaudeUsage(data.usage);
          if (data.smartStatus) setSmartStatus(data.smartStatus);
          if (data.teams) setTeams(data.teams);
        } else if (data.type === 'stats') {
          setStats(data.stats);
          mergeAgents(data.agents || []);
          if (data.usage) setClaudeUsage(data.usage);
          if (data.smartStatus) setSmartStatus(data.smartStatus);
          if (data.teams) setTeams(data.teams);
        } else if (data.type === 'agents_update') {
          mergeAgents(data.agents || []);
        } else if (data.type === 'event' && data.event?.sessionId) {
          // Live update smart status from individual events
          const evt = data.event;
          const sid = evt.sessionId;
          const type = evt.type;
          const tool = evt.toolName;
          setSmartStatus(prev => {
            const next = { ...prev };
            if (type === 'UserPromptSubmit' || type === 'PostToolUse') {
              next[sid] = { status: 'thinking', label: 'Thinking', icon: '\u{1F9E0}', color: 'text-violet-400' };
            } else if (type === 'PreToolUse') {
              if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') {
                next[sid] = { status: 'reading', label: 'Reading', icon: '\u{1F441}', color: 'text-sky-400' };
              } else if (tool === 'Edit' || tool === 'Write') {
                next[sid] = { status: 'writing', label: 'Writing', icon: '\u270D\uFE0F', color: 'text-orange-400' };
              } else if (tool === 'Bash') {
                next[sid] = { status: 'executing', label: 'Executing', icon: '\u26A1', color: 'text-amber-400' };
              } else if (tool === 'Task') {
                next[sid] = { status: 'spawning', label: 'Spawning', icon: '\u{1F500}', color: 'text-violet-400' };
              } else if (tool === 'WebSearch' || tool === 'WebFetch') {
                next[sid] = { status: 'searching', label: 'Searching', icon: '\u{1F310}', color: 'text-cyan-400' };
              } else if (tool === 'TeamCreate') {
                next[sid] = { status: 'teaming', label: 'Creating Team', icon: '\u{1F465}', color: 'text-indigo-400' };
              } else if (tool === 'SendMessage') {
                next[sid] = { status: 'messaging', label: 'Messaging', icon: '\u{1F4E8}', color: 'text-cyan-400' };
              } else if (tool === 'TeamDelete') {
                next[sid] = { status: 'teaming', label: 'Team Cleanup', icon: '\u{1F9F9}', color: 'text-gray-400' };
              } else {
                next[sid] = { status: 'processing', label: 'Processing', icon: '\u2699\uFE0F', color: 'text-blue-400' };
              }
            } else if (type === 'PermissionRequest') {
              next[sid] = { status: 'waiting', label: 'Waiting', icon: '\u23F3', color: 'text-orange-400' };
            } else if (type === 'PreCompact') {
              next[sid] = { status: 'compacting', label: 'Compacting', icon: '\u{1F4E6}', color: 'text-slate-400' };
            } else if (type === 'Stop' || type === 'SessionEnd') {
              next[sid] = { status: 'stopped', label: 'Stopped', icon: '\u25CB', color: 'text-gray-500' };
            }
            return next;
          });
        } else if (data.type === 'usage') {
          setClaudeUsage(data.usage);
        }
      } catch (err) {
        // ignore parse errors
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

  // Session usage from Chrome extension
  const hasRealUsage = claudeUsage?.five_hour != null;
  const USAGE_TIMEOUT_MS = 2 * 60 * 1000;
  const lastSyncTime = claudeUsage?.lastSync ? new Date(claudeUsage.lastSync).getTime() : 0;
  const isSyncActive = hasRealUsage && lastSyncTime && (Date.now() - lastSyncTime) < USAGE_TIMEOUT_MS;
  const sessionPct = hasRealUsage ? claudeUsage.five_hour.utilization : null;
  const weeklyPct = claudeUsage?.seven_day?.utilization ?? null;

  // Dynamic page title: smart status (priority) + count + usage% + OMC!
  useEffect(() => {
    const mainAgents = agents.filter(a => a.type === 'main');
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
  }, [agents, smartStatus, sessionPct]);

  // Monthly cost
  const tokens = stats?.tokens || {};
  const monthCost = tokens.month_cost || 0;

  // Agent summary
  const activeMainCount = agents.filter(a => a.type === 'main' && a.status === 'active').length;
  const activeTaskCount = agents.filter(a => a.type !== 'main' && a.status === 'active').length;
  const totalAgents = agents.length;

  // Model helper
  const getModel = (model) => {
    const v = model?.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
    const ver = v ? ` ${v[1]}.${v[2]}` : '';
    if (model?.includes('opus')) return { name: `Opus${ver}`, base: 'Opus', short: 'Op', color: 'text-violet-400', bg: 'bg-violet-500/20' };
    if (model?.includes('sonnet')) return { name: `Sonnet${ver}`, base: 'Sonnet', short: 'So', color: 'text-sky-400', bg: 'bg-sky-500/20' };
    if (model?.includes('haiku')) return { name: `Haiku${ver}`, base: 'Haiku', short: 'Ha', color: 'text-teal-400', bg: 'bg-teal-500/20' };
    return { name: '??', base: '??', short: '??', color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  // Status helper - matches AgentTree.jsx getStatus()
  const getStatus = (status) => {
    switch (status) {
      case 'active': case 'running':
        return { icon: '●', color: 'text-emerald-400', pulse: true, label: 'Active', dot: 'bg-emerald-400 animate-pulse' };
      case 'idle':
        return { icon: '●', color: 'text-yellow-400', pulse: false, label: 'Idle', dot: 'bg-yellow-400' };
      case 'stale':
        return { icon: '●', color: 'text-orange-400', pulse: false, label: 'Stale', dot: 'bg-orange-400' };
      case 'timeout':
        return { icon: '●', color: 'text-amber-400', pulse: true, label: 'Timeout', dot: 'bg-amber-400 animate-pulse' };
      case 'stopped':
        return { icon: '○', color: 'text-gray-500', pulse: false, label: 'Stopped', dot: 'bg-gray-500' };
      default:
        return { icon: '○', color: 'text-gray-600', pulse: false, label: 'Unknown', dot: 'bg-gray-500' };
    }
  };

  // Gauge bar component
  const getSessionResetTime = () => {
    if (!claudeUsage?.five_hour?.resets_at) return null;
    const diff = new Date(claudeUsage.five_hour.resets_at) - new Date();
    if (diff > 0) {
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${h}h ${m}m`;
    }
    return 'soon';
  };

  const getWeeklyResetTime = () => {
    if (!claudeUsage?.seven_day?.resets_at) return null;
    const diff = new Date(claudeUsage.seven_day.resets_at) - new Date();
    if (diff > 0) {
      const totalH = Math.floor(diff / (1000 * 60 * 60));
      const d = Math.floor(totalH / 24);
      const h = totalH % 24;
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (d > 0) return `${d}d ${h}h`;
      return `${h}h ${m}m`;
    }
    return 'soon';
  };

  // Group agents by session
  const sessionMap = {};
  agents.forEach(agent => {
    const sid = agent.type === 'main' ? agent.sessionId :
      (agent.parentId?.startsWith('main_') ? agent.parentId.replace('main_', '') : agent.sessionId) || 'unknown';
    if (!sessionMap[sid]) sessionMap[sid] = { main: null, tasks: [] };
    if (agent.type === 'main') sessionMap[sid].main = agent;
    else sessionMap[sid].tasks.push(agent);
  });

  // Assign fixed numbers by creation order (startedAt)
  const sessionsByCreation = Object.entries(sessionMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      const aTime = a.main?.startedAt ? new Date(a.main.startedAt).getTime() : 0;
      const bTime = b.main?.startedAt ? new Date(b.main.startedAt).getTime() : 0;
      return aTime - bTime;
    });
  const sessionNumber = {};
  sessionsByCreation.forEach((s, i) => { sessionNumber[s.id] = i + 1; });

  // Build team lookup: sessionId -> team info
  const teamBySession = {};
  (teams || []).forEach(team => {
    if (team.leadSessionId) teamBySession[team.leadSessionId] = team;
  });

  // Sort for display: active first
  const sessions = sessionsByCreation.slice().sort((a, b) => {
    const aActive = ['active', 'idle', 'stale'].includes(a.main?.status) || a.tasks.some(t => ['active', 'idle', 'stale'].includes(t.status));
    const bActive = ['active', 'idle', 'stale'].includes(b.main?.status) || b.tasks.some(t => ['active', 'idle', 'stale'].includes(t.status));
    if (aActive !== bActive) return bActive - aActive;
    return 0;
  });

  return (
    <div className={`h-screen w-full ${colors.bg.primary} ${colors.text.primary} flex flex-col overflow-hidden font-['Inter',system-ui,sans-serif]`}>
      {/* Accent line */}
      <div className="h-0.5 bg-gradient-to-r from-[#d97757] via-[#e8956f] to-[#d97757] flex-shrink-0" />

      {/* Header */}
      <div className={`h-7 flex items-center justify-between px-1 border-b ${colors.border} ${colors.bg.header} flex-shrink-0`}>
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 -.01 39.5 39.53" xmlns="http://www.w3.org/2000/svg">
            <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="#d97757"/>
          </svg>
          <span className={`text-[12px] font-bold ${colors.text.title}`}>Oh My Claude<span className="text-[#d97757]">!</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isSyncActive ? (
            <svg className="w-3 h-3 text-sky-400 animate-spin" style={{ animationDuration: '20s' }} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" title="Extension syncing">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          ) : (
            <span className="text-[8px] text-red-400" title="Extension not syncing">💀</span>
          )}
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
          {onSwitchToFull && (
            <button
              onClick={onSwitchToFull}
              className={`p-0.5 rounded ${colors.button.text} hover:bg-white/10 transition-colors`}
              title="Switch to Full Dashboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Session Gauge */}
      <div className={`px-2 pt-1.5 pb-3 border-b ${colors.border} ${colors.bg.secondary}`}>
        <GaugeBar label="Session" pct={sessionPct} isSession={true} resetTime={getSessionResetTime()} colors={colors} />
        <div className="mt-1">
          <GaugeBar label="Weekly" pct={weeklyPct} resetTime={getWeeklyResetTime()} colors={colors} />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto mt-1.5">
        {sessions.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-[10px] ${colors.text.muted}`}>
            No sessions
          </div>
        ) : (
          sessions.map(({ id: sid, main, tasks }) => {
            const isActive = ['active', 'idle', 'stale'].includes(main?.status) || tasks.some(t => ['active', 'idle', 'stale'].includes(t.status));
            const model = main ? getModel(main.model) : getModel(null);
            const sessionTokens = (main?.tokens || 0) + tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);
            const smart = smartStatus[sid];
            const mainStatus = getStatus(main?.status);
            const projectName = main?.cwd?.split(/[\\/]/).pop() || '';
            const teamInfo = teamBySession[sid];

            return (
              <div key={sid} className={`border-b ${colors.border} ${isActive ? 'bg-emerald-500/[0.03]' : 'opacity-50'}`}>
                {/* Main agent row */}
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
                  <span className="text-[12px] font-mono font-bold text-white shrink-0 w-[16px] text-right">{sessionNumber[sid]}.</span>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${model.color} ${model.bg} shrink-0`}>
                    {model.name}
                  </span>
                  {smart && (isActive || smart.status === 'stopped') ? (
                    <>
                      <span className={`text-[13px] shrink-0 ${smart.status !== 'stopped' ? 'animate-pulse' : ''}`}>{smart.icon}</span>
                      <span className={`text-[12px] font-medium ${smart.color}`}>{smart.label}</span>
                    </>
                  ) : (
                    <>
                      <span className={`text-[12px] shrink-0 ${mainStatus.color} ${mainStatus.pulse ? 'animate-pulse' : ''}`}>
                        {mainStatus.icon}
                      </span>
                      <span className={`text-[12px] ${mainStatus.color}`}>
                        {mainStatus.label}
                      </span>
                    </>
                  )}
                  <div className="flex-1" />
                  <span className="text-[10px] font-mono tabular-nums text-amber-500">
                    {formatTokens(sessionTokens)}
                  </span>
                </div>
                {/* Project name + team badge + subagent count */}
                {(projectName || tasks.length > 0 || teamInfo) && (
                  <div className="flex items-center gap-1 px-2 pb-0.5 pl-[30px]">
                    <span className={`text-[11px] font-mono tracking-widest uppercase text-cyan-400/70 truncate`} style={{ fontFamily: "'Share Tech Mono', 'Fira Code', 'JetBrains Mono', monospace", letterSpacing: '0.15em' }} title={main?.cwd || ''}>
                      {projectName || '—'}
                    </span>
                    {teamInfo && teamInfo.status === 'active' && (
                      <span className="text-[8px] px-1 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0" title={`Team: ${teamInfo.name}`}>
                        👥{teamInfo.memberCount}
                      </span>
                    )}
                    <div className="flex-1" />
                    {tasks.length > 0 && (
                      <span className={`text-[8px] ${colors.text.muted} shrink-0`}>
                        {tasks.filter(t => t.status === 'active').length}/{tasks.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Subagents */}
                {tasks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 px-2 pb-1 pl-[50px]">
                    {tasks.map((task, i) => {
                      const tm = getModel(task.model);
                      return (
                        <div
                          key={task.id || i}
                          className="flex items-center gap-0.5"
                          title={`${task.agentName || task.type || 'task'} - ${task.status} - ${formatTokens(task.tokens || 0)}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatus(task.status).dot}`} />
                          <span className={`text-[8px] font-bold ${tm.color}`}>{tm.name}</span>
                          {task.agentName && (
                            <span className="text-[7px] text-cyan-400/80">{task.agentName}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className={`h-7 flex items-center justify-between px-2 border-t ${colors.border} ${colors.bg.footer} flex-shrink-0`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${activeMainCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className={`text-[9px] ${activeMainCount > 0 ? 'text-emerald-400' : colors.text.muted}`}>
            {activeMainCount} session{activeMainCount !== 1 ? 's' : ''} · {activeTaskCount} task{activeTaskCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-emerald-400">
            ${monthCost.toFixed(2)}
          </span>
          <button
            onClick={() => { fetch('http://localhost:4824/agents/stopped', { method: 'DELETE' }); }}
            className={`text-[8px] px-1 py-0.5 rounded ${colors.text.muted} opacity-40 hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all`}
            title="Clear stopped agents"
          >✕</button>
        </div>
      </div>
    </div>
  );
}
