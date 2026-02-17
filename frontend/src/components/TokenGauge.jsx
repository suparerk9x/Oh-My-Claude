import PropTypes from 'prop-types';

/**
 * Token Gauge Component - Displays usage percentage with progress bar
 * Shows N/A when no Chrome extension data is available
 */
export function TokenGauge({ label, pct = null, resetTime = null, resetType = 'rolling', colors = {} }) {
  // Handle N/A case (pct is null when no Chrome extension data)
  const isNA = pct === null;
  const displayPct = isNA ? 0 : pct;

  // Different thresholds for session (tight) vs weekly (loose)
  const isSession = label === 'Session';
  const redThreshold = isSession ? 85 : 90;
  const yellowThreshold = isSession ? 60 : 75;

  // Session uses traffic light colors, Weekly uses neutral gray
  const color = isNA ? 'text-gray-500' : isSession
    ? (pct >= redThreshold ? 'text-red-500' : pct >= yellowThreshold ? 'text-yellow-500' : 'text-green-500')
    : 'text-gray-400';
  const textSecondary = colors?.text?.secondary || 'text-gray-300';

  // Session uses gradient, Weekly uses solid gray
  const progressBarClass = isNA ? 'bg-gray-600' : isSession
    ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'
    : 'bg-gray-400';

  const progressBg = colors?.progressBg || 'bg-gray-800';
  const textMuted = colors?.text?.muted || 'text-gray-500';

  return (
    <div className="space-y-0.5">
      {/* Header: Label */}
      <div className={`text-[9px] ${textMuted} uppercase tracking-wider font-medium`}>{label}</div>

      {/* Progress Bar - Fixed gradient with reveal mask */}
      <div className={`w-full h-1.5 ${progressBg} rounded-full overflow-hidden relative`}>
        {/* Full gradient background */}
        <div className={`absolute inset-0 ${progressBarClass}`} />
        {/* Dark overlay from right - reveals gradient based on % */}
        <div
          className={`absolute inset-0 ${progressBg} transition-all duration-500 ease-out`}
          style={{ left: `${Math.min(displayPct, 100)}%` }}
        />
      </div>

      {/* Bottom Row: Reset time (left) + Percentage (right) */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Reset time only */}
        {resetTime && (
          <span className={`text-[10px] ${textSecondary}`}>
            {isNA ? 'No extension data' : `Resets ${resetType === 'rolling' ? 'in ' : ''}${resetTime}`}
          </span>
        )}

        {/* Right: Large percentage or N/A */}
        <span className={`text-lg font-bold font-mono tabular-nums leading-none ${color}`}>
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
