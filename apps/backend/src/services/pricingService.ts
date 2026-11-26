import fs from 'node:fs';
import {
  DEFAULT_MODEL_RATES,
  applyCursorTokenFee,
  normalizeModelKey,
  resolveModelRates,
  type ModelPricing,
  type ModelRates,
  type PricingOverridesMap,
} from '@cursor-dashboard/shared';
import type { TelemetryRepository } from '../db/repository.js';

export const MODELS_DEV_API_URL = 'https://models.dev/api.json';

/**
 * Proveedores oficiales priorizados al consolidar models.dev para evitar que
 * agregadores o revendedores sobrescriban las tarifas de lista del fabricante.
 */
const PREFERRED_PROVIDER_ORDER = [
  'anthropic',
  'google',
  'openai',
  'xai',
  'deepseek',
  'mistral',
  'cohere',
  'perplexity',
];

const IGNORED_VARIANT_SUFFIX = /:(batch|free|nitro|floor|extended|exacto)$/i;

interface ModelsDevCost {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

interface ModelsDevModel {
  id?: string;
  cost?: ModelsDevCost;
}

interface ModelsDevProvider {
  id?: string;
  models?: Record<string, ModelsDevModel>;
}

type ModelsDevCatalogResponse = Record<string, ModelsDevProvider>;

export interface PricingServiceOptions {
  overridesPath: string;
  cacheTtlHours: number;
  cursorTokenFeePer1m?: number;
  fetchFn?: typeof fetch;
}

function isFiniteNonNegative(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

function getProviderRank(providerKey: string): number {
  const idx = PREFERRED_PROVIDER_ORDER.indexOf(providerKey.toLowerCase());
  return idx === -1 ? PREFERRED_PROVIDER_ORDER.length : idx;
}

function hasIgnoredVariant(rawId: string): boolean {
  return IGNORED_VARIANT_SUFFIX.test(rawId.trim());
}

/**
 * Parsea el catálogo de https://models.dev/api.json (precios en USD por 1M de tokens)
 * priorizando proveedores directos y claves canónicas sin sufijos de fecha/variante.
 */
export function parseModelsDevCatalog(
  payload: unknown,
  updatedAt: string,
): Map<string, ModelPricing> {
  const collected = new Map<string, ModelPricing>();
  if (!payload || typeof payload !== 'object') {
    return collected;
  }

  const providers = Object.entries(payload as ModelsDevCatalogResponse).sort(([a], [b]) => {
    const rankDiff = getProviderRank(a) - getProviderRank(b);
    return rankDiff !== 0 ? rankDiff : a.localeCompare(b);
  });

  for (const [, provider] of providers) {
    if (!provider || typeof provider !== 'object' || !provider.models) continue;

    const entries = Object.entries(provider.models)
      .map(([modelMapKey, model]) => {
        const rawId =
          typeof model?.id === 'string' && model.id.trim().length > 0
            ? model.id.trim()
            : modelMapKey.trim();
        const normalizedKey = normalizeModelKey(rawId);
        const strippedRaw = rawId.toLowerCase().includes('/')
          ? rawId.toLowerCase().split('/').pop() || rawId.toLowerCase()
          : rawId.toLowerCase();
        const isExactCanonical = strippedRaw === normalizedKey;
        return { rawId, model, normalizedKey, isExactCanonical };
      })
      .sort((a, b) => {
        if (a.isExactCanonical !== b.isExactCanonical) {
          return a.isExactCanonical ? -1 : 1;
        }
        return a.rawId.length - b.rawId.length;
      });

    for (const { rawId, model, normalizedKey } of entries) {
      if (!rawId || !normalizedKey || normalizedKey === 'unknown') continue;
      if (hasIgnoredVariant(rawId)) continue;
      if (collected.has(normalizedKey)) continue;

      const cost = model?.cost;
      if (!cost || typeof cost !== 'object') continue;
      if (!isFiniteNonNegative(cost.input) || !isFiniteNonNegative(cost.output)) continue;
      if (cost.input <= 0 && cost.output <= 0) continue;

      const inputPer1m = Number(cost.input.toFixed(6));
      const outputPer1m = Number(cost.output.toFixed(6));
      const cacheReadPer1m = isFiniteNonNegative(cost.cache_read)
        ? Number(cost.cache_read.toFixed(6))
        : Number((inputPer1m * 0.1).toFixed(6));
      const cacheWritePer1m = isFiniteNonNegative(cost.cache_write)
        ? Number(cost.cache_write.toFixed(6))
        : inputPer1m;

      collected.set(normalizedKey, {
        model_key: normalizedKey,
        input_per_1m: inputPer1m,
        cache_read_per_1m: cacheReadPer1m,
        cache_write_per_1m: cacheWritePer1m,
        output_per_1m: outputPer1m,
        updated_at: updatedAt,
        is_override: false,
      });
    }
  }

  return collected;
}

export class PricingService {
  private readonly fetchFn: typeof fetch;
  private readonly cursorTokenFeePer1m: number;
  private cachedCatalog: PricingOverridesMap = {};
  private cachedOverrides: PricingOverridesMap = {};

  constructor(
    private readonly repo: TelemetryRepository,
    private readonly options: PricingServiceOptions,
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.cursorTokenFeePer1m = isFiniteNonNegative(options.cursorTokenFeePer1m)
      ? options.cursorTokenFeePer1m
      : 0;
    this.loadFromStorage();
  }

  private loadOverridesFromDisk(): PricingOverridesMap {
    try {
      if (this.options.overridesPath && fs.existsSync(this.options.overridesPath)) {
        const raw = fs.readFileSync(this.options.overridesPath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          return parsed as PricingOverridesMap;
        }
      }
    } catch {
      // Si el archivo local está mal formado, no interrumpir el servicio
    }
    return {};
  }

  private loadFromStorage(): void {
    this.cachedOverrides = this.loadOverridesFromDisk();
    const now = new Date().toISOString();
    const overrideRows: ModelPricing[] = Object.entries(this.cachedOverrides).map(
      ([modelKey, rates]) => ({
        model_key: modelKey,
        ...rates,
        updated_at: now,
        is_override: true,
      }),
    );
    this.repo.replacePricingByOverride(overrideRows, true);

    const dbRows = this.repo.getAllPricing();
    const catalog: PricingOverridesMap = {};
    for (const row of dbRows) {
      if (!row.is_override) {
        catalog[row.model_key] = {
          input_per_1m: row.input_per_1m,
          cache_read_per_1m: row.cache_read_per_1m,
          cache_write_per_1m: row.cache_write_per_1m,
          output_per_1m: row.output_per_1m,
        };
      }
    }
    this.cachedCatalog = catalog;
  }

  async ensureFreshCatalog(): Promise<{ refreshed: boolean; count: number; source: string }> {
    const latest = this.repo.getLatestRemotePricingTimestamp();
    if (latest) {
      const ageHours = (Date.now() - Date.parse(latest)) / (1000 * 60 * 60);
      if (Number.isFinite(ageHours) && ageHours < this.options.cacheTtlHours) {
        return {
          refreshed: false,
          count: Object.keys(this.cachedCatalog).length,
          source: 'sqlite_cache',
        };
      }
    }
    return this.refreshCatalog();
  }

  async refreshCatalog(): Promise<{ refreshed: boolean; count: number; source: string }> {
    const now = new Date().toISOString();
    let collected = new Map<string, ModelPricing>();
    let source = 'defaults';

    // Única fuente remota: https://models.dev/api.json (solo lectura GET, sin enviar datos privados)
    try {
      const res = await this.fetchFn(MODELS_DEV_API_URL, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const json = (await res.json()) as unknown;
        collected = parseModelsDevCatalog(json, now);
        if (collected.size > 0) {
          source = 'models.dev';
        }
      }
    } catch {
      // Offline o error de red -> usar fallback offline DEFAULT_MODEL_RATES
    }

    if (collected.size === 0) {
      for (const [key, rates] of Object.entries(DEFAULT_MODEL_RATES)) {
        collected.set(key, {
          model_key: key,
          ...rates,
          updated_at: now,
          is_override: false,
        });
      }
    }

    const batch = Array.from(collected.values());
    this.repo.replacePricingByOverride(batch, false);
    this.loadFromStorage();

    return {
      refreshed: true,
      count: batch.length,
      source,
    };
  }

  getRates(modelKey: string): { rates: ModelRates; matched: boolean; matchedKey: string | null } {
    const resolved = resolveModelRates(modelKey, this.cachedCatalog, this.cachedOverrides);
    if (resolved.matched && !resolved.fromOverride && this.cursorTokenFeePer1m > 0) {
      return {
        matched: resolved.matched,
        matchedKey: resolved.matchedKey,
        rates: applyCursorTokenFee(
          resolved.matchedKey ?? modelKey,
          resolved.rates,
          this.cursorTokenFeePer1m,
        ),
      };
    }
    return {
      matched: resolved.matched,
      matchedKey: resolved.matchedKey,
      rates: resolved.rates,
    };
  }

  getCursorTokenFeePer1m(): number {
    return this.cursorTokenFeePer1m;
  }

  listPricing(): ModelPricing[] {
    return this.repo.getAllPricing();
  }

  getCatalogCount(): number {
    return Math.max(Object.keys(this.cachedCatalog).length, Object.keys(DEFAULT_MODEL_RATES).length);
  }
}
