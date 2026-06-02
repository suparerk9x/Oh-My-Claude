// Event type icons and colors (UX Best Practice: Semantic + Consistent)
// Color Psychology: Violet=Power/Premium, Blue=Professional, Emerald=Efficient

// Static config (icons only — colors come from theme)
export const EVENT_CONFIG = {
  SessionStart:       { icon: '🚀', key: 'sessionStart' },
  SessionEnd:         { icon: '🏁', key: 'sessionEnd' },
  PreToolUse:         { icon: '🔧', key: 'preTool' },
  PostToolUse:        { icon: '✅', key: 'postTool' },
  PostToolUseFailure: { icon: '❌', key: 'postToolFail' },
  PostToolUseError:   { icon: '❌', key: 'postToolFail' },
  SubagentStart:      { icon: '🤖', key: 'subagentStart' },
  SubagentStop:       { icon: '👥', key: 'subagentStop' },
  UserPromptSubmit:   { icon: '💬', key: 'userPrompt' },
  Stop:               { icon: '🛑', key: 'stop' },
  PermissionRequest:  { icon: '🔐', key: 'permission' },
  PreCompact:         { icon: '📦', key: 'compact' },
  Notification:       { icon: '🔔', key: 'notification' },
  Unknown:            { icon: '📌', key: 'unknown' }
};

// Helper to get event colors from theme
export function getEventColors(eventType, colors) {
  const config = EVENT_CONFIG[eventType] || EVENT_CONFIG.Unknown;
  const eventColors = colors?.event?.[config.key];
  if (eventColors) {
    return { icon: config.icon, color: eventColors.color, bg: eventColors.bg };
  }
  // Fallback for missing theme (dark-mode defaults)
  const fallbacks = {
    sessionStart:  { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    sessionEnd:    { color: 'text-gray-400',    bg: 'bg-gray-400/10' },
    preTool:       { color: 'text-cyan-400',    bg: 'bg-cyan-400/10' },
    postTool:      { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    postToolFail:  { color: 'text-red-400',     bg: 'bg-red-400/10' },
    subagentStart: { color: 'text-violet-400',  bg: 'bg-violet-400/10' },
    subagentStop:  { color: 'text-violet-400',  bg: 'bg-violet-400/10' },
    userPrompt:    { color: 'text-amber-400',   bg: 'bg-amber-400/10' },
    stop:          { color: 'text-red-400',     bg: 'bg-red-400/10' },
    permission:    { color: 'text-orange-400',  bg: 'bg-orange-400/10' },
    compact:       { color: 'text-slate-400',   bg: 'bg-slate-400/10' },
    notification:  { color: 'text-sky-400',     bg: 'bg-sky-400/10' },
    unknown:       { color: 'text-gray-400',    bg: 'bg-gray-400/10' },
  };
  const fb = fallbacks[config.key] || fallbacks.unknown;
  return { icon: config.icon, color: fb.color, bg: fb.bg };
}
