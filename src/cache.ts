import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

const CACHE_DIR = join(tmpdir(), 'agy-statusblocks-cache');

export function hashKey(str: string): string {
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

export function safeKey(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function readCache<T>(key: string, ttlMs: number): T | undefined {
  try {
    const file = join(CACHE_DIR, `${key}.json`);
    const content = readFileSync(file, 'utf8');
    const { timestamp, data } = JSON.parse(content);
    if (Date.now() - timestamp > ttlMs) return undefined;
    return data as T;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const file = join(CACHE_DIR, `${key}.json`);
    writeFileSync(file, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Non-blocking best-effort
  }
}
