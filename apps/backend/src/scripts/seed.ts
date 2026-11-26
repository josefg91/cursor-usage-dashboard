import { loadConfig } from '../config.js';
import { initDatabase } from '../db/index.js';
import { TelemetryRepository } from '../db/repository.js';
import { buildAndPersistEvent } from '../services/bufferIngestService.js';
import { PricingService } from '../services/pricingService.js';

interface SeedSample {
  hoursAgo: number;
  conversation_id: string;
  model: string;
  prompt_text: string;
  response_text: string;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  duration_ms: number;
}

const SAMPLES: SeedSample[] = [
  {
    hoursAgo: 0.4,
    conversation_id: 'seed-session-refactor-api',
    model: 'claude-3.7-sonnet',
    prompt_text: 'Añade paginación y filtro por modelo en GET /api/prompts manteniendo tipado estricto.',
    response_text: 'Actualizado el repositorio SQLite y la ruta Fastify con soporte de page/limit y filtro por modelo.',
    input_tokens: 42_000,
    cache_read_tokens: 34_000,
    cache_write_tokens: 4_000,
    output_tokens: 1_800,
    duration_ms: 5200,
  },
  {
    hoursAgo: 0.9,
    conversation_id: 'seed-session-refactor-api',
    model: 'claude-3.7-sonnet',
    prompt_text: 'Ahora revisa todo el repo y dime por qué falla el test de integración cuando SQLite está en memoria.',
    response_text: 'El fallo venía de llamar a fs.mkdirSync cuando dbPath era :memory:. Corregido con guarda previa.',
    input_tokens: 145_000,
    cache_read_tokens: 60_000,
    cache_write_tokens: 55_000,
    output_tokens: 2_400,
    duration_ms: 11800,
  },
  {
    hoursAgo: 1.5,
    conversation_id: 'seed-session-git-check',
    model: 'claude-haiku-5-5-thinking-high',
    prompt_text: '¿Está mi rama sincronizada con origin?',
    response_text: 'Sí, tu rama local está al día con origin/main.',
    input_tokens: 68_000,
    cache_read_tokens: 45_000,
    cache_write_tokens: 22_990,
    output_tokens: 420,
    duration_ms: 6100,
  },
  {
    hoursAgo: 2.2,
    conversation_id: 'seed-session-ui-charts',
    model: 'gpt-4o',
    prompt_text: 'Crea el componente ContextVsCostScatter con Recharts y líneas de referencia en $0.05 y $0.15.',
    response_text: 'Componente creado con ScatterChart, ReferenceLine y tooltip oscuro.',
    input_tokens: 28_000,
    cache_read_tokens: 20_000,
    cache_write_tokens: 0,
    output_tokens: 1_650,
    duration_ms: 4800,
  },
  {
    hoursAgo: 3.1,
    conversation_id: 'seed-session-ui-charts',
    model: 'gemini-2.5-pro',
    prompt_text: 'Optimiza el layout responsive de las tarjetas KPI para segundo monitor en vertical.',
    response_text: 'Ajustado grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 con espaciado uniforme.',
    input_tokens: 18_500,
    cache_read_tokens: 12_000,
    cache_write_tokens: 0,
    output_tokens: 950,
    duration_ms: 3400,
  },
  {
    hoursAgo: 5.0,
    conversation_id: 'seed-session-quick-fix',
    model: 'gemini-2.5-flash',
    prompt_text: 'Convierte este timestamp ISO a formato español 24h.',
    response_text: 'Usa toLocaleString("es-ES", { hour12: false }).',
    input_tokens: 4_200,
    cache_read_tokens: 2_800,
    cache_write_tokens: 0,
    output_tokens: 210,
    duration_ms: 920,
  },
  {
    hoursAgo: 26,
    conversation_id: 'seed-session-yesterday-1',
    model: 'claude-4-sonnet',
    prompt_text: 'Diseña el esquema SQLite con tablas prompt_events, prompt_payloads (gzip) y model_pricing.',
    response_text: 'Creado schema.sql con PRAGMA journal_mode = WAL, ON DELETE CASCADE e índices.',
    input_tokens: 92_000,
    cache_read_tokens: 72_000,
    cache_write_tokens: 12_000,
    output_tokens: 2_900,
    duration_ms: 8900,
  },
  {
    hoursAgo: 28,
    conversation_id: 'seed-session-yesterday-1',
    model: 'claude-4-opus',
    prompt_text: 'Audita la arquitectura completa de seguridad Enterprise para asegurar 0 fugas de prompts.',
    response_text: 'Revisados todos los flujos: solo GET público a OpenRouter/LiteLLM, 127.0.0.1 local y sin telemetría externa.',
    input_tokens: 75_000,
    cache_read_tokens: 50_000,
    cache_write_tokens: 15_000,
    output_tokens: 3_100,
    duration_ms: 16400,
  },
  {
    hoursAgo: 52,
    conversation_id: 'seed-session-2d-ago',
    model: 'gpt-4.1',
    prompt_text: 'Genera tests unitarios en Vitest para verificar que no haya doble conteo de tokens de caché.',
    response_text: 'Añadidos tests para caché normal y caso límite donde cache_read > input_tokens.',
    input_tokens: 22_000,
    cache_read_tokens: 15_000,
    cache_write_tokens: 0,
    output_tokens: 1_200,
    duration_ms: 3900,
  },
  {
    hoursAgo: 98,
    conversation_id: 'seed-session-4d-ago',
    model: 'deepseek-r1',
    prompt_text: 'Analiza la complejidad temporal de las consultas de series temporales en SQLite.',
    response_text: 'Con el índice en timestamp DESC, el rango temporal se resuelve en O(log N + K).',
    input_tokens: 31_000,
    cache_read_tokens: 21_000,
    cache_write_tokens: 0,
    output_tokens: 1_450,
    duration_ms: 4600,
  },
];

function runSeed() {
  const clear = process.argv.includes('--clear');
  const config = loadConfig();
  const db = initDatabase(config.dbPath);
  const repo = new TelemetryRepository(db);
  const pricingService = new PricingService(repo, {
    overridesPath: config.overridesPath,
    cacheTtlHours: config.pricingCacheTtlHours,
  });

  if (clear) {
    db.prepare("DELETE FROM prompt_events WHERE id LIKE 'seed-%'").run();
    console.log('Eventos de seed previos eliminados.');
  }

  const now = Date.now();
  let insertedCount = 0;

  SAMPLES.forEach((sample, index) => {
    const timestamp = new Date(now - sample.hoursAgo * 60 * 60 * 1000).toISOString();
    const { inserted } = buildAndPersistEvent(
      {
        id: `seed-evt-${index + 1}`,
        conversation_id: sample.conversation_id,
        timestamp,
        model: sample.model,
        prompt_text: sample.prompt_text,
        response_text: sample.response_text,
        input_tokens: sample.input_tokens,
        cache_read_tokens: sample.cache_read_tokens,
        cache_write_tokens: sample.cache_write_tokens,
        output_tokens: sample.output_tokens,
        duration_ms: sample.duration_ms,
        source: 'cursor_hook',
        raw_hook_json: {
          seeded: true,
          model: sample.model,
          conversation_id: sample.conversation_id,
        },
      },
      repo,
      pricingService,
    );
    if (inserted) insertedCount += 1;
  });

  db.close();
  console.log(`Seed completado en ${config.dbPath}: ${insertedCount} eventos nuevos insertados.`);
}

runSeed();
