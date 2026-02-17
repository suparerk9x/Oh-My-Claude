import { useState, useEffect, useRef, useCallback } from 'react';
import { getThemeColors } from './config/theme';
import { formatTokens } from './utils/format';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

export default function MiniApp() {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [claudeUsage, setClaudeUsage] = useState(null);
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
        if (data.type === 'init') {
          setStats(data.stats);
          setAgents(data.agents || []);
          if (data.usage) setClaudeUsage(data.usage);
        } else if (data.type === 'stats') {
          setStats(data.stats);
          setAgents(data.agents || []);
          if (data.usage) setClaudeUsage(data.usage);
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
  const sessionPct = hasRealUsage ? claudeUsage.five_hour.utilization : null;
  const weeklyPct = claudeUsage?.seven_day?.utilization ?? null;

  // Monthly cost
  const tokens = stats?.tokens || {};
  const monthCost = tokens.month_cost || 0;

  // Agent summary
  const activeMainCount = agents.filter(a => a.type === 'main' && a.status === 'active').length;
  const activeTaskCount = agents.filter(a => a.type !== 'main' && a.status === 'active').length;
  const totalAgents = agents.length;

  // Model helper
  const getModel = (model) => {
    if (model?.includes('opus')) return { short: 'Op', color: 'text-violet-400', bg: 'bg-violet-500/20' };
    if (model?.includes('sonnet')) return { short: 'So', color: 'text-sky-400', bg: 'bg-sky-500/20' };
    if (model?.includes('haiku')) return { short: 'Ha', color: 'text-teal-400', bg: 'bg-teal-500/20' };
    return { short: '??', color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  // Status helper
  const getStatusDot = (status) => {
    switch (status) {
      case 'active': case 'running': return 'bg-emerald-400 animate-pulse';
      case 'idle': return 'bg-yellow-400';
      case 'stale': return 'bg-orange-400';
      case 'timeout': return 'bg-amber-400 animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  // Gauge bar component
  const GaugeBar = ({ label, pct, color = 'emerald' }) => {
    const barColor = pct === null ? 'bg-gray-600' :
      pct >= 85 ? 'bg-red-500' :
      pct >= 60 ? 'bg-amber-500' :
      `bg-${color}-500`;

    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className={`text-[9px] ${colors.text.muted}`}>{label}</span>
          <span className={`text-[9px] font-mono font-bold ${
            pct === null ? colors.text.muted :
            pct >= 85 ? 'text-red-400' :
            pct >= 60 ? 'text-amber-400' :
            `text-${color}-400`
          }`}>
            {pct === null ? 'N/A' : `${Math.round(pct)}%`}
          </span>
        </div>
        <div className={`h-1.5 rounded-full ${colors.progressBg} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: pct === null ? '0%' : `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    );
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

  const sessions = Object.entries(sessionMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      const aActive = a.main?.status === 'active' || a.tasks.some(t => t.status === 'active');
      const bActive = b.main?.status === 'active' || b.tasks.some(t => t.status === 'active');
      if (aActive !== bActive) return bActive - aActive;
      return 0;
    });

  return (
    <div className={`h-screen w-full ${colors.bg.primary} ${colors.text.primary} flex flex-col overflow-hidden font-['Inter',system-ui,sans-serif]`}>
      {/* Accent line */}
      <div className="h-0.5 bg-gradient-to-r from-[#d97757] via-[#e8956f] to-[#d97757] flex-shrink-0" />

      {/* Header */}
      <div className={`h-7 flex items-center justify-between px-2 border-b ${colors.border} ${colors.bg.header} flex-shrink-0`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold ${colors.text.title}`}>OMC<span className="text-[#d97757]">!</span></span>
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] font-mono ${colors.text.muted}`}>
            {activeMainCount}s {activeTaskCount}t
          </span>
        </div>
      </div>

      {/* Session Gauge */}
      <div className={`px-2 py-1.5 border-b ${colors.border} ${colors.bg.secondary}`}>
        <GaugeBar label="Session (5h)" pct={sessionPct} color="emerald" />
        <div className="mt-1">
          <GaugeBar label="Weekly" pct={weeklyPct} color="blue" />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-[10px] ${colors.text.muted}`}>
            No sessions
          </div>
        ) : (
          sessions.map(({ id: sid, main, tasks }) => {
            const isActive = main?.status === 'active' || tasks.some(t => t.status === 'active');
            const model = main ? getModel(main.model) : getModel(null);
            const sessionTokens = (main?.tokens || 0) + tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);

            return (
              <div key={sid} className={`border-b ${colors.border} ${isActive ? 'bg-emerald-500/[0.03]' : ''}`}>
                {/* Main agent row */}
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusDot(main?.status)} shrink-0`} />
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${model.color} ${model.bg}`}>
                    {model.short}
                  </span>
                  <code className={`text-[8px] font-mono ${colors.text.muted} truncate`}>{sid.slice(0, 7)}</code>
                  <div className="flex-1" />
                  <span className="text-[9px] font-mono tabular-nums text-amber-500">
                    {formatTokens(sessionTokens)}
                  </span>
                </div>

                {/* Subagent dots */}
                {tasks.length > 0 && (
                  <div className="flex items-center gap-1 px-2 pb-1 pl-6">
                    {tasks.map((task, i) => {
                      const tm = getModel(task.model);
                      return (
                        <div
                          key={task.id || i}
                          className="flex items-center gap-0.5"
                          title={`${task.type || 'task'} - ${task.status} - ${formatTokens(task.tokens || 0)}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(task.status)}`} />
                          <span className={`text-[7px] font-bold ${tm.color}`}>{tm.short}</span>
                        </div>
                      );
                    })}
                    <span className={`text-[8px] ${colors.text.muted} ml-auto`}>
                      {tasks.filter(t => t.status === 'active').length}/{tasks.length}
                    </span>
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
            {activeMainCount}s {activeTaskCount}t
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-emerald-400">
          ${monthCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
