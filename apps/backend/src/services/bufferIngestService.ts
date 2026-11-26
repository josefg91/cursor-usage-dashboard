import crypto from 'node:crypto';
import fs from 'node:fs';
import { calculateTurnCost, type IngestEventDto, type PromptEvent } from '@cursor-dashboard/shared';
import type { TelemetryRepository } from '../db/repository.js';
import type { PricingService } from './pricingService.js';

export function buildAndPersistEvent(
  dto: IngestEventDto,
  repo: TelemetryRepository,
  pricingService: PricingService,
): { event: PromptEvent; inserted: boolean } {
  const rawHook =
    dto.raw_hook_json && typeof dto.raw_hook_json === 'object'
      ? (dto.raw_hook_json as Record<string, unknown>)
      : null;

  const model = dto.model?.trim() || 'unknown';
  const modelForPricing =
    typeof rawHook?.model_id === 'string' && rawHook.model_id.length > 0 ? rawHook.model_id : model;

  const inputTokens = Math.max(0, Math.floor(Number(dto.input_tokens) || 0));
  const cacheReadTokens = Math.max(0, Math.floor(Number(dto.cache_read_tokens) || 0));
  const cacheWriteTokens = Math.max(0, Math.floor(Number(dto.cache_write_tokens) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(dto.output_tokens) || 0));
  const reasoningTokens = Math.max(0, Math.floor(Number(dto.reasoning_tokens) || 0));

  const { rates } = pricingService.getRates(modelForPricing);
  const { uncached_input_tokens, cost_usd } = calculateTurnCost(
    {
      input_tokens: inputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      output_tokens: outputTokens,
      reasoning_tokens: reasoningTokens,
    },
    rates,
  );

  const promptText = dto.prompt_text ?? '';
  const event: PromptEvent = {
    id: dto.id && dto.id.trim().length > 0 ? dto.id.trim() : crypto.randomUUID(),
    conversation_id: dto.conversation_id?.trim() || 'unknown-conversation',
    timestamp: dto.timestamp || new Date().toISOString(),
    model,
    prompt_preview: promptText.slice(0, 500),
    input_tokens: inputTokens,
    uncached_input_tokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    cost_usd,
    cost_source: 'calculated',
    duration_ms:
      dto.duration_ms === null || dto.duration_ms === undefined
        ? null
        : Math.max(0, Math.floor(Number(dto.duration_ms) || 0)),
    source: dto.source ?? 'cursor_hook',
  };

  const inserted = repo.insertEvent(event, {
    prompt_text: promptText || null,
    response_text: dto.response_text ?? null,
    raw_hook_json: dto.raw_hook_json ?? null,
  });

  return { event, inserted };
}

/**
 * Ingiere de forma idempotente (deduplicando por id) los eventos acumulados en ~/.cursor/spend-buffer.jsonl
 * cuando el backend estuvo apagado.
 */
export function ingestBufferFile(
  bufferPath: string,
  repo: TelemetryRepository,
  pricingService: PricingService,
): { processed: number; inserted: number } {
  if (!bufferPath || !fs.existsSync(bufferPath)) {
    return { processed: 0, inserted: 0 };
  }

  const raw = fs.readFileSync(bufferPath, 'utf-8');
  let processed = 0;
  let inserted = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const dto = JSON.parse(trimmed) as IngestEventDto;
      processed += 1;
      const res = buildAndPersistEvent(dto, repo, pricingService);
      if (res.inserted) inserted += 1;
    } catch {
      // Saltar líneas corruptas sin detener la ingesta
    }
  }

  return { processed, inserted };
}
