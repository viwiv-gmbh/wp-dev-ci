# wp-dev-ci

Public CI image for WordPress-related PHP and Node build workflows.

## Image location

Published image target:

viwiv/wp-dev-ci (Docker Hub)

## Local build

docker build -t viwiv/wp-dev-ci:node-21 .

## Local run

docker run -it --rm -v "$(pwd)":/mount viwiv/wp-dev-ci:node-21 bash

## Multi-architecture build examples

docker build --platform linux/amd64 -t viwiv/wp-dev-ci:node-21-amd64 .
docker build --platform linux/arm64 -t viwiv/wp-dev-ci:node-21-arm64 .

## Included toolchain (high level)

- Node.js 21 (Alpine base)
- npm (latest)
- PHP 8.2 with common extensions (pdo, session, tokenizer, fileinfo, xml, redis, sqlite, mysql)
- Composer
- build tools (make, g++, rsync, openssh, zip, unzip)

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