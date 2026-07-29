<!--
  This file is written as instructions FOR an AI coding agent (Claude Code),
  not for a human reader. Copy it into the plugin/theme/block repository that
  should adopt the wp-dev-ci pipeline (or paste its contents into a Claude
  Code session opened there), then ask Claude Code to follow it.

  Do NOT run this against rocket-gmbh/rocket-theme-ci itself - it only makes
  sense inside a *consuming* project.
-->

# Set up the wp-dev-ci pipeline in this project

## Context

This repository is a WordPress plugin, theme, or block that should adopt the
`wp-dev-ci` GitLab CI pipeline: image `viwiv/wp-dev-ci`, built and published
from `rocket-gmbh/rocket-theme-ci`. Once wired up, the pipeline validates
Conventional Commits MR titles, enforces a documentation checklist, guards
generated files (`CHANGELOG.md` + version fields) against manual edits, and
fully automates semantic-release-driven versioning and GitLab Releases -
nobody touches version numbers or the changelog by hand again. Background
and full reference: `docs/WORDPRESS-CI-WORKFLOW.md` in
`rocket-gmbh/rocket-theme-ci`.

Work through the steps below in order. Steps 1-5 are file changes you can
make directly. Step 6 needs GitLab project-settings/admin access you don't
have - list those items back to the user at the end instead of attempting
them.

## Steps

1. **Determine the project type** by inspecting the repo:
   - a `.php` file with a `Plugin Name:` header docblock -> `type: "plugin"`
   - a `style.css` with a `Theme Name:` header docblock -> `type: "theme"`
   - a `block.json` -> `type: "block"`
   If more than one signal matches (e.g. a plugin that bundles a block), ask
   the user which type applies instead of guessing.

2. **Add `.gitlab-ci.yml`** at the repo root (or add the `include:` block to
   an existing one - don't overwrite unrelated content):

   ```yaml
   include:
     - project: 'rocket-gmbh/rocket-theme-ci'
       ref: v1.0.0 # ask the user which released tag to pin to - never a branch
       file: '/templates/gitlab-ci-wordpress.yml'
   ```

   Ask the user which `rocket-theme-ci` tag to pin `ref:` to; do not invent a
   version number.

3. **Add `wp-ci.config.json`** at the repo root. Start from the template that
   matches the type detected in step 1, then replace every placeholder file
   name / constant name with this project's real ones.

   Plugin (`type: "plugin"`):

   ```json
   {
     "type": "plugin",
     "versionTargets": [
       { "file": "package.json", "type": "json", "path": "version" },
       { "file": "example-plugin.php", "type": "header", "field": "Version" },
       { "file": "example-plugin.php", "type": "constant", "name": "EXAMPLE_PLUGIN_VERSION" },
       { "file": "readme.txt", "type": "wp-readme-stable-tag" }
     ],
     "changelogFile": "CHANGELOG.md",
     "packageZip": { "directory": "dist", "slug": "example-plugin" }
   }
   ```

   Theme (`type: "theme"`):

   ```json
   {
     "type": "theme",
     "versionTargets": [
       { "file": "package.json", "type": "json", "path": "version" },
       { "file": "style.css", "type": "header", "field": "Version" },
       { "file": "functions.php", "type": "constant", "name": "EXAMPLE_THEME_VERSION" }
     ],
     "changelogFile": "CHANGELOG.md",
     "packageZip": { "directory": "dist", "slug": "example-theme" }
   }
   ```

   Drop the `functions.php` constant entry if the theme has none.

   Block (`type: "block"`):

   ```json
   {
     "type": "block",
     "versionTargets": [
       { "file": "package.json", "type": "json", "path": "version" },
       { "file": "block.json", "type": "json", "path": "version" }
     ],
     "changelogFile": "CHANGELOG.md",
     "packageZip": { "directory": "dist", "slug": "example-block" }
   }
   ```

   Add a `header` entry for the block's PHP bootstrap file only if it ships
   wrapped in a plugin bootstrap (i.e. it has its own `Version:` header).

   The four `versionTargets[].type` values (`json`, `header`,
   `wp-readme-stable-tag`, `constant`) are exhaustive - see
   `docs/WORDPRESS-CI-WORKFLOW.md` in `rocket-gmbh/rocket-theme-ci` for the
   field reference if a project needs a source not covered above.

4. **Add `.releaserc.json`** at the repo root, then set the
   `@semantic-release/git` `assets` array to the real file list this
   project's version targets from step 3 touch (typically: the main plugin
   PHP file / `style.css`, `readme.txt` if present, `package.json`,
   `block.json` if present, `CHANGELOG.md`):

   ```json
   {
     "branches": ["main"],
     "tagFormat": "v${version}",
     "plugins": [
       "@semantic-release/commit-analyzer",
       "@semantic-release/release-notes-generator",
       ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
       [
         "@semantic-release/exec",
         {
           "verifyReleaseCmd": "node $WP_CI_SCRIPTS/verify-version.mjs ${nextRelease.version}",
           "prepareCmd": "node $WP_CI_SCRIPTS/set-version.mjs ${nextRelease.version} && npm run build && npm run package && node $WP_CI_SCRIPTS/write-checksum.mjs ${nextRelease.version} && node $WP_CI_SCRIPTS/verify-package.mjs ${nextRelease.version}"
         }
       ],
       [
         "@semantic-release/git",
         {
           "assets": ["package.json", "CHANGELOG.md", "readme.txt", "style.css", "*.php", "block.json"],
           "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
         }
       ],
       [
         "@semantic-release/gitlab",
         {
           "assets": [
             { "path": "dist/*.zip", "label": "Release package" },
             { "path": "dist/*.zip.sha256", "label": "SHA256 checksum" }
           ]
         }
       ]
     ]
   }
   ```

   Remove asset globs for files the project doesn't have (a theme has no
   `block.json`; a block with no PHP bootstrap has no `*.php` to commit).

