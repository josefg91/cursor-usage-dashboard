import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  payloadRetentionDays: number;
  pricingCacheTtlHours: number;
  cursorTokenFeePer1m: number;
  overridesPath: string;
  bufferPath: string;
}

function loadLocalEnvFiles(): void {
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      process.loadEnvFile?.(envPath);
    } catch {
      // Ignorar errores de lectura de .env local
    }
  }
}

export function parseNonNegativeNumber(raw: string | undefined, fallback = 0): number {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function loadConfig(): AppConfig {
  loadLocalEnvFiles();

  return {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '127.0.0.1',
    dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? '../../data/telemetry.sqlite'),
    payloadRetentionDays: Number(process.env.PAYLOAD_RETENTION_DAYS ?? 30),
    pricingCacheTtlHours: Number(process.env.PRICING_CACHE_TTL_HOURS ?? 24),
    cursorTokenFeePer1m: parseNonNegativeNumber(process.env.CURSOR_TOKEN_FEE_PER_1M, 0),
    overridesPath: path.resolve(
      process.cwd(),
      process.env.PRICING_OVERRIDES_PATH ?? '../../pricing-overrides.json',
    ),
    bufferPath:
      process.env.SPEND_BUFFER_PATH ?? path.join(os.homedir(), '.cursor', 'spend-buffer.jsonl'),
  };
}
