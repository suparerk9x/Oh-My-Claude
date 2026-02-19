// Get user's locale (browser setting)
const getUserLocale = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language || navigator.languages?.[0] || 'en-US';
  }
  return 'en-US';
};

/**
 * Format token count with k/M suffix (with null handling)
 */
export function formatTokens(n) {
  if (!n) return '0';
  if (n >= 999950) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

/**
 * Get usage badge info for session percentage (shared across App + MiniApp)
 */
export function getUsageBadge(pct) {
  if (pct === null) return { emoji: '📊', label: 'No data', level: 'neutral' };
  if (pct >= 100) return { emoji: '🫗', label: 'Full', level: 'danger' };
  if (pct >= 85) return { emoji: '🚨', label: 'Near limit', level: 'danger' };
  if (pct >= 60) return { emoji: '⚡', label: 'High usage', level: 'warning' };
  return { emoji: '🪴', label: 'Normal', level: 'normal' };
}

/**
 * Format relative time (e.g., "2m", "1h", "now")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleTimeString(getUserLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format time with full precision (HH:MM:SS, uses browser locale)
 */
export function formatTimeWithSeconds(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString(getUserLocale(), { hour12: false });
}
