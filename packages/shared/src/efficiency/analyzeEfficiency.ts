import type { PromptEvent, SessionSummary } from '../types/events_efficiency_types.js';

export type EfficiencySeverity = 'info' | 'warning' | 'danger';

export type EfficiencyRuleCode =
  | 'high_input_output_ratio'
  | 'low_cache_hit'
  | 'heavy_model_trivial_prompt'
  | 'high_cost_turn'
  | 'long_session';

export interface EfficiencyAlert {
  code: EfficiencyRuleCode;
  severity: EfficiencySeverity;
  label: string;
  suggestion: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function isHeavyModel(model: string): boolean {
  const lower = (model || '').toLowerCase();
  return (
    lower.includes('opus') ||
    lower.includes('sonnet') ||
    lower.includes('thinking-high') ||
    lower.includes('o3')
  );
}

/**
 * Evalúa hábitos de eficiencia sobre un turno individual.
 */
export function analyzeTurnEfficiency(event: PromptEvent): EfficiencyAlert[] {
  const alerts: EfficiencyAlert[] = [];
  const input = event.input_tokens || 0;
  const output = event.output_tokens || 0;
  const cacheRead = event.cache_read_tokens || 0;

  if (event.cost_usd > 0.15) {
    alerts.push({
      code: 'high_cost_turn',
      severity: 'danger',
      label: 'Turno costoso',
      suggestion: 'Divide tareas complejas en pasos más pequeños o inicia un chat nuevo para reducir el historial arrastrado.',
    });
  }

  if (input >= 10_000 && output > 0) {
    const ratio = input / output;
    if (ratio > 50) {
      alerts.push({
        code: 'high_input_output_ratio',
        severity: 'danger',
        label: `Ratio ${Math.round(ratio)}:1`,
        suggestion: 'Se envió mucho contexto para una respuesta corta. Abre un chat nuevo para preguntas puntuales.',
      });
    } else if (ratio > 20) {
      alerts.push({
        code: 'high_input_output_ratio',
        severity: 'warning',
        label: `Ratio ${Math.round(ratio)}:1`,
        suggestion: 'Ratio Entrada/Salida superior a 20:1; revisa si estás adjuntando archivos innecesarios.',
      });
    }
  }

  if (input >= 20_000) {
    const cacheHitPct = (cacheRead / input) * 100;
    if (cacheHitPct < 40) {
      alerts.push({
        code: 'low_cache_hit',
        severity: 'warning',
        label: `Caché baja (${Math.round(cacheHitPct)}%)`,
        suggestion: 'Bajo aprovechamiento de caché en un contexto grande; evita cambiar de modelo o alterar archivos base a mitad de sesión.',
      });
    }
  }

  const promptWords = countWords(event.prompt_preview || '');
  if (
    isHeavyModel(event.model) &&
    promptWords > 0 &&
    promptWords <= 15 &&
    output <= 800 &&
    (input >= 20_000 || event.cost_usd >= 0.05)
  ) {
    alerts.push({
      code: 'heavy_model_trivial_prompt',
      severity: 'warning',
      label: 'Modelo pesado en consulta corta',
      suggestion: 'Para preguntas breves o comprobaciones rápidas, usa un modelo ligero (ej. Flash/Mini/Haiku sin thinking-high) o un chat limpio.',
    });
  }

  return alerts;
}

/**
 * Evalúa hábitos de eficiencia sobre una sesión agrupada.
 */
export function analyzeSessionEfficiency(session: SessionSummary): EfficiencyAlert[] {
  const alerts: EfficiencyAlert[] = [];

  if (session.turn_count > 10) {
    alerts.push({
      code: 'long_session',
      severity: 'warning',
      label: `Hilo largo (${session.turn_count} turnos)`,
      suggestion: 'Conversación con muchos turnos acumulados; abrir un chat nuevo evita reenviar todo el historial en cada prompt.',
    });
  }

  if (session.total_input_tokens >= 20_000 && session.total_output_tokens > 0) {
    const ratio = session.total_input_tokens / session.total_output_tokens;
    if (ratio > 25) {
      alerts.push({
        code: 'high_input_output_ratio',
        severity: ratio > 50 ? 'danger' : 'warning',
        label: `Ratio ${Math.round(ratio)}:1`,
        suggestion: 'El contexto acumulado de la sesión domina el consumo de tokens.',
      });
    }
  }

  return alerts;
}
