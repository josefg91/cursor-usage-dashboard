import type { TimeseriesBucket } from '@cursor-dashboard/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatUsd, getModelColor } from '../utils/format';

interface CostByModelChartProps {
  data: TimeseriesBucket[];
  isLoading: boolean;
}

export function CostByModelChart({ data, isLoading }: CostByModelChartProps) {
  const models = Array.from(
    new Set(data.flatMap((bucket) => Object.keys(bucket.by_model))),
  );

  const chartData = data.map((bucket) => ({
    bucket: bucket.bucket.length > 10 ? bucket.bucket.slice(11) : bucket.bucket.slice(5),
    fullBucket: bucket.bucket,
    ...bucket.by_model,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Evolución del gasto por modelo</h2>
          <p className="text-xs text-slate-400">Barras apiladas en USD por intervalo</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-500">
          Cargando gráfica...
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
          Sin datos en este rango temporal
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                contentStyle={{
                  backgroundColor: '#0B0F19',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: unknown, name: string) => [formatUsd(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {models.map((model) => (
                <Bar
                  key={model}
                  dataKey={model}
                  stackId="cost"
                  fill={getModelColor(model)}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
