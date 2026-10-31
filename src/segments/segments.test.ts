import { describe, it, expect } from 'vitest';
import { contextSegment } from './context.js';
import { modelSegment } from './model.js';
import { stateSegment } from './state.js';
import { stripAnsi } from '../colors.js';
import type { AgyStatusData } from '../types.js';

describe('segments', () => {
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
});
