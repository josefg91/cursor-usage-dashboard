import {
  analyzeSessionEfficiency,
  analyzeTurnEfficiency,
  type PromptEvent,
  type PromptsViewMode,
  type SessionSummary,
  type TimeRange,
} from '@cursor-dashboard/shared';
import { ChevronLeft, ChevronRight, Download, Layers, List, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import {
  formatCompactTokens,
  formatDateTime,
  formatDuration,
  formatUsd,
  getCostSeverity,
  getModelColor,
} from '../utils/format';

interface PromptsTableProps {
  range: TimeRange;
  selectedModel: string;
  view: PromptsViewMode;
  onViewChange: (view: PromptsViewMode) => void;
  search: string;
  onSearchChange: (search: string) => void;
  items: Array<PromptEvent | SessionSummary>;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
}

function isTurn(item: PromptEvent | SessionSummary): item is PromptEvent {
  return 'id' in item;
}

export function PromptsTable({
  range,
  selectedModel,
  view,
  onViewChange,
  search,
  onSearchChange,
  items,
  total,
  page,
  limit,
  onPageChange,
  isLoading,
  onSelectEvent,
}: PromptsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const exportCsvUrl = apiClient.getExportUrl('csv', { range, model: selectedModel, search });
  const exportJsonUrl = apiClient.getExportUrl('json', { range, model: selectedModel, search });

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-slate-200">Historial en vivo</h2>
          <div className="flex rounded-lg border border-slate-800 bg-[#0B0F19] p-0.5">
            <button
              type="button"
              onClick={() => onViewChange('turns')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                view === 'turns'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Turnos</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('sessions')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                view === 'sessions'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Sesiones</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar prompt, modelo o sesión..."
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F19] py-1.5 pr-3 pl-8 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
          </div>
          <a
            href={exportCsvUrl}
            download
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            CSV
          </a>
          <a
            href={exportJsonUrl}
            download
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 text-blue-400" />
            JSON
          </a>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-36 items-center justify-center text-xs text-slate-500">
            Cargando historial...
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
            No se encontraron registros con los filtros actuales.
          </div>
        ) : view === 'turns' ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Modelo</th>
                <th className="px-3 py-2.5 font-medium">Prompt</th>
                <th className="px-3 py-2.5 text-right font-medium">Entrada / Caché</th>
                <th className="px-3 py-2.5 text-right font-medium">Salida</th>
                <th className="px-3 py-2.5 text-right font-medium">Duración</th>
                <th className="py-2.5 pl-3 text-right font-medium">Coste USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {items.filter(isTurn).map((ev) => {
                const severity = getCostSeverity(ev.cost_usd);
                const alerts = analyzeTurnEfficiency(ev);
                const cachePct =
                  ev.input_tokens > 0
                    ? Math.round((ev.cache_read_tokens / ev.input_tokens) * 100)
                    : 0;
                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev.id)}
                    className="cursor-pointer transition hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[11px] text-slate-400">
                      {formatDateTime(ev.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-200">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getModelColor(ev.model) }}
                        />
                        {ev.model}
                      </span>
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-slate-200">
                      <div className="truncate">
                        {ev.prompt_preview || <span className="text-slate-500">(sin texto)</span>}
                      </div>
                      {alerts.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {alerts.slice(0, 2).map((alert) => (
                            <span
                              key={alert.code}
                              title={alert.suggestion}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                alert.severity === 'danger'
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {alert.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-300">
                      {formatCompactTokens(ev.input_tokens)}{' '}
                      <span className="text-slate-500">({cachePct}%)</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-300">
                      {formatCompactTokens(ev.output_tokens)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-400">
                      {formatDuration(ev.duration_ms)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right font-mono">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${severity.badgeClass}`}
                      >
                        {formatUsd(ev.cost_usd)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Última actividad</th>
                <th className="px-3 py-2.5 font-medium">Sesión</th>
                <th className="px-3 py-2.5 font-medium">Primer prompt</th>
                <th className="px-3 py-2.5 text-right font-medium">Turnos</th>
                <th className="px-3 py-2.5 font-medium">Modelos</th>
                <th className="px-3 py-2.5 text-right font-medium">Tokens (In/Out)</th>
                <th className="py-2.5 pl-3 text-right font-medium">Coste Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {items
                .filter((item): item is SessionSummary => !isTurn(item))
                .map((session) => {
                  const severity = getCostSeverity(session.total_cost_usd);
                  const sessionAlerts = analyzeSessionEfficiency(session);
                  return (
                    <tr key={session.conversation_id} className="hover:bg-slate-800/30">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[11px] text-slate-400">
                        {formatDateTime(session.last_activity_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {session.conversation_id.slice(0, 12)}…
                      </td>
                      <td className="max-w-md px-3 py-2.5 text-slate-200">
                        <div className="truncate">{session.first_prompt_preview || '(sin texto)'}</div>
                        {sessionAlerts.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {sessionAlerts.map((alert) => (
                              <span
                                key={alert.code}
                                title={alert.suggestion}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  alert.severity === 'danger'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {alert.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-200">
                        {session.turn_count}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {session.models.join(', ')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-slate-300">
                        {formatCompactTokens(session.total_input_tokens)} /{' '}
                        {formatCompactTokens(session.total_output_tokens)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-3 text-right font-mono">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${severity.badgeClass}`}
                        >
                          {formatUsd(session.total_cost_usd)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
        <span>
          Mostrando {items.length} de {total} {view === 'turns' ? 'turnos' : 'sesiones'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          <span className="font-mono text-[11px]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
