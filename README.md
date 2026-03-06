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

## What's New

### v1.17.6 — AI SDK v6 ModelRef Migration

**Completed ModelRef migration as part of AI SDK v6 upgrade:**

- **Schema migration** — Migrated model references from object format `{ providerID: string, modelID: string }` to string-based `ModelRef` format (`"provider:model"`) throughout the codebase
- **Parser/formatter utilities** — All code now uses `ProviderRegistry.parse(modelRef)` to extract components and `ProviderRegistry.format(providerID, modelID)` to create ModelRef strings
- **Runtime compatibility** — Added `ensureModelRef()` helper to handle legacy object formats gracefully during transition
- **Bug fixes** — Fixed `ProviderModelNotFoundError` with undefined values caused by incomplete migration; fixed `Provider.defaultModel()` to return strings consistently

**Technical details:**

- Updated schemas in `message-v2.ts`: User, Assistant, and SubtaskPart now use `model: z.string()` instead of separate modelID/providerID fields
- Migrated 24 files including session handling, compaction, summary, task/plan tools, telegram bot, and SDK types
- Zero breaking changes for end users

### v1.17.5 — Voice Message Support

- **Voice messages** — Send voice messages to the Telegram bot; audio is automatically transcribed via Groq Whisper and forwarded to the agent
- **BM25 improvements** — Updated `STOP_WORDS` to retain method-prefix tokens (`get`/`set`/`is`/`has`/`new`) for more accurate code search

### v1.17.3 — Rust Rule Engine Migration

- **Permission Rule Engine** — `PermissionNext.evaluate()` and `disabled()` migrated to Rust; entire ruleset batched into a single FFI call instead of N JS roundtrips
- **File Ignore Matching** — `FileIgnore.match()` migrated to Rust using `globset` compiled regex, faster than per-call `Bun.Glob` allocation
- **Dead code removed** — `permission/arity.ts` (BashArity) removed, replaced by `extractPrefixFFI` (Rust)

### v1.17.2 — Telegram Enhancement

- **`/init` command** — Analyze a project and generate `AGENTS.md` directly from the Telegram bot
- **Code diff streaming** — `/diff` shows all changed files in the current session
- **Session management UI** — `/sessions` with inline switch buttons

### v1.17.0 — AI SDK v6

- Upgraded to AI SDK v6 with full support for new providers
- Improved terminal UX

---

## What is IronCode?

IronCode is a **high-performance CLI AI coding agent** — a fork of [OpenCode](https://github.com/anomalyco/opencode) that runs entirely on your machine. It rewrites performance-critical components in Rust for dramatically improved speed and memory efficiency.

### Key Features

- ⌨️ **CLI-First** — Powerful terminal UI optimized for keyboard-driven workflows
- 🔀 **Multi-Account Round-Robin** — Connect multiple API keys per provider for automatic load balancing
- 🎯 **Git Source Control** — Stage, commit, diff, push without leaving the TUI
- 🔍 **Code Changes Panel** — Diff viewer with inline comments and hunk revert
- 🔎 **Local Code Search** — BM25 + tree-sitter semantic search, offline, zero latency
- 📱 **Telegram Integration** — Control IronCode remotely from your phone, including voice messages
- 🎤 **Voice Input** — Send voice messages via Telegram; transcribed automatically via Groq Whisper
- 💻 **Built-in Terminal** — Fish-style autosuggest, tab completion, syntax highlighting
- 📝 **External Editor** — Opens `$EDITOR`/nvim with auto-install if missing
- 🏠 **100% Local** — No cloud services, works completely offline
- ⚡ **Blazing Fast** — Native Rust for all performance-critical operations

### Performance (Native Rust Components)

| Operation             | Speedup                            | Notes                                                      |
| --------------------- | ---------------------------------- | ---------------------------------------------------------- |
| PTY/Terminal          | **15x faster**                     | Zero-copy ring buffer                                      |
| Edit Tool             | **2–6x faster**                    | 9 smart replacement strategies                             |
| Bash Parser           | **50–100x faster**                 | Native tree-sitter vs WASM                                 |
| Archive extraction    | **3–5x faster**                    | s-zip streaming reader                                     |
| Grep search           | **90–99% less memory**             | Streams GB-sized files                                     |
| File read             | **1.5x faster, 99.7% less memory** | 64KB buffer + pre-allocation                               |
| Git operations        | **1.8x faster**                    | libgit2, no process spawning                               |
| Permission evaluation | **N× fewer FFI calls**             | Entire ruleset in 1 native call vs N roundtrips            |
| File ignore matching  | **Faster glob matching**           | Compiled `globset` regex vs per-call `Bun.Glob` allocation |

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

| Command     | Description                            |
| ----------- | -------------------------------------- |
| `/git`      | Open Git source control panel          |
| `/terminal` | Open built-in terminal                 |
| `/editor`   | Open file in `$EDITOR`                 |
| `/review`   | Open code changes panel                |
| `/init`     | Create `AGENTS.md` for the project     |
| `Tab`       | Switch between agents (build / plan)   |
| `Ctrl+T`    | Cycle model variants (low/medium/high) |
| `Ctrl+X I`  | Git panel shortcut                     |
| `Ctrl+X R`  | Code changes panel shortcut            |

### Model Variants & Thinking

IronCode supports **model variants** that control the quality/speed tradeoff:

- **low** — Faster responses, lower cost, suitable for simple tasks
- **medium** — Balanced performance and quality
- **high** — Best quality, includes extended thinking/reasoning output (default)
- **thinking** — Extended reasoning mode for complex problems

Press **`Ctrl+T`** to cycle between available variants. The status bar shows the current variant with indicators:

- `high 🧠` — High quality with thinking enabled
- `thinking 🧠` — Thinking variant with extended reasoning
- `medium` — Medium quality
- `low` — Low cost, faster responses

**Thinking mode** shows the model's internal reasoning process before generating the final response, helping with complex problem-solving and understanding the model's decision-making process.

---

## Telegram Integration

Control IronCode remotely via Telegram — send tasks from your phone, get live streaming output.

```bash
# Install
bun install -g @ironcode-ai/telegram

# Configure
ironcode-telegram setup
# Enter: Bot Token (from @BotFather), model, and optionally a Groq API key for voice support

# Run from your project directory
cd your-project
ironcode-telegram
```

**Bot commands:**

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `/new`            | Start a new session                               |
| `/sessions`       | List sessions with inline switch buttons          |
| `/info`           | Current session details and file change stats     |
| `/init`           | Analyze project and create `AGENTS.md`            |
| `/diff`           | Show all file changes in the current session      |
| _(text message)_  | Send a prompt — streams the response live         |
| _(voice message)_ | Transcribed via Groq Whisper and sent as a prompt |

### Voice Message Setup

To enable voice input, add a [Groq API key](https://console.groq.com) (free tier: 28,800 seconds/day) during setup:

```bash
ironcode-telegram setup
# Groq API Key (for voice transcription, optional): gsk_...
```

Once configured, send any voice message to the bot — it will transcribe the audio and process it as a text prompt automatically.

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
- **Native Performance Layer**: Rust via FFI — PTY, edit, grep, glob, git, archive, bash parser, BM25 search, wildcard matching, RETE command prefix, permission rule engine, file ignore matching, system stats
- **Telegram Bot**: `@ironcode-ai/telegram` — grammy + `@ironcode-ai/sdk` + Groq Whisper for voice transcription

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas to help with: performance optimizations, bug fixes, documentation, new plugins, additional Rust components.

---

## Acknowledgments

- **IronCode Team** — original open-source AI coding agent
- All contributors to this fork
