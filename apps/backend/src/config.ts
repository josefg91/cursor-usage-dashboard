import os from 'node:os';
import path from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  payloadRetentionDays: number;
  pricingCacheTtlHours: number;
  overridesPath: string;
  bufferPath: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '127.0.0.1',
    dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? '../../data/telemetry.sqlite'),
    payloadRetentionDays: Number(process.env.PAYLOAD_RETENTION_DAYS ?? 30),
    pricingCacheTtlHours: Number(process.env.PRICING_CACHE_TTL_HOURS ?? 24),
    overridesPath: path.resolve(
      process.cwd(),
      process.env.PRICING_OVERRIDES_PATH ?? '../../pricing-overrides.json',
    ),
    bufferPath:
      process.env.SPEND_BUFFER_PATH ?? path.join(os.homedir(), '.cursor', 'spend-buffer.jsonl'),
  };
}
