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

  it('handles more than 6 blocks safely without exponential freeze', () => {
    const customConfig = {
      segments: ['context', 'model', 'usage', 'state', 'git', 'context', 'model'],
    };
    const out = render(data, 100, customConfig);
    expect(out).toContain('╭─');
  });

  describe('border styles', () => {
    it('renders square borders', () => {
      const out = render(data, 120, { border: 'square' });
      const plain = stripAnsi(out);
      expect(plain).toContain('┌─');
      expect(plain).toContain('└─');
      expect(plain).not.toContain('╭─');
    });

    it('renders double borders', () => {
      const out = render(data, 120, { border: 'double' });
      const plain = stripAnsi(out);
      expect(plain).toContain('╔═');
      expect(plain).toContain('╚═');
      expect(plain).not.toContain('╭─');
    });

    it('renders thick borders', () => {
      const out = render(data, 120, { border: 'thick' });
      const plain = stripAnsi(out);
      expect(plain).toContain('┏━');
      expect(plain).toContain('┗━');
      expect(plain).not.toContain('╭─');
    });

    it('renders ascii borders', () => {
      const out = render(data, 120, { border: 'ascii' });
      const plain = stripAnsi(out);
      expect(plain).toContain('+-');
      expect(plain).toContain('|');
      expect(plain).not.toContain('╭─');
    });

    it('renders none border style cleanly without box borders', () => {
      const out = render(data, 120, { border: 'none' });
      const plain = stripAnsi(out);
      expect(plain).not.toContain('╭─');
      expect(plain).not.toContain('┌─');
      expect(plain).not.toContain('╔═');
      expect(plain).not.toContain('┏━');
      expect(plain).toContain('Gemini 3.8 Flash');
    });

    it('falls back to rounded for unknown border style', () => {
      const out = render(data, 120, { border: 'unknown-style' as any });
      const plain = stripAnsi(out);
      expect(plain).toContain('╭─');
      expect(plain).toContain('╰─');
    });
  });
});
