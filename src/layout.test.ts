import { describe, it, expect } from 'vitest';
import { render } from './layout.js';
import { stripAnsi } from './colors.js';
import type { AgyStatusData } from './types.js';

describe('layout', () => {
  const data: AgyStatusData = {
    product: 'antigravity',
    agent_state: 'idle',
    model: {
      id: 'gemini-3.8-flash',
      display_name: 'Gemini 3.8 Flash (Medium)',
    },
    context_window: {
      context_window_size: 1048576,
      used_percentage: 10,
    },
    current_dir: '/Users/okan/code',
    plan_tier: 'Consumer',
  };

  it('renders box borders and cards', () => {
    const out = render(data, 120);
    const plain = stripAnsi(out);
    expect(plain).toContain('╭─');
    expect(plain).toContain('╰─');
    expect(plain).toContain('Gemini 3.8 Flash');
  });

  it('reflows dynamically into narrower columns', () => {
    const wide = render(data, 120);
    const narrow = render(data, 50);

    const wideLines = wide.split('\n');
    const narrowLines = narrow.split('\n');

    expect(narrowLines.length).toBeGreaterThanOrEqual(wideLines.length);
  });
});
