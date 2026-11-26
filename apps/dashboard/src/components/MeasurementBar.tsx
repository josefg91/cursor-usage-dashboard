import { Play, RotateCcw, Square, Timer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDateTime } from '../utils/format';

export interface MeasurementState {
  startedAt: string;
  endedAt: string | null;
  label: string;
}

interface MeasurementBarProps {
  measurement: MeasurementState | null;
  draftLabel: string;
  onDraftLabelChange: (label: string) => void;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onRestart: () => void;
  onClear: () => void;
  onUpdateLabel: (label: string) => void;
}

function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function MeasurementBar({
  measurement,
  draftLabel,
  onDraftLabelChange,
  onStart,
  onStop,
  onResume,
  onRestart,
  onClear,
  onUpdateLabel,
}: MeasurementBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isRunning = Boolean(measurement && !measurement.endedAt);

  useEffect(() => {
    if (!isRunning) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  if (!measurement) {
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Timer className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Medición consciente</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Inicia una medición manual para contabilizar únicamente los prompts, tokens y coste
                generados a partir de este instante.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => onDraftLabelChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onStart();
              }}
              placeholder="Etiqueta opcional (ej. Refactor auth)..."
              aria-label="Etiqueta de medición"
              className="w-60 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Iniciar medición</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const startMs = Date.parse(measurement.startedAt);
  const endMs = measurement.endedAt ? Date.parse(measurement.endedAt) : nowMs;
  const elapsedMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;

  return (
    <section
      className={`rounded-xl border p-4 ${
        isRunning
          ? 'border-emerald-500/35 bg-emerald-500/5'
          : 'border-purple-500/35 bg-purple-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
              isRunning
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-purple-500/40 bg-purple-500/15 text-purple-200'
            }`}
          >
            {isRunning ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-purple-400" />
            )}
            <span>{isRunning ? 'Midiendo en vivo' : 'Medición detenida'}</span>
          </span>

          <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
            {formatElapsedClock(elapsedMs)}
          </span>

          <span className="font-mono text-[11px] text-slate-400">
            Inicio: {formatDateTime(measurement.startedAt)}
            {measurement.endedAt ? ` → Fin: ${formatDateTime(measurement.endedAt)}` : ''}
          </span>

          <input
            type="text"
            value={measurement.label}
            onChange={(e) => onUpdateLabel(e.target.value)}
            placeholder="Añadir etiqueta..."
            aria-label="Nombre de la medición"
            className="w-48 rounded-md border border-slate-800 bg-[#0B0F19]/80 px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-slate-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Detener</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Reanudar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isRunning ? 'Reiniciar' : 'Nueva medición'}</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            title="Descartar medición"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F19] px-2 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Descartar</span>
          </button>
        </div>
      </div>
    </section>
  );
}
