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
  return m > 0 ? `${m}m` : '<1m';
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

function inferWindowSuffix(resetSec: number): string {
  if (!resetSec || resetSec <= 0) return '';
  if (resetSec > 18 * 3600) return '7d';
  return '5h';
}

function shortenBucketLabel(rawKey: string, resetSec = 0): string {
  const k = rawKey.trim();
  const lower = k.toLowerCase();
  const explicitWin = lower.includes('weekly') || lower.includes('7d') || lower.includes('7-day')
    ? '7d'
    : lower.includes('5h') || lower.includes('5-hour')
      ? '5h'
      : inferWindowSuffix(resetSec);

  if (lower.includes('claude') && (lower.includes('gpt') || lower.includes('pool') || (!lower.includes('sonnet') && !lower.includes('opus') && !lower.includes('haiku')))) {
    return explicitWin ? `claude ${explicitWin}` : 'claude';
  }
  if (lower.includes('sonnet')) {
    const ver = k.match(/\d+(?:\.\d+)?/)?.[0] ?? '';
    return ver ? `sonnet ${ver}` : 'sonnet';
  }
  if (lower.includes('opus')) {
    const ver = k.match(/\d+(?:\.\d+)?/)?.[0] ?? '';
    return ver ? `opus ${ver}` : 'opus';
  }
  if (lower.includes('haiku')) {
    const ver = k.match(/\d+(?:\.\d+)?/)?.[0] ?? '';
    return ver ? `haiku ${ver}` : 'haiku';
  }
  if (lower.includes('flash')) return explicitWin === '7d' ? 'flash 7d' : 'flash';
  if (lower.includes('argon')) return 'argon';
  if (lower.includes('pro')) return explicitWin === '7d' ? 'pro 7d' : 'pro';
  if (lower.includes('gemini')) return explicitWin ? `gemini ${explicitWin}` : 'gemini';
  const cleaned = k.replace(/\s*\(.*?\)\s*/g, '').replace(/^gemini\s+/i, '').replace(/^claude\s+/i, '').trim();
  return cleaned.length > 12 ? cleaned.slice(0, 12) : (cleaned || k);
}

function bucketPool(key: string): 'claude' | 'argon' | 'gemini' | 'other' {
  const k = key.toLowerCase();
  if (k.includes('claude') || k.includes('sonnet') || k.includes('opus') || k.includes('haiku') || k.includes('gpt')) return 'claude';
  if (k.includes('argon')) return 'argon';
  if (k.includes('gemini') || k.includes('flash') || k.includes('pro')) return 'gemini';
  return 'other';
}

function isActiveModelBucket(key: string, data: AgyStatusData): boolean {
  const k = key.toLowerCase();
  const mName = (data.model?.display_name ?? '').toLowerCase();
  const mId = (data.model?.id ?? '').toLowerCase();
  if (k && (mName.includes(k) || mId.includes(k))) return true;
  for (const token of ['sonnet', 'opus', 'haiku', 'flash', 'argon', 'pro']) {
    if (k.includes(token) && (mName.includes(token) || mId.includes(token))) return true;
  }
  // If active model is Sonnet/Opus and bucket is a shared Claude/GPT pool
  if ((mName.includes('claude') || mName.includes('sonnet') || mName.includes('opus')) && bucketPool(key) === 'claude') {
    return true;
  }
  return false;
}

function extractLimits(data: AgyStatusData): RemoteLimit[] {
  const out: RemoteLimit[] = [];

  // 1. Quota map if provided natively by Antigravity (includes Gemini + Argon + Claude/GPT pools)
  if (data.quota && typeof data.quota === 'object') {
    const entries = Object.entries(data.quota)
      .filter(([, bucket]) => bucket && typeof bucket === 'object' && !bucket.disabled);

    // Sort active model's bucket first, then prefer showing distinct pools (Gemini/Argon + Claude), then by highest utilization
    entries.sort(([keyA, a], [keyB, b]) => {
      const actA = isActiveModelBucket(keyA, data) ? 1 : 0;
      const actB = isActiveModelBucket(keyB, data) ? 1 : 0;
      if (actA !== actB) return actB - actA;
      const pctA = typeof a.remaining_fraction === 'number' ? (1 - a.remaining_fraction) * 100 : (a.used_percentage ?? 0);
      const pctB = typeof b.remaining_fraction === 'number' ? (1 - b.remaining_fraction) * 100 : (b.used_percentage ?? 0);
      return pctB - pctA;
    });

    const seenLabels = new Set<string>();
    for (const [key, bucket] of entries) {
      const rawPct = typeof bucket.remaining_fraction === 'number'
        ? (1 - bucket.remaining_fraction) * 100
        : bucket.used_percentage;
      const pct = clampPercent(rawPct);
      const nowSec = Math.floor(Date.now() / 1000);
      const resetsAt = typeof bucket.reset_in_seconds === 'number' && bucket.reset_in_seconds > 0
        ? nowSec + bucket.reset_in_seconds
        : parseResetTime(bucket.reset_time ?? bucket.resets_at);
      const resetSec = resetsAt > nowSec ? resetsAt - nowSec : (bucket.reset_in_seconds ?? 0);
      const label = shortenBucketLabel(key, resetSec);
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);
      out.push({ label, percent: pct, resetsAt });
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
    const active = limits.slice(0, 2);

    const formatted = active.map(l => {
      const pctStr = `${l.percent}%`;
      const resetTime = l.resetsAt ? formatResetTime(l.resetsAt) : '';
      const resetRaw = resetTime ? `↻ ${resetTime}` : '';
      return {
        limit: l,
        pctStr,
        resetRaw,
        label: l.label,
      };
    });

    const maxPctLen = Math.max(...formatted.map(r => r.pctStr.length));
    const hasAnyReset = formatted.some(r => r.resetRaw.length > 0);
    const maxResetLen = hasAnyReset ? Math.max(...formatted.map(r => r.resetRaw.length)) : 0;
    const maxLabelLen = Math.max(...formatted.map(r => r.label.length));

    const rows = formatted.map(r => {
      const bar = renderBar(r.limit.percent, BAR_WIDTH);
      const paddedPct = ' '.repeat(maxPctLen - r.pctStr.length) + r.pctStr;
      const pctColorStr = color(paddedPct, pctColor(r.limit.percent), c.bold);

      let resetColorStr = '';
      if (hasAnyReset && r.resetRaw) {
        const paddedReset = r.resetRaw + ' '.repeat(maxResetLen - r.resetRaw.length);
        resetColorStr = color(paddedReset, c.dim);
      }

      const paddedLabel = ' '.repeat(maxLabelLen - r.label.length) + r.label;
      const lbl = color(paddedLabel, c.dim);

      const parts = [bar, pctColorStr, resetColorStr, lbl].filter(Boolean);
      return parts.join(color(' · ', c.dim));
    });

    const width = Math.max(...rows.map(visibleLength));
    const paddedRows = rows.map(r => padRight(r, width));

    return { id: 'usage', priority: 25, width, lines: paddedRows };
  },
};
