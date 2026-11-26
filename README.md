# Cursor Prompt Cost Dashboard

Dashboard local de observabilidad para registrar en tiempo real los prompts lanzados en Cursor, el modelo utilizado, el desglose de tokens (incluyendo caché) y el coste estimado en USD. 100% local y seguro para entornos Enterprise.

## Estructura del monorepo

```text
cursor-dashboard/
├── packages/
│   └── shared/          # Tipos/DTOs compartidos, catálogo base y fórmula de cálculo de costes (Vitest)
├── apps/
│   ├── backend/         # API REST local en Fastify (127.0.0.1:3001) + SQLite WAL/gzip + PricingService
│   ├── dashboard/       # Interfaz web oscura (React 19 + Vite + Tailwind v4 + TanStack Query + Recharts)
│   └── hooks/           # Scripts ESM ligeros para Cursor Hooks (~/.cursor/hooks.json) sin deps externas
├── data/                # Base de datos SQLite local (ignorado en git)
├── .env.example
└── pricing-overrides.example.json
```

## Requisitos previos

- **Node.js 22+** (usa `node:sqlite` nativo sin compilación C++)
- **pnpm 10+**

> **Nota para WSL:** ejecuta los comandos `pnpm` dentro de la terminal de WSL con Node 22 activo (`nvm use 22`), evitando ejecutar `pnpm` desde Windows sobre rutas UNC (`\\wsl.localhost\...`).

## Inicio rápido (MVP completo)

```bash
# 1. Instalar dependencias del monorepo
pnpm install

# 2. (Opcional) Previsualizar e instalar Cursor Hooks en ~/.cursor/hooks.json
node apps/hooks/src/install-hooks.mjs --dry-run
pnpm install-hooks

# 3. (Opcional) Poblar SQLite con datos de prueba para explorar el dashboard
pnpm seed

# 4. Arrancar Backend (http://127.0.0.1:3001) + Dashboard (http://localhost:5173)
pnpm dev
```

Abre **http://localhost:5173** en tu navegador. Al arrancar, el backend sincroniza automáticamente cualquier evento acumulado en `~/.cursor/spend-buffer.jsonl` y refresca el catálogo de tarifas (OpenRouter + fallback LiteLLM + `pricing-overrides.json`, cacheado 24 h).

## Uso por CLI (Cursor Hooks)

```bash
# Resumen del gasto de hoy + tabla por modelo + listado detallado de prompts
pnpm today

# Solo el listado de prompts capturados hoy
pnpm prompts

# Opciones avanzadas del CLI
node apps/hooks/src/track-spend.mjs --today --date 2026-11-26
node apps/hooks/src/track-spend.mjs --prompts --limit 50
node apps/hooks/src/track-spend.mjs --today --json

# Desinstalar únicamente los hooks de este proyecto
node apps/hooks/src/install-hooks.mjs --uninstall
```

## Endpoints de la API local (`127.0.0.1:3001`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Estado del servidor, nº de eventos en SQLite y nº de tarifas |
| `POST` | `/api/events` | Ingesta de eventos de Cursor Hooks (calcula coste y comprime payloads con `gzip`) |
| `POST` | `/api/events/sync-buffer` | Ingesta idempotente desde `~/.cursor/spend-buffer.jsonl` |
| `GET` | `/api/stats/summary` | KPIs agregados (`?range=today\|7d\|30d\|all&model=...`) |
| `GET` | `/api/stats/by-model` | Desglose de coste y tokens por modelo |
| `GET` | `/api/stats/timeseries` | Serie temporal apilada por modelo |
| `GET` | `/api/prompts` | Listado paginado (`?view=turns\|sessions&search=...&page=1&limit=25`) |
| `GET` | `/api/prompts/:id` | Detalle completo del turno descomprimiendo payloads `gzip` |
| `GET` / `POST` | `/api/pricing` · `/api/pricing/refresh` | Consulta y refresco manual del catálogo de tarifas |
| `POST` | `/api/import/csv` | Importa y concilia costes reales desde CSV de `cursor.com/dashboard` > *Usage* |
| `GET` / `POST` | `/api/maintenance/storage` · `/api/maintenance/purge-payloads` | Estadísticas SQLite y purga de payloads > 30 días manteniendo métricas |
| `GET` | `/api/export` | Exportación de datos filtrados (`?format=csv\|json&range=...&model=...&search=...`) |

## Pendiente (Fase 4)

- [ ] **Cursor Enterprise Admin API (`RF-11`):** sincronización automática vía `POST https://api.cursor.com/teams/filtered-usage-events` (pendiente de disponer de una `CURSOR_ADMIN_KEY` corporativa de IT).

## Tarifas personalizadas (`pricing-overrides.json`)

Copia [pricing-overrides.example.json](pricing-overrides.example.json) a `pricing-overrides.json` en la raíz del proyecto para sobrescribir tarifas en USD por millón de tokens (tienen prioridad sobre OpenRouter y LiteLLM).

## Comandos de desarrollo

```bash
pnpm typecheck   # Verificación TypeScript (strict: true) y sintaxis de hooks
pnpm test        # Tests unitarios y de integración (Vitest)
pnpm build       # Compilación de todos los paquetes y bundle de Vite
pnpm seed        # Inserta datos simulados en SQLite (usa --clear para reiniciarlos)
```
