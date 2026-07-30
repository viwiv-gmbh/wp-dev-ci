#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Pass version}"
SLUG="${2:?Pass package slug}"
OUTDIR="${3:-dist}"
INCLUDE_FILE="${4:-dist.include}"
WORKDIR=".zipstage/${SLUG}"

rm -rf ".zipstage" && mkdir -p "$WORKDIR" "$OUTDIR"

# A release job can receive dist/ artifacts from an earlier build. Keep the
# package step idempotent so the release validators and asset globs see only
# the package produced for the current version.
find "$OUTDIR" -maxdepth 1 -type f \
  \( -name '*.zip' -o -name '*.zip.sha256' \) -delete

# Copy only the project allowlist into the staged package
rsync -a --delete --include-from="$INCLUDE_FILE" --exclude='*' ./ "$WORKDIR/"

pushd ".zipstage" >/dev/null
zip -r "../${OUTDIR}/${SLUG}-${VERSION}.zip" "${SLUG}/"
popd >/dev/null

echo "Built ${OUTDIR}/${SLUG}-${VERSION}.zip"
