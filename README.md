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
  Node scripts, baked in at `/opt/wp-ci` (`$WP_CI_SCRIPTS`) - see below

## WordPress semantic-release pipeline

This image also provides everything a WordPress plugin/theme/block repo
needs to fully automate semantic versioning and releases via GitLab CI:
Conventional Commits validation, generated-file/version protection, a
documentation policy gate, and a `semantic-release`-driven release job that
tags, changelogs, and publishes a GitLab Release with a checksummed ZIP.

- `scripts/` - the validation/version scripts, copied into the image
- `templates/` - copyable `.gitlab-ci.yml` include, `.releaserc.json`,
  `wp-ci.config.json` examples (plugin/theme/block), and an MR description
  template
- **Full walkthrough:** [docs/WORDPRESS-CI-WORKFLOW.md](docs/WORDPRESS-CI-WORKFLOW.md)

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

## Maintenance contract boundaries

- This is a generic public image service repository.
- Consumers should pin explicit tags and test before adopting updates.
- Security disclosures should follow SECURITY.md.