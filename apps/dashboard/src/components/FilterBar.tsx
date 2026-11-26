import type { HealthResponse, TimeRange } from '@cursor-dashboard/shared';
import { Activity, Pause, Play, RefreshCw, Settings, Terminal } from 'lucide-react';

interface FilterBarProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  health?: HealthResponse;
  isHealthError: boolean;
  activeTab: 'dashboard' | 'settings';
  onTabChange: (tab: 'dashboard' | 'settings') => void;
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
  selectedModel,
  onModelChange,
  availableModels,
  autoRefresh,
  onToggleAutoRefresh,
  onManualRefresh,
  isRefreshing,
  health,
  isHealthError,
  activeTab,
  onTabChange,
}: FilterBarProps) {
  const isOnline = !isHealthError && health?.status === 'ok';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/90 bg-[#0B0F19]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-100">
                Cursor Prompt Cost Dashboard
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span>
                  {isOnline
                    ? `API local activa · ${health.db_events_count} eventos`
                    : 'Backend desconectado (127.0.0.1:3001)'}
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'dashboard' && (
            <>
              <div className="flex rounded-lg border border-slate-800 bg-[#111827] p-0.5">
                {RANGES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onRangeChange(item.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      range === item.value
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filtrar por modelo"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="rounded-lg border border-slate-800 bg-[#111827] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
              >
                <option value="all">Todos los modelos</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onToggleAutoRefresh}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  autoRefresh
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-[#111827] text-slate-400 hover:text-slate-200'
                }`}
              >
                {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>5s: {autoRefresh ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={onManualRefresh}
                title="Refrescar ahora"
                className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-[#111827] p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onTabChange(activeTab === 'dashboard' ? 'settings' : 'dashboard')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              activeTab === 'settings'
                ? 'border-purple-500/40 bg-purple-500/15 text-purple-200'
                : 'border-slate-800 bg-[#111827] text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            {activeTab === 'settings' ? (
              <>
                <Activity className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </>
            ) : (
              <>
                <Settings className="h-3.5 w-3.5" />
                <span>Ajustes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
