import { mkdirSync, readFileSync, writeFileSync, renameSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

function cacheDir(create: boolean): string {
  const override = process.env['AGY_STATUSBLOCKS_CACHE_DIR'];
  const uid = typeof process.getuid === 'function' ? `-${process.getuid()}` : '';
  const dir = override || join(tmpdir(), `agy-statusblocks${uid}`);
  if (create) mkdirSync(dir, { recursive: true });
  return dir;
}

export function hashKey(str: string): string {
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

export function safeKey(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function readCacheEntry(name: string): { ts: number; value: unknown } | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(cacheDir(false), name), 'utf8'));
    if (typeof raw?.ts !== 'number') return undefined;
    return { ts: raw.ts, value: raw.value };
  } catch {
    return undefined;
  }
}

export function readCache<T>(name: string, ttlMs: number): T | undefined {
  const entry = readCacheEntry(name);
  if (entry === undefined || Date.now() - entry.ts > ttlMs) return undefined;
  return entry.value as T;
}

export function writeCache(name: string, value: unknown): void {
  try {
    const dir = cacheDir(true);
    const tmp = join(dir, `${name}.tmp-${process.pid}`);
    writeFileSync(tmp, JSON.stringify({ ts: Date.now(), value }));
    renameSync(tmp, join(dir, name));
  } catch {
    // Best-effort
  }
}

export function acquireMarker(name: string, ttlMs: number): boolean {
  try {
    const path = join(cacheDir(true), name);
    try {
      writeFileSync(path, String(Date.now()), { flag: 'wx' });
      return true;
    } catch {
      if (Date.now() - statSync(path).mtimeMs <= ttlMs) return false;
      unlinkSync(path);
      writeFileSync(path, String(Date.now()), { flag: 'wx' });
      return true;
    }
  } catch {
    return false;
  }
}
