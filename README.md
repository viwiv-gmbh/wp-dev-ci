# wp-dev-ci

Public CI image for WordPress-related PHP and Node build workflows.

## Image location

Published image target:

viwiv/wp-dev-ci (Docker Hub)

## Local build

docker build -t viwiv/wp-dev-ci:node-22 .

## Local run

docker run -it --rm -v "$(pwd)":/mount viwiv/wp-dev-ci:node-22 bash

## Multi-architecture build examples

docker build --platform linux/amd64 -t viwiv/wp-dev-ci:node-22-amd64 .
docker build --platform linux/arm64 -t viwiv/wp-dev-ci:node-22-arm64 .

## Included toolchain (high level)

- Node.js 22 (Alpine 3.20 base - see [docs/WORDPRESS-CI-WORKFLOW.md](docs/WORDPRESS-CI-WORKFLOW.md#image-maintenance-notes))
- npm (latest), git
- PHP 8.2 with common extensions (pdo, session, tokenizer, fileinfo, xml, redis, sqlite, mysql)
- Composer
- build tools (make, g++, rsync, openssh, zip, unzip)
- a pinned `semantic-release` toolchain (+ commit-analyzer, release-notes-generator,
  changelog, git, gitlab, exec plugins) and a set of version-sync/validation
  Node and shell scripts, baked in at `/opt/wp-ci` (`$WP_CI_SCRIPTS`) - see below

## WordPress semantic-release pipeline

This image also provides everything a WordPress plugin/theme/block repo
needs to fully automate semantic versioning and releases via GitLab CI:
Conventional Commits validation, generated-file/version protection, a
documentation policy gate, and a `semantic-release`-driven release job that
tags, changelogs, and publishes a GitLab Release with a checksummed ZIP.

- `scripts/` - validation, versioning, packaging, checksum, and updater-metadata
  scripts copied into the image and exposed through `$WP_CI_SCRIPTS`
- `templates/` - copyable `.gitlab-ci.yml` include, `.releaserc.json`,
  `wp-ci.config.json` examples (plugin/theme/block), and an MR description
  template
- **Full walkthrough:** [docs/WORDPRESS-CI-WORKFLOW.md](docs/WORDPRESS-CI-WORKFLOW.md)

### Shared release scripts

Projects with a `dist.include` rsync allowlist can use the shared ZIP builder:

```bash
bash "$WP_CI_SCRIPTS/build-zip.sh" VERSION example-plugin
```

The arguments are version, package slug, optional output directory (default
`dist`), and optional allowlist path (default `dist.include`). The builder
removes stale ZIP/checksum artifacts before creating the current package.

Plugin deployment jobs can generate updater metadata without a project-local
script:

```bash
bash "$WP_CI_SCRIPTS/generate-update-json.sh" \
  example-plugin.php dist/example-plugin-update.json \
  https://plugins.example.com/example-plugin.zip
```

## Automated release

This repository includes a GitHub Actions workflow that:

- Builds multi-arch images for linux/amd64 and linux/arm64
- Publishes to Docker Hub (`viwiv/wp-dev-ci`)
- Runs Trivy vulnerability scanning on pull requests

Required repository secrets for publish:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

The publish workflow runs on:

- Pushes to main
- Version tags matching v*
- Manual workflow dispatch

## Testing the release pipeline locally

GitHub-hosted runners aren't free, so exercise `.github/workflows/release-image.yml`
locally with [`act`](https://github.com/nektos/act) (runs Actions jobs in Docker)
before pushing:

```
brew install act   # once
npm run test:pipeline:scan-pr          # builds the image + runs the Trivy scan job
npm run test:pipeline:build-and-push   # exercises QEMU/buildx setup + Docker Hub login
```

Requirements: Docker running locally, `act` on `PATH`. First run downloads
the `catthehacker/ubuntu:act-latest` runner image (~500MB) and caches it.

What each script actually proves, and its limits:

- **`test:pipeline:scan-pr`** builds the real `Dockerfile` inside the runner
  container - this is the meaningful part, and a broken `Dockerfile`/`npm ci`/
  baked-in script will show up here exactly as it would in CI. The job then
  fails at the Trivy step regardless: `aquasecurity/setup-trivy@v0.2.2` can't
  resolve the `trivy` binary inside `act`'s emulated runner
  (`trivy: command not found`), a known `act` limitation, not a workflow bug.
  Read the log for the `Build image for scan` step's result; a failure there
  is real, a failure at `Run Trivy` in isolation is expected locally.
- **`test:pipeline:build-and-push`** uses hard-coded fake credentials
  (`local-dry-run`/`local-dry-run`) on purpose - it verifies QEMU setup and
  the Buildx multi-arch builder come up correctly, then is *expected* to fail
  at the "Login to Docker Hub" step (`unauthorized: incorrect username or
  password`). That failure is the safety mechanism: it proves the job cannot
  reach the actual `docker build --push` step without real secrets, so
  running it never touches Docker Hub. The `docker/metadata-action` tag
  logic and the real multi-arch push can only be verified by an actual
  GitHub Actions run with real `DOCKERHUB_TOKEN`/`DOCKERHUB_USERNAME` secrets.

Both scripts therefore exit non-zero on a *successful* local test run - check
the log for which step failed and why, don't rely on the exit code alone.

- **`scan-pr` and `build-and-push` only run when a file listed in the
  `changes` job's `dorny/paths-filter` filter (`Dockerfile`,
  `.dockerignore`, `package.json`, `package-lock.json`, `scripts/**`, or the
  workflow file itself) actually changed** - a PR/push touching only
  `docs/`, `templates/`, or `README.md` skips both jobs on real GitHub.
  `act`'s synthetic `pull_request` event has no real base/head diff, so it
  may report zero changed files and skip `scan-pr` locally even when
  testing a real Dockerfile change - a local `act` artifact, not a workflow
  bug. `test:pipeline:build-and-push` is unaffected (`workflow_dispatch`
  always bypasses the filter) and remains the reliable local check that the
  real `Dockerfile` still builds via buildx.

## Maintenance contract boundaries

- This is a generic public image service repository.
- Consumers should pin explicit tags and test before adopting updates.
- Security disclosures should follow SECURITY.md.