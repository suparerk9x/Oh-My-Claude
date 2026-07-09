import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * Token Stats Component - Displays WEEKLY usage breakdown by model
 */
export function TokenStats({ tokens = {}, colors = {} }) {
  const modelUsage = tokens.modelUsage || {};
  const textMuted = colors?.text?.muted || 'text-gray-500';
  const mc = colors?.model || {};

  // Calculate total weekly cost
  const totalWeeklyCost = Object.values(modelUsage).reduce((sum, m) => sum + (m.estimatedCost || 0), 0);

  // Cache-efficiency badge: hit rate + $ wasted on uncached fresh input (this week).
  const cacheEff = tokens.cacheEfficiency;
  const hasCacheData = cacheEff && (cacheEff.cacheReadTokens > 0 || cacheEff.freshInputTokens > 0);
  const hr = cacheEff?.hitRate ?? 0;
  const cacheBadgeStyle = hr >= 0.8 ? 'text-emerald-400 bg-emerald-500/10'
    : hr >= 0.5 ? 'text-amber-400 bg-amber-500/10'
    : 'text-rose-400 bg-rose-500/10';

  // Theme-aware model colors
  const getModelStyle = (model) => {
    if (model === 'Opus')   return { icon: '◆', color: mc.opus?.text   || 'text-violet-400',  bg: mc.opus?.bg   || 'bg-violet-500/10' };
    if (model === 'Sonnet') return { icon: '●', color: mc.sonnet?.text || 'text-blue-400',    bg: mc.sonnet?.bg || 'bg-blue-500/10' };
    return                         { icon: '▪', color: mc.haiku?.text  || 'text-emerald-400',  bg: mc.haiku?.bg  || 'bg-emerald-500/10' };
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <span className={`text-[10px] ${textMuted} uppercase tracking-wider font-medium`}>This Week</span>
        <div className="flex items-center gap-1.5">
          {hasCacheData && (
            <span
              title={`Cache hit ${(hr * 100).toFixed(0)}% · ~$${cacheEff.wastedCost.toFixed(2)} extra paid on uncached input this week (lower cache hit = context re-sent fresh: idle >5m or prefix churn)`}
              className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded ${cacheBadgeStyle}`}
            >
              ⚡{(hr * 100).toFixed(0)}%{cacheEff.wastedCost >= 0.01 ? ` ·$${cacheEff.wastedCost.toFixed(2)}` : ''}
            </span>
          )}
          <span className={`text-[11px] font-mono font-bold ${colors?.status?.success || 'text-emerald-400'}`}>${totalWeeklyCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
      </div>

      {/* Model Details - Always Visible */}
      <div className="space-y-1.5 mt-1">
        {Object.entries(modelUsage)
          .filter(([_, usage]) => usage.totalTokens > 0)
          .map(([model, usage]) => {
            const ms = getModelStyle(model);

            return (
              <div key={model} className={`rounded p-1.5 ${ms.bg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className={`${ms.color} text-[10px]`}>{ms.icon}</span>
                    <span className={`${ms.color} text-[9px] font-semibold uppercase`}>{model}</span>
                  </div>
                  <span className={`${ms.color} font-mono text-[10px] font-bold`}>
                    ${(usage.estimatedCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5 text-[8px]">
                  <div className="flex items-center gap-2">
                    <span className={textMuted}>In: <span className="font-mono">{formatTokens(usage.inputTokens)}</span></span>
                    <span className={textMuted}>Out: <span className="font-mono">{formatTokens(usage.outputTokens)}</span></span>
                  </div>
                  {usage.cacheReadTokens > 0 && (
                    <span className={colors?.semantic?.sky?.text || 'text-sky-400'}>Cache: <span className="font-mono">{formatTokens(usage.cacheReadTokens)}</span></span>
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
      estimatedCost: PropTypes.number,
      cacheHitRate: PropTypes.number,
      wastedInputCost: PropTypes.number
    })),
    cacheEfficiency: PropTypes.shape({
      hitRate: PropTypes.number,
      wastedCost: PropTypes.number,
      cacheReadTokens: PropTypes.number,
      freshInputTokens: PropTypes.number
    })
  }),
  colors: PropTypes.shape({
    text: PropTypes.shape({
      muted: PropTypes.string
    })
  })
};

export default TokenStats;
