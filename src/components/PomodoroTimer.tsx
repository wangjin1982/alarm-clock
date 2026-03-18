import { Play, Pause, RotateCcw, SkipForward, Coffee, Brain } from 'lucide-react';
import { PomodoroMode } from '../hooks/usePomodoro';

interface PomodoroTimerProps {
  mode: PomodoroMode;
  formattedTime: string;
  isRunning: boolean;
  progress: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
}

const modeConfig: Record<PomodoroMode, { icon: React.ReactNode; label: string; color: string; bgColor: string; gradient: string }> = {
  work: { 
    icon: <Brain size={16} />, 
    label: '专注中', 
    color: 'text-tomato',
    bgColor: 'bg-tomato',
    gradient: 'from-rose-400 via-tomato to-orange-500',
  },
  break: { 
    icon: <Coffee size={16} />, 
    label: '休息中', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400',
    gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
  },
  idle: { 
    icon: <Brain size={16} />, 
    label: '准备专注', 
    color: 'text-slate-400',
    bgColor: 'bg-slate-400',
    gradient: 'from-slate-400 via-slate-500 to-slate-400',
  },
};

export function PomodoroTimer({
  mode,
  formattedTime,
  isRunning,
  progress,
  start,
  pause,
  reset,
  skip,
}: PomodoroTimerProps) {
  const config = modeConfig[mode];

  return (
    <div className="glass-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={config.color}>{config.icon}</span>
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          </div>
        </div>

        <div className="min-w-[8.25rem] pt-1 text-right">
          <div className="flex min-h-2 items-center justify-end">
            {isRunning && (
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.bgColor} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.bgColor}`}></span>
              </span>
            )}
          </div>
          <div className={`mt-2 text-[2.85rem] font-bold leading-none tracking-[-0.08em] tabular-nums ${config.color}`}>
            {formattedTime}
          </div>
        </div>
      </div>

      {/* 方形进度条 */}
      <div className="relative mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Progress</span>
          {isRunning && (
            <span className={`text-xs ${config.color}`}>运行中</span>
          )}
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-1000 ease-linear`}
            style={{ width: `${progress}%` }}
          >
            <div className="h-full w-full relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" 
                style={{ 
                  animation: isRunning ? 'shimmer 2s infinite' : 'none'
                }}
              />
            </div>
          </div>
        </div>
        
        {/* 刻度标记 */}
        <div className="flex justify-between mt-1">
          {[0, 25, 50, 75, 100].map((mark) => (
            <div key={mark} className="flex flex-col items-center">
              <div className={`w-0.5 h-1 ${progress >= mark ? config.bgColor : 'bg-white/20'}`} />
              <span className="text-[8px] text-slate-500 mt-0.5">{mark}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={reset}
          className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-slate-300 text-sm font-medium active:scale-95"
          title="重置"
        >
          <RotateCcw size={16} className="mx-auto" />
        </button>
        
        {isRunning ? (
          <button
            onClick={pause}
            className={`flex-[2] py-2 rounded-lg bg-gradient-to-r ${config.gradient} text-white shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm font-medium flex items-center justify-center gap-2`}
          >
            <Pause size={18} fill="currentColor" />
            <span>暂停</span>
          </button>
        ) : (
          <button
            onClick={start}
            className={`flex-[2] py-2 rounded-lg bg-gradient-to-r ${config.gradient} text-white shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm font-medium flex items-center justify-center gap-2`}
          >
            <Play size={18} fill="currentColor" />
            <span>{mode === 'idle' ? '开始专注' : '继续'}</span>
          </button>
        )}
        
        <button
          onClick={skip}
          className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-slate-300 text-sm font-medium active:scale-95"
          title="跳过"
        >
          <SkipForward size={16} className="mx-auto" />
        </button>
      </div>

      {/* 模式提示 */}
      <div className="mt-3 text-xs text-slate-500 text-center">
        {mode === 'work' ? '25分钟专注工作，保持高效' : mode === 'break' ? '5分钟休息，放松身心' : '点击下方按钮开始专注'}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
