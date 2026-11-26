import type {
  HealthResponse,
  ModelBreakdownItem,
  PaginatedResponse,
  PromptEvent,
  PromptEventDetail,
  PromptsViewMode,
  SessionSummary,
  SummaryStats,
  TimeRange,
  TimeseriesBucket,
} from '@cursor-dashboard/shared';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error API (${res.status}): ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  getHealth: () => fetchJson<HealthResponse>('/api/health'),
  getSummary: (range: TimeRange, model?: string) => {
    const params = new URLSearchParams({ range });
    if (model && model !== 'all') params.set('model', model);
    return fetchJson<SummaryStats>(`/api/stats/summary?${params.toString()}`);
  },
  getByModel: (range: TimeRange) =>
    fetchJson<ModelBreakdownItem[]>(`/api/stats/by-model?range=${range}`),
  getTimeseries: (range: TimeRange, model?: string) => {
    const params = new URLSearchParams({ range });
    if (model && model !== 'all') params.set('model', model);
    return fetchJson<TimeseriesBucket[]>(`/api/stats/timeseries?${params.toString()}`);
  },
  getPrompts: (
    range: TimeRange,
    options: { view?: PromptsViewMode; model?: string; search?: string; page?: number; limit?: number } = {},
  ) => {
    const params = new URLSearchParams({ range });
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
};
