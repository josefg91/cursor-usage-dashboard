import type { PromptEvent } from '@cursor-dashboard/shared';
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactTokens, formatUsd, getModelColor } from '../utils/format';

interface ContextVsCostScatterProps {
  events: PromptEvent[];
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
}

interface ScatterPoint {
  id: string;
  model: string;
  input_tokens: number;
  cost_usd: number;
  prompt_preview: string;
  fill: string;
}

export function ContextVsCostScatter({
  events,
  isLoading,
  onSelectEvent,
}: ContextVsCostScatterProps) {
  const points: ScatterPoint[] = events.map((ev) => ({
    id: ev.id,
    model: ev.model,
    input_tokens: ev.input_tokens,
    cost_usd: ev.cost_usd,
    prompt_preview: ev.prompt_preview || '(sin texto)',
    fill: getModelColor(ev.model),
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Tokens de entrada vs. Coste (USD)
          </h2>
          <p className="text-xs text-slate-400">
            Detecta outliers de contexto · Haz clic en un punto para inspeccionar
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-500">
          Cargando dispersión...
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
          Sin turnos para graficar
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                type="number"
                dataKey="input_tokens"
                name="Entrada"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v: number) => formatCompactTokens(v)}
              />
              <YAxis
                type="number"
                dataKey="cost_usd"
                name="Coste"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <ReferenceLine y={0.15} stroke="#f43f5e" strokeDasharray="4 4" strokeOpacity={0.6} />
              <ReferenceLine y={0.05} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.45} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const point = payload[0]?.payload as ScatterPoint | undefined;
                  if (!point) return null;
                  return (
                    <div className="max-w-xs rounded-lg border border-slate-700 bg-[#0B0F19] p-2.5 text-xs shadow-xl">
                      <p className="font-mono font-medium text-slate-100">{point.model}</p>
                      <p className="mt-1 font-mono text-slate-300">
                        Entrada: {formatCompactTokens(point.input_tokens)} · Coste:{' '}
                        <span className="text-emerald-400">{formatUsd(point.cost_usd)}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-slate-400">{point.prompt_preview}</p>
                    </div>
                  );
                }}
              />
              <Scatter
                data={points}
                onClick={(entry: ScatterPoint) => {
                  if (entry?.id) onSelectEvent(entry.id);
                }}
                className="cursor-pointer"
              >
                {points.map((pt) => (
                  <Cell key={pt.id} fill={pt.fill} fillOpacity={0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
