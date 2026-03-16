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
- 💬 **Chat Integrations** — Control IronCode from Telegram, Discord, or Slack
- 💻 **Built-in Terminal** — Fish-style autosuggest, tab completion, syntax highlighting
- 📝 **External Editor** — Opens `$EDITOR`/nvim with auto-install if missing
- 🧩 **Built-in Skills** — Opinionated slash commands for product review, engineering, QA, and shipping
- 🏠 **100% Local** — No cloud services, works completely offline
- ⚡ **Blazing Fast** — Native Rust for all performance-critical operations

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

### Model Variants

Press **`Ctrl+T`** to cycle between variants:

| Variant | Description |
|---------|-------------|
| `low` | Faster responses, lower cost |
| `medium` | Balanced performance and quality |
| `high 🧠` | Best quality with thinking enabled (default) |
| `thinking 🧠` | Extended reasoning for complex problems |

---

## Skills

IronCode ships with **built-in skill workflows** — opinionated slash commands that switch the agent into a specialist mode. Instead of one generic assistant, you get: founder, tech lead, paranoid reviewer, release engineer, QA tester.

| Skill | Mode | What it does |
|-------|------|-------------|
| `/ceo-review` | Founder | Rethink the problem. Find the 10-star product hiding inside the request. |
| `/eng-review` | Tech lead | Lock in architecture, data flow, failure modes, edge cases, and test matrix. |
| `/code-review` | Staff engineer | Find bugs that pass CI but blow up in production. |
| `/code-ship` | Release engineer | Format, typecheck, test, push, and open PR against `dev`. |
| `/qa-browse` | QA engineer | Playwright browser automation — navigate, screenshot, test forms, check console. |

### Workflow

```
/ceo-review  →  /eng-review  →  (code)  →  /code-review  →  /code-ship  →  /qa-browse
  product        architecture     build      find bugs        land it        verify it
```

### Example

```
You:      I want to add voice message transcription.
          /ceo-review

IronCode: "Voice transcription" is not the feature. The real job is
          letting users code from anywhere — even when they can't type.

          A) SCOPE EXPANSION — voice commands, image upload, voice-to-diff
          B) HOLD SCOPE — transcription only, production-ready
          C) SCOPE REDUCTION — bare minimum Whisper API call

You:      B

You:      /eng-review
IronCode: [Architecture diagram, data flow, failure modes, test matrix]

You:      (implement the plan)
You:      /code-review
IronCode: Missing .catch() on Whisper API — unhandled rejection will crash the bot.

You:      (fix it)
You:      /code-ship
IronCode: ✅ Format → typecheck → test → push → PR created

You:      /qa-browse http://localhost:3000
IronCode: [Screenshots, console check, form test] All pages load. Voice flow works.
```

### Custom Skills

Create `.ironcode/skill/<name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: What this skill does and when to use it.
---

# Instructions for the agent

Your prompt content here...
```

Skills are automatically discovered — no restart needed.

### Built-in Skill Auto-Install

Built-in skills are embedded in the IronCode binary. On first run, they are extracted to `~/.ironcode/skill/`. If you customize a built-in skill (remove the `.builtin` marker), your version is preserved across upgrades.

---

## Agents

Switch between agents with `Tab`:

| Agent | Access | Use for |
|-------|--------|---------|
| **build** | Full read/write | Development, implementation (default) |
| **plan** | Read-only | Analysis, code exploration, planning |

---

## Chat Integrations

Control IronCode from your favorite messaging app — send tasks from your phone, upload files, and get live streaming responses.

### Telegram

```bash
bun install -g @ironcode-ai/telegram
ironcode-telegram setup
cd your-project && ironcode-telegram
```

📸 Image upload · 📄 Document upload (20MB) · 🎤 Voice transcription · ⚡ Streaming · `/new` `/sessions` `/info` `/init` `/diff`

→ [`packages/telegram/README.md`](./packages/telegram/README.md)

### Discord

```bash
bun install -g @ironcode-ai/discord
ironcode-discord setup
cd your-project && ironcode-discord
```

⚡ Slash commands · 📸 File upload (25MB) · 🎤 Voice transcription · ✨ Rich embeds · 👍 Reactions

