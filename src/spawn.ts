import { spawn } from 'child_process';

export function spawnDetached(execPath: string, args: string[]): void {
  try {
    const child = spawn(execPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Best-effort detached spawn
  }
}