5. **Add `.gitlab/merge_request_templates/Default.md`** - copy verbatim, do
   not rename the checkbox options or alter the checkbox markup:
   `check-documentation.mjs` matches these five options literally.

   ```markdown
   ## Summary

   <!-- What does this change do, and why? -->

   ## Documentation

   <!-- Check exactly ONE box. CI fails the MR if zero or more than one is checked. -->

   - [ ] No documentation changes required
   - [ ] README updated
   - [ ] WordPress readme updated
   - [ ] Developer documentation updated
   - [ ] Migration documentation updated

   ## Checklist

   - [ ] MR title follows Conventional Commits (e.g. `feat(scope): add thing`, `fix: correct thing`)
   - [ ] CHANGELOG.md and version numbers were **not** edited by hand - semantic-release owns them
   ```

6. **Merge `package.json` scripts** - don't overwrite existing `lint`/
   `test`/`build` scripts; if the project has none yet, ask the user what to
   use rather than inventing a lint/test setup:
   - `lint`, `test`, `build`: whatever the project already uses.
   - `package`: must zip the build output to
     `<packageZip.directory>/<packageZip.slug>-<version>.zip` (matching the
     `packageZip` values from step 3). The `zip` CLI is already present in
     the `wp-dev-ci` image at CI time. Example for a project that packages
     straight from the repo root:

     ```json
     "package": "mkdir -p dist && zip -r dist/example-plugin-$(node -p \"require('./package.json').version\").zip . -x 'node_modules/*' 'dist/*' '.git/*'"
     ```

     Replace `example-plugin` with the real `packageZip.slug`, and add
     `-x` excludes for anything else that shouldn't ship (`.gitlab-ci.yml`,
     `tests/*`, etc).

## What to report back instead of doing

List these for the user - they need GitLab project-settings/admin access:

- Confirm the `ref:` tag pinned in step 2 is actually the intended
  `rocket-theme-ci` release.
- In GitLab project settings: protect branch `main` and tag pattern `v*`
  (allowed to push: no one / maintainers only - the release job pushes via
  `GITLAB_TOKEN`).
- Add a masked, protected CI/CD variable `GITLAB_TOKEN` (scope: `api`), used
  by `@semantic-release/gitlab` to tag and create the Release.
- If job-token API access is restricted for the project, also add
  `GITLAB_API_TOKEN` (scope: `read_api`) - `check-documentation.mjs` falls
  back to it for reading the MR description.

## Verifying the result before handing back

- Every file referenced in `wp-ci.config.json`'s `versionTargets` and in
  `.releaserc.json`'s `@semantic-release/git` `assets` actually exists in
  the repo.
- The `packageZip.slug` in `wp-ci.config.json` matches the slug used in the
  `package` npm script.
- No unrelated content in an existing `.gitlab-ci.yml` was removed.
