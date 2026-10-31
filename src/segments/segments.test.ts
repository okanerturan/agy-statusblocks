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

  it('renders model card with cleaned name and directory', () => {
    const block = modelSegment.render(baseData, 100);
    expect(block.id).toBe('model');
    const plain = block.lines.map(stripAnsi).join('\n');
    expect(plain).toContain('Gemini 3.8 Flash');
    expect(plain).toContain('medium');
    expect(plain).toContain('Consumer');
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
});
