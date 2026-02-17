// Get user's locale (browser setting)
const getUserLocale = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language || navigator.languages?.[0] || 'en-US';
  }
  return 'en-US';
};

/**
 * Format duration between two timestamps
 */
export function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diffMs = end - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format time from ISO string (uses browser locale)
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString(getUserLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format number with k/M suffix
 */
export function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Format token count with k/M suffix (with null handling)
 */
export function formatTokens(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
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
  return formatTime(timestamp);
}

/**
 * Format time with full precision (HH:MM:SS, uses browser locale)
 */
export function formatTimeWithSeconds(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString(getUserLocale(), { hour12: false });
}
