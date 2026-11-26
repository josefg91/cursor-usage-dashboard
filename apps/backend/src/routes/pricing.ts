import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './health.js';

export async function pricingRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get('/api/pricing', async () => {
    return {
      models: deps.pricingService.listPricing(),
      count: deps.pricingService.getCatalogCount(),
    };
  });

  app.post('/api/pricing/refresh', async () => {
    return deps.pricingService.refreshCatalog();
  });
}
