#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename, sep } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { render } from './layout.js';
import { color, c } from './colors.js';
import type { AgyStatusData } from './types.js';

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
  try {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version?: string };
    return manifest.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
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

function isInstallable(path: string): boolean {
  return !/\.test\./.test(basename(path));
}

function installFiles(): string {
  const dest = installDir();
  const distDir = dirname(fileURLToPath(import.meta.url));
  mkdirSync(dest, { recursive: true });
  cpSync(distDir, dest, { recursive: true, force: true, filter: isInstallable });
  return dest;
}

function runInit(): void {
  const dest = installFiles();
  const settings = readSettings();

  settings.statusLine = {
    ...(settings.statusLine ?? {}),
    type: 'command',
    command: statusLineCommand(dest),
    enabled: true,
  };

  writeSettings(settings);

  console.log(color('✓ agy-statusblocks installed successfully', c.green, c.bold));
  console.log(`  Renderer: ${color(dest, c.dim)}`);
  console.log(`  Settings: ${color(settingsPath(), c.dim)}`);
  console.log(`\nRestart Antigravity CLI (${color('agy', c.gemini)}) to activate.`);
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

function runPreview(): void {
  const now = Date.now() / 1000;
  const mockData: AgyStatusData = {
    product: 'antigravity',
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
    rate_limits: {
      five_hour: {
        used_percentage: 18,
        resets_at: Math.floor(now + 3600 * 2.5),
      },
      seven_day: {
        used_percentage: 64,
        resets_at: Math.floor(now + 3600 * 42),
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
    cost: {
      estimated: 0.005,
    },
    effort: {
      level: 'medium',
    },
  };

  console.log(`\n${color('agy-statusblocks preview', c.bold, c.gemini)}\n`);
  for (const width of [120, 80, 50]) {
    console.log(color('─'.repeat(width), c.gray));
    console.log(`${width} cols:`);
    console.log(render(mockData, width));
    console.log();
  }
}

function showHelp(): void {
  console.log(`
${color('agy-statusblocks', c.bold, c.gemini)} v${PACKAGE_VERSION}
Adaptive status line for Antigravity CLI (agy)

${color('Usage:', c.bold)}
  agy-statusblocks init       Install and configure agy-statusblocks in ~/.gemini/antigravity-cli/settings.json
  agy-statusblocks preview    Preview responsive layout at 120, 80, and 50 terminal columns
  agy-statusblocks uninstall  Revert ~/.gemini/antigravity-cli/settings.json to default statusline
  agy-statusblocks --help     Show this help
  agy-statusblocks --version  Show version
`);
}

const arg = process.argv[2];
if (arg === 'init') {
  runInit();
} else if (arg === 'uninstall') {
  runUninstall();
} else if (arg === 'preview') {
  runPreview();
} else if (arg === '--version' || arg === '-v') {
  console.log(PACKAGE_VERSION);
} else {
  showHelp();
}
