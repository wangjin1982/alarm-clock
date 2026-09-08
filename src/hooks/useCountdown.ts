import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  buildCountdownAnnouncement,
  clampCountdownMinutes,
  computeTargetTimestamp,
  formatCountdown,
  getRemainingSeconds,
  normalizeCountdownLabel,
} from '../utils/countdown';
import { playWebBeep, showWebNotification, speakChinese } from '../utils/announcement';

interface CountdownState {
  label: string;
  timeLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  finished: boolean;
  endsAt: number | null;
  phaseId: string | null;
}

interface CountdownOptions {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  nickname: string;
}

interface CountdownFinishedPayload {
  phaseId: string;
}

const STORAGE_KEY = 'alarm-clock-countdown-state';
const DEFAULT_LABEL = '下课';
const BEEP_DATA_URI = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUqXh8bllHAU2kNbxz4AzBSh+zPLaizsIHGu98+OWT';

function createPhaseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultState(): CountdownState {
  return {
    label: DEFAULT_LABEL,
    timeLeft: 0,
    totalSeconds: 0,
    isRunning: false,
    finished: false,
    endsAt: null,
    phaseId: null,
  };
}

function hydrateState(): CountdownState {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(saved) as Partial<CountdownState>;
    const baseState: CountdownState = {
      label: typeof parsed.label === 'string' ? parsed.label : DEFAULT_LABEL,
      timeLeft: typeof parsed.timeLeft === 'number' ? Math.max(0, parsed.timeLeft) : 0,
      totalSeconds: typeof parsed.totalSeconds === 'number' ? Math.max(0, parsed.totalSeconds) : 0,
      isRunning: false,
      finished: false,
      endsAt: typeof parsed.endsAt === 'number' ? parsed.endsAt : null,
      phaseId: typeof parsed.phaseId === 'string' ? parsed.phaseId : null,
    };

    if (!parsed.isRunning || !baseState.endsAt) {
      return baseState;
    }

    const remainingSeconds = getRemainingSeconds(baseState.endsAt);
    if (remainingSeconds > 0) {
      return { ...baseState, isRunning: true, timeLeft: remainingSeconds };
    }

    return { ...baseState, finished: true };
  } catch {
    return createDefaultState();
  }
}

