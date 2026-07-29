// Single source of truth for "are all version sources consistent?" - used by
// both verify-version.mjs (standalone CI check) and set-version.mjs (which
// must re-verify immediately after writing, per the "fail on any mismatch"
// requirement) so the comparison logic never has to be kept in sync twice.

import { isValidSemver } from './semver.mjs';
import { readAllVersions, describeTarget } from './version-targets.mjs';

/**
 * @param {object} config - loaded wp-ci.config.json (see lib/config.mjs)
 * @param {string} [expectedVersion] - if given, every source must equal this exact version
 * @returns {Promise<string>} the agreed-upon version
 */
export async function verifyVersionConsistency(config, expectedVersion) {
  const results = await readAllVersions(config);
  const errors = [];

  for (const { target, version } of results) {
    if (!isValidSemver(version)) {
      errors.push(`${describeTarget(target)} contains "${version}", which is not valid semantic versioning`);
    }
  }

  const distinctVersions = [...new Set(results.map((result) => result.version))];

  if (errors.length === 0 && distinctVersions.length > 1) {
    const breakdown = results.map((result) => `${describeTarget(result.target)} = ${result.version}`).join('\n      ');
    errors.push(`Version sources disagree with each other:\n      ${breakdown}`);
  }

  const resolvedVersion = distinctVersions.length === 1 ? distinctVersions[0] : undefined;

  if (errors.length === 0 && expectedVersion && resolvedVersion !== expectedVersion) {
    errors.push(`All version sources report "${resolvedVersion}", but the expected released version is "${expectedVersion}"`);
  }

  if (errors.length > 0) {
    throw new Error(`Version verification failed:\n  - ${errors.join('\n  - ')}`);
  }

  return resolvedVersion;
}
