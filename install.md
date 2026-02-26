# IronCode Installation Guide

## For Users

### Option 1: NPM (Recommended)

```bash
# Install globally
npm install -g ironcode-ai

# Or use with npx (no installation needed)
npx ironcode-ai
```

### Option 2: Homebrew (macOS/Linux)

```bash
# Add the IronCode tap
brew tap KSD-CO/tap

# Install IronCode
brew install ironcode

# Update to latest version
brew upgrade ironcode
```

### Option 3: Direct Download

Download pre-built binaries from [GitHub Releases](https://github.com/KSD-CO/IronCode/releases/latest)

**Linux (x64):**

```bash
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-linux-x64.tar.gz | tar xz
sudo mv ironcode /usr/local/bin/
ironcode --version
```

**macOS (Apple Silicon):**

```bash
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-darwin-arm64.tar.gz | tar xz
sudo mv ironcode /usr/local/bin/
ironcode --version
```

**macOS (Intel):**

```bash
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-darwin-x64.tar.gz | tar xz
sudo mv ironcode /usr/local/bin/
ironcode --version
```

**Windows:**

1. Download `ironcode-win32-x64.zip` from releases page
2. Extract `ironcode.exe`
3. Add to PATH or run directly

## For Developers

### Prerequisites

- **Bun 1.3.8** (exact version required)
- **Rust** (latest stable)
- **Git**

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc if you use zsh
```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/KSD-CO/IronCode.git
cd IronCode

# Install dependencies
bun install

# Build Rust native components
cd packages/ironcode/native/tool
cargo build --release
cd ../../../..

# Run in development mode
bun dev

# Or build standalone executable
cd packages/ironcode
bun run build
```

The compiled binary will be in `packages/ironcode/dist/ironcode/bin/ironcode`

### Development Commands

```bash
# Run tests
bun test

# Type checking
bun run typecheck

# Format code
./script/format.ts

# Benchmark Rust components
cd packages/ironcode/native/tool
cargo bench
```

## Configuration

Set up API keys for the AI models you want to use:

```bash
# Anthropic Claude (recommended)
export ANTHROPIC_API_KEY="your-key-here"

# OpenAI
export OPENAI_API_KEY="your-key-here"

# Add to your shell profile
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.bashrc
```

## Troubleshooting

### "Command not found: ironcode"

If installed via npm:

```bash
# Check npm global bin path
npm config get prefix

# Add to PATH if needed
export PATH="$PATH:$(npm config get prefix)/bin"
```

### "Permission denied"

On Linux/macOS, you may need to make the binary executable:

```bash
chmod +x /usr/local/bin/ironcode
```

### Bun version mismatch

The project requires exactly Bun 1.3.8:

```bash
# Install specific version
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.8"
```

## Support

- **Issues**: https://github.com/KSD-CO/IronCode/issues
- **Discussions**: https://github.com/KSD-CO/IronCode/discussions
