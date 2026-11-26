# Cursor Prompt Cost Dashboard

Dashboard local de observabilidad para registrar en tiempo real los prompts lanzados en Cursor, el modelo utilizado y el coste estimado en USD.

## Estructura del monorepo

```text
cursor-dashboard/
├── packages/
│   └── shared/          # Tipos/DTOs compartidos y fórmula de cálculo de costes (con tests Vitest)
├── apps/
│   ├── backend/         # API REST local (Fastify + SQLite en modo WAL + gzip)
│   ├── dashboard/       # Interfaz web oscura (React 19 + Vite + Tailwind + TanStack Query + Recharts)
│   └── hooks/           # Scripts ESM ligeros para Cursor Hooks (~/.cursor/hooks.json)
├── data/                # Base de datos SQLite local y caché de tarifas (ignorado en git)
├── .env.example
└── pricing-overrides.example.json
```

## Requisitos previos

- **Node.js 22+** (usa `node:sqlite` nativo sin compilación C++)
- **pnpm 10+**

## Comandos principales

```bash
# Instalar dependencias
pnpm install

# Verificación de tipos en todo el monorepo
pnpm typecheck

# Ejecutar tests unitarios
pnpm test

# Compilar todos los paquetes y apps
pnpm build

# Arrancar backend (127.0.0.1:3001) y dashboard (localhost:5173) en paralelo
pnpm dev

# Instalar Cursor Hooks en ~/.cursor/hooks.json (Fase 1/2)
pnpm install-hooks

# Consultar gasto acumulado de hoy por terminal (Fase 1)
pnpm today
```
