import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTokens, cacheSavedUSD, formatDuration, cleanAssistantMessage, formatTimeWithSeconds, formatRelativeTime } from '../utils/format';

// Highlight occurrences of `q` in plain text (used in timeline search mode)
function highlightText(text, q) {
  if (!q) return text;
  const out = []; const lower = text.toLowerCase(); const ql = q.toLowerCase();
  let i = 0, idx;
  while ((idx = lower.indexOf(ql, i)) !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark key={idx} className="rounded px-0.5 bg-amber-400/30 text-amber-200">{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  out.push(text.slice(i));
  return out;
}

// Shared markdown styling for the reply timeline (dark-theme tuned)
const MD_COMPONENTS = {
  h1: (p) => <div className="text-[13px] font-medium text-gray-100 mt-2 mb-1" {...p} />,
  h2: (p) => <div className="text-[12px] font-medium text-gray-100 mt-2 mb-1" {...p} />,
  h3: (p) => <div className="text-[12px] font-normal text-gray-200 mt-1.5 mb-0.5" {...p} />,
  p: (p) => <p className="mb-2 last:mb-0" {...p} />,
  ul: (p) => <ul className="list-disc pl-4 mb-2 space-y-1" {...p} />,
  ol: (p) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...p} />,
  li: (p) => <li className="leading-[1.7]" {...p} />,
  strong: (p) => <strong className="font-normal text-gray-100" {...p} />,
  a: (p) => <a className="text-sky-400 underline" target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p) => <blockquote className="border-l-2 border-gray-600 pl-2 text-gray-400 mb-1.5" {...p} />,
  hr: () => <hr className="border-gray-700 my-2" />,
  pre: (p) => <pre className="p-2 rounded bg-black/40 overflow-x-auto text-[11px] mb-1.5" {...p} />,
  code: ({ className, children, ...rest }) => (
    /language-/.test(className || '')
      ? <code className={`font-mono text-[11px] ${className || ''}`} {...rest}>{children}</code>
      : <code className="px-1 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[10px]" {...rest}>{children}</code>
  ),
  table: (p) => <div className="overflow-x-auto mb-1.5"><table className="border-collapse text-[11px]" {...p} /></div>,
  th: (p) => <th className="border border-gray-700 px-1.5 py-0.5 text-left font-semibold" {...p} />,
  td: (p) => <td className="border border-gray-700/60 px-1.5 py-0.5" {...p} />,
};
import { TokenBreakdown } from './TokenBreakdown';

/**
 * AgentTree - Compact but COMPLETE information
 * No truncation - show all data
 */
