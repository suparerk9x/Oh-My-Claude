import PropTypes from 'prop-types';

/**
 * Token Gauge Component - Displays usage percentage with progress bar
 * Shows N/A when no Chrome extension data is available
 */
export function TokenGauge({ label, pct = null, resetTime = null, resetAt = null, headerRight = null, segments = 0, resetType = 'rolling', colors = {} }) {
  // Handle N/A case (pct is null when no Chrome extension data)
  const isNA = pct === null;
  const displayPct = isNA ? 0 : pct;

  // Different thresholds for session (tight) vs weekly (loose)
  const isSession = label === 'Session';
  const redThreshold = isSession ? 85 : 90;
  const yellowThreshold = isSession ? 60 : 75;

  // Session uses traffic light colors, Weekly uses neutral gray
  const color = isNA ? (colors?.text?.muted || 'text-gray-500') : isSession
    ? (pct >= redThreshold ? 'text-red-500' : pct >= yellowThreshold ? 'text-yellow-500' : 'text-green-500')
    : (colors?.text?.secondary || 'text-gray-400');
  const textSecondary = colors?.text?.secondary || 'text-gray-300';

  // Session uses gradient, Weekly uses solid gray
  const progressBarClass = isNA ? 'bg-gray-600' : isSession
    ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'
    : 'bg-gray-400';

  const progressBg = colors?.progressBg || 'bg-gray-800';
  const textMuted = colors?.text?.muted || 'text-gray-500';

  return (
    <div className="space-y-0.5">
      {/* Header: Label (left) + optional right-aligned slot e.g. burn indicator */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] ${textMuted} uppercase tracking-wider font-medium`}>{label}</span>
        {headerRight}
      </div>

      {/* Progress Bar - Fixed gradient with reveal mask */}
      <div className={`w-full h-1.5 ${progressBg} rounded-full overflow-hidden relative`}>
        {/* Full gradient background */}
        <div className={`absolute inset-0 ${progressBarClass}`} />
        {/* Dark overlay from right - reveals gradient based on % */}
        <div
          className={`absolute inset-0 ${progressBg} transition-all duration-500 ease-out`}
          style={{ left: `${Math.min(displayPct, 100)}%` }}
        />
        {/* Segment dividers drawn over the bar (e.g. segments=5 → 4 ticks = the 5h window) */}
        {segments >= 2 && Array.from({ length: segments - 1 }, (_, i) => (
          <div key={i} className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${((i + 1) / segments) * 100}%` }} />
        ))}
      </div>

      {/* Bottom: Reset info (left, 2 lines) + Large % (right, spanning 2 lines) */}
      <div className="flex items-end justify-between gap-1">
        {/* Left: Countdown + clock time stacked */}
        <div className="flex flex-col leading-tight min-w-0">
          {resetTime && (
            <span className={`text-[10px] ${textSecondary}`}>
              {isNA ? 'No extension data' : `Resets ${resetType === 'rolling' ? 'in ' : ''}${resetTime}`}
            </span>
          )}
          {resetAt && !isNA && (
            <span className={`text-[9px] ${textMuted}`}>
              {resetAt}
            </span>
          )}
        </div>

        {/* Right: Large percentage spanning both lines */}
        <span className={`text-2xl font-bold font-mono tabular-nums leading-none shrink-0 ${color}`}>
          {isNA ? 'N/A' : `${pct}%`}
        </span>
      </div>
    </div>
  );
}

TokenGauge.propTypes = {
  label: PropTypes.string.isRequired,
  pct: PropTypes.number, // null = N/A
  resetTime: PropTypes.string,
  resetAt: PropTypes.string,
  headerRight: PropTypes.node,
  segments: PropTypes.number,
  resetType: PropTypes.oneOf(['rolling', 'fixed']),
  colors: PropTypes.shape({
    text: PropTypes.shape({
      secondary: PropTypes.string,
      muted: PropTypes.string
    }),
    progressBg: PropTypes.string
  })
};

export default TokenGauge;
