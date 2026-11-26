import fs from 'node:fs';
import zlib from 'node:zlib';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  calculateTurnCost,
  normalizeModelKey,
  type ModelBreakdownItem,
  type ModelPricing,
  type ModelRates,
  type PaginatedResponse,
  type PromptEvent,
  type PromptEventDetail,
  type PromptsViewMode,
  type PurgePayloadsResult,
  type SessionSummary,
  type StorageMaintenanceStats,
  type SummaryStats,
  type TimeRange,
  type TimeseriesBucket,
} from '@cursor-dashboard/shared';

export interface QueryFilters {
  range?: TimeRange;
  from?: string;
  to?: string;
  model?: string;
  search?: string;
}

export function parseTimeRange(range: string | undefined, fallback: TimeRange = 'today'): TimeRange {
  if (
    range === 'today' ||
    range === '7d' ||
    range === '30d' ||
    range === 'all' ||
    range === 'measurement'
  ) {
    return range;
  }
  return fallback;
}

export function parseIsoTimestamp(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

export interface ListPromptsParams extends QueryFilters {
  view?: PromptsViewMode;
  page?: number;
  limit?: number;
}

export interface PromptPayloadsInput {
  prompt_text?: string | null;
  response_text?: string | null;
  raw_hook_json?: unknown;
}

function gzipNullable(text: string | null | undefined): Buffer | null {
  if (!text) return null;
  return zlib.gzipSync(Buffer.from(text, 'utf-8'));
}

function gunzipNullable(blob: unknown): string | null {
  if (!blob) return null;
  if (blob instanceof Uint8Array) {
    return zlib.gunzipSync(blob).toString('utf-8');
  }
  return null;
}

function getRangeStartIso(range: TimeRange | undefined): string | null {
  if (!range || range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  if (range === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

function buildWhereClause(filters: QueryFilters): { clause: string; params: SQLInputValue[] } {
  const conditions: string[] = [];
  const params: SQLInputValue[] = [];

  if (filters.range === 'measurement') {
    if (!filters.from) {
      conditions.push('1 = 0');
    } else {
      conditions.push('timestamp >= ?');
      params.push(filters.from);
      if (filters.to) {
        conditions.push('timestamp <= ?');
        params.push(filters.to);
      }
    }
  } else {
    const startIso = filters.from ?? getRangeStartIso(filters.range);
    if (startIso) {
      conditions.push('timestamp >= ?');
      params.push(startIso);
    }
    if (filters.to) {
      conditions.push('timestamp <= ?');
      params.push(filters.to);
    }
  }

  if (filters.model && filters.model !== 'all') {
    conditions.push('model = ?');
    params.push(filters.model);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push('(prompt_preview LIKE ? OR model LIKE ? OR conversation_id LIKE ?)');
    params.push(pattern, pattern, pattern);
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

export class TelemetryRepository {
  constructor(private readonly db: DatabaseSync) {}

  insertEvent(event: PromptEvent, payloads: PromptPayloadsInput = {}): boolean {
    const insertEventStmt = this.db.prepare(`
      INSERT OR IGNORE INTO prompt_events (
        id, conversation_id, timestamp, model, prompt_preview,
        input_tokens, uncached_input_tokens, cache_read_tokens, cache_write_tokens,
        output_tokens, reasoning_tokens, cost_usd, cost_source, duration_ms, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayloadStmt = this.db.prepare(`
      INSERT OR IGNORE INTO prompt_payloads (
        event_id, prompt_text_gzip, response_text_gzip, raw_hook_json_gzip
      ) VALUES (?, ?, ?, ?)
    `);

    const rawJsonStr =
      payloads.raw_hook_json !== undefined && payloads.raw_hook_json !== null
        ? typeof payloads.raw_hook_json === 'string'
          ? payloads.raw_hook_json
          : JSON.stringify(payloads.raw_hook_json)
        : null;

    this.db.exec('BEGIN');
    try {
      const result = insertEventStmt.run(
        event.id,
        event.conversation_id,
        event.timestamp,
        event.model,
        event.prompt_preview,
        event.input_tokens,
        event.uncached_input_tokens,
        event.cache_read_tokens,
        event.cache_write_tokens,
        event.output_tokens,
        event.reasoning_tokens,
        event.cost_usd,
        event.cost_source,
        event.duration_ms,
        event.source,
      );

      const inserted = Number(result.changes) > 0;
      if (inserted) {
        insertPayloadStmt.run(
          event.id,
          gzipNullable(payloads.prompt_text),
          gzipNullable(payloads.response_text),
          gzipNullable(rawJsonStr),
        );
      }

      this.db.exec('COMMIT');
      return inserted;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getEventsCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM prompt_events').get() as
      | { count: number }
      | undefined;
    return Number(row?.count ?? 0);
  }

  getAvailableModels(): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT model FROM prompt_events ORDER BY model ASC')
      .all() as Array<{ model: string }>;
    return rows.map((r) => r.model);
  }

  getSummaryStats(filters: QueryFilters): SummaryStats {
    const { clause, params } = buildWhereClause(filters);
    const row = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS prompt_count,
          COUNT(DISTINCT conversation_id) AS session_count,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
          COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
          COALESCE(SUM(uncached_input_tokens), 0) AS total_uncached_input_tokens,
          COALESCE(SUM(cache_read_tokens), 0) AS total_cache_read_tokens,
          COALESCE(SUM(cache_write_tokens), 0) AS total_cache_write_tokens,
          COALESCE(SUM(output_tokens), 0) AS total_output_tokens
        FROM prompt_events
        ${clause}
      `,
      )
      .get(...params) as Record<string, number> | undefined;

    const promptCount = Number(row?.prompt_count ?? 0);
    const sessionCount = Number(row?.session_count ?? 0);
    const totalCostUsd = Number((row?.total_cost_usd ?? 0).toFixed(6));
    const totalInput = Number(row?.total_input_tokens ?? 0);
    const totalUncached = Number(row?.total_uncached_input_tokens ?? 0);
    const totalCacheRead = Number(row?.total_cache_read_tokens ?? 0);
    const totalCacheWrite = Number(row?.total_cache_write_tokens ?? 0);
    const totalOutput = Number(row?.total_output_tokens ?? 0);

    return {
      total_cost_usd: totalCostUsd,
      prompt_count: promptCount,
      session_count: sessionCount,
      avg_cost_per_prompt: promptCount > 0 ? Number((totalCostUsd / promptCount).toFixed(6)) : 0,
      avg_cost_per_session: sessionCount > 0 ? Number((totalCostUsd / sessionCount).toFixed(6)) : 0,
      total_input_tokens: totalInput,
      total_uncached_input_tokens: totalUncached,
      total_cache_read_tokens: totalCacheRead,
      total_cache_write_tokens: totalCacheWrite,
      total_output_tokens: totalOutput,
      input_output_ratio: totalOutput > 0 ? Number((totalInput / totalOutput).toFixed(2)) : 0,
      cache_hit_rate_pct:
        totalInput > 0 ? Number(((totalCacheRead / totalInput) * 100).toFixed(1)) : 0,
    };
  }

  getBreakdownByModel(filters: QueryFilters): ModelBreakdownItem[] {
    const { clause, params } = buildWhereClause(filters);
    const rows = this.db
      .prepare(
        `
        SELECT
          model,
          COUNT(*) AS prompt_count,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
          COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
          COALESCE(SUM(output_tokens), 0) AS total_output_tokens
        FROM prompt_events
        ${clause}
        GROUP BY model
        ORDER BY total_cost_usd DESC
      `,
      )
      .all(...params) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      model: String(r.model),
      prompt_count: Number(r.prompt_count ?? 0),
      total_cost_usd: Number(Number(r.total_cost_usd ?? 0).toFixed(6)),
      total_input_tokens: Number(r.total_input_tokens ?? 0),
      total_output_tokens: Number(r.total_output_tokens ?? 0),
    }));
  }

  getTimeseries(filters: QueryFilters): TimeseriesBucket[] {
    const { clause, params } = buildWhereClause(filters);
    let bucketExpr = 'substr(timestamp, 1, 10)';
    if (filters.range === 'today') {
      bucketExpr = "substr(timestamp, 1, 13) || ':00'";
    } else if (filters.range === 'measurement' && filters.from) {
      const startMs = Date.parse(filters.from);
      const endMs = filters.to ? Date.parse(filters.to) : Date.now();
      const spanMs = Math.max(0, endMs - startMs);
      if (spanMs <= 3 * 60 * 60 * 1000) {
        bucketExpr = 'substr(timestamp, 1, 16)';
      } else if (spanMs <= 48 * 60 * 60 * 1000) {
        bucketExpr = "substr(timestamp, 1, 13) || ':00'";
      }
    }

    const rows = this.db
      .prepare(
        `
        SELECT
          ${bucketExpr} AS bucket,
          model,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM prompt_events
        ${clause}
        GROUP BY bucket, model
        ORDER BY bucket ASC
      `,
      )
      .all(...params) as Array<{ bucket: string; model: string; cost_usd: number }>;

    const map = new Map<string, TimeseriesBucket>();
    for (const row of rows) {
      const existing = map.get(row.bucket) ?? {
        bucket: row.bucket,
        by_model: {},
        total_cost_usd: 0,
      };
      const cost = Number(Number(row.cost_usd).toFixed(6));
      existing.by_model[row.model] = Number(((existing.by_model[row.model] ?? 0) + cost).toFixed(6));
      existing.total_cost_usd = Number((existing.total_cost_usd + cost).toFixed(6));
      map.set(row.bucket, existing);
    }

    return Array.from(map.values());
  }

  listPrompts(params: ListPromptsParams): PaginatedResponse<PromptEvent | SessionSummary> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const offset = (page - 1) * limit;
    const { clause, params: whereParams } = buildWhereClause(params);
    const availableModels = this.getAvailableModels();

    if (params.view === 'sessions') {
      const countRow = this.db
        .prepare(`SELECT COUNT(DISTINCT conversation_id) AS total FROM prompt_events ${clause}`)
        .get(...whereParams) as { total: number } | undefined;

      const rows = this.db
        .prepare(
          `
          SELECT
            conversation_id,
            MIN(timestamp) AS started_at,
            MAX(timestamp) AS last_activity_at,
            COUNT(*) AS turn_count,
            GROUP_CONCAT(DISTINCT model) AS models_csv,
            MIN(prompt_preview) AS first_prompt_preview,
            COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
            COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
            COALESCE(SUM(cost_usd), 0) AS total_cost_usd
          FROM prompt_events
          ${clause}
          GROUP BY conversation_id
          ORDER BY last_activity_at DESC
          LIMIT ? OFFSET ?
        `,
        )
        .all(...whereParams, limit, offset) as Array<Record<string, unknown>>;

      const items: SessionSummary[] = rows.map((r) => ({
        conversation_id: String(r.conversation_id),
        started_at: String(r.started_at),
        last_activity_at: String(r.last_activity_at),
        turn_count: Number(r.turn_count ?? 0),
        models: String(r.models_csv ?? '')
          .split(',')
          .filter(Boolean),
        first_prompt_preview: String(r.first_prompt_preview ?? ''),
        total_input_tokens: Number(r.total_input_tokens ?? 0),
        total_output_tokens: Number(r.total_output_tokens ?? 0),
        total_cost_usd: Number(Number(r.total_cost_usd ?? 0).toFixed(6)),
      }));

      return {
        items,
        total: Number(countRow?.total ?? 0),
        page,
        limit,
        available_models: availableModels,
      };
    }

    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM prompt_events ${clause}`)
      .get(...whereParams) as { total: number } | undefined;

    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM prompt_events
        ${clause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(...whereParams, limit, offset) as Array<Record<string, unknown>>;

    const items: PromptEvent[] = rows.map((r) => ({
      id: String(r.id),
      conversation_id: String(r.conversation_id),
      timestamp: String(r.timestamp),
      model: String(r.model),
      prompt_preview: String(r.prompt_preview ?? ''),
      input_tokens: Number(r.input_tokens ?? 0),
      uncached_input_tokens: Number(r.uncached_input_tokens ?? 0),
      cache_read_tokens: Number(r.cache_read_tokens ?? 0),
      cache_write_tokens: Number(r.cache_write_tokens ?? 0),
      output_tokens: Number(r.output_tokens ?? 0),
      reasoning_tokens: Number(r.reasoning_tokens ?? 0),
      cost_usd: Number(r.cost_usd ?? 0),
      cost_source: String(r.cost_source) as PromptEvent['cost_source'],
      duration_ms: r.duration_ms === null || r.duration_ms === undefined ? null : Number(r.duration_ms),
      source: String(r.source) as PromptEvent['source'],
    }));

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page,
      limit,
      available_models: availableModels,
    };
  }

  getPromptDetail(id: string): PromptEventDetail | null {
    const row = this.db
      .prepare(
        `
        SELECT
          e.*,
          p.prompt_text_gzip,
          p.response_text_gzip,
          p.raw_hook_json_gzip
        FROM prompt_events e
        LEFT JOIN prompt_payloads p ON p.event_id = e.id
        WHERE e.id = ?
      `,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: String(row.id),
      conversation_id: String(row.conversation_id),
      timestamp: String(row.timestamp),
      model: String(row.model),
      prompt_preview: String(row.prompt_preview ?? ''),
      input_tokens: Number(row.input_tokens ?? 0),
      uncached_input_tokens: Number(row.uncached_input_tokens ?? 0),
      cache_read_tokens: Number(row.cache_read_tokens ?? 0),
      cache_write_tokens: Number(row.cache_write_tokens ?? 0),
      output_tokens: Number(row.output_tokens ?? 0),
      reasoning_tokens: Number(row.reasoning_tokens ?? 0),
      cost_usd: Number(row.cost_usd ?? 0),
      cost_source: String(row.cost_source) as PromptEvent['cost_source'],
      duration_ms:
        row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
      source: String(row.source) as PromptEvent['source'],
      prompt_text: gunzipNullable(row.prompt_text_gzip),
      response_text: gunzipNullable(row.response_text_gzip),
      raw_hook_json: gunzipNullable(row.raw_hook_json_gzip),
    };
  }

  upsertPricingBatch(items: ModelPricing[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO model_pricing (
        model_key, input_per_1m, cache_read_per_1m, cache_write_per_1m, output_per_1m, updated_at, is_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(model_key) DO UPDATE SET
        input_per_1m = excluded.input_per_1m,
        cache_read_per_1m = excluded.cache_read_per_1m,
        cache_write_per_1m = excluded.cache_write_per_1m,
        output_per_1m = excluded.output_per_1m,
        updated_at = excluded.updated_at,
        is_override = excluded.is_override
    `);

    this.db.exec('BEGIN');
    try {
      for (const item of items) {
        stmt.run(
          item.model_key,
          item.input_per_1m,
          item.cache_read_per_1m,
          item.cache_write_per_1m,
          item.output_per_1m,
          item.updated_at,
          item.is_override ? 1 : 0,
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getAllPricing(): ModelPricing[] {
    const rows = this.db
      .prepare('SELECT * FROM model_pricing ORDER BY is_override DESC, model_key ASC')
      .all() as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      model_key: String(r.model_key),
      input_per_1m: Number(r.input_per_1m),
      cache_read_per_1m: Number(r.cache_read_per_1m),
      cache_write_per_1m: Number(r.cache_write_per_1m),
      output_per_1m: Number(r.output_per_1m),
      updated_at: String(r.updated_at),
      is_override: Boolean(r.is_override),
    }));
  }

  getLatestRemotePricingTimestamp(): string | null {
    const row = this.db
      .prepare('SELECT MAX(updated_at) AS latest FROM model_pricing WHERE is_override = 0')
      .get() as { latest: string | null } | undefined;
    return row?.latest ?? null;
  }

  /**
   * Busca un evento de cursor_hook en ventana temporal cercana para conciliar su coste real desde CSV.
   */
  findReconciliationCandidate(
    isoTimestamp: string,
    normalizedModel: string,
    windowMs: number,
  ): string | null {
    const targetMs = Date.parse(isoTimestamp);
    if (!Number.isFinite(targetMs)) return null;
    const minIso = new Date(targetMs - windowMs).toISOString();
    const maxIso = new Date(targetMs + windowMs).toISOString();

    const rows = this.db
      .prepare(
        `
        SELECT id, model, timestamp
        FROM prompt_events
        WHERE source = 'cursor_hook'
          AND cost_source = 'calculated'
          AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `,
      )
      .all(minIso, maxIso) as Array<{ id: string; model: string; timestamp: string }>;

    let bestId: string | null = null;
    let bestDiff = Infinity;
    for (const row of rows) {
      if (normalizeModelKey(row.model) !== normalizedModel) continue;
      const diff = Math.abs(Date.parse(row.timestamp) - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestId = row.id;
      }
    }
    return bestId;
  }

  reconcileEventCost(eventId: string, costUsd: number): void {
    this.db
      .prepare("UPDATE prompt_events SET cost_usd = ?, cost_source = 'csv_reconciled' WHERE id = ?")
      .run(costUsd, eventId);
  }

  /**
   * Recalcula el coste de eventos con `cost_source = 'calculated'` usando las tarifas actuales
   * (nunca modifica eventos ya conciliados por CSV o Admin API).
   */
  recalculateCalculatedEvents(
    resolveRatesFn: (model: string) => { rates: ModelRates; matched: boolean },
  ): { updated: number } {
    const rows = this.db
      .prepare(
        `
        SELECT id, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd
        FROM prompt_events
        WHERE cost_source = 'calculated'
      `,
      )
      .all() as Array<{
      id: string;
      model: string;
      input_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
      output_tokens: number;
      cost_usd: number;
    }>;

    const updateStmt = this.db.prepare(
      'UPDATE prompt_events SET uncached_input_tokens = ?, cost_usd = ? WHERE id = ?',
    );

    let updated = 0;
    this.db.exec('BEGIN');
    try {
      for (const row of rows) {
        const { rates, matched } = resolveRatesFn(row.model);
        if (!matched) continue;
        const { uncached_input_tokens, cost_usd } = calculateTurnCost(
          {
            input_tokens: row.input_tokens,
            cache_read_tokens: row.cache_read_tokens,
            cache_write_tokens: row.cache_write_tokens,
            output_tokens: row.output_tokens,
          },
          rates,
        );
        if (Math.abs(cost_usd - row.cost_usd) > 1e-7) {
          updateStmt.run(uncached_input_tokens, cost_usd, row.id);
          updated += 1;
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return { updated };
  }

  exportEvents(filters: QueryFilters): PromptEvent[] {
    const { clause, params } = buildWhereClause(filters);
    const rows = this.db
      .prepare(`SELECT * FROM prompt_events ${clause} ORDER BY timestamp DESC`)
      .all(...params) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      conversation_id: String(r.conversation_id),
      timestamp: String(r.timestamp),
      model: String(r.model),
      prompt_preview: String(r.prompt_preview ?? ''),
      input_tokens: Number(r.input_tokens ?? 0),
      uncached_input_tokens: Number(r.uncached_input_tokens ?? 0),
      cache_read_tokens: Number(r.cache_read_tokens ?? 0),
      cache_write_tokens: Number(r.cache_write_tokens ?? 0),
      output_tokens: Number(r.output_tokens ?? 0),
      reasoning_tokens: Number(r.reasoning_tokens ?? 0),
      cost_usd: Number(r.cost_usd ?? 0),
      cost_source: String(r.cost_source) as PromptEvent['cost_source'],
      duration_ms:
        r.duration_ms === null || r.duration_ms === undefined ? null : Number(r.duration_ms),
      source: String(r.source) as PromptEvent['source'],
    }));
  }

  purgeOldPayloads(retentionDays: number): PurgePayloadsResult {
    const safeDays = Math.max(1, Math.floor(retentionDays));
    const cutoffIso = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    const res = this.db
      .prepare(
        `
        DELETE FROM prompt_payloads
        WHERE event_id IN (
          SELECT id FROM prompt_events WHERE timestamp < ?
        )
      `,
      )
      .run(cutoffIso);

    return {
      purged_count: Number(res.changes ?? 0),
      retention_days: safeDays,
      cutoff_iso: cutoffIso,
    };
  }

  getStorageStats(dbPath: string, retentionDays: number): StorageMaintenanceStats {
    const eventsRow = this.db.prepare('SELECT COUNT(*) AS count FROM prompt_events').get() as
      | { count: number }
      | undefined;
    const payloadsRow = this.db.prepare('SELECT COUNT(*) AS count FROM prompt_payloads').get() as
      | { count: number }
      | undefined;

    let dbSizeBytes = 0;
    if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        dbSizeBytes = fs.statSync(dbPath).size;
      } catch {
        dbSizeBytes = 0;
      }
    }

    return {
      events_count: Number(eventsRow?.count ?? 0),
      payloads_count: Number(payloadsRow?.count ?? 0),
      db_size_bytes: dbSizeBytes,
      retention_days: retentionDays,
    };
  }
}
