import type { Segment } from '../types.js';
import { color, c, visibleLength, pctColor, renderBar } from '../colors.js';

function formatTokens(n: number): string {
  const safe = Math.max(0, Math.round(n || 0));
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${Math.round(safe / 1000)}K`;
  return String(safe);
}

function resolveContextUsage(
  total: number,
  rawPct: number | null | undefined,
  inTokens: number,
  outTokens: number,
): { pct: number; used: number } {
  if (rawPct != null && rawPct > 0) {
    const inPct = total > 0 ? (inTokens / total) * 100 : 0;
    const sumPct = total > 0 ? ((inTokens + outTokens) / total) * 100 : 0;
    const inDiff = Math.abs(inPct - rawPct);
    const sumDiff = Math.abs(sumPct - rawPct);

    let used: number;
    if (inTokens > 0 && inDiff <= sumDiff && inDiff <= 1) {
      // Antigravity sets total_input_tokens = estimated_tokens_used and
      // used_percentage = (estimated_tokens_used / context_window_size) * 100,
      // while leaving total_output_tokens as cumulative lifetime session output.
      used = inTokens;
    } else if (inTokens + outTokens > 0 && sumDiff <= 1) {
      // Fallback step-sum mode where used_percentage reflects inTokens + outTokens.
      used = inTokens + outTokens;
    } else {
      // Only used_percentage is reliable/present; derive used token count from it.
      used = Math.round((rawPct / 100) * total);
    }

    const pct = Math.min(100, Math.max(0, Math.round(rawPct)));
    return { pct, used };
  }

  const used = inTokens + outTokens;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
  return { pct, used };
}

export const contextSegment: Segment = {
  id: 'context',
  priority: 10,
  enabled: () => true,
  render(data) {
    const total = data.context_window.context_window_size || 1048576;
    const inTokens = data.context_window.total_input_tokens ?? 0;
    const outTokens = data.context_window.total_output_tokens ?? 0;
    const { pct, used } = resolveContextUsage(
      total,
      data.context_window.used_percentage,
      inTokens,
      outTokens,
    );

    const barColor = pctColor(pct);
    const info = `${color(`${pct}%`, barColor, c.bold)}${color(' · ', c.dim)}${color(`${formatTokens(used)}/${formatTokens(total)}`, c.dim)}`;
    const cardWidth = Math.max(16, visibleLength(info));

    const lines = [renderBar(pct, cardWidth), info];
    return { id: 'context', priority: 10, width: cardWidth, lines };
  },
};
