interface PomodoroQuoteCardProps {
  quoteText: string;
}

export function PomodoroQuoteCard({ quoteText }: PomodoroQuoteCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Focus Quote</div>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        {quoteText}
      </p>
    </div>
  );
}
