// Thin wrapper around the `git` binary already present in the image, used by
// check-generated-files.mjs and check-documentation.mjs to see what an MR
// actually changed. Kept in one place so every script resolves "what changed
// in this MR" the exact same way.

import { execFileSync } from 'node:child_process';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * The base commit GitLab computed for this merge request diff. Preferred
 * over the target branch name because it is the actual merge-base, not a
 * moving ref, so it works even if the target branch advanced after the MR
 * pipeline started.
 */
export function resolveMergeRequestBaseRef() {
  if (process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA) {
    return process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
  }
  if (process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME) {
    return `origin/${process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`;
  }
  throw new Error(
    'Could not resolve a merge request base ref. This script must run in a GitLab merge request pipeline ' +
      '(CI_MERGE_REQUEST_DIFF_BASE_SHA / CI_MERGE_REQUEST_TARGET_BRANCH_NAME not set). Ensure the job uses ' +
      '`rules: - if: $CI_PIPELINE_SOURCE == "merge_request_event"` and GIT_DEPTH is large enough (or 0) to see the base commit.'
  );
}

export function changedFiles(baseRef, headRef = 'HEAD', cwd = process.cwd()) {
  try {
    const output = git(['diff', '--name-only', `${baseRef}...${headRef}`], cwd);
    return output.length > 0 ? output.split('\n') : [];
  } catch (error) {
    throw new Error(
      `Failed to diff ${baseRef}...${headRef} (${error.message}). The base commit may not be fetched locally - ` +
        'set GIT_DEPTH: "0" (or fetch the target branch explicitly) in the MR pipeline job.'
    );
  }
}

/** Returns file content at a given ref, or null if the file did not exist there. */
export function fileAtRef(ref, filePath, cwd = process.cwd()) {
  try {
    return git(['show', `${ref}:${filePath}`], cwd);
  } catch {
    return null;
  }
}
