import type { FastifyInstance } from 'fastify';
import type { PromptsViewMode, TimeRange } from '@cursor-dashboard/shared';
import { parseIsoTimestamp, parseTimeRange } from '../db/repository.js';
import type { RouteDeps } from './health.js';

interface PromptsQuerystring {
  range?: TimeRange;
  from?: string;
  to?: string;
  model?: string;
  search?: string;
  view?: PromptsViewMode;
  page?: string;
  limit?: string;
}

export async function promptsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get<{ Querystring: PromptsQuerystring }>('/api/prompts', async (request) => {
    const view: PromptsViewMode = request.query.view === 'sessions' ? 'sessions' : 'turns';
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 50);

    return deps.repo.listPrompts({
      range: parseTimeRange(request.query.range, 'today'),
      from: parseIsoTimestamp(request.query.from),
      to: parseIsoTimestamp(request.query.to),
      model: request.query.model,
      search: request.query.search,
      view,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 50,
    });
  });

  app.get<{ Params: { id: string } }>('/api/prompts/:id', async (request, reply) => {
    const detail = deps.repo.getPromptDetail(request.params.id);
    if (!detail) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `No se encontró el evento ${request.params.id}`,
      });
    }
    return detail;
  });
}
