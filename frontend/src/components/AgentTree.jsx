import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * AgentTree - Compact but COMPLETE information
 * No truncation - show all data
 */
export function AgentTree({ agents = [], colors = {}, compact = false, expanded = false, smartStatus = {}, teams = [] }) {
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

  // Status config (5-level: active → idle → stale → timeout → stopped)
  const getStatus = (status) => {
    switch (status) {
      case 'active':
      case 'running':
        return { icon: '●', color: 'text-emerald-400', bg: 'bg-emerald-500/15', pulse: true, label: 'Active' };
      case 'idle':
        return { icon: '●', color: 'text-yellow-400', bg: 'bg-yellow-500/15', pulse: false, label: 'Idle' };
      case 'stale':
        return { icon: '●', color: 'text-orange-400', bg: 'bg-orange-500/15', pulse: false, label: 'Stale' };
      case 'timeout':
        return { icon: '●', color: 'text-amber-400', bg: 'bg-amber-500/15', pulse: true, label: 'Timeout' };
      case 'stopped':
        return { icon: '○', color: 'text-gray-500', bg: 'bg-gray-500/15', pulse: false, label: 'Stopped' };
      default:
        return { icon: '○', color: 'text-gray-600', bg: 'bg-gray-500/15', pulse: false, label: 'Unknown' };
    }
  };

  // Model display - FULL names with version
  const getModel = (model) => {
    // Extract version: "claude-opus-4-6" or "claude-opus-4-5-20251101" -> "4.6" / "4.5"
    const versionMatch = model?.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
    const version = versionMatch ? ` ${versionMatch[1]}.${versionMatch[2]}` : '';

    if (model?.includes('opus')) return { name: `Opus${version}`, color: 'text-violet-400', bg: 'bg-violet-500/15' };
    if (model?.includes('sonnet')) return { name: `Sonnet${version}`, color: 'text-sky-400', bg: 'bg-sky-500/15' };
    if (model?.includes('haiku')) return { name: `Haiku${version}`, color: 'text-teal-400', bg: 'bg-teal-500/15' };
    return null; // Don't show if unknown
  };

  // Type display - FULL names with distinct colors
  const getTypeInfo = (type) => {
    if (!type || type === 'main') return null;
    const name = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');

    // Agent type colors - Distinct from model colors (Opus=violet, Sonnet=sky, Haiku=teal)
    // Use PINK/ROSE for all agent types - clearly different from models
    const typeColors = {
      'explore': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
      'plan': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
      'bash': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
      'general-purpose': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
      'code-reviewer': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
      'subagent': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
    };

    const colors = typeColors[type.toLowerCase()] || { bg: 'bg-pink-500/15', text: 'text-pink-400' };
    return { name, ...colors };
  };

  const getDuration = (agent) => agent.elapsedFormatted || agent.durationFormatted || null;

  // Parse lastTask into tool + detail for better display
  const parseLastTask = (lastTask) => {
    if (!lastTask || lastTask === 'Main Session') return null;

    // Tool colors - MATCH Activity Feed exactly (ActivityItem.jsx)
    const toolConfig = {
      'Read': { icon: '📖', color: 'text-sky-500', bg: 'bg-sky-500/15' },
      'Glob': { icon: '📂', color: 'text-sky-500', bg: 'bg-sky-500/15' },
      'Grep': { icon: '🔍', color: 'text-sky-500', bg: 'bg-sky-500/15' },
      'Edit': { icon: '✏️', color: 'text-orange-500', bg: 'bg-orange-500/15' },
      'Write': { icon: '📝', color: 'text-orange-500', bg: 'bg-orange-500/15' },
      'Bash': { icon: '⚡', color: 'text-amber-500', bg: 'bg-amber-500/15' },
      'Task': { icon: '🔀', color: 'text-violet-500', bg: 'bg-violet-500/15' },
      'WebFetch': { icon: '🌐', color: 'text-cyan-500', bg: 'bg-cyan-500/15' },
      'WebSearch': { icon: '🔎', color: 'text-cyan-500', bg: 'bg-cyan-500/15' },
      'TeamCreate': { icon: '👥', color: 'text-indigo-500', bg: 'bg-indigo-500/15' },
      'SendMessage': { icon: '📨', color: 'text-cyan-500', bg: 'bg-cyan-500/15' },
      'TeamDelete': { icon: '🧹', color: 'text-gray-500', bg: 'bg-gray-500/15' },
    };

    // Try to extract tool name from start of lastTask
    const match = lastTask.match(/^(\w+)\s+(.+)$/);
    if (match) {
      const [, tool, detail] = match;
      const config = toolConfig[tool];
      if (config) {
        return { tool, detail, ...config };
      }
    }

    // No tool detected - treat as user prompt
    return { tool: null, detail: lastTask, icon: '💬', color: 'text-gray-400' };
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

  // Theme-aware colors
  const textMuted = colors?.text?.muted || 'text-gray-500';
  const borderColor = colors?.border || 'border-gray-800/40';
  const tasksBg = colors?.bg?.tasks || 'bg-black/10';

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
        className={`${ctx.expanded ? 'px-3 pt-3 pb-0' : 'px-2 pt-2 pb-0'} ${i < totalCount - 1 ? 'border-b border-gray-800/20' : ''} ${task.status === 'stopped' ? 'opacity-50' : ''}`}
      >
        <div className={`${ctx.expanded ? 'pl-4 space-y-1.5' : 'pl-3 space-y-1'}`}>
          {/* Line 1: Status (fixed) + Model + Type + Name + Health + Duration + Tokens */}
          <div className="flex items-center flex-nowrap">
            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
              <span className={`${ctx.textMuted} text-[9px] shrink-0`}>└</span>
              {task.teamName && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15`} title={`Team: ${task.teamName}`}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-gray-100">
                    <circle cx="8" cy="4.5" r="3" fill="currentColor"/>
                    <path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" fill="currentColor" opacity="0.7"/>
                  </svg>
                </span>
              )}
              {task.agentName && (
                <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${task.teamName ? 'bg-white/15 text-gray-100' : 'bg-cyan-500/15 text-cyan-400'}`}>
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
              {healthWarnings.map((w, idx) => (
                <span key={idx} className={`${ctx.expanded ? 'text-[8px]' : 'text-[7px]'} px-1 py-0.5 rounded-full shrink-0 ${
                  w.level === 'red' ? 'bg-red-500/15 text-red-400' :
                  w.level === 'orange' ? 'bg-orange-500/15 text-orange-400' :
                  'bg-yellow-500/15 text-yellow-400'
                }`} title={w.title}>
                  {w.icon}
                </span>
              ))}
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
              <span className={`font-mono ${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums w-[48px] text-right whitespace-nowrap ${displayDuration ? 'text-gray-400' : 'text-gray-500'}`}>
                {displayDuration || (task.stoppedAt || task.lastSeen ? ctx.formatTime(task.stoppedAt || task.lastSeen) : '')}
              </span>
              <span className={`font-mono ${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums text-amber-500 w-[45px] text-right`}>
                {tokens > 0 ? ctx.formatTokens(tokens) : ''}
              </span>
            </div>
          </div>

          {/* Line 2: Tools + Token bar */}
          {!ctx.compact && (task.toolsUsed?.length > 0 || tokenPct > 0) && (
            <div className={`flex items-center gap-1 ${ctx.expanded ? 'pl-8 flex-wrap' : 'pl-8'}`}>
              {task.toolsUsed?.length > 0 && (
                <>
                  <span className="text-[9px] text-gray-500 shrink-0">🔧</span>
                  {task.toolsUsed.map((tool, idx) => (
                    <span key={idx} className={`${ctx.expanded ? 'text-[9px]' : 'text-[8px]'} px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80`}>
                      {tool}
                    </span>
                  ))}
                </>
              )}
              {tokenPct > 0 && (
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  <div className="h-1 rounded-full bg-gray-700/30 overflow-hidden w-[50px]">
                    <div className="h-full rounded-full bg-amber-500/50 transition-all" style={{ width: `${Math.min(tokenPct, 100)}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-amber-500/70">{tokenPct}%</span>
                </div>
              )}
            </div>
          )}

          {/* Line 3: Description */}
          {!ctx.compact && desc && (
            <div className="flex items-center gap-1.5 pl-8">
              <span className={`${ctx.expanded ? 'text-[10px]' : 'text-[9px]'} text-gray-400 truncate flex-1 min-w-0`}>
                💬 {desc}
              </span>
              {task.id && (
                <code className="text-gray-600 font-mono text-[8px] shrink-0">{task.id.slice(0, 7)}</code>
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
          const mainStatus = main ? getStatus(main.status) : getStatus('unknown');
          const smart = smartStatus[sessionId];
          const mainModel = main ? getModel(main.model) : null;
          const sessionTokens = (main?.tokens || 0) + tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);
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
            <div key={sessionId} className={`${expanded ? `flex flex-col rounded-lg border ${borderColor}` : `border-b ${borderColor}`} ${isActive ? 'bg-emerald-500/[0.03]' : 'opacity-50'}`}>
              {/* Session Header */}
              <div className={`${expanded ? 'px-3 py-2' : 'px-2 py-1.5'} shrink-0`}>
                {/* Line 1: Number + Model + Status + Duration + Tokens */}
                <div className="flex items-center flex-nowrap">
                  <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                    <span className="text-[11px] font-mono font-bold text-white shrink-0 w-[16px] text-right">{sessionNumber[sessionId]}.</span>
                    {mainModel && (
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 whitespace-nowrap ${mainModel.color} ${mainModel.bg}`}>
                        {mainModel.name}
                      </span>
                    )}
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
                  </div>
                  <div className="shrink-0 flex items-center gap-1 pl-1">
                    <span className="font-mono text-[10px] tabular-nums text-gray-400 w-[48px] text-right whitespace-nowrap">
                      {main && getDuration(main) ? getDuration(main) : ''}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-amber-500 w-[45px] text-right">
                      {formatTokens(sessionTokens)}
                    </span>
                  </div>
                </div>

                {/* Project name + Team badge */}
                {(main?.cwd || teamInfo) && (
                  <div className="mt-0.5 pl-[22px] flex items-center gap-1.5">
                    {main?.cwd && (
                      <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/70" style={{ fontFamily: "'Share Tech Mono', 'Fira Code', 'JetBrains Mono', monospace", letterSpacing: '0.15em' }} title={main.cwd}>
                        {main.cwd.split(/[\\/]/).pop()}
                      </span>
                    )}
                    {hasTeam && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${teamInfo.status === 'active' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' : 'bg-gray-500/15 text-gray-400 border-gray-500/20'} border whitespace-nowrap`} title={`Team: ${teamInfo.name} (${teamTasks.length} members)`}>
                        👥 {teamInfo.name}
                      </span>
                    )}
                    {hasConflicts && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap" title={`${teamInfo.fileConflicts.length} file conflict(s)`}>
                        ⚠ {teamInfo.fileConflicts.length} conflict{teamInfo.fileConflicts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Line 2: Activity + Session ID - hidden in compact, hidden if no activity */}
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
                      <span className={`text-[10px] text-gray-400 ${expanded ? '' : 'truncate'} flex-1 min-w-0`}>
                        {parsed.detail}
                      </span>
                      <code className="text-gray-600 font-mono text-[8px] shrink-0">{sessionId.slice(0, 7)}</code>
                    </div>
                  );
                })()}

                {/* Line 3: Task count + Git Diff - hidden in compact */}
                {!compact && (tasks.length > 0 || main?.gitDiff) && (
                  <div className="mt-1 pl-4 flex items-center gap-1.5 min-w-0">
                    {tasks.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        activeTaskCount > 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gray-500/15 text-gray-500'
                      }`}>
                        {activeTaskCount > 0 ? `${activeTaskCount}/${tasks.length} running` : `${tasks.length} done`}
                      </span>
                    )}
                    {main?.gitDiff && (
                      <div className={`inline-flex items-center gap-0 rounded-md border border-gray-700/40 overflow-hidden ${expanded ? 'text-[10px]' : 'text-[9px]'} font-mono tabular-nums`}>
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/8">
                          <span className="w-1 h-1 rounded-full bg-green-400" />
                          <span className="text-green-400">+{main.gitDiff.additions.toLocaleString()}</span>
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/8 border-l border-gray-700/40">
                          <span className="w-1 h-1 rounded-full bg-red-400" />
                          <span className="text-red-400">-{main.gitDiff.deletions.toLocaleString()}</span>
                        </span>
                        {main.gitDiff.files > 0 && (
                          <span className="px-1.5 py-0.5 text-gray-500 border-l border-gray-700/40">
                            {main.gitDiff.files} files
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Team Section - grouped team members */}
              {teamTasks.length > 0 && (
                <div className={`border-t ${borderColor}`}>
                  {/* Team header */}
                  <div className={`${expanded ? 'pr-3 pl-7 py-1.5' : 'pr-2 pl-5 py-1'} bg-indigo-500/[0.05] border-b border-indigo-500/10 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded bg-white/15">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-100">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </span>
                      <span className="text-[10px] font-semibold text-gray-100">{teamInfo.name}</span>
                      <span className={`text-[9px] ${textMuted}`}>{teamTasks.length} member{teamTasks.length !== 1 ? 's' : ''}</span>
                      {teamHealth && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${
                          teamHealth.health === 'red' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                          teamHealth.health === 'orange' ? 'bg-orange-500/15 text-orange-400 border-orange-500/20' :
                          teamHealth.health === 'yellow' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' :
                          'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        }`} title={teamHealth.issues.length > 0 ? teamHealth.issues.join(', ') : 'Healthy'}>
                          {teamHealth.health === 'red' ? '🔴' : teamHealth.health === 'orange' ? '🟠' : teamHealth.health === 'yellow' ? '🟡' : '🟢'}
                          {teamHealth.issues.length > 0 ? ` ${teamHealth.issues.join(' · ')}` : ' Healthy'}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[9px] tabular-nums text-amber-500">
                      {teamTotalTokens > 0 ? formatTokens(teamTotalTokens) : ''}
                    </span>
                  </div>
                  {/* Team members */}
                  <div className={`${tasksBg} pb-2`}>
                    {teamTasks.map((task, i) => renderTask(task, i, teamTasks.length, { expanded, compact, textMuted, borderColor, getStatus, getModel, getTypeInfo, getDuration, formatTime, formatTokens, getHealthIndicator, agentConflicts, teamTotalTokens }))}
                  </div>
                </div>
              )}

              {/* Non-team tasks */}
              {nonTeamTasks.length > 0 && (
                <div className={`border-t ${borderColor} ${tasksBg} pb-2`}>
                  {nonTeamTasks.map((task, i) => renderTask(task, i, nonTeamTasks.length, { expanded, compact, textMuted, borderColor, getStatus, getModel, getTypeInfo, getDuration, formatTime, formatTokens, getHealthIndicator, agentConflicts, teamTotalTokens: 0 }))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`h-8 flex items-center justify-between px-2 border-t ${borderColor} ${colors?.bg?.tertiary || 'bg-black/20'} text-[10px]`}>
        <div className="flex items-center gap-2">
          {/* Sessions */}
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${activeMainCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className={activeMainCount > 0 ? 'text-emerald-400' : 'text-gray-500'}>
              {activeMainCount} session{activeMainCount !== 1 ? 's' : ''}
            </span>
          </span>
          {/* Tasks breakdown */}
          {(activeTaskCount > 0 || stoppedTaskCount > 0) && (
            <span className="text-gray-500">
              {activeTaskCount > 0 && (
                <span className="text-emerald-400">{activeTaskCount} running</span>
              )}
              {activeTaskCount > 0 && stoppedTaskCount > 0 && ' · '}
              {stoppedTaskCount > 0 && (
                <span className="text-gray-500">{stoppedTaskCount} done</span>
              )}
            </span>
          )}
        </div>
        {totalTokens > 0 && (
          <span className="font-mono tabular-nums text-amber-500">{formatTokens(totalTokens)}</span>
        )}
      </div>
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

export default AgentTree;
