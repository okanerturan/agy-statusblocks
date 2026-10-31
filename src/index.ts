#!/usr/bin/env node

import { execSync } from 'child_process';
import type { AgyStatusData, StatusBlocksConfig } from './types.js';
import { render } from './layout.js';

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
  const cwSize = typeof cwObj.context_window_size === 'number' ? cwObj.context_window_size : 1048576;
  const usedPct = typeof cwObj.used_percentage === 'number' ? cwObj.used_percentage : 0;
  const remPct = typeof cwObj.remaining_percentage === 'number' ? cwObj.remaining_percentage : (100 - usedPct);

  const cwd = typeof obj.current_dir === 'string'
    ? obj.current_dir
    : (typeof obj.workspace === 'object' && obj.workspace && typeof (obj.workspace as Record<string, unknown>).current_dir === 'string')
      ? (obj.workspace as Record<string, unknown>).current_dir as string
      : process.cwd();

  const vcs = (obj.vcs && typeof obj.vcs === 'object') ? obj.vcs as Record<string, unknown> : undefined;

  let effortLevel: string | undefined;
  if (modelName.includes('(High)')) effortLevel = 'high';
  else if (modelName.includes('(Medium)')) effortLevel = 'medium';
  else if (modelName.includes('(Low)')) effortLevel = 'low';

  const costObj = (obj.cost && typeof obj.cost === 'object') ? obj.cost as Record<string, unknown> : {};

  return {
    product: typeof obj.product === 'string' ? obj.product : 'antigravity',
    conversation_id: typeof obj.conversation_id === 'string' ? obj.conversation_id : undefined,
    agent_state: typeof obj.agent_state === 'string' ? obj.agent_state : 'idle',
    model: {
      id: typeof modelObj.id === 'string' ? modelObj.id : 'gemini',
      display_name: modelName,
    },
    context_window: {
      context_window_size: cwSize,
      used_percentage: usedPct,
      remaining_percentage: remPct,
      total_input_tokens: typeof cwObj.total_input_tokens === 'number' ? cwObj.total_input_tokens : 0,
      total_output_tokens: typeof cwObj.total_output_tokens === 'number' ? cwObj.total_output_tokens : 0,
    },
    current_dir: cwd,
    workspace: { current_dir: cwd },
    vcs: vcs ? {
      type: typeof vcs.type === 'string' ? vcs.type : 'git',
      branch: typeof vcs.branch === 'string' ? vcs.branch : undefined,
      dirty: typeof vcs.dirty === 'boolean' ? vcs.dirty : undefined,
    } : undefined,
    artifact_count: typeof obj.artifact_count === 'number' ? obj.artifact_count : 0,
    task_count: typeof obj.task_count === 'number' ? obj.task_count : 0,
    subagents: Array.isArray(obj.subagents) ? obj.subagents : [],
    plan_tier: typeof obj.plan_tier === 'string' ? obj.plan_tier : 'Consumer',
    terminal_width: typeof obj.terminal_width === 'number' ? obj.terminal_width : undefined,
    cost: {
      estimated: typeof costObj.estimated === 'number' ? costObj.estimated : undefined,
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

    const width = detectWidth(data.terminal_width);
    const rendered = render(data, width);
    process.stdout.write(rendered + '\n');
  } catch {
    process.stdout.write('\n');
  }
});
