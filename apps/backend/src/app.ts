import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { DatabaseSync } from 'node:sqlite';
import { TelemetryRepository } from './db/repository.js';
import { PricingService } from './services/pricingService.js';
import { healthRoutes } from './routes/health.js';
import { eventsRoutes } from './routes/events.js';
import { statsRoutes } from './routes/stats.js';
import { promptsRoutes } from './routes/prompts.js';
import { pricingRoutes } from './routes/pricing.js';
import { maintenanceRoutes } from './routes/maintenance.js';

export interface BuildAppOptions {
  db: DatabaseSync;
  dbPath?: string;
  payloadRetentionDays?: number;
  overridesPath: string;
  pricingCacheTtlHours: number;
  cursorTokenFeePer1m?: number;
  bufferPath: string;
  logger?: boolean;
  fetchFn?: typeof fetch;
}

export async function buildApp(options: BuildAppOptions): Promise<{
  app: FastifyInstance;
  repo: TelemetryRepository;
  pricingService: PricingService;
}> {
  const repo = new TelemetryRepository(options.db);
  const pricingService = new PricingService(repo, {
    overridesPath: options.overridesPath,
    cacheTtlHours: options.pricingCacheTtlHours,
    cursorTokenFeePer1m: options.cursorTokenFeePer1m ?? 0,
    fetchFn: options.fetchFn,
  });

  const app = Fastify({
    logger: options.logger ?? false,
  });

  await app.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });

  const deps = {
    repo,
    pricingService,
    bufferPath: options.bufferPath,
    dbPath: options.dbPath ?? ':memory:',
    payloadRetentionDays: options.payloadRetentionDays ?? 30,
  };

  await app.register(async (instance) => {
    await healthRoutes(instance, deps);
    await eventsRoutes(instance, deps);
    await statsRoutes(instance, deps);
    await promptsRoutes(instance, deps);
    await pricingRoutes(instance, deps);
    await maintenanceRoutes(instance, deps);
  });

  app.addHook('onClose', async () => {
    options.db.close();
  });

  return { app, repo, pricingService };
}
