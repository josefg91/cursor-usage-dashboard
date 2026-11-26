import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installHooks, mergeHooksConfig } from '../install-hooks.mjs';
import { parseHookPayload } from '../parser.mjs';
import { calculateTurnCost, normalizeModelKey, resolveModelRates } from '../pricing.mjs';
import { getDefaultStoragePaths, readBufferEvents, summarizeEventsByDate } from '../storage.mjs';
import { dispatchHookEvent, formatSummaryTable, handleHookEvent } from '../track-spend.mjs';

const tempDirs = [];

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-hooks-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parser.mjs', () => {
  it('extrae campos estándar y tokens anidados en usage', () => {
    const parsed = parseHookPayload(
      JSON.stringify({
        conversation_id: 'conv-123',
        model: 'claude-3.7-sonnet',
        response: 'Aquí tienes la solución.',
        usage: {
          input_tokens: 50_000,
          cache_read_tokens: 40_000,
          cache_write_tokens: 5_000,
          output_tokens: 1_200,
          reasoning_tokens: 300,
        },
      }),
      'afterAgentResponse',
    );

    expect(parsed.event_name).toBe('afterAgentResponse');
    expect(parsed.conversation_id).toBe('conv-123');
    expect(parsed.model).toBe('claude-3.7-sonnet');
    expect(parsed.input_tokens).toBe(50_000);
    expect(parsed.cache_read_tokens).toBe(40_000);
    expect(parsed.cache_write_tokens).toBe(5_000);
    expect(parsed.output_tokens).toBe(1_200);
    expect(parsed.reasoning_tokens).toBe(300);
    expect(parsed.raw_hook_json).toHaveProperty('conversation_id', 'conv-123');
  });

  it('maneja JSON corrupto defensivamente sin lanzar excepciones', () => {
    const parsed = parseHookPayload('{invalid-json', 'afterAgentResponse');
    expect(parsed.event_name).toBe('afterAgentResponse');
    expect(parsed.conversation_id).toBe('unknown-conversation');
    expect(parsed.input_tokens).toBe(0);
    expect(parsed.raw_hook_json).toHaveProperty('_unparsed_stdin');
  });
});

describe('pricing.mjs', () => {
  it('normaliza nombres de modelo con proveedor o sufijos encadenados de fecha/thinking/effort', () => {
    expect(normalizeModelKey('anthropic/claude-3.7-sonnet-20250219')).toBe('claude-3.7-sonnet');
    expect(normalizeModelKey('claude-3.7-sonnet-thinking')).toBe('claude-3.7-sonnet');
    expect(normalizeModelKey('claude-haiku-5-5-thinking-high')).toBe('claude-haiku-5.5');
    expect(normalizeModelKey('gpt-4o-2024-08-06')).toBe('gpt-4o');
    expect(normalizeModelKey('gemini-4-neon-medium')).toBe('gemini-4-neon');
    expect(normalizeModelKey('openai/gpt-4o')).toBe('gpt-4o');
  });

  it('calcula el coste USD evitando doble conteo de caché', () => {
    const { rates, matched } = resolveModelRates('claude-3.7-sonnet');
    expect(matched).toBe(true);

    const result = calculateTurnCost(
      {
        input_tokens: 100_000,
        cache_read_tokens: 80_000,
        cache_write_tokens: 10_000,
        output_tokens: 2_000,
      },
      rates,
    );

    expect(result.uncached_input_tokens).toBe(10_000);
    expect(result.cost_usd).toBeCloseTo(0.1215, 6);
  });

  it('aplica overrides locales por encima del catálogo por defecto y respeta tokenFeePer1m', () => {
    const { rates, matched } = resolveModelRates(
      'custom-enterprise-model',
      {
        'custom-enterprise-model': {
          input_per_1m: 1.0,
          cache_read_per_1m: 0.1,
          cache_write_per_1m: 1.25,
          output_per_1m: 5.0,
        },
      },
      { tokenFeePer1m: 0.25 },
    );
    expect(matched).toBe(true);
    expect(rates.output_per_1m).toBe(5.0);

    const neonWithFee = resolveModelRates('gemini-4-neon-medium', {}, { tokenFeePer1m: 0.25 });
    expect(neonWithFee.rates.input_per_1m).toBe(3.25);
    expect(neonWithFee.rates.cache_read_per_1m).toBe(0.4);

    const haikuWithFee = resolveModelRates('claude-haiku-5-5-high', {}, { tokenFeePer1m: 0.25 });
    expect(haikuWithFee.rates.cache_read_per_1m).toBe(0.01);
  });
});

