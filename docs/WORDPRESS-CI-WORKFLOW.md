# Automated semantic versioning for WordPress projects

This document explains the release workflow that `wp-dev-ci` provides to
WordPress plugins, themes, and blocks hosted on GitLab. It is split in two:

- **This repository** builds and publishes the Docker image. It bakes in a
  pinned `semantic-release` toolchain and a set of Node scripts
  (`scripts/`), and ships copyable pipeline templates (`templates/`).
- **The consuming project** (a plugin/theme/block repo) includes the
  template pipeline, supplies a small `wp-ci.config.json`, and never touches
  version numbers or `CHANGELOG.md` by hand again.

## Why the toolchain lives in the image, not the consumer repo

Every WordPress project that adopts this pipeline would otherwise need to
`npm install semantic-release @semantic-release/...` on every CI run - one
more thing that can drift between builds, and one more install step per job.
Instead:

- `semantic-release` and its six plugins are installed once, at image build
  time, pinned by this repo's `package-lock.json` (`Dockerfile`).
- Validation/version scripts and shared packaging/updater utilities (`scripts/`)
  are copied into the image at `/opt/wp-ci/scripts`, exposed to every job as
  `$WP_CI_SCRIPTS`.
- Consumer pipelines call `semantic-release`, `node $WP_CI_SCRIPTS/<script>.mjs`,
  or `bash $WP_CI_SCRIPTS/<script>.sh` directly - nothing to install,
  identical behavior on every run, and a
  single place (this repo) to patch a bug in the release logic for every
  project using the image.

A given plugin/theme/block still keeps its own `package.json`. Its
`lint`/`test`/`build` commands remain project-specific. Projects using an
rsync allowlist can point `package` at `$WP_CI_SCRIPTS/build-zip.sh`; only the
project-specific `dist.include` allowlist stays in the consumer repository.

## Setting up a new consuming project

Steps 1-5 below are file changes only and can be delegated to Claude Code:
copy [`templates/CLAUDE-CODE-SETUP.md`](../templates/CLAUDE-CODE-SETUP.md)
into the consuming project's repo (or paste its contents into a Claude Code
session opened there) and have it work through the checklist. Step 6 needs
GitLab project-settings/admin access an agent won't have, so it stays manual.

1. Add `.gitlab-ci.yml`:

   ```yaml
   include:
     - project: 'rocket-gmbh/rocket-theme-ci'
       ref: v1.0.0   # pin to a released tag, never to a branch
       file: '/templates/gitlab-ci-wordpress.yml'
   ```

2. Copy `templates/wp-ci.config.<type>.example.json` to `wp-ci.config.json`
   at the project root and adjust file names/paths (see reference below).
3. Copy `templates/releaserc.json` to `.releaserc.json` and adjust the
   `@semantic-release/git` asset list to match `wp-ci.config.json`.
4. Copy `templates/merge_request_templates/Default.md` to
   `.gitlab/merge_request_templates/Default.md`.
5. In the project's `package.json`, add:
   - `lint`, `test`, `build` scripts (whatever the project already uses)
   - a `package` script that produces
     `<packageZip.directory>/<packageZip.slug>-<version>.zip`; projects with a
     `dist.include` allowlist can call the shared `build-zip.sh`
6. In GitLab project settings:
   - protect the `main` branch and the `v*` tag pattern (allowed to push:
     no one/maintainers only - the release job pushes via `GITLAB_TOKEN`)
   - add a masked, protected CI/CD variable `GITLAB_TOKEN` with `api` scope
     (used by `@semantic-release/gitlab` to tag and create the Release)
   - if job-token API access is restricted for the project, also add
     `GITLAB_API_TOKEN` (`read_api` scope) - `check-documentation.mjs` falls
     back to it for reading the MR description

From here, every merge to `main` that contains at least one `fix:`/`feat:`/
breaking-change commit produces a release automatically.

## Conventional Commits and how the version is decided

