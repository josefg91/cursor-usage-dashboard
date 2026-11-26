import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_PENDING_ENTRIES = 50;

export function getDefaultStoragePaths(baseDir = path.join(os.homedir(), '.cursor')) {
  return {
    baseDir,
    bufferPath: path.join(baseDir, 'spend-buffer.jsonl'),
    pendingPath: path.join(baseDir, 'spend-pending.json'),
  };
}

function readPendingMap(pendingPath) {
  try {
    if (!fs.existsSync(pendingPath)) return {};
    const raw = fs.readFileSync(pendingPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingMap(pendingPath, map) {
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  const entries = Object.entries(map);
  const trimmed =
    entries.length > MAX_PENDING_ENTRIES
      ? Object.fromEntries(entries.slice(entries.length - MAX_PENDING_ENTRIES))
      : map;
  fs.writeFileSync(pendingPath, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export function savePendingPrompt(pendingPath, conversationId, data) {
  const map = readPendingMap(pendingPath);
  map[conversationId] = {
    prompt_text: data.prompt_text || '',
    model: data.model || '',
    timestamp: data.timestamp || new Date().toISOString(),
  };
  writePendingMap(pendingPath, map);
}

export function consumePendingPrompt(pendingPath, conversationId) {
  const map = readPendingMap(pendingPath);
  const entry = map[conversationId] || null;
  if (entry) {
    delete map[conversationId];
    writePendingMap(pendingPath, map);
  }
  return entry;
}

export function appendEventToBuffer(bufferPath, event) {
  fs.mkdirSync(path.dirname(bufferPath), { recursive: true });
  fs.appendFileSync(bufferPath, `${JSON.stringify(event)}\n`, 'utf-8');
}

export function readBufferEvents(bufferPath) {
  if (!fs.existsSync(bufferPath)) return [];
  const raw = fs.readFileSync(bufferPath, 'utf-8');
  const events = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Saltar líneas corruptas sin abortar la lectura
    }
  }
  return events;
}

/**
 * Devuelve la fecha local en formato YYYY-MM-DD para agrupar el gasto "de hoy".
 */
export function toLocalDateKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function summarizeEventsByDate(events, targetDateKey = toLocalDateKey()) {
  const filtered = events.filter((ev) => toLocalDateKey(ev.timestamp) === targetDateKey);

  const byModelMap = new Map();
  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalUncachedInputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalOutputTokens = 0;
  const sessions = new Set();

  for (const ev of filtered) {
    const model = ev.model || 'unknown';
    const cost = Number(ev.cost_usd) || 0;
    const input = Number(ev.input_tokens) || 0;
    const uncached = Number(ev.uncached_input_tokens) || 0;
    const cacheRead = Number(ev.cache_read_tokens) || 0;
    const cacheWrite = Number(ev.cache_write_tokens) || 0;
    const output = Number(ev.output_tokens) || 0;

    totalCostUsd += cost;
    totalInputTokens += input;
    totalUncachedInputTokens += uncached;
    totalCacheReadTokens += cacheRead;
    totalCacheWriteTokens += cacheWrite;
    totalOutputTokens += output;
    if (ev.conversation_id) sessions.add(ev.conversation_id);

    const existing = byModelMap.get(model) || {
      model,
      turns: 0,
      input_tokens: 0,
      cache_read_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    existing.turns += 1;
    existing.input_tokens += input;
    existing.cache_read_tokens += cacheRead;
    existing.output_tokens += output;
    existing.cost_usd = Number((existing.cost_usd + cost).toFixed(6));
    byModelMap.set(model, existing);
  }

  const byModel = Array.from(byModelMap.values()).sort((a, b) => b.cost_usd - a.cost_usd);
  const cacheHitRatePct =
    totalInputTokens > 0 ? Number(((totalCacheReadTokens / totalInputTokens) * 100).toFixed(1)) : 0;

  return {
    date: targetDateKey,
    turn_count: filtered.length,
    session_count: sessions.size,
    total_cost_usd: Number(totalCostUsd.toFixed(6)),
    total_input_tokens: totalInputTokens,
    total_uncached_input_tokens: totalUncachedInputTokens,
    total_cache_read_tokens: totalCacheReadTokens,
    total_cache_write_tokens: totalCacheWriteTokens,
    total_output_tokens: totalOutputTokens,
    cache_hit_rate_pct: cacheHitRatePct,
    by_model: byModel,
  };
}
