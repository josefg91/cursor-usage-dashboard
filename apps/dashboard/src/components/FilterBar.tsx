import type { TimeRange } from '@cursor-dashboard/shared';

interface FilterBarProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

const RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'Todo' },
];

export function FilterBar({
  range,
  onRangeChange,
  autoRefresh,
  onToggleAutoRefresh,
}: FilterBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-[#0B0F19]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <h1 className="text-base font-semibold tracking-tight text-slate-100">
            Cursor Prompt Cost Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-800 bg-[#111827] p-0.5">
            {RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onRangeChange(item.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  range === item.value
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              autoRefresh
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-[#111827] text-slate-400'
            }`}
          >
            Auto-refresh 5s: {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </header>
  );
}
