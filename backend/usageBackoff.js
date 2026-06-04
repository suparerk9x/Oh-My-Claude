// Pure decision logic for the Claude Code OAuth usage sync's backoff / retry state machine.
// Extracted from server.js so the behaviour can be unit-tested without binding a port or hitting
// the network. Everything here is a pure function of its inputs — no timers, no I/O, no globals.
//
// Why this exists (the "RIP Sync after hibernate" bug it fixes):
//   On resume from sleep the local OAuth access token is briefly expired (Claude Code refreshes it a
//   little later). The sync would retry the 401 aggressively (60s interval + 30s watchdog), and the
//   repeated 401s tripped a *server-issued* 429 with a long Retry-After (up to an hour). By the time
//   Claude Code wrote a fresh token, the sync was stuck in that long backoff and showed "RIP Sync".
//   The fix: treat 401/403 as a short fixed cooldown (don't escalate), and let a credentials-refresh
//   signal clear any backoff the instant a new token lands.

export const AUTH_COOLDOWN_MS = 60 * 1000;        // 401/403: brief pause for Claude Code to refresh the token
export const RATE_LIMIT_MIN_MS = 90 * 1000;       // 429 exponential floor
export const RATE_LIMIT_MAX_MS = 30 * 60 * 1000;  // 429 exponential cap (30 min)
export const WATCHDOG_INTERVAL_MS = 30 * 1000;
export const SYNC_STALE_MS = 3 * 60 * 1000;       // a successful sync older than this ⇒ force a resync

// Classify an HTTP status from the usage endpoint into how the sync should react.
export function classifyUsageStatus(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  return 'other';
}

// Next 429 backoff duration. Honors Retry-After (seconds) when the server sends a positive value,
// otherwise doubles the previous backoff, clamped to [MIN, MAX].
export function nextRateLimitBackoffMs(prevBackoffMs, retryAfterSec) {
  const ra = Number(retryAfterSec);
  if (Number.isFinite(ra) && ra > 0) return ra * 1000;
  return Math.min(Math.max((prevBackoffMs || 0) * 2, RATE_LIMIT_MIN_MS), RATE_LIMIT_MAX_MS);
}

// Given the current backoff state and a usage response, compute the next backoff state.
// state: { backoffMs, backoffUntil }. Returns a new state plus the classified `kind`.
//   ok          → clear backoff
//   rate_limit  → exponential / Retry-After backoff
//   auth        → fixed short cooldown (never escalates)
//   other       → keep prior backoff, retry next cycle
export function reduceBackoff(state, { now, status, retryAfterSec } = {}) {
  const prev = { backoffMs: state?.backoffMs || 0, backoffUntil: state?.backoffUntil || 0 };
  const kind = classifyUsageStatus(status);
  switch (kind) {
    case 'ok':
      return { kind, backoffMs: 0, backoffUntil: 0 };
    case 'rate_limit': {
      const backoffMs = nextRateLimitBackoffMs(prev.backoffMs, retryAfterSec);
      return { kind, backoffMs, backoffUntil: now + backoffMs };
    }
    case 'auth':
      return { kind, backoffMs: AUTH_COOLDOWN_MS, backoffUntil: now + AUTH_COOLDOWN_MS };
    case 'other':
    default:
      return { kind, backoffMs: prev.backoffMs, backoffUntil: prev.backoffUntil };
  }
}

// May we start a fetch right now? (no overlapping fetch, and not inside a backoff window)
export function canFetch({ now, backoffUntil, inFlight }) {
  return !inFlight && now >= (backoffUntil || 0);
}

// Watchdog decision for one tick.
//   wokeFromSleep — timer drift far beyond the interval ⇒ machine resumed from sleep/hibernate
//   clearBackoff  — wake or a fresh token ⇒ any current backoff is stale, drop it
//   forceResync   — kick a fetch now (wake, fresh token, or sync gone stale and not backing off)
export function watchdogDecision({
  now, drift, lastGoodSyncMs, backoffUntil, credRefreshed = false,
  watchdogIntervalMs = WATCHDOG_INTERVAL_MS, syncStaleMs = SYNC_STALE_MS,
}) {
  const wokeFromSleep = drift > watchdogIntervalMs * 2.5;
  const clearBackoff = wokeFromSleep || credRefreshed;
  const syncAge = now - lastGoodSyncMs;
  const forceResync = wokeFromSleep || credRefreshed || (syncAge > syncStaleMs && now >= (backoffUntil || 0));
  return { wokeFromSleep, clearBackoff, forceResync, syncAge };
}
