import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * Agent Card Component - Displays agent status and info
 * Supports full and compact view modes
 */
export function AgentCard({ agent, colors = {}, viewMode = 'full' }) {
  const isActive = agent.status === 'active' || agent.status === 'running';
  const isTimeout = agent.status === 'timeout';
  const isMain = agent.type === 'main' || agent.id === 'main';

  // Theme-aware colors
  const textPrimary = colors?.text?.primary || 'text-gray-100';
  const textSecondary = colors?.text?.secondary || 'text-gray-300';
  const textMuted = colors?.text?.muted || 'text-gray-400';
  const bgSecondary = colors?.bg?.secondary || 'bg-[#1a1a24]';
  const bgTertiary = colors?.bg?.tertiary || 'bg-[#12121a]';
  const borderColor = colors?.border || 'border-[#1a1a24]';

  // Model badge styling
  const getModelBadge = (model) => {
    const versionMatch = model?.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
    const version = versionMatch ? `${versionMatch[1]}.${versionMatch[2]}` : '';

    if (model?.includes('opus')) return { color: 'text-violet-400', bg: 'bg-violet-500/10', icon: '◆', name: `Opus ${version}`.trim() };
    if (model?.includes('sonnet')) return { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: '●', name: `Sonnet ${version}`.trim() };
    if (model?.includes('haiku')) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: '▪', name: `Haiku ${version}`.trim() };
    return { color: textMuted, bg: 'bg-gray-500/10', icon: '○', name: 'Unknown' };
  };

  const modelBadge = getModelBadge(agent.model);

  // Get display name for agent type
  const getAgentTypeName = (type) => {
    if (!type || type === 'main') return 'Main';
    return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Get time display
  const getTimeDisplay = () => {
    if (isActive && agent.elapsedFormatted) {
      return { label: 'Running', value: agent.elapsedFormatted, color: 'text-green-400' };
    }
    if (isTimeout && agent.elapsedFormatted) {
      return { label: 'Stuck', value: agent.elapsedFormatted, color: 'text-amber-400' };
    }
    if (!isActive && agent.durationFormatted) {
      return { label: 'Duration', value: agent.durationFormatted, color: textMuted };
    }
    return null;
  };

  // Get status display
  const getStatusDisplay = () => {
    if (isActive) return { text: 'active', bg: 'bg-green-500/15', color: 'text-green-400' };
    if (isTimeout) return { text: 'timeout', bg: 'bg-amber-500/15', color: 'text-amber-400' };
    return { text: 'stopped', bg: 'bg-gray-500/15', color: 'text-gray-500' };
  };

  const statusDisplay = getStatusDisplay();

  const timeDisplay = getTimeDisplay();
  const tokenCount = agent.tokens || (agent.inputTokens + agent.outputTokens) || 0;

  // COMPACT VIEW
  if (viewMode === 'compact') {
    return (
      <div className="relative group">
        {isActive && (
          <div className="absolute -inset-[1px] bg-gradient-to-r from-green-500/50 via-blue-500/50 to-green-500/50 rounded opacity-75 blur-[1px] animate-[gradient_3s_ease_infinite]" />
        )}
        {isTimeout && (
          <div className="absolute -inset-[1px] bg-gradient-to-r from-amber-500/40 via-orange-500/40 to-amber-500/40 rounded opacity-60 blur-[1px]" />
        )}
        <div className={`relative px-2 py-1.5 rounded ${isActive ? bgSecondary : bgTertiary} border ${isActive ? 'border-green-500/30' : isTimeout ? 'border-amber-500/30' : borderColor}`}>
          <div className="flex items-center gap-1.5 relative z-10">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : isTimeout ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className={`text-[10px] font-medium ${isMain ? textPrimary : textSecondary} truncate`}>
              {getAgentTypeName(agent.type)}
            </span>
            <span className={`${modelBadge.color} text-[9px] shrink-0`}>{modelBadge.icon}</span>
            <div className="flex-1 min-w-0" />
            {tokenCount > 0 && (
              <span className={`${textMuted} font-mono text-[9px] shrink-0`}>
                {formatTokens(tokenCount)}
              </span>
            )}
            {timeDisplay && (
              <span className={`text-[9px] ${timeDisplay.color} font-mono shrink-0`}>
                {timeDisplay.value}
              </span>
            )}
          </div>
          {((agent.lastTask && agent.lastTask !== 'Main Session') || (agent.toolsUsed && agent.toolsUsed.length > 0)) && (
            <div className="flex items-center gap-1.5 mt-1 relative z-10">
              {agent.lastTask && agent.lastTask !== 'Main Session' && (
                <span className={`text-[9px] ${textMuted} truncate flex-1`} title={agent.lastTask}>
                  {agent.lastTask}
                </span>
              )}
              {agent.toolsUsed && agent.toolsUsed.length > 0 && (
                <span className={`text-[8px] ${textMuted} opacity-70 shrink-0`}>
                  {agent.toolsUsed.length} tools
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // FULL VIEW (default)
  return (
    <div className="relative group">
      {isActive && (
        <div className="absolute -inset-[1px] bg-gradient-to-r from-green-500/50 via-blue-500/50 to-green-500/50 rounded-lg opacity-75 blur-[1px] animate-[gradient_3s_ease_infinite]" />
      )}
      {isTimeout && (
        <div className="absolute -inset-[1px] bg-gradient-to-r from-amber-500/40 via-orange-500/40 to-amber-500/40 rounded-lg opacity-60 blur-[1px]" />
      )}

      <div className={`relative p-2.5 rounded-lg ${isActive ? bgSecondary : bgTertiary} border ${isActive ? 'border-green-500/30' : isTimeout ? 'border-amber-500/30' : borderColor} transition-all hover:scale-[1.02]`}>
        {isActive && (
          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" style={{ transform: 'translateX(-100%)' }} />
          </div>
        )}

        {/* Header Row */}
        <div className="flex items-center justify-between mb-1.5 relative z-10">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.5)]' : isTimeout ? 'bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'bg-gray-600'}`} />
            <span className={`text-[12px] font-semibold ${isMain ? textPrimary : textSecondary} truncate max-w-[100px]`}>
              {getAgentTypeName(agent.type)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {timeDisplay && (
              <span className={`text-[9px] ${timeDisplay.color} font-mono`}>
                {timeDisplay.value}
              </span>
            )}
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusDisplay.bg} ${statusDisplay.color}`}>
              {statusDisplay.text}
            </span>
          </div>
        </div>

        {/* Model + Tokens Row */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${modelBadge.bg} mb-1.5 relative z-10`}>
          <span className={`${modelBadge.color} text-[11px]`}>{modelBadge.icon}</span>
          <span className={`${modelBadge.color} text-[11px] font-medium`}>
            {modelBadge.name}
          </span>
          <div className="flex-1" />
          {tokenCount > 0 && (
            <span className={`${textMuted} font-mono text-[10px]`}>
              {formatTokens(tokenCount)}
            </span>
          )}
        </div>

        {/* Task Description */}
        {agent.lastTask && agent.lastTask !== 'Main Session' && (
          <div className={`text-[10px] ${textMuted} truncate relative z-10 mb-1`} title={agent.lastTask}>
            {agent.lastTask}
          </div>
        )}

        {/* Tools Used */}
        {agent.toolsUsed && agent.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 relative z-10">
            {agent.toolsUsed.slice(0, 3).map((tool, i) => (
              <span key={i} className="text-[8px] px-1 py-0.5 bg-gray-700/50 text-gray-400 rounded">
                {tool.replace('mcp__plugin_', '').replace('playwright__', '').slice(0, 12)}
              </span>
            ))}
            {agent.toolsUsed.length > 3 && (
              <span className="text-[8px] text-gray-500">+{agent.toolsUsed.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

AgentCard.propTypes = {
  agent: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    status: PropTypes.string,
    model: PropTypes.string,
    tokens: PropTypes.number,
    inputTokens: PropTypes.number,
    outputTokens: PropTypes.number,
    elapsedFormatted: PropTypes.string,
    durationFormatted: PropTypes.string,
    lastTask: PropTypes.string,
    toolsUsed: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
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
  viewMode: PropTypes.oneOf(['full', 'compact'])
};

export default AgentCard;
