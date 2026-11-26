import fs from 'node:fs';
import {
  DEFAULT_MODEL_RATES,
  normalizeModelKey,
  resolveModelRates,
  type ModelPricing,
  type ModelRates,
  type PricingOverridesMap,
} from '@cursor-dashboard/shared';
import type { TelemetryRepository } from '../db/repository.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

interface OpenRouterModel {
  id?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  };
}

interface LiteLlmEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
}

export interface PricingServiceOptions {
  overridesPath: string;
  cacheTtlHours: number;
  fetchFn?: typeof fetch;
}

export class PricingService {
  private readonly fetchFn: typeof fetch;
  private cachedCatalog: PricingOverridesMap = {};
  private cachedOverrides: PricingOverridesMap = {};

  constructor(
    private readonly repo: TelemetryRepository,
    private readonly options: PricingServiceOptions,
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
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
    this.cachedOverrides = this.loadOverridesFromDisk();

    if (Object.keys(this.cachedOverrides).length > 0) {
      const now = new Date().toISOString();
      const overrideRows: ModelPricing[] = Object.entries(this.cachedOverrides).map(
        ([modelKey, rates]) => ({
          model_key: modelKey,
          ...rates,
          updated_at: now,
          is_override: true,
        }),
      );
      this.repo.upsertPricingBatch(overrideRows);
    }
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
    const collected = new Map<string, ModelPricing>();
    let source = 'defaults';

    // 1. Primaria: OpenRouter Models API (solo lectura GET, sin enviar datos privados)
    try {
      const res = await this.fetchFn(OPENROUTER_MODELS_URL, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: OpenRouterModel[] };
        for (const item of json.data ?? []) {
          if (!item.id || !item.pricing) continue;
          const inputPerToken = Number(item.pricing.prompt ?? 0);
          const outputPerToken = Number(item.pricing.completion ?? 0);
          if (!Number.isFinite(inputPerToken) || !Number.isFinite(outputPerToken)) continue;
          if (inputPerToken <= 0 && outputPerToken <= 0) continue;

          const inputPer1m = Number((inputPerToken * 1_000_000).toFixed(6));
          const outputPer1m = Number((outputPerToken * 1_000_000).toFixed(6));
          const cacheReadPer1m = item.pricing.input_cache_read
            ? Number((Number(item.pricing.input_cache_read) * 1_000_000).toFixed(6))
            : Number((inputPer1m * 0.1).toFixed(6));
          const cacheWritePer1m = item.pricing.input_cache_write
            ? Number((Number(item.pricing.input_cache_write) * 1_000_000).toFixed(6))
            : Number((inputPer1m * 1.25).toFixed(6));

          const normalizedKey = normalizeModelKey(item.id);
          collected.set(normalizedKey, {
            model_key: normalizedKey,
            input_per_1m: inputPer1m,
            cache_read_per_1m: cacheReadPer1m,
            cache_write_per_1m: cacheWritePer1m,
            output_per_1m: outputPer1m,
            updated_at: now,
            is_override: false,
          });
        }
        if (collected.size > 0) source = 'openrouter';
      }
    } catch {
      // Fallback silencioso a LiteLLM o defaults offline
    }

    // 2. Fallback secundario: LiteLLM Pricing JSON (rellena modelos faltantes o si OpenRouter falló)
    if (collected.size === 0) {
      try {
        const res = await this.fetchFn(LITELLM_PRICING_URL, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, LiteLlmEntry>;
          for (const [rawKey, entry] of Object.entries(json)) {
            if (!entry || typeof entry !== 'object') continue;
            const inputPerToken = Number(entry.input_cost_per_token ?? 0);
            const outputPerToken = Number(entry.output_cost_per_token ?? 0);
            if (!Number.isFinite(inputPerToken) || !Number.isFinite(outputPerToken)) continue;
            if (inputPerToken <= 0 && outputPerToken <= 0) continue;

            const inputPer1m = Number((inputPerToken * 1_000_000).toFixed(6));
            const outputPer1m = Number((outputPerToken * 1_000_000).toFixed(6));
            const cacheReadPer1m = entry.cache_read_input_token_cost
              ? Number((Number(entry.cache_read_input_token_cost) * 1_000_000).toFixed(6))
              : Number((inputPer1m * 0.1).toFixed(6));
            const cacheWritePer1m = entry.cache_creation_input_token_cost
              ? Number((Number(entry.cache_creation_input_token_cost) * 1_000_000).toFixed(6))
              : Number((inputPer1m * 1.25).toFixed(6));

            const normalizedKey = normalizeModelKey(rawKey);
            if (!collected.has(normalizedKey)) {
              collected.set(normalizedKey, {
                model_key: normalizedKey,
                input_per_1m: inputPer1m,
                cache_read_per_1m: cacheReadPer1m,
                cache_write_per_1m: cacheWritePer1m,
                output_per_1m: outputPer1m,
                updated_at: now,
                is_override: false,
              });
            }
          }
          if (collected.size > 0) source = 'litellm';
        }
      } catch {
        // Offline total -> usar defaults
      }
    }

    // Asegurar modelos base offline si la red falló
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
    this.repo.upsertPricingBatch(batch);
    this.loadFromStorage();

    return {
      refreshed: true,
      count: batch.length,
      source,
    };
  }

  getRates(modelKey: string): { rates: ModelRates; matched: boolean; matchedKey: string | null } {
    return resolveModelRates(modelKey, this.cachedCatalog, this.cachedOverrides);
  }

  listPricing(): ModelPricing[] {
    return this.repo.getAllPricing();
  }

  getCatalogCount(): number {
    return Math.max(Object.keys(this.cachedCatalog).length, Object.keys(DEFAULT_MODEL_RATES).length);
  }
}
