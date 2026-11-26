import type { FastifyInstance } from 'fastify';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats/summary', async (_request, reply) => {
    // TODO (Fase 2): Consultar agregados de KPIs desde SQLite
    return reply.status(501).send({ error: 'Not Implemented' });
  });

  app.get('/api/stats/by-model', async (_request, reply) => {
    // TODO (Fase 2): Consultar desglose de gasto por modelo
    return reply.status(501).send({ error: 'Not Implemented' });
  });

  app.get('/api/stats/timeseries', async (_request, reply) => {
    // TODO (Fase 2): Consultar evolución temporal apilada por modelo
    return reply.status(501).send({ error: 'Not Implemented' });
  });
}
