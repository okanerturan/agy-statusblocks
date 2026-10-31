import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { isValidVersion, isNewerVersion } from './version.js';

const REGISTRY_URL = 'https://registry.npmjs.org/agy-statusblocks/latest';

async function main(): Promise<void> {
  let installed = '';
  try {
    installed = readFileSync(new URL('./.version', import.meta.url), 'utf8').trim();
  } catch { /* unstamped install */ }

  let latest = '';
  try {
    const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const body = (await res.json()) as { version?: unknown };
    if (typeof body.version === 'string') latest = body.version.trim();
  } catch { return; }

  if (!isValidVersion(latest)) return;
  if (isValidVersion(installed) && !isNewerVersion(latest, installed)) return;

  execSync(`npx -y agy-statusblocks@${latest} update`, {
    stdio: 'ignore',
    windowsHide: true,
    timeout: 300000,
  });
}

main().catch(() => { /* auto-update is best-effort */ });