export function useCountdown({ soundEnabled, notificationsEnabled, nickname }: CountdownOptions) {
  const [state, setState] = useState<CountdownState>(() => hydrateState());
  const stateRef = useRef(state);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    audioRef.current = new Audio(BEEP_DATA_URI);
  }, []);

  const announceFinished = useCallback((finishedAt: number) => {
    const announcement = buildCountdownAnnouncement(stateRef.current.label, nickname, finishedAt);

    if (notificationsEnabled) {
      showWebNotification('倒计时提醒', announcement.notificationBody);
    }

    if (soundEnabled) {
      playWebBeep(audioRef.current);
      speakChinese(announcement.speechText);
    }
  }, [nickname, notificationsEnabled, soundEnabled]);

  // 只更新状态，不负责播报：Tauri 下语音/通知由 Rust 端单次触发，
  // 浏览器下由下方 web 专属 effect 播报，避免两条链路各响一次
  const markFinished = useCallback((phaseId: string | null) => {
    setState(prev => {
      if (phaseId !== null && prev.phaseId !== phaseId) {
        return prev;
      }

      return { ...prev, isRunning: false, finished: true, endsAt: null, phaseId: null };
    });
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    listen<CountdownFinishedPayload>('countdown://finished', (event) => {
      markFinished(event.payload.phaseId);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [markFinished]);

  useEffect(() => {
    if (!state.isRunning || !state.endsAt) {
      return;
    }

    const syncRemainingTime = () => {
      setState(prev => {
        if (!prev.isRunning || !prev.endsAt) {
          return prev;
        }

        const nextTimeLeft = getRemainingSeconds(prev.endsAt);
        if (nextTimeLeft === prev.timeLeft) {
          return prev;
        }

        return { ...prev, timeLeft: nextTimeLeft };
      });
    };

    syncRemainingTime();
    const timer = window.setInterval(syncRemainingTime, 1000);
    return () => window.clearInterval(timer);
  }, [state.isRunning, state.endsAt]);

  useEffect(() => {
    if (isTauri()) {
      return;
    }

    if (!state.isRunning || state.timeLeft > 0 || !state.phaseId) {
      return;
    }

    announceFinished(Date.now());
    markFinished(state.phaseId);
  }, [state.isRunning, state.timeLeft, state.phaseId, announceFinished, markFinished]);

  useEffect(() => {
    if (!isTauri() || !state.isRunning || !state.phaseId || !state.endsAt) {
      return;
    }

    const remainingSeconds = Math.max(1, getRemainingSeconds(state.endsAt));
    const announcement = buildCountdownAnnouncement(state.label, nickname, state.endsAt);

    invoke('schedule_countdown_phase', {
      request: {
        phaseId: state.phaseId,
        durationSeconds: remainingSeconds,
        nickname,
        speechText: announcement.speechText,
        notificationBody: announcement.notificationBody,
        soundEnabled,
        notificationsEnabled,
      },
    }).catch((error) => {
      console.error('原生倒计时调度失败:', error);
    });
  }, [
    state.isRunning,
    state.phaseId,
    state.endsAt,
    state.label,
    nickname,
    soundEnabled,
    notificationsEnabled,
  ]);

  useEffect(() => {
    if (!isTauri() || state.isRunning) {
      return;
    }

    invoke('cancel_countdown_phase').catch(() => undefined);
  }, [state.isRunning]);

  const beginPhase = useCallback((label: string, endsAt: number) => {
    const totalSeconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));

    setState(prev => ({
      ...prev,
      label: normalizeCountdownLabel(label),
      timeLeft: totalSeconds,
      totalSeconds,
      isRunning: true,
      finished: false,
      endsAt,
      phaseId: createPhaseId(),
    }));
  }, []);

  const startWithDuration = useCallback((minutes: number, label: string) => {
    const safeMinutes = clampCountdownMinutes(minutes);
    beginPhase(label, Date.now() + safeMinutes * 60 * 1000);
  }, [beginPhase]);

  const startWithTargetTime = useCallback((hour: number, minute: number, label: string) => {
    beginPhase(label, computeTargetTimestamp(hour, minute));
  }, [beginPhase]);

  const pause = useCallback(() => {
    setState(prev => {
      if (!prev.isRunning) {
        return prev;
      }

      const nextTimeLeft = prev.endsAt
        ? getRemainingSeconds(prev.endsAt)
        : prev.timeLeft;

      return {
        ...prev,
        timeLeft: nextTimeLeft,
        isRunning: false,
        endsAt: null,
        phaseId: null,
      };
    });
  }, []);

  const resume = useCallback(() => {
    setState(prev => {
      if (prev.isRunning || prev.timeLeft <= 0) {
        return prev;
      }

      return {
        ...prev,
        isRunning: true,
        endsAt: Date.now() + prev.timeLeft * 1000,
        phaseId: createPhaseId(),
      };
    });
  }, []);

  const extendMinutes = useCallback((minutes: number) => {
    const safeMinutes = clampCountdownMinutes(minutes);
    setState(prev => {
      if (prev.isRunning && prev.endsAt) {
        return {
          ...prev,
          totalSeconds: prev.totalSeconds + safeMinutes * 60,
          endsAt: prev.endsAt + safeMinutes * 60 * 1000,
        };
      }

      if (prev.timeLeft > 0) {
        return {
          ...prev,
          timeLeft: prev.timeLeft + safeMinutes * 60,
          totalSeconds: prev.totalSeconds + safeMinutes * 60,
        };
      }

      return prev;
    });
  }, []);

  const cancel = useCallback(() => {
    setState(prev => ({
      ...prev,
      timeLeft: 0,
      totalSeconds: 0,
      isRunning: false,
      finished: false,
      endsAt: null,
      phaseId: null,
    }));
  }, []);

  const dismissFinished = useCallback(() => {
    setState(prev => ({
      ...prev,
      timeLeft: 0,
      totalSeconds: 0,
      finished: false,
    }));
  }, []);

  const setLabel = useCallback((label: string) => {
    setState(prev => ({ ...prev, label }));
  }, []);

  const progress = state.totalSeconds > 0
    ? ((state.totalSeconds - state.timeLeft) / state.totalSeconds) * 100
    : 0;

  return {
    ...state,
    formattedTime: formatCountdown(state.timeLeft),
    progress,
    startWithDuration,
    startWithTargetTime,
    pause,
    resume,
    extendMinutes,
    cancel,
    dismissFinished,
    setLabel,
  };
}
