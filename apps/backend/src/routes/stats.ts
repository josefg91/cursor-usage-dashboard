import type { FastifyInstance } from 'fastify';
import type { TimeRange } from '@cursor-dashboard/shared';
import type { RouteDeps } from './health.js';

interface StatsQuerystring {
  range?: TimeRange;
  model?: string;
  search?: string;
}

function parseRange(range?: string): TimeRange {
  if (range === 'today' || range === '7d' || range === '30d' || range === 'all') {
    return range;
  }
  return 'today';
}

export async function statsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get<{ Querystring: StatsQuerystring }>('/api/stats/summary', async (request) => {
    return deps.repo.getSummaryStats({
      range: parseRange(request.query.range),
      model: request.query.model,
      search: request.query.search,
    });
  });

  app.get<{ Querystring: StatsQuerystring }>('/api/stats/by-model', async (request) => {
    return deps.repo.getBreakdownByModel({
      range: parseRange(request.query.range),
      model: request.query.model,
      search: request.query.search,
    });
  });

  app.get<{ Querystring: StatsQuerystring }>('/api/stats/timeseries', async (request) => {
    return deps.repo.getTimeseries({
      range: parseRange(request.query.range),
      model: request.query.model,
      search: request.query.search,
    });
  });
}
