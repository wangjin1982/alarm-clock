import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SectionCardProps {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  /** 收起时在标题栏右侧显示的摘要内容 */
  summary?: ReactNode;
  /** 标题栏右侧的操作按钮（如刷新天气、添加闹钟），不会触发展开/收起 */
  actions?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function SectionCard({
  icon,
  iconColor = 'text-slate-300',
  title,
  summary,
  actions,
  expanded,
  onToggle,
  children,
}: SectionCardProps) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-white/5">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className={iconColor}>{icon}</span>
          <span className="shrink-0 font-medium text-sm">{title}</span>
          {summary != null && (
            <span className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
              {summary}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-500 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        {actions != null && (
          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
