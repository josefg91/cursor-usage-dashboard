#!/usr/bin/env node
/**
 * Cursor Hook ligero (ESM sin dependencias externas).
 * - Captura eventos: beforeSubmitPrompt, afterAgentResponse, stop (vía stdin)
 * - Envía al backend local (http://127.0.0.1:3001/api/events) con timeout corto (<500 ms)
 * - Fallback automático a ~/.cursor/spend-buffer.jsonl si el backend no responde
 * - Soporta consulta rápida CLI: `node src/track-spend.mjs --today`
 *
 * TODO (Fase 1): Implementar lectura de stdin, correlación de prompt/respuesta,
 * escritura segura en buffer .jsonl y resumen CLI --today.
 */

const args = process.argv.slice(2);

if (args.includes('--today')) {
  console.log('Cursor Prompt Cost Dashboard - Resumen de hoy (pendiente de Fase 1)');
  process.exit(0);
}

// Garantizar que el hook nunca bloquee ni falle el flujo de Cursor
process.exit(0);
