#!/usr/bin/env node

import { getOAuthToken } from './credentials.js';
import { normalizeLimits, storeRemoteLimits } from './remote-usage.js';

async function main(): Promise<void> {
  const token = getOAuthToken();
  if (!token) return;

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return;

  const body = (await res.json()) as { limits?: unknown };
  storeRemoteLimits(normalizeLimits(body?.limits));
}

main().catch(() => {
  // Silent fallback
});
