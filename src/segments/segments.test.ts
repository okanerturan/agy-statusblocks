import { describe, it, expect } from 'vitest';
import { contextSegment } from './context.js';
import { modelSegment } from './model.js';
import { stateSegment } from './state.js';
import { usageSegment } from './usage.js';
import { stripAnsi } from '../colors.js';
import type { AgyStatusData } from '../types.js';

describe('segments', () => {
  const now = Date.now() / 1000;
  const baseData: AgyStatusData = {
    product: 'antigravity',
    version: '1.4.12',
    agent_state: 'idle',
    model: {
      id: 'gemini-3.8-flash',
      display_name: 'Gemini 3.8 Flash (Medium)',
    },
    context_window: {
      context_window_size: 1048576,
      used_percentage: 5,
      total_input_tokens: 50000,
      total_output_tokens: 2400,
    },
    rate_limits: {
      five_hour: {
        used_percentage: 20,
        resets_at: Math.floor(now + 3600),
      },
      seven_day: {
        used_percentage: 55,
        resets_at: Math.floor(now + 3600 * 24),
      },
    },
    current_dir: '/Users/okan/code/test-repo',
    workspace: {
      current_dir: '/Users/okan/code/test-repo',
    },
    plan_tier: 'Consumer',
  };

  it('renders context card with percentage and tokens', () => {
    const block = contextSegment.render(baseData, 100);
    expect(block.id).toBe('context');
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('5%');
    expect(plain).toContain('52K/1.0M');
  });

  it('does not add cumulative total_output_tokens when used_percentage reflects total_input_tokens (ContextWindowMetadata)', () => {
    const compactedData: AgyStatusData = {
      ...baseData,
      context_window: {
        context_window_size: 1000000,
        used_percentage: 3.0,
        total_input_tokens: 30000,
        total_output_tokens: 232000,
      },
    };
    const plain = contextSegment.render(compactedData, 100).lines.map(stripAnsi).join('\n');
    expect(plain).toContain('3%');
    expect(plain).toContain('30K/1.0M');
    expect(plain).not.toContain('262K/1.0M');

    const capturedData: AgyStatusData = {
      ...baseData,
      context_window: {
        context_window_size: 1000000,
        used_percentage: 13.4484,
        total_input_tokens: 134484,
        total_output_tokens: 188065,
      },
    };
    const capturedPlain = contextSegment.render(capturedData, 100).lines.map(stripAnsi).join('\n');
    expect(capturedPlain).toContain('13%');
    expect(capturedPlain).toContain('134K/1.0M');
    expect(capturedPlain).not.toContain('323K/1.0M');
  });

  it('derives used token count from used_percentage when token counts are omitted', () => {
    const pctOnlyData: AgyStatusData = {
      ...baseData,
      context_window: {
        context_window_size: 1000000,
        used_percentage: 21,
      },
    };
    const plain = contextSegment.render(pctOnlyData, 100).lines.map(stripAnsi).join('\n');
    expect(plain).toContain('21%');
    expect(plain).toContain('210K/1.0M');
  });

  it('renders model card with cleaned name, directory, and CLI version', () => {
    const block = modelSegment.render(baseData, 100);
    expect(block.id).toBe('model');
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('Gemini 3.8 Flash');
    expect(plain).toContain('medium');
    expect(plain).toContain('Consumer');
    expect(plain).toContain('v1.4.12');
  });

  it('normalizes v-prefixed version and omits version when absent', () => {
    const withPrefix = modelSegment.render({ ...baseData, version: 'v1.4.12' }, 100);
    const plainWithPrefix = withPrefix.lines.map(stripAnsi).join('\n');
    expect(plainWithPrefix).toContain('v1.4.12');
    expect(plainWithPrefix).not.toContain('vv1.4.12');

    const withoutVersion = modelSegment.render({ ...baseData, version: undefined }, 100);
    const plainWithout = withoutVersion.lines.map(stripAnsi).join('\n');
    expect(plainWithout).not.toContain('v1.4.12');
  });

  it('renders state card with pill and counters', () => {
    const dataWithTasks: AgyStatusData = {
      ...baseData,
      agent_state: 'working',
      task_count: 2,
      artifact_count: 1,
    };
    const block = stateSegment.render(dataWithTasks, 100);
    expect(block.id).toBe('state');
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('● RUNNING');
    expect(plain).toContain('2 tasks · 1 artifact');
  });

  it('renders usage card with 5h and 7d / daily buckets', () => {
    const block = usageSegment.render(baseData, 100);
    expect(block.id).toBe('usage');
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('5h');
    expect(plain).toContain('7d');
    expect(plain).toContain('20%');
    expect(plain).toContain('55%');
  });

  it('renders native Antigravity quota buckets including Sonnet 5.5 and Opus 5.5', () => {
    const quotaData: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      model: {
        id: 'claude-sonnet-5.5',
        display_name: 'Claude Sonnet 5.5 (High)',
        effort: 'high',
      },
      quota: {
        'Gemini 3.8 Flash': {
          remaining_fraction: 0.9,
          reset_in_seconds: 3600,
        },
        'Claude Sonnet 5.5': {
          remaining_fraction: 0.65,
          reset_in_seconds: 7200,
        },
        'Claude Opus 5.5': {
          remaining_fraction: 0.4,
          reset_in_seconds: 14400,
        },
      },
    };
    const block = usageSegment.render(quotaData, 100);
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('sonnet 5.5');
    expect(plain).toContain('35%');
    expect(plain).toContain('opus 5.5');
    expect(plain).toContain('60%');
  });

  it('supports shared Claude/GPT pool and Argon weekly pool buckets', () => {
    const poolData: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      model: {
        id: 'gemini-4-argon',
        display_name: 'Gemini 4 Argon (Low)',
        effort: 'low',
      },
      quota: {
        'Gemini 3.8 Flash': {
          remaining_fraction: 0.85,
          reset_in_seconds: 3600 * 3,
        },
        'Gemini 4 Argon': {
          remaining_fraction: 0.72,
          reset_in_seconds: 86400 * 4,
        },
        'Claude and GPT': {
          remaining_fraction: 0.60,
          reset_in_seconds: 3600 * 4,
        },
      },
    };
    const block = usageSegment.render(poolData, 100);
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('argon');
    expect(plain).toContain('28%');
    expect(plain).toContain('claude 5h');
    expect(plain).toContain('40%');
  });

  it('aligns reset timers and bucket labels so gemini 5h and 7d lean right flush', () => {
    const data: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      quota: {
        'Gemini (5h)': {
          used_percentage: 48,
          reset_in_seconds: 2 * 3600 + 50 * 60,
        },
        'Gemini (7d)': {
          used_percentage: 12,
          reset_in_seconds: 6 * 86400 + 21 * 3600 + 50 * 60,
        },
      },
    };
    const block = usageSegment.render(data, 100);
    const line1 = stripAnsi(block.lines[0]!);
    const line2 = stripAnsi(block.lines[1]!);

    // Both lines must have identical visible width (no trailing ragged space after 5h)
    expect(line1.length).toBe(line2.length);

    // Both lines must end with the bucket label flush right
    expect(line1.endsWith('gemini 5h')).toBe(true);
    expect(line2.endsWith('gemini 7d')).toBe(true);

    // Both labels must start at the exact same column index
    expect(line1.indexOf('gemini 5h')).toBe(line2.indexOf('gemini 7d'));
  });

  const realQuota = {
    '3p-5h': { remaining_fraction: 0.88, reset_in_seconds: 10403 },
    '3p-weekly': { remaining_fraction: 0.94, reset_in_seconds: 597203 },
    'gemini-5h': { remaining_fraction: 0.48, reset_in_seconds: 9001 },
    'gemini-weekly': { remaining_fraction: 0.87, reset_in_seconds: 595801 },
  };

  it('shows the third-party (3p) pool when a Claude model is active', () => {
    const data: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      model: { id: 'Claude Sonnet 5.5 (Medium)', display_name: 'Claude Sonnet 5.5 (Medium)' },
      quota: realQuota,
    };
    const lines = usageSegment.render(data, 100).lines.map(stripAnsi);
    expect(lines[0]).toContain('claude 5h');
    expect(lines[0]).toContain('12%');
    expect(lines[1]).toContain('claude 7d');
    expect(lines[1]).toContain('6%');
  });

  it('shows the gemini pool when a Gemini model is active', () => {
    const data: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      model: { id: 'gemini-3.8-flash', display_name: 'Gemini 3.8 Flash (High)' },
      quota: realQuota,
    };
    const lines = usageSegment.render(data, 100).lines.map(stripAnsi);
    expect(lines[0]).toContain('gemini 5h');
    expect(lines[1]).toContain('gemini 7d');
  });

  it('shows gemini 5h and 7d when Gemini 4 Argon is active and quota uses gemini-* keys', () => {
    const data: AgyStatusData = {
      ...baseData,
      rate_limits: undefined,
      model: { id: 'Gemini 4 Argon (High)', display_name: 'Gemini 4 Argon (High)' },
      quota: {
        '3p-5h': { remaining_fraction: 0.68, reset_in_seconds: 8100 },
        '3p-weekly': { remaining_fraction: 0.88, reset_in_seconds: 590000 },
        'gemini-5h': { remaining_fraction: 0.37, reset_in_seconds: 6660 },
        'gemini-weekly': { remaining_fraction: 0.87, reset_in_seconds: 590000 },
      },
    };
    const lines = usageSegment.render(data, 100).lines.map(stripAnsi);
    expect(lines[0]).toContain('gemini 5h');
    expect(lines[0]).toContain('63%');
    expect(lines[1]).toContain('gemini 7d');
    expect(lines[1]).toContain('13%');
  });
});
