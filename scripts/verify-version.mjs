#!/usr/bin/env node
// Standalone consistency check, run both as an MR-pipeline gate (no expected
// version - just "do all sources agree and are they valid semver?") and as
// semantic-release's `verifyReleaseCmd` (with the next version passed in,
// so a release cannot publish against stale/half-updated version files).

import { loadConfig } from './lib/config.mjs';
import { verifyVersionConsistency } from './lib/verify.mjs';
import { run, ok } from './lib/log.mjs';

await run(async () => {
  const [expectedVersion] = process.argv.slice(2);

  const config = await loadConfig();
  const version = await verifyVersionConsistency(config, expectedVersion);

  ok(`All ${config.versionTargets.length} version source(s) consistently report ${version}`);
});
