import { describe, expect, it } from 'vitest';
import {
  buildCountdownAnnouncement,
  clampCountdownMinutes,
  computeTargetTimestamp,
  formatClockShort,
  formatCountdown,
  getRemainingSeconds,
  normalizeCountdownLabel,
} from './countdown';

describe('clampCountdownMinutes', () => {
  it('keeps values inside 1 minute to 24 hours', () => {
    expect(clampCountdownMinutes(30)).toBe(30);
    expect(clampCountdownMinutes(0)).toBe(1);
    expect(clampCountdownMinutes(-5)).toBe(1);
    expect(clampCountdownMinutes(2000)).toBe(1440);
  });

  it('rounds fractional input', () => {
    expect(clampCountdownMinutes(10.4)).toBe(10);
    expect(clampCountdownMinutes(10.6)).toBe(11);
  });

  it('falls back to minimum for invalid input', () => {
    expect(clampCountdownMinutes(Number.NaN)).toBe(1);
  });
});

describe('formatCountdown', () => {
  it('formats under one hour as mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(3599)).toBe('59:59');
  });

  it('formats one hour and above as h:mm:ss', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(7325)).toBe('2:02:05');
  });

  it('treats negative input as zero', () => {
    expect(formatCountdown(-10)).toBe('00:00');
  });
});

describe('formatClockShort', () => {
  it('pads hour and minute', () => {
    const ts = new Date(2026, 8, 6, 9, 5).getTime();
    expect(formatClockShort(ts)).toBe('09:05');
  });
});

describe('getRemainingSeconds', () => {
  it('returns 0 for null end', () => {
    expect(getRemainingSeconds(null)).toBe(0);
  });

  it('ceil remaining seconds', () => {
    const now = 1_000_000;
    expect(getRemainingSeconds(now + 1500, now)).toBe(2);
    expect(getRemainingSeconds(now - 500, now)).toBe(0);
  });
});

describe('computeTargetTimestamp', () => {
  const now = new Date(2026, 8, 6, 15, 0, 0, 0).getTime();

  it('returns today when target is in the future', () => {
    const target = new Date(computeTargetTimestamp(16, 30, now));
    expect(target.getHours()).toBe(16);
    expect(target.getMinutes()).toBe(30);
    expect(target.getDate()).toBe(6);
  });

  it('returns tomorrow when target already passed', () => {
    const target = new Date(computeTargetTimestamp(14, 0, now));
    expect(target.getDate()).toBe(7);
    expect(target.getHours()).toBe(14);
  });
});

describe('normalizeCountdownLabel', () => {
  it('trims and limits length', () => {
    expect(normalizeCountdownLabel('  下课  ')).toBe('下课');
    expect(normalizeCountdownLabel('一二三四五六七八九十十一')).toBe('一二三四五六七八九十');
  });

  it('falls back for empty label', () => {
    expect(normalizeCountdownLabel('   ')).toBe('倒计时');
  });
});

describe('buildCountdownAnnouncement', () => {
  const finishedAt = new Date(2026, 8, 6, 16, 30).getTime();

  it('includes nickname prefix when provided', () => {
    const result = buildCountdownAnnouncement('下课', '金哥', finishedAt);
    expect(result.speechText).toBe('金哥，下课时间到了，现在是16点30分。');
    expect(result.notificationBody).toBe('金哥，下课时间到了，现在是16点30分。');
  });

  it('works without nickname', () => {
    const result = buildCountdownAnnouncement('会议', '', finishedAt);
    expect(result.speechText).toBe('会议时间到了，现在是16点30分。');
  });

  it('falls back to default label', () => {
    const result = buildCountdownAnnouncement(' ', '金哥', finishedAt);
    expect(result.notificationBody).toBe('金哥，倒计时时间到了，现在是16点30分。');
  });
});
