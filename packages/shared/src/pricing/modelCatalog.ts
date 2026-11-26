import type { ModelRates, PricingOverridesMap } from '../types/pricing.js';

/**
 * Tarifas base offline (USD por 1M de tokens) usadas como fallback si OpenRouter/LiteLLM
 * no están disponibles o aún no se han descargado.
 */
export const DEFAULT_MODEL_RATES: PricingOverridesMap = {
  'claude-3.5-sonnet': {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.3,
    cache_write_per_1m: 3.75,
    output_per_1m: 15.0,
  },
  'claude-3.7-sonnet': {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.3,
    cache_write_per_1m: 3.75,
    output_per_1m: 15.0,
  },
  'claude-4-sonnet': {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.3,
    cache_write_per_1m: 3.75,
    output_per_1m: 15.0,
  },
  'claude-sonnet-4': {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.3,
    cache_write_per_1m: 3.75,
    output_per_1m: 15.0,
  },
  'claude-4-opus': {
    input_per_1m: 15.0,
    cache_read_per_1m: 1.5,
    cache_write_per_1m: 18.75,
    output_per_1m: 75.0,
  },
  'claude-opus-4': {
    input_per_1m: 15.0,
    cache_read_per_1m: 1.5,
    cache_write_per_1m: 18.75,
    output_per_1m: 75.0,
  },
  'claude-3.5-haiku': {
    input_per_1m: 0.8,
    cache_read_per_1m: 0.08,
    cache_write_per_1m: 1.0,
    output_per_1m: 4.0,
  },
  'claude-4.5-haiku': {
    input_per_1m: 1.0,
    cache_read_per_1m: 0.1,
    cache_write_per_1m: 1.25,
    output_per_1m: 5.0,
  },
  'claude-haiku-4-5': {
    input_per_1m: 1.0,
    cache_read_per_1m: 0.1,
    cache_write_per_1m: 1.25,
    output_per_1m: 5.0,
  },
  'claude-haiku-5-5': {
    input_per_1m: 1.0,
    cache_read_per_1m: 0.1,
    cache_write_per_1m: 1.25,
    output_per_1m: 5.0,
  },
  'gpt-4o': {
    input_per_1m: 2.5,
    cache_read_per_1m: 1.25,
    cache_write_per_1m: 2.5,
    output_per_1m: 10.0,
  },
  'gpt-4o-mini': {
    input_per_1m: 0.15,
    cache_read_per_1m: 0.075,
    cache_write_per_1m: 0.15,
    output_per_1m: 0.6,
  },
  'gpt-4.1': {
    input_per_1m: 2.0,
    cache_read_per_1m: 0.5,
    cache_write_per_1m: 2.0,
    output_per_1m: 8.0,
  },
  'gpt-4.1-mini': {
    input_per_1m: 0.4,
    cache_read_per_1m: 0.1,
    cache_write_per_1m: 0.4,
    output_per_1m: 1.6,
  },
  o3: {
    input_per_1m: 2.0,
    cache_read_per_1m: 0.5,
    cache_write_per_1m: 2.0,
    output_per_1m: 8.0,
  },
  'o3-mini': {
    input_per_1m: 1.1,
    cache_read_per_1m: 0.55,
    cache_write_per_1m: 1.1,
    output_per_1m: 4.4,
  },
  'o4-mini': {
    input_per_1m: 1.1,
    cache_read_per_1m: 0.275,
    cache_write_per_1m: 1.1,
    output_per_1m: 4.4,
  },
  'gemini-2.5-pro': {
    input_per_1m: 1.25,
    cache_read_per_1m: 0.31,
    cache_write_per_1m: 1.25,
    output_per_1m: 10.0,
  },
  'gemini-2.5-flash': {
    input_per_1m: 0.15,
    cache_read_per_1m: 0.0375,
    cache_write_per_1m: 0.15,
    output_per_1m: 0.6,
  },
  'deepseek-r1': {
    input_per_1m: 0.55,
    cache_read_per_1m: 0.14,
    cache_write_per_1m: 0.55,
    output_per_1m: 2.19,
  },
  'deepseek-v3': {
    input_per_1m: 0.27,
    cache_read_per_1m: 0.07,
    cache_write_per_1m: 0.27,
    output_per_1m: 1.1,
  },
};

export function normalizeModelKey(model: string): string {
  if (!model || typeof model !== 'string') return 'unknown';
  let key = model.trim().toLowerCase();
  if (key.includes('/')) {
    key = key.split('/').pop() || key;
  }
  key = key.replace(/:.*$/, '');
  let prev = '';
  while (key !== prev) {
    prev = key;
    key = key.replace(/-(20\d{6}|thinking|max|high|medium|low|fast|preview|latest)$/, '');
  }
  return key;
}

const FAMILY_FALLBACKS: Array<[string, string]> = [
  ['haiku', 'claude-haiku-5-5'],
  ['sonnet', 'claude-4-sonnet'],
  ['opus', 'claude-4-opus'],
  ['gpt-4o-mini', 'gpt-4o-mini'],
  ['gpt-4o', 'gpt-4o'],
  ['gpt-4.1-mini', 'gpt-4.1-mini'],
  ['gpt-4.1', 'gpt-4.1'],
  ['gemini-2.5-flash', 'gemini-2.5-flash'],
  ['gemini-2.5-pro', 'gemini-2.5-pro'],
];

export function resolveModelRates(
  model: string,
  catalog: PricingOverridesMap,
  overrides: PricingOverridesMap = {},
): { rates: ModelRates; matched: boolean; matchedKey: string | null } {
  const merged: PricingOverridesMap = { ...DEFAULT_MODEL_RATES, ...catalog, ...overrides };
  const rawLower = model.trim().toLowerCase();
  const normalized = normalizeModelKey(model);

  if (rawLower && merged[rawLower]) {
    return { rates: merged[rawLower], matched: true, matchedKey: rawLower };
  }
  if (merged[normalized]) {
    return { rates: merged[normalized], matched: true, matchedKey: normalized };
  }

  const keys = Object.keys(merged).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized.includes(key) || rawLower.includes(key)) {
      const rates = merged[key];
      if (rates) {
        return { rates, matched: true, matchedKey: key };
      }
    }
  }

  for (const [needle, fallbackKey] of FAMILY_FALLBACKS) {
    const fallbackRates = merged[fallbackKey];
    if (normalized.includes(needle) && fallbackRates) {
      return { rates: fallbackRates, matched: true, matchedKey: fallbackKey };
    }
  }

  return {
    rates: {
      input_per_1m: 0,
      cache_read_per_1m: 0,
      cache_write_per_1m: 0,
      output_per_1m: 0,
    },
    matched: false,
    matchedKey: null,
  };
}
