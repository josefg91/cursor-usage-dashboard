import fs from 'node:fs';
import path from 'node:path';

/**
 * Tarifas base offline (USD por 1M de tokens) usadas cuando el backend local
 * (que sincroniza https://models.dev/api.json) no está disponible.
 */
export const DEFAULT_MODEL_RATES = {
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
  'o3': {
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
 * Normaliza el identificador de modelo (quita prefijos de proveedor y sufijos de fecha/thinking).
 */
export function normalizeModelKey(model) {
  if (!model || typeof model !== 'string') return 'unknown';
  let key = model.trim().toLowerCase();
  if (key.includes('/')) {
    key = key.split('/').pop() || key;
  }
  // Quita sufijos encadenados comunes tipo -thinking-high, -20250219, -2024-08-06, -max, :free
  key = key.replace(/:.*$/, '');
  let prev;
  do {
    prev = key;
    key = key.replace(
      /-(20\d{2}-\d{2}-\d{2}|20\d{6}|thinking|max|xhigh|high|medium|low|fast|preview|latest)$/,
      '',
    );
  } while (key !== prev);
  // Unificar versión con guión a punto (ej. claude-haiku-5-5 -> claude-haiku-5.5)
  key = key.replace(/(\d)-(\d)(?!\d)/g, '$1.$2');
  return key;
}

export const CURSOR_TOKEN_FEE_CACHE_READ_THRESHOLD = 0.1;
const CURSOR_FIRST_PARTY_PATTERNS = ['composer', 'grok', 'cursor-small', 'auto'];

export function applyCursorTokenFee(modelKey, rates, tokenFeePer1m) {
  const fee = Number(tokenFeePer1m);
  if (!Number.isFinite(fee) || fee <= 0) return rates;
  const normalized = normalizeModelKey(modelKey);
  if (CURSOR_FIRST_PARTY_PATTERNS.some((p) => normalized === p || normalized.includes(p))) {
    return rates;
  }
  if (Number(rates?.cache_read_per_1m || 0) < CURSOR_TOKEN_FEE_CACHE_READ_THRESHOLD) {
    return rates;
  }
  return {
    input_per_1m: Number(((Number(rates?.input_per_1m) || 0) + fee).toFixed(6)),
    cache_read_per_1m: Number(((Number(rates?.cache_read_per_1m) || 0) + fee).toFixed(6)),
    cache_write_per_1m: Number(((Number(rates?.cache_write_per_1m) || 0) + fee).toFixed(6)),
    output_per_1m: Number(((Number(rates?.output_per_1m) || 0) + fee).toFixed(6)),
  };
}

/**
 * Carga overrides locales de tarifas si existe pricing-overrides.json.
 */
export function loadPricingOverrides(overridePaths = []) {
  for (const filePath of overridePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Ignorar errores de lectura/parseo para nunca bloquear Cursor
    }
  }
  return {};
}

/**
 * Resuelve la tarifa para un modelo buscando coincidencia exacta, normalizada o por prefijo.
 */
export function resolveModelRates(model, overrides = {}, { tokenFeePer1m = 0 } = {}) {
  const catalog = { ...DEFAULT_MODEL_RATES, ...overrides };
  const rawLower = typeof model === 'string' ? model.trim().toLowerCase() : '';
  const normalized = normalizeModelKey(model);

  const hasOverride = (key) => Object.prototype.hasOwnProperty.call(overrides, key);
  const finalize = (rates, key) => ({
    rates: hasOverride(key) ? rates : applyCursorTokenFee(key, rates, tokenFeePer1m),
    matched: true,
  });

  if (rawLower && catalog[rawLower]) {
    return finalize(catalog[rawLower], rawLower);
  }
  if (catalog[normalized]) {
    return finalize(catalog[normalized], normalized);
  }

  // Coincidencia parcial (ej. claude-3.7-sonnet-20250219 -> claude-3.7-sonnet)
  const keys = Object.keys(catalog).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized.includes(key) || rawLower.includes(key)) {
      return finalize(catalog[key], key);
    }
  }

  // Fallback por familia de modelo (para versiones nuevas offline sin conexión a models.dev)
  const familyFallbacks = [
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
  for (const [needle, fallbackKey] of familyFallbacks) {
    if (normalized.includes(needle) && catalog[fallbackKey]) {
      return finalize(catalog[fallbackKey], fallbackKey);
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
  };
}

/**
 * Fórmula exacta de coste USD evitando doble conteo de tokens de caché.
 * uncached_in = max(0, input_tokens - cache_read_tokens - cache_write_tokens)
 */
export function calculateTurnCost(usage, rates) {
  const input = Math.max(0, Number(usage?.input_tokens) || 0);
  const cacheRead = Math.max(0, Number(usage?.cache_read_tokens) || 0);
  const cacheWrite = Math.max(0, Number(usage?.cache_write_tokens) || 0);
  const output = Math.max(0, Number(usage?.output_tokens) || 0);

  const uncachedInput = Math.max(0, input - cacheRead - cacheWrite);

  const costUsd =
    (uncachedInput * (Number(rates?.input_per_1m) || 0) +
      cacheRead * (Number(rates?.cache_read_per_1m) || 0) +
      cacheWrite * (Number(rates?.cache_write_per_1m) || 0) +
      output * (Number(rates?.output_per_1m) || 0)) /
    1_000_000;

  return {
    uncached_input_tokens: uncachedInput,
    cost_usd: Number(costUsd.toFixed(6)),
  };
}

export function getDefaultOverridePaths(scriptDir, homeDir) {
  return [
    path.resolve(scriptDir, '../../../pricing-overrides.json'),
    path.join(homeDir, '.cursor', 'pricing-overrides.json'),
  ];
}
