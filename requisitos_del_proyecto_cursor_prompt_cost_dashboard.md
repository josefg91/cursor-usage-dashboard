# 📋 Requisitos del Proyecto: Cursor Prompt Cost Dashboard

---

## 1. 🎯 Visión General

| Campo | Descripción |
|-------|-------------|
| **Nombre del proyecto** | **Cursor Prompt Cost Dashboard** |
| **Descripción breve** | Dashboard local de observabilidad que registra en tiempo real los prompts lanzados en Cursor, el modelo utilizado y el coste estimado en USD para mejorar la eficiencia al comunicarse con la IA. |
| **Problema que resuelve** | Al usar Cursor con suscripción Enterprise no existe visibilidad directa que cruce *qué prompt se escribió* con *cuántos tokens y dinero costó* cada turno o tarea de agente, dificultando detectar malos hábitos (arrastre de historial largo, exceso de contexto o uso de modelos caros para tareas simples). |
| **Usuario objetivo** | Desarrollador individual trabajando en un entorno corporativo con cuenta Cursor Enterprise (sin necesidad de permisos de administrador de IT). |
| **Tipo de aplicación** | Web app local (Dashboard React) + Servicio Backend local (API REST + SQLite) + Scripts CLI locales (Cursor Hooks). |

---

## 2. ✅ Requisitos Funcionales

### 2.1 Funcionalidades Principales (MVP)

| # | Funcionalidad | Descripción | Prioridad |
|---|---------------|-------------|-----------|
| RF-01 | **Captura automática vía Cursor Hooks** | Interceptar en local los eventos `beforeSubmitPrompt`, `afterAgentResponse` y `stop` mediante `~/.cursor/hooks.json` para capturar el texto del prompt, la respuesta, el modelo, el `conversation_id` y el desglose de tokens (entrada, caché lectura/escritura, salida y razonamiento). | 🔴 Alta |
| RF-02 | **PoC / Consulta rápida del gasto de hoy** | Permitir consultar desde terminal (CLI) y en el dashboard el gasto acumulado del día actual en USD y su desglose por modelo. | 🔴 Alta |
| RF-03 | **Motor de cálculo de costes por modelo** | Calcular el coste estimado en USD por cada turno descontando correctamente los tokens de caché del total de entrada, usando un catálogo dinámico de precios (API pública de OpenRouter + fallback LiteLLM + archivo local `pricing-overrides.json`). | 🔴 Alta |
| RF-04 | **Persistencia local eficiente (SQLite)** | Guardar metadatos y métricas ligeras en SQLite (modo `WAL`) separadas de los textos completos comprimidos con `gzip`, con respaldo en archivo `.jsonl` si el backend local estuviera apagado durante el envío del hook. | 🔴 Alta |
| RF-05 | **Panel de KPIs de eficiencia** | Mostrar en tiempo real: Gasto Total (USD), Coste Medio por Prompt/Sesión, Ratio Entrada/Salida (con alerta si supera 20:1) y Eficiencia de Caché (%). | 🔴 Alta |
| RF-06 | **Tabla de prompts e historial en vivo** | Listar los prompts lanzados con auto-refresco (cada 5 s, pausable), filtros por rango temporal (Hoy, 7d, 30d, Todo) y modelo, buscador de texto y semáforo visual de coste (`< $0.05` normal, `$0.05–$0.15` ámbar, `> $0.15` rojo). | 🔴 Alta |
| RF-07 | **Agrupación por sesión / hilo de agente** | Permitir alternar en la tabla entre *turnos individuales* y *sesiones agrupadas* (`conversation_id`), sumando el coste total de tareas multi-paso en modo Agent/Composer. | 🟡 Media |
| RF-08 | **Gráficas analíticas de consumo** | Mostrar (1) gráfica de barras apiladas de evolución del gasto por modelo en el tiempo y (2) gráfica de dispersión (Tokens de entrada vs. Coste USD) para detectar *outliers* de contexto. | 🟡 Media |
| RF-09 | **Inspector lateral de prompt (Drawer)** | Al hacer clic en un registro o punto de la gráfica, abrir un panel lateral con el texto completo del prompt, la respuesta, el desglose exacto de tokens/coste y métricas de la sesión. | 🟡 Media |

### 2.2 Funcionalidades Secundarias (Post-MVP)

