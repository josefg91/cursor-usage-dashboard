#!/usr/bin/env node
/**
 * Instalador multiplataforma e idempotente de Cursor Hooks (~/.cursor/hooks.json).
 * Resuelve rutas absolutas con os.homedir() y process.execPath para funcionar
 * en Windows, macOS y Linux (incluyendo entornos nvm en WSL).
 *
 * Uso:
 *   node src/install-hooks.mjs             # Instala/actualiza hooks en ~/.cursor/hooks.json
 *   node src/install-hooks.mjs --dry-run   # Muestra el resultado sin escribir
 *   node src/install-hooks.mjs --uninstall # Elimina únicamente nuestros hooks
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_EVENTS = ['beforeSubmitPrompt', 'afterAgentResponse', 'stop'];
const TRACK_SCRIPT_MARKER = 'track-spend.mjs';

function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

export function buildHookCommand(nodeExecPath, trackScriptPath, eventName) {
  return `${quoteIfNeeded(nodeExecPath)} ${quoteIfNeeded(trackScriptPath)} --event ${eventName}`;
}

export function mergeHooksConfig(existingConfig, { nodeExecPath, trackScriptPath, uninstall = false }) {
  const base =
    existingConfig && typeof existingConfig === 'object'
      ? structuredClone(existingConfig)
      : {};

  if (typeof base.version !== 'number') {
    base.version = 1;
  }
  if (!base.hooks || typeof base.hooks !== 'object') {
    base.hooks = {};
  }

  for (const eventName of HOOK_EVENTS) {
    const currentList = Array.isArray(base.hooks[eventName]) ? base.hooks[eventName] : [];
    // Eliminar versiones anteriores de nuestro propio hook para mantener idempotencia
    const filtered = currentList.filter(
      (entry) => !(entry && typeof entry.command === 'string' && entry.command.includes(TRACK_SCRIPT_MARKER)),
    );

    if (!uninstall) {
      filtered.push({
        command: buildHookCommand(nodeExecPath, trackScriptPath, eventName),
      });
    }

    if (filtered.length > 0) {
      base.hooks[eventName] = filtered;
    } else {
      delete base.hooks[eventName];
    }
  }

  return base;
}

export function installHooks({
  hooksFilePath = path.join(os.homedir(), '.cursor', 'hooks.json'),
  trackScriptPath = path.resolve(__dirname, 'track-spend.mjs'),
  nodeExecPath = process.execPath,
  dryRun = false,
  uninstall = false,
} = {}) {
  let existing = {};
  if (fs.existsSync(hooksFilePath)) {
    const raw = fs.readFileSync(hooksFilePath, 'utf-8');
    if (raw.trim().length > 0) {
      existing = JSON.parse(raw);
    }
  }

  const nextConfig = mergeHooksConfig(existing, {
    nodeExecPath,
    trackScriptPath,
    uninstall,
  });

  if (!dryRun) {
    fs.mkdirSync(path.dirname(hooksFilePath), { recursive: true });
    fs.writeFileSync(hooksFilePath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf-8');
  }

  return { hooksFilePath, config: nextConfig };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const uninstall = args.includes('--uninstall');
  const useSystemNode = args.includes('--use-system-node');

  const nodeExecPath = useSystemNode ? 'node' : process.execPath;
  const result = installHooks({ nodeExecPath, dryRun, uninstall });

  if (dryRun) {
    console.log(`[dry-run] Archivo destino: ${result.hooksFilePath}`);
    console.log(JSON.stringify(result.config, null, 2));
    return;
  }

  if (uninstall) {
    console.log(`Hooks de Cursor Prompt Cost Dashboard eliminados de: ${result.hooksFilePath}`);
  } else {
    console.log(`Hooks instalados correctamente en: ${result.hooksFilePath}`);
    console.log('Eventos configurados: beforeSubmitPrompt, afterAgentResponse, stop');
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main();
}
