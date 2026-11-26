import { describe, expect, it } from 'vitest';
import { analyzeSessionEfficiency, analyzeTurnEfficiency } from './analyzeEfficiency.js';

describe('analyzeEfficiency', () => {
  it('detecta ratio alto, modelo pesado en consulta corta y coste elevado', () => {
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
      cost_usd: 0.0516,
      cost_source: 'calculated',
      duration_ms: 14_678,
      source: 'cursor_hook',
    });

    const codes = alerts.map((a) => a.code);
    expect(codes).toContain('high_input_output_ratio');
    expect(codes).toContain('heavy_model_trivial_prompt');
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
