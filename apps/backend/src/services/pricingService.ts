import type { ModelRates } from '@cursor-dashboard/shared';

/**
 * Servicio de tarifas por modelo.
 * TODO (Fase 2):
 * 1. Cargar overrides locales desde pricing-overrides.json
 * 2. Descargar y cachear 24h el catálogo público de OpenRouter (https://openrouter.ai/api/v1/models)
 * 3. Fallback secundario a LiteLLM Pricing JSON
 */
export class PricingService {
  async getRates(_modelKey: string): Promise<ModelRates | null> {
    return null;
  }
}
