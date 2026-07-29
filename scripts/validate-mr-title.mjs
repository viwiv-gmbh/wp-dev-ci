#!/usr/bin/env node
// GitLab exposes the current MR title as $CI_MERGE_REQUEST_TITLE in a merge
// request pipeline. semantic-release's commit-analyzer decides the next
// version from squashed/merge commit messages, so if the MR title doesn't
// follow Conventional Commits, a merge can silently produce a commit that
// releases nothing (or the wrong bump). Checked with a small self-contained
// regex rather than @commitlint/* - one less dependency baked into the image
// for a grammar this simple.

import { run, ok } from './lib/log.mjs';

const TYPES = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'];

const CONVENTIONAL_COMMIT_RE = new RegExp(`^(${TYPES.join('|')})(\\([\\w./-]+\\))?(!)?: .+$`);

function stripDraftPrefix(title) {
  return title.replace(/^\s*(draft|wip)\s*:\s*/i, '');
}

await run(async () => {
  const title = process.env.CI_MERGE_REQUEST_TITLE;
  if (!title) {
    throw new Error('CI_MERGE_REQUEST_TITLE is not set - this script must run in a GitLab merge request pipeline.');
  }

  const subject = stripDraftPrefix(title).trim();

  if (!CONVENTIONAL_COMMIT_RE.test(subject)) {
    throw new Error(
      `Merge request title "${title}" does not follow Conventional Commits.\n` +
        `  Expected: <type>(<optional scope>)(!): <description>\n` +
        `  Allowed types: ${TYPES.join(', ')}\n` +
        '  Example: feat(auth): add password reset flow'
    );
  }

  ok(`Merge request title follows Conventional Commits: "${title}"`);
});
