import { describe, it, expect } from '@jest/globals';
import {
  classifyUsageStatus,
  nextRateLimitBackoffMs,
  reduceBackoff,
  canFetch,
  watchdogDecision,
  AUTH_COOLDOWN_MS,
  RATE_LIMIT_MIN_MS,
  RATE_LIMIT_MAX_MS,
  WATCHDOG_INTERVAL_MS,
  SYNC_STALE_MS,
} from '../usageBackoff.js';

describe('classifyUsageStatus', () => {
  it('maps 2xx to ok', () => {
    expect(classifyUsageStatus(200)).toBe('ok');
    expect(classifyUsageStatus(204)).toBe('ok');
    expect(classifyUsageStatus(299)).toBe('ok');
  });
  it('maps 429 to rate_limit', () => {
    expect(classifyUsageStatus(429)).toBe('rate_limit');
  });
  it('maps 401/403 to auth', () => {
    expect(classifyUsageStatus(401)).toBe('auth');
    expect(classifyUsageStatus(403)).toBe('auth');
  });
  it('maps everything else to other', () => {
    expect(classifyUsageStatus(500)).toBe('other');
    expect(classifyUsageStatus(404)).toBe('other');
    expect(classifyUsageStatus(0)).toBe('other');
  });
});

describe('nextRateLimitBackoffMs', () => {
  it('honors a positive Retry-After (seconds → ms)', () => {
    expect(nextRateLimitBackoffMs(0, 3600)).toBe(3600 * 1000);
    expect(nextRateLimitBackoffMs(90000, 5)).toBe(5000);
  });
  it('ignores missing / non-positive Retry-After and uses exponential', () => {
    expect(nextRateLimitBackoffMs(0, NaN)).toBe(RATE_LIMIT_MIN_MS);   // first 429 floors at MIN
    expect(nextRateLimitBackoffMs(0, 0)).toBe(RATE_LIMIT_MIN_MS);
    expect(nextRateLimitBackoffMs(0, -1)).toBe(RATE_LIMIT_MIN_MS);
  });
  it('doubles within [MIN, MAX]', () => {
    expect(nextRateLimitBackoffMs(RATE_LIMIT_MIN_MS)).toBe(RATE_LIMIT_MIN_MS * 2);
    expect(nextRateLimitBackoffMs(RATE_LIMIT_MAX_MS)).toBe(RATE_LIMIT_MAX_MS); // capped
    expect(nextRateLimitBackoffMs(RATE_LIMIT_MAX_MS * 10)).toBe(RATE_LIMIT_MAX_MS);
  });
});

describe('reduceBackoff', () => {
  const NOW = 1_000_000;

  it('clears backoff on a healthy response', () => {
    const next = reduceBackoff({ backoffMs: 999, backoffUntil: NOW + 999 }, { now: NOW, status: 200 });
    expect(next).toEqual({ kind: 'ok', backoffMs: 0, backoffUntil: 0 });
  });

  it('401 sets a short fixed cooldown and never escalates', () => {
    const first = reduceBackoff({ backoffMs: 0, backoffUntil: 0 }, { now: NOW, status: 401 });
    expect(first.kind).toBe('auth');
    expect(first.backoffMs).toBe(AUTH_COOLDOWN_MS);
    expect(first.backoffUntil).toBe(NOW + AUTH_COOLDOWN_MS);

    // repeated 401s must NOT grow the cooldown (this is what tripped the long 429 before)
    const second = reduceBackoff(first, { now: NOW + AUTH_COOLDOWN_MS, status: 401 });
    expect(second.backoffMs).toBe(AUTH_COOLDOWN_MS);
  });

  it('403 is treated like 401 (auth cooldown)', () => {
    const next = reduceBackoff({ backoffMs: 0, backoffUntil: 0 }, { now: NOW, status: 403 });
    expect(next.kind).toBe('auth');
    expect(next.backoffMs).toBe(AUTH_COOLDOWN_MS);
  });

  it('429 honors Retry-After', () => {
    const next = reduceBackoff({ backoffMs: 0, backoffUntil: 0 }, { now: NOW, status: 429, retryAfterSec: 120 });
    expect(next.kind).toBe('rate_limit');
    expect(next.backoffMs).toBe(120_000);
    expect(next.backoffUntil).toBe(NOW + 120_000);
  });

  it('429 without Retry-After backs off exponentially from the prior value', () => {
    const first = reduceBackoff({ backoffMs: 0, backoffUntil: 0 }, { now: NOW, status: 429 });
    expect(first.backoffMs).toBe(RATE_LIMIT_MIN_MS);
    const second = reduceBackoff(first, { now: NOW, status: 429 });
    expect(second.backoffMs).toBe(RATE_LIMIT_MIN_MS * 2);
  });

  it('other (5xx) keeps the prior backoff untouched', () => {
    const prior = { backoffMs: 12345, backoffUntil: NOW + 12345 };
    const next = reduceBackoff(prior, { now: NOW, status: 500 });
    expect(next.kind).toBe('other');
    expect(next.backoffMs).toBe(prior.backoffMs);
    expect(next.backoffUntil).toBe(prior.backoffUntil);
  });
});

