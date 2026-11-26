import type { FastifyInstance } from 'fastify';
import type { IngestEventDto } from '@cursor-dashboard/shared';

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: IngestEventDto }>('/api/events', async (_request, reply) => {
    // TODO (Fase 2): Calcular coste con PricingService, comprimir payloads con gzip y persistir en SQLite
    return reply.status(501).send({
      error: 'Not Implemented',
      message: 'Ingesta de eventos pendiente de Fase 2',
    });
  });
}
