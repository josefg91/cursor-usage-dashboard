import { analyzeTurnEfficiency } from '@cursor-dashboard/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle2, Copy, X } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../api/client';
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatUsd,
  getCostSeverity,
} from '../utils/format';

interface PromptInspectorDrawerProps {
  eventId: string | null;
  onClose: () => void;
}

export function PromptInspectorDrawer({ eventId, onClose }: PromptInspectorDrawerProps) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['prompt-detail', eventId],
    queryFn: () => apiClient.getPromptDetail(eventId!),
    enabled: Boolean(eventId),
  });

  if (!eventId) return null;

  const totalTokens = data
    ? data.uncached_input_tokens +
      data.cache_read_tokens +
      data.cache_write_tokens +
      data.output_tokens +
      data.reasoning_tokens
    : 0;

  const pct = (n: number) => (totalTokens > 0 ? Math.max(2, (n / totalTokens) * 100) : 0);
  const severity = data ? getCostSeverity(data.cost_usd) : null;
  const efficiencyAlerts = data ? analyzeTurnEfficiency(data) : [];

  const handleCopyPrompt = async () => {
    if (!data?.prompt_text) return;
    await navigator.clipboard.writeText(data.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  let prettyRawJson: string | null = null;
  if (data?.raw_hook_json) {
    try {
      prettyRawJson = JSON.stringify(JSON.parse(data.raw_hook_json), null, 2);
    } catch {
      prettyRawJson = data.raw_hook_json;
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-[#0B0F19] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Inspector de Prompt</h3>
            <p className="font-mono text-[11px] text-slate-400">{eventId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {isLoading && <p className="text-xs text-slate-400">Cargando detalle comprimido...</p>}
          {isError && (
            <p className="text-xs text-rose-400">No se pudo cargar el detalle de este evento.</p>
          )}

          {data && (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-[#111827] p-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-400">Modelo</span>
                  <p className="mt-1 truncate font-mono text-slate-100">{data.model}</p>
                </div>
                <div>
                  <span className="text-slate-400">Coste USD</span>
                  <p className={`mt-1 font-mono font-semibold ${severity?.textClass ?? ''}`}>
                    {formatUsd(data.cost_usd)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Duración</span>
                  <p className="mt-1 font-mono text-slate-100">{formatDuration(data.duration_ms)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Fecha</span>
                  <p className="mt-1 font-mono text-slate-100">{formatDateTime(data.timestamp)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Desglose de tokens</span>
                  <span className="font-mono text-slate-400">
                    Total entrada: {formatNumber(data.input_tokens)} · Salida:{' '}
                    {formatNumber(data.output_tokens)}
                  </span>
                </div>

                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  {data.uncached_input_tokens > 0 && (
                    <div
                      style={{ width: `${pct(data.uncached_input_tokens)}%` }}
                      className="bg-blue-500"
                      title={`Entrada sin caché: ${formatNumber(data.uncached_input_tokens)}`}
                    />
                  )}
                  {data.cache_read_tokens > 0 && (
                    <div
                      style={{ width: `${pct(data.cache_read_tokens)}%` }}
                      className="bg-emerald-500"
                      title={`Caché lectura: ${formatNumber(data.cache_read_tokens)}`}
                    />
                  )}
                  {data.cache_write_tokens > 0 && (
                    <div
                      style={{ width: `${pct(data.cache_write_tokens)}%` }}
                      className="bg-amber-500"
                      title={`Caché escritura: ${formatNumber(data.cache_write_tokens)}`}
                    />
                  )}
                  {data.output_tokens > 0 && (
                    <div
                      style={{ width: `${pct(data.output_tokens)}%` }}
                      className="bg-purple-500"
                      title={`Salida: ${formatNumber(data.output_tokens)}`}
                    />
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Nuevos: {formatNumber(data.uncached_input_tokens)}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Caché L: {formatNumber(data.cache_read_tokens)}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Caché E: {formatNumber(data.cache_write_tokens)}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    Salida: {formatNumber(data.output_tokens)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Diagnóstico de eficiencia</span>
                  {efficiencyAlerts.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Eficiente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {efficiencyAlerts.length} sugerencia{efficiencyAlerts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {efficiencyAlerts.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {efficiencyAlerts.map((alert) => (
                      <li
                        key={alert.code}
                        className={`rounded-lg border p-2.5 text-xs ${
                          alert.severity === 'danger'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        }`}
                      >
                        <p className="font-semibold">{alert.label}</p>
                        <p className="mt-0.5 text-[11px] opacity-90">{alert.suggestion}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Prompt enviado
                  </h4>
                  {data.prompt_text && (
                    <button
                      type="button"
                      onClick={() => void handleCopyPrompt()}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                </div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#111827] p-4 font-mono text-xs text-slate-200">
                  {data.prompt_text || data.prompt_preview || '(sin texto registrado)'}
                </pre>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Respuesta del agente
                </h4>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#111827] p-4 font-mono text-xs text-slate-300">
                  {data.response_text || '(sin respuesta registrada)'}
                </pre>
              </div>

              {prettyRawJson && (
                <details className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                  <summary className="cursor-pointer text-xs font-medium text-slate-300">
                    Payload crudo del hook (JSON)
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-auto font-mono text-[11px] text-slate-400">
                    {prettyRawJson}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
