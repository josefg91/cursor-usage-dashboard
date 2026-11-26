import type { FastifyInstance } from 'fastify';
import { parseIsoTimestamp, parseTimeRange } from '../db/repository.js';
import { importCursorUsageCsv } from '../services/csvImportService.js';
import type { RouteDeps } from './health.js';

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function maintenanceRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  // RF-10: Importador de CSV de Cursor Usage
  app.post<{ Body: { csvText?: string } }>('/api/import/csv', async (request, reply) => {
    const csvText = request.body?.csvText;
    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Debes enviar el contenido del archivo CSV en el campo "csvText".',
      });
    }
    return importCursorUsageCsv(csvText, deps.repo);
  });

  // RF-13: Estadísticas de almacenamiento y purga de payloads antiguos
  app.get('/api/maintenance/storage', async () => {
    return deps.repo.getStorageStats(deps.dbPath, deps.payloadRetentionDays);
  });

  app.post<{ Body?: { retentionDays?: number } }>(
    '/api/maintenance/purge-payloads',
    async (request) => {
      const days = Number(request.body?.retentionDays ?? deps.payloadRetentionDays);
      return deps.repo.purgeOldPayloads(Number.isFinite(days) && days > 0 ? days : deps.payloadRetentionDays);
    },
  );

  // RF-14: Exportación de informes filtrados en CSV o JSON
  app.get<{
    Querystring: {
      format?: string;
      range?: string;
      from?: string;
      to?: string;
      model?: string;
      search?: string;
    };
  }>('/api/export', async (request, reply) => {
    const range = parseTimeRange(request.query.range, 'all');
    const from = parseIsoTimestamp(request.query.from);
    const to = parseIsoTimestamp(request.query.to);
    const format = request.query.format === 'csv' ? 'csv' : 'json';
    const events = deps.repo.exportEvents({
      range,
      from,
      to,
      model: request.query.model,
      search: request.query.search,
    });

    if (format === 'csv') {
      const columns = [
        'id',
        'conversation_id',
        'timestamp',
        'model',
        'input_tokens',
        'uncached_input_tokens',
        'cache_read_tokens',
        'cache_write_tokens',
        'output_tokens',
        'reasoning_tokens',
        'cost_usd',
        'cost_source',
        'duration_ms',
        'source',
        'prompt_preview',
      ] as const;

      const lines = [
        columns.join(','),
        ...events.map((ev) => columns.map((col) => escapeCsvCell(ev[col])).join(',')),
      ];

      reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="cursor-usage-${range}.csv"`);
      return lines.join('\n');
    }

    reply
      .header('content-type', 'application/json; charset=utf-8')
      .header('content-disposition', `attachment; filename="cursor-usage-${range}.json"`);
    return {
      exported_at: new Date().toISOString(),
      range,
      count: events.length,
      events,
    };
  });
}
