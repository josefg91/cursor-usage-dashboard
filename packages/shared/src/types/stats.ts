export type TimeRange = 'today' | '7d' | '30d' | 'all';

export type PromptsViewMode = 'turns' | 'sessions';

export interface SummaryStats {
  total_cost_usd: number;
  prompt_count: number;
  session_count: number;
  avg_cost_per_prompt: number;
  avg_cost_per_session: number;
  total_input_tokens: number;
  total_uncached_input_tokens: number;
  total_cache_read_tokens: number;
  total_cache_write_tokens: number;
  total_output_tokens: number;
  input_output_ratio: number;
  cache_hit_rate_pct: number;
}

export interface ModelBreakdownItem {
  model: string;
  prompt_count: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface TimeseriesBucket {
  bucket: string; // ISO date or hour bucket
  by_model: Record<string, number>;
  total_cost_usd: number;
}

export interface SessionSummary {
  conversation_id: string;
  started_at: string;
  last_activity_at: string;
  turn_count: number;
  models: string[];
  first_prompt_preview: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  available_models: string[];
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  db_events_count: number;
  pricing_models_count: number;
}

export interface CsvImportResult {
  total_rows: number;
  reconciled: number;
  inserted: number;
  skipped: number;
}

export interface StorageMaintenanceStats {
  events_count: number;
  payloads_count: number;
  db_size_bytes: number;
  retention_days: number;
}

export interface PurgePayloadsResult {
  purged_count: number;
  retention_days: number;
  cutoff_iso: string;
}
