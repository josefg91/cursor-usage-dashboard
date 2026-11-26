import type { FastifyInstance } from 'fastify';
import type { IngestEventDto } from '@cursor-dashboard/shared';
import { buildAndPersistEvent, ingestBufferFile } from '../services/bufferIngestService.js';
import type { RouteDeps } from './health.js';

export async function eventsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.post<{ Body: IngestEventDto }>('/api/events', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || !body.model) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'El campo "model" es obligatorio para registrar un evento.',
      });
    }

    const { event, inserted } = buildAndPersistEvent(body, deps.repo, deps.pricingService);
    return reply.status(inserted ? 201 : 200).send({
      inserted,
      event,
    });
  });

  app.post('/api/events/sync-buffer', async () => {
    return ingestBufferFile(deps.bufferPath, deps.repo, deps.pricingService);
  });
}
