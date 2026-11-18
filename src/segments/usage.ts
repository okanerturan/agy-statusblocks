import type { Segment, AgyStatusData, AgyQuotaBucket } from '../types.js';
import { color, c, visibleLength, padRight, pctColor, renderMeterBar } from '../colors.js';
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

function detectWindow(rawKey: string, resetSec = 0, cycleMode?: string): '5h' | 'daily' | '7d' | '' {
  const combined = `${rawKey} ${cycleMode ?? ''}`.toLowerCase();
  if (
    combined.includes('weekly') ||
    combined.includes('7d') ||
    combined.includes('7-day') ||
    combined.includes('seven_day')
  ) {
    return '7d';
  }
  if (
    combined.includes('daily') ||
    combined.includes('24h') ||
    combined.includes('24-hour') ||
    combined.includes('1d')
  ) {
    return 'daily';
  }
  if (
    combined.includes('5h') ||
    combined.includes('5-hour') ||
    combined.includes('five_hour') ||
    combined.includes('session') ||
    combined.includes('rolling')
  ) {
    return '5h';
  }
  const inferred = inferWindowSuffix(resetSec);
  return inferred === '7d' || inferred === '5h' ? inferred : '';
}

function windowRank(win: string): number {
  if (win === '5h') return 0;
  if (win === '7d') return 2;
  return 1;
}

function is3pKey(lower: string): boolean {
  return lower === '3p' || lower.startsWith('3p-') || lower.startsWith('3p_') || lower.startsWith('3p ');
}

function shortenBucketLabel(rawKey: string, resetSec = 0, cycleMode?: string): string {
  const k = rawKey.trim();
  const lower = k.toLowerCase();
  const explicitWin = detectWindow(rawKey, resetSec, cycleMode);

  // "3p-5h" / "3p-weekly": Antigravity's third-party (Claude/GPT) pool
  if (is3pKey(lower)) return explicitWin ? `claude ${explicitWin}` : 'claude';

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
  if (lower.includes('carbon')) return explicitWin === '7d' ? 'carbon 7d' : 'carbon';
  if (lower.includes('hydrogen')) return explicitWin === '7d' ? 'hydrogen 7d' : 'hydrogen';
  if (lower.includes('orchestrator')) return explicitWin ? `orch ${explicitWin}` : 'orchestrator';
  if (lower.includes('pro')) return explicitWin === '7d' ? 'pro 7d' : 'pro';
  if (lower.includes('gemini')) return explicitWin ? `gemini ${explicitWin}` : 'gemini';
  const cleaned = k.replace(/\s*\(.*?\)\s*/g, '').replace(/^gemini\s+/i, '').replace(/^claude\s+/i, '').trim();
  return cleaned.length > 12 ? cleaned.slice(0, 12) : (cleaned || k);
}

function bucketPool(key: string): 'claude' | 'argon' | 'gemini' | 'other' {
  const k = key.toLowerCase();
  if (is3pKey(k) || k.includes('claude') || k.includes('sonnet') || k.includes('opus') || k.includes('haiku') || k.includes('gpt')) return 'claude';
  if (k.includes('argon')) return 'argon';
  if (
    k.includes('gemini') ||
    k.includes('flash') ||
    k.includes('pro') ||
    k.includes('carbon') ||
    k.includes('hydrogen') ||
    k.includes('orchestrator')
  ) {
    return 'gemini';
  }
  return 'other';
}

function activeBucketRank(key: string, data: AgyStatusData, hasExplicitArgonBucket = false): number {
  const k = key.toLowerCase();
  const mName = (data.model?.display_name ?? '').toLowerCase();
  const mId = (data.model?.id ?? '').toLowerCase();
  const modelText = `${mName} ${mId}`.trim();
  const is3pModel = /claude|sonnet|opus|haiku|gpt|\bo[134]\b|3p/i.test(modelText);
  const isOrchestrator = modelText.includes('orchestrator');

  if (k && (mName.includes(k) || mId.includes(k))) return 2;
  for (const token of ['sonnet', 'opus', 'haiku', 'flash', 'argon', 'carbon', 'hydrogen']) {
    if (k.includes(token) && modelText.includes(token)) return 2;
  }
  if (/\bpro\b/i.test(k) && /\bpro\b/i.test(mName)) return 2;

  const pool = bucketPool(key);
  if (is3pModel) {
    return pool === 'claude' ? 1 : 0;
  }

  // First-party Gemini / Orchestrator models (Carbon, Hydrogen, Flash, Argon without dedicated bucket)
  if (pool === 'gemini' && (!modelText.includes('argon') || !hasExplicitArgonBucket || isOrchestrator)) {
    return 1;
  }
  return 0;
}

