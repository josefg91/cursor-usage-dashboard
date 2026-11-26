export interface ModelPricing {
  model_key: string;
  input_per_1m: number;
  cache_read_per_1m: number;
  cache_write_per_1m: number;
  output_per_1m: number;
  updated_at: string;
  is_override: boolean;
}

export interface ModelRates {
  input_per_1m: number;
  cache_read_per_1m: number;
  cache_write_per_1m: number;
  output_per_1m: number;
}

export type PricingOverridesMap = Record<string, ModelRates>;
