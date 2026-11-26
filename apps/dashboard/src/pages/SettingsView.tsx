import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, UploadCloud } from 'lucide-react';
import { apiClient } from '../api/client';

export function SettingsView() {
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: apiClient.getPricing,
  });

  const refreshMutation = useMutation({
    mutationFn: apiClient.refreshPricing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
      void queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });

  const syncBufferMutation = useMutation({
    mutationFn: apiClient.syncBuffer,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Ajustes, Tarifas y Diagnóstico Local
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Catálogo en caché SQLite (OpenRouter + LiteLLM +{' '}
              <code className="text-slate-300">pricing-overrides.json</code>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={syncBufferMutation.isPending}
              onClick={() => syncBufferMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 disabled:opacity-50"
            >
              <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
              {syncBufferMutation.isPending ? 'Sincronizando...' : 'Importar buffer .jsonl'}
            </button>

            <button
              type="button"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/25 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
              />
              {refreshMutation.isPending ? 'Actualizando...' : 'Refrescar tarifas'}
            </button>
          </div>
        </div>

        {refreshMutation.data && (
          <p className="mt-3 text-xs text-emerald-400">
            Catálogo actualizado ({refreshMutation.data.count} modelos desde{' '}
            {refreshMutation.data.source}).
          </p>
        )}

        {syncBufferMutation.data && (
          <p className="mt-3 text-xs text-cyan-300">
            Buffer procesado: {syncBufferMutation.data.processed} leídos,{' '}
            {syncBufferMutation.data.inserted} nuevos insertados en SQLite.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            Tarifas cacheadas (USD por 1M tokens)
          </h3>
          <span className="font-mono text-xs text-slate-400">
            {pricing?.models.length ?? 0} registros en SQLite
          </span>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-500">Cargando tarifas...</p>
        ) : !pricing || pricing.models.length === 0 ? (
          <p className="text-xs text-slate-500">
            No hay tarifas en SQLite todavía. Pulsa «Refrescar tarifas» para descargar el catálogo.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#111827]">
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-medium">Modelo</th>
                  <th className="px-3 py-2 text-right font-medium">Entrada / 1M</th>
                  <th className="px-3 py-2 text-right font-medium">Caché Lectura</th>
                  <th className="px-3 py-2 text-right font-medium">Caché Escritura</th>
                  <th className="px-3 py-2 text-right font-medium">Salida / 1M</th>
                  <th className="py-2 pl-3 text-right font-medium">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {pricing.models.slice(0, 100).map((m) => (
                  <tr key={m.model_key} className="hover:bg-slate-800/30">
                    <td className="py-2 pr-3 text-slate-200">{m.model_key}</td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      ${m.input_per_1m.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-300">
                      ${m.cache_read_per_1m.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-300">
                      ${m.cache_write_per_1m.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-purple-300">
                      ${m.output_per_1m.toFixed(4)}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      {m.is_override ? (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300">
                          override
                        </span>
                      ) : (
                        <span className="text-slate-500">catálogo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
