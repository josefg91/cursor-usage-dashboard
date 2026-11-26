import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, HardDrive, Lock, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { apiClient } from '../api/client';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsView() {
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: apiClient.getPricing,
  });

  const { data: storage } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: apiClient.getStorageStats,
  });

  const refreshMutation = useMutation({
    mutationFn: apiClient.refreshPricing,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  const syncBufferMutation = useMutation({
    mutationFn: apiClient.syncBuffer,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: apiClient.importCsv,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => apiClient.purgePayloads(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });

  const handleCsvFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importCsvMutation.mutate(text);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Ajustes, Tarifas y Diagnóstico Local
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Catálogo en caché SQLite (<code className="text-slate-300">models.dev</code> +{' '}
              <code className="text-slate-300">pricing-overrides.json</code>).
              {pricing?.cursor_token_fee_per_1m ? (
                <span className="ml-2 inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                  + ${pricing.cursor_token_fee_per_1m.toFixed(2)}/1M Cursor Token Rate
                </span>
              ) : null}
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
            {refreshMutation.data.source}
            {typeof refreshMutation.data.recalculated_events === 'number' &&
            refreshMutation.data.recalculated_events > 0
              ? ` · ${refreshMutation.data.recalculated_events} eventos recalculados`
              : ''}
            ).
          </p>
        )}

        {syncBufferMutation.data && (
          <p className="mt-3 text-xs text-cyan-300">
            Buffer procesado: {syncBufferMutation.data.processed} leídos,{' '}
            {syncBufferMutation.data.inserted} nuevos insertados en SQLite.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Importar CSV de Cursor Usage (Conciliación)
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Sube el CSV descargado de <code className="text-slate-300">cursor.com/dashboard</code>{' '}
                &gt; Usage para conciliar costes reales y añadir subagentes.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>
                {importCsvMutation.isPending ? 'Importando CSV...' : 'Seleccionar archivo .csv'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleCsvFileChange(e)}
                disabled={importCsvMutation.isPending}
                className="hidden"
              />
            </label>
          </div>

          {importCsvMutation.data && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-200">
              Filas: {importCsvMutation.data.total_rows} · Conciliados:{' '}
              {importCsvMutation.data.reconciled} · Insertados: {importCsvMutation.data.inserted} ·
              Omitidos: {importCsvMutation.data.skipped}
            </div>
          )}
          {importCsvMutation.isError && (
            <p className="mt-3 text-xs text-rose-400">
              Error al importar el CSV. Comprueba que el formato sea válido.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <HardDrive className="h-4 w-4 text-blue-400" />
                Retención de payloads y SQLite
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Purga textos comprimidos con más de {storage?.retention_days ?? 30} días manteniendo
                intactas las métricas de coste.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-xs text-slate-300">
              {storage
                ? `${storage.events_count} eventos · ${storage.payloads_count} payloads · ${formatBytes(storage.db_size_bytes)}`
                : 'Cargando estadísticas...'}
            </div>
            <button
              type="button"
              disabled={purgeMutation.isPending}
              onClick={() => purgeMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {purgeMutation.isPending
                ? 'Purgando...'
                : `Purgar > ${storage?.retention_days ?? 30}d`}
            </button>
          </div>

          {purgeMutation.data && (
            <p className="mt-3 text-xs text-slate-300">
              Purgados {purgeMutation.data.purged_count} payloads anteriores a{' '}
              {purgeMutation.data.cutoff_iso.slice(0, 10)}.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-dashed border-slate-800 bg-[#0B0F19] p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5 text-slate-500" />
          <span>
            <strong className="text-slate-300">Cursor Enterprise Admin API (RF-11):</strong>{' '}
            pendiente / desactivada por defecto (requiere <code>CURSOR_ADMIN_KEY</code> corporativa
            de IT).
          </span>
        </div>
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
