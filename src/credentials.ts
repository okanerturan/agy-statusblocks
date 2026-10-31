import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function parseToken(raw: string): string | null {
  try {
    const creds = JSON.parse(raw);
    const oauth = creds?.claudeAiOauth;
    if (!oauth || typeof oauth.accessToken !== 'string' || !oauth.accessToken) return null;
    if (typeof oauth.expiresAt === 'number' && oauth.expiresAt < Date.now()) return null;
    return oauth.accessToken;
  } catch {
    return null;
  }
}

export function getOAuthToken(): string | null {
  try {
    const configDir = process.env['CLAUDE_CONFIG_DIR'] || join(homedir(), '.claude');
    const raw = readFileSync(join(configDir, '.credentials.json'), 'utf8');
    const token = parseToken(raw);
    if (token) return token;
  } catch {
    // No credentials file
  }

  if (process.platform === 'darwin') {
    try {
      const raw = execSync('security find-generic-password -s "Claude Code-credentials" -w', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 5000,
      });
      return parseToken(raw.trim());
    } catch {
      // Keychain read failed or locked
    }
  }
  return null;
}
