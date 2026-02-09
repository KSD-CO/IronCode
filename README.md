<p align="center">
  <img src="packages/app/public/favicon.svg" alt="IronCode logo" width="120">
</p>
<p align="center"><strong>IronCode</strong></p>
<p align="center">Lightweight, local-first AI coding agent</p>
<p align="center">
  <a href="https://github.com/anomalyco/opencode"><img alt="Upstream" src="https://img.shields.io/badge/upstream-opencode-blue?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/ironcode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/ironcode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

---

## What is IronCode?

IronCode is a simplified, local-first fork of [OpenCode](https://github.com/anomalyco/opencode) - an AI coding agent that runs entirely on your machine. This fork removes cloud dependencies and focuses on core functionality: a powerful CLI and desktop app for AI-assisted coding.

### Key Features

- 🖥️ **Desktop App**: Native desktop application built with Tauri
- ⌨️ **CLI Interface**: Terminal UI for command-line workflows
- 🏠 **100% Local**: No cloud services, works completely offline
- 🔒 **Privacy First**: Your code never leaves your machine
- 🎯 **Lightweight**: Removed all cloud infrastructure dependencies
- ⚡ **Fast**: No network latency, instant responses

### What Changed from OpenCode?

**Removed:**

- ❌ Cloud infrastructure (Cloudflare Workers, R2 storage)
- ❌ Web-based deployment
- ❌ GitHub Action integration
- ❌ Billing/subscription system
- ❌ Authentication services
- ❌ Session sharing features

**Kept:**

- ✅ Full desktop application
- ✅ Complete CLI experience
- ✅ All AI agent capabilities
- ✅ Local session management
- ✅ Plugin system
- ✅ Multiple AI model support

---

## Installation

### Desktop App

Download the latest release for your platform:

- [macOS (Apple Silicon)](https://github.com/KSD-CO/IronCode/releases)
- [macOS (Intel)](https://github.com/KSD-CO/IronCode/releases)
- [Windows](https://github.com/KSD-CO/IronCode/releases)
- [Linux (AppImage)](https://github.com/KSD-CO/IronCode/releases)

### CLI

```bash
# Using npm
npm install -g ironcode-ai

# Using bun
bun install -g ironcode-ai
```

---

## Usage

### Desktop App

Simply launch the IronCode desktop app from your applications folder or start menu.

### CLI

```bash
# Start interactive session in current directory
ironcode

# Run with specific model
ironcode --model anthropic/claude-sonnet-4

# Open desktop app
ironcode web
```

---

## Agents

IronCode includes built-in agents you can switch between with the `Tab` key:

- **build** - Full-access agent for development work (default)
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases

Also included is a **general** subagent for complex searches and multistep tasks.
Invoke it with `@general` in your messages.

---

## Development

### Building From Source

```bash
# Clone the repository
git clone https://github.com/KSD-CO/IronCode.git
cd ironcode

# Install dependencies
bun install

# Build TypeScript components
bun run build

# Run CLI locally
bun run dev

# Run desktop app
bun run dev:desktop
```

### Development Commands

```bash
# Run tests
bun test

# Type checking
bun run typecheck

# Format code (using prettier)
bun run format
```

---

## Architecture

IronCode is built with:

- **CLI/TUI**: TypeScript + Bun runtime
- **Desktop App**: Tauri (Rust) + SolidJS
- **Web Frontend**: SolidJS (embedded in desktop app)
- **Plugins**: TypeScript plugin system
- **Native Tools**: Rust for performance-critical operations

### Project Structure

```
ironcode/
├── packages/
│   ├── ironcode/      # CLI and core agent
│   ├── desktop/       # Tauri desktop application
│   ├── app/           # Web frontend (SolidJS)
│   ├── ui/            # Shared UI components
│   ├── plugin/        # Plugin system
│   ├── sdk/           # TypeScript SDK
│   └── ...
├── sdks/
│   └── vscode/        # VS Code extension
└── ...
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting pull requests.

**Areas we're looking for help:**

- Performance optimizations
- Bug fixes and testing
- Documentation improvements
- New plugin development

---

## Upstream Sync

This fork periodically syncs with [upstream OpenCode](https://github.com/anomalyco/opencode) to incorporate new features and bug fixes.

```bash
# To sync with upstream
git remote add upstream https://github.com/anomalyco/opencode.git
git fetch upstream
git merge upstream/dev
```

---

## License

This project maintains the same license as [OpenCode](https://github.com/anomalyco/opencode).

---

## Acknowledgments

- **OpenCode Team**: For creating the original open-source AI coding agent
- All contributors to this fork

---

## Links

- [Upstream OpenCode](https://github.com/anomalyco/opencode)
- [OpenCode Documentation](https://docs.opencode.ai)
