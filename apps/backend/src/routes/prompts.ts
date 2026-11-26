import type { FastifyInstance } from 'fastify';

export async function promptsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/prompts', async (_request, reply) => {
    // TODO (Fase 2): Listar turnos o sesiones agrupadas con paginación y filtros
    return reply.status(501).send({ error: 'Not Implemented' });
  });

  app.get<{ Params: { id: string } }>('/api/prompts/:id', async (_request, reply) => {
    // TODO (Fase 2): Recuperar detalle del prompt descomprimiendo payload gzip
    return reply.status(501).send({ error: 'Not Implemented' });
  });
}
