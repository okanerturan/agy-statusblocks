import { basename } from 'path';
import { homedir } from 'os';
import type { Segment } from '../types.js';
import { color, c, visibleLength } from '../colors.js';

function tildeDir(dir: string): string {
  const home = homedir();
  if (dir === home) return '~';
  if (dir.startsWith(home + '/') || dir.startsWith(home + '\\')) {
    return '~' + dir.slice(home.length);
  }
  return dir;
}

const EFFORT_COLORS: Record<string, string> = {
  low: c.dim,
  medium: c.dim,
  high: c.yellow,
  xhigh: c.orange,
  max: c.orange + c.bold,
};

function spreadLine(parts: string[], targetWidth: number): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;

  const dot = color(' · ', c.dim);
  const dotWidth = 3;
  const widths = parts.map(visibleLength);
  const contentWidth = widths.reduce((a, b) => a + b, 0);
  const totalGap = Math.max(0, targetWidth - contentWidth);
  const spareAfterDots = totalGap - dotWidth * (parts.length - 1);

  if (spareAfterDots <= 10) {
    const gaps = parts.length * 2 - 2;
    const base = Math.floor(Math.max(0, spareAfterDots) / gaps);
    const remainder = Math.max(0, spareAfterDots) % gaps;
    const result: string[] = [parts[0]!];
    for (let i = 1; i < parts.length; i++) {
      const leftPad = base + (((i - 1) * 2) < remainder ? 1 : 0);
      const rightPad = base + (((i - 1) * 2 + 1) < remainder ? 1 : 0);
      result.push(' '.repeat(leftPad), dot, ' '.repeat(rightPad), parts[i]!);
    }
    return result.join('');
  }

  const gapCount = parts.length - 1;
  const baseGap = Math.floor(totalGap / gapCount);
  const extraGap = totalGap % gapCount;
  const result: string[] = [parts[0]!];
  for (let i = 1; i < parts.length; i++) {
    result.push(' '.repeat(baseGap + (i <= extraGap ? 1 : 0)), parts[i]!);
  }
  return result.join('');
}

export const modelSegment: Segment = {
  id: 'model',
  priority: 30,
  enabled: () => true,
  render(data, allocWidth) {
    const fullName = data.model.display_name || data.model.id || 'Gemini';
    const shortName = fullName.replace(/\s*\(.*?\)\s*/g, '').trim();

    // Determine reasoning effort from display name or explicit effort
    let effort = data.model.effort || data.effort?.level;
    if (!effort) {
      if (fullName.includes('(High)')) effort = 'high';
      else if (fullName.includes('(Medium)')) effort = 'medium';
      else if (fullName.includes('(Low)')) effort = 'low';
      else if (fullName.includes('(Max)')) effort = 'max';
    }

    const currentDir = data.workspace?.current_dir || data.current_dir || process.cwd();
    const tilde = tildeDir(currentDir);
    const isClaude = /claude|sonnet|opus|haiku/i.test(shortName);
    const nameStyled = color(shortName, isClaude ? c.orange : c.gemini, c.bold);
    const sep = color(' · ', c.dim);
    const nameLen = visibleLength(nameStyled) + visibleLength(sep);
    const dirBudget = Math.max(allocWidth - nameLen, 0);
    const dir = tilde.length <= dirBudget ? tilde : basename(currentDir);

    const line1 = `${nameStyled}${sep}${color(dir, c.dim)}`;

    const effortStr = effort ? color(effort.toLowerCase(), EFFORT_COLORS[effort.toLowerCase()] ?? c.dim) : '';
    const tierStr = data.plan_tier ? color(data.plan_tier, c.dim) : '';
    const usd = typeof data.cost?.total_usd === 'number'
      ? data.cost.total_usd
      : typeof data.cost?.estimated === 'number'
        ? data.cost.estimated
        : 0;
    const costStr = usd > 0
      ? color(`${data.cost?.estimated === true ? '~' : ''}$${usd.toFixed(3)}`, c.dim)
      : '';

    const parts = [effortStr, tierStr, costStr].filter(Boolean);
    const line2 = spreadLine(parts, visibleLength(line1));

    const lines = [line1, line2 || color(shortName, c.dim)];
    const width = Math.max(...lines.map(visibleLength));
    return { id: 'model', priority: 30, width, lines };
  },
};
