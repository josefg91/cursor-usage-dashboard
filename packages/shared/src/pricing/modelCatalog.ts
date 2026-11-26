import type { ModelRates, PricingOverridesMap } from '../types/pricing.js';

/**
 * Tarifas base offline (USD por 1M de tokens) usadas únicamente como fallback
 * si el catálogo de models.dev no está disponible o no contiene el modelo.
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
  'claude-haiku-4.5': {
    input_per_1m: 0.5,
    cache_read_per_1m: 0.05,
    cache_write_per_1m: 0.625,
    output_per_1m: 2.5,
  },
  'claude-haiku-5.5': {
    input_per_1m: 0.1,
    cache_read_per_1m: 0.01,
    cache_write_per_1m: 0.125,
    output_per_1m: 0.5,
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
  'gemini-4-neon': {
    input_per_1m: 3.0,
    cache_read_per_1m: 0.15,
    cache_write_per_1m: 3.0,
    output_per_1m: 15.0,
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

/**
 * Normaliza identificadores de modelo entre Cursor y models.dev:
 * - Quita prefijo de proveedor (`anthropic/`) y sufijos encadenados (`-thinking-high`, `-20250219`, `-2024-08-06`)
 * - Unifica versiones con guión a punto (`5-5` -> `5.5`, `3-7` -> `3.7`)
 */
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
    key = key.replace(
      /-(20\d{2}-\d{2}-\d{2}|20\d{6}|thinking|max|xhigh|high|medium|low|fast|preview|latest)$/,
      '',
    );
  }
  // Unificar separador de versión menor (ej. claude-haiku-5-5 -> claude-haiku-5.5)
  key = key.replace(/(\d)-(\d)(?!\d)/g, '$1.$2');
  return key;
}

/**
 * Umbral oficial de Cursor: los modelos de terceros cuyo cache_read es estrictamente
 * inferior a $0.10 / 1M tokens están exentos del Cursor Token Rate.
 */
export const CURSOR_TOKEN_FEE_CACHE_READ_THRESHOLD = 0.1;

const CURSOR_FIRST_PARTY_PATTERNS = ['composer', 'grok', 'cursor-small', 'auto'];

export function isCursorFirstPartyModel(modelKey: string): boolean {
  const normalized = normalizeModelKey(modelKey);
  return CURSOR_FIRST_PARTY_PATTERNS.some(
    (needle) => normalized === needle || normalized.includes(needle),
  );
}

/**
 * Aplica el recargo opcional Cursor Token Rate (USD por 1M tokens) sobre entrada,
 * caché y salida en modelos de terceros elegibles (cache_read >= $0.10 / 1M).
 */
export function applyCursorTokenFee(
  modelKey: string,
  rates: ModelRates,
  tokenFeePer1m: number,
): ModelRates {
  if (!Number.isFinite(tokenFeePer1m) || tokenFeePer1m <= 0) {
    return rates;
  }
  if (isCursorFirstPartyModel(modelKey)) {
    return rates;
  }
  if (rates.cache_read_per_1m < CURSOR_TOKEN_FEE_CACHE_READ_THRESHOLD) {
    return rates;
  }

  return {
    input_per_1m: Number((rates.input_per_1m + tokenFeePer1m).toFixed(6)),
    cache_read_per_1m: Number((rates.cache_read_per_1m + tokenFeePer1m).toFixed(6)),
    cache_write_per_1m: Number((rates.cache_write_per_1m + tokenFeePer1m).toFixed(6)),
    output_per_1m: Number((rates.output_per_1m + tokenFeePer1m).toFixed(6)),
  };
}

const FAMILY_FALLBACKS: Array<[string, string]> = [
  ['haiku', 'claude-haiku-5.5'],
  ['sonnet', 'claude-4-sonnet'],
  ['opus', 'claude-4-opus'],
  ['gpt-4o-mini', 'gpt-4o-mini'],
  ['gpt-4o', 'gpt-4o'],
  ['gpt-4.1-mini', 'gpt-4.1-mini'],
  ['gpt-4.1', 'gpt-4.1'],
  ['gemini-2.5-flash', 'gemini-2.5-flash'],
  ['gemini-2.5-pro', 'gemini-2.5-pro'],
];

function lookupInMap(
  rawLower: string,
  normalized: string,
  sourceMap: PricingOverridesMap,
): { rates: ModelRates; matchedKey: string } | null {
  if (rawLower && sourceMap[rawLower]) {
    return { rates: sourceMap[rawLower], matchedKey: rawLower };
  }
  if (sourceMap[normalized]) {
    return { rates: sourceMap[normalized], matchedKey: normalized };
  }

  // Normalizar también las claves del mapa (por si un override local usa guión en vez de punto)
  for (const [k, rates] of Object.entries(sourceMap)) {
    if (normalizeModelKey(k) === normalized) {
      return { rates, matchedKey: k };
    }
  }

  const keys = Object.keys(sourceMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const normKey = normalizeModelKey(key);
    if (normalized.includes(normKey) || rawLower.includes(key)) {
      const rates = sourceMap[key];
      if (rates) {
        return { rates, matchedKey: key };
      }
    }
  }

  return null;
}

/**
 * Resuelve tarifas en orden estricto de prioridad:
 * 1. Overrides locales (`pricing-overrides.json`)
 * 2. Catálogo remoto cacheado en SQLite (`models.dev`)
 * 3. Tarifas base offline (`DEFAULT_MODEL_RATES`) + fallback por familia
 */
export function resolveModelRates(
  model: string,
  catalog: PricingOverridesMap,
  overrides: PricingOverridesMap = {},
): { rates: ModelRates; matched: boolean; matchedKey: string | null; fromOverride: boolean } {
  const rawLower = model.trim().toLowerCase();
  const normalized = normalizeModelKey(model);

  const fromOverrides = lookupInMap(rawLower, normalized, overrides);
  if (fromOverrides) {
    return { ...fromOverrides, matched: true, fromOverride: true };
  }

  const fromCatalog = lookupInMap(rawLower, normalized, catalog);
  if (fromCatalog) {
    return { ...fromCatalog, matched: true, fromOverride: false };
  }

  const fromDefaults = lookupInMap(rawLower, normalized, DEFAULT_MODEL_RATES);
  if (fromDefaults) {
    return { ...fromDefaults, matched: true, fromOverride: false };
  }

  const merged: PricingOverridesMap = { ...DEFAULT_MODEL_RATES, ...catalog, ...overrides };
  for (const [needle, fallbackKey] of FAMILY_FALLBACKS) {
    const fallbackRates = merged[fallbackKey];
    if (normalized.includes(needle) && fallbackRates) {
      return {
        rates: fallbackRates,
        matched: true,
        matchedKey: fallbackKey,
        fromOverride: Boolean(overrides[fallbackKey]),
      };
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
    fromOverride: false,
  };
}
