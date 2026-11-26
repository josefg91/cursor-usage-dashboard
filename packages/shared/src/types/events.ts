export type CostSource = 'calculated' | 'csv_reconciled' | 'api_reported';

export type EventSource = 'cursor_hook' | 'csv_import' | 'admin_api';

export interface TokenUsage {
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
}

export interface PromptEvent {
  id: string;
  conversation_id: string;
  timestamp: string; // ISO UTC
  model: string;
  prompt_preview: string; // max 500 chars
  input_tokens: number;
  uncached_input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  cost_source: CostSource;
  duration_ms: number | null;
  source: EventSource;
}

export interface PromptEventDetail extends PromptEvent {
  prompt_text: string | null;
  response_text: string | null;
  raw_hook_json: string | null;
}

export interface IngestEventDto {
  id?: string;
  conversation_id: string;
  timestamp?: string;
  model: string;
  prompt_text?: string;
  response_text?: string;
  input_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  duration_ms?: number | null;
  source?: EventSource;
  raw_hook_json?: unknown;
}
