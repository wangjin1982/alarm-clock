import { useState } from 'react';
import { Hourglass, Pause, Play, Plus, PartyPopper, X } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';
import { formatClockShort } from '../utils/countdown';
import { SectionCard } from './SectionCard';

interface CountdownWidgetProps {
  nickname: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const PRESET_MINUTES = [15, 30, 45, 60];
const AMBER = 'text-amber-300';
const AMBER_GRADIENT = 'from-amber-400 via-orange-400 to-amber-500';

function TimeSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="rounded-lg bg-white/10 px-3 py-2 text-center"
    >
      {options.map(option => (
        <option key={option} value={option}>
          {option.toString().padStart(2, '0')}
        </option>
      ))}
    </select>
  );
}

export function CountdownWidget({
  nickname,
  notificationsEnabled,
  soundEnabled,
  expanded,
  onToggle,
}: CountdownWidgetProps) {
  const countdown = useCountdown({ nickname, notificationsEnabled, soundEnabled });

  const now = new Date();
  const [targetHour, setTargetHour] = useState(Math.min(23, now.getHours() + 1));
  const [targetMinute, setTargetMinute] = useState(0);

  const targetTimestamp = countdown.isRunning && countdown.endsAt
    ? countdown.endsAt
    : null;

  const summary = countdown.finished
    ? `${countdown.label}时间到了`
    : countdown.timeLeft > 0
      ? `${countdown.formattedTime}${countdown.isRunning ? '' : ' · 已暂停'}`
      : '未开始';

  return (
    <SectionCard
      icon={<Hourglass size={18} />}
      iconColor={AMBER}
      title="倒计时"
      expanded={expanded}
      onToggle={onToggle}
      summary={
        <span className={countdown.finished || countdown.timeLeft > 0 ? AMBER : undefined}>
          {summary}
        </span>
      }
    >
      {countdown.finished ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-4">
          <div className={`flex items-center gap-2 text-sm font-medium ${AMBER}`}>
            <PartyPopper size={16} />
            <span>{countdown.label}时间到了</span>
          </div>
          <button
            onClick={countdown.dismissFinished}
            className="rounded-lg bg-amber-400/20 px-4 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-400/30"
          >
            知道了
          </button>
        </div>
      ) : countdown.timeLeft > 0 ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="text-xs text-slate-400">
              距离{countdown.label}
              {targetTimestamp && (
                <span className="text-slate-500"> · 预计 {formatClockShort(targetTimestamp)}</span>
              )}
            </div>
            <div className={`text-3xl font-bold leading-none tracking-[-0.06em] tabular-nums ${AMBER}`}>
              {countdown.formattedTime}
            </div>
          </div>

          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${AMBER_GRADIENT} transition-all duration-1000 ease-linear`}
              style={{ width: `${countdown.progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => countdown.extendMinutes(5)}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-slate-300 text-sm transition-all hover:bg-white/20 active:scale-95"
              title="延长 5 分钟"
            >
              <Plus size={14} />
              <span>5分钟</span>
            </button>
            {countdown.isRunning ? (
              <button
                onClick={countdown.pause}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 py-2 text-white text-sm font-medium shadow-lg transition-all hover:opacity-90 active:scale-95"
              >
                <Pause size={16} fill="currentColor" />
                <span>暂停</span>
              </button>
            ) : (
              <button
                onClick={countdown.resume}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 py-2 text-white text-sm font-medium shadow-lg transition-all hover:opacity-90 active:scale-95"
              >
                <Play size={16} fill="currentColor" />
                <span>继续</span>
              </button>
            )}
            <button
              onClick={countdown.cancel}
              className="rounded-lg bg-white/10 p-2 text-slate-300 transition-all hover:bg-white/20 active:scale-95"
              title="取消倒计时"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={countdown.label}
              onChange={(event) => countdown.setLabel(event.target.value)}
              maxLength={10}
              placeholder="下课"
              className="w-24 rounded-lg bg-white/10 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
            <span className="text-xs text-slate-500">事项名称，例如：下课</span>
          </div>

          <div className="flex items-center gap-2">
            <TimeSelect
              value={targetHour}
              options={Array.from({ length: 24 }, (_, index) => index)}
              onChange={setTargetHour}
            />
            <span className="text-lg">:</span>
            <TimeSelect
              value={targetMinute}
              options={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
              onChange={setTargetMinute}
            />
            <button
              onClick={() => countdown.startWithTargetTime(targetHour, targetMinute, countdown.label)}
              className={`flex-1 rounded-lg bg-gradient-to-r ${AMBER_GRADIENT} py-2 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-95`}
            >
              到点开始
            </button>
          </div>

          <div className="flex items-center justify-between gap-1.5">
            {PRESET_MINUTES.map(minutes => (
              <button
                key={minutes}
                onClick={() => countdown.startWithDuration(minutes, countdown.label)}
                className="flex-1 rounded-lg bg-white/10 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/20"
              >
                {minutes}分钟
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500">
            选一个下课时间点，或直接选剩余时长；到点后语音提醒。
          </p>
        </div>
      )}
    </SectionCard>
  );
}
