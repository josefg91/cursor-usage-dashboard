import type {
  ModelBreakdownItem,
  PromptEvent,
  PromptEventDetail,
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
  getHealth: () => fetchJson<{ status: string; timestamp: string }>('/api/health'),
  getSummary: (range: TimeRange, model?: string) => {
    const params = new URLSearchParams({ range });
    if (model) params.set('model', model);
    return fetchJson<SummaryStats>(`/api/stats/summary?${params.toString()}`);
  },
  getByModel: (range: TimeRange) =>
    fetchJson<ModelBreakdownItem[]>(`/api/stats/by-model?range=${range}`),
  getTimeseries: (range: TimeRange) =>
    fetchJson<TimeseriesBucket[]>(`/api/stats/timeseries?range=${range}`),
  getPrompts: (range: TimeRange) =>
    fetchJson<PromptEvent[]>(`/api/prompts?range=${range}`),
  getPromptDetail: (id: string) => fetchJson<PromptEventDetail>(`/api/prompts/${id}`),
};
