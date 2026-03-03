```

@@@  @@@@@@@    @@@@@@   @@@  @@@      @@@@@@@   @@@@@@   @@@@@@@   @@@@@@@@
@@@  @@@@@@@@  @@@@@@@@  @@@@ @@@     @@@@@@@@  @@@@@@@@  @@@@@@@@  @@@@@@@@
@@!  @@!  @@@  @@!  @@@  @@!@!@@@     !@@       @@!  @@@  @@!  @@@  @@!
!@!  !@!  @!@  !@!  @!@  !@!!@!@!     !@!       !@!  @!@  !@!  @!@  !@!
!!@  @!@!!@!   @!@  !@!  @!@ !!@!     !@!       @!@  !@!  @!@  !@!  @!!!:!
!!!  !!@!@!    !@!  !!!  !@!  !!!     !!!       !@!  !!!  !@!  !!!  !!!!!:
!!:  !!: :!!   !!:  !!!  !!:  !!!     :!!       !!:  !!!  !!:  !!!  !!:
:!:  :!:  !:!  :!:  !:!  :!:  !:!     :!:       :!:  !:!  :!:  !:!  :!:
 ::  ::   :::  ::::: ::   ::   ::      ::: :::  ::::: ::   :::: ::   :: ::::
:     :   : :   : :  :   ::    :       :: :: :   : :  :   :: :  :   : :: ::

```

<p align="center"><strong>High-performance CLI AI coding agent</strong></p>
<p align="center">
  <a href="https://github.com/KSD-CO/IronCode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/KSD-CO/IronCode/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://www.npmjs.com/package/ironcode-ai"><img alt="npm version" src="https://img.shields.io/npm/v/ironcode-ai?style=flat-square" /></a>
  <a href="https://ironcode.cloud/"><img alt="Website" src="https://img.shields.io/badge/website-ironcode.cloud-brightgreen?style=flat-square" /></a>
</p>

---

## What is IronCode?

IronCode is a **high-performance CLI AI coding agent** — a fork of [OpenCode](https://github.com/anomalyco/opencode) that runs entirely on your machine. It rewrites performance-critical components in Rust for dramatically improved speed and memory efficiency.

### Key Features

- ⌨️ **CLI-First** — Powerful terminal UI optimized for keyboard-driven workflows
- 🔀 **Multi-Account Round-Robin** — Connect multiple API keys per provider for automatic load balancing
- 🎯 **Git Source Control** — Stage, commit, diff, push without leaving the TUI
- 🔍 **Code Changes Panel** — Diff viewer with inline comments and hunk revert
- 🔎 **Local Code Search** — BM25 + tree-sitter semantic search, offline, zero latency
- 📱 **Telegram Integration** — Control IronCode remotely from your phone
- 💻 **Built-in Terminal** — Fish-style autosuggest, tab completion, syntax highlighting
- 📝 **External Editor** — Opens `$EDITOR`/nvim with auto-install if missing
- 🏠 **100% Local** — No cloud services, works completely offline
- ⚡ **Blazing Fast** — Native Rust for all performance-critical operations

### Performance (Native Rust Components)

| Operation | Speedup | Notes |
|---|---|---|
| PTY/Terminal | **15x faster** | Zero-copy ring buffer |
| Edit Tool | **2–6x faster** | 9 smart replacement strategies |
| Bash Parser | **50–100x faster** | Native tree-sitter vs WASM |
| Archive extraction | **3–5x faster** | s-zip streaming reader |
| Grep search | **90–99% less memory** | Streams GB-sized files |
| File read | **1.5x faster, 99.7% less memory** | 64KB buffer + pre-allocation |
| Git operations | **1.8x faster** | libgit2, no process spawning |

---

## Installation

### NPM (Recommended)

```bash
npm install -g ironcode-ai
```

### Homebrew (macOS/Linux)

```bash
brew tap KSD-CO/tap https://github.com/KSD-CO/homebrew-tap
brew install ironcode
```

### Direct Download

Pre-built binaries for macOS (x64/arm64), Linux (x64/arm64), and Windows are available on [GitHub Releases](https://github.com/KSD-CO/IronCode/releases).

---

## Usage

```bash
# Start in current directory
ironcode

# With a specific model
ironcode --model anthropic/claude-sonnet-4

# Custom memory limit (default: 300MB)
ironcode --max-memory 500
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="your-key-here"
# or authenticate interactively:
ironcode auth login
```

### Key Commands

| Command | Description |
|---|---|
| `/git` | Open Git source control panel |
| `/terminal` | Open built-in terminal |
| `/editor` | Open file in `$EDITOR` |
| `/review` | Open code changes panel |
| `/init` | Create `AGENTS.md` for the project |
| `Tab` | Switch between agents (build / plan) |
| `Ctrl+X I` | Git panel shortcut |
| `Ctrl+X R` | Code changes panel shortcut |

---

## Telegram Integration

Control IronCode remotely via Telegram — send tasks from your phone, get live streaming output.

```bash
# Install
bun install -g @ironcode-ai/telegram

# Configure (enter bot token from @BotFather)
ironcode-telegram setup

# Run from your project directory
cd your-project
ironcode-telegram
```

**Bot commands:**

| Command | Description |
|---|---|
| `/new` | Start a new session |
| `/sessions` | List sessions with inline switch buttons |
| `/info` | Current session details and file change stats |
| `/init` | Analyze project and create `AGENTS.md` |
| `/diff` | Show all file changes in the current session |
| _(any message)_ | Send a prompt — streams the response live |

See [`packages/telegram/README.md`](./packages/telegram/README.md) for full setup docs including PM2/systemd server deployment.

---

## Agents

Switch between agents with the `Tab` key:

- **build** — Full-access agent for development (default)
- **plan** — Read-only agent for analysis and code exploration

---

## Development

**Requirements:** Bun 1.3.8, Rust (stable), Git

```bash
git clone https://github.com/KSD-CO/IronCode.git
cd IronCode
bun install

# Build native Rust components
cd packages/ironcode/native/tool && cargo build --release && cd ../../../..

# Run in development mode
bun dev
```

---

## Architecture

- **CLI/TUI**: TypeScript + Bun
- **Native Performance Layer**: Rust via FFI — PTY, edit, grep, glob, git, archive, bash parser, BM25 search, wildcard matching, RETE command prefix, system stats
- **Telegram Bot**: `@ironcode-ai/telegram` — grammy + `@ironcode-ai/sdk`

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas to help with: performance optimizations, bug fixes, documentation, new plugins, additional Rust components.

---

## Acknowledgments

- **IronCode Team** — original open-source AI coding agent
- All contributors to this fork
