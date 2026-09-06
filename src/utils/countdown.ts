export interface CountdownAnnouncement {
  speechText: string;
  notificationBody: string;
}

export const MIN_COUNTDOWN_MINUTES = 1;
export const MAX_COUNTDOWN_MINUTES = 24 * 60;

const FALLBACK_LABEL = '倒计时';

export function clampCountdownMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return MIN_COUNTDOWN_MINUTES;
  }

  return Math.min(
    MAX_COUNTDOWN_MINUTES,
    Math.max(MIN_COUNTDOWN_MINUTES, Math.round(minutes)),
  );
}

export function normalizeCountdownLabel(label: string): string {
  const trimmed = label.trim().slice(0, 10);
  return trimmed || FALLBACK_LABEL;
}

export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

export function formatClockShort(timestamp: number): string {
  const date = new Date(timestamp);
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatClockLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}点${minute}分`;
}

export function getRemainingSeconds(endsAt: number | null, now = Date.now()): number {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function computeTargetTimestamp(hour: number, minute: number, now = Date.now()): number {
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (target.getTime() <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}

export function buildCountdownAnnouncement(
  label: string,
  nickname: string,
  finishedAt = Date.now(),
): CountdownAnnouncement {
  const normalizedLabel = normalizeCountdownLabel(label);
  const prefix = nickname.trim() ? `${nickname}，` : '';
  const timeLabel = formatClockLabel(finishedAt);

  return {
    speechText: `${prefix}${normalizedLabel}时间到了，现在是${timeLabel}。`,
    notificationBody: `${prefix}${normalizedLabel}时间到了，现在是${timeLabel}。`,
  };
}
