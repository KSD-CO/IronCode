#!/usr/bin/env bash
set -euo pipefail

# =========================
# Paths
# =========================
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IRONCODE_DIR="$REPO_ROOT/packages/ironcode"
RUST_DIR="$IRONCODE_DIR/native/tool"

export PATH="$HOME/.bun/bin:$PATH"

# =========================
# OS → suffix
# =========================
case "$(uname -s)" in
  Linux*)   LIB_SUFFIX="so" ;;
  Darwin*)  LIB_SUFFIX="dylib" ;;
  MINGW*|MSYS*|CYGWIN*) LIB_SUFFIX="dll" ;;
  *)
    echo "❌ Unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

# =========================
# Build config
# =========================

TARGET_DIR="release"
CARGO_FLAGS="--release"

LIB_NAME="libironcode_tool.${LIB_SUFFIX}"
LIB_PATH="$RUST_DIR/target/$TARGET_DIR/$LIB_NAME"

# =========================
# Rust build
# =========================
build_rust_if_needed() {
  if [[ -f "$LIB_PATH" ]]; then
    echo "✅ Native lib exists: $LIB_PATH"
    return
  fi

  echo "⚙️  Building Rust native ($BUILD_MODE)..."
  pushd "$RUST_DIR" >/dev/null

  if ! command -v cargo >/dev/null 2>&1; then
    echo "❌ cargo not found"
    exit 1
  fi

  cargo build $CARGO_FLAGS

  popd >/dev/null

  if [[ ! -f "$LIB_PATH" ]]; then
    echo "❌ Build finished but library not found:"
    echo "   $LIB_PATH"
    exit 1
  fi

  echo "✅ Rust native built: $LIB_PATH"
}

# =========================
# Run target
# =========================
TARGET="${1:-dev}"

case "$TARGET" in
  dev)
    export BUILD_MODE=debug
    build_rust_if_needed
    echo "🚀 Starting dev"
    exec bun run dev
    ;;
  web)
    export BUILD_MODE=release
    build_rust_if_needed
    echo "🌐 Starting web dev"
    exec bun run dev:web
    ;;
  desktop)
    export BUILD_MODE=release
    build_rust_if_needed
    echo "🖥️  Starting desktop dev"
    exec bun run dev:desktop
    ;;
  *)
    echo "❌ Unknown target: $TARGET"
    echo "Usage: $0 [dev|web|desktop]"
    exit 2
    ;;
esac
