import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatTokens,
  formatRelativeTime,
  formatTimeWithSeconds
} from './format';

describe('formatTokens', () => {
  it('returns "0" for falsy values', () => {
    expect(formatTokens(null)).toBe('0');
    expect(formatTokens(undefined)).toBe('0');
    expect(formatTokens(0)).toBe('0');
  });

  it('formats small numbers as-is', () => {
    expect(formatTokens(500)).toBe('500');
  });

  it('formats thousands with k suffix', () => {
    expect(formatTokens(1500)).toBe('1.5k');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokens(1500000)).toBe('1.5M');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-11T12:00:00'));
  });

  it('returns empty string for null input', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns "now" for very recent times', () => {
    const recent = new Date('2026-02-11T11:59:55'); // 5 seconds ago
    expect(formatRelativeTime(recent.toISOString())).toBe('now');
  });

  it('returns seconds for times under 1 minute', () => {
    const thirtySecsAgo = new Date('2026-02-11T11:59:30'); // 30 seconds ago
    expect(formatRelativeTime(thirtySecsAgo.toISOString())).toBe('30s');
  });

  it('returns minutes for times under 1 hour', () => {
    const tenMinsAgo = new Date('2026-02-11T11:50:00'); // 10 minutes ago
    expect(formatRelativeTime(tenMinsAgo.toISOString())).toBe('10m');
  });

  it('returns hours for times under 24 hours', () => {
    const threeHoursAgo = new Date('2026-02-11T09:00:00'); // 3 hours ago
    expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3h');
  });
});

describe('formatTimeWithSeconds', () => {
  it('returns placeholder for null input', () => {
    expect(formatTimeWithSeconds(null)).toBe('--:--:--');
    expect(formatTimeWithSeconds(undefined)).toBe('--:--:--');
  });

  it('formats time with seconds', () => {
    const result = formatTimeWithSeconds('2026-02-11T14:30:45');
    // Result depends on locale, but should include seconds
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