describe('track-spend.mjs y storage.mjs', () => {
  it('correlaciona beforeSubmitPrompt con afterAgentResponse, guarda .jsonl y resume el día', () => {
    const tmpDir = createTempDir();
    const storagePaths = getDefaultStoragePaths(tmpDir);

    const t1 = '2026-11-26T10:00:00.000Z';
    const t2 = '2026-11-26T10:00:03.500Z';

    const r1 = handleHookEvent(
      JSON.stringify({
        conversation_id: 'conv-abc',
        prompt: 'Refactoriza el parser de hooks para soportar campos opcionales',
        timestamp: t1,
      }),
      { eventHint: 'beforeSubmitPrompt', storagePaths },
    );
    expect(r1.action).toBe('stored_pending');

    const r2 = handleHookEvent(
      JSON.stringify({
        conversation_id: 'conv-abc',
        model: 'claude-3.7-sonnet',
        response: 'Hecho, añadidos fallbacks defensivos.',
        input_tokens: 20_000,
        cache_read_tokens: 15_000,
        cache_write_tokens: 0,
        output_tokens: 1_000,
        timestamp: t2,
      }),
      { eventHint: 'afterAgentResponse', storagePaths },
    );

    expect(r2.action).toBe('recorded_event');
    expect(r2.record.prompt_text).toContain('Refactoriza el parser');
    expect(r2.record.duration_ms).toBe(3500);
    expect(r2.record.uncached_input_tokens).toBe(5_000);
    // 5k*3/1M = 0.015 + 15k*0.3/1M = 0.0045 + 1k*15/1M = 0.015 => 0.0345
    expect(r2.record.cost_usd).toBeCloseTo(0.0345, 6);

    const events = readBufferEvents(storagePaths.bufferPath);
    expect(events).toHaveLength(1);

    const summary = summarizeEventsByDate(events, '2026-11-26');
    expect(summary.turn_count).toBe(1);
    expect(summary.session_count).toBe(1);
    expect(summary.total_cost_usd).toBeCloseTo(0.0345, 6);
    expect(summary.cache_hit_rate_pct).toBe(75);
    expect(summary.by_model[0].model).toBe('claude-3.7-sonnet');

    const table = formatSummaryTable(summary);
    expect(table).toContain('claude-3.7-sonnet');
    expect(table).toContain('$0.0345');
  });

  it('dispatchHookEvent envía al backend si está disponible y hace fallback a .jsonl si falla', async () => {
    const tmpDir = createTempDir();
    const storagePaths = getDefaultStoragePaths(tmpDir);
    const payload = JSON.stringify({
      conversation_id: 'conv-dispatch',
      model: 'gpt-4o',
      input_tokens: 1_000,
      output_tokens: 500,
    });

    // Caso 1: backend responde 201 -> no escribe en buffer
    const okRes = await dispatchHookEvent(payload, {
      eventHint: 'afterAgentResponse',
      storagePaths,
      fetchFn: async () => new Response('{}', { status: 201 }),
    });
    expect(okRes.delivered).toBe('backend');
    expect(readBufferEvents(storagePaths.bufferPath)).toHaveLength(0);

    // Caso 2: backend caído -> fallback automático a .jsonl
    const failRes = await dispatchHookEvent(payload, {
      eventHint: 'afterAgentResponse',
      storagePaths,
      fetchFn: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(failRes.delivered).toBe('buffer');
    expect(readBufferEvents(storagePaths.bufferPath)).toHaveLength(1);
  });
});

describe('install-hooks.mjs', () => {
  it('preserva hooks existentes, es idempotente y desinstala limpiamente', () => {
    const tmpDir = createTempDir();
    const hooksFilePath = path.join(tmpDir, 'hooks.json');
    fs.writeFileSync(
      hooksFilePath,
      JSON.stringify({
        version: 1,
        hooks: {
          beforeSubmitPrompt: [{ command: 'echo existing-hook' }],
        },
      }),
    );

    const opts = {
      hooksFilePath,
      trackScriptPath: '/abs/path/apps/hooks/src/track-spend.mjs',
      nodeExecPath: '/usr/bin/node',
    };

    installHooks(opts);
    // Re-instalar no debe duplicar entradas
    const second = installHooks(opts);
    expect(second.config.hooks.beforeSubmitPrompt).toHaveLength(2);
    expect(second.config.hooks.afterAgentResponse).toHaveLength(1);
    expect(second.config.hooks.stop).toHaveLength(1);

    // Desinstalar conserva el hook existente del usuario
    const removed = installHooks({ ...opts, uninstall: true });
    expect(removed.config.hooks.beforeSubmitPrompt).toEqual([{ command: 'echo existing-hook' }]);
    expect(removed.config.hooks.afterAgentResponse).toBeUndefined();
    expect(removed.config.hooks.stop).toBeUndefined();
  });

  it('entrecomilla rutas con espacios en Windows', () => {
    const cfg = mergeHooksConfig(
      {},
      {
        nodeExecPath: 'C:\\Program Files\\nodejs\\node.exe',
        trackScriptPath: 'C:\\Users\\My User\\cursor-dashboard\\apps\\hooks\\src\\track-spend.mjs',
      },
    );
    expect(cfg.hooks.beforeSubmitPrompt[0].command).toBe(
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\My User\\cursor-dashboard\\apps\\hooks\\src\\track-spend.mjs" --event beforeSubmitPrompt',
    );
  });
});
