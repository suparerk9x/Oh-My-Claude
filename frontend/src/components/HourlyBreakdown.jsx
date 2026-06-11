import PropTypes from 'prop-types';
import { formatTokens } from '../utils/format';

/**
 * Hourly Breakdown Component - Displays token usage per hour as stacked bars
 */
export function HourlyBreakdown({ hourly = [], colors = {} }) {
  const textMuted = colors?.text?.muted || 'text-gray-500';
  const textSecondary = colors?.text?.secondary || 'text-gray-300';

  if (!hourly || hourly.length === 0) {
    return (
      <div className={`text-xs ${textMuted} text-center py-8`}>
        No hourly data available
      </div>
    );
  }

  // Calculate max tokens for scaling bars
  const maxTokens = Math.max(...hourly.map(h => h.tokens || 0), 1);

  return (
    <div className="space-y-1">
      {/* Hourly bars - Ultra Compact */}
      <div className="space-y-0.5">
        {hourly.map((hour) => {
          const isCurrentHour = hour.isCurrentHour;
          const byModel = hour.byModel || { fable: 0, opus: 0, sonnet: 0, haiku: 0 };
          const totalHourTokens = hour.tokens || 0;

          // Calculate percentages for stacked bar
          const fablePct = maxTokens > 0 ? ((byModel.fable || 0) / maxTokens) * 100 : 0;
          const opusPct = maxTokens > 0 ? (byModel.opus / maxTokens) * 100 : 0;
          const sonnetPct = maxTokens > 0 ? (byModel.sonnet / maxTokens) * 100 : 0;
          const haikuPct = maxTokens > 0 ? (byModel.haiku / maxTokens) * 100 : 0;

          return (
            <div key={hour.hour} className="flex items-center gap-1 h-3">
              <span className={`text-[8px] ${textMuted} shrink-0 tabular-nums flex items-center h-full`}>
                {hour.timeLabel}
                <svg className={`ml-1 w-2.5 h-2.5 ${isCurrentHour ? (colors?.semantic?.blue?.text || 'text-blue-400') : 'opacity-0'}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                </svg>
              </span>
              <div className={`flex-1 h-3 ${colors?.progressBg || 'bg-gray-800/50'} rounded-sm overflow-hidden flex`}>
                {(byModel.fable || 0) > 0 && (
                  <div
                    className={`h-full ${isCurrentHour ? 'bg-amber-400' : 'bg-amber-500'}`}
                    style={{ width: `${fablePct}%` }}
                    title={`Fable: ${formatTokens(byModel.fable)}`}
                  />
                )}
                {byModel.opus > 0 && (
                  <div
                    className={`h-full ${isCurrentHour ? 'bg-violet-500' : 'bg-violet-600'}`}
                    style={{ width: `${opusPct}%` }}
                    title={`Opus: ${formatTokens(byModel.opus)}`}
                  />
                )}
                {byModel.sonnet > 0 && (
                  <div
                    className={`h-full ${isCurrentHour ? 'bg-blue-400' : 'bg-blue-500'}`}
                    style={{ width: `${sonnetPct}%` }}
                    title={`Sonnet: ${formatTokens(byModel.sonnet)}`}
                  />
                )}
                {byModel.haiku > 0 && (
                  <div
                    className={`h-full ${isCurrentHour ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                    style={{ width: `${haikuPct}%` }}
                    title={`Haiku: ${formatTokens(byModel.haiku)}`}
                  />
                )}
              </div>
              <span className={`text-[8px] ${textSecondary} font-mono w-8 text-right tabular-nums`}>
                {formatTokens(totalHourTokens)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend - Inline */}
      <div className="flex items-center justify-center gap-3 text-[9px] pt-0.5">
        <span className={colors?.model?.fable?.text || 'text-amber-400'}>✦ Fable</span>
        <span className={colors?.model?.opus?.text || 'text-violet-400'}>◆ Opus</span>
        <span className={colors?.model?.sonnet?.text || 'text-blue-400'}>● Sonnet</span>
        <span className={colors?.model?.haiku?.text || 'text-emerald-400'}>▪ Haiku</span>
      </div>
    </div>
  );
}

HourlyBreakdown.propTypes = {
  hourly: PropTypes.arrayOf(PropTypes.shape({
    hour: PropTypes.number,
    timeLabel: PropTypes.string,
    tokens: PropTypes.number,
    isCurrentHour: PropTypes.bool,
    byModel: PropTypes.shape({
      fable: PropTypes.number,
      opus: PropTypes.number,
      sonnet: PropTypes.number,
      haiku: PropTypes.number
    })
  })),
  colors: PropTypes.shape({
    text: PropTypes.shape({
      muted: PropTypes.string,
      secondary: PropTypes.string
    })
  })
};

export default HourlyBreakdown;
