import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatDuration,
  formatTime,
  formatNumber,
  formatTokens,
  formatRelativeTime,
  formatTimeWithSeconds
} from './format';

describe('formatDuration', () => {
  it('formats minutes only when less than 1 hour', () => {
    const start = new Date('2026-02-11T10:00:00');
    const end = new Date('2026-02-11T10:30:00');
    expect(formatDuration(start, end)).toBe('30m');
  });

  it('formats hours and minutes', () => {
    const start = new Date('2026-02-11T10:00:00');
    const end = new Date('2026-02-11T12:45:00');
    expect(formatDuration(start, end)).toBe('2h 45m');
  });

  it('uses current time when endedAt is null', () => {
    const start = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago
    const result = formatDuration(start, null);
    expect(result).toBe('15m');
  });
});

describe('formatTime', () => {
  it('returns empty string for null input', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });

  it('formats ISO string to HH:MM', () => {
    const result = formatTime('2026-02-11T14:30:00');
    // Result depends on locale, but should be 2-digit format
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatNumber', () => {
  it('returns number as string when less than 1000', () => {
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(0)).toBe('0');
  });

  it('formats thousands with k suffix', () => {
    expect(formatNumber(1500)).toBe('1.5k');
    expect(formatNumber(10000)).toBe('10.0k');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(2000000)).toBe('2.0M');
  });
});

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
