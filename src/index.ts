#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { AgyStatusData } from './types.js';
import { loadConfig } from './config.js';
import { render } from './layout.js';
import { maybeRefreshRemoteUsage } from './remote-usage.js';
import { spawnDetached } from './spawn.js';

const AUTO_UPDATE_INTERVAL = 86400000; // 24 hours

function maybeAutoUpdate(): void {
  if (process.env['AGY_STATUSBLOCKS_NO_UPDATE']) return;
  try {
    const dir = join(homedir(), '.gemini', 'antigravity-cli', 'statusblocks');
    if (!existsSync(dir)) return;

    const checkFile = join(dir, '.last-update-check');
    let lastCheck = 0;
    try { lastCheck = parseInt(readFileSync(checkFile, 'utf8'), 10) || 0; } catch { /* missing file */ }
    if (Date.now() - lastCheck < AUTO_UPDATE_INTERVAL) return;

    writeFileSync(checkFile, String(Date.now()));
    spawnDetached(process.execPath, [join(dir, 'update-check.js')]);
  } catch { /* auto-update is best-effort */ }
}

function detectWidth(providedWidth?: number): number {
  if (providedWidth && providedWidth > 0) return providedWidth;
  let w = process.stderr.columns || process.stdout.columns || 0;
  if (!w) w = parseInt(process.env.COLUMNS ?? '', 10) || 0;
  if (w > 0) return w;

  if (process.platform !== 'win32') {
    try {
      w = parseInt(execSync('tput cols', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(), 10) || 0;
    } catch {
      // ignore
    }
  }
  return w > 0 ? w : 120;
}

function coerceNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(/%/g, '').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeInput(raw: unknown): AgyStatusData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const modelObj = (obj.model && typeof obj.model === 'object') ? obj.model as Record<string, unknown> : {};
  const modelName = typeof modelObj.display_name === 'string'
    ? modelObj.display_name
    : typeof modelObj.id === 'string'
      ? modelObj.id
      : 'Gemini';

  const cwObj = (obj.context_window && typeof obj.context_window === 'object') ? obj.context_window as Record<string, unknown> : {};
  const cwSize = coerceNumber(cwObj.context_window_size) ?? 1048576;
  const usedPct = coerceNumber(cwObj.used_percentage) ?? 0;
  const remPct = coerceNumber(cwObj.remaining_percentage) ?? (100 - usedPct);

  const cwd = typeof obj.current_dir === 'string'
    ? obj.current_dir
    : (typeof obj.workspace === 'object' && obj.workspace && typeof (obj.workspace as Record<string, unknown>).current_dir === 'string')
      ? (obj.workspace as Record<string, unknown>).current_dir as string
      : process.cwd();

  const vcs = (obj.vcs && typeof obj.vcs === 'object') ? obj.vcs as Record<string, unknown> : undefined;

  let effortLevel = typeof modelObj.effort === 'string' ? modelObj.effort.toLowerCase() : undefined;
  if (!effortLevel) {
    if (modelName.includes('(High)')) effortLevel = 'high';
    else if (modelName.includes('(Medium)')) effortLevel = 'medium';
    else if (modelName.includes('(Low)')) effortLevel = 'low';
    else if (modelName.includes('(Max)')) effortLevel = 'max';
  }

  const costObj = (obj.cost && typeof obj.cost === 'object') ? obj.cost as Record<string, unknown> : {};

  const rlObj = (obj.rate_limits && typeof obj.rate_limits === 'object') ? obj.rate_limits as Record<string, any> : undefined;
  const quotaObj = (obj.quota && typeof obj.quota === 'object') ? obj.quota as Record<string, any> : undefined;

  return {
    product: typeof obj.product === 'string' ? obj.product : 'antigravity',
    conversation_id: typeof obj.conversation_id === 'string' ? obj.conversation_id : undefined,
    agent_state: typeof obj.agent_state === 'string' ? obj.agent_state : 'idle',
    model: {
      id: typeof modelObj.id === 'string' ? modelObj.id : 'gemini',
      display_name: modelName,
      effort: effortLevel,
    },
    context_window: {
      context_window_size: cwSize,
      used_percentage: usedPct,
      remaining_percentage: remPct,
      total_input_tokens: coerceNumber(cwObj.total_input_tokens) ?? 0,
      total_output_tokens: coerceNumber(cwObj.total_output_tokens) ?? 0,
    },
    rate_limits: rlObj,
    quota: quotaObj,
    current_dir: cwd,
    workspace: { current_dir: cwd },
    vcs: vcs ? {
      type: typeof vcs.type === 'string' ? vcs.type : 'git',
      branch: typeof vcs.branch === 'string' ? vcs.branch : undefined,
      dirty: typeof vcs.dirty === 'boolean' ? vcs.dirty : undefined,
    } : undefined,
    artifact_count: coerceNumber(obj.artifact_count) ?? 0,
    task_count: coerceNumber(obj.task_count) ?? 0,
    subagents: Array.isArray(obj.subagents) ? obj.subagents : [],
    plan_tier: typeof obj.plan_tier === 'string' ? obj.plan_tier : 'Consumer',
    terminal_width: coerceNumber(obj.terminal_width),
    cost: {
      total_usd: coerceNumber(costObj.total_usd),
      subagent_usd: coerceNumber(costObj.subagent_usd),
      estimated: typeof costObj.estimated === 'boolean' ? costObj.estimated : coerceNumber(costObj.estimated),
    },
    effort: effortLevel ? { level: effortLevel } : undefined,
  };
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    if (!input.trim()) {
      process.stdout.write('\n');
      return;
    }
    const raw = JSON.parse(input);
    const data = normalizeInput(raw);
    if (!data) {
      process.stdout.write('\n');
      return;
    }

    const config = loadConfig();
    if (config.remoteUsage !== false) {
      maybeRefreshRemoteUsage();
    }

    const width = detectWidth(data.terminal_width);
    const rendered = render(data, width, config);
    process.stdout.write(rendered + '\n');
    maybeAutoUpdate();
  } catch {
    process.stdout.write('\n');
  }
});
