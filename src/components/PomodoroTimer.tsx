import { Play, Pause, RotateCcw, SkipForward, Coffee, Brain } from 'lucide-react';
import { usePomodoro, PomodoroMode } from '../hooks/usePomodoro';

interface PomodoroTimerProps {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  nickname: string;
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

export function PomodoroTimer({ soundEnabled, notificationsEnabled, nickname }: PomodoroTimerProps) {
  const { 
    mode, 
    formattedTime, 
    isRunning, 
    completedSessions, 
    progress,
    quote,
    start, 
    pause, 
    reset, 
    skip 
  } = usePomodoro({
    soundEnabled,
    notificationsEnabled,
    nickname,
  });

  const config = modeConfig[mode];
  const quoteText = mode === 'break'
    ? '休息几分钟，下一轮继续稳稳推进。'
    : quote;

  return (
    <div className="glass-panel p-4">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">今日已完成</span>
          <span className="text-sm font-bold text-slate-300">{completedSessions}</span>
          <span className="text-xs text-slate-500">个番茄</span>
        </div>
      </div>

      {/* 时间显示 */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-4xl font-bold tracking-tight ${config.color}`}>
          {formattedTime}
        </span>
        <div className="flex items-center gap-1">
          {isRunning && (
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.bgColor}`}></span>
            </span>
          )}
        </div>
      </div>

      {/* 方形进度条 */}
      <div className="relative mb-4">
        {/* 背景条 */}
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          {/* 进度条 */}
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-1000 ease-linear`}
            style={{ width: `${progress}%` }}
          >
            {/* 进度条上的光效 */}
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

      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Focus Quote</div>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          {quoteText}
        </p>
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
