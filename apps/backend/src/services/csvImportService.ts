import crypto from 'node:crypto';
import { normalizeModelKey, type CsvImportResult, type PromptEvent } from '@cursor-dashboard/shared';
import type { TelemetryRepository } from '../db/repository.js';

/**
 * Parser CSV RFC-4180 ligero sin dependencias externas.
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const clean = csvText.replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function pickColumn(record: Record<string, string>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    if (record[key] !== undefined && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

/**
 * Importa el CSV exportado desde cursor.com/dashboard > Usage.
 * - Si encuentra un evento de cursor_hook en ventana de ±3 min y mismo modelo normalizado,
 *   concilia su coste real (`cost_source = 'csv_reconciled'`).
 * - Si no existe (ej. subagente o sesión sin hook), lo inserta con `source = 'csv_import'`.
 */
export function importCursorUsageCsv(csvText: string, repo: TelemetryRepository): CsvImportResult {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { total_rows: 0, reconciled: 0, inserted: 0, skipped: 0 };
  }

  const headers = rows[0]!.map(normalizeHeader);
  let reconciled = 0;
  let inserted = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]!;
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cells[idx] ?? '';
    });

    const rawDate = pickColumn(rec, ['date', 'timestamp', 'created_at', 'time']);
    const model = pickColumn(rec, ['model', 'model_name', 'model_id']);
    if (!rawDate || !model) {
      skipped += 1;
      continue;
    }

    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) {
      skipped += 1;
      continue;
    }
    const isoTimestamp = parsedDate.toISOString();

    const inputWithCacheWrite = Math.floor(
      parseNumber(
        pickColumn(rec, [
          'input_w_cache_write',
          'input_tokens',
          'input',
          'prompt_tokens',
        ]),
      ),
    );
    const inputNoCacheWrite = Math.floor(
      parseNumber(pickColumn(rec, ['input_w_o_cache_write', 'uncached_input_tokens'])),
    );
    const cacheRead = Math.floor(
      parseNumber(pickColumn(rec, ['cache_read', 'cache_read_tokens', 'cached_tokens'])),
    );
    const outputTokens = Math.floor(
      parseNumber(pickColumn(rec, ['output_tokens', 'output', 'completion_tokens'])),
    );

    const cacheWrite = Math.max(0, inputWithCacheWrite - inputNoCacheWrite);
    const totalInput =
      inputWithCacheWrite > 0
        ? inputWithCacheWrite + cacheRead
        : inputNoCacheWrite + cacheRead;
    const uncachedInput = Math.max(0, totalInput - cacheRead - cacheWrite);

    const rawCents = pickColumn(rec, ['chargedcents', 'charged_cents', 'cost_cents']);
    const rawUsd = pickColumn(rec, ['cost', 'cost_usd', 'total_cost', 'cost_in_usd']);
    const costUsd = rawCents
      ? Number((parseNumber(rawCents) / 100).toFixed(6))
      : Number(parseNumber(rawUsd).toFixed(6));

    // Intentar conciliar con evento existente de cursor_hook (±3 minutos + mismo modelo normalizado)
    const normalizedCsvModel = normalizeModelKey(model);
    const matchedId = repo.findReconciliationCandidate(isoTimestamp, normalizedCsvModel, 180_000);
    if (matchedId) {
      repo.reconcileEventCost(matchedId, costUsd);
      reconciled += 1;
      continue;
    }

    const deterministicId = `csv-${crypto
      .createHash('sha256')
      .update(`${isoTimestamp}|${model}|${totalInput}|${outputTokens}|${costUsd}`)
      .digest('hex')
      .slice(0, 24)}`;

    const kind = pickColumn(rec, ['kind', 'type']) || 'Cursor Usage CSV';
    const event: PromptEvent = {
      id: deterministicId,
      conversation_id: `csv-${isoTimestamp.slice(0, 10)}`,
      timestamp: isoTimestamp,
      model,
      prompt_preview: `[${kind}] Importado desde CSV de Cursor Usage`,
      input_tokens: totalInput,
      uncached_input_tokens: uncachedInput,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      output_tokens: outputTokens,
      reasoning_tokens: 0,
      cost_usd: costUsd,
      cost_source: 'csv_reconciled',
      duration_ms: null,
      source: 'csv_import',
    };

    const wasInserted = repo.insertEvent(event, {
      raw_hook_json: rec,
    });
    if (wasInserted) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    total_rows: rows.length - 1,
    reconciled,
    inserted,
    skipped,
  };
}