export function AgentTree({ agents = [], colors = {}, compact = false, expanded = false, smartStatus = {}, teams = [], hideFooter = false }) {
  const [detailSession, setDetailSession] = useState(null);
  const [collapsedSubs, setCollapsedSubs] = useState(() => ({})); // sessionId -> collapse subagent group
  const [collapsedDone, setCollapsedDone] = useState(() => ({})); // sessionId -> collapse completed todos
  const [collapsedTodos, setCollapsedTodos] = useState(() => ({})); // sessionId -> collapse whole checklist
  const [collapsedRemaining, setCollapsedRemaining] = useState(() => ({})); // sessionId -> collapse remaining (in-progress + queued)
  const [bgDetail, setBgDetail] = useState(null); // background task object shown in detail popup
  const [fullMsg, setFullMsg] = useState(null); // { sessionId, loading, messages:[{ts,text}], total, limit, error } — reply timeline
  const [copiedIdx, setCopiedIdx] = useState(null); // timeline entry index showing the "copied" flash
  const [timelineQuery, setTimelineQuery] = useState(''); // reply-timeline search box
  const timelineRef = useRef(null);
  const lastTimelineTextRef = useRef('');

  // Copy a timeline reply to the clipboard (with a brief "copied" flash)
  const copyMessage = (text, idx) => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(c => (c === idx ? null : c)), 1500);
    }).catch(() => {});
  };

  // Open the reply timeline — fetch the most recent assistant messages for this session
  const openFullMessage = (sessionId) => {
    lastTimelineTextRef.current = ''; // force scroll-to-bottom on every open (even reopening the same session)
    setTimelineQuery('');
    setFullMsg({ sessionId, loading: true, messages: [], total: 0, limit: 50, error: null });
    fetch(`/api/session/${sessionId}/messages?limit=50`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => setFullMsg(f => (f && f.sessionId === sessionId ? { ...f, loading: false, messages: d.messages || [], total: d.total || 0 } : f)))
      .catch(err => setFullMsg(f => (f && f.sessionId === sessionId ? { ...f, loading: false, error: err.message } : f)));
  };

  // Load an older window (50 more) — re-fetch with a larger limit
  const loadOlderMessages = () => {
    setFullMsg(f => {
      if (!f) return f;
      const newLimit = (f.limit || 50) + 50;
      fetch(`/api/session/${f.sessionId}/messages?limit=${newLimit}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) setFullMsg(cur => (cur && cur.sessionId === f.sessionId ? { ...cur, messages: d.messages || [], total: d.total || 0, limit: newLimit } : cur)); })
        .catch(() => {});
      return { ...f, limit: newLimit };
    });
  };

  // Esc closes the open modal (timeline or background-job detail)
  useEffect(() => {
    if (!fullMsg && !bgDetail) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setFullMsg(null); setBgDetail(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullMsg, bgDetail]);

  // While the timeline is open, poll the latest message every 3s and append new replies live
  useEffect(() => {
    const sid = fullMsg?.sessionId;
    if (!sid) return undefined;
    const tick = () => {
      fetch(`/api/session/${sid}/last-message`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d?.message) return;
          setFullMsg(f => {
            if (!f || f.sessionId !== sid) return f;
            const last = f.messages[f.messages.length - 1];
            if (last && last.text.slice(0, 200) === d.message.slice(0, 200)) return f; // already the newest
            return { ...f, messages: [...f.messages, { ts: null, text: d.message }], total: f.total + 1 };
          });
        })
        .catch(() => {});
    };
    const iv = setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [fullMsg?.sessionId]);

  // Auto-scroll to the bottom on open / when a new reply lands (not when loading older at the top)
  useEffect(() => {
    const msgs = fullMsg?.messages;
    if (!msgs || !timelineRef.current) return;
    const lastText = msgs.length ? msgs[msgs.length - 1].text : '';
    if (lastText && lastText !== lastTimelineTextRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
      lastTimelineTextRef.current = lastText;
    }
  }, [fullMsg?.messages]);
  // Group by session - handle subagents with different sessionIds
  // First, build a map of main agents by their ID (main_<sessionId>)
  const mainAgentMap = {};
  agents.forEach(agent => {
    if (agent.type === 'main') {
      // Main agent ID is like "main_91188c68-..."
      mainAgentMap[agent.id] = agent.sessionId;
    }
  });

  const sessionMap = agents.reduce((acc, agent) => {
    let sid;

    if (agent.type === 'main') {
      // Main agents use their own sessionId
      sid = agent.sessionId || 'unknown';
    } else {
      // Subagents: try to find parent's sessionId
      // parentId might be "main_<sessionId>" or just "main"
      const parentId = agent.parentId;
      if (parentId && parentId.startsWith('main_')) {
        // Extract sessionId from parentId (e.g., "main_91188c68-..." -> "91188c68-...")
        sid = parentId.replace('main_', '');
      } else if (parentId && mainAgentMap[parentId]) {
        // If parentId matches a main agent's ID
        sid = mainAgentMap[parentId];
      } else {
        // Fall back to agent's own sessionId
        sid = agent.sessionId || 'unknown';
      }
    }

    if (!acc[sid]) acc[sid] = { main: null, tasks: [] };
    if (agent.type === 'main') acc[sid].main = agent;
    else acc[sid].tasks.push(agent);
    return acc;
  }, {});

  const rawSessions = Object.entries(sessionMap)
    .map(([id, data]) => ({ id, ...data }));

  // Sort by creation time (like mini view)
  const activeStatuses = ['active', 'idle', 'stale'];
  const sessionsByCreationOrder = [...rawSessions].sort((a, b) => {
    const aTime = a.main?.startedAt ? new Date(a.main.startedAt).getTime() : 0;
    const bTime = b.main?.startedAt ? new Date(b.main.startedAt).getTime() : 0;
    return aTime - bTime;
  });

  // Display sort: active first, then by creation order
  const sessions = sessionsByCreationOrder.slice().sort((a, b) => {
    const aActive = activeStatuses.includes(a.main?.status) || a.tasks.some(t => activeStatuses.includes(t.status));
    const bActive = activeStatuses.includes(b.main?.status) || b.tasks.some(t => activeStatuses.includes(t.status));
    if (aActive !== bActive) return bActive - aActive;
    return 0;
  });

  const activeMainCount = agents.filter(a => a.type === 'main' && a.status === 'active').length;
  const activeTaskCount = agents.filter(a => a.type !== 'main' && a.status === 'active').length;
  const stoppedTaskCount = agents.filter(a => a.type !== 'main' && (a.status === 'stopped' || a.status === 'timeout')).length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokens || (a.inputTokens || 0) + (a.outputTokens || 0) || 0), 0);

  // Fixed session numbers (stable, sorted by creation time like mini view)
  const sessionsByCreation = [...rawSessions].sort((a, b) => {
    const aTime = a.main?.startedAt ? new Date(a.main.startedAt).getTime() : 0;
    const bTime = b.main?.startedAt ? new Date(b.main.startedAt).getTime() : 0;
    return aTime - bTime;
  });
  const sessionNumber = {};
  sessionsByCreation.forEach((s, idx) => { sessionNumber[s.id] = idx + 1; });

  // Theme-aware helper: agent status
  const as = colors.agentStatus || {};
  const getStatus = (status) => {
    switch (status) {
      case 'active':
      case 'running': {
        const s = as.active || {};
        return { icon: '●', color: s.text || 'text-emerald-400', bg: s.bg || 'bg-emerald-500/15', dot: s.dot || 'bg-emerald-500 animate-pulse', pulse: true, label: 'Active' };
      }
      case 'idle': {
        const s = as.idle || {};
        return { icon: '●', color: s.text || 'text-yellow-400', bg: s.bg || 'bg-yellow-500/15', dot: s.dot || 'bg-yellow-400', pulse: false, label: 'Idle' };
      }
      case 'stale': {
        const s = as.stale || {};
        return { icon: '●', color: s.text || 'text-orange-400', bg: s.bg || 'bg-orange-500/15', dot: s.dot || 'bg-orange-400 animate-pulse', pulse: false, label: 'Stale' };
      }
      case 'timeout': {
        const s = as.timeout || {};
        return { icon: '●', color: s.text || 'text-amber-400', bg: s.bg || 'bg-amber-500/15', dot: s.dot || 'bg-amber-500 animate-ping', pulse: true, label: 'Timeout' };
      }
      case 'stopped': {
        const s = as.stopped || {};
        return { icon: '○', color: s.text || 'text-gray-500', bg: s.bg || 'bg-gray-500/15', dot: s.dot || 'bg-gray-600', pulse: false, label: 'Stopped' };
      }
      default: {
        const s = as.unknown || {};
        return { icon: '○', color: s.text || 'text-gray-600', bg: s.bg || 'bg-gray-500/15', dot: s.dot || 'bg-gray-700', pulse: false, label: 'Unknown' };
      }
    }
  };

  // Theme-aware helper: model badge
  const mc = colors.model || {};
  const getModel = (model) => {
    const versionMatch = model?.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
    const version = versionMatch ? ` ${versionMatch[1]}.${versionMatch[2]}` : '';

    if (model?.includes('opus'))   { const m = mc.opus || {};   return { name: `Opus${version}`,   color: m.text || 'text-violet-400', bg: m.bg || 'bg-violet-500/15' }; }
    if (model?.includes('sonnet')) { const m = mc.sonnet || {}; return { name: `Sonnet${version}`, color: m.text || 'text-sky-400',    bg: m.bg || 'bg-sky-500/15' }; }
    if (model?.includes('haiku'))  { const m = mc.haiku || {};  return { name: `Haiku${version}`,  color: m.text || 'text-teal-400',   bg: m.bg || 'bg-teal-500/15' }; }
    return null;
  };

  // Theme-aware helper: agent type
  const at = colors.agentType || {};
  const getTypeInfo = (type) => {
    if (!type || type === 'main') return null;
    const name = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
    const fb = at.fallback || {};
    const typeMap = {
      'explore': at.explore || fb,
      'plan': at.plan || fb,
      'bash': at.bash || fb,
      'general-purpose': at.general || fb,
      'code-reviewer': at.code || fb,
      'subagent': at.fallback || fb,
    };
    const tc = typeMap[type.toLowerCase()] || fb;
    return { name, bg: tc.bg || 'bg-pink-500/15', text: tc.text || 'text-pink-400' };
  };

  const getDuration = (agent) => agent.elapsedFormatted || agent.durationFormatted || null;

  // Theme-aware helper: tool style
  const tl = colors.tool || {};
  const parseLastTask = (lastTask) => {
    if (!lastTask || lastTask === 'Main Session') return null;

    const toolConfig = {
      'Read':        { icon: '📖', ...(tl.read    || { color: 'text-sky-500',    bg: 'bg-sky-500/15' }) },
      'Glob':        { icon: '📂', ...(tl.read    || { color: 'text-sky-500',    bg: 'bg-sky-500/15' }) },
      'Grep':        { icon: '🔍', ...(tl.read    || { color: 'text-sky-500',    bg: 'bg-sky-500/15' }) },
      'Edit':        { icon: '✏️', ...(tl.edit    || { color: 'text-orange-500', bg: 'bg-orange-500/15' }) },
      'Write':       { icon: '📝', ...(tl.edit    || { color: 'text-orange-500', bg: 'bg-orange-500/15' }) },
      'Bash':        { icon: '⚡', ...(tl.bash    || { color: 'text-amber-500',  bg: 'bg-amber-500/15' }) },
      'Task':        { icon: '🔀', ...(tl.task    || { color: 'text-violet-500', bg: 'bg-violet-500/15' }) },
      'Agent':       { icon: '🔀', ...(tl.task    || { color: 'text-violet-500', bg: 'bg-violet-500/15' }) },
      'WebFetch':    { icon: '🌐', ...(tl.web     || { color: 'text-cyan-500',   bg: 'bg-cyan-500/15' }) },
      'WebSearch':   { icon: '🔎', ...(tl.web     || { color: 'text-cyan-500',   bg: 'bg-cyan-500/15' }) },
      'TeamCreate':  { icon: '👥', ...(tl.team    || { color: 'text-indigo-500', bg: 'bg-indigo-500/15' }) },
      'SendMessage': { icon: '📨', ...(tl.web     || { color: 'text-cyan-500',   bg: 'bg-cyan-500/15' }) },
      'TeamDelete':  { icon: '🧹', ...(tl.teamDel || { color: 'text-gray-500',   bg: 'bg-gray-500/15' }) },
      'TodoWrite':   { icon: '📋', ...(tl.todo    || { color: 'text-amber-500',  bg: 'bg-amber-500/15' }) },
      'AskUserQuestion': { icon: '❓', ...(tl.ask  || { color: 'text-orange-500', bg: 'bg-orange-500/15' }) },
      'ToolSearch':  { icon: '🔎', ...(tl.search  || { color: 'text-sky-500',    bg: 'bg-sky-500/15' }) },
      'Workflow':    { icon: '🧩', ...(tl.workflow|| { color: 'text-violet-500', bg: 'bg-violet-500/15' }) },
      'Skill':       { icon: '✨', ...(tl.skill   || { color: 'text-indigo-500', bg: 'bg-indigo-500/15' }) },
    };

    // Try to extract tool name from start of lastTask
    const match = lastTask.match(/^(\w+)\s+(.+)$/);
    if (match) {
      const [, tool, detail] = match;
      const config = toolConfig[tool];
      if (config) {
        // Normalize: tool config has 'text' for text color, but parseLastTask expects 'color'
        return { tool, detail, icon: config.icon, color: config.text || config.color, bg: config.bg };
      }
    }

    // No tool detected - treat as user prompt
    return { tool: null, detail: lastTask, icon: '💬', color: colors?.text?.muted || 'text-gray-400' };
  };

  // Format timestamp to HH:MM
  const formatTime = (timestamp) => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Build team lookup: sessionId -> team info
  const teamBySession = {};
  (teams || []).forEach(team => {
    if (team.leadSessionId) teamBySession[team.leadSessionId] = team;
  });

  // Build file conflict lookup: agentId -> conflict count
  const agentConflicts = {};
  (teams || []).forEach(team => {
    (team.fileConflicts || []).forEach(conflict => {
      (conflict.agents || []).forEach(agentName => {
        // Find agent by name in team members
        (team.members || []).forEach(member => {
          if (member.name === agentName) {
            agentConflicts[member.id] = (agentConflicts[member.id] || 0) + 1;
          }
        });
      });
    });
  });

  // Health thresholds for team members
  const IDLE_WARNING_MS = 5 * 60 * 1000; // 5 minutes idle = yellow warning
  const HIGH_TOKEN_THRESHOLD = 50000; // 50k tokens = orange warning

  // Get health indicator for a teammate
  const getHealthIndicator = (task) => {
    const warnings = [];
    const now = Date.now();

    // Idle too long
    if (task.status === 'idle' && task.lastSeen) {
      const idleMs = now - new Date(task.lastSeen).getTime();
      if (idleMs > IDLE_WARNING_MS) {
        const mins = Math.floor(idleMs / 60000);
        warnings.push({ level: 'yellow', icon: '💤', label: `Idle ${mins}m`, title: `Teammate idle for ${mins} minutes` });
      }
    }

    // Excessive token usage
    const tokens = task.tokens || (task.inputTokens || 0) + (task.outputTokens || 0);
    if (tokens > HIGH_TOKEN_THRESHOLD) {
      warnings.push({ level: 'orange', icon: '🔥', label: formatTokens(tokens), title: `High token usage: ${tokens.toLocaleString()}` });
    }

    // Context window nearly full
    if (task.contextPct >= 80) {
      warnings.push({ level: 'red', icon: '📦', label: `ctx ${task.contextPct}%`, title: `Context window ${task.contextPct}% full — compaction imminent` });
    }

    // File conflicts
    const conflicts = agentConflicts[task.id] || 0;
    if (conflicts > 0) {
      warnings.push({ level: 'red', icon: '⚠', label: `${conflicts} conflict${conflicts > 1 ? 's' : ''}`, title: `${conflicts} file conflict(s)` });
    }

    return warnings;
  };

  // Compute team health summary
  const getTeamHealth = (teamInfo, teamTasks) => {
    if (!teamInfo) return null;
    let health = 'green'; // green = healthy
    const issues = [];

    const conflictCount = teamInfo.fileConflicts?.length || 0;
    if (conflictCount > 0) {
      health = 'red';
      issues.push(`${conflictCount} file conflict${conflictCount > 1 ? 's' : ''}`);
    }

    const now = Date.now();
    const idleMembers = teamTasks.filter(t => {
      if (t.status !== 'idle' || !t.lastSeen) return false;
      return (now - new Date(t.lastSeen).getTime()) > IDLE_WARNING_MS;
    });
    if (idleMembers.length > 0) {
      if (health === 'green') health = 'yellow';
      issues.push(`${idleMembers.length} idle`);
    }

    const highTokenMembers = teamTasks.filter(t => (t.tokens || 0) > HIGH_TOKEN_THRESHOLD);
    if (highTokenMembers.length > 0) {
      if (health === 'green') health = 'orange';
      issues.push(`${highTokenMembers.length} high-token`);
    }

    return { health, issues };
  };

  // Theme-aware common colors
  const textMuted = colors?.text?.muted || 'text-gray-500';
  const borderColor = colors?.border || 'border-gray-800/40';
  const tasksBg = colors?.bg?.tasks || 'bg-black/10';
  const hl = colors.health || {};
  const tm = colors.team || {};
  const mi = colors.misc || {};
  const gi = colors.git || {};

  // Render a single task/agent row
  const renderTask = (task, i, totalCount, ctx) => {
    const status = ctx.getStatus(task.status);
    const model = ctx.getModel(task.model);
    const typeInfo = ctx.getTypeInfo(task.type);
    const tokens = task.tokens || (task.inputTokens || 0) + (task.outputTokens || 0);
    const duration = ctx.getDuration(task);
    const desc = task.description || task.lastTask;
    const healthWarnings = ctx.getHealthIndicator(task);
    const tokenPct = ctx.teamTotalTokens > 0 && tokens > 0 ? Math.round((tokens / ctx.teamTotalTokens) * 100) : 0;

    const calcDuration = () => {
      if (duration) return duration;
      if (task.startedAt && (task.stoppedAt || task.lastSeen)) {
        const start = new Date(task.startedAt).getTime();
        const end = new Date(task.stoppedAt || task.lastSeen).getTime();
        const secs = Math.floor((end - start) / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}m ${remSecs}s`;
      }
      return null;
    };
    const displayDuration = calcDuration();

    return (
      <div
        key={task.id || i}
        className={`${ctx.expanded ? 'px-3 pt-3 pb-0' : 'px-2 pt-2 pb-0'} ${i < totalCount - 1 ? `border-b ${mi.separator || 'border-gray-800/20'}` : ''} ${task.status === 'stopped' ? 'opacity-50' : ''} cursor-pointer hover:bg-white/[0.02] transition-colors`}
        onClick={() => setDetailSession({ sessionId: task.sessionId || task.id, main: task, tasks: [], teamInfo: task.teamName ? { name: task.teamName } : null, sessionTokens: tokens, isSubagent: true })}
        title="Click for details"
      >
        <div className={`${ctx.expanded ? 'pl-4 space-y-1.5' : 'pl-3 space-y-1'}`}>
          {/* Line 1: Status (fixed) + Model + Type + Name + Health + Duration + Tokens */}
          <div className="flex items-center flex-nowrap">
            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
              <span className={`${ctx.textMuted} text-[9px] shrink-0`}>└</span>
              {task.teamName && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded ${tm.iconBg || 'bg-white/15'}`} title={`Team: ${task.teamName}`}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={tm.iconText || 'text-gray-100'}>
                    <circle cx="8" cy="4.5" r="3" fill="currentColor"/>
                    <path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" fill="currentColor" opacity="0.7"/>
                  </svg>
                </span>
              )}
              {task.agentName && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${task.teamName ? `${tm.memberNameBg || 'bg-white/15'} ${tm.memberNameText || 'text-gray-100'}` : `${tm.nonTeamNameBg || 'bg-cyan-500/15'} ${tm.nonTeamNameText || 'text-cyan-400'}`}`}>
                  {task.agentName}
                </span>
              )}
              {model && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${model.color} ${model.bg}`}>
                  {model.name}
                </span>
              )}
              {typeInfo && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${typeInfo.bg} ${typeInfo.text}`}>
                  {typeInfo.name}
                </span>
              )}
              {/* Health warnings */}
              {healthWarnings.map((w, idx) => {
                const hc = hl[w.level] || {};
                return (
                  <span key={idx} className={`${ctx.expanded ? 'text-[8px]' : 'text-[7px]'} px-1 py-0.5 rounded-full shrink-0 ${hc.bg || 'bg-yellow-500/15'} ${hc.text || 'text-yellow-400'}`} title={w.title}>
                    {w.icon}
                  </span>
                );
              })}
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded shrink-0 ${status.bg}`}>
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} shrink-0 ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}>
                  {status.icon}
                </span>
                <span className={`${ctx.expanded ? 'text-[9px]' : 'text-[8px]'} whitespace-nowrap ${status.color}`}>
                  {status.label}
                </span>
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1 pl-1">
              <span className={`font-mono ${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums w-[48px] text-right whitespace-nowrap ${displayDuration ? (mi.duration || 'text-gray-400') : (mi.durationFallback || 'text-gray-500')}`}>
                {displayDuration || (task.stoppedAt || task.lastSeen ? ctx.formatTime(task.stoppedAt || task.lastSeen) : '')}
              </span>
              <span className={`font-mono ${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums ${mi.tokens || 'text-amber-500'} w-[45px] text-right`}>
                {tokens > 0 ? ctx.formatTokens(tokens) : ''}
              </span>
              {task.teamName && (() => {
                const pct = task.contextPct || 0;
                return (
                  <span className={`font-mono ${ctx.expanded ? 'text-[9px]' : 'text-[8px]'} tabular-nums px-1 py-0.5 rounded shrink-0 w-[42px] text-right ${pct >= 80 ? 'bg-red-500/15 text-red-400' : pct >= 50 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`} title={`Context window ${pct}% full`}>
                    ctx {pct}%
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Line 2: Tools + Token bar + Context bar (team only) */}
          {!ctx.compact && (task.toolsUsed?.length > 0 || tokenPct > 0 || (task.teamName && task.contextPct > 0)) && (
            <div className={`flex items-center gap-1 ${ctx.expanded ? 'pl-8 flex-wrap' : 'pl-8'}`}>
              {task.toolsUsed?.length > 0 && (
                <>
                  <span className={`text-[9px] ${mi.durationFallback || 'text-gray-500'} shrink-0`}>🔧</span>
                  {task.toolsUsed.map((tool, idx) => (
                    <span key={idx} className={`${ctx.expanded ? 'text-[9px]' : 'text-[8px]'} px-1.5 py-0.5 rounded ${mi.toolBadgeBg || 'bg-sky-500/10'} ${mi.toolBadgeText || 'text-sky-400/80'}`}>
                      {tool}
                    </span>
                  ))}
                </>
              )}
              {(tokenPct > 0 || (task.teamName && task.contextPct > 0)) && (
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  {tokenPct > 0 && (
                    <>
                      <span className={`text-[8px] font-mono ${mi.tokenPct || 'text-amber-500/70'}`}>{tokenPct}%</span>
                      <div className={`h-1 rounded-full ${mi.tokenBarTrack || 'bg-gray-700/30'} overflow-hidden w-[42px]`}>
                        <div className={`h-full rounded-full ${mi.tokenBarFill || 'bg-amber-500/50'} transition-all`} style={{ width: `${Math.min(tokenPct, 100)}%` }} />
                      </div>
                    </>
                  )}
                  {task.teamName && task.contextPct > 0 && (
                    <div className={`h-1 rounded-full ${mi.tokenBarTrack || 'bg-gray-700/30'} overflow-hidden w-[42px]`}>
                      <div className={`h-full rounded-full transition-all ${task.contextPct >= 80 ? 'bg-red-500/70' : task.contextPct >= 50 ? 'bg-amber-500/50' : 'bg-emerald-500/50'}`} style={{ width: `${Math.min(task.contextPct, 100)}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Line 3: Description */}
          {!ctx.compact && desc && (
            <div className="flex items-center gap-1.5 pl-8">
              <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} ${mi.description || 'text-gray-400'} truncate flex-1 min-w-0`}>
                💬 {desc}
              </span>
              {task.id && (
                <code className={`${mi.sessionId || 'text-gray-600'} font-mono text-[8px] shrink-0`}>{task.id.slice(0, 7)}</code>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <div className={`w-8 h-8 rounded-full ${colors?.progressBg || 'bg-gray-800/50'} flex items-center justify-center mb-2`}>
          <span className={`text-lg ${textMuted}`}>○</span>
        </div>
        <div className={`text-[11px] ${textMuted}`}>No active sessions</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-[11px] overflow-hidden">
      {/* Sessions */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden ${expanded ? 'flex flex-col p-2 gap-2' : ''}`}>
        {sessions.map(({ id: sessionId, main, tasks }) => {
          const isActive = ['active', 'idle', 'stale'].includes(main?.status) || tasks.some(t => ['active', 'idle', 'stale'].includes(t.status));
          // Keep the card un-dimmed while a background shell job is still running, even if the agent
          // itself has stopped — the work isn't finished yet, so the status shouldn't fade out.
          const hasRunningBg = main?.backgroundTasks?.some(bt => bt.status === 'running');
          const keepBright = isActive || hasRunningBg;
          const mainStatus = main ? getStatus(main.status) : getStatus('unknown');
          const smart = smartStatus[sessionId];
          const mainModel = main ? getModel(main.model) : null;
          const sessionTokens = (main?.tokens || 0) + tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);
          // total = work + cache (read + creation) — everything actually sent to the API (≈ the bill)
          const sessionCacheRead = main?.cacheReadTokens || 0;
          // cacheCreate from the exact field if backend sends it, else reconstruct from 1h+5m tiers
          const sessionCacheCreate = main?.cacheCreationTokens ?? ((main?.cacheCreation1h || 0) + (main?.cacheCreation5m || 0));
          const sessionTotal = sessionTokens + sessionCacheRead + sessionCacheCreate;
          const sessionReuse = sessionCacheCreate > 0 ? sessionCacheRead / sessionCacheCreate : null;
          const sessionSaved = cacheSavedUSD(sessionCacheRead, main?.model);
          // always show duration: use elapsed/duration string, else compute from startedAt → stoppedAt/lastSeen
          const mainDuration = (main && getDuration(main))
            || (main?.startedAt ? formatDuration(new Date(main.stoppedAt || main.lastSeen || Date.now()) - new Date(main.startedAt)) : '');
          // "quiet" = labeled active but no new event for a while (possibly stuck, or a long-running tool)
          const quietMs = main?.status === 'active' && main?.lastSeen ? (Date.now() - new Date(main.lastSeen).getTime()) : 0;
          const activeTaskCount = tasks.filter(t => t.status === 'active').length;
          const teamInfo = teamBySession[sessionId];
          const hasConflicts = teamInfo?.fileConflicts?.length > 0;

          // Separate team members from non-team tasks (show team grouping even after deletion)
          const hasTeam = teamInfo && tasks.some(t => t.teamName === teamInfo.name);
          const teamTasks = hasTeam ? tasks.filter(t => t.teamName === teamInfo.name) : [];
          const nonTeamTasks = hasTeam ? tasks.filter(t => t.teamName !== teamInfo.name) : tasks;
          const teamHealth = getTeamHealth(teamInfo, teamTasks);
          const teamTotalTokens = teamTasks.reduce((sum, t) => sum + (t.tokens || (t.inputTokens || 0) + (t.outputTokens || 0) || 0), 0);

          return (
            <div key={sessionId} className={`${expanded ? `flex flex-col rounded-lg border ${borderColor}` : `border-b ${borderColor}`} ${keepBright ? (mi.activeBg || 'bg-emerald-500/[0.03]') : 'opacity-50'}`}>
              {/* Session Header */}
              <div className={`${expanded ? 'px-3 py-2' : 'px-2 py-1.5'} shrink-0`}>
                {/* Line 1: Number + Model + Status + Duration + Tokens */}
                <div className="flex items-center flex-nowrap">
                  <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                    <span className={`text-[11px] font-mono font-bold ${mi.sessionNum || 'text-white'} shrink-0 w-[16px] text-right`}>{sessionNumber[sessionId]}.</span>
                    {mainModel && (
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 whitespace-nowrap ${mainModel.color} ${mainModel.bg}`}>
                        {mainModel.name}
                      </span>
                    )}
                    {(() => {
                      const eff = main?.effort;
                      if (!(eff === 'high' || eff === 'xhigh' || eff === 'max' || eff === 'ultra')) return null;
                      const label = eff === 'ultra' ? 'ULTRA' : eff.toUpperCase();
                      // chip with bg, same treatment as the model badge (rounded + colored bg, no border)
                      const effChip = (eff === 'max' || eff === 'ultra') ? 'text-violet-300 bg-violet-500/20'
                                    : eff === 'xhigh' ? 'text-fuchsia-300 bg-fuchsia-500/15'
                                    : 'text-amber-300 bg-amber-500/15';
                      return (
                        <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 whitespace-nowrap ${effChip}`} title={`Reasoning effort: ${eff}`}>
                          ⚡{label}
                        </span>
                      );
                    })()}
                    {smart && isActive ? (
                      <>
                        <span className={`text-[10px] shrink-0 ${smart.animation}`}>{smart.icon}</span>
                        <span className={`text-[9px] whitespace-nowrap font-medium ${smart.color}`}>{smart.label}</span>
                      </>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0 ${mainStatus.bg}`}>
                        <span className={`text-[10px] shrink-0 ${mainStatus.color} ${mainStatus.pulse ? 'animate-pulse' : ''}`}>{mainStatus.icon}</span>
                        <span className={`text-[9px] whitespace-nowrap ${mainStatus.color}`}>{mainStatus.label}</span>
                      </span>
                    )}
                    {quietMs > 90000 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] shrink-0 whitespace-nowrap bg-amber-500/15 text-amber-400 border border-amber-500/25" title={`ไม่มี event ใหม่ ${formatDuration(quietMs)} — อาจค้าง หรือกำลังรัน tool ยาวๆ`}>
                        ⚠ เงียบ {formatDuration(quietMs)}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1 pl-1">
                    <span className={`font-mono text-[10px] tabular-nums ${mi.tokens || 'text-amber-500'} w-[45px] text-right`} title={`Context window: ${(main?.lastInputTokens || 0).toLocaleString()} tokens (the value behind ctx %)`}>
                      {formatTokens(main?.lastInputTokens || 0)}
                    </span>
                    {(() => {
                      const pct = main?.contextPct || 0;
                      return (
                        <span className={`font-mono text-[8px] tabular-nums px-1 py-0.5 rounded shrink-0 w-[42px] text-right ${pct >= 80 ? 'bg-red-500/15 text-red-400' : pct >= 50 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`} title={`Context window ${pct}% full`}>
                          ctx {pct}%
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Project name + Team badge + Context gauge */}
                {(main?.cwd || teamInfo || main?.contextPct > 0) && (
                  <div className="mt-0.5 pl-[22px] flex items-center gap-1.5">
                    {main?.cwd && (
                      <span className={`text-[10px] font-mono tracking-widest uppercase ${mi.projectName || 'text-cyan-400/70'}`} style={{ fontFamily: "'Share Tech Mono', 'Fira Code', 'JetBrains Mono', monospace", letterSpacing: '0.15em' }} title={main.cwd}>
                        {main.cwd.split(/[\\/]/).pop()}
                      </span>
                    )}
                    {hasTeam && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${teamInfo.status === 'active' ? (tm.badgeActive || 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20') : (tm.badgeInactive || 'bg-gray-500/15 text-gray-400 border-gray-500/20')} border whitespace-nowrap`} title={`Team: ${teamInfo.name} (${teamTasks.length} members)`}>
                        👥 {teamInfo.name}
                      </span>
                    )}
                    {hasConflicts && (
                      <span className={`text-[9px] px-1 py-0.5 rounded-full ${mi.fileConflict || 'bg-red-500/15 text-red-400 border-red-500/20'} border whitespace-nowrap`} title={`${teamInfo.fileConflicts.length} file conflict(s)`}>
                        ⚠ {teamInfo.fileConflicts.length} conflict{teamInfo.fileConflicts.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {/* Context window gauge — right-aligned */}
                    {main?.contextPct > 0 && (() => {
                      const pct = main.contextPct;
                      const clamp = Math.min(pct, 100);
                      const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';
                      const glowColor = pct >= 80 ? 'shadow-red-500/30' : pct >= 50 ? 'shadow-amber-500/20' : '';
                      const lastInput = main.lastInputTokens || 0;
                      const ctxLimit = /haiku/i.test(main.model || '') ? 200000 : 1000000;
                      const limitK = ctxLimit >= 1000000 ? '1M' : '200k';
                      return (
                        <div className="ml-auto flex items-center shrink-0" title={`Context window: ${lastInput.toLocaleString()} / ${limitK} tokens (${pct}%)`}>
                          <div className={`relative h-[6px] w-[42px] rounded-full ${mi.tokenBarTrack || 'bg-gray-700/40'} overflow-hidden ${glowColor ? `shadow-sm ${glowColor}` : ''}`}>
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-700 ease-out`}
                              style={{ width: `${clamp}%` }}
                            />
                            {/* Tick marks at 50% and 80% */}
                            <div className="absolute inset-y-0 left-[50%] w-px bg-white/10" />
                            <div className="absolute inset-y-0 left-[80%] w-px bg-white/15" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── ALARMS: max-tokens / scheduled crons — hoisted to top so problems jump out ── */}
                {!compact && (main?.stopReason === 'max_tokens' || main?.sessionCrons?.length > 0) && (
                  <div className="mt-1 pl-4 flex items-center gap-1 flex-wrap">
                    {main.stopReason === 'max_tokens' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] bg-red-500/15 text-red-400 border border-red-500/20" title="Last turn hit the max output-token limit — the reply may be truncated">⚠ max tokens</span>
                    )}
                    {main.sessionCrons?.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] bg-sky-500/15 text-sky-400 border border-sky-500/20" title={`${main.sessionCrons.length} scheduled cron agent(s)`}>⏰ {main.sessionCrons.length}</span>
                    )}
                  </div>
                )}

                {/* ── LIVE STORY: activity → last message → tier-2 → background jobs → todos ── */}

                {/* Activity + Session ID - hidden in compact, hidden if no activity */}
                {!compact && (() => {
                  const parsed = main?.lastTask && main.lastTask !== 'Main Session' ? parseLastTask(main.lastTask) : null;
                  if (!parsed) return null;
                  return (
                    <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] shrink-0">{parsed.icon}</span>
                      {parsed.tool && (
                        <span className={`text-[10px] font-medium shrink-0 ${parsed.color}`}>
                          {parsed.tool}
                        </span>
                      )}
                      <span className={`text-[10px] ${mi.description || 'text-gray-400'} ${expanded ? '' : 'truncate'} flex-1 min-w-0`}>
                        {parsed.detail}
                      </span>
                      <code className={`${mi.sessionId || 'text-gray-600'} font-mono text-[8px] shrink-0`}>{sessionId.slice(0, 7)}</code>
                    </div>
                  );
                })()}

                {/* Last assistant message (turn / result summary) — paired with activity: the live narrative.
                    markdown is stripped to clean prose; subtle left accent marks it as the agent's latest voice. */}
                {!compact && main?.lastAssistantMessage && (
                  <div
                    className={`mt-1 ml-4 pl-1.5 border-l-2 ${mi.lastMsgBorder || 'border-gray-600/40'} flex items-start gap-1.5 min-w-0 cursor-pointer hover:!opacity-80 transition-opacity ${main?.awaitingReply ? 'opacity-[0.45]' : 'opacity-100'}`}
                    onClick={(e) => { e.stopPropagation(); openFullMessage(sessionId); }}
                    title={main?.awaitingReply ? 'คำตอบเทิร์นก่อน (กำลังประมวลผลคำถามใหม่) — คลิกดู timeline' : 'คลิกดู timeline คำตอบ'}
                  >
                    <span className={`text-[9px] shrink-0 ${textMuted} mt-px`}>↳</span>
                    <span className={`text-[9px] leading-relaxed line-clamp-2 min-w-0 ${mi.lastMsg || 'text-gray-300'}`}>
                      {cleanAssistantMessage(main.lastAssistantMessage)}
                    </span>
                  </div>
                )}

                {/* Tier-2 signals strip: web tool use, hook health, subagent task count */}
                {!compact && (() => {
                  const ws = main?.webSearches || 0;
                  const wf = main?.webFetches || 0;
                  const hh = main?.hookHealth;
                  const hookBad = hh && (hh.failures > 0 || hh.maxMs > 1500);
                  if (!ws && !wf && !hookBad) return null;
                  return (
                    <>
                      <div className="mt-1 pl-4 flex items-center gap-1.5 flex-wrap text-[9px]">
                        {ws > 0 && <span className={`${textMuted} font-mono`} title={`${ws} web search request(s) this session`}>🔎 {ws}</span>}
                        {wf > 0 && <span className={`${textMuted} font-mono`} title={`${wf} web fetch request(s) this session`}>🌐 {wf}</span>}
                      </div>
                      {hookBad && (
                        <div className="mt-1 pl-4 flex items-center gap-1.5 text-[9px]">
                          <span className="shrink-0">🪝</span>
                          {hh.failures > 0
                            ? <span className="text-red-400" title="Hook(s) exited non-zero">{hh.failures} hook fail{hh.failures > 1 ? 's' : ''}</span>
                            : <span className={textMuted}>{hh.total} hooks ok</span>}
                          {hh.maxMs > 1500 && (
                            <span className={`${textMuted} font-mono`} title={`Slowest hook: ${hh.slowest}`}>· {(hh.slowest || 'hook').split(':')[0]} {(hh.maxMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Background jobs — running ones shown first (kept above todos: still-working signal) */}
                {!compact && main?.backgroundTasks?.length > 0 && (
                  <div className="mt-1 pl-4 space-y-0.5">
                    {[...main.backgroundTasks].sort((a, b) => (b.status === 'running' ? 1 : 0) - (a.status === 'running' ? 1 : 0)).slice(0, 3).map((bt, i) => {
                      const st = bt.status === 'running' ? { dot: 'bg-amber-400 animate-pulse', label: 'text-amber-400' }
                               : bt.status === 'completed' ? { dot: 'bg-emerald-500', label: 'text-emerald-400' }
                               : (bt.status === 'failed' || bt.status === 'error') ? { dot: 'bg-red-500', label: 'text-red-400' }
                               : { dot: 'bg-gray-500', label: textMuted };
                      return (
                        <div
                          key={bt.id || i}
                          className={`flex items-center gap-1.5 min-w-0 cursor-pointer rounded hover:bg-white/[0.03] transition-colors ${bt.status === 'running' ? 'border-l-2 border-amber-400/60 pl-1.5' : ''}`}
                          title="คลิกดูรายละเอียด"
                          onClick={(e) => { e.stopPropagation(); setBgDetail(bt); }}
                        >
                          <span className="text-[9px] shrink-0 opacity-70">⚙</span>
                          <span className={`text-[9px] ${mi.description || 'text-gray-400'} truncate min-w-0 flex-1`}>{bt.description || bt.command || 'background task'}</span>
                          <span className={`text-[8px] font-mono shrink-0 ${st.label}`}>{bt.status}</span>
                        </div>
                      );
                    })}
                    {main.backgroundTasks.length > 3 && (
                      <span className={`text-[8px] ${textMuted} pl-4 block`}>+{main.backgroundTasks.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* TODO checklist (from TodoWrite) — single list in ORIGINAL order; done stay in place.
                    Completed items naturally sit on top → scan top→bottom to read progress in sequence. */}
                {!compact && main?.todos?.length > 0 && (() => {
                  const total = main.todos.length;
                  const done = main.todos.filter(t => t.status === 'completed').length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const complete = done === total;
                  const dCollapsed = !!collapsedDone[sessionId];
                  const tCollapsed = !!collapsedTodos[sessionId];
                  return (
                    <div className="mt-1 pl-4 min-w-0">
                      {/* Summary: done/total + progress bar — click to collapse/expand the whole checklist */}
                      <div
                        className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setCollapsedTodos(prev => ({ ...prev, [sessionId]: !prev[sessionId] })); }}
                        title={tCollapsed ? 'กางรายการงาน' : 'หดรายการงาน'}
                      >
                        <span className="text-[9px] shrink-0" title="Task checklist (TodoWrite)">{complete ? '✅' : '☑️'}</span>
                        <span className={`text-[9px] font-mono tabular-nums shrink-0 ${complete ? 'text-emerald-400' : (mi.tokens || 'text-amber-500')}`}>{done}/{total}</span>
                        <div className={`h-1 rounded-full ${mi.tokenBarTrack || 'bg-gray-700/30'} overflow-hidden w-[36px] shrink-0`}>
                          <div className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500/60' : 'bg-amber-500/60'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {!tCollapsed && (() => {
                        const rCollapsed = !!collapsedRemaining[sessionId];
                        const doneList = main.todos.filter(t => t.status === 'completed');
                        const remainList = main.todos.filter(t => t.status !== 'completed'); // in-progress + queued, original order
                        const labelCls = `flex items-center gap-1 text-[8px] uppercase tracking-wider ${textMuted} hover:text-gray-300 transition-colors`;
                        return (
                          <div className="mt-0.5 space-y-px">
                            {/* DONE group */}
                            {doneList.length > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); setCollapsedDone(prev => ({ ...prev, [sessionId]: !prev[sessionId] })); }} className={labelCls} title={dCollapsed ? 'แสดงงานที่เสร็จ' : 'ซ่อนงานที่เสร็จ'}>
                                <span className="font-mono tabular-nums">{doneList.length} done</span>
                              </button>
                            )}
                            {!dCollapsed && doneList.map((t, i) => (
                              <div key={`d${i}`} className="flex items-start gap-1 min-w-0">
                                <span className="text-[8px] shrink-0 mt-px text-emerald-400/60">✓</span>
                                <span className="text-[9px] leading-snug line-clamp-1 min-w-0 text-emerald-400/50" title={t.content}>{t.content}</span>
                              </div>
                            ))}
                            {/* REMAINING group — in-progress (▶ highlighted) + queued (○), original order */}
                            {remainList.length > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); setCollapsedRemaining(prev => ({ ...prev, [sessionId]: !prev[sessionId] })); }} className={`${labelCls} ${doneList.length > 0 ? 'mt-1' : ''}`} title={rCollapsed ? 'แสดงงานที่เหลือ' : 'ซ่อนงานที่เหลือ'}>
                                <span className="font-mono tabular-nums">{remainList.length} remaining</span>
                              </button>
                            )}
                            {!rCollapsed && remainList.map((t, i) => (
                              t.status === 'in_progress' ? (
                                <div key={`r${i}`} className="flex items-start gap-1 min-w-0">
                                  <span className={`text-[8px] shrink-0 mt-px ${mi.tokens || 'text-amber-400'}`}>▶</span>
                                  <span className={`text-[9px] leading-snug font-medium line-clamp-2 min-w-0 ${mi.tokens || 'text-amber-300'}`} title={t.content}>{t.activeForm || t.content}</span>
                                </div>
                              ) : (
                                <div key={`r${i}`} className="flex items-start gap-1 min-w-0">
                                  <span className={`text-[8px] shrink-0 mt-px ${textMuted}`}>○</span>
                                  <span className={`text-[9px] leading-snug line-clamp-1 min-w-0 ${textMuted}`} title={t.content}>{t.content}</span>
                                </div>
                              )
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* ── REFERENCE: git changeset + version (accumulated, not live) → cost ── */}

                {/* branch + git diff (left) · CC version + entrypoint (right) — clickable for detail */}
                {!compact && (main?.gitDiff || main?.gitBranch || main?.ccVersion || main?.entrypoint) && (
                  <div
                    className="mt-1 pl-4 flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setDetailSession({ sessionId, main, tasks, teamInfo, sessionTokens })}
                    title="Click for session details"
                  >
                    {main?.gitBranch && (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${mi.branchBg || 'bg-violet-500/10'} ${mi.branchText || 'text-violet-300'}`} title={`Git branch: ${main.gitBranch}`}>
                        <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" className="opacity-80"><path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.25 2.25 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.49 2.49 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 5.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/></svg>
                        {main.gitBranch}
                      </span>
                    )}
                    {main?.gitDiff && (
                      <div className={`inline-flex items-center gap-0 rounded-md border ${gi.fileBorder || 'border-gray-700/40'} overflow-hidden shrink-0 ${expanded ? 'text-[10px]' : 'text-[9px]'} font-mono tabular-nums`}>
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 ${gi.addBg || 'bg-green-500/8'}`}>
                          <span className={`w-1 h-1 rounded-full ${gi.addDot || 'bg-green-400'}`} />
                          <span className={gi.addText || 'text-green-400'}>+{main.gitDiff.additions.toLocaleString()}</span>
                        </span>
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 ${gi.delBg || 'bg-red-500/8'} border-l ${gi.fileBorder || 'border-gray-700/40'}`}>
                          <span className={`w-1 h-1 rounded-full ${gi.delDot || 'bg-red-400'}`} />
                          <span className={gi.delText || 'text-red-400'}>-{main.gitDiff.deletions.toLocaleString()}</span>
                        </span>
                        {main.gitDiff.files > 0 && (
                          <span className={`px-1.5 py-0.5 ${gi.fileText || 'text-gray-500'} border-l ${gi.fileBorder || 'border-gray-700/40'}`}>
                            {main.gitDiff.files} files
                          </span>
                        )}
                      </div>
                    )}
                    {(main?.ccVersion || main?.entrypoint) && (
                      <div className="ml-auto flex items-center gap-1 shrink-0">
                        {main.ccVersion && (
                          <span className={`text-[9px] font-mono ${textMuted}`} title="Claude Code version">v{main.ccVersion}</span>
                        )}
                        {main.entrypoint && (
                          <span className={`text-[9px] ${textMuted}`} title={`Entrypoint: ${main.entrypoint}`}>{main.entrypoint.replace(/^claude-/, '')}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Timer + token breakdown: duration · session · total · reuse (right-aligned, click for detail) */}
                {!compact && (sessionTotal > 0 || mainDuration) && (
                  <div className="mt-1 pl-4 flex items-center gap-1.5">
                    {sessionTotal > 0 && (
                      <TokenBreakdown session={sessionTokens} total={sessionTotal} cc1h={main?.cacheCreation1h || 0} reuse={sessionReuse} savedUsd={sessionSaved} scope="session" colors={colors} align="left" />
                    )}
                    {mainDuration && (
                      <span className={`inline-flex items-center gap-0.5 font-mono text-[9px] tabular-nums whitespace-nowrap ml-auto ${mi.duration || 'text-gray-400'}`} title="Session duration / elapsed">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        {mainDuration}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Team Section - grouped team members */}
              {teamTasks.length > 0 && (
                <div className={`border-t ${borderColor}`}>
                  {/* Team header */}
                  <div className={`${expanded ? 'pr-3 pl-7 py-1.5' : 'pr-2 pl-5 py-1'} ${tm.headerBg || 'bg-indigo-500/[0.05]'} border-b ${tm.headerBorder || 'border-indigo-500/10'} flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded ${tm.iconBg || 'bg-white/15'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tm.iconText || 'text-gray-100'}>
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </span>
                      <span className={`text-[10px] font-semibold ${tm.nameText || 'text-gray-100'}`}>{teamInfo.name}</span>
                      <span className={`text-[9px] ${textMuted}`}>{teamTasks.length} member{teamTasks.length !== 1 ? 's' : ''}</span>
                      {teamHealth && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${
                          teamHealth.health === 'red' ? `${(hl.red || {}).bg || 'bg-red-500/15'} ${(hl.red || {}).text || 'text-red-400'} ${(hl.red || {}).border || 'border-red-500/20'}` :
                          teamHealth.health === 'orange' ? `${(hl.orange || {}).bg || 'bg-orange-500/15'} ${(hl.orange || {}).text || 'text-orange-400'} ${(hl.orange || {}).border || 'border-orange-500/20'}` :
                          teamHealth.health === 'yellow' ? `${(hl.yellow || {}).bg || 'bg-yellow-500/15'} ${(hl.yellow || {}).text || 'text-yellow-400'} ${(hl.yellow || {}).border || 'border-yellow-500/20'}` :
                          `${(hl.green || {}).bg || 'bg-emerald-500/15'} ${(hl.green || {}).text || 'text-emerald-400'} ${(hl.green || {}).border || 'border-emerald-500/20'}`
                        }`} title={teamHealth.issues.length > 0 ? teamHealth.issues.join(', ') : 'Healthy'}>
                          {teamHealth.health === 'red' ? '🔴' : teamHealth.health === 'orange' ? '🟠' : teamHealth.health === 'yellow' ? '🟡' : '🟢'}
                          {teamHealth.issues.length > 0 ? ` ${teamHealth.issues.join(' · ')}` : ' Healthy'}
                        </span>
                      )}
                    </div>
                    <span className={`font-mono text-[9px] tabular-nums ${mi.tokens || 'text-amber-500'}`}>
                      {teamTotalTokens > 0 ? formatTokens(teamTotalTokens) : ''}
                    </span>
                  </div>
                  {/* Team members */}
                  <div className={`${tasksBg} pb-2`}>
                    {teamTasks.map((task, i) => renderTask(task, i, teamTasks.length, { expanded, compact, textMuted, borderColor, getStatus, getModel, getTypeInfo, getDuration, formatTime, formatTokens, getHealthIndicator, agentConflicts, teamTotalTokens }))}
                  </div>
                </div>
              )}

              {/* Non-team tasks — grouped under a "Subagents" header that absorbs the running count
                  and ties the rows to the parent session (so they don't read as orphaned cards) */}
              {nonTeamTasks.length > 0 && (() => {
                const naActive = nonTeamTasks.filter(t => t.status === 'active').length;
                const naTokens = nonTeamTasks.reduce((s, t) => s + (t.tokens || (t.inputTokens || 0) + (t.outputTokens || 0) || 0), 0);
                const collapsed = !!collapsedSubs[sessionId];
                return (
                  <div className={`border-t ${borderColor}`}>
                    {/* Subagents group header — click to collapse/expand the rows */}
                    <div
                      className={`${expanded ? 'pr-3 pl-7 py-1.5' : 'pr-2 pl-5 py-1'} ${mi.subagentHeaderBg || 'bg-white/[0.03]'} border-b ${borderColor} flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.05] transition-colors`}
                      onClick={() => setCollapsedSubs(prev => ({ ...prev, [sessionId]: !prev[sessionId] }))}
                      title={collapsed ? 'กางรายการ subagent' : 'หดรายการ subagent'}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[7px] shrink-0 ${textMuted}`}>{collapsed ? '▸' : '▾'}</span>
                        <span className={`text-[10px] shrink-0 ${textMuted}`}>⚙</span>
                        <span className={`text-[10px] font-semibold ${colors?.text?.secondary || 'text-gray-300'}`}>Subagents</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                          naActive > 0
                            ? `${(as.active || {}).bg || 'bg-emerald-500/15'} ${(as.active || {}).text || 'text-emerald-400'}`
                            : `${(as.stopped || {}).bg || 'bg-gray-500/15'} ${(as.stopped || {}).text || 'text-gray-500'}`
                        }`}>
                          {naActive > 0 ? `${naActive}/${nonTeamTasks.length} running` : `${nonTeamTasks.length} done`}
                        </span>
                      </div>
                      {naTokens > 0 && (
                        <span className={`font-mono text-[9px] tabular-nums shrink-0 ${mi.tokens || 'text-amber-500'}`}>{formatTokens(naTokens)}</span>
                      )}
                    </div>
                    {/* Subagent rows */}
                    {!collapsed && (
                      <div className={`${tasksBg} pb-2`}>
                        {nonTeamTasks.map((task, i) => renderTask(task, i, nonTeamTasks.length, { expanded, compact, textMuted, borderColor, getStatus, getModel, getTypeInfo, getDuration, formatTime, formatTokens, getHealthIndicator, agentConflicts, teamTotalTokens: 0 }))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!hideFooter && <div className={`h-5 flex items-center justify-between px-2 border-t ${borderColor} ${colors?.bg?.tertiary || 'bg-black/20'} text-[10px]`}>
        <div className="flex items-center gap-2">
          {/* Sessions */}
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${activeMainCount > 0 ? (mi.footerDotActive || 'bg-emerald-400') + ' animate-pulse' : (mi.footerDotInactive || 'bg-gray-600')}`} />
            <span className={activeMainCount > 0 ? (mi.footerActiveText || 'text-emerald-400') : (mi.footerDoneText || 'text-gray-500')}>
              {activeMainCount} session{activeMainCount !== 1 ? 's' : ''}
            </span>
          </span>
          {/* Tasks breakdown */}
          {(activeTaskCount > 0 || stoppedTaskCount > 0) && (
            <span className={mi.footerDoneText || 'text-gray-500'}>
              {activeTaskCount > 0 && (
                <span className={mi.footerActiveText || 'text-emerald-400'}>{activeTaskCount} running</span>
              )}
              {activeTaskCount > 0 && stoppedTaskCount > 0 && ' · '}
              {stoppedTaskCount > 0 && (
                <span className={mi.footerDoneText || 'text-gray-500'}>{stoppedTaskCount} done</span>
              )}
            </span>
          )}
        </div>
        {totalTokens > 0 && (
          <span className={`font-mono tabular-nums ${mi.tokens || 'text-amber-500'}`}>{formatTokens(totalTokens)}</span>
        )}
      </div>}

      {/* Reply timeline — assistant replies for this session, oldest → newest, live-appends */}
      {fullMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setFullMsg(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className={`relative w-[560px] max-w-[92vw] max-h-[80vh] flex flex-col rounded-xl border ${borderColor} bg-[#1e1e20] shadow-2xl shadow-black/50`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`shrink-0 px-4 pt-3 bg-[#1e1e20] flex items-center justify-between`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[12px] font-semibold ${colors?.text?.primary || 'text-white'}`}>↳ Reply timeline</span>
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 shrink-0" title="Auto-appends new replies">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />live
                </span>
              </div>
              <button onClick={() => setFullMsg(null)} className={`p-1 -mr-1 rounded hover:bg-white/10 ${textMuted} shrink-0`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Search toolbar */}
            <div className={`shrink-0 px-4 pt-2 pb-3 border-b ${borderColor} bg-[#1e1e20]`}>
              <div className="relative flex items-center">
                <span className={`absolute left-2.5 text-[10px] pointer-events-none ${textMuted}`}>🔍</span>
                <input
                  type="text"
                  value={timelineQuery}
                  onChange={(e) => setTimelineQuery(e.target.value)}
                  placeholder="Search replies…"
                  className={`w-full text-[10px] pl-7 pr-24 py-1.5 rounded-lg bg-white/[0.04] border border-transparent focus:border-gray-500/40 focus:bg-white/[0.06] outline-none transition-colors ${colors?.text?.secondary || 'text-gray-300'}`}
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  <span className={`text-[9px] font-mono ${textMuted}`}>
                    {timelineQuery
                      ? `${fullMsg.messages.filter(m => m.text.toLowerCase().includes(timelineQuery.toLowerCase())).length} found`
                      : `${fullMsg.total} replies`}
                  </span>
                  {timelineQuery && (
                    <button onClick={() => setTimelineQuery('')} className={`text-[11px] ${textMuted} hover:text-gray-300`}>✕</button>
                  )}
                </div>
              </div>
            </div>
            <div ref={timelineRef} className="px-2 py-1 overflow-y-auto divide-y divide-white/[0.06]">
              {fullMsg.loading && <div className={`text-[10px] px-2 py-2 ${textMuted}`}>Loading timeline…</div>}
              {fullMsg.error && <div className="text-[10px] px-2 py-2 text-amber-400">Failed to load ({fullMsg.error})</div>}
              {!fullMsg.loading && fullMsg.total > fullMsg.messages.length && (
                <button onClick={loadOlderMessages} className={`w-full text-[9px] py-1.5 ${textMuted} hover:text-gray-300 transition-colors`}>
                  ↑ Load older ({fullMsg.total - fullMsg.messages.length} more)
                </button>
              )}
              {!fullMsg.loading && !fullMsg.error && fullMsg.messages.length === 0 && (
                <div className={`text-[10px] px-2 py-2 ${textMuted}`}>No replies yet in this session</div>
              )}
              {!fullMsg.loading && timelineQuery && fullMsg.messages.length > 0 && fullMsg.messages.every(m => !m.text.toLowerCase().includes(timelineQuery.toLowerCase())) && (
                <div className={`text-[10px] px-2 py-2 ${textMuted}`}>No replies match “{timelineQuery}”</div>
              )}
              {fullMsg.messages.map((m, i) => {
                if (timelineQuery && !m.text.toLowerCase().includes(timelineQuery.toLowerCase())) return null;
                return (
                <div
                  key={i}
                  className={`group px-2 py-3 cursor-pointer transition-colors ${copiedIdx === i ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.02]'}`}
                  title="Click to copy"
                  onClick={(e) => { if (e.target.closest('a')) return; copyMessage(m.text, i); }}
                >
                  <div className={`flex items-center gap-1.5 mb-1 text-[8px] ${textMuted}`}>
                    <span className="text-emerald-400/70">↳</span>
                    <span className="font-mono">#{fullMsg.total - fullMsg.messages.length + i + 1}</span>
                    {m.ts && <span className="font-mono" title={new Date(m.ts).toLocaleString()}>· {formatRelativeTime(m.ts)}</span>}
                    {copiedIdx === i
                      ? <span className="ml-auto text-emerald-400 font-medium">✓ copied</span>
                      : <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">⧉ copy</span>}
                  </div>
                  <div className={`text-[12px] font-light leading-[1.7] break-words ${colors?.text?.secondary || 'text-gray-300'}`}>
                    {timelineQuery
                      ? <div className="whitespace-pre-wrap">{highlightText(m.text, timelineQuery)}</div>
                      : <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{m.text}</ReactMarkdown>}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Background job detail popup */}
      {bgDetail && (() => {
        const stColor = bgDetail.status === 'running' ? 'bg-amber-500/15 text-amber-400'
          : bgDetail.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
          : (bgDetail.status === 'failed' || bgDetail.status === 'error') ? 'bg-red-500/15 text-red-400'
          : 'bg-gray-500/15 text-gray-400';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setBgDetail(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className={`relative w-[440px] max-w-[90vw] max-h-[70vh] flex flex-col rounded-xl border ${borderColor} ${colors?.bg?.primary || 'bg-[#0f0f17]'} shadow-2xl shadow-black/50`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`sticky top-0 px-4 py-3 border-b ${borderColor} ${colors?.bg?.secondary || 'bg-[#13131f]'} flex items-center justify-between`}>
                <span className={`flex items-center gap-2 text-[11px] font-medium ${colors?.text?.primary || 'text-white'}`}>
                  ⚙ Background job
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${stColor}`}>{bgDetail.status}</span>
                </span>
                <button onClick={() => setBgDetail(null)} className={`p-1 rounded hover:bg-white/10 ${textMuted}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 py-3 space-y-3 overflow-y-auto">
                <div>
                  <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Description</div>
                  <div className={`text-[11px] leading-relaxed ${colors?.text?.secondary || 'text-gray-300'}`}>{bgDetail.description || '—'}</div>
                </div>
                {bgDetail.command && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Command</div>
                    <pre className={`text-[10px] font-mono p-2 rounded bg-black/40 overflow-x-auto whitespace-pre-wrap break-words ${colors?.text?.secondary || 'text-gray-300'}`}>{bgDetail.command}</pre>
                  </div>
                )}
                {bgDetail.type && (
                  <div className={`text-[9px] ${textMuted}`}>type: <span className={`font-mono ${colors?.text?.secondary || 'text-gray-300'}`}>{bgDetail.type}</span></div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Session Detail Popup */}
      {detailSession && (() => {
        const d = detailSession;
        const m = d.main;
        const status = m ? getStatus(m.status) : getStatus('unknown');
        const model = m ? getModel(m.model) : null;
        const ctxPct = m?.contextPct || 0;
        const ctxColor = ctxPct >= 80 ? 'text-red-400' : ctxPct >= 50 ? 'text-amber-400' : 'text-emerald-400';
        const ctxBarColor = ctxPct >= 80 ? 'bg-red-500' : ctxPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDetailSession(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className={`relative w-[380px] max-h-[70vh] overflow-y-auto rounded-xl border ${borderColor} ${colors?.bg?.primary || 'bg-[#0f0f17]'} shadow-2xl shadow-black/50`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`sticky top-0 px-4 py-3 border-b ${borderColor} ${colors?.bg?.secondary || 'bg-[#13131f]'} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {d.isSubagent && <span className={`text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400`}>Subagent</span>}
                  {m?.agentName && <span className={`text-[11px] font-medium ${colors?.text?.primary || 'text-white'}`}>{m.agentName}</span>}
                  {model && <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${model.color} ${model.bg}`}>{model.name}</span>}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${status.bg}`}>
                    <span className={`text-[11px] ${status.color}`}>{status.icon}</span>
                    <span className={`text-[10px] ${status.color}`}>{status.label}</span>
                  </span>
                </div>
                <button onClick={() => setDetailSession(null)} className={`p-1 rounded hover:bg-white/10 ${textMuted}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Project */}
                {m?.cwd && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Project</div>
                    <div className="text-[11px] font-mono text-cyan-400">{m.cwd}</div>
                  </div>
                )}

                {/* Session ID */}
                <div>
                  <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Session</div>
                  <code className={`text-[10px] font-mono ${textMuted}`}>{d.sessionId}</code>
                </div>

                {/* Description */}
                {(m?.description || m?.lastTask) && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Task</div>
                    <div className={`text-[11px] ${colors?.text?.primary || 'text-gray-200'}`}>{m.description || m.lastTask}</div>
                  </div>
                )}

                {/* Tools Used */}
                {m?.toolsUsed?.length > 0 && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Tools</div>
                    <div className="flex flex-wrap gap-1">
                      {m.toolsUsed.map((tool, idx) => (
                        <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded ${mi.toolBadgeBg || 'bg-sky-500/10'} ${mi.toolBadgeText || 'text-sky-400/80'}`}>{tool}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tokens */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`rounded-lg p-2 ${colors?.bg?.secondary || 'bg-white/5'}`}>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted}`}>Total</div>
                    <div className="text-[13px] font-mono font-bold text-amber-400">{formatTokens(d.sessionTokens)}</div>
                  </div>
                  <div className={`rounded-lg p-2 ${colors?.bg?.secondary || 'bg-white/5'}`}>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted}`}>Input</div>
                    <div className="text-[13px] font-mono font-bold text-blue-400">{formatTokens(m?.inputTokens || 0)}</div>
                  </div>
                  <div className={`rounded-lg p-2 ${colors?.bg?.secondary || 'bg-white/5'}`}>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted}`}>Output</div>
                    <div className="text-[13px] font-mono font-bold text-purple-400">{formatTokens(m?.outputTokens || 0)}</div>
                  </div>
                </div>

                {/* Context Window */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] uppercase tracking-wider ${textMuted}`}>Context Window</span>
                    <span className={`text-[12px] font-mono font-bold ${ctxColor}`}>{ctxPct}%</span>
                  </div>
                  <div className={`h-2 rounded-full ${mi.tokenBarTrack || 'bg-gray-700/40'} overflow-hidden`}>
                    <div className={`h-full rounded-full ${ctxBarColor} transition-all`} style={{ width: `${Math.min(ctxPct, 100)}%` }} />
                  </div>
                  {m?.lastInputTokens > 0 && (
                    <div className={`text-[9px] ${textMuted} mt-0.5`}>{m.lastInputTokens.toLocaleString()} tokens used</div>
                  )}
                </div>

                {/* Git Diff */}
                {m?.gitDiff && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1.5`}>Git Changes</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-mono font-bold text-green-400">+{m.gitDiff.additions.toLocaleString()}</span>
                      <span className="text-[13px] font-mono font-bold text-red-400">-{m.gitDiff.deletions.toLocaleString()}</span>
                      <span className={`text-[11px] ${textMuted}`}>{m.gitDiff.files} files</span>
                    </div>
                  </div>
                )}

                {/* Duration */}
                {m && getDuration(m) && (
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] uppercase tracking-wider ${textMuted}`}>Duration</span>
                    <span className="text-[12px] font-mono text-gray-300">{getDuration(m)}</span>
                  </div>
                )}

                {/* Team */}
                {d.teamInfo && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1`}>Team</div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                      👥 {d.teamInfo.name}
                    </span>
                  </div>
                )}

                {/* Subagents */}
                {d.tasks.length > 0 && (
                  <div>
                    <div className={`text-[9px] uppercase tracking-wider ${textMuted} mb-1.5`}>Subagents ({d.tasks.length})</div>
                    <div className="space-y-1">
                      {d.tasks.map((task, i) => {
                        const ts = getStatus(task.status);
                        const tm = task.model ? getModel(task.model) : null;
                        const tTokens = task.tokens || (task.inputTokens || 0) + (task.outputTokens || 0);
                        return (
                          <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded ${colors?.bg?.secondary || 'bg-white/5'}`}>
                            <span className={`text-[10px] ${ts.color}`}>{ts.icon}</span>
                            {tm && <span className={`text-[9px] px-1 py-0.5 rounded ${tm.color} ${tm.bg}`}>{tm.name}</span>}
                            {task.agentName && <span className={`text-[10px] ${textMuted} truncate flex-1`}>{task.agentName}</span>}
                            {!task.agentName && <span className={`text-[10px] ${textMuted} truncate flex-1`}>{task.id?.slice(0, 8) || '—'}</span>}
                            {tTokens > 0 && <span className="text-[9px] font-mono text-amber-500 shrink-0">{formatTokens(tTokens)}</span>}
                            {getDuration(task) && <span className={`text-[9px] font-mono ${textMuted} shrink-0`}>{getDuration(task)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

AgentTree.propTypes = {
  agents: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    status: PropTypes.string,
    model: PropTypes.string,
    tokens: PropTypes.number,
    inputTokens: PropTypes.number,
    outputTokens: PropTypes.number,
    elapsedFormatted: PropTypes.string,
    durationFormatted: PropTypes.string,
    description: PropTypes.string,
    lastTask: PropTypes.string,
    toolsUsed: PropTypes.arrayOf(PropTypes.string),
    sessionId: PropTypes.string
  })),
  colors: PropTypes.shape({
    text: PropTypes.shape({
      primary: PropTypes.string,
      secondary: PropTypes.string,
      muted: PropTypes.string
    }),
    bg: PropTypes.shape({
      secondary: PropTypes.string,
      tertiary: PropTypes.string
    }),
    border: PropTypes.string
  }),
  compact: PropTypes.bool,
  expanded: PropTypes.bool,
  smartStatus: PropTypes.object,
  teams: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    leadSessionId: PropTypes.string,
    memberCount: PropTypes.number,
    members: PropTypes.array,
    fileConflicts: PropTypes.array,
    status: PropTypes.string
  }))
};
