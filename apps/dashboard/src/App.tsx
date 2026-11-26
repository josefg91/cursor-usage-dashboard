import { useState } from 'react';
import type { TimeRange } from '@cursor-dashboard/shared';
import { FilterBar } from './components/FilterBar';
import { KpiCards } from './components/KpiCards';
import { CostByModelChart } from './components/CostByModelChart';
import { ContextVsCostScatter } from './components/ContextVsCostScatter';
import { PromptsTable } from './components/PromptsTable';
import { PromptInspectorDrawer } from './components/PromptInspectorDrawer';

export function App() {
  const [range, setRange] = useState<TimeRange>('today');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100">
      <FilterBar
        range={range}
        onRangeChange={setRange}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <KpiCards />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CostByModelChart />
          <ContextVsCostScatter />
        </section>

        <PromptsTable />
      </main>

      <PromptInspectorDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}
