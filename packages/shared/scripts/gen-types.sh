#!/bin/bash
# Generate TypeScript types from the Supabase schema.
# Requires: supabase CLI on PATH, linked to a project or local instance running.
#
# Usage:
#   ./scripts/gen-types.sh
#   ./scripts/gen-types.sh --local   (uses local instance on port 54321)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/../src/database.types.ts"

if [[ "${1:-}" == "--local" ]]; then
  echo "Generating types from local Supabase instance..."
  supabase gen types typescript --local > "$OUTPUT"
else
  echo "Generating types from linked project..."
  supabase gen types typescript --linked > "$OUTPUT"
fi

echo "Types written to $OUTPUT"
