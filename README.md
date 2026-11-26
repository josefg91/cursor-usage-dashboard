# Cursor Prompt Cost Dashboard

Dashboard local de observabilidad para registrar en tiempo real los prompts lanzados en Cursor, el modelo utilizado, el desglose de tokens (incluyendo caché) y el coste estimado en USD.

## Estructura del monorepo

```text
cursor-dashboard/
├── packages/
│   └── shared/          # Tipos/DTOs compartidos y fórmula de cálculo de costes (Vitest)
├── apps/
│   ├── backend/         # API REST local (Fastify + SQLite en modo WAL + gzip)
│   ├── dashboard/       # Interfaz web oscura (React 19 + Vite + Tailwind + TanStack Query + Recharts)
│   └── hooks/           # Scripts ESM ligeros para Cursor Hooks (~/.cursor/hooks.json) sin deps externas
├── data/                # Base de datos SQLite local y caché de tarifas (ignorado en git)
├── .env.example
└── pricing-overrides.example.json
```

## Requisitos previos

- **Node.js 22+** (usa `node:sqlite` nativo sin compilación C++)
- **pnpm 10+**

> **Nota para WSL:** ejecuta los comandos `pnpm` dentro de la terminal de WSL con Node 22 activo (`nvm use 22`), evitando ejecutar `pnpm` desde Windows sobre rutas UNC (`\\wsl.localhost\...`).

## Instalación y uso (Fase 1 — Cursor Hooks + CLI)

```bash
# 1. Instalar dependencias del monorepo
pnpm install

# 2. Previsualizar la configuración de hooks sin modificar nada
node apps/hooks/src/install-hooks.mjs --dry-run

# 3. Instalar los hooks en ~/.cursor/hooks.json (idempotente, preserva otros hooks)
pnpm install-hooks
```

Para desinstalar únicamente los hooks de este proyecto:

```bash
node apps/hooks/src/install-hooks.mjs --uninstall
```

### Consultar el gasto y los prompts capturados

Los eventos de Cursor (`beforeSubmitPrompt`, `afterAgentResponse`, `stop`) se guardan en `~/.cursor/spend-buffer.jsonl`.

```bash
# Resumen del gasto de hoy + tabla por modelo + listado detallado de prompts
pnpm today

# Solo el listado de prompts capturados hoy (modelo, params, tokens, caché, ratio y coste)
pnpm prompts

# Opciones avanzadas del CLI
node apps/hooks/src/track-spend.mjs --today --date 2026-11-26
node apps/hooks/src/track-spend.mjs --prompts --limit 50
node apps/hooks/src/track-spend.mjs --today --json
```

### Tarifas personalizadas (`pricing-overrides.json`)

Puedes copiar `pricing-overrides.example.json` a `pricing-overrides.json` en la raíz del proyecto (o en `~/.cursor/pricing-overrides.json`) para sobrescribir o añadir tarifas personalizadas en USD por millón de tokens.

## Comandos de desarrollo

```bash
# Verificación de tipos en todo el monorepo
pnpm typecheck

# Ejecutar tests unitarios
pnpm test

# Compilar todos los paquetes y apps
pnpm build

# Arrancar backend (127.0.0.1:3001) y dashboard (localhost:5173) en paralelo
pnpm dev
```
