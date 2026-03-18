import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getNextPomodoroQuote } from '../utils/pomodoroQuotes';
import { getTodayKey } from '../utils/date';

export type PomodoroMode = 'work' | 'break' | 'idle';

interface PomodoroState {
  mode: PomodoroMode;
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  completedSessions: number;
  completedDay: string;
  quote: string;
  endsAt: number | null;
  phaseId: string | null;
}

interface PomodoroOptions {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  nickname: string;
}

interface PomodoroFinishedPayload {
  phaseId: string;
  completedMode: Exclude<PomodoroMode, 'idle'>;
}

interface PomodoroAnnouncement {
  speechText: string;
  notificationBody: string;
}

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;
const STORAGE_KEY = 'alarm-clock-pomodoro-state';

function createPhaseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultState(): PomodoroState {
  return {
    mode: 'idle',
    timeLeft: WORK_TIME,
    totalTime: WORK_TIME,
    isRunning: false,
    completedSessions: 0,
    completedDay: getTodayKey(),
    quote: getNextPomodoroQuote(),
    endsAt: null,
    phaseId: null,
  };
}

function getCurrentRemainingSeconds(endsAt: number | null) {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function getTodayCompletedSessions(completedSessions: number, completedDay: string) {
  return completedDay === getTodayKey() ? completedSessions : 0;
}

function hydrateState(): PomodoroState {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }

  const fallbackState = createDefaultState();
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PomodoroState>;
    const today = getTodayKey();
    const completedSessions = getTodayCompletedSessions(
      Number(parsed.completedSessions) || 0,
      parsed.completedDay || today,
    );

    const hydratedState: PomodoroState = {
      mode: parsed.mode === 'work' || parsed.mode === 'break' || parsed.mode === 'idle'
        ? parsed.mode
        : fallbackState.mode,
      timeLeft: typeof parsed.timeLeft === 'number' ? parsed.timeLeft : fallbackState.timeLeft,
      totalTime: typeof parsed.totalTime === 'number' ? parsed.totalTime : fallbackState.totalTime,
      isRunning: Boolean(parsed.isRunning),
      completedSessions,
      completedDay: today,
      quote: typeof parsed.quote === 'string' && parsed.quote.trim()
        ? parsed.quote
        : fallbackState.quote,
      endsAt: typeof parsed.endsAt === 'number' ? parsed.endsAt : null,
      phaseId: typeof parsed.phaseId === 'string' ? parsed.phaseId : null,
    };

    if (!hydratedState.isRunning || !hydratedState.endsAt) {
      return hydratedState;
    }

    const remainingSeconds = getCurrentRemainingSeconds(hydratedState.endsAt);
    if (remainingSeconds > 0) {
      return {
        ...hydratedState,
        timeLeft: remainingSeconds,
      };
    }

    if (hydratedState.mode === 'work') {
      return {
        ...hydratedState,
        mode: 'break',
        timeLeft: BREAK_TIME,
        totalTime: BREAK_TIME,
        isRunning: false,
        completedSessions: completedSessions + 1,
        endsAt: null,
        phaseId: null,
      };
    }

    return {
      ...hydratedState,
      mode: 'work',
      timeLeft: WORK_TIME,
      totalTime: WORK_TIME,
      isRunning: false,
      quote: getNextPomodoroQuote(hydratedState.quote),
      endsAt: null,
      phaseId: null,
    };
  } catch {
    return fallbackState;
  }
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatClockLabel(timestamp: number) {
  const date = new Date(timestamp);
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}点${minute}分`;
}

function buildPomodoroAnnouncement(
  completedMode: Exclude<PomodoroMode, 'idle'>,
  nickname: string,
  finishedAt = Date.now(),
): PomodoroAnnouncement {
  const prefix = nickname.trim() ? `${nickname}，` : '';
  const timeLabel = formatClockLabel(finishedAt);

  if (completedMode === 'work') {
    return {
      speechText: `${prefix}番茄时间到了，现在是${timeLabel}。站起来喝点水，看看远处的风景，活动活动，接下来给自己留五分钟休息时间。祝你工作顺利。`,
      notificationBody: `番茄时间到了，现在是${timeLabel}，起来喝点水休息一下吧。`,
    };
  }

  return {
    speechText: `${prefix}休息时间结束了，现在是${timeLabel}。下一轮番茄钟已经准备好了，等你点继续，我们再开始专注。慢慢来，今天也会很顺。`,
    notificationBody: `休息时间结束，现在是${timeLabel}，下一轮番茄钟已经准备好了。`,
  };
}

export function usePomodoro({ soundEnabled, notificationsEnabled, nickname }: PomodoroOptions) {
  const [state, setState] = useState<PomodoroState>(() => hydrateState());
  const stateRef = useRef(state);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUqXh8bllHAU2kNbxz4AzBSh+zPLaizsIHGu98+OWT');
  }, []);

  const finishPhase = useCallback((phaseId: string, completedMode: Exclude<PomodoroMode, 'idle'>) => {
    setState(prev => {
      if (prev.phaseId !== phaseId) {
        return prev;
      }

      const today = getTodayKey();
      const completedSessions = getTodayCompletedSessions(prev.completedSessions, prev.completedDay);

      if (completedMode === 'work') {
        const nextBreakPhaseId = createPhaseId();
        return {
          ...prev,
          mode: 'break',
          timeLeft: BREAK_TIME,
          totalTime: BREAK_TIME,
          isRunning: true,
          completedSessions: completedSessions + 1,
          completedDay: today,
          endsAt: Date.now() + BREAK_TIME * 1000,
          phaseId: nextBreakPhaseId,
        };
      }

      return {
        ...prev,
        mode: 'work',
        timeLeft: WORK_TIME,
        totalTime: WORK_TIME,
        isRunning: false,
        completedSessions,
        completedDay: today,
        quote: getNextPomodoroQuote(prev.quote),
        endsAt: null,
        phaseId: null,
      };
    });
  }, []);

  const playWebNotification = useCallback((
    completedMode: Exclude<PomodoroMode, 'idle'>,
    finishedAt = Date.now(),
  ) => {
    const announcement = buildPomodoroAnnouncement(completedMode, nickname, finishedAt);

    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('番茄钟提醒', {
        body: announcement.notificationBody,
        icon: '/favicon.svg',
      });
    }

    if (!soundEnabled) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => undefined);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(announcement.speechText);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.pitch = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v =>
        v.lang.includes('zh') &&
        (v.name.includes('Ting') || v.name.includes('Yaoyao') || v.name.includes('Meijia') || v.name.includes('Female'))
      );

      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  }, [nickname, notificationsEnabled, soundEnabled]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    listen<PomodoroFinishedPayload>('pomodoro://finished', (event) => {
      finishPhase(event.payload.phaseId, event.payload.completedMode);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [finishPhase]);

  useEffect(() => {
    if (!state.isRunning || !state.endsAt) {
      return;
    }

    const syncRemainingTime = () => {
      setState(prev => {
        if (!prev.isRunning || !prev.endsAt) {
          return prev;
        }

        const nextTimeLeft = getCurrentRemainingSeconds(prev.endsAt);
        if (nextTimeLeft === prev.timeLeft) {
          return prev;
        }

        return {
          ...prev,
          timeLeft: nextTimeLeft,
        };
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

    if (!state.isRunning || state.timeLeft > 0 || !state.phaseId || state.mode === 'idle') {
      return;
    }

    playWebNotification(state.mode, state.endsAt ?? Date.now());
    finishPhase(state.phaseId, state.mode);
  }, [state.isRunning, state.timeLeft, state.phaseId, state.mode, finishPhase, playWebNotification]);

  useEffect(() => {
    if (!isTauri() || !state.isRunning || !state.phaseId || !state.endsAt || state.mode === 'idle') {
      return;
    }

    const remainingSeconds = Math.max(1, getCurrentRemainingSeconds(state.endsAt));
    const announcement = buildPomodoroAnnouncement(state.mode, nickname, state.endsAt);

    invoke('schedule_pomodoro_phase', {
      request: {
        phaseId: state.phaseId,
        durationSeconds: remainingSeconds,
        mode: state.mode,
        nickname,
        speechText: announcement.speechText,
        notificationBody: announcement.notificationBody,
        soundEnabled,
        notificationsEnabled,
      },
    }).catch((error) => {
      console.error('原生番茄提醒调度失败:', error);
    });
  }, [
    state.isRunning,
    state.phaseId,
    state.endsAt,
    state.mode,
    nickname,
    soundEnabled,
    notificationsEnabled,
  ]);

  useEffect(() => {
    if (!isTauri() || state.isRunning) {
      return;
    }

    invoke('cancel_pomodoro_phase').catch(() => undefined);
  }, [state.isRunning]);

  const start = useCallback(() => {
    const current = stateRef.current;
    const nextMode = current.mode === 'idle' ? 'work' : current.mode;
    const nextTimeLeft = current.mode === 'idle'
      ? WORK_TIME
      : Math.max(1, current.timeLeft);

    setState(prev => ({
      ...prev,
      mode: nextMode,
      timeLeft: nextTimeLeft,
      totalTime: nextMode === 'work' ? WORK_TIME : BREAK_TIME,
      isRunning: true,
      quote: nextMode === 'work' && prev.mode === 'idle'
        ? getNextPomodoroQuote(prev.quote)
        : prev.quote,
      endsAt: Date.now() + nextTimeLeft * 1000,
      phaseId: createPhaseId(),
    }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => {
      const nextTimeLeft = prev.endsAt
        ? Math.max(1, getCurrentRemainingSeconds(prev.endsAt))
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

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'idle',
      timeLeft: WORK_TIME,
      totalTime: WORK_TIME,
      isRunning: false,
      endsAt: null,
      phaseId: null,
      quote: getNextPomodoroQuote(prev.quote),
    }));
  }, []);

  const skip = useCallback(() => {
    setState(prev => {
      const today = getTodayKey();
      const completedSessions = getTodayCompletedSessions(prev.completedSessions, prev.completedDay);

      if (prev.mode === 'work') {
        return {
          ...prev,
          mode: 'break',
          timeLeft: BREAK_TIME,
          totalTime: BREAK_TIME,
          isRunning: false,
          completedSessions,
          completedDay: today,
          endsAt: null,
          phaseId: null,
        };
      }

      if (prev.mode === 'break') {
        return {
          ...prev,
          mode: 'work',
          timeLeft: WORK_TIME,
          totalTime: WORK_TIME,
          isRunning: false,
          completedSessions,
          completedDay: today,
          quote: getNextPomodoroQuote(prev.quote),
          endsAt: null,
          phaseId: null,
        };
      }

      return prev;
    });
  }, []);

  const progress = state.totalTime > 0
    ? ((state.totalTime - state.timeLeft) / state.totalTime) * 100
    : 0;

  return {
    ...state,
    completedSessions: getTodayCompletedSessions(state.completedSessions, state.completedDay),
    formattedTime: formatTime(state.timeLeft),
    progress,
    start,
    pause,
    reset,
    skip,
  };
}
