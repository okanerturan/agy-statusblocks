const ESC = '\x1b[';

export const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,

  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,

  gemini: `${ESC}38;2;66;133;244m`,   // Google blue #4285F4
  geminiCyan: `${ESC}38;2;77;208;225m`, // Cyan #4DD0E1
  orange: `${ESC}38;2;217;119;87m`,
  purple: `${ESC}38;2;168;85;247m`,
};

export function color(text: string, ...codes: string[]): string {
  return codes.join('') + text + c.reset;
}

export function pctColor(pct: number): string {
  return pct >= 90 ? c.red : pct >= 70 ? c.yellow : c.green;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function padRight(str: string, targetLen: number): string {
  const vLen = visibleLength(str);
  if (vLen >= targetLen) return str;
  return str + ' '.repeat(targetLen - vLen);
}

export function renderBar(pct: number, width: number): string {
  const filled = Math.min(width, Math.max(0, Math.round(pct * width / 100)));
  return color('█'.repeat(filled), pctColor(pct)) + color('▒'.repeat(width - filled), c.gray);
}
