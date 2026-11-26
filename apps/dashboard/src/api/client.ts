import type {
  CsvImportResult,
  HealthResponse,
  ModelBreakdownItem,
  ModelPricing,
  PaginatedResponse,
  PromptEvent,
  PromptEventDetail,
  PromptsViewMode,
  PurgePayloadsResult,
  SessionSummary,
  StorageMaintenanceStats,
  SummaryStats,
  TimeRange,
  TimeWindow,
  TimeseriesBucket,
} from '@cursor-dashboard/shared';

function appendWindow(params: URLSearchParams, window?: TimeWindow): void {
  if (window?.from) params.set('from', window.from);
  if (window?.to) params.set('to', window.to);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Error API (${res.status}): ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  getHealth: () => fetchJson<HealthResponse>('/api/health'),
  getSummary: (range: TimeRange, model?: string, window?: TimeWindow) => {
    const params = new URLSearchParams({ range });
    appendWindow(params, window);
    if (model && model !== 'all') params.set('model', model);
    return fetchJson<SummaryStats>(`/api/stats/summary?${params.toString()}`);
  },
  getByModel: (range: TimeRange, window?: TimeWindow) => {
    const params = new URLSearchParams({ range });
    appendWindow(params, window);
    return fetchJson<ModelBreakdownItem[]>(`/api/stats/by-model?${params.toString()}`);
  },
  getTimeseries: (range: TimeRange, model?: string, window?: TimeWindow) => {
    const params = new URLSearchParams({ range });
    appendWindow(params, window);
    if (model && model !== 'all') params.set('model', model);
    return fetchJson<TimeseriesBucket[]>(`/api/stats/timeseries?${params.toString()}`);
  },
  getPrompts: (
    range: TimeRange,
    options: {
      view?: PromptsViewMode;
      model?: string;
      search?: string;
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
    } = {},
  ) => {
    const params = new URLSearchParams({ range });
    appendWindow(params, { from: options.from, to: options.to });
    if (options.view) params.set('view', options.view);
    if (options.model && options.model !== 'all') params.set('model', options.model);
    if (options.search) params.set('search', options.search);
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    return fetchJson<PaginatedResponse<PromptEvent | SessionSummary>>(
      `/api/prompts?${params.toString()}`,
    );
  },
  getPromptDetail: (id: string) => fetchJson<PromptEventDetail>(`/api/prompts/${id}`),
  getPricing: () =>
    fetchJson<{ models: ModelPricing[]; count: number; cursor_token_fee_per_1m?: number }>(
      '/api/pricing',
    ),
  refreshPricing: () =>
    fetchJson<{
      refreshed: boolean;
      count: number;
      source: string;
      recalculated_events?: number;
    }>('/api/pricing/refresh', {
      method: 'POST',
    }),
  syncBuffer: () =>
    fetchJson<{ processed: number; inserted: number }>('/api/events/sync-buffer', {
      method: 'POST',
    }),
  importCsv: (csvText: string) =>
    fetchJson<CsvImportResult>('/api/import/csv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csvText }),
    }),
  getStorageStats: () => fetchJson<StorageMaintenanceStats>('/api/maintenance/storage'),
  purgePayloads: (retentionDays?: number) =>
    fetchJson<PurgePayloadsResult>('/api/maintenance/purge-payloads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(retentionDays ? { retentionDays } : {}),
    }),
  getExportUrl: (
    format: 'csv' | 'json',
    filters: { range: TimeRange; from?: string; to?: string; model?: string; search?: string },
  ) => {
    const params = new URLSearchParams({ format, range: filters.range });
    appendWindow(params, { from: filters.from, to: filters.to });
    if (filters.model && filters.model !== 'all') params.set('model', filters.model);
    if (filters.search) params.set('search', filters.search);
    return `/api/export?${params.toString()}`;
  },
};
