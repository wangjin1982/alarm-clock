import { useState } from 'react';
import { BellRing, Clock3, Plus, Trash2 } from 'lucide-react';
import { useWeather } from '../hooks/useWeather';

interface AlarmWidgetProps {
  nickname: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export function AlarmWidget({
  nickname,
  notificationsEnabled,
  soundEnabled,
}: AlarmWidgetProps) {
  const {
    alarms,
    addAlarm,
    removeAlarm,
    toggleAlarm,
  } = useWeather({
    nickname,
    notificationsEnabled,
    soundEnabled,
  });

  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [newHour, setNewHour] = useState(8);
  const [newMinute, setNewMinute] = useState(0);

  const handleAddAlarm = () => {
    addAlarm(newHour, newMinute);
    setShowAddAlarm(false);
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-sky-light" />
          <span className="font-medium text-sm">闹钟</span>
        </div>
        <button
          onClick={() => setShowAddAlarm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-xs text-sky-300 transition-colors hover:bg-sky-500/30"
        >
          <Plus size={14} />
          <span>添加闹钟</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock3 size={12} />
            闹钟列表
          </span>
          <span className="text-[11px] text-slate-500">
            {alarms.filter(alarm => alarm.enabled).length} 个已开启
          </span>
        </div>

        {alarms.map(alarm => (
          <div
            key={alarm.id}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all ${
              alarm.enabled
                ? 'border-sky-500/20 bg-sky-500/10'
                : 'border-transparent bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`rounded-lg px-3 py-2 font-mono text-lg tracking-tight ${
                alarm.enabled ? 'bg-sky-500/15 text-sky-300' : 'bg-white/5 text-slate-500'
              }`}>
                {alarm.hour.toString().padStart(2, '0')}:{alarm.minute.toString().padStart(2, '0')}
              </div>
              <div>
                <div className="text-sm text-slate-200">
                  {alarm.enabled ? '闹钟已开启' : '闹钟已暂停'}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  到点后自动提醒
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => toggleAlarm(alarm.id)}
                className={`relative h-5 w-10 rounded-full transition-colors ${
                  alarm.enabled ? 'bg-sky-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    alarm.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <button
                onClick={() => removeAlarm(alarm.id)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="删除闹钟"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-72 rounded-2xl border border-white/10 bg-slate-800 p-6">
            <h3 className="font-medium mb-4">添加闹钟</h3>
            <div className="mb-4 flex items-center justify-center gap-2">
              <select
                value={newHour}
                onChange={(event) => setNewHour(Number(event.target.value))}
                className="rounded-lg bg-white/10 px-3 py-2 text-center"
              >
                {Array.from({ length: 24 }, (_, index) => (
                  <option key={index} value={index}>
                    {index.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-xl">:</span>
              <select
                value={newMinute}
                onChange={(event) => setNewMinute(Number(event.target.value))}
                className="rounded-lg bg-white/10 px-3 py-2 text-center"
              >
                {[0, 15, 30, 45].map(minute => (
                  <option key={minute} value={minute}>
                    {minute.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddAlarm(false)}
                className="flex-1 rounded-lg bg-white/10 py-2 transition-colors hover:bg-white/20"
              >
                取消
              </button>
              <button
                onClick={handleAddAlarm}
                className="flex-1 rounded-lg bg-sky-500 py-2 transition-colors hover:bg-sky-600"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
