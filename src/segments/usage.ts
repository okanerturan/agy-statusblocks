import type { Segment, AgyStatusData } from '../types.js';
import { color, c, visibleLength, padRight, pctColor, renderBar } from '../colors.js';
import { readRemoteLimits, type RemoteLimit } from '../remote-usage.js';

const MS_PER_DAY = 86400000;
const MS_PER_HOUR = 3600000;
const MS_PER_MIN = 60000;

function formatResetTime(epochSec: number): string {
  if (!epochSec) return '';
  const ms = epochSec * 1000 - Date.now();
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / MS_PER_DAY);
  const h = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
  if (d > 0) return `${d}d${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}m` : ''}`;
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ''}`;
  return `${m}m`;
}

function clampPercent(v: number | undefined): number {
  return Math.min(999, Math.max(0, Math.round(v ?? 0)));
}

function parseResetTime(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v > 1e11 ? Math.floor(v / 1000) : v;
  }
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

function extractLimits(data: AgyStatusData): RemoteLimit[] {
  const out: RemoteLimit[] = [];

  // 1. Quota map if provided by Antigravity
  if (data.quota && typeof data.quota === 'object') {
    for (const [key, bucket] of Object.entries(data.quota)) {
      if (!bucket || typeof bucket !== 'object') continue;
      const pct = clampPercent(bucket.used_percentage);
      const resetsAt = parseResetTime(bucket.reset_time ?? bucket.resets_at);
      out.push({ label: key, percent: pct, resetsAt });
    }
  }

  // 2. Rate limits if provided
  const rl = data.rate_limits;
  if (rl) {
    if (rl.five_hour) {
      out.push({
        label: '5h',
        percent: clampPercent(rl.five_hour.used_percentage),
        resetsAt: parseResetTime(rl.five_hour.resets_at),
      });
    }
    if (rl.seven_day) {
      out.push({
        label: '7d',
        percent: clampPercent(rl.seven_day.used_percentage),
        resetsAt: parseResetTime(rl.seven_day.resets_at),
      });
    }
    if (rl.daily) {
      out.push({
        label: 'daily',
        percent: clampPercent(rl.daily.used_percentage),
        resetsAt: parseResetTime(rl.daily.resets_at),
      });
    }
  }

  // 3. Fallback to cached remote usage
  if (out.length === 0) {
    const remote = readRemoteLimits();
    if (remote && remote.length > 0) {
      const now = Date.now() / 1000;
      return remote.map(l => (l.resetsAt > 0 && l.resetsAt <= now ? { ...l, percent: 0 } : l));
    }
  }

  return out;
}

export const usageSegment: Segment = {
  id: 'usage',
  priority: 25,
  enabled: (data) => extractLimits(data).length > 0,
  render(data) {
    const limits = extractLimits(data);
    if (limits.length === 0) {
      return { id: 'usage', priority: 25, width: 0, lines: [''] };
    }

    const BAR_WIDTH = 8;
    const rows = limits.slice(0, 2).map(l => {
      const bar = renderBar(l.percent, BAR_WIDTH);
      const pctStr = color(`${l.percent}%`, pctColor(l.percent), c.bold);
      const reset = l.resetsAt ? color(`↻ ${formatResetTime(l.resetsAt)}`, c.dim) : '';
      const lbl = color(l.label, c.dim);

      const parts = [bar, pctStr, reset, lbl].filter(Boolean);
      return parts.join(color(' · ', c.dim));
    });

    const width = Math.max(...rows.map(visibleLength));
    const paddedRows = rows.map(r => padRight(r, width));

    return { id: 'usage', priority: 25, width, lines: paddedRows };
  },
};
