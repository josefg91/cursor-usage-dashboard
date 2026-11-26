import type { TokenUsage } from '../types/events.js';
import type { ModelRates } from '../types/pricing.js';

export interface CostBreakdown {
  uncached_input_tokens: number;
  cost_usd: number;
}

/**
 * Calcula el coste estimado en USD evitando doble conteo de tokens de caché.
 * En Cursor, `input_tokens` suele incluir los tokens servidos o escritos en caché.
 */
export function calculateTurnCost(usage: TokenUsage, rates: ModelRates): CostBreakdown {
  const input = Math.max(0, usage.input_tokens || 0);
  const cacheRead = Math.max(0, usage.cache_read_tokens || 0);
  const cacheWrite = Math.max(0, usage.cache_write_tokens || 0);
  const output = Math.max(0, usage.output_tokens || 0);

  const uncachedInput = Math.max(0, input - cacheRead - cacheWrite);

  const costUsd =
    (uncachedInput * rates.input_per_1m +
      cacheRead * rates.cache_read_per_1m +
      cacheWrite * rates.cache_write_per_1m +
      output * rates.output_per_1m) /
    1_000_000;

  return {
    uncached_input_tokens: uncachedInput,
    cost_usd: Number(costUsd.toFixed(6)),
  };
}
