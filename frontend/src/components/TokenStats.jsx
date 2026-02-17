import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * Token Stats Component - Displays WEEKLY usage breakdown by model
 */
export function TokenStats({ tokens = {}, colors = {} }) {
  const modelUsage = tokens.modelUsage || {};
  const textMuted = colors?.text?.muted || 'text-gray-500';

  // Calculate total weekly cost
  const totalWeeklyCost = Object.values(modelUsage).reduce((sum, m) => sum + (m.estimatedCost || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <span className={`text-[10px] ${textMuted} uppercase tracking-wider font-medium`}>This Week</span>
        <span className="text-[11px] font-mono font-bold text-emerald-400">${totalWeeklyCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
      </div>

      {/* Model Details - Always Visible */}
      <div className="space-y-1.5 mt-1">
        {Object.entries(modelUsage)
          .filter(([_, usage]) => usage.totalTokens > 0)
          .map(([model, usage]) => {
            const modelIcon = model === 'Opus' ? '◆' : model === 'Sonnet' ? '●' : '▪';
            const modelColor = model === 'Opus' ? 'text-violet-400' :
                               model === 'Sonnet' ? 'text-blue-400' : 'text-emerald-400';
            const modelBg = model === 'Opus' ? 'bg-violet-500/10' :
                            model === 'Sonnet' ? 'bg-blue-500/10' : 'bg-emerald-500/10';

            return (
              <div key={model} className={`rounded p-1.5 ${modelBg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className={`${modelColor} text-[10px]`}>{modelIcon}</span>
                    <span className={`${modelColor} text-[9px] font-semibold uppercase`}>{model}</span>
                  </div>
                  <span className={`${modelColor} font-mono text-[10px] font-bold`}>
                    ${(usage.estimatedCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5 text-[8px]">
                  <div className="flex items-center gap-2">
                    <span className={textMuted}>In: <span className="font-mono">{formatTokens(usage.inputTokens)}</span></span>
                    <span className={textMuted}>Out: <span className="font-mono">{formatTokens(usage.outputTokens)}</span></span>
                  </div>
                  {usage.cacheReadTokens > 0 && (
                    <span className="text-sky-400">Cache: <span className="font-mono">{formatTokens(usage.cacheReadTokens)}</span></span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

TokenStats.propTypes = {
  tokens: PropTypes.shape({
    modelUsage: PropTypes.objectOf(PropTypes.shape({
      inputTokens: PropTypes.number,
      outputTokens: PropTypes.number,
      totalTokens: PropTypes.number,
      cacheReadTokens: PropTypes.number,
      estimatedCost: PropTypes.number
    }))
  }),
  colors: PropTypes.shape({
    text: PropTypes.shape({
      muted: PropTypes.string
    })
  })
};

export default TokenStats;
