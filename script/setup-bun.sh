#!/usr/bin/env bash
set -euo pipefail

# Install Bun if missing, ensure PATH is persisted to ~/.zshrc,
# run `bun install` in repo root, and optionally start a dev target.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Repository root: $REPO_ROOT"

if command -v bun >/dev/null 2>&1; then
  echo "bun found: $(bun -v)"
else
  echo "bun not found — installing to ~/.bun"
  curl -fsSL https://bun.sh/install | bash
fi

# Ensure bun is available in this session
export PATH="$HOME/.bun/bin:$PATH"

SHELL_RC="$HOME/.zshrc"
EXPORT_LINE='export PATH="$HOME/.bun/bin:$PATH"'
if ! grep -Fxq "$EXPORT_LINE" "$SHELL_RC" 2>/dev/null; then
  printf "%s\n" "$EXPORT_LINE" >> "$SHELL_RC"
  echo "Appended Bun PATH to $SHELL_RC"
fi

cd "$REPO_ROOT"
echo "Running: bun install"
bun install

if [ "$#" -gt 0 ]; then
  TARGET="$1"
  case "$TARGET" in
    web)
      echo "Starting web dev server: bun run dev:web"
      exec bun run dev:web
      ;;
    dev|core)
      echo "Starting core dev: bun run dev"
      exec bun run dev
      ;;
    desktop)
      echo "Starting desktop dev: bun run dev:desktop"
      exec bun run dev:desktop
      ;;
    *)
      echo "Unknown target: $TARGET. Valid: web, dev, desktop"
      exit 2
      ;;
  esac
fi

echo "Done. To start a dev target run: $0 web|dev|desktop"
