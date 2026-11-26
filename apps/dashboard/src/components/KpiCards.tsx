import type { SummaryStats } from '@cursor-dashboard/shared';
import { AlertTriangle, Coins, Cpu, Database, Gauge } from 'lucide-react';
import { formatCompactTokens, formatUsd } from '../utils/format';

interface KpiCardsProps {
  summary?: SummaryStats;
  isLoading: boolean;
}

export function KpiCards({ summary, isLoading }: KpiCardsProps) {
  const ratio = summary?.input_output_ratio ?? 0;
  const isHighRatio = ratio > 20;
  const cacheHit = summary?.cache_hit_rate_pct ?? 0;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Gasto Total (USD)</span>
          <Coins className="h-4 w-4 text-emerald-400" />
        </div>
        <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">
          {isLoading ? '—' : formatUsd(summary?.total_cost_usd ?? 0)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {summary
            ? `${summary.prompt_count} turnos · ${summary.session_count} sesiones`
            : 'Sin datos'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Coste Medio / Prompt</span>
          <Cpu className="h-4 w-4 text-purple-400" />
        </div>
        <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">
          {isLoading ? '—' : formatUsd(summary?.avg_cost_per_prompt ?? 0)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {summary
            ? `Media / sesión: ${formatUsd(summary.avg_cost_per_session)}`
            : 'Sin datos'}
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          isHighRatio
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-slate-800 bg-[#111827]'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Ratio Entrada / Salida</span>
          {isHighRatio ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <Gauge className="h-4 w-4 text-blue-400" />
          )}
        </div>
        <p
          className={`mt-2 font-mono text-2xl font-semibold ${
            isHighRatio ? 'text-amber-300' : 'text-slate-100'
          }`}
        >
          {isLoading ? '—' : `${ratio.toFixed(1)}:1`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {isHighRatio
            ? 'Alerta (> 20:1): contexto acumulado alto'
            : summary
              ? `${formatCompactTokens(summary.total_input_tokens)} in / ${formatCompactTokens(summary.total_output_tokens)} out`
              : 'Sin datos'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Eficiencia de Caché</span>
          <Database className="h-4 w-4 text-cyan-400" />
        </div>
        <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">
          {isLoading ? '—' : `${cacheHit.toFixed(1)}%`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {summary
            ? `Lectura: ${formatCompactTokens(summary.total_cache_read_tokens)} · Nuevos: ${formatCompactTokens(summary.total_uncached_input_tokens)}`
            : 'Sin datos'}
        </p>
      </div>
    </section>
  );
}
