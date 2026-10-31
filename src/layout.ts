import type { Segment, Block, AgyStatusData, StatusBlocksConfig, BorderStyle } from './types.js';
import { padRight, color, c, visibleLength } from './colors.js';

import { contextSegment } from './segments/context.js';
import { modelSegment } from './segments/model.js';
import { usageSegment } from './segments/usage.js';
import { stateSegment } from './segments/state.js';
import { gitSegment } from './segments/git.js';

const ALL_SEGMENTS: Segment[] = [contextSegment, modelSegment, usageSegment, stateSegment, gitSegment];
export const DEFAULT_ORDER = ['context', 'model', 'usage', 'state', 'git'];

const GAP = 1;

export interface BorderGlyphs {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

export const BORDER_STYLES: Record<BorderStyle, BorderGlyphs> = {
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  square:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  thick:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  ascii:   { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
  none:    { tl: '',  tr: '',  bl: '',  br: '',  h: '',  v: ''  },
};

type RowGroup = { blocks: Block[]; widths: number[] };

export function boxify(lines: string[], innerW: number, style: BorderStyle = 'rounded', title?: string): string[] {
  if (style === 'none') {
    const boxed: string[] = [];
    if (title) {
      boxed.push(' ' + color(title, c.dim) + ' '.repeat(Math.max(0, innerW + 1 - title.length)));
    }
    for (const line of lines) {
      boxed.push(' ' + padRight(line, innerW) + ' ');
    }
    return boxed;
  }

  const g = BORDER_STYLES[style] || BORDER_STYLES.rounded;
  let top: string;
  if (title) {
    const label = ` ${title} `;
    const remaining = Math.max(0, innerW + 2 - label.length - 1);
    top = color(g.tl + g.h, c.gray) + color(label, c.dim) + color(g.h.repeat(remaining) + g.tr, c.gray);
  } else {
    top = color(g.tl + g.h.repeat(innerW + 2) + g.tr, c.gray);
  }
  const bot = color(g.bl + g.h.repeat(innerW + 2) + g.br, c.gray);
  const boxed = [top];
  for (const line of lines) {
    boxed.push(color(g.v, c.gray) + ' ' + padRight(line, innerW) + ' ' + color(g.v, c.gray));
  }
  boxed.push(bot);
  return boxed;
}

export function renderRow(group: RowGroup, style: BorderStyle = 'rounded'): string[] {
  const { blocks, widths } = group;
  const chrome = style === 'none' ? 2 : 4;
  const boxes = blocks.map((b, i) => boxify(b.lines, widths[i]!, style, b.id));
  const boxWidths = widths.map(w => w + chrome);
  const g = BORDER_STYLES[style] || BORDER_STYLES.rounded;

  const maxHeight = Math.max(...boxes.map(b => b.length));
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;
    while (box.length < maxHeight) {
      const blankRow = style === 'none'
        ? ' '.repeat(widths[i]! + 2)
        : color(g.v, c.gray) + ' '.repeat(widths[i]! + 2) + color(g.v, c.gray);
      if (style === 'none') {
        box.push(blankRow);
      } else {
        box.splice(box.length - 1, 0, blankRow);
      }
    }
  }

  const rows: string[] = [];
  for (let row = 0; row < maxHeight; row++) {
    const parts: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      parts.push(padRight(boxes[i]![row]!, boxWidths[i]!));
    }
    rows.push(parts.join(' '.repeat(GAP)).replace(/\s+$/, ''));
  }
  return rows;
}

function decodeAssignment(
  combo: number, blockCount: number, targetRows: number,
  blockRow: number[], rowUsed: boolean[],
): boolean {
  let encoded = combo;
  for (let b = 0; b < blockCount; b++) {
    blockRow[b] = encoded % targetRows;
    encoded = Math.floor(encoded / targetRows);
  }
  rowUsed.fill(false, 0, targetRows);
  for (let b = 0; b < blockCount; b++) rowUsed[blockRow[b]!] = true;
  for (let r = 0; r < targetRows; r++) { if (!rowUsed[r]) return false; }
  return true;
}

