// Every consuming WordPress project (plugin, theme, or block) declares its
// own version sources and documentation rules in wp-ci.config.json at its
// repo root. Loading and validating that file lives in exactly one place so
// every script (set-version, verify-version, check-generated-files, ...)
// sees the same, already-defaulted shape and fails the same way on typos.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assertValidTargetType } from './version-targets.mjs';

const CONFIG_FILENAME = 'wp-ci.config.json';
const VALID_PROJECT_TYPES = ['plugin', 'theme', 'block'];

const DEFAULT_DOCUMENTATION_OPTIONS = [
  'No documentation changes required',
  'README updated',
  'WordPress readme updated',
  'Developer documentation updated',
  'Migration documentation updated',
];

const DEFAULT_REQUIRED_FILES = {
  'README updated': ['README.md'],
  'WordPress readme updated': ['readme.txt'],
  'Migration documentation updated': ['MIGRATION.md', 'docs/migrations'],
};

export async function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    throw new Error(
      `Missing ${CONFIG_FILENAME} in ${cwd}. Every project using this pipeline must declare its version sources ` +
        `and documentation policy there. See templates/wp-ci.config.*.example.json in the wp-dev-ci image repository ` +
        '(rocket-gmbh/rocket-theme-ci) for plugin/theme/block starting points.'
    );
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${configPath}: ${error.message}`);
  }

  const errors = [];

  if (!VALID_PROJECT_TYPES.includes(raw.type)) {
    errors.push(`"type" must be one of ${VALID_PROJECT_TYPES.join(', ')}, got: ${JSON.stringify(raw.type)}`);
  }

  if (!Array.isArray(raw.versionTargets) || raw.versionTargets.length === 0) {
    errors.push('"versionTargets" must be a non-empty array');
  } else {
    raw.versionTargets.forEach((target, index) => {
      if (!target.file) {
        errors.push(`versionTargets[${index}] is missing "file"`);
        return;
      }
      try {
        assertValidTargetType(target.type);
      } catch (error) {
        errors.push(`versionTargets[${index}]: ${error.message}`);
        return;
      }
      if (target.type === 'json' && !target.path) {
        errors.push(`versionTargets[${index}] ("${target.file}") has type "json" but is missing "path"`);
      }
      if (target.type === 'constant' && !target.name) {
        errors.push(`versionTargets[${index}] ("${target.file}") has type "constant" but is missing "name"`);
      }
      if (target.type === 'header' && !target.field) {
        errors.push(`versionTargets[${index}] ("${target.file}") has type "header" but is missing "field"`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n  - ${errors.join('\n  - ')}`);
  }

  const changelogFile = raw.changelogFile ?? 'CHANGELOG.md';

  return {
    projectRoot: cwd,
    type: raw.type,
    versionTargets: raw.versionTargets,
    changelogFile,
    packageZip: {
      directory: 'dist',
      slug: path.basename(cwd),
      ...raw.packageZip,
    },
    // Files only the release pipeline (via semantic-release) may touch.
    protectedGeneratedFiles: raw.protectedGeneratedFiles ?? [changelogFile],
    documentation: {
      options: DEFAULT_DOCUMENTATION_OPTIONS,
      requiredFiles: { ...DEFAULT_REQUIRED_FILES, ...raw.documentation?.requiredFiles },
    },
  };
}