function resolveBucketReset(bucket: AgyQuotaBucket, nowSec: number): { resetsAt: number; resetSec: number } {
  const resetsAt = typeof bucket.reset_in_seconds === 'number' && bucket.reset_in_seconds > 0
    ? nowSec + bucket.reset_in_seconds
    : parseResetTime(bucket.reset_time ?? bucket.resets_at);
  const resetSec = resetsAt > nowSec ? resetsAt - nowSec : (bucket.reset_in_seconds ?? 0);
  return { resetsAt, resetSec };
}

function extractLimits(data: AgyStatusData): RemoteLimit[] {
  const out: RemoteLimit[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Quota map if provided natively by Antigravity (includes Gemini + Argon + Claude/GPT pools)
  if (data.quota && typeof data.quota === 'object') {
    const entries = Object.entries(data.quota)
      .filter(([, bucket]) => bucket && typeof bucket === 'object' && !bucket.disabled);
    const hasExplicitArgonBucket = entries.some(([k]) => bucketPool(k) === 'argon');

    // Sort direct model match > active provider pool > others; within active tiers order 5h before daily before 7d
    entries.sort(([keyA, a], [keyB, b]) => {
      const rankA = activeBucketRank(keyA, data, hasExplicitArgonBucket);
      const rankB = activeBucketRank(keyB, data, hasExplicitArgonBucket);
      if (rankA !== rankB) return rankB - rankA;
      if (rankA > 0 && rankA === rankB) {
        const { resetSec: resetSecA } = resolveBucketReset(a, nowSec);
        const { resetSec: resetSecB } = resolveBucketReset(b, nowSec);
        const winDiff =
          windowRank(detectWindow(keyA, resetSecA, a.cycle_mode)) -
          windowRank(detectWindow(keyB, resetSecB, b.cycle_mode));
        if (winDiff !== 0) return winDiff;
      }
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
      const { resetsAt, resetSec } = resolveBucketReset(bucket, nowSec);
      const label = shortenBucketLabel(key, resetSec, bucket.cycle_mode);
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);
      out.push({ label, percent: pct, resetsAt });
    }
  }

  // 2. Rate limits if provided (only when native quota map produced no entries)
  const rl = data.rate_limits;
  if (out.length === 0 && rl) {
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
    const sep = color(' · ', c.dim);

    const rows = formatted.map(r => {
      const bar = renderMeterBar(r.limit.percent, BAR_WIDTH);
      const paddedPct = ' '.repeat(maxPctLen - r.pctStr.length) + r.pctStr;
      const pctColorStr = color(paddedPct, pctColor(r.limit.percent), c.bold);
      const paddedLabel = ' '.repeat(maxLabelLen - r.label.length) + r.label;
      const lbl = color(paddedLabel, c.dim);

      if (!hasAnyReset) {
        return `${bar}${sep}${pctColorStr}${sep}${lbl}`;
      }
      if (r.resetRaw) {
        const paddedReset = r.resetRaw + ' '.repeat(maxResetLen - r.resetRaw.length);
        return `${bar}${sep}${pctColorStr}${sep}${color(paddedReset, c.dim)}${sep}${lbl}`;
      }
      // Keep label column aligned with rows that have a reset timer, without a double '·'
      return `${bar}${sep}${pctColorStr}${' '.repeat(3 + maxResetLen)}${sep}${lbl}`;
    });

    const width = Math.max(...rows.map(visibleLength));
    const paddedRows = rows.map(r => padRight(r, width));

    return { id: 'usage', priority: 25, width, lines: paddedRows };
  },
};
