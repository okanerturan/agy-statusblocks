import type { Segment } from '../types.js';
import { color, c, visibleLength, pctColor, renderBar } from '../colors.js';

function formatTokens(n: number): string {
  const safe = Math.max(0, Math.round(n || 0));
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${Math.round(safe / 1000)}K`;
  return String(safe);
}

export const contextSegment: Segment = {
  id: 'context',
  priority: 10,
  enabled: () => true,
  render(data) {
    const total = data.context_window.context_window_size || 1048576;
    let pct = data.context_window.used_percentage != null
      ? Math.floor(data.context_window.used_percentage)
      : 0;

    const inTokens = data.context_window.total_input_tokens ?? 0;
    const outTokens = data.context_window.total_output_tokens ?? 0;
    const used = inTokens + outTokens;

    if (pct === 0 && used > 0 && total > 0) {
      pct = Math.floor((used / total) * 100);
    }

    const barColor = pctColor(pct);
    const info = `${color(`${pct}%`, barColor, c.bold)}${color(' · ', c.dim)}${color(`${formatTokens(used)}/${formatTokens(total)}`, c.dim)}`;
    const cardWidth = Math.max(16, visibleLength(info));

    const lines = [renderBar(pct, cardWidth), info];
    return { id: 'context', priority: 10, width: cardWidth, lines };
  },
};
