import PropTypes from 'prop-types';
import { EVENT_CONFIG } from '../config/eventTypes';
import { formatRelativeTime } from '../utils/format';

/**
 * Activity Item Component - Displays a single event in the activity feed
 */
export function ActivityItem({ event, colors, isSelected, onSelect }) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.Unknown;
  const target = getEventTarget(event);

  const isError = event.type === 'PostToolUseFailure';
  const isUserPrompt = event.type === 'UserPromptSubmit';
  const isToolEvent = event.type === 'PreToolUse' || event.type === 'PostToolUse';
  const isDone = event.type === 'PostToolUse';
  const isStop = event.type === 'Stop';

  // Theme-aware colors
  const textMuted = colors?.text?.muted || 'text-gray-400';
  const textSecondary = colors?.text?.secondary || 'text-gray-300';
  const selectedBg = isSelected ? 'bg-blue-500/15 rounded' : '';

  // Simplified tool styling (accent colors work in both themes)
  const getToolStyle = (toolName) => {
    if (!toolName) return null;
    if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') return { color: 'text-sky-500', bg: 'bg-sky-500/15' };
    if (toolName === 'Edit' || toolName === 'Write') return { color: 'text-orange-500', bg: 'bg-orange-500/15' };
    if (toolName === 'Bash') return { color: 'text-amber-500', bg: 'bg-amber-500/15' };
    if (toolName === 'Task') return { color: 'text-violet-500', bg: 'bg-violet-500/15' };
    if (toolName === 'TeamCreate') return { color: 'text-indigo-500', bg: 'bg-indigo-500/15' };
    if (toolName === 'SendMessage') return { color: 'text-cyan-500', bg: 'bg-cyan-500/15' };
    if (toolName === 'TeamDelete') return { color: 'text-gray-500', bg: 'bg-gray-500/15' };
    if (toolName.includes('mcp__')) return { color: 'text-pink-500', bg: 'bg-pink-500/15' };
    return { color: 'text-cyan-500', bg: 'bg-cyan-500/15' };
  };

  const toolStyle = getToolStyle(event.toolName);

  // User Prompt - Clean, no background
  if (isUserPrompt) {
    return (
      <div className={`flex items-start gap-2 py-1 px-2 cursor-pointer ${selectedBg}`} onClick={onSelect}>
        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px]">💬</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-medium text-amber-500">User Prompt</span>
            <span className={`text-[9px] ${textMuted} font-mono`}>{formatRelativeTime(event.timestamp)}</span>
          </div>
          <p className={`text-[11px] ${textSecondary} leading-relaxed line-clamp-2`} title={target}>
            {target}
          </p>
        </div>
      </div>
    );
  }

  // Stop event - Clean
  if (isStop) {
    return (
      <div className={`flex items-center gap-2 py-1 px-2 cursor-pointer ${selectedBg}`} onClick={onSelect}>
        <span className="text-[10px]">🛑</span>
        <span className="text-[10px] text-red-500">Stopped</span>
        <span className={`text-[9px] ${textMuted} font-mono ml-auto`}>{formatRelativeTime(event.timestamp)}</span>
      </div>
    );
  }

  // Tool Events - Clean inline format
  if (isToolEvent && toolStyle) {
    return (
      <div className={`flex items-center gap-2 py-1 px-2 cursor-pointer ${selectedBg} ${isError ? 'bg-red-500/10' : ''}`} onClick={onSelect}>
        {/* Status icon */}
        <span className={`text-[10px] shrink-0 ${isDone ? '' : 'animate-pulse'}`}>
          {isDone ? '✅' : '⏳'}
        </span>

        {/* Tool badge */}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${toolStyle.bg} ${toolStyle.color} shrink-0`}>
          {event.toolName}
        </span>

        {/* Target */}
        {target && target !== '-' && (
          <span className={`text-[10px] ${textMuted} font-mono truncate flex-1`} title={target}>
            {target}
          </span>
        )}

        {/* Time */}
        <span className={`text-[9px] ${textMuted} font-mono tabular-nums shrink-0`}>
          {formatRelativeTime(event.timestamp)}
        </span>
      </div>
    );
  }

  // Default - Other events
  return (
    <div className={`flex items-center gap-2 py-1 px-2 cursor-pointer ${selectedBg}`} onClick={onSelect}>
      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${config.bg}`}>
        {config.icon}
      </div>
      <span className={`text-[10px] font-medium shrink-0 ${config.color}`}>
        {formatEventType(event.type)}
      </span>
      {target && target !== '-' ? (
        <span className={`text-[10px] ${textMuted} truncate flex-1`}>{target}</span>
      ) : (
        <span className="flex-1" />
      )}
      <span className={`text-[9px] ${textMuted} font-mono tabular-nums shrink-0`}>{formatRelativeTime(event.timestamp)}</span>
    </div>
  );
}

// Helper: Format event type for display
export function formatEventType(type) {
  const typeMap = {
    'PreToolUse': 'Tool Call',
    'PostToolUse': 'Tool Done',
    'PostToolUseFailure': 'Tool Failed',
    'UserPromptSubmit': 'User Prompt',
    'SubagentStart': 'Agent Started',
    'SubagentStop': 'Agent Stopped',
    'SessionStart': 'Session Start',
    'SessionEnd': 'Session End',
    'PermissionRequest': 'Permission',
    'PreCompact': 'Compacting',
    'Notification': 'Notification',
    'Stop': 'Stopped',
    'TeamCreate': 'Team Created',
    'TeamDelete': 'Team Deleted'
  };
  return typeMap[type] || type;
}

// Helper: Get event target for display
export function getEventTarget(event) {
  if (event.prompt) return event.prompt.slice(0, 50) + (event.prompt.length > 50 ? '...' : '');
  if (event.toolInput?.file_path) return event.toolInput.file_path.split(/[/\\]/).pop();
  if (event.toolInput?.command) return event.toolInput.command.slice(0, 40);
  if (event.toolInput?.pattern) return event.toolInput.pattern;
  if (event.toolInput?.team_name) return event.toolInput.team_name;
  if (event.toolInput?.recipient) return `→ ${event.toolInput.recipient}`;
  if (event.toolInput?.summary) return event.toolInput.summary;
  if (event.toolName) return event.toolName;
  return '-';
}

ActivityItem.propTypes = {
  event: PropTypes.shape({
    type: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
    toolName: PropTypes.string,
    toolInput: PropTypes.object,
    prompt: PropTypes.string,
    sessionId: PropTypes.string,
    agentId: PropTypes.string
  }).isRequired,
  colors: PropTypes.shape({
    text: PropTypes.shape({
      muted: PropTypes.string,
      secondary: PropTypes.string
    }),
    bg: PropTypes.shape({
      hover: PropTypes.string
    }),
    card: PropTypes.string
  }),
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func
};

export default ActivityItem;
