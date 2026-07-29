// Reads and writes a single "version source" inside a consuming WordPress
// project (package.json, a plugin/theme header, a PHP constant, or a
// WordPress readme.txt "Stable tag"). set-version.mjs, verify-version.mjs and
// check-generated-files.mjs all drive every version source through this same
// parsing/patching code, so there is exactly one place that understands each
// file format - on disk (read/writeVersion) or against arbitrary content
// pulled from git history (extractVersionFromContent).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VALID_TYPES = ['json', 'header', 'constant', 'wp-readme-stable-tag'];

export function assertValidTargetType(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Unknown version target type "${type}". Expected one of: ${VALID_TYPES.join(', ')}`);
  }
}

export function describeTarget(target) {
  switch (target.type) {
    case 'json':
      return `${target.file} ("${target.path}")`;
    case 'header':
      return `${target.file} (${target.field} header)`;
    case 'wp-readme-stable-tag':
      return `${target.file} (Stable tag)`;
    case 'constant':
      return `${target.file} (${target.name} constant)`;
    default:
      return target.file;
  }
}

function getByPath(object, dotPath) {
  return dotPath.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function setByPath(object, dotPath, value) {
  const keys = dotPath.split('.');
  const last = keys.pop();
  const parent = keys.reduce((value, key) => (value[key] ??= {}), object);
  parent[last] = value;
}

// Matches WordPress-style block-comment headers, e.g. " * Version: 1.2.3" or
// a bare "Stable tag: 1.2.3" line in readme.txt.
function headerRegex(field) {
  return new RegExp(`(^|\\r?\\n)([ \\t*]*${field}:[ \\t]*)([^\\r\\n]*)`, 'i');
}

// Matches either define('NAME', '1.2.3') or const NAME = '1.2.3'.
function constantPatterns(name) {
  return [
    new RegExp(`(define\\(\\s*['"]${name}['"]\\s*,\\s*['"])([^'"]*)(['"])`),
    new RegExp(`(const\\s+${name}\\s*=\\s*['"])([^'"]*)(['"])`),
  ];
}

/** Parses a version out of raw file content (no filesystem access - works on git-show output too). */
export function extractVersionFromContent(target, content, fileLabel = target.file) {
  assertValidTargetType(target.type);

  switch (target.type) {
    case 'json': {
      const value = getByPath(JSON.parse(content), target.path);
      if (value === undefined) {
        throw new Error(`Field "${target.path}" not found in ${fileLabel}`);
      }
      return String(value);
    }
    case 'header':
    case 'wp-readme-stable-tag': {
      const field = target.type === 'wp-readme-stable-tag' ? 'Stable tag' : target.field;
      const match = content.match(headerRegex(field));
      if (!match) {
        throw new Error(`Header field "${field}:" not found in ${fileLabel}`);
      }
      return match[3].trim();
    }
    case 'constant': {
      for (const pattern of constantPatterns(target.name)) {
        const match = content.match(pattern);
        if (match) return match[2];
      }
      throw new Error(
        `Version constant "${target.name}" not found in ${fileLabel} ` +
          `(expected define('${target.name}', '...') or const ${target.name} = '...')`
      );
    }
    default:
      throw new Error(`Unhandled version target type "${target.type}"`);
  }
}

/** Returns updated file content with the version source patched in place. */
export function applyVersionToContent(target, content, version) {
  assertValidTargetType(target.type);

  switch (target.type) {
    case 'json': {
      const data = JSON.parse(content);
      if (getByPath(data, target.path) === undefined) {
        throw new Error(`Field "${target.path}" not found in ${target.file}`);
      }
      setByPath(data, target.path, version);
      return `${JSON.stringify(data, null, 2)}\n`;
    }
    case 'header':
    case 'wp-readme-stable-tag': {
      const field = target.type === 'wp-readme-stable-tag' ? 'Stable tag' : target.field;
      const regex = headerRegex(field);
      if (!regex.test(content)) {
        throw new Error(`Header field "${field}:" not found in ${target.file}`);
      }
      return content.replace(regex, (_match, newline, prefix) => `${newline}${prefix}${version}`);
    }
    case 'constant': {
      for (const pattern of constantPatterns(target.name)) {
        if (pattern.test(content)) {
          return content.replace(pattern, (_match, prefix, _old, suffix) => `${prefix}${version}${suffix}`);
        }
      }
      throw new Error(
        `Version constant "${target.name}" not found in ${target.file} ` +
          `(expected define('${target.name}', '...') or const ${target.name} = '...')`
      );
    }
    default:
      throw new Error(`Unhandled version target type "${target.type}"`);
  }
}

export async function readVersion(target, cwd = process.cwd()) {
  const filePath = path.join(cwd, target.file);
  const content = await readFile(filePath, 'utf8');
  return extractVersionFromContent(target, content, filePath);
}

export async function writeVersion(target, version, cwd = process.cwd()) {
  const filePath = path.join(cwd, target.file);
  const content = await readFile(filePath, 'utf8');
  const updated = applyVersionToContent(target, content, version);
  await writeFile(filePath, updated, 'utf8');
}

/** Reads every configured version target, in order, alongside its own target descriptor. */
export async function readAllVersions(config) {
  return Promise.all(
    config.versionTargets.map(async (target) => ({
      target,
      version: await readVersion(target, config.projectRoot),
    }))
  );
}