→ [`packages/discord/README.md`](./packages/discord/README.md)

### Slack

```bash
cd packages/slack && bun dev
```

💬 Threaded conversations · ⚡ Real-time tool notifications · 🤖 Socket mode

→ [`packages/slack/README.md`](./packages/slack/README.md)

---

## Performance

Native Rust components via FFI:

| Operation             | Speedup                            | Notes                                          |
| --------------------- | ---------------------------------- | ---------------------------------------------- |
| PTY/Terminal          | **15x faster**                     | Zero-copy ring buffer                          |
| Edit Tool             | **2–6x faster**                    | 9 smart replacement strategies                 |
| Bash Parser           | **50–100x faster**                 | Native tree-sitter vs WASM                     |
| Archive extraction    | **3–5x faster**                    | s-zip streaming reader                         |
| Grep search           | **90–99% less memory**             | Streams GB-sized files                         |
| File read             | **1.5x faster, 99.7% less memory** | 64KB buffer + pre-allocation                  |
| Git operations        | **1.8x faster**                    | libgit2, no process spawning                   |
| Permission evaluation | **N× fewer FFI calls**             | Entire ruleset in 1 native call                |
| File ignore matching  | **Faster glob matching**           | Compiled `globset` regex                       |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                 IronCode CLI                  │
│              TypeScript + Bun                 │
├──────────────────────────────────────────────┤
│  TUI  │  Agents  │  Skills  │  Integrations  │
│       │ build/   │ ceo/eng/ │  Telegram/     │
│       │ plan     │ review/  │  Discord/Slack │
│       │          │ ship/qa  │                │
├──────────────────────────────────────────────┤
│           Native Performance Layer            │
│                Rust via FFI                    │
│  PTY · Edit · Grep · Git · Bash · BM25 ·     │
│  Archive · Permission · Glob · Stats          │
└──────────────────────────────────────────────┘
```

| Layer | Tech | Packages |
|-------|------|----------|
| CLI/TUI | TypeScript + Bun | `packages/ironcode` |
| Native | Rust FFI | `packages/ironcode/native/tool` |
| Telegram | grammy + SDK + Groq Whisper | `@ironcode-ai/telegram` |
| Discord | discord.js + SDK | `@ironcode-ai/discord` |
| Slack | Bolt + SDK | `@ironcode-ai/slack` |

---

## Development

**Requirements:** Bun 1.3.8+, Rust (stable), Git

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

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas to help with: performance optimizations, bug fixes, documentation, new plugins, additional Rust components, new skills.

---

## Changelog

<details>
<summary><strong>v1.18.0</strong> — Chat Integrations Upgrade</summary>

- **Discord Bot** — Full-featured Discord integration with slash commands, rich embeds, file upload (25MB)
- **Telegram Enhancement** — Image upload, document upload, media groups, voice transcription via Groq Whisper
- **Packages:** `@ironcode-ai/telegram`, `@ironcode-ai/discord`, `@ironcode-ai/slack`

</details>

<details>
<summary><strong>v1.17.6</strong> — AI SDK v6 ModelRef Migration</summary>

- Migrated model references from object format to string-based `ModelRef` format (`"provider:model"`)
- Updated 24 files including session handling, compaction, summary, task/plan tools
- Zero breaking changes for end users

</details>

<details>
<summary><strong>v1.17.5</strong> — Voice Message Support</summary>

- Voice messages in Telegram bot — auto-transcribed via Groq Whisper
- BM25 improvements — retain method-prefix tokens for more accurate code search

</details>

<details>
<summary><strong>v1.17.3</strong> — Rust Rule Engine Migration</summary>

- Permission rule engine migrated to Rust — entire ruleset in 1 FFI call
- File ignore matching migrated to Rust using `globset` compiled regex
- Removed dead code (`permission/arity.ts`)

</details>

<details>
<summary><strong>v1.17.2</strong> — Telegram Enhancement</summary>

- `/init` command — generate `AGENTS.md` from Telegram
- `/diff` — stream changed files
- `/sessions` — inline switch buttons

</details>

<details>
<summary><strong>v1.17.0</strong> — AI SDK v6</summary>

- Upgraded to AI SDK v6 with full support for new providers
- Improved terminal UX

</details>
