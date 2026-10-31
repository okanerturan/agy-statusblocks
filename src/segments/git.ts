import { execSync } from 'child_process';
import type { Segment } from '../types.js';
import { color, c, visibleLength } from '../colors.js';
import { readCache, writeCache, hashKey } from '../cache.js';

const GIT_CACHE_TTL = 4000;

type GitInfo = { branch: string; staged: number; modified: number; added: number; removed: number };

let memo: { cwd: string; info: GitInfo | null } | null = null;

function defang(s: string): string {
  return s.replace(/[^\x20-\x7e\u00a0-\uffff]/g, '');
}

function normalize(v: unknown): GitInfo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.branch !== 'string') return null;
  return {
    branch: defang(o.branch),
    staged: Number(o.staged) || 0,
    modified: Number(o.modified) || 0,
    added: Number(o.added) || 0,
    removed: Number(o.removed) || 0,
  };
}

function getGitInfo(cwd: string): GitInfo | null {
  if (memo && memo.cwd === cwd) return memo.info;

  const cacheName = `git-${hashKey(cwd)}`;
  const cached = readCache<GitInfo | null>(cacheName, GIT_CACHE_TTL);
  if (cached !== undefined) {
    memo = { cwd, info: normalize(cached) };
    return memo.info;
  }

  let info: GitInfo | null = null;
  try {
    let branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!branch) {
      branch = '@' + execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    }
    const stagedOut = execSync('git diff --cached --numstat', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const modifiedOut = execSync('git diff --numstat', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const staged = stagedOut ? stagedOut.split('\n').length : 0;
    const modified = modifiedOut ? modifiedOut.split('\n').length : 0;
    let added = 0, removed = 0;
    for (const line of [...(stagedOut ? stagedOut.split('\n') : []), ...(modifiedOut ? modifiedOut.split('\n') : [])]) {
      const [a, r] = line.split('\t');
      if (a && a !== '-') added += parseInt(a, 10) || 0;
      if (r && r !== '-') removed += parseInt(r, 10) || 0;
    }
    info = normalize({ branch, staged, modified, added, removed });
  } catch {
    info = null;
  }

  memo = { cwd, info };
  writeCache(cacheName, info);
  return info;
}

export const gitSegment: Segment = {
  id: 'git',
  priority: 40,
  enabled: (data) => {
    if (data.vcs?.branch) return true;
    const cwd = data.workspace?.current_dir || data.current_dir || process.cwd();
    const info = getGitInfo(cwd);
    return info !== null && info.branch !== '';
  },
  render(data) {
    const cwd = data.workspace?.current_dir || data.current_dir || process.cwd();
    const info = getGitInfo(cwd);

    const branch = data.vcs?.branch || info?.branch || 'git';
    const line1 = color(branch, c.cyan);

    let line2 = color('clean', c.dim);
    if (info) {
      const parts: string[] = [];
      if (info.staged > 0) parts.push(color(`${info.staged} staged`, c.green));
      if (info.modified > 0) parts.push(color(`${info.modified} modified`, c.yellow));
      if (parts.length === 0) parts.push(color('clean', c.dim));
      if (info.added > 0 || info.removed > 0) {
        parts.push(`${color(`+${info.added}`, c.green)} ${color(`-${info.removed}`, c.red)}`);
      }
      line2 = parts.join(color(' · ', c.dim));
    } else if (data.vcs?.dirty) {
      line2 = color('modified', c.yellow);
    }

    const lines = [line1, line2];
    const width = Math.max(...lines.map(visibleLength));
    return { id: 'git', priority: 40, width, lines };
  },
};