| # | Funcionalidad | Descripción |
|---|---------------|-------------|
| RF-10 | **Importador de CSV de Cursor Usage** | Subir el CSV exportado desde `cursor.com/dashboard` > *Usage* para conciliar el coste real facturado (`chargedCents`) y capturar llamadas de subagentes que los hooks locales puedan omitir. |
| RF-11 | **Sincronización opcional con Cursor Admin API** | Módulo opcional (desactivado por defecto) para consultar `POST https://api.cursor.com/teams/filtered-usage-events` en caso de disponer de una *Admin API Key* corporativa. |
| RF-12 | **Alertas y sugerencias de eficiencia** | Etiquetado automático de prompts ineficientes (ej. conversaciones de más de N turnos sin abrir chat nuevo, bajo acierto de caché o uso de modelos pesados en prompts triviales). |
| RF-13 | **Política de retención y limpieza** | Purga automática configurable de textos pesados comprimidos con más de 30 días manteniendo intactas las métricas históricas de coste. |
| RF-14 | **Exportación de informes** | Exportar estadísticas filtradas en CSV o JSON para seguimiento personal semanal/mensual. |

### 2.3 Flujos de Usuario

**Flujo 1: Registro automático de un prompt desde Cursor**
1. El usuario escribe y envía un prompt en el chat o Agent de Cursor.
2. Cursor ejecuta el hook `beforeSubmitPrompt`, que registra temporalmente el texto del prompt asociado al `conversation_id` y timestamp.
3. Cuando el modelo responde, Cursor ejecuta el hook `afterAgentResponse` pasando por `stdin` el modelo, la respuesta y los contadores de tokens (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`).
4. El script del hook calcula/envía el evento al backend local (`POST http://localhost:3001/api/events`) con un timeout corto (< 500 ms). Si el backend no está activo, hace append seguro en `~/.cursor/spend-buffer.jsonl` para ingesta posterior.
5. El backend cruza el prompt capturado con la respuesta, calcula el coste en USD según la tarifa del modelo y guarda el registro en SQLite.

**Flujo 2: Análisis de eficiencia en el Dashboard**
1. El usuario abre `http://localhost:5173` en su navegador.
2. Revisa en la cabecera el gasto acumulado del día actual y el ratio Entrada/Salida.
3. Identifica en la gráfica de dispersión o en la tabla un turno marcado en rojo (`> $0.15`).
4. Hace clic sobre la fila para abrir el Drawer Inspector, revisa si el coste vino del historial acumulado o de una respuesta demasiado larga y decide dividir futuras tareas o cambiar a un modelo más ligero.

---

## 3. 🚫 Requisitos No Funcionales

| Categoría | Requisito | Detalle |
|-----------|-----------|---------|
| **Rendimiento** | Cero impacto en Cursor | Los scripts de Cursor Hooks deben ejecutarse de forma asíncrona/rápida (< 200 ms) y nunca bloquear ni hacer fallar el flujo del editor si el servidor local o SQLite fallan. |
| **Rendimiento** | Carga del Dashboard | Tiempo de respuesta de endpoints `/api/*` < 150 ms gracias a índices SQLite y separación entre tabla de métricas y payloads comprimidos. |
| **Seguridad y Privacidad** | 100% Local (Enterprise-safe) | Ningún prompt, fragmento de código ni archivo sale de la máquina del desarrollador. No requiere túneles HTTPS públicos ni envío de datos a terceros. |
| **Seguridad** | Gestión de secretos | Si se activa la integración opcional con Admin API, la clave nunca se imprime en logs ni se persiste en SQLite (solo en `.env` local excluido en `.gitignore`). |
| **Compatibilidad** | Multiplataforma | Scripts npm/pnpm, rutas de hooks y driver SQLite compatibles con Windows (PowerShell), macOS y Linux. |
| **Mantenibilidad** | Tipado estricto | TypeScript con `strict: true` en todo el monorepo y DTOs compartidos en `packages/shared`. |
| **Internacionalización** | Idioma | Interfaz en Español (con formato numérico/moneda claro en USD, ej. `$0.0425`). |
| **Responsive** | Dispositivos | Desktop-first (pensado para tener abierto en segundo monitor junto a Cursor), adaptable a pantallas más estrechas. |

---

## 4. 🛠️ Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| **Monorepo** | `pnpm workspaces` (o `npm workspaces`) + TypeScript | Estructura: `apps/backend`, `apps/dashboard`, `apps/hooks`, `packages/shared`. |
| **Frontend** | React 19 + Vite + TypeScript | Rápido en local, con TanStack Query para polling cada 5 s y Recharts + Lucide React para gráficas e iconos. |
| **CSS / Estilos** | Tailwind CSS | Estética limpia tipo herramienta de observabilidad para desarrolladores. |
| **Backend** | Node.js 22+ + Fastify (`@fastify/cors`) | Ligero y rápido para ingesta de eventos y consultas agregadas del dashboard. |
| **Captura en Cursor** | Node.js ESM (`.mjs`) vía Cursor Hooks | Sin dependencias pesadas para arranque instantáneo en cada evento del IDE. |
| **Base de datos** | SQLite (`better-sqlite3` o `node:sqlite` nativo en Node 22+) | Archivo único local (`./data/telemetry.sqlite`), modo `WAL` y compresión `zlib.gzipSync` para textos largos. |
| **Autenticación** | No requerida (entorno `127.0.0.1`) | El backend escucha únicamente en `localhost`. |
| **Hosting / Deploy** | 100% Local | Arranque unificado con un solo comando (`pnpm dev`). |
| **APIs externas** | Catálogo de precios público (OpenRouter / LiteLLM) | Solo lectura GET puntual (cacheado 24 h en disco) para mantener tarifas actualizadas sin enviar datos privados. |
| **Testing** | Vitest | Tests unitarios obligatorios para la fórmula de costes y el parser de eventos de hooks. |

---

## 5. 🎨 Diseño UI/UX

### 5.1 Estilo Visual

| Aspecto | Preferencia |
|---------|-------------|
| **Tema** | Oscuro (Dark mode por defecto, estilo IDE / developer tool) |
| **Estilo** | Minimalista, alta densidad informativa sin ruido visual |
| **Paleta de colores** | Fondo grafito/pizarra oscuro (`#0B0F19` / `#111827`), bordes sutiles, acentos por modelo (púrpura Claude, verde GPT, azul Gemini) y semáforo de coste (esmeralda, ámbar, rojo) |
| **Tipografía** | Sans-serif limpia (`Inter`) para UI y monoespaciada (`JetBrains Mono` / `Fira Code`) para tokens, costes y prompts |
| **Inspiración** | Langfuse, Helicone, Grafana / Vercel Analytics |

### 5.2 Páginas / Vistas

| # | Página / Vista | Descripción | Elementos clave |
|---|----------------|-------------|-----------------|
| 1 | **Dashboard Principal** (`/`) | Vista única principal de monitorización y análisis | Barra superior fija (estado del servidor, selector temporal, filtro de modelo, pausa de auto-refresh), 4 tarjetas KPI, 2 gráficas (Gasto por modelo + Dispersión Contexto vs. Coste) y tabla interactiva de prompts/sesiones. |
| 2 | **Drawer Inspector de Prompt** (Panel lateral) | Inspección profunda de una llamada o sesión seleccionada | Texto exacto del prompt, respuesta generada, barra visual de desglose de tokens (entrada normal, caché lectura, caché escritura, salida, razonamiento), coste calculado y metadatos del evento. |
| 3 | **Ajustes y Tarifas** (`/settings`, modal o pestaña) | Gestión de precios y utilidades de diagnóstico | Estado de conexión con Cursor Hooks, tabla editable de tarifas (`pricing-overrides.json`), botón de refresco de catálogo de precios e importador manual de CSV (Post-MVP). |

### 5.3 Mockups / Wireframes

Distribución vertical de la pantalla principal:
- **Header fijo:** `[Logo + Estado Hook/API]` | `[Hoy | 7d | 30d | Todo]` | `[Filtro Modelo]` | `[Auto-refresh 5s: ON/OFF]`
- **Fila 1 (4 columnas):** `[Gasto Total ($)]` `[Coste Medio / Prompt]` `[Ratio Entrada/Salida]` `[Eficiencia Caché (%)]`
- **Fila 2 (2 columnas):** `[Barras apiladas: Gasto por Modelo]` | `[Scatter: Tokens Entrada vs. Coste ($)]`
- **Fila 3 (Ancho completo):** `[Toggle: Turnos | Sesiones]` `[Buscador]` + Tabla paginada con clic para abrir `[Drawer lateral derecho]`.

---

## 6. 📊 Modelo de Datos

### Entidades

| Entidad | Campos principales | Relaciones |
|---------|--------------------|------------|
| **`prompt_events`** (Métricas rápidas) | `id` (UUID), `conversation_id`, `timestamp` (ISO UTC), `model`, `prompt_preview` (máx. 500 chars), `input_tokens`, `uncached_input_tokens`, `cache_read_tokens`, `cache_write_tokens`, `output_tokens`, `reasoning_tokens`, `cost_usd`, `cost_source` (`calculated` / `csv_reconciled` / `api_reported`), `duration_ms`, `source` (`cursor_hook` / `csv_import` / `admin_api`) | 1 a 1 con `prompt_payloads`. Múltiples eventos comparten un `conversation_id`. |
| **`prompt_payloads`** (Contenido comprimido) | `event_id` (PK/FK), `prompt_text_gzip` (BLOB), `response_text_gzip` (BLOB), `raw_hook_json_gzip` (BLOB) | Pertenece a un `prompt_events` (`ON DELETE CASCADE`). |
| **`model_pricing`** (Caché de tarifas) | `model_key` (PK), `input_per_1m`, `cache_read_per_1m`, `cache_write_per_1m`, `output_per_1m`, `updated_at`, `is_override` | Referenciada al calcular costes de `prompt_events`. |

### Diagrama de relaciones

~~~text
[conversation_id (agrupación lógica)] 1 --- N [prompt_events] 1 --- 1 [prompt_payloads]
                                                     |
                                                     N
                                                     |
                                                     1
                                              [model_pricing]
~~~

---

## 7. 🔌 Integraciones y APIs

| Servicio | Propósito | ¿Tienes API key? |
|----------|-----------|------------------|
| **Cursor Hooks** (Local nativo) | Fuente principal en tiempo real de prompts, modelo y tokens sin salir de la máquina. | No requiere |
| **OpenRouter Models API** (`https://openrouter.ai/api/v1/models`) | Descargar catálogo público de precios por millón de tokens (solo lectura, sin enviar datos). | No requiere (endpoint público) |
| **LiteLLM Pricing JSON** (GitHub raw) | Fallback secundario para tarifas de modelos no encontrados en OpenRouter. | No requiere |
| **Cursor Admin API** (`https://api.cursor.com/teams/filtered-usage-events`) | *(Opcional Post-MVP)* Obtener gasto exacto facturado (`chargedCents`) en cuenta Enterprise. | No confirmada (requiere permiso de Admin de IT) |

---

## 8. 🚀 Despliegue y Entorno

| Aspecto | Detalle |
|---------|---------|
| **Entorno de desarrollo** | Local en la máquina del usuario (Node.js 22+). Sin necesidad de Docker ni servidores externos. |
| **CI/CD** | No requerido para uso personal local (scripts locales `pnpm typecheck`, `pnpm test`, `pnpm build`). |
| **Variables de entorno** | `PORT=3001`, `DB_PATH=./data/telemetry.sqlite`, `PAYLOAD_RETENTION_DAYS=30`, `PRICING_CACHE_TTL_HOURS=24`. *(Opcionales Post-MVP: `CURSOR_ADMIN_KEY`, `CURSOR_EMAIL`)*. |
| **Dominio** | No aplica (`http://localhost:5173` para Dashboard y `http://127.0.0.1:3001` para Backend). |

---

## 9. ⚠️ Restricciones y Consideraciones

- [x] Presupuesto limitado (solo herramientas gratuitas y locales; no pagar APIs externas adicionales teniendo ya licencia Cursor Enterprise)
- [x] Debe funcionar offline (si no hay red para actualizar precios, usa la caché local o `pricing-overrides.json`; si el backend está apagado, el hook guarda en buffer `.jsonl`)
- [x] Datos sensibles (código y prompts corporativos de cuenta Enterprise: **prohibido** enviar prompts a servidores externos o exponer puertos en internet sin aprobación de IT)
- [x] Otra: **Limitación conocida de Cursor Hooks:** `afterAgentResponse` captura el agente principal del IDE, pero puede no incluir tokens de subagentes en segundo plano; además, `input_tokens` incluye los tokens de caché, por lo que hay que restarlos para no duplicar el coste.
- [x] Otra: **No usar Proxy BYOK (`Override OpenAI Base URL`):** Descartado porque en cuentas Enterprise no captura los modelos incluidos en la suscripción corporativa y suele estar restringido por políticas de seguridad.

---

## 10. 📌 Priorización y Fases

### Fase 1 - Prueba de Concepto (Gasto de hoy en minutos)
- [x] Crear script ligero de Cursor Hooks (`~/.cursor/hooks.json` + `track-spend.mjs`) para `beforeSubmitPrompt` y `afterAgentResponse`.
- [x] Calcular coste en USD evitando doble conteo de caché y guardar en log local `.jsonl`.
- [x] Comando CLI (`--today` y `--prompts`) que muestre el gasto acumulado de hoy, tabla por modelo y detalle de prompts.

### Fase 2 - Backend, Base de Datos y Motor de Precios (MVP Core)
- [x] Inicializar monorepo TypeScript (`packages/shared`, `apps/backend`, `apps/dashboard`, `apps/hooks`).
- [x] Implementar fórmula de precios con tests unitarios en `packages/shared` y servicio de tarifas (OpenRouter + LiteLLM + overrides).
- [x] Crear base de datos SQLite (`WAL` + `gzip`) y endpoints REST (`POST /api/events`, `GET /api/health`, `GET /api/stats/summary`, `GET /api/stats/by-model`, `GET /api/stats/timeseries`, `GET /api/prompts`, `GET /api/prompts/:id`).
- [x] Conectar los Cursor Hooks al backend local con fallback automático a buffer `.jsonl`.

### Fase 3 - Dashboard Visual (MVP UI)
- [x] Construir interfaz oscura en React + Tailwind + TanStack Query + Recharts.
- [x] Implementar `FilterBar`, `KpiCards`, `CostByModelChart`, `ContextVsCostScatter`, `PromptsTable` (toggle turnos/sesiones + semáforo de coste) y `PromptInspectorDrawer`.
- [x] Añadir script `seed` para probar el dashboard con datos simulados y documentar instalación paso a paso en `README.md`.

### Fase 4 - Mejoras y Conciliación Enterprise (Post-MVP)
- [x] Importador de CSV de `cursor.com/dashboard` > *Usage* para conciliar costes reales y subagentes (`RF-10`).
- [ ] Conector opcional a Cursor Enterprise Admin API (`RF-11` — *pendiente: requiere Admin API Key corporativa de IT*).
- [x] Indicadores automáticos de "malos hábitos" de prompting (`RF-12`), política de retención de payloads (`RF-13`) y exportación de informes CSV/JSON (`RF-14`).

---

## 📝 Notas Adicionales

### Fórmula exacta de cálculo de coste (Regla crítica para evitar doble conteo)
En los eventos de `afterAgentResponse` de Cursor, `input_tokens` suele incluir los tokens servidos o escritos en caché. La fórmula base implementada en `packages/shared` debe ser:

$$\text{uncached\_in} = \max\left(0,\; \text{input\_tokens} - \text{cache\_read\_tokens} - \text{cache\_write\_tokens}\right)$$

$$\text{cost\_usd} = \frac{(\text{uncached\_in} \times P_{\text{in}}) + (\text{cache\_read} \times P_{\text{cache\_read}}) + (\text{cache\_write} \times P_{\text{cache\_write}}) + (\text{output\_tokens} \times P_{\text{out}})}{1{,}000{,}000}$$

### Reglas clave para el agente de código que implemente este proyecto
1. Ejecutar estrictamente fase por fase, verificando compilación (`typecheck`) y tests antes de avanzar.
2. En Windows, tener en cuenta que `~` en `hooks.json` puede no expandirse igual que en macOS/Linux; documentar el uso de ruta absoluta o generar un script instalador (`pnpm run install-hooks`) que resuelva `os.homedir()` automáticamente.
3. En `beforeSubmitPrompt` y `afterAgentResponse`, manejar campos opcionales defensivamente y guardar el payload crudo del hook en `raw_hook_json_gzip` para facilitar depuración ante futuras actualizaciones de Cursor.