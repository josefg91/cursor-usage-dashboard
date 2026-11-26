const PLACEHOLDER_KPIS = [
  { label: 'Gasto Total (USD)', value: '$0.0000' },
  { label: 'Coste Medio / Prompt', value: '$0.0000' },
  { label: 'Ratio Entrada / Salida', value: '0:1' },
  { label: 'Eficiencia de Caché', value: '0%' },
];

export function KpiCards() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLACEHOLDER_KPIS.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-slate-800 bg-[#111827] p-4"
        >
          <p className="text-xs font-medium text-slate-400">{kpi.label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">{kpi.value}</p>
        </div>
      ))}
    </section>
  );
}
