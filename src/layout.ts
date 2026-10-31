import type { Segment, Block, AgyStatusData, StatusBlocksConfig } from './types.js';
import { padRight, color, c, visibleLength } from './colors.js';

import { contextSegment } from './segments/context.js';
import { modelSegment } from './segments/model.js';
import { stateSegment } from './segments/state.js';
import { gitSegment } from './segments/git.js';

const ALL_SEGMENTS: Segment[] = [contextSegment, modelSegment, stateSegment, gitSegment];
export const DEFAULT_ORDER = ['context', 'model', 'state', 'git'];

const GAP = 1;
const BOX_CHROME = 4; // ╭─ ... ─╮ has 2 border chars + 2 inner spaces

type RowGroup = { blocks: Block[]; widths: number[] };

function boxify(lines: string[], innerW: number, title?: string): string[] {
  let top: string;
  if (title) {
    const label = ` ${title} `;
    const remaining = Math.max(0, innerW + 2 - label.length - 1);
    top = color('╭─', c.gray) + color(label, c.dim) + color('─'.repeat(remaining) + '╮', c.gray);
  } else {
    top = color('╭' + '─'.repeat(innerW + 2) + '╮', c.gray);
  }
  const bot = color('╰' + '─'.repeat(innerW + 2) + '╯', c.gray);
  const boxed = [top];
  for (const line of lines) {
    boxed.push(color('│', c.gray) + ' ' + padRight(line, innerW) + ' ' + color('│', c.gray));
  }
  boxed.push(bot);
  return boxed;
}

function renderRow(group: RowGroup): string[] {
  const { blocks, widths } = group;
  const boxes = blocks.map((b, i) => boxify(b.lines, widths[i]!, b.id));
  const boxWidths = widths.map(w => w + BOX_CHROME);

  const maxHeight = Math.max(...boxes.map(b => b.length));
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;
    while (box.length < maxHeight) {
      const blankRow = color('│', c.gray) + ' '.repeat(widths[i]! + 2) + color('│', c.gray);
      box.splice(box.length - 1, 0, blankRow);
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
  blockWidths: number[], rowWidths: number[],
): void {
  rowWidths.fill(0, 0, targetRows);
  const rowCounts = new Array<number>(targetRows).fill(0);
  for (let b = 0; b < blockCount; b++) {
    const r = blockRow[b]!;
    rowWidths[r] = (rowWidths[r] ?? 0) + (blockWidths[b] ?? 0) + BOX_CHROME;
    rowCounts[r] = (rowCounts[r] ?? 0) + 1;
  }
  for (let r = 0; r < targetRows; r++) {
    if ((rowCounts[r] ?? 0) > 1) {
      rowWidths[r] = (rowWidths[r] ?? 0) + ((rowCounts[r] ?? 0) - 1) * GAP;
    }
  }
}

function solveLayout(blocks: Block[], maxWidth: number): RowGroup[] {
  if (blocks.length === 0) return [];
  const blockCount = blocks.length;
  const blockWidths = blocks.map(b => b.width);

  // Try packing into 1..blockCount rows
  for (let targetRows = 1; targetRows <= blockCount; targetRows++) {
    const totalCombos = Math.pow(targetRows, blockCount);
    const blockRow = new Array<number>(blockCount);
    const rowUsed = new Array<boolean>(targetRows);
    const rowWidths = new Array<number>(targetRows);

    let bestCombo = -1;
    let minMaxRowW = Infinity;

    for (let combo = 0; combo < totalCombos; combo++) {
      if (!decodeAssignment(combo, blockCount, targetRows, blockRow, rowUsed)) continue;
      computeRowWidths(blockRow, blockCount, targetRows, blockWidths, rowWidths);

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
        const totalW = rWidths.reduce((a, w) => a + w + BOX_CHROME, 0) + (rBlocks.length - 1) * GAP;
        rows.push({ blocks: rBlocks, widths: rWidths, totalW });
      }

      // Sort rows ascending by width (pyramid shape)
      rows.sort((a, b) => a.totalW - b.totalW);
      return rows.map(r => ({ blocks: r.blocks, widths: r.widths }));
    }
  }

  // Fallback: stacked single blocks
  return blocks.map(b => ({ blocks: [b], widths: [b.width] }));
}

export function render(data: AgyStatusData, width: number, config: StatusBlocksConfig = {}): string {
  const order = config.segments ?? DEFAULT_ORDER;
  const segmentsMap = new Map<string, Segment>(ALL_SEGMENTS.map(s => [s.id, s]));

  const activeSegments = order
    .map(id => segmentsMap.get(id))
    .filter((s): s is Segment => !!s && s.enabled(data));

  const blocks = activeSegments.map(s => s.render(data, width));
  const groups = solveLayout(blocks, width);

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(...renderRow(group));
  }
  return lines.join('\n');
}
