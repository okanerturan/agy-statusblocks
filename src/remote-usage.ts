import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { readCacheEntry, writeCache, acquireMarker } from './cache.js';
import { spawnDetached } from './spawn.js';

export interface RemoteLimit {
  label: string;
  percent: number;
  resetsAt: number;
  scope?: 'model' | 'surface';
  match?: string;
  id?: string;
}

export const REMOTE_USAGE_CACHE = 'remote-usage';
const REFRESH_THROTTLE_MARKER = 'remote-usage-attempt';
const DISPLAY_TTL = 3600000; // 1 hour
const REFRESH_INTERVAL = 60000; // 1 minute

export const KIND_LABELS: Record<string, string> = {
  session: '5h',
  weekly_all: '7d',
};
const KNOWN_GENERIC_KINDS = new Set(Object.keys(KIND_LABELS));

function clampPercent(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(999, Math.max(0, Math.round(v)));
}

export function normalizeLimits(raw: unknown): RemoteLimit[] {
  if (!Array.isArray(raw)) return [];
  const out: RemoteLimit[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const percent = clampPercent(e.percent);
    if (percent === null) continue;

    let resetsAt = 0;
    if (typeof e.resets_at === 'string') {
      const ms = Date.parse(e.resets_at);
      if (Number.isFinite(ms)) resetsAt = Math.floor(ms / 1000);
    }

    const kind = typeof e.kind === 'string' ? e.kind : '';
    if (KNOWN_GENERIC_KINDS.has(kind)) {
      out.push({ label: KIND_LABELS[kind]!, percent, resetsAt });
      continue;
    }

    const scope = e.scope as { model?: { id?: unknown; display_name?: unknown } | null; surface?: unknown } | null | undefined;
    const modelName = typeof scope?.model?.display_name === 'string' ? scope.model.display_name : '';
    const modelId = typeof scope?.model?.id === 'string' ? scope.model.id : '';
    const surface = typeof scope?.surface === 'string' ? scope.surface : '';

    if (surface) continue;
    if (modelName || modelId) {
      out.push({
        label: modelName || modelId,
        percent,
        resetsAt,
        scope: 'model',
        match: (modelName || modelId).toLowerCase(),
        id: modelId || undefined,
      });
    }
  }
  return out;
}

export function storeRemoteLimits(limits: RemoteLimit[]): void {
  writeCache(REMOTE_USAGE_CACHE, limits);
}

function remoteUsageDisabled(): boolean {
  return !!(process.env['AGY_STATUSBLOCKS_NO_REMOTE'] || process.env['CLAUDE_STATUSBLOCKS_NO_REMOTE']);
}

export function readRemoteLimits(): RemoteLimit[] | null {
  if (remoteUsageDisabled()) return null;
  const entry = readCacheEntry(REMOTE_USAGE_CACHE);
  if (!entry || Date.now() - entry.ts > DISPLAY_TTL) return null;
  if (!Array.isArray(entry.value)) return null;
  return entry.value as RemoteLimit[];
}

export function maybeRefreshRemoteUsage(): void {
  if (remoteUsageDisabled()) return;
  const entry = readCacheEntry(REMOTE_USAGE_CACHE);
  const isFresh = entry && Date.now() - entry.ts < REFRESH_INTERVAL;
  if (isFresh) return;

  if (!acquireMarker(REFRESH_THROTTLE_MARKER, REFRESH_INTERVAL)) return;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const script = join(here, 'remote-usage-fetch.js');
    spawnDetached(process.execPath, [script]);
  } catch {
    // Best-effort
  }
}
