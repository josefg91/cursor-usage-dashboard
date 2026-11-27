export function formatUsd(value: number, decimals = 4): string {
  const n = Number(value) || 0;
  return `$${n.toFixed(decimals)}`;
}

export function formatNumber(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString('es-ES');
}

export function formatCompactTokens(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Semáforo visual de coste por turno:
 * < $0.05 normal (esmeralda), $0.05–$0.15 ámbar, > $0.15 rojo.
 */
export function getCostSeverity(costUsd: number): {
  level: 'normal' | 'warning' | 'danger';
  textClass: string;
  badgeClass: string;
} {
  if (costUsd > 0.15) {
    return {
      level: 'danger',
      textClass: 'text-rose-400',
      badgeClass: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    };
  }
  if (costUsd >= 0.05) {
    return {
      level: 'warning',
      textClass: 'text-amber-400',
      badgeClass: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    };
  }
  return {
    level: 'normal',
    textClass: 'text-emerald-400',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  };
}

/**
 * Colores por familia de modelo (púrpura Claude, verde GPT, azul Gemini, cian DeepSeek).
 */
export function getModelColor(model: string): string {
  const lower = (model || '').toLowerCase();
  if (lower.includes('claude')) {
    if (lower.includes('opus')) return '#c084fc';
    if (lower.includes('haiku')) return '#818cf8';
    return '#a855f7';
  }
  if (lower.includes('gpt') || lower.includes('o3') || lower.includes('o4')) {
    return '#10b981';
  }
  if (lower.includes('gemini')) {
    return '#3b82f6';
  }
  if (lower.includes('deepseek')) {
    return '#06b6d4';
  }
  return '#94a3b8';
}

const SESSION_PALETTE = [
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#fb7185', // rose-400
  '#22d3ee', // cyan-400
  '#e879f9', // fuchsia-400
  '#a3e635', // lime-400
  '#fb923c', // orange-400
  '#818cf8', // indigo-400
];

/**
 * Devuelve un color determinista por conversation_id para identificar visualmente turnos de la misma sesión.
 */
export function getSessionColor(conversationId: string): string {
  const value = (conversationId || '').trim();
  if (!value) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return SESSION_PALETTE[hash % SESSION_PALETTE.length]!;
}

export function formatSessionId(conversationId: string, maxLength = 12): string {
  const trimmed = (conversationId || '').trim();
  if (!trimmed) return '—';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}
