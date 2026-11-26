import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { initDatabase } from './db/index.js';
import { healthRoutes } from './routes/health.js';
import { eventsRoutes } from './routes/events.js';
import { statsRoutes } from './routes/stats.js';
import { promptsRoutes } from './routes/prompts.js';

async function bootstrap() {
  const config = loadConfig();
  const db = initDatabase(config.dbPath);

  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });

  await app.register(healthRoutes);
  await app.register(eventsRoutes);
  await app.register(statsRoutes);
  await app.register(promptsRoutes);

  app.addHook('onClose', async () => {
    db.close();
  });

  await app.listen({ port: config.port, host: config.host });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
