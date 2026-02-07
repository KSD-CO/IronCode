#!/usr/bin/env bash
set -euo pipefail

# Lightweight runner to ensure Bun is available in PATH and start a dev target.
# Usage:
#   ./run.sh          # runs `bun run dev`
#   ./run.sh web      # runs `bun run dev:web`
#   ./run.sh desktop  # runs `bun run dev:desktop`

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$HOME/.bun/bin:$PATH"

TARGET="${1:-dev}"

case "$TARGET" in
  web)
    echo "Starting web dev: bun run dev:web"
    exec bun run dev:web
    ;;
  desktop)
    echo "Starting desktop dev: bun run dev:desktop"
    exec bun run dev:desktop
    ;;
  dev)
    echo "Starting dev: bun run dev"
    exec bun run dev
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Usage: $0 [dev|web|desktop]" >&2
    exit 2
    ;;
esac
