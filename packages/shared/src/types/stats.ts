export type TimeRange = 'today' | '7d' | '30d' | 'all';

export interface SummaryStats {
  total_cost_usd: number;
  prompt_count: number;
  session_count: number;
  avg_cost_per_prompt: number;
  avg_cost_per_session: number;
  total_input_tokens: number;
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
