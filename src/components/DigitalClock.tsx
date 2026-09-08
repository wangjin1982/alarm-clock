import { useEffect, useState } from 'react';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function formatClock(date: Date) {
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');
  return { hour, minute, second };
}

function formatDate(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${month}月${day}日 星期${weekday}`;
}

export function DigitalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { hour, minute, second } = formatClock(now);

  return (
    <div className="glass-panel px-4 py-3.5">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1 tabular-nums tracking-[-0.04em]">
          <span className="text-[2.6rem] font-bold leading-none text-slate-100">{hour}</span>
          <span className="text-[2.6rem] font-bold leading-none text-slate-500">:</span>
          <span className="text-[2.6rem] font-bold leading-none text-slate-100">{minute}</span>
          <span className="ml-1 text-lg font-medium leading-none text-slate-500">{second}</span>
        </div>
        <div className="pb-0.5 text-right">
          <div className="text-xs text-slate-400">{formatDate(now)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-600">Local Time</div>
        </div>
      </div>
    </div>
  );
}