MR titles (which become the squash/merge commit message) must follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>)(!): <description>
```

`validate-mr-title.mjs` checks this against `$CI_MERGE_REQUEST_TITLE` in
every MR pipeline. `@semantic-release/commit-analyzer` then reads the commit
history on `main` to decide the next version using the Angular preset:

| Commit type | Result |
| --- | --- |
| `fix:` | patch release |
| `feat:` | minor release |
| any type with `!` or a `BREAKING CHANGE:` footer | major release |
| `docs:`, `chore:`, `style:`, `refactor:`, `test:`, `ci:`, `build:` | no release |

## `wp-ci.config.json` reference

```jsonc
{
  "type": "plugin",              // "plugin" | "theme" | "block"
  "versionTargets": [
    { "file": "package.json", "type": "json", "path": "version" },
    { "file": "my-plugin.php", "type": "header", "field": "Version" },
    { "file": "my-plugin.php", "type": "constant", "name": "MY_PLUGIN_VERSION" },
    { "file": "readme.txt", "type": "wp-readme-stable-tag" }
  ],
  "changelogFile": "CHANGELOG.md",           // default: CHANGELOG.md
  "packageZip": { "directory": "dist", "slug": "my-plugin" },
  "protectedGeneratedFiles": ["CHANGELOG.md"] // default: [changelogFile]
}
```

Version target types (implemented in `scripts/lib/version-targets.mjs`):

| `type` | Reads/writes | Required fields |
| --- | --- | --- |
| `json` | a dot-path inside a JSON file (`package.json`, `block.json`, ...) | `path` |
| `header` | a WordPress/plugin block-comment header line (`Version: 1.2.3`) | `field` |
| `wp-readme-stable-tag` | the `Stable tag:` line in `readme.txt` | - |
| `constant` | `define('NAME', '1.2.3')` or `const NAME = '1.2.3'` | `name` |

Every script that touches versions (`set-version.mjs`, `verify-version.mjs`,
`check-generated-files.mjs`, `verify-package.mjs`) is driven by this same
list, so there is exactly one place to add a new version source.

## The merge request pipeline

Runs on every MR (`$CI_PIPELINE_SOURCE == "merge_request_event"`), in
`validate` → `test` → `build` order, failing fast:

| Job | Script | What it rejects |
| --- | --- | --- |
| `validate:mr-title` | `validate-mr-title.mjs` | MR titles that aren't Conventional Commits |
| `validate:documentation` | `check-documentation.mjs` | zero or multiple documentation options checked in the MR description, or a checked option whose required file wasn't touched |
| `validate:generated-files` | `check-generated-files.mjs` | manual edits to `CHANGELOG.md` or any configured version field |
| `validate:versions` | `verify-version.mjs` | version sources that already disagree with each other, or aren't valid semver |
| `lint` / `test` | project's own npm scripts | the usual |
| `build` | project's own `build`/`package` scripts + `verify-package.mjs` | a package whose ZIP filename doesn't match the current version |

## The release pipeline

Runs only on `main`, only on an actual push (not schedules/manual triggers),
serialized by `resource_group: release` so two merges landing close together
can never run `semantic-release` concurrently:

1. `npm test` (repeat main is green before doing anything release-shaped)
2. `semantic-release` runs, which:
   - analyzes commits since the last `v*` tag to pick the next version
   - generates release notes and prepends them to `CHANGELOG.md`
   - runs `set-version.mjs <version>` - the **only** code path allowed to
     write version numbers, updating every configured target and
     re-verifying them all afterward
   - rebuilds the project (`npm run build && npm run package`) so any
     version string baked into compiled assets is correct, not just the
     source files `set-version.mjs` edited directly
   - writes `dist/<slug>-<version>.zip.sha256` (`write-checksum.mjs`)
   - re-verifies the package (`verify-package.mjs <version>`): filename
     matches the version, checksum matches the ZIP's real bytes, and
     `CHANGELOG.md`'s latest entry matches the version
   - commits the updated version files + `CHANGELOG.md` to `main`
     (`[skip ci]`) and creates the `v${version}` tag
   - creates the GitLab Release with the generated notes, and uploads the
     ZIP and its checksum as release assets

## Documentation policy

The MR description must check exactly one option (see
`templates/merge_request_templates/Default.md`):

| Option | Required file/path |
| --- | --- |
| No documentation changes required | - |
| README updated | `README.md` |
| WordPress readme updated | `readme.txt` |
| Developer documentation updated | - |
| Migration documentation updated | `MIGRATION.md` or `docs/migrations/` |

`check-documentation.mjs` reads the MR description via the GitLab API
(`CI_JOB_TOKEN`, falling back to `GITLAB_API_TOKEN`), counts checked boxes,
and - for options with a required path - checks it against the MR diff.

## Troubleshooting

- **"Could not resolve a merge request base ref"** - the job isn't running
  in an MR pipeline, or `GIT_DEPTH` is too shallow. The template sets
  `GIT_DEPTH: "0"` globally; don't override it to a small number in a job
  that runs `check-generated-files.mjs`, `check-documentation.mjs`, or
  `verify-version.mjs`/`verify-package.mjs` with the version diff checks.
- **"No GitLab API credentials available"** - job-token API access to the
  project's own API is disabled. Add `GITLAB_API_TOKEN` as described in
  setup step 6.
- **`semantic-release` exits with `ENOREPOURL`** - the project has no git
  `origin` remote and no `repositoryUrl` in `.releaserc.json`. This should
  never happen inside a real GitLab CI job (the runner clones from origin);
  it only shows up when testing `semantic-release` locally outside CI.

## Image maintenance notes

- `Dockerfile` pins `node:22-alpine3.20` rather than `node:22-alpine`: Alpine
  3.24+ dropped the `php82` package in favor of `php83`/`php84`. Pinning the
  Alpine release keeps the PHP 8.2 runtime this image has always shipped
  unchanged while still getting a Node runtime new enough for
  `semantic-release` 25.x (`^22.14.0 || >=24.10.0`).
- `git` was added to the package list - previously absent, but
  `semantic-release`'s plugins (`commit-analyzer`, `git`, `gitlab`) all shell
  out to it directly.
- The pinned toolchain (`package.json`/`package-lock.json` at the repo root)
  currently carries a handful of `npm audit` warnings from npm's own
  vendored dependencies (`tar`, `brace-expansion`) several levels down the
  tree. They're not reachable at runtime by anything these scripts do;
  bumping them requires a `semantic-release` major bump and should be
  revisited on its own.
