#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync, existsSync } from 'fs';
import { join, dirname, basename, sep } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { render } from './layout.js';
import { loadConfig, normalizeBorderStyle, VALID_BORDER_STYLES } from './config.js';
import { color, c } from './colors.js';
import { isValidVersion, isNewerVersion } from './version.js';
import type { AgyStatusData, BorderStyle } from './types.js';

type Settings = {
  statusLine?: {
    type?: string;
    command?: string;
    enabled?: boolean;
    stack_with_default?: boolean;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

const PACKAGE_VERSION: string = (() => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version?: unknown };
  if (typeof manifest.version !== 'string' || !isValidVersion(manifest.version)) {
    throw new Error('package.json contains an invalid version');
  }
  return manifest.version;
})();

function settingsPath(): string {
  return join(homedir(), '.gemini', 'antigravity-cli', 'settings.json');
}

function installDir(): string {
  return join(homedir(), '.gemini', 'antigravity-cli', 'statusblocks');
}

function statusLineCommand(dest: string): string {
  return `node "${join(dest, 'index.js').split(sep).join('/')}"`;
}

function isOurCommand(cmd: string): boolean {
  return cmd.includes('agy-statusblocks') || /[\\/]statusblocks[\\/]index\.js/.test(cmd);
}

function readSettings(): Settings {
  try {
    return JSON.parse(readFileSync(settingsPath(), 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`could not parse ${settingsPath()}: ${err instanceof Error ? err.message : err}`);
  }
}

function writeSettings(s: Settings): void {
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
}

const VERSION_STAMP = '.version';
const KEEP_FILES = new Set(['.last-update-check', VERSION_STAMP]);

function isInstallable(path: string): boolean {
  return !/\.test\./.test(basename(path));
}

function installedVersion(dest: string): string {
  try {
    return readFileSync(join(dest, VERSION_STAMP), 'utf8').trim();
  } catch {
    return '';
  }
}

function installFiles(): string {
  const dest = installDir();
  const distDir = dirname(fileURLToPath(import.meta.url));
  mkdirSync(dest, { recursive: true });
  cpSync(distDir, dest, { recursive: true, force: true, filter: isInstallable });
  for (const rel of readdirSync(dest, { recursive: true }) as string[]) {
    if (KEEP_FILES.has(rel)) continue;
    if (existsSync(join(distDir, rel)) && isInstallable(rel)) continue;
    rmSync(join(dest, rel), { recursive: true, force: true });
  }
  writeFileSync(join(dest, VERSION_STAMP), PACKAGE_VERSION);
  return dest;
}

function runInit(): void {
  console.log(`\n${color('agy-statusblocks', c.gemini, c.bold)} setup\n`);
  try {
    const dest = installFiles();
    const command = statusLineCommand(dest);
    const settings = readSettings();
    const oldCommand = settings.statusLine?.command;

    settings.statusLine = {
      ...(settings.statusLine ?? {}),
      type: 'command',
      command,
      enabled: true,
    };

    writeSettings(settings);
    if (oldCommand && oldCommand !== command) console.log(`  Replaced:  ${color(oldCommand, c.dim)}`);
    console.log(`  Installed: ${color(command, c.green)}`);
    console.log(`  Files:     ${color(dest, c.dim)}`);
    console.log(`  Settings:  ${color('~/.gemini/antigravity-cli/settings.json', c.dim)}`);
    console.log(`\n  Run ${color('npx agy-statusblocks update', c.cyan)} to update later.\n`);
  } catch (err) {
    console.error(`  Error: Could not update ${settingsPath()}`);
    console.error(`  ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
}

function runUpdate(force: boolean): void {
  console.log(`\n${color('agy-statusblocks', c.gemini, c.bold)} update\n`);
  try {
    const installed = installedVersion(installDir());
    if (!force && isNewerVersion(installed, PACKAGE_VERSION)) {
      console.log(`  Kept:     installed ${color(installed, c.green)} is newer than this package (${PACKAGE_VERSION})`);
      console.log(`  ${color('Run with --force to downgrade.', c.dim)}\n`);
      return;
    }

    const dest = installFiles();
    console.log(`  Updated:  ${color(dest, c.green)}`);

    try {
      const settings = readSettings();
      const cmd = String(settings.statusLine?.command ?? '');
      const command = statusLineCommand(dest);
      if (cmd && isOurCommand(cmd) && cmd !== command) {
        settings.statusLine = { type: 'command', ...settings.statusLine, command };
        console.log(`  Migrated: ${color(command, c.cyan)}`);
        writeSettings(settings);
      }
    } catch { /* settings update is best-effort */ }

    console.log();
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
}

function runUninstall(): void {
  const settings = readSettings();
  if (settings.statusLine) {
    settings.statusLine.command = '';
    settings.statusLine.type = '';
    writeSettings(settings);
  }
  console.log(color('✓ agy-statusblocks uninstalled and reverted to built-in status line', c.green));
}

function parseBorderFlag(argv: string[]): BorderStyle | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--border' || arg === '-b') {
      const next = argv[i + 1];
      if (next) return normalizeBorderStyle(next);
    } else if (arg && arg.startsWith('--border=')) {
      return normalizeBorderStyle(arg.slice('--border='.length));
    }
  }
  return undefined;
}

function runPreview(borderOverride?: BorderStyle): void {
  process.env['AGY_STATUSBLOCKS_NO_REMOTE'] = '1';
  const config = loadConfig();
  if (borderOverride) {
    config.border = borderOverride;
  }
  const now = Date.now() / 1000;
  const mockData: AgyStatusData = {
    product: 'antigravity',
    version: '1.4.12',
    conversation_id: 'preview-session-1234',
    agent_state: 'idle',
    model: {
      id: 'gemini-3.8-flash',
      display_name: 'Gemini 3.8 Flash (Medium)',
    },
    context_window: {
      context_window_size: 1048576,
      used_percentage: 12.4,
      total_input_tokens: 124000,
      total_output_tokens: 6000,
    },
    quota: {
      'Gemini 3.8 Flash': {
        remaining_fraction: 0.82,
        reset_in_seconds: Math.floor(3600 * 2.5),
      },
      'Claude Sonnet 5.5': {
        remaining_fraction: 0.64,
        reset_in_seconds: Math.floor(3600 * 4.2),
      },
      'Claude Opus 5.5': {
        remaining_fraction: 0.90,
        reset_in_seconds: Math.floor(3600 * 4.2),
      },
    },
    current_dir: join(homedir(), 'code', 'my-project'),
    workspace: {
      current_dir: join(homedir(), 'code', 'my-project'),
    },
    vcs: {
      type: 'git',
      branch: 'main',
      dirty: false,
    },
    plan_tier: 'Consumer',
    task_count: 0,
    subagents: [],
    artifact_count: 1,
    effort: {
      level: 'medium',
    },
  };

  const styleLabel = config.border ?? 'rounded';
  console.log(`\n${color('agy-statusblocks', c.bold, c.gemini)} preview ${color(`[border: ${styleLabel}]`, c.dim)}\n`);
  for (const width of [120, 80, 50]) {
    console.log(color('─'.repeat(width), c.gray));
    console.log(`${width} cols:`);
    console.log(render(mockData, width, config));
    console.log();
  }
}

function showHelp(): void {
  console.log(`
${color('agy-statusblocks', c.bold, c.gemini)} — block-based status line for Antigravity CLI (agy)

${color('Usage:', c.bold)}
  agy-statusblocks init                        Install into Antigravity CLI settings
  agy-statusblocks update                      Update installed files (--force to downgrade)
  agy-statusblocks preview [--border <style>]  Preview with mock data at various widths
  agy-statusblocks uninstall                   Revert to built-in statusline
  agy-statusblocks --version                   Print the installed package version
  agy-statusblocks help                        Show this help

${color('Blocks:', c.bold)}
  context    Context window fill bar, percentage, token counts
  model      Model name, directory, reasoning effort, tier, cost, version
  usage      5-hour, daily, and 7-day rate limit utilization
  state      Agent state pill and task/subagent/artifact counters
  git        Branch, staged/modified counts, lines added/removed

${color('Borders:', c.bold)}
  rounded (default), square, double, thick, ascii, none

${color('Customize:', c.bold)}
  ~/.agy-statusblocks.json:   { "segments": ["context", "model", "usage", "state", "git"], "border": "rounded" }
  Env vars:                   AGY_STATUSBLOCKS_SEGMENTS=context,model,usage
                              AGY_STATUSBLOCKS_BORDER=rounded|square|double|thick|ascii|none
  CLI flags:                  --border, -b <style>
`);
}

const borderFlag = parseBorderFlag(process.argv.slice(2));
if (borderFlag) {
  process.env['AGY_STATUSBLOCKS_BORDER'] = borderFlag;
}

const firstPositional = process.argv.slice(2).find(arg => !arg.startsWith('-'));
switch (firstPositional) {
  case 'init': runInit(); break;
  case 'update': runUpdate(process.argv.includes('--force')); break;
  case 'preview': runPreview(borderFlag); break;
  case 'uninstall': runUninstall(); break;
  case undefined:
    if (process.argv.includes('--version') || process.argv.includes('-v')) {
      console.log(PACKAGE_VERSION);
    } else if (process.argv.includes('--help') || process.argv.includes('-h')) {
      showHelp();
    } else if (process.stdin.isTTY) {
      showHelp();
    } else {
      import('./index.js');
    }
    break;
  case 'help': showHelp(); break;
  default:
    if (process.stdin.isTTY) { showHelp(); }
    else { import('./index.js'); }
}
