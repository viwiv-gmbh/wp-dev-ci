#!/usr/bin/env node
// Verifies the artifact a build actually produced, not just the source
// files: the release ZIP's filename must encode the resolved version, its
// checksum file (once generated) must match the ZIP's real bytes, and
// CHANGELOG.md's latest entry must name that same version. Runs both as the
// MR pipeline's "verify the generated package" gate (no version arg - it
// resolves the current, pre-release version) and after semantic-release's
// changelog/exec steps during a real release (version passed explicitly).

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { verifyVersionConsistency } from './lib/verify.mjs';
import { run, ok, info } from './lib/log.mjs';

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function findPackageZip(directory, slug) {
  if (!existsSync(directory)) {
    throw new Error(`Package directory "${directory}" does not exist - run the build step first.`);
  }

  const prefix = `${slug}-`;
  const candidates = (await readdir(directory)).filter((name) => name.startsWith(prefix) && name.endsWith('.zip'));

  if (candidates.length === 0) {
    throw new Error(`No release package found in "${directory}" matching "${prefix}*.zip".`);
  }
  if (candidates.length > 1) {
    throw new Error(`Expected exactly one release package in "${directory}", found: ${candidates.join(', ')}`);
  }
  return candidates[0];
}

async function latestChangelogVersion(changelogPath) {
  const content = await readFile(changelogPath, 'utf8');
  const match = content.match(/^#{1,2}\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\]?/m);
  if (!match) {
    throw new Error(`Could not find a version heading at the top of ${changelogPath}`);
  }
  return match[1];
}

await run(async () => {
  const config = await loadConfig();
  const [explicitVersion] = process.argv.slice(2);
  const version = explicitVersion || (await verifyVersionConsistency(config));

  const { directory, slug } = config.packageZip;
  const zipName = await findPackageZip(directory, slug);
  const expectedZipName = `${slug}-${version}.zip`;

  if (zipName !== expectedZipName) {
    throw new Error(`Release package "${zipName}" does not match the expected filename "${expectedZipName}"`);
  }
  ok(`Package filename matches version: ${zipName}`);

  const zipPath = path.join(directory, zipName);
  const checksumPath = `${zipPath}.sha256`;
  if (existsSync(checksumPath)) {
    const expectedHash = (await readFile(checksumPath, 'utf8')).trim().split(/\s+/)[0];
    const actualHash = await sha256(zipPath);
    if (expectedHash !== actualHash) {
      throw new Error(
        `SHA256 checksum in ${checksumPath} does not match the package contents (expected ${expectedHash}, got ${actualHash})`
      );
    }
    ok(`Checksum verified: ${checksumPath}`);
  } else {
    info(`No checksum file at ${checksumPath} yet - skipping checksum verification`);
  }

  const changelogPath = path.join(config.projectRoot, config.changelogFile);
  if (existsSync(changelogPath)) {
    const changelogVersion = await latestChangelogVersion(changelogPath);
    if (changelogVersion !== version) {
      throw new Error(
        `Latest ${config.changelogFile} entry is "${changelogVersion}", but the resolved version is "${version}"`
      );
    }
    ok(`${config.changelogFile} latest entry matches version: ${version}`);
  } else {
    info(`${config.changelogFile} does not exist yet - skipping changelog check (expected before the first release)`);
  }
});