function computeRowWidths(
  blockRow: number[], blockCount: number, targetRows: number,
  blockWidths: number[], rowWidths: number[], chrome: number,
): void {
  rowWidths.fill(0, 0, targetRows);
  const rowCounts = new Array<number>(targetRows).fill(0);
  for (let b = 0; b < blockCount; b++) {
    const r = blockRow[b]!;
    rowWidths[r] = (rowWidths[r] ?? 0) + (blockWidths[b] ?? 0) + chrome;
    rowCounts[r] = (rowCounts[r] ?? 0) + 1;
  }
  for (let r = 0; r < targetRows; r++) {
    if ((rowCounts[r] ?? 0) > 1) {
      rowWidths[r] = (rowWidths[r] ?? 0) + ((rowCounts[r] ?? 0) - 1) * GAP;
    }
  }
}

function solveGreedy(blocks: Block[], maxWidth: number, chrome: number): RowGroup[] {
  const rows: { blocks: Block[]; widths: number[]; currentW: number }[] = [];
  for (const b of blocks) {
    const boxW = b.width + chrome;
    let placed = false;
    for (const r of rows) {
      const addedW = r.blocks.length > 0 ? boxW + GAP : boxW;
      if (r.currentW + addedW <= maxWidth) {
        r.blocks.push(b);
        r.widths.push(b.width);
        r.currentW += addedW;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ blocks: [b], widths: [b.width], currentW: boxW });
    }
  }
  rows.sort((a, b) => a.currentW - b.currentW);
  return rows.map(r => ({ blocks: r.blocks, widths: r.widths }));
}

function solveLayout(blocks: Block[], maxWidth: number, chrome: number): RowGroup[] {
  if (blocks.length === 0) return [];
  const blockCount = blocks.length;
  if (blockCount > 6) return solveGreedy(blocks, maxWidth, chrome);
  const blockWidths = blocks.map(b => b.width);

  for (let targetRows = 1; targetRows <= blockCount; targetRows++) {
    const totalCombos = Math.pow(targetRows, blockCount);
    const blockRow = new Array<number>(blockCount);
    const rowUsed = new Array<boolean>(targetRows);
    const rowWidths = new Array<number>(targetRows);

    let bestCombo = -1;
    let minMaxRowW = Infinity;

    for (let combo = 0; combo < totalCombos; combo++) {
      if (!decodeAssignment(combo, blockCount, targetRows, blockRow, rowUsed)) continue;
      computeRowWidths(blockRow, blockCount, targetRows, blockWidths, rowWidths, chrome);

      let fits = true;
      let maxRowW = 0;
      for (let r = 0; r < targetRows; r++) {
        const rw = rowWidths[r]!;
        if (rw > maxWidth) { fits = false; break; }
        if (rw > maxRowW) maxRowW = rw;
      }
      if (fits && maxRowW < minMaxRowW) {
        minMaxRowW = maxRowW;
        bestCombo = combo;
      }
    }

    if (bestCombo !== -1) {
      decodeAssignment(bestCombo, blockCount, targetRows, blockRow, rowUsed);
      const rows: { blocks: Block[]; widths: number[]; totalW: number }[] = [];
      for (let r = 0; r < targetRows; r++) {
        const rBlocks: Block[] = [];
        const rWidths: number[] = [];
        for (let b = 0; b < blockCount; b++) {
          if (blockRow[b] === r) {
            rBlocks.push(blocks[b]!);
            rWidths.push(blocks[b]!.width);
          }
        }
        const totalW = rWidths.reduce((a, w) => a + w + chrome, 0) + (rBlocks.length - 1) * GAP;
        rows.push({ blocks: rBlocks, widths: rWidths, totalW });
      }

      rows.sort((a, b) => a.totalW - b.totalW);
      return rows.map(r => ({ blocks: r.blocks, widths: r.widths }));
    }
  }

  return blocks.map(b => ({ blocks: [b], widths: [b.width] }));
}

export function render(data: AgyStatusData, width: number, config: StatusBlocksConfig = {}): string {
  const order = config.segments ?? DEFAULT_ORDER;
  const borderStyle: BorderStyle = config.border ?? 'rounded';
  const chrome = borderStyle === 'none' ? 2 : 4;
  const segmentsMap = new Map<string, Segment>(ALL_SEGMENTS.map(s => [s.id, s]));

  const activeSegments = order
    .map(id => segmentsMap.get(id))
    .filter((s): s is Segment => !!s && s.enabled(data));

  const blocks = activeSegments.map(s => s.render(data, width));
  const groups = solveLayout(blocks, width, chrome);

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(...renderRow(group, borderStyle));
  }
  return lines.join('\n');
}
