#!/usr/bin/env node
// Invoked by semantic-release's @semantic-release/exec `prepareCmd` with the
// next release version as $1. It is the ONLY code path allowed to write
// version numbers - never edit package.json/style.css/readme.txt by hand.
// After writing every source, it re-reads them all and fails loudly if any
// of them didn't take (typo in wp-ci.config.json, read-only file, ...)
// instead of silently shipping a mismatched release.

import { loadConfig } from './lib/config.mjs';
import { writeVersion, describeTarget } from './lib/version-targets.mjs';
import { verifyVersionConsistency } from './lib/verify.mjs';
import { assertValidSemver } from './lib/semver.mjs';
import { run, ok, info } from './lib/log.mjs';

await run(async () => {
  const [version] = process.argv.slice(2);
  if (!version) {
    throw new Error('Usage: set-version.mjs <version>');
  }
  assertValidSemver(version, 'the version passed to set-version.mjs');

  const config = await loadConfig();

  for (const target of config.versionTargets) {
    await writeVersion(target, version);
    info(`Updated ${describeTarget(target)} -> ${version}`);
  }

  await verifyVersionConsistency(config, version);
  ok(`All ${config.versionTargets.length} version source(s) now report ${version}`);
});
