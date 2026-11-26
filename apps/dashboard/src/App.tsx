import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  PromptEvent,
  PromptsViewMode,
  TimeRange,
  TimeWindow,
} from '@cursor-dashboard/shared';
import { apiClient } from './api/client';
import { ContextVsCostScatter } from './components/ContextVsCostScatter';
import { CostByModelChart } from './components/CostByModelChart';
import { FilterBar } from './components/FilterBar';
import { KpiCards } from './components/KpiCards';
import { MeasurementBar, type MeasurementState } from './components/MeasurementBar';
import { PromptInspectorDrawer } from './components/PromptInspectorDrawer';
import { PromptsTable } from './components/PromptsTable';
import { SettingsView } from './pages/SettingsView';

const PAGE_SIZE = 25;
const MEASUREMENT_STORAGE_KEY = 'cursor-dashboard:measurement-v1';

function loadSavedMeasurement(): MeasurementState | null {
  try {
    const raw = window.localStorage.getItem(MEASUREMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeasurementState>;
    if (typeof parsed.startedAt !== 'string' || !Number.isFinite(Date.parse(parsed.startedAt))) {
      return null;
    }
    const endedAt =
      typeof parsed.endedAt === 'string' && Number.isFinite(Date.parse(parsed.endedAt))
        ? parsed.endedAt
        : null;
    return {
      startedAt: parsed.startedAt,
      endedAt,
      label: typeof parsed.label === 'string' ? parsed.label : '',
    };
  } catch {
    return null;
  }
}

export function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [measurement, setMeasurement] = useState<MeasurementState | null>(loadSavedMeasurement);
  const [draftLabel, setDraftLabel] = useState('');
  const [range, setRange] = useState<TimeRange>(() =>
    loadSavedMeasurement() && !loadSavedMeasurement()?.endedAt ? 'measurement' : 'today',
  );
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [view, setView] = useState<PromptsViewMode>('turns');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (measurement) {
        window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify(measurement));
      } else {
        window.localStorage.removeItem(MEASUREMENT_STORAGE_KEY);
      }
    } catch {
      // Ignorar errores de almacenamiento privado
    }
  }, [measurement]);

  const measurementStatus: 'idle' | 'active' | 'stopped' = !measurement
    ? 'idle'
    : measurement.endedAt
      ? 'stopped'
      : 'active';

  const timeWindow: TimeWindow | undefined =
    range === 'measurement' && measurement
      ? { from: measurement.startedAt, to: measurement.endedAt ?? undefined }
      : undefined;

  const isDataEnabled = activeTab === 'dashboard' && (range !== 'measurement' || Boolean(measurement));
  const refetchInterval = autoRefresh ? 5000 : false;

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: apiClient.getHealth,
    refetchInterval,
  });

  const summaryQuery = useQuery({
    queryKey: ['stats-summary', range, timeWindow?.from, timeWindow?.to, selectedModel],
    queryFn: () => apiClient.getSummary(range, selectedModel, timeWindow),
    refetchInterval,
    enabled: isDataEnabled,
  });

  const timeseriesQuery = useQuery({
    queryKey: ['stats-timeseries', range, timeWindow?.from, timeWindow?.to, selectedModel],
    queryFn: () => apiClient.getTimeseries(range, selectedModel, timeWindow),
    refetchInterval,
    enabled: isDataEnabled,
  });

  const promptsQuery = useQuery({
    queryKey: ['prompts', range, timeWindow?.from, timeWindow?.to, selectedModel, view, search, page],
    queryFn: () =>
      apiClient.getPrompts(range, {
        view,
        model: selectedModel,
        search,
        page,
        limit: PAGE_SIZE,
        from: timeWindow?.from,
        to: timeWindow?.to,
      }),
    refetchInterval,
    enabled: isDataEnabled,
  });

  // Muestra hasta 150 turnos recientes para el gráfico de dispersión (independiente de la paginación o vista sesiones)
  const scatterQuery = useQuery({
    queryKey: ['prompts-scatter', range, timeWindow?.from, timeWindow?.to, selectedModel],
    queryFn: () =>
      apiClient.getPrompts(range, {
        view: 'turns',
        model: selectedModel,
        page: 1,
        limit: 150,
        from: timeWindow?.from,
        to: timeWindow?.to,
      }),
    refetchInterval,
    enabled: isDataEnabled,
  });

  const handleRangeChange = (next: TimeRange) => {
    setRange(next);
    setPage(1);
  };

  const handleStartMeasurement = () => {
    setMeasurement({
      startedAt: new Date().toISOString(),
      endedAt: null,
      label: draftLabel.trim(),
    });
    setDraftLabel('');
    setRange('measurement');
    setPage(1);
  };

  const handleStopMeasurement = () => {
    setMeasurement((prev) => (prev ? { ...prev, endedAt: new Date().toISOString() } : prev));
  };

  const handleResumeMeasurement = () => {
    setMeasurement((prev) => (prev ? { ...prev, endedAt: null } : prev));
  };

  const handleRestartMeasurement = () => {
    setMeasurement((prev) => ({
      startedAt: new Date().toISOString(),
      endedAt: null,
      label: prev?.label ?? '',
    }));
    setRange('measurement');
    setPage(1);
  };

  const handleClearMeasurement = () => {
    setMeasurement(null);
    setPage(1);
  };

  const handleUpdateMeasurementLabel = (label: string) => {
    setMeasurement((prev) => (prev ? { ...prev, label } : prev));
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

  const scatterEvents = isDataEnabled
    ? (scatterQuery.data?.items ?? []).filter((item): item is PromptEvent => 'id' in item)
    : [];

  const isRefreshing =
    summaryQuery.isFetching || timeseriesQuery.isFetching || promptsQuery.isFetching;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100">
      <FilterBar
        range={range}
        onRangeChange={handleRangeChange}
        measurementStatus={measurementStatus}
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
            {range === 'measurement' && (
              <MeasurementBar
                measurement={measurement}
                draftLabel={draftLabel}
                onDraftLabelChange={setDraftLabel}
                onStart={handleStartMeasurement}
                onStop={handleStopMeasurement}
                onResume={handleResumeMeasurement}
                onRestart={handleRestartMeasurement}
                onClear={handleClearMeasurement}
                onUpdateLabel={handleUpdateMeasurementLabel}
              />
            )}

            <KpiCards
              summary={isDataEnabled ? summaryQuery.data : undefined}
              isLoading={isDataEnabled && summaryQuery.isLoading}
            />

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CostByModelChart
                data={isDataEnabled ? (timeseriesQuery.data ?? []) : []}
                isLoading={isDataEnabled && timeseriesQuery.isLoading}
              />
              <ContextVsCostScatter
                events={scatterEvents}
                isLoading={isDataEnabled && scatterQuery.isLoading}
                onSelectEvent={setSelectedEventId}
              />
            </section>

            <PromptsTable
              range={range}
              from={timeWindow?.from}
              to={timeWindow?.to}
              selectedModel={selectedModel}
              view={view}
              onViewChange={handleViewChange}
              search={search}
              onSearchChange={handleSearchChange}
              items={isDataEnabled ? (promptsQuery.data?.items ?? []) : []}
              total={isDataEnabled ? (promptsQuery.data?.total ?? 0) : 0}
              page={page}
              limit={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isDataEnabled && promptsQuery.isLoading}
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
