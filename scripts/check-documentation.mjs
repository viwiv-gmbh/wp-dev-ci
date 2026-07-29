#!/usr/bin/env node
// MR-pipeline gate for the documentation policy: the MR description must
// check exactly one of the configured documentation options, and if that
// option names a required file (README.md, readme.txt, MIGRATION.md/docs/
// migrations), the MR diff must actually touch it - so "README updated" is
// never left checked without a matching change.

import { loadConfig } from './lib/config.mjs';
import { fetchMergeRequest, resolveCurrentMergeRequest } from './lib/gitlab-api.mjs';
import { resolveMergeRequestBaseRef, changedFiles } from './lib/git.mjs';
import { run, ok, info } from './lib/log.mjs';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Which of the configured options are checked ("- [x] Option text") in the MR description. */
function findCheckedOptions(description, options) {
  return options.filter((option) => {
    const pattern = new RegExp(`^[ \\t]*[-*]\\s*\\[[xX]\\]\\s*${escapeRegExp(option)}\\s*$`, 'm');
    return pattern.test(description ?? '');
  });
}

await run(async () => {
  const config = await loadConfig();
  const { projectId, mergeRequestIid } = resolveCurrentMergeRequest();

  const mergeRequest = await fetchMergeRequest(projectId, mergeRequestIid);
  const options = config.documentation.options;
  const checked = findCheckedOptions(mergeRequest.description, options);

  if (checked.length === 0) {
    throw new Error(
      `The merge request description must check exactly one documentation option:\n  - ${options.join('\n  - ')}\n` +
        'None of them are checked. Use the merge request template and tick the box that applies.'
    );
  }

  if (checked.length > 1) {
    throw new Error(
      `The merge request description must check exactly one documentation option, but ${checked.length} are checked:\n  - ${checked.join('\n  - ')}`
    );
  }

  const [selected] = checked;
  info(`Documentation option selected: "${selected}"`);

  const requiredFiles = config.documentation.requiredFiles[selected];
  if (requiredFiles && requiredFiles.length > 0) {
    const baseRef = resolveMergeRequestBaseRef();
    const changed = changedFiles(baseRef);
    const touched = requiredFiles.some((requiredPath) =>
      changed.some((changedPath) => changedPath === requiredPath || changedPath.startsWith(`${requiredPath}/`))
    );

    if (!touched) {
      throw new Error(
        `Documentation option "${selected}" is selected, but none of the required path(s) were modified in this MR: ${requiredFiles.join(', ')}`
      );
    }
  }

  ok(`Documentation policy satisfied ("${selected}")`);
});
