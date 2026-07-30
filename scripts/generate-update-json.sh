#!/usr/bin/env bash
set -euo pipefail

# Generate the JSON metadata consumed by a WordPress plugin updater.
PLUGIN_FILE="${1:?Pass the main plugin file}"
OUTPUT_FILE="${2:?Pass the output JSON path}"
DOWNLOAD_URL="${3:?Pass the package download URL}"

if [ ! -f "$PLUGIN_FILE" ]; then
    echo "Error: Plugin file $PLUGIN_FILE not found"
    exit 1
fi

# Extract the version from the WordPress plugin header.
VERSION="$(sed -nE 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*([^[:space:]]+).*/\1/p' "$PLUGIN_FILE")"

if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from $PLUGIN_FILE"
    exit 1
fi

echo "Generating update JSON for version: $VERSION"

# Write updater metadata
mkdir -p "$(dirname "$OUTPUT_FILE")"
cat > "$OUTPUT_FILE" << EOF
{
  "version": "$VERSION",
  "download_url": "$DOWNLOAD_URL",
  "last_updated": "$(date -Iseconds)"
}
EOF

echo "Update JSON created at $OUTPUT_FILE"
cat "$OUTPUT_FILE"
