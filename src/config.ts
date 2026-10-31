import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StatusBlocksConfig, BorderStyle } from './types.js';

export const VALID_BORDER_STYLES: readonly BorderStyle[] = [
  'rounded',
  'square',
  'double',
  'thick',
  'ascii',
  'none',
] as const;

export function normalizeBorderStyle(val: unknown): BorderStyle | undefined {
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if ((VALID_BORDER_STYLES as readonly string[]).includes(lower)) {
      return lower as BorderStyle;
    }
  }
  return undefined;
}

export function loadConfig(): StatusBlocksConfig {
  const envSegments = process.env['AGY_STATUSBLOCKS_SEGMENTS'];
  const envBorder = process.env['AGY_STATUSBLOCKS_BORDER'];

  const config: StatusBlocksConfig = {};
  try {
    const raw = readFileSync(join(homedir(), '.agy-statusblocks.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.segments)) config.segments = parsed.segments.filter((s: unknown) => typeof s === 'string');
      if (typeof parsed.remoteUsage === 'boolean') config.remoteUsage = parsed.remoteUsage;
      if (typeof parsed.stackWithDefault === 'boolean') config.stackWithDefault = parsed.stackWithDefault;
      if (parsed.border) {
        const border = normalizeBorderStyle(parsed.border);
        if (border) config.border = border;
      }
    }
  } catch { /* no config file — use defaults */ }

  if (envSegments) config.segments = envSegments.split(',');
  if (envBorder) {
    const border = normalizeBorderStyle(envBorder);
    if (border) config.border = border;
  }
  return config;
}