describe('canFetch', () => {
  it('blocks while a fetch is in flight', () => {
    expect(canFetch({ now: 100, backoffUntil: 0, inFlight: true })).toBe(false);
  });
  it('blocks inside the backoff window', () => {
    expect(canFetch({ now: 100, backoffUntil: 200, inFlight: false })).toBe(false);
  });
  it('allows once the backoff window has passed and nothing is in flight', () => {
    expect(canFetch({ now: 250, backoffUntil: 200, inFlight: false })).toBe(true);
    expect(canFetch({ now: 200, backoffUntil: 200, inFlight: false })).toBe(true); // boundary inclusive
  });
});

describe('watchdogDecision', () => {
  const base = {
    now: 10_000_000,
    drift: WATCHDOG_INTERVAL_MS,        // normal tick, no sleep
    lastGoodSyncMs: 10_000_000,         // just synced
    backoffUntil: 0,
    credRefreshed: false,
  };

  it('does nothing on a normal, healthy tick', () => {
    const d = watchdogDecision(base);
    expect(d.wokeFromSleep).toBe(false);
    expect(d.clearBackoff).toBe(false);
    expect(d.forceResync).toBe(false);
  });

  it('detects wake from sleep on large timer drift and forces a resync + clears backoff', () => {
    const d = watchdogDecision({ ...base, drift: WATCHDOG_INTERVAL_MS * 3, backoffUntil: base.now + 999999 });
    expect(d.wokeFromSleep).toBe(true);
    expect(d.clearBackoff).toBe(true);
    expect(d.forceResync).toBe(true);
  });

  it('forces a resync when the last good sync is stale and not backing off', () => {
    const d = watchdogDecision({ ...base, lastGoodSyncMs: base.now - SYNC_STALE_MS - 1 });
    expect(d.wokeFromSleep).toBe(false);
    expect(d.forceResync).toBe(true);
  });

  it('does NOT force a resync when stale but still inside a backoff window', () => {
    const d = watchdogDecision({
      ...base,
      lastGoodSyncMs: base.now - SYNC_STALE_MS - 1,
      backoffUntil: base.now + 60_000, // still backing off
    });
    expect(d.forceResync).toBe(false);
  });

  it('a credentials refresh clears backoff and forces a resync even mid-backoff (the bug fix)', () => {
    const d = watchdogDecision({
      ...base,
      lastGoodSyncMs: base.now - 10 * 60_000,   // long stale
      backoffUntil: base.now + 30 * 60_000,     // stuck in a long 429 backoff
      credRefreshed: true,                      // ...but Claude Code just wrote a fresh token
    });
    expect(d.clearBackoff).toBe(true);
    expect(d.forceResync).toBe(true);
  });
});
