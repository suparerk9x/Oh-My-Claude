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
 * Estimate USD saved by serving tokens from cache instead of as fresh input.
 * saving = cacheReadTokens × (input price − cacheRead price) per model, per 1M tokens.
 * Matches backend PRICING (opus 5/0.5, sonnet 3/0.3, haiku 1/0.1; default = sonnet).
 */
export function cacheSavedUSD(cacheReadTokens = 0, model = '') {
  if (!cacheReadTokens) return 0;
  const deltaPer1M = /opus/i.test(model) ? 4.5
                   : /haiku/i.test(model) ? 0.9
                   : /sonnet/i.test(model) ? 2.7
                   : 2.7;
  return (cacheReadTokens / 1_000_000) * deltaPer1M;
}

/**
 * Strip markdown noise from an assistant message for compact inline display.
 * Removes code fences/backticks, table pipes & separators, headings, bold/italic
 * markers, and list bullets; collapses whitespace. Keeps the human-readable prose.
 */
export function cleanAssistantMessage(raw) {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/```[\s\S]*?```/g, ' ');                  // fenced code blocks
  s = s.replace(/`([^`]+)`/g, '$1');                      // inline code
  // line-anchored markdown (well-formed text with newlines)
  s = s.replace(/^\s*\|?[\s:|-]*-{2,}[\s:|-]*$/gm, ' ');  // table separator rows (|---|---|)
  s = s.replace(/^#{1,6}\s*/gm, '');                      // headings at line start
  s = s.replace(/^\s*[-*+]\s+/gm, '· ');                  // list bullets → middot
  // global stragglers (collapsed / mid-line markers)
  s = s.replace(/\|/g, ' ');                              // remaining table pipes
  s = s.replace(/(^|\s)#{1,6}\s+/g, '$1');                // mid-line headings (## ...)
  s = s.replace(/\s-{3,}\s|-{3,}/g, ' ');                 // stray separator dashes (--- )
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');                // bold
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');          // italic
  s = s.replace(/__([^_]+)__/g, '$1');                    // bold (underscore)
  s = s.replace(/\s+/g, ' ').trim();                      // collapse whitespace/newlines
  return s;
}

/**
 * Format a duration in ms as "Xh Ym" / "Xm Ys" / "Xs" (matches backend style).
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * Format a small USD amount (e.g. "$20.25", "<$0.01").
 */
export function formatUSD(n) {
  if (!n) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
