import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { initDatabase } from '../db/index.js';
import { ingestBufferFile } from '../services/bufferIngestService.js';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-backend-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Backend API + SQLite + PricingService', () => {
  it('ingiere eventos, comprime payloads en gzip, calcula costes y responde en /api/stats y /api/prompts', async () => {
    const tmpDir = createTempDir();
    const db = initDatabase(':memory:');
    const { app } = await buildApp({
      db,
      overridesPath: path.join(tmpDir, 'pricing-overrides.json'),
      pricingCacheTtlHours: 24,
      bufferPath: path.join(tmpDir, 'spend-buffer.jsonl'),
    });

    try {
      const nowIso = new Date().toISOString();

      // 1. POST /api/events
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          id: 'evt-1',
          conversation_id: 'conv-1',
          timestamp: nowIso,
          model: 'claude-3.7-sonnet',
          prompt_text: 'Explica cómo funciona el modo WAL de SQLite en detalle',
          response_text: 'WAL escribe cambios en un log separado para mejorar concurrencia.',
          input_tokens: 100_000,
          cache_read_tokens: 80_000,
          cache_write_tokens: 10_000,
          output_tokens: 2_000,
          duration_ms: 4200,
          raw_hook_json: { cursor_version: '3.29.9' },
        },
      });

      expect(postRes.statusCode).toBe(201);
      const created = postRes.json();
      expect(created.inserted).toBe(true);
      expect(created.event.uncached_input_tokens).toBe(10_000);
      expect(created.event.cost_usd).toBeCloseTo(0.1215, 6);

      // Idempotencia: reenviar mismo id no duplica
      const dupRes = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          id: 'evt-1',
          conversation_id: 'conv-1',
          timestamp: nowIso,
          model: 'claude-3.7-sonnet',
          input_tokens: 100_000,
          output_tokens: 2_000,
        },
      });
      expect(dupRes.statusCode).toBe(200);
      expect(dupRes.json().inserted).toBe(false);

      // 2. GET /api/health
      const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.json().db_events_count).toBe(1);

      // 3. GET /api/stats/summary
      const summaryRes = await app.inject({ method: 'GET', url: '/api/stats/summary?range=today' });
      expect(summaryRes.statusCode).toBe(200);
      const summary = summaryRes.json();
      expect(summary.prompt_count).toBe(1);
      expect(summary.session_count).toBe(1);
      expect(summary.total_cost_usd).toBeCloseTo(0.1215, 6);
      expect(summary.cache_hit_rate_pct).toBe(80);
      expect(summary.input_output_ratio).toBe(50);

      // 4. GET /api/stats/by-model & /api/stats/timeseries
      const byModelRes = await app.inject({ method: 'GET', url: '/api/stats/by-model?range=today' });
      expect(byModelRes.statusCode).toBe(200);
      expect(byModelRes.json()).toHaveLength(1);
      expect(byModelRes.json()[0].model).toBe('claude-3.7-sonnet');

      const tsRes = await app.inject({ method: 'GET', url: '/api/stats/timeseries?range=today' });
      expect(tsRes.statusCode).toBe(200);
      expect(tsRes.json()).toHaveLength(1);

      // 5. GET /api/prompts (turns & sessions)
      const turnsRes = await app.inject({ method: 'GET', url: '/api/prompts?range=today&view=turns' });
      expect(turnsRes.statusCode).toBe(200);
      expect(turnsRes.json().total).toBe(1);

      const sessionsRes = await app.inject({
        method: 'GET',
        url: '/api/prompts?range=today&view=sessions',
      });
      expect(sessionsRes.statusCode).toBe(200);
      expect(sessionsRes.json().items[0].conversation_id).toBe('conv-1');
      expect(sessionsRes.json().items[0].turn_count).toBe(1);

      // 6. GET /api/prompts/:id (descompresión gzip)
      const detailRes = await app.inject({ method: 'GET', url: '/api/prompts/evt-1' });
      expect(detailRes.statusCode).toBe(200);
      const detail = detailRes.json();
      expect(detail.prompt_text).toContain('modo WAL de SQLite');
      expect(detail.response_text).toContain('log separado');
      expect(JSON.parse(detail.raw_hook_json)).toEqual({ cursor_version: '3.29.9' });
    } finally {
      await app.close();
    }
  });

  it('refresca catálogo desde OpenRouter mock y soporta ingesta idempotente desde spend-buffer.jsonl', async () => {
    const tmpDir = createTempDir();
    const bufferPath = path.join(tmpDir, 'spend-buffer.jsonl');
    fs.writeFileSync(
      bufferPath,
      `${JSON.stringify({
        id: 'buf-1',
        conversation_id: 'conv-buf',
        timestamp: new Date().toISOString(),
        model: 'acme/super-model',
        prompt_text: 'Hola desde buffer offline',
        input_tokens: 10_000,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        output_tokens: 1_000,
      })}\n`,
    );

    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'acme/super-model',
              pricing: {
                prompt: '0.000002',
                completion: '0.00001',
                input_cache_read: '0.0000002',
                input_cache_write: '0.0000025',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    const db = initDatabase(':memory:');
    const { app, repo, pricingService } = await buildApp({
      db,
      overridesPath: path.join(tmpDir, 'pricing-overrides.json'),
      pricingCacheTtlHours: 24,
      bufferPath,
      fetchFn: mockFetch,
    });

    try {
      const refresh = await pricingService.refreshCatalog();
      expect(refresh.source).toBe('openrouter');
      expect(refresh.count).toBe(1);

      const firstIngest = ingestBufferFile(bufferPath, repo, pricingService);
      expect(firstIngest).toEqual({ processed: 1, inserted: 1 });

      const secondIngest = ingestBufferFile(bufferPath, repo, pricingService);
      expect(secondIngest).toEqual({ processed: 1, inserted: 0 });

      const detail = repo.getPromptDetail('buf-1');
      // 10k * 2 / 1M = 0.02 + 1k * 10 / 1M = 0.01 => 0.03
      expect(detail?.cost_usd).toBeCloseTo(0.03, 6);
    } finally {
      await app.close();
    }
  });
});
