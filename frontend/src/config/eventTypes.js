// Event type icons and colors (UX Best Practice: Semantic + Consistent)
// Color Psychology: Violet=Power/Premium, Blue=Professional, Emerald=Efficient
export const EVENT_CONFIG = {
  SessionStart: { icon: '🚀', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  SessionEnd: { icon: '🏁', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  PreToolUse: { icon: '🔧', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  PostToolUse: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  PostToolUseFailure: { icon: '❌', color: 'text-red-400', bg: 'bg-red-400/10' },
  SubagentStart: { icon: '🤖', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  SubagentStop: { icon: '👥', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  UserPromptSubmit: { icon: '💬', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  Stop: { icon: '🛑', color: 'text-red-400', bg: 'bg-red-400/10' },
  PermissionRequest: { icon: '🔐', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  PreCompact: { icon: '📦', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  Notification: { icon: '🔔', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  Unknown: { icon: '📌', color: 'text-gray-400', bg: 'bg-gray-400/10' }
};
