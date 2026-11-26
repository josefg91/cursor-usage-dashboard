import { loadConfig } from './config.js';
import { initDatabase } from './db/index.js';
import { buildApp } from './app.js';
import { ingestBufferFile } from './services/bufferIngestService.js';

async function bootstrap() {
  const config = loadConfig();
  const db = initDatabase(config.dbPath);

  const { app, repo, pricingService } = await buildApp({
    db,
    overridesPath: config.overridesPath,
    pricingCacheTtlHours: config.pricingCacheTtlHours,
    bufferPath: config.bufferPath,
    logger: true,
  });

  // Refrescar catálogo de precios en segundo plano (con caché 24h en SQLite)
  void pricingService
    .ensureFreshCatalog()
    .then((res) => {
      app.log.info(res, 'Catálogo de precios listo');
      // Ingerir eventos acumulados en ~/.cursor/spend-buffer.jsonl mientras el backend estuvo apagado
      const ingested = ingestBufferFile(config.bufferPath, repo, pricingService);
      if (ingested.inserted > 0) {
        app.log.info(ingested, 'Eventos ingeridos desde spend-buffer.jsonl');
      }
    })
    .catch((err) => {
      app.log.warn({ err }, 'No se pudo refrescar el catálogo remoto; usando tarifas locales');
    });

  await app.listen({ port: config.port, host: config.host });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
