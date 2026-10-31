import { describe, it, expect } from 'vitest';
import { color, c, stripAnsi, visibleLength, pctColor, renderBar } from './colors.js';

describe('colors', () => {
  it('strips ANSI escape sequences accurately', () => {
    const styled = color('hello world', c.gemini, c.bold);
    expect(stripAnsi(styled)).toBe('hello world');
  });

  it('calculates visible length ignoring ANSI codes', () => {
    const styled = color('antigravity', c.cyan, c.bold);
    expect(visibleLength(styled)).toBe(11);
  });

  it('determines threshold colors for percentages', () => {
    expect(pctColor(10)).toBe(c.green);
    expect(pctColor(75)).toBe(c.yellow);
    expect(pctColor(95)).toBe(c.red);
  });

  it('renders progress bar with correct filled length', () => {
    const bar = stripAnsi(renderBar(50, 10));
    expect(bar).toBe('█████▒▒▒▒▒');
  });
});
