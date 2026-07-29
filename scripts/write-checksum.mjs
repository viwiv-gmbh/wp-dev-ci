#!/usr/bin/env node
// Writes <zip>.sha256 next to the resolved release package, in the
// "<hash>  <filename>" format both `sha256sum` and verify-package.mjs expect.
// A small dedicated script (rather than a `sha256sum` shell one-liner inside
// .releaserc) so the checksum format only has to be right in one place, and
// so the release pipeline needs no shell quoting to get the filename right.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { verifyVersionConsistency } from './lib/verify.mjs';
import { run, ok } from './lib/log.mjs';

await run(async () => {
  const config = await loadConfig();
  const [explicitVersion] = process.argv.slice(2);
  const version = explicitVersion || (await verifyVersionConsistency(config));

  const { directory, slug } = config.packageZip;
  const zipName = `${slug}-${version}.zip`;
  const zipPath = path.join(directory, zipName);

  const hash = createHash('sha256').update(await readFile(zipPath)).digest('hex');
  const checksumPath = `${zipPath}.sha256`;
  await writeFile(checksumPath, `${hash}  ${zipName}\n`, 'utf8');

  ok(`Wrote ${checksumPath}`);
});
