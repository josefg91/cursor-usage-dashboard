#!/usr/bin/env node
/**
 * Cursor Hook ligero (ESM sin dependencias externas).
 * - Eventos: beforeSubmitPrompt, afterAgentResponse, stop (vía stdin JSON)
 * - Calcula coste en USD evitando doble conteo de caché
 * - Guarda en ~/.cursor/spend-buffer.jsonl (y en Fase 2 enviará al backend local con fallback)
 * - CLI rápido: `node src/track-spend.mjs --today [--date YYYY-MM-DD] [--json]`
 */

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHookPayload } from './parser.mjs';
import {
  calculateTurnCost,
  getDefaultOverridePaths,
  loadPricingOverrides,
  resolveModelRates,
} from './pricing.mjs';
import {
  appendEventToBuffer,
  consumePendingPrompt,
  getDefaultStoragePaths,
  readBufferEvents,
  savePendingPrompt,
  summarizeEventsByDate,
  toLocalDateKey,
} from './storage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3001';
const BACKEND_TIMEOUT_MS = 450;

export async function postEventToBackend(
  record,
  {
    backendUrl = process.env.CURSOR_DASHBOARD_API_URL || DEFAULT_BACKEND_URL,
    timeoutMs = BACKEND_TIMEOUT_MS,
    fetchFn = fetch,
  } = {},
) {
  try {
    const res = await fetchFn(`${backendUrl.replace(/\/$/, '')}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchTodayEventsFromBackend(
  backendUrl = process.env.CURSOR_DASHBOARD_API_URL || DEFAULT_BACKEND_URL,
) {
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/prompts?range=today&limit=200`, {
      signal: AbortSignal.timeout(350),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : null;
  } catch {
    return null;
  }
}

function parseCliArgs(argv) {
  const options = {
    today: false,
    prompts: false,
    json: false,
    date: null,
    limit: 20,
    event: '',
    bufferDir: process.env.CURSOR_DASHBOARD_DATA_DIR || null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--today') {
      options.today = true;
    } else if (arg === '--prompts') {
      options.prompts = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--event' && argv[i + 1]) {
      options.event = argv[i + 1];
      i += 1;
    } else if (arg === '--date' && argv[i + 1]) {
      options.date = argv[i + 1];
      i += 1;
    } else if (arg === '--limit' && argv[i + 1]) {
      const parsedLimit = Number(argv[i + 1]);
      if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        options.limit = Math.floor(parsedLimit);
      }
      i += 1;
    } else if (arg === '--buffer-dir' && argv[i + 1]) {
      options.bufferDir = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

function readStdinSyncSafe() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    const timer = setTimeout(() => resolve(data), 400);
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function formatUsd(amount) {
  return `$${Number(amount || 0).toFixed(4)}`;
}

function formatInt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatDuration(durationMs) {
  if (durationMs === null || durationMs === undefined || !Number.isFinite(Number(durationMs))) {
    return '-';
  }
  return `${(Number(durationMs) / 1000).toFixed(2)}s`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return String(timestamp || '-');
  return d.toLocaleTimeString('es-ES', { hour12: false });
}

function extractWorkspaceName(ev) {
  const roots = ev?.raw_hook_json?.workspace_roots;
  if (Array.isArray(roots) && roots.length > 0 && typeof roots[0] === 'string') {
    return path.basename(roots[0]) || roots[0];
  }
  return '-';
}

function extractModelParams(ev) {
  const params = ev?.raw_hook_json?.model_params;
  if (!Array.isArray(params) || params.length === 0) return '';
  return params
    .filter((p) => p && p.id && p.value !== undefined)
    .map((p) => `${p.id}=${p.value}`)
    .join(', ');
}

/**
 * Recalcula coste al vuelo si un evento guardado previamente tenía cost_usd = 0
 * (por ejemplo, cuando se añade una tarifa nueva al catálogo).
 */
export function enrichEventsWithPricing(events, overrides = {}) {
  return events.map((ev) => {
    if (Number(ev.cost_usd) > 0) return ev;
    const modelForRates = ev?.raw_hook_json?.model_id || ev.model;
    const { rates, matched } = resolveModelRates(modelForRates, overrides);
    if (!matched) return ev;
    const { uncached_input_tokens, cost_usd } = calculateTurnCost(
      {
        input_tokens: ev.input_tokens,
        cache_read_tokens: ev.cache_read_tokens,
        cache_write_tokens: ev.cache_write_tokens,
        output_tokens: ev.output_tokens,
      },
      rates,
    );
    return {
      ...ev,
      uncached_input_tokens,
      cost_usd,
    };
  });
}

export function formatPromptsList(events, limit = 20) {
  const lines = [];
  if (events.length === 0) {
    lines.push('No hay prompts registrados para esta fecha.');
    return lines.join('\n');
  }

  const slice = events.slice(-limit).reverse();
  lines.push(`Prompts capturados (mostrando ${slice.length} de ${events.length}, más recientes primero):`);
  lines.push('─'.repeat(72));

  for (const [idx, ev] of slice.entries()) {
    const promptSingleLine = (ev.prompt_text || ev.prompt_preview || '(sin texto)')
      .replace(/\s+/g, ' ')
      .trim();
    const truncatedPrompt =
      promptSingleLine.length > 140 ? `${promptSingleLine.slice(0, 137)}...` : promptSingleLine;

    const input = Number(ev.input_tokens) || 0;
    const uncached = Number(ev.uncached_input_tokens) || 0;
    const cacheRead = Number(ev.cache_read_tokens) || 0;
    const cacheWrite = Number(ev.cache_write_tokens) || 0;
    const output = Number(ev.output_tokens) || 0;
    const ratio = output > 0 ? `${Math.round(input / output)}:1` : '-';
    const cachePct = input > 0 ? `${((cacheRead / input) * 100).toFixed(1)}%` : '0%';
    const paramsStr = extractModelParams(ev);
    const workspace = extractWorkspaceName(ev);

    lines.push(
      `#${idx + 1} [${formatTime(ev.timestamp)}] ${ev.model || 'unknown'} | ${formatUsd(ev.cost_usd)} | ${formatDuration(ev.duration_ms)} | repo: ${workspace}`,
    );
    if (paramsStr) {
      lines.push(`    Params: ${paramsStr}`);
    }
    lines.push(
      `    Tokens: in=${formatInt(input)} (nuevos=${formatInt(uncached)}, cache_read=${formatInt(cacheRead)} [${cachePct}], cache_write=${formatInt(cacheWrite)}) | out=${formatInt(output)} | ratio=${ratio}`,
    );
    lines.push(`    Prompt: "${truncatedPrompt}"`);
    if (idx < slice.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function formatSummaryTable(summary, dayEvents = []) {
  const lines = [];
  lines.push(`Cursor Prompt Cost Dashboard — Gasto del ${summary.date}`);
  lines.push('─'.repeat(72));
  lines.push(
    `Total: ${formatUsd(summary.total_cost_usd)} | Turnos: ${summary.turn_count} | Sesiones: ${summary.session_count} | Caché: ${summary.cache_hit_rate_pct}%`,
  );
  lines.push(
    `Tokens: entrada ${formatInt(summary.total_input_tokens)} (sin caché ${formatInt(summary.total_uncached_input_tokens)}, caché lectura ${formatInt(summary.total_cache_read_tokens)}, caché escritura ${formatInt(summary.total_cache_write_tokens)}) | salida ${formatInt(summary.total_output_tokens)}`,
  );

  if (summary.by_model.length === 0) {
    lines.push('');
    lines.push('No hay eventos registrados para esta fecha.');
    return lines.join('\n');
  }

  lines.push('');
  const header = [
    'Modelo'.padEnd(32),
    'Turnos'.padStart(7),
    'Entrada'.padStart(10),
    'Salida'.padStart(9),
    'Coste USD'.padStart(11),
  ].join(' ');
  lines.push(header);
  lines.push('─'.repeat(header.length));

  for (const row of summary.by_model) {
    lines.push(
      [
        row.model.slice(0, 32).padEnd(32),
        String(row.turns).padStart(7),
        formatInt(row.input_tokens).padStart(10),
        formatInt(row.output_tokens).padStart(9),
        formatUsd(row.cost_usd).padStart(11),
      ].join(' '),
    );
  }

  if (dayEvents.length > 0) {
    lines.push('');
    lines.push(formatPromptsList(dayEvents));
  }

  return lines.join('\n');
}

/**
 * Procesa un evento de Cursor Hook (síncrono, escribe directamente al buffer local).
 */
export function handleHookEvent(
  rawStdin,
  { eventHint = '', storagePaths, overridePaths = [], skipBufferWrite = false },
) {
  const parsed = parseHookPayload(rawStdin, eventHint);
  const eventType = parsed.event_name;

  if (eventType === 'beforeSubmitPrompt') {
    savePendingPrompt(storagePaths.pendingPath, parsed.conversation_id, {
      prompt_text: parsed.prompt_text,
      model: parsed.model !== 'unknown' ? parsed.model : '',
      timestamp: parsed.timestamp,
    });
    return { action: 'stored_pending', conversation_id: parsed.conversation_id };
  }

  if (eventType === 'stop') {
    consumePendingPrompt(storagePaths.pendingPath, parsed.conversation_id);
    return { action: 'cleaned_pending', conversation_id: parsed.conversation_id };
  }

  if (eventType === 'afterAgentResponse') {
    const pending = consumePendingPrompt(storagePaths.pendingPath, parsed.conversation_id);
    const promptText = pending?.prompt_text || parsed.prompt_text || '';
    const model =
      parsed.model && parsed.model !== 'unknown'
        ? parsed.model
        : pending?.model || 'unknown';

    let durationMs = null;
    if (pending?.timestamp) {
      const start = Date.parse(pending.timestamp);
      const end = Date.parse(parsed.timestamp);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        durationMs = end - start;
      }
    }

    const overrides = loadPricingOverrides(overridePaths);
    const modelForRates = parsed.raw_hook_json?.model_id || model;
    const { rates } = resolveModelRates(modelForRates, overrides);
    const { uncached_input_tokens, cost_usd } = calculateTurnCost(
      {
        input_tokens: parsed.input_tokens,
        cache_read_tokens: parsed.cache_read_tokens,
        cache_write_tokens: parsed.cache_write_tokens,
        output_tokens: parsed.output_tokens,
      },
      rates,
    );

    const record = {
      id: crypto.randomUUID(),
      conversation_id: parsed.conversation_id,
      timestamp: parsed.timestamp,
      model,
      prompt_preview: promptText.slice(0, 500),
      prompt_text: promptText,
      response_text: parsed.response_text,
      input_tokens: parsed.input_tokens,
      uncached_input_tokens,
      cache_read_tokens: parsed.cache_read_tokens,
      cache_write_tokens: parsed.cache_write_tokens,
      output_tokens: parsed.output_tokens,
      reasoning_tokens: parsed.reasoning_tokens,
      cost_usd,
      cost_source: 'calculated',
      duration_ms: durationMs,
      source: 'cursor_hook',
      raw_hook_json: parsed.raw_hook_json,
    };

    if (!skipBufferWrite) {
      appendEventToBuffer(storagePaths.bufferPath, record);
    }
    return { action: 'recorded_event', record };
  }

  return { action: 'ignored', event_name: eventType };
}

/**
 * Envía el evento al backend local con timeout corto (< 500 ms) y hace fallback
 * automático al buffer .jsonl si el backend no está activo.
 */
export async function dispatchHookEvent(
  rawStdin,
  { eventHint = '', storagePaths, overridePaths = [], backendUrl, fetchFn } = {},
) {
  const result = handleHookEvent(rawStdin, {
    eventHint,
    storagePaths,
    overridePaths,
    skipBufferWrite: true,
  });

  if (result.action === 'recorded_event' && result.record) {
    const sent = await postEventToBackend(result.record, { backendUrl, fetchFn });
    if (!sent) {
      appendEventToBuffer(storagePaths.bufferPath, result.record);
      return { ...result, delivered: 'buffer' };
    }
    return { ...result, delivered: 'backend' };
  }

  return result;
}

async function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    const storagePaths = getDefaultStoragePaths(options.bufferDir || undefined);

    if (options.today || options.date || options.prompts) {
      const targetDate = options.date || toLocalDateKey();
      const overrides = loadPricingOverrides(getDefaultOverridePaths(__dirname, os.homedir()));
      const bufferEvents = readBufferEvents(storagePaths.bufferPath);
      const backendEvents =
        !options.date && !options.bufferDir ? await fetchTodayEventsFromBackend() : null;

      // Combinar eventos del backend y del buffer sin duplicar por id
      const mergedById = new Map();
      for (const ev of bufferEvents) {
        mergedById.set(ev.id || `${ev.timestamp}-${ev.conversation_id}`, ev);
      }
      for (const ev of backendEvents || []) {
        mergedById.set(ev.id || `${ev.timestamp}-${ev.conversation_id}`, ev);
      }

      const events = enrichEventsWithPricing(Array.from(mergedById.values()), overrides);
      const dayEvents = events.filter((ev) => toLocalDateKey(ev.timestamp) === targetDate);
      const summary = summarizeEventsByDate(events, targetDate);

      if (options.json) {
        console.log(
          JSON.stringify(
            options.prompts
              ? { date: targetDate, prompts: dayEvents }
              : { ...summary, prompts: dayEvents },
            null,
            2,
          ),
        );
      } else if (options.prompts) {
        console.log(formatPromptsList(dayEvents, options.limit));
      } else {
        console.log(formatSummaryTable(summary, dayEvents));
      }
      process.exit(0);
    }

    const rawStdin = await readStdinSyncSafe();
    if (!rawStdin.trim() && !options.event) {
      process.exit(0);
    }

    await dispatchHookEvent(rawStdin, {
      eventHint: options.event,
      storagePaths,
      overridePaths: getDefaultOverridePaths(__dirname, os.homedir()),
    });
  } catch {
    // Nunca bloquear ni hacer fallar el flujo de Cursor
  }
  process.exit(0);
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main();
}
