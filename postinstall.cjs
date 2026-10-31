// Auto-update ~/.gemini/antigravity-cli/statusblocks/ on npm install/update (if already installed via init)
const { existsSync } = require('fs');
const { execFileSync } = require('child_process');
const { join } = require('path');
const { homedir } = require('os');

try {
  const dest = join(homedir(), '.gemini', 'antigravity-cli', 'statusblocks');
  if (existsSync(dest)) {
    execFileSync(process.execPath, [join(__dirname, 'dist', 'cli.js'), 'update'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
} catch {
  // Best-effort — don't fail the install
}
