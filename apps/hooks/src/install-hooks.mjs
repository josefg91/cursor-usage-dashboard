#!/usr/bin/env node
/**
 * Instalador multiplataforma de Cursor Hooks (~/.cursor/hooks.json).
 * Resuelve rutas absolutas con os.homedir() y path.resolve() para compatibilidad
 * con Windows, macOS y Linux.
 *
 * TODO (Fase 1/2): Implementar merge seguro con ~/.cursor/hooks.json existente.
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trackScriptPath = path.resolve(__dirname, 'track-spend.mjs');
const cursorHooksPath = path.join(os.homedir(), '.cursor', 'hooks.json');

console.log(`Ruta del script de tracking: ${trackScriptPath}`);
console.log(`Ruta destino de Cursor hooks: ${cursorHooksPath}`);
console.log('Instalador listo para implementar en Fase 1.');
