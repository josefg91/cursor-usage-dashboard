import { describe, expect, it } from 'vitest';
import { analyzeSessionEfficiency, analyzeTurnEfficiency } from './analyzeEfficiency.js';

describe('analyzeEfficiency', () => {
  it('detecta ratio alto y razonamiento alto en consulta corta para Haiku sin marcarlo como modelo caro', () => {
    const alerts = analyzeTurnEfficiency({
      id: '1',
      conversation_id: 'c1',
      timestamp: '2026-11-26T11:36:56.395Z',
      model: 'claude-haiku-5-5-thinking-high',
      prompt_preview: 'esta mi rama en origin ya?',
      input_tokens: 85_105,
      uncached_input_tokens: 6,
      cache_read_tokens: 50_826,
      cache_write_tokens: 34_273,
      output_tokens: 725,
      reasoning_tokens: 0,
      cost_usd: 0.0026,
      cost_source: 'calculated',
      duration_ms: 14_678,
      source: 'cursor_hook',
    });

    const codes = alerts.map((a) => a.code);
    expect(codes).toContain('high_input_output_ratio');
    expect(codes).toContain('high_reasoning_trivial_prompt');
    expect(codes).not.toContain('expensive_model_trivial_prompt');
  });

  it('marca modelo caro en consulta corta cuando se usa Opus o Sonnet', () => {
    const alerts = analyzeTurnEfficiency({
      id: '2',
      conversation_id: 'c2',
      timestamp: '2026-11-26T11:36:56.395Z',
      model: 'claude-4-opus',
      prompt_preview: 'esta mi rama en origin ya?',
      input_tokens: 30_000,
      uncached_input_tokens: 5_000,
      cache_read_tokens: 25_000,
      cache_write_tokens: 0,
      output_tokens: 200,
      reasoning_tokens: 0,
      cost_usd: 0.12,
      cost_source: 'calculated',
      duration_ms: 4000,
      source: 'cursor_hook',
    });

    expect(alerts.map((a) => a.code)).toContain('expensive_model_trivial_prompt');
  });

  it('detecta sesiones demasiado largas', () => {
    const alerts = analyzeSessionEfficiency({
      conversation_id: 'c-long',
      started_at: '2026-11-26T09:00:00Z',
      last_activity_at: '2026-11-26T11:00:00Z',
      turn_count: 14,
      models: ['claude-3.7-sonnet'],
      first_prompt_preview: 'Construye el servicio',
      total_input_tokens: 300_000,
      total_output_tokens: 10_000,
      total_cost_usd: 1.25,
    });

    expect(alerts.map((a) => a.code)).toContain('long_session');
    expect(alerts.map((a) => a.code)).toContain('high_input_output_ratio');
  });
});
