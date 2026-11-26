import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PromptEvent, PromptsViewMode, TimeRange } from '@cursor-dashboard/shared';
import { apiClient } from './api/client';
import { ContextVsCostScatter } from './components/ContextVsCostScatter';
import { CostByModelChart } from './components/CostByModelChart';
import { FilterBar } from './components/FilterBar';
import { KpiCards } from './components/KpiCards';
import { PromptInspectorDrawer } from './components/PromptInspectorDrawer';
import { PromptsTable } from './components/PromptsTable';
import { SettingsView } from './pages/SettingsView';

const PAGE_SIZE = 25;

export function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [range, setRange] = useState<TimeRange>('today');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [view, setView] = useState<PromptsViewMode>('turns');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const refetchInterval = autoRefresh ? 5000 : false;

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: apiClient.getHealth,
    refetchInterval,
  });

  const summaryQuery = useQuery({
    queryKey: ['stats-summary', range, selectedModel],
    queryFn: () => apiClient.getSummary(range, selectedModel),
    refetchInterval,
    enabled: activeTab === 'dashboard',
  });

  const timeseriesQuery = useQuery({
    queryKey: ['stats-timeseries', range, selectedModel],
    queryFn: () => apiClient.getTimeseries(range, selectedModel),
    refetchInterval,
    enabled: activeTab === 'dashboard',
  });

  const promptsQuery = useQuery({
    queryKey: ['prompts', range, selectedModel, view, search, page],
    queryFn: () =>
      apiClient.getPrompts(range, {
        view,
        model: selectedModel,
        search,
        page,
        limit: PAGE_SIZE,
      }),
    refetchInterval,
    enabled: activeTab === 'dashboard',
  });

  // Muestra hasta 150 turnos recientes para el gráfico de dispersión (independiente de la paginación o vista sesiones)
  const scatterQuery = useQuery({
    queryKey: ['prompts-scatter', range, selectedModel],
    queryFn: () =>
      apiClient.getPrompts(range, {
        view: 'turns',
        model: selectedModel,
        page: 1,
        limit: 150,
      }),
    refetchInterval,
    enabled: activeTab === 'dashboard',
  });

  const handleRangeChange = (next: TimeRange) => {
    setRange(next);
    setPage(1);
  };

  const handleModelChange = (next: string) => {
    setSelectedModel(next);
    setPage(1);
  };

  const handleViewChange = (next: PromptsViewMode) => {
    setView(next);
    setPage(1);
  };

  const handleSearchChange = (next: string) => {
    setSearch(next);
    setPage(1);
  };

  const handleManualRefresh = () => {
    void queryClient.invalidateQueries();
  };

  const scatterEvents = (scatterQuery.data?.items ?? []).filter(
    (item): item is PromptEvent => 'id' in item,
  );

  const isRefreshing =
    summaryQuery.isFetching || timeseriesQuery.isFetching || promptsQuery.isFetching;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100">
      <FilterBar
        range={range}
        onRangeChange={handleRangeChange}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        availableModels={promptsQuery.data?.available_models ?? []}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        health={healthQuery.data}
        isHealthError={healthQuery.isError}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        {activeTab === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            <KpiCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CostByModelChart
                data={timeseriesQuery.data ?? []}
                isLoading={timeseriesQuery.isLoading}
              />
              <ContextVsCostScatter
                events={scatterEvents}
                isLoading={scatterQuery.isLoading}
                onSelectEvent={setSelectedEventId}
              />
            </section>

            <PromptsTable
              range={range}
              selectedModel={selectedModel}
              view={view}
              onViewChange={handleViewChange}
              search={search}
              onSearchChange={handleSearchChange}
              items={promptsQuery.data?.items ?? []}
              total={promptsQuery.data?.total ?? 0}
              page={page}
              limit={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={promptsQuery.isLoading}
              onSelectEvent={setSelectedEventId}
            />
          </>
        )}
      </main>

      <PromptInspectorDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
}
