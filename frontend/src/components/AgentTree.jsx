import { useRef } from 'react';
import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * AgentTree - Compact but COMPLETE information
 * No truncation - show all data
 */
export function AgentTree({ agents = [], colors = {}, compact = false, expanded = false }) {
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

  // Stable ordering - only re-sort when sessions are added/removed or active status changes
  const prevOrderRef = useRef([]);
  const prevActiveSetRef = useRef(new Set());

  const rawSessions = Object.entries(sessionMap)
    .map(([id, data]) => ({ id, ...data }));

  // Build active set for comparison
  const activeStatuses = ['active', 'idle', 'stale'];
  const currentActiveSet = new Set(
    rawSessions.filter(s => activeStatuses.includes(s.main?.status) || s.tasks.some(t => activeStatuses.includes(t.status)))
      .map(s => s.id)
  );
  const currentIdSet = new Set(rawSessions.map(s => s.id));
  const prevIdSet = new Set(prevOrderRef.current);

  // Re-sort only when: session added/removed or active status changed
  const needsResort =
    currentIdSet.size !== prevIdSet.size ||
    [...currentIdSet].some(id => !prevIdSet.has(id)) ||
    [...currentActiveSet].some(id => !prevActiveSetRef.current.has(id)) ||
    [...prevActiveSetRef.current].some(id => !currentActiveSet.has(id));

  let sessions;
  if (needsResort) {
    sessions = rawSessions.sort((a, b) => {
      const aActive = currentActiveSet.has(a.id);
      const bActive = currentActiveSet.has(b.id);
      if (aActive !== bActive) return bActive - aActive;
      const aTime = a.main?.lastSeen || a.tasks[0]?.lastSeen || 0;
      const bTime = b.main?.lastSeen || b.tasks[0]?.lastSeen || 0;
      return new Date(bTime) - new Date(aTime);
    });
    prevOrderRef.current = sessions.map(s => s.id);
    prevActiveSetRef.current = currentActiveSet;
  } else {
    // Keep previous order, update data
    const sessionById = new Map(rawSessions.map(s => [s.id, s]));
    sessions = prevOrderRef.current
      .filter(id => sessionById.has(id))
      .map(id => sessionById.get(id));
    // Append any new sessions not in previous order
    rawSessions.forEach(s => {
      if (!prevOrderRef.current.includes(s.id)) sessions.push(s);
    });
  }

  const activeMainCount = agents.filter(a => a.type === 'main' && a.status === 'active').length;
  const activeTaskCount = agents.filter(a => a.type !== 'main' && a.status === 'active').length;
  const stoppedTaskCount = agents.filter(a => a.type !== 'main' && a.status !== 'active').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokens || (a.inputTokens || 0) + (a.outputTokens || 0) || 0), 0);

  // Status config (5-level: active → idle → stale → timeout → stopped)
  const getStatus = (status) => {
    switch (status) {
      case 'active':
      case 'running':
        return { icon: '●', color: 'text-emerald-400', pulse: true, label: 'Active' };
      case 'idle':
        return { icon: '●', color: 'text-yellow-400', pulse: false, label: 'Idle' };
      case 'stale':
        return { icon: '●', color: 'text-orange-400', pulse: false, label: 'Stale' };
      case 'timeout':
        return { icon: '●', color: 'text-amber-400', pulse: true, label: 'Timeout' };
      case 'stopped':
        return { icon: '○', color: 'text-gray-500', pulse: false, label: 'Stopped' };
      default:
        return { icon: '○', color: 'text-gray-600', pulse: false, label: 'Unknown' };
    }
  };

  // Model display - FULL names with version
  const getModel = (model) => {
    // Extract version: "claude-opus-4-6" or "claude-opus-4-5-20251101" -> "4.6" / "4.5"
    const versionMatch = model?.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
    const version = versionMatch ? ` ${versionMatch[1]}.${versionMatch[2]}` : '';

    if (model?.includes('opus')) return { name: `Opus${version}`, color: 'text-violet-400' };
    if (model?.includes('sonnet')) return { name: `Sonnet${version}`, color: 'text-sky-400' };
    if (model?.includes('haiku')) return { name: `Haiku${version}`, color: 'text-teal-400' };
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

  // Theme-aware colors
  const textMuted = colors?.text?.muted || 'text-gray-500';
  const borderColor = colors?.border || 'border-gray-800/40';
  const tasksBg = colors?.bg?.tasks || 'bg-black/10';

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
          const mainModel = main ? getModel(main.model) : null;
          const sessionTokens = (main?.tokens || 0) + tasks.reduce((sum, t) => sum + (t.tokens || 0), 0);
          const activeTaskCount = tasks.filter(t => t.status === 'active').length;

          return (
            <div key={sessionId} className={`${expanded ? `flex-1 min-h-0 flex flex-col rounded-lg border ${borderColor}` : `border-b ${borderColor}`} ${isActive ? 'bg-emerald-500/[0.03]' : ''}`}>
              {/* Session Header */}
              <div className={`${expanded ? 'px-3 py-2' : 'px-2 py-1.5'} shrink-0`}>
                {/* Line 1: Status + Model + Duration + Tokens */}
                <div className="flex items-center flex-nowrap">
                  <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                    <span className={`text-[10px] shrink-0 ${mainStatus.color} ${mainStatus.pulse ? 'animate-pulse' : ''}`}>
                      {mainStatus.icon}
                    </span>
                    <span className={`text-[9px] shrink-0 whitespace-nowrap ${mainStatus.color}`}>
                      {mainStatus.label}
                    </span>
                    {mainModel && (
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 whitespace-nowrap ${mainModel.color} ${mainModel.color.replace('text-', 'bg-').replace('400', '500')}/15`}>
                        {mainModel.name}
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

                {/* Line 2: Activity + Session ID - hidden in compact */}
                {!compact && (() => {
                  const parsed = main?.lastTask && main.lastTask !== 'Main Session' ? parseLastTask(main.lastTask) : null;
                  return (
                    <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                      {parsed && (
                        <>
                          <span className="text-[9px] shrink-0">{parsed.icon}</span>
                          {parsed.tool && (
                            <span className={`text-[10px] font-medium shrink-0 ${parsed.color}`}>
                              {parsed.tool}
                            </span>
                          )}
                          <span className={`text-[10px] text-gray-400 ${expanded ? '' : 'truncate'} flex-1 min-w-0`}>
                            {parsed.detail}
                          </span>
                        </>
                      )}
                      {!parsed && <div className="flex-1" />}
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

              {/* Tasks - in expanded mode, fills remaining space */}
              {tasks.length > 0 && (
                <div className={`border-t ${borderColor} ${tasksBg} ${expanded ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
                  {tasks.map((task, i) => {
                    const status = getStatus(task.status);
                    const model = getModel(task.model);
                    const typeInfo = getTypeInfo(task.type);
                    const tokens = task.tokens || (task.inputTokens || 0) + (task.outputTokens || 0);
                    const duration = getDuration(task);
                    const desc = task.description || task.lastTask;

                    // Calculate duration from timestamps if not provided
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
                        className={`${expanded ? 'px-3 py-3' : 'px-2 py-2'} ${i < tasks.length - 1 ? 'border-b border-gray-800/20' : ''}`}
                      >
                        <div className={`${expanded ? 'pl-4 space-y-1.5' : 'pl-3 space-y-1'}`}>
                          {/* Line 1: Status + Model + Type + Duration + Tokens */}
                          <div className="flex items-center flex-nowrap">
                            {/* Left: flexible content */}
                            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                              <span className={`${textMuted} text-[9px] shrink-0`}>└</span>
                              <span className={`${expanded ? 'text-[10px]' : 'text-[9px]'} shrink-0 ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}>
                                {status.icon}
                              </span>
                              <span className={`${expanded ? 'text-[9px]' : 'text-[8px]'} shrink-0 whitespace-nowrap ${status.color}`}>
                                {status.label}
                              </span>
                              {model && (
                                <span className={`${expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${model.color} ${model.color.replace('text-', 'bg-').replace('400', '500')}/15`}>
                                  {model.name}
                                </span>
                              )}
                              {typeInfo && (
                                <span className={`${expanded ? 'text-[10px]' : 'text-[9px]'} font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${typeInfo.bg} ${typeInfo.text}`}>
                                  {typeInfo.name}
                                </span>
                              )}
                            </div>
                            {/* Right: fixed columns - same width as main row */}
                            <div className="shrink-0 flex items-center gap-1 pl-1">
                              <span className={`font-mono ${expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums w-[48px] text-right whitespace-nowrap ${displayDuration ? 'text-gray-400' : 'text-gray-500'}`}>
                                {displayDuration || (task.stoppedAt || task.lastSeen ? formatTime(task.stoppedAt || task.lastSeen) : '')}
                              </span>
                              <span className={`font-mono ${expanded ? 'text-[10px]' : 'text-[9px]'} tabular-nums text-amber-500 w-[45px] text-right`}>
                                {tokens > 0 ? formatTokens(tokens) : ''}
                              </span>
                            </div>
                          </div>

                          {/* Line 2: Tools */}
                          {!compact && task.toolsUsed && task.toolsUsed.length > 0 && (
                            <div className={`flex items-center gap-1 ${expanded ? 'pl-4 flex-wrap' : 'pl-4'}`}>
                              <span className="text-[9px] text-gray-500 shrink-0">🔧</span>
                              {task.toolsUsed.map((tool, idx) => (
                                <span key={idx} className={`${expanded ? 'text-[9px]' : 'text-[8px]'} px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/80`}>
                                  {tool}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Line 3: Description - full text in expanded mode */}
                          {!compact && desc && (
                            <div className="flex items-start gap-1.5 pl-4">
                              <span className={`${expanded ? 'text-[10px] text-gray-400 leading-relaxed' : 'text-[9px] text-gray-400 truncate'} flex-1 min-w-0`}>
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
                  })}
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
  expanded: PropTypes.bool
};

export default AgentTree;
