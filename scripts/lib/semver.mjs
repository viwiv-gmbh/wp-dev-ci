// Self-contained semver check (the official regex from semver.org) so version
// validation has no dependency footprint beyond what the image already ships.

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isValidSemver(version) {
  return typeof version === 'string' && SEMVER_RE.test(version);
}

export function assertValidSemver(version, context) {
  if (!isValidSemver(version)) {
    throw new Error(
      `Invalid semantic version${context ? ` for ${context}` : ''}: "${version}". ` +
        'Expected MAJOR.MINOR.PATCH with optional -prerelease / +build metadata (see semver.org).'
    );
  }
  return version;
}
