import { describe, expect, it } from 'vitest';
import { calculateTurnCost } from './calculateCost.js';
import { normalizeModelKey, resolveModelRates } from './modelCatalog.js';

describe('calculateTurnCost', () => {
  const claudeRates = {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.3,
    cache_write_per_1m: 3.75,
    output_per_1m: 15.0,
  };

  it('descuenta cache_read y cache_write de input_tokens para evitar doble conteo', () => {
    const result = calculateTurnCost(
      {
        input_tokens: 100_000,
        cache_read_tokens: 80_000,
        cache_write_tokens: 10_000,
        output_tokens: 2_000,
      },
      claudeRates,
    );

    // uncached = 10_000 -> 10k * 3 / 1M = 0.03
    // cache_read = 80_000 -> 80k * 0.3 / 1M = 0.024
    // cache_write = 10_000 -> 10k * 3.75 / 1M = 0.0375
    // output = 2_000 -> 2k * 15 / 1M = 0.03
    // total = 0.1215
    expect(result.uncached_input_tokens).toBe(10_000);
    expect(result.cost_usd).toBeCloseTo(0.1215, 6);
  });

  it('nunca devuelve uncached_input_tokens negativo si caché supera input_tokens', () => {
    const result = calculateTurnCost(
      {
        input_tokens: 5_000,
        cache_read_tokens: 8_000,
        cache_write_tokens: 0,
        output_tokens: 1_000,
      },
      claudeRates,
    );

    expect(result.uncached_input_tokens).toBe(0);
    expect(result.cost_usd).toBeCloseTo(0.0174, 6);
  });
});

describe('modelCatalog', () => {
  it('normaliza sufijos encadenados de Cursor y unifica guiones de versión a punto', () => {
    expect(normalizeModelKey('claude-haiku-5-5-thinking-high')).toBe('claude-haiku-5.5');
    expect(normalizeModelKey('claude-3-7-sonnet-20250219')).toBe('claude-3.7-sonnet');
    expect(normalizeModelKey('anthropic/claude-3.7-sonnet-20250219')).toBe('claude-3.7-sonnet');
  });

  it('prioriza catálogo remoto (OpenRouter) sobre defaults offline aunque Cursor use guión', () => {
    const res = resolveModelRates('claude-haiku-5-5-high', {
      'claude-haiku-5.5': {
        input_per_1m: 0.05,
        cache_read_per_1m: 0.005,
        cache_write_per_1m: 0.0625,
        output_per_1m: 0.25,
      },
    });
    expect(res.matched).toBe(true);
    expect(res.rates.input_per_1m).toBe(0.05);
  });

  it('prioriza overrides locales sobre catálogo remoto y defaults', () => {
    const res = resolveModelRates(
      'claude-3.7-sonnet',
      {
        'claude-3.7-sonnet': {
          input_per_1m: 3.0,
          cache_read_per_1m: 0.3,
          cache_write_per_1m: 3.75,
          output_per_1m: 15.0,
        },
      },
      {
        'claude-3.7-sonnet': {
          input_per_1m: 2.0,
          cache_read_per_1m: 0.2,
          cache_write_per_1m: 2.5,
          output_per_1m: 10.0,
        },
      },
    );

    expect(res.matched).toBe(true);
    expect(res.rates.input_per_1m).toBe(2.0);
  });
});
