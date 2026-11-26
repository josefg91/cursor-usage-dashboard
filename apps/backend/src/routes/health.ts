import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@cursor-dashboard/shared';
import type { TelemetryRepository } from '../db/repository.js';
import type { PricingService } from '../services/pricingService.js';

export interface RouteDeps {
  repo: TelemetryRepository;
  pricingService: PricingService;
  bufferPath: string;
  dbPath: string;
  payloadRetentionDays: number;
}

export async function healthRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get('/api/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db_events_count: deps.repo.getEventsCount(),
      pricing_models_count: deps.pricingService.getCatalogCount(),
    };
  });
}
