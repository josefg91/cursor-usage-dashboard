import type { FastifyInstance } from 'fastify';
import type { TimeRange } from '@cursor-dashboard/shared';
import { parseIsoTimestamp, parseTimeRange } from '../db/repository.js';
import type { RouteDeps } from './health.js';

interface StatsQuerystring {
  range?: TimeRange;
  from?: string;
  to?: string;
  model?: string;
  search?: string;
}

export async function statsRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get<{ Querystring: StatsQuerystring }>('/api/stats/summary', async (request) => {
    return deps.repo.getSummaryStats({
      range: parseTimeRange(request.query.range, 'today'),
      from: parseIsoTimestamp(request.query.from),
      to: parseIsoTimestamp(request.query.to),
      model: request.query.model,
      search: request.query.search,
    });
  });

  app.get<{ Querystring: StatsQuerystring }>('/api/stats/by-model', async (request) => {
    return deps.repo.getBreakdownByModel({
      range: parseTimeRange(request.query.range, 'today'),
      from: parseIsoTimestamp(request.query.from),
      to: parseIsoTimestamp(request.query.to),
      model: request.query.model,
      search: request.query.search,
    });
  });

  app.get<{ Querystring: StatsQuerystring }>('/api/stats/timeseries', async (request) => {
    return deps.repo.getTimeseries({
      range: parseTimeRange(request.query.range, 'today'),
      from: parseIsoTimestamp(request.query.from),
      to: parseIsoTimestamp(request.query.to),
      model: request.query.model,
      search: request.query.search,
    });
  });
}
