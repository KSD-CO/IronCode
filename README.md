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

## 🎉 What's New

### Mar 2, 2026 - Fix TUI crash when MCP servers are configured

Fixed a fatal crash (`TextNodeRenderable only accepts strings...`) that occurred ~5–10 seconds after startup whenever MCP servers were defined in `~/.config/ironcode/ironcode.json`.

- **Root cause 1** (`prompt/index.tsx`): `{props.hint}` was placed inside a `<text>` node. The MCP hint in `home.tsx` renders a `<box>`, which is not a valid child of `TextNodeRenderable`. When MCP status loaded after bootstrap, the reactive update tried to insert a `BoxRenderable` into a `TextNodeRenderable`, crashing the TUI.
- **Root cause 2** (`dialog-select.tsx`): The `footer` prop was always wrapped in `<text>`, but `DialogMcp` passes a JSX element (`<Status>` component) as footer — also not text-compatible.

**Fix:** Moved `{props.hint}` outside the `<text>` tag in prompt; added type-branching for footer rendering in dialog-select.

### Mar 1, 2026 - Telegram Integration

**Control IronCode remotely from your phone via Telegram:**

- **`@ironcode-ai/telegram`** — new standalone package; install globally and run from any project directory
- **Live streaming output** — agent responses stream in real time to your Telegram chat (throttled edits every 1.2s)
- **Session management** — each conversation is a separate IronCode session; switch between sessions with inline keyboard buttons
- **One-command setup** — `ironcode-telegram setup` walks you through token + allowed-user config, saved to `~/.config/ironcode/telegram.json`
- **Server deployment** — run 24/7 on a VPS with PM2 or systemd; send tasks from your phone while the server does the work

**Setup:**
```bash
npm install -g @ironcode-ai/telegram

ironcode-telegram setup
# → Enter your Telegram bot token (from @BotFather)
# → Enter your Telegram user ID (from @userinfobot)

cd your-project
ironcode-telegram        # starts the bot, connects to IronCode
```

**Bot commands:**
| Command | Description |
|---------|-------------|
| `/start` | Start a new IronCode session |
| `/sessions` | List and switch between active sessions |
| `/clear` | Clear current session history |
| `/stop` | Stop current session |
| _(any message)_ | Send task to IronCode, stream the response |

### Feb 26, 2026 - Multi-Account Providers & Round-Robin Load Balancing

**Connect multiple API keys per provider and distribute load automatically:**

- **Any provider supported** — Anthropic, OpenAI, Google, GitHub Copilot, MiniMax, Qwen, and any other API-key provider
- **Automatic round-robin** — every message rotates to the next account; no configuration needed
- **Preserves your model choice** — only the account rotates, the model you selected stays the same
- **Per-message indicator** — message header shows which account was used: `Build · claude-sonnet-4 · Anthropic (Account 2) · 1.2s`
- **TUI add/replace flow** — clicking a connected provider shows "Add another account" or "Replace existing"; once 2+ accounts exist, the dialog shows individual rows per account
- **CLI support** — `ironcode auth login` prompts "Add another account" or "Replace existing" when credentials already exist

**Setup:**
```bash
# First account (normal flow)
ironcode auth login → Select "Anthropic" → Enter API key

# Second account
ironcode auth login → Select "Anthropic" → "Add another account" → Enter key
# Saved as "anthropic-2" in auth.json — auto-discovered at startup, no config needed
```

### Feb 26, 2026 - Native Bash Permissions Layer

**Shell permission checks are now fully native — faster and more accurate:**

- **Wildcard matching** — Ported from JS to native Rust (`rexile`). Handles `*`/`?` glob patterns including the tricky `"ls *"` form that matches both `"ls"` and `"ls -la"`. Zero JS overhead on every permission check.

- **Bash command parser** — `shell.rs` replaces the old WASM tree-sitter path with a native tree-sitter-bash parser. Extracts filesystem arguments, full command patterns, and `always`-allow prefixes (`"npm run *"`) used by the permission system. **50-100x faster** than WASM.

- **Smart command prefix (RETE rule engine)** — 137 GRL rules loaded into a RETE `IncrementalEngine` classify every command to its correct prefix length. `npm run dev` → `"npm run *"`, `docker compose up` → `"docker compose *"`, `git config --global` → `"git config *"`. Longest-match always wins regardless of rule firing order.

### Feb 23, 2026 - Local Code Search (BM25 + tree-sitter)

**Offline semantic code search — no embeddings, no ML model download required:**

- **`search_codebase` tool** - New AI tool that finds functions, classes, and symbols by concept rather than exact text
  - BM25 full-text ranking (same algorithm used by Elasticsearch/Lucene)
  - tree-sitter AST parsing — extracts named symbols (functions, classes, interfaces, enums, methods, etc.) per language
  - Understands camelCase/snake_case: `getUserById` → tokens `[get, user, by, id]`
  - Auto-indexes on first use, incremental updates via file watcher
  - ~400ms initial indexing, <1ms search on indexed data
  - Zero binary size overhead (no ML model bundled)

- **Languages supported:** TypeScript, JavaScript, Python, Rust, Go, Java, C#

- **AI behavior improved:** Model now prefers `search_codebase` for conceptual queries and reserves grep for exact text matching — no more `\b(auth|login|token|...)\b` mega-patterns

- **Grep tool guidance updated:** Explicit instruction to use `search_codebase` instead of complex OR-patterns

**Performance (tested on IronCode src, ~1638 symbols):**

| Metric             | Value                         |
| ------------------ | ----------------------------- |
| Initial index time | ~450ms                        |
| Search time        | <1ms                          |
| Memory overhead    | ~0 (BM25 inverted index only) |
| Binary size added  | 0 MB (no ML model)            |

### Feb 18, 2026 - Editor & Terminal Improvements

**External editor with auto-install + redesigned built-in terminal:**

- **`/editor` - External Editor Integration**
  - Opens `$VISUAL` or `$EDITOR` or `nvim` by default
  - Auto-detects if editor is installed via `which`
  - Shows install popup if Neovim not found (cross-platform: brew, apt, dnf, pacman, apk, winget, choco, scoop)
  - One-click install button directly from the popup

- **`/terminal` - Redesigned Built-in Terminal**
  - Clean terminal-like UI with no header/footer chrome
  - Prompt at bottom with `~/path $ ` prefix (like real shell)
  - Block cursor with left/right movement
  - Streaming output (stdout/stderr appear in real-time)
  - Syntax highlighting for file output (`cat file.ts`, `head file.py`, etc.)
  - Fish-style history autosuggest (dim text, accept with Right/End)
  - Tab completion for file/directory paths (single match auto-completes, multiple shows common prefix + options)
  - Shell keybindings: Ctrl+A/E (home/end), Ctrl+U/K (clear line), Ctrl+W (delete word), Ctrl+L (clear screen)
  - `cd` with directory validation, `clear`, `exit` commands
  - Color-coded output: commands (primary+bold), errors (red), info (dim)

### Feb 15, 2026 - Code Changes Panel

**Code changes viewer with inline comments and hunk revert:**

- 🔍 **Code Changes Panel** - View git diffs in a side panel without leaving your session. Open via command palette or `<leader>r` keybind
- ↩️ **Revert Diff Hunk** - Press `r` to revert individual diff hunks. Supports both uncommitted and staged changes
- 💬 **Inline Comments** - Press `c` to add comments on specific diff lines. Navigate with `n/p`, dismiss with `d`, send to chat with `f`
- 🔄 **Mode Cycling** - Press `m` to cycle between Uncommitted, Staged, and vs-Main diff views
- 📊 **Change Counts in Hint Bar** - The prompt hint bar now shows `<leader>r changes +N -N` with live addition/deletion counts
- 🤖 **Auto-open on `/review`** - The code changes panel automatically opens alongside when the `/review` command runs as a subtask
- 🎨 **Hunk Highlighting** - The current hunk is subtly highlighted in the diff view for easy identification

**Keybinds:**

- `j/k`: Navigate files
- `↑↓`: Navigate diff lines
- `r`: Revert current hunk
- `c`: Add comment on current line
- `n/p`: Navigate between comments
- `d`: Dismiss selected comment
- `f`: Send comment to chat
- `m`: Cycle mode (uncommitted/staged/vs-main)
- `g`: Refresh diffs
- `Esc`: Close panel

### Feb 15, 2026 - AI SDK v6 Integration

**Leveraging new AI SDK v6 features for better debugging and token efficiency:**

- 🔧 **DevTools Middleware** - Full debugging visibility for LLM calls via `@ai-sdk/devtools`. Enable with `"experimental": { "devtools": true }` in config, then run `npx @ai-sdk/devtools` to launch viewer at `localhost:4983`. Inspect input/output, token usage, timing, and raw provider data.
- 💰 **`toModelOutput` Optimization** - Tool results now send only the essential `output` text back to the model, stripping `title`, `metadata`, and `attachments` (including base64-encoded images). Reduces token usage on every tool call, especially impactful for large file reads and MCP tools.
- 🔌 **Provider-Specific Tools** - Native server-side tools from AI providers (lazy-loaded, zero memory overhead when unused). Enable via `"experimental": { "provider_tools": ["anthropic:web_search", "openai:*"] }`. Available tools:
  - **Anthropic**: `web_search`, `web_fetch`, `code_execution`
  - **OpenAI**: `web_search`, `code_interpreter`, `image_generation`
  - **Google**: `google_search`, `code_execution`, `url_context`
  - **xAI**: `web_search`, `x_search`, `code_execution`
  - **GitHub Copilot**: `web_search`, `local_shell`, `code_interpreter`, `file_search`, `image_generation`

### Feb 15, 2026 - Memory Optimizations

**TypeScript:**

- 🚀 **Lazy Provider SDK Loading** - Provider SDKs (`@ai-sdk/anthropic`, `@ai-sdk/openai`, etc.) are now dynamically imported only when their tools are requested, saving ~20-100MB of unused memory.
- 📦 **Streaming Message Processing** - Compaction pruning now streams messages instead of loading entire session history into memory. Combined with O(n) `filterCompacted()` (replacing O(n²) `unshift`), long sessions use significantly less peak RAM.

**Rust Native:**

- 🔧 **edit.rs** - Split content lines once and share across all 9 replacer strategies (was splitting 7x redundantly). `normalize_whitespace` builds string directly without intermediate Vec.
- 📂 **archive.rs** - Iterate ZIP entries by index instead of cloning all entry names upfront.
- 🔍 **grep.rs** - Pre-allocate match buffer with `Vec::with_capacity(128)`. Avoid intermediate clone in line truncation formatting.
- 🗂️ **glob.rs** - Partial sort with `select_nth_unstable_by` for top-N results instead of full sort on entire file list.
- 📖 **read.rs** - Build output string directly instead of collecting into intermediate formatted Vec then joining.
- 🌐 **webfetch.rs** - Stream-join text nodes without intermediate Vec allocation.

### Feb 12, 2026 - Git Source Control UI

**Built-in Git UI for seamless version control within TUI:**

- 🎯 **Full Git Integration** - Stage, commit, push without leaving IronCode
- 📊 **Visual Status View** - See staged/unstaged changes with color-coded icons
- 🌿 **Branch Management** - Quick checkout between branches
- 📝 **Inline Commit** - Type commit messages directly in TUI
- 🔍 **Syntax-Highlighted Diffs** - Review changes with color-coded diffs
- ⚡ **Multi-Auth Push** - Supports SSH keys, SSH agent, and HTTPS with credential helper
- 🎨 **Intuitive UI** - Keyboard shortcuts (p: push, a: stage all, Space: stage/unstage)

**Open Git panel with `Ctrl+X` then `I` or `/git` command**

### Feb 10, 2026 - Streaming Optimizations

**Massive performance and memory improvements through streaming patterns:**

#### File Read Optimization

- ⚡ **1.17-1.56x faster** across all file sizes
- 💾 **99.7% memory savings** on large files (39MB → 0.13MB for 100K lines)
- 📖 64KB buffer with pre-allocated capacity eliminates reallocation
- ✅ **100% identical results** - zero breaking changes

#### Grep Search Optimization

- 💾 **90-99% memory reduction** when searching large files
- 🔍 Stream lines instead of loading entire files
- ⚡ Early exit after 1000 matches for efficiency
- 🎯 Can search **GB-sized files** without running out of memory
- ✅ **100% identical results** - verified with comprehensive tests

**Why streaming matters:**

- Search 100 files × 1MB each: **100MB → 10MB memory** usage
- No data loss - regex matches on full line content before display truncation
- Scales to much larger codebases on memory-constrained systems

### Previous Updates

- **Memory optimization** - 97.6% faster message processing (254ms → 6ms) - Feb 8, 2026
- **Resource monitoring** - Automatic throttling with 300MB default limit - Feb 7, 2026
- **PTY/Terminal native** - 15.29x speedup, powers Bash tool - Feb 5, 2026
- **Edit tool optimization** - 2-6x faster with 9 smart strategies - Feb 3, 2026
- **Archive extraction** - 3-5x faster with s-zip native - Feb 1, 2026

---

## What is IronCode?

IronCode is a **high-performance CLI fork** of [OpenCode](https://github.com/anomalyco/opencode) - an AI coding agent that runs entirely on your machine. This fork focuses on the command-line experience, removes cloud dependencies, and **rewrites performance-critical components in Rust** for dramatically improved speed and efficiency.

### Key Features

- ⌨️ **CLI-First**: Powerful terminal UI optimized for command-line workflows
- 🔀 **Multi-Account Round-Robin**: Connect multiple API keys per provider for automatic load balancing — Anthropic, OpenAI, Google, Copilot, and more
- 🎯 **Git Source Control**: Full Git integration - stage, commit, diff, push without leaving TUI
- 🔍 **Code Changes Panel**: Diff viewer with inline comments, hunk revert, and live change counts
- 📝 **External Editor**: Opens `$EDITOR`/nvim with auto-install popup if not found
- 💻 **Built-in Terminal**: Real terminal feel with syntax highlighting, fish-style autosuggest, and tab completion
- 🔎 **Local Code Search**: BM25 + tree-sitter semantic search across your codebase — offline, zero latency, no ML model required
- 📱 **Telegram Integration**: Control IronCode remotely via Telegram — send tasks from your phone and get live streaming output
- 🏠 **100% Local**: No cloud services, works completely offline
- 🔒 **Privacy First**: Your code never leaves your machine
- 🎯 **Lightweight**: Stripped down to core functionality - CLI only
- ⚡ **Blazing Fast**: Native Rust implementation for performance-critical operations
- 📦 **Easy Installation**: Available via npm, Homebrew, or direct download

### 🚀 Performance Improvements

IronCode delivers exceptional performance through **native Rust components** and **intelligent memory management**:

#### Memory Efficiency & Resource Monitoring

IronCode includes an **automatic resource monitoring system** that keeps memory usage under control:

- 🎯 **Default 300MB limit** - Prevents excessive memory consumption
- 📊 **Real-time monitoring** - Checks every 5 seconds with three levels (normal/warning/critical)
- 🚦 **Auto-throttling** - Automatically slows down at 95% memory to prevent crashes
- ⚡ **Optimized processing** - 98% faster message handling with selective cloning
- 🔧 **Configurable** - Adjust limits with `--max-memory` flag or disable with `--no-enable-resource-monitor`

**Memory Optimizations:**

| Optimization                     | Impact                 | Speedup                         |
| -------------------------------- | ---------------------- | ------------------------------- |
| **Selective Message Cloning**    | 4.1MB saved per step   | 97.6% faster (254ms → 6ms)      |
| **Array Operation Improvements** | Reduced GC pressure    | 7 optimizations across codebase |
| **Automatic Throttling**         | Prevents memory spikes | Active at 285MB (95% threshold) |

**Example Usage:**

```bash
# Default (300MB limit, monitoring enabled)
ironcode

# Custom memory limit
ironcode --max-memory 500

# Disable resource monitoring
ironcode --no-enable-resource-monitor

# Both options
ironcode --max-memory 400 --enable-resource-monitor
```

See [RESOURCE-MONITORING.md](./RESOURCE-MONITORING.md) for full documentation.

#### Native Rust Performance

IronCode rewrites key operations in native Rust with **measured real-world performance gains**:

| Operation                 | TypeScript/Node | Rust Native | **Speedup**        | Notes                  |
| ------------------------- | --------------- | ----------- | ------------------ | ---------------------- |
| **PTY I/O (full)**        | 58.15 ms        | 3.80 ms     | **15.29x faster**  | ✅ 93.5% reduction     |
| **PTY Create**            | ~50 ms          | 1.66 ms     | **30x faster**     | Setup session          |
| **PTY Write**             | ~1 ms           | 0.06 ms     | **16.7x faster**   | Send data              |
| **PTY Read**              | ~5 ms           | 0.03 ms     | **166x faster**    | Non-blocking I/O       |
| **PTY Close**             | ~2 ms           | 0.02 ms     | **100x faster**    | Cleanup                |
| **Edit Tool (10 lines)**  | 61.57 µs        | 30.06 µs    | **2.05x faster**   | All 9 strategies       |
| **Edit Tool (100 lines)** | 419.84 µs       | 250.86 µs   | **1.67x faster**   | Consistent performance |
| **Edit Tool (1K lines)**  | 6.17 ms         | 2.78 ms     | **2.22x faster**   | Scales well            |
| **Edit Tool (5K lines)**  | 126.06 ms       | 29.67 ms    | **4.25x faster**   | 76.5% reduction        |
| **Edit Tool (10K lines)** | 451.59 ms       | 74.88 ms    | **6.03x faster**   | 83.4% reduction        |
| **Bash Parser**           | ~1-2 ms (WASM)  | 0.020 ms    | **50-100x faster** | Native tree-sitter     |
| **File Listing**          | 15.80 ms        | 11.50 ms    | **1.37x faster**   | Native ignore crate    |
| **File Glob (100 files)** | 9.74 ms         | 3.55 ms     | **2.74x faster**   | Zero spawn overhead    |
| **Grep Search**           | 34.84 ms        | 19.35 ms    | **1.80x faster**   | Pattern: "function"    |
| **Grep (streaming)**      | N/A             | Similar     | **90-99% memory**  | Can search GB files    |
| **VCS Info (git)**        | 17.25 ms        | 9.43 ms     | **1.83x faster**   | libgit2, no spawning   |
| **Archive (small, 10)**   | 5.48 ms         | 1.93 ms     | **2.8x faster**    | s-zip vs unzip         |
| **Archive (medium, 100)** | 90.43 ms        | 18.07 ms    | **5.0x faster**    | s-zip vs unzip         |
| **Archive (large, 500)**  | 740.29 ms       | 142.88 ms   | **5.2x faster**    | s-zip vs unzip         |
| **Read (1K lines)**       | 0.06 ms         | 0.04 ms     | **1.50x faster**   | 64KB buffer + capacity |
| **Read (10K lines)**      | 0.34 ms         | 0.29 ms     | **1.17x faster**   | Pre-allocation         |
| **Read (50K lines)**      | 1.45 ms         | 0.97 ms     | **1.49x faster**   | Streaming optimized    |
| **Read (100K lines)**     | 3.71 ms         | 2.38 ms     | **1.56x faster**   | 99.7% memory savings   |
| **Read (500K lines)**     | 31.50 ms        | 21.55 ms    | **1.46x faster**   | 30MB file              |
| **Git Status**            | ~15-20 ms       | 9.43 ms     | **1.83x faster**   | libgit2, no spawn      |
| **Git Stage/Unstage**     | ~10-15 ms       | <5 ms       | **2-3x faster**    | Native operations      |
| **Git Commit**            | ~15-20 ms       | <10 ms      | **2x faster**      | Direct libgit2         |
| **Git Branch List**       | ~10 ms          | <5 ms       | **2x faster**      | No process spawn       |
| **Git Diff**              | ~20-30 ms       | ~15 ms      | **1.5x faster**    | Streaming diff         |

**Key Insights:**

- 🎯 **PTY/Terminal**: **15.29x faster** (exceeded 10x target!) - Native ring buffer, zero-copy reads
- ✅ **File Read**: **1.17-1.56x faster** with **99.7% memory savings** (39MB → 0.13MB for 100K lines) - 64KB buffer + pre-allocation
- ✅ **Grep Search**: **90-99% memory reduction** with streaming - Can search GB-sized files without OOM
- ✅ **Edit Tool**: 2-6x faster across all file sizes with all 9 smart replacement strategies
- ✅ **Bash Parser**: 50-100x faster using native tree-sitter vs WASM (0.020ms per command, no initialization overhead)
- ✅ **Glob/Grep**: 1.8-2.7x faster by eliminating process spawn overhead
- ✅ **VCS Info**: 1.83x faster using libgit2 directly (no process spawning, 45% latency reduction)
- ✅ **Archive Extraction**: 3-5x faster using s-zip vs shell commands (unzip/PowerShell)
- 📊 **Memory**: Streaming patterns use only 64KB buffer regardless of file size
- 🎯 **Lesson**: Pre-allocation + streaming + larger buffers = faster I/O with dramatically less memory

**Native Rust Components:**

- ✅ **PTY/Terminal**: Full terminal session management with 2MB ring buffer, zero-copy streaming (15.29x faster) - Powers all Bash tool operations
- ✅ **Git Source Control**: Complete Git operations via libgit2 (status, stage, commit, push, branch, diff) - 1.5-3x faster than subprocess
- ✅ **File Reading**: Streaming read with 64KB buffer and pre-allocation (1.2-1.6x faster, 99.7% memory savings)
- ✅ **Grep Search**: Streaming line-by-line search (90-99% memory reduction, scales to GB files)
- ✅ **Edit Tool**: 9 smart replacement strategies with fuzzy matching (complex compute justifies FFI)
- ✅ **File Listing**: Native ignore crate for fast directory traversal (eliminates process spawn)
- ✅ **File Search (Glob)**: Pattern matching with gitignore support (eliminates process spawn)
- ✅ **Archive Extraction**: ZIP file extraction using s-zip streaming reader (3-5x faster, cross-platform)
- ✅ **Bash Parser**: Native tree-sitter bash command parsing (50-100x faster than WASM, 0.020ms per command)
- ✅ **Directory Listing**: Fast recursive directory traversal
- ✅ **VCS Info**: Lightning-fast git repository information (libgit2 vs subprocess)
- ✅ **Code Search (BM25)**: Local semantic code search with tree-sitter symbol extraction — finds functions by concept, not just exact text
- ✅ **Wildcard Matching**: `*`/`?` glob patterns via `rexile`, including trailing `" *"` form — replaces JS impl
- ✅ **Command Prefix (RETE)**: GRL rule engine (137 rules) maps commands → arity for permission `always`-allow prefixes
- ✅ **System Stats**: CPU and memory monitoring

**Benefits:**

- 🚀 **1.2-1.6x faster** file reading with 64KB buffer and pre-allocation
- 💾 **99.7% memory savings** on large files (39MB → 0.13MB for 100K lines)
- 🔍 **90-99% memory reduction** for grep search - can search GB-sized files
- 🚀 **Up to 6x faster** text editing with 9 smart replacement strategies (Levenshtein, fuzzy matching)
- 🚀 **Up to 5x faster** archive extraction (ZIP files) with cross-platform native code
- 💚 **83% less time** on large file edits (10K lines: 451ms → 75ms)
- ⚡ **1.83x faster** git operations using libgit2 (no process spawning)
- 🎯 **2-3x faster** glob/grep by eliminating process spawn overhead
- 📊 **Optimized I/O**: Streaming patterns with single-allocation for minimal memory footprint
- 🔧 **Consistent tooling**: Native Rust across all file operations for predictable performance
- 🌐 **Cross-platform**: No external dependencies (unzip/PowerShell) for archive extraction

### What Changed from OpenCode?

**Removed:**

- ❌ Cloud infrastructure (Cloudflare Workers, R2 storage)
- ❌ Web-based deployment
- ❌ Desktop application (Tauri/GUI)
- ❌ GitHub Action integration
- ❌ Billing/subscription system
- ❌ Authentication services
- ❌ Session sharing features

**Kept:**

- ✅ Complete CLI experience
- ✅ All AI agent capabilities
- ✅ Local session management
- ✅ Plugin system
- ✅ Multiple AI model support

**Enhanced:**

- 🚀 **Native Rust performance** for compute-heavy operations (2-6x faster)
- 💾 **Streaming file reads** with 99.7% memory savings (1.2-1.6x faster)
- ⚡ **Eliminated process spawns** for glob/grep (2-3x speedup)
- 🗜️ **Fast archive extraction** with s-zip (3-5x faster, cross-platform native)
- 💚 **Faster edits** (2-6x improvement, scales with file size)
- 🔥 **Smart edit strategies** with fuzzy matching and Levenshtein similarity
- 📊 **Optimized I/O**: Streaming read with 64KB buffer and pre-allocation
- 🔧 **Consistent native tooling**: All file operations use Rust for predictable performance
- 🎯 **Memory efficiency**: Automatic resource monitoring with 300MB default limit
- 🚦 **Auto-throttling**: Prevents memory spikes and system crashes
- ⚡ **98% faster message processing**: Selective cloning optimization (254ms → 6ms)

---

## Installation

IronCode is distributed as a CLI tool available through multiple package managers:

### NPM (Recommended)

```bash
# Install globally
npm install -g ironcode-ai

# Or use with npx (no installation)
npx ironcode-ai
```

### Homebrew (macOS/Linux)

IronCode is available through a Homebrew tap. The formula automatically installs the appropriate binary for your platform.

```bash
# Add the tap
brew tap KSD-CO/tap https://github.com/KSD-CO/homebrew-tap

# Install IronCode
brew install ironcode

# Verify installation
ironcode --version

# Update to latest version
brew upgrade ironcode
```

**Supported Platforms:**

- macOS (Intel x64)
- macOS (Apple Silicon arm64)
- Linux (x64)
- Linux (arm64)

The Homebrew formula is auto-generated from releases and maintained at [github.com/KSD-CO/homebrew-tap](https://github.com/KSD-CO/homebrew-tap/blob/main/ironcode.rb).

### Direct Download (Standalone Binary)

For users who prefer not to use package managers, download the pre-built CLI binary directly from [GitHub Releases](https://github.com/KSD-CO/IronCode/releases).

These are **standalone executables** that require no additional installation - just download, extract, and run:

**Linux (x64):**

```bash
# Download and extract
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-linux-x64.tar.gz | tar xz

# Move to PATH
sudo mv ironcode /usr/local/bin/

# Verify installation
ironcode --version
```

**macOS (Apple Silicon):**

```bash
# Download and extract
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-darwin-arm64.tar.gz | tar xz

# Move to PATH
sudo mv ironcode /usr/local/bin/

# Verify installation
ironcode --version
```

**macOS (Intel):**

```bash
# Download and extract
curl -L https://github.com/KSD-CO/IronCode/releases/latest/download/ironcode-darwin-x64.tar.gz | tar xz

# Move to PATH
sudo mv ironcode /usr/local/bin/

# Verify installation
ironcode --version
```

**Windows:**

```powershell
# Download from releases page
# https://github.com/KSD-CO/IronCode/releases/latest

# Extract ironcode.exe and add to PATH
# Or run directly from download location
```

**Note for Windows users:** IronCode uses native Rust libraries for performance. The Windows build is statically linked and should work out of the box. If you encounter DLL loading errors, please [report the issue](https://github.com/KSD-CO/IronCode/issues) with the error message.

### Arch Linux (AUR)

_Coming soon - AUR package will be available in the future_

---

## Usage

### Quick Start

```bash
# Start interactive session in current directory
ironcode

# Run with custom memory limit (default: 300MB)
ironcode --max-memory 500

# Run without resource monitoring
ironcode --no-enable-resource-monitor

# Run with specific model
ironcode --model anthropic/claude-sonnet-4

# Show version
ironcode --version

# Show help
ironcode --help
```

### Configuration

IronCode requires API keys for the AI models you want to use. Set them as environment variables:

```bash
# Anthropic Claude (recommended)
export ANTHROPIC_API_KEY="your-key-here"

# OpenAI
export OPENAI_API_KEY="your-key-here"

# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.bashrc
```

### Interactive Mode

Once started, IronCode provides an interactive terminal UI:

- Type your requests naturally in English
- Switch between agents with `Tab` key
- Use `Ctrl+C` to cancel operations
- Use `Ctrl+D` or type `exit` to quit

### Git Source Control

IronCode includes a built-in Git UI accessible within the TUI:

**Open Git Panel:**

- Press `Ctrl+X` then `I` (keybinding)
- Or type `/git` or `/source-control` command

**Features:**

- **Status View** - See all file changes (staged/unstaged)
  - `↑↓` or `j/k`: Navigate files
  - `Space`: Stage/unstage selected file
  - `Enter`: View diff
  - `a`: Stage all files
  - `u`: Unstage all files
  - `r`: Refresh status
  - `p`: Push to remote
- **Branches View** - Switch between branches
  - `↑↓` or `j/k`: Navigate branches
  - `Enter`: Checkout branch
  - Current branch marked with `*`
- **Commit View** - Create commits
  - Type your commit message
  - `Enter`: Commit staged changes
  - `Esc`: Cancel
- **Diff View** - Review changes
  - Syntax-highlighted diffs (green +, red -, blue line numbers)
  - `h` or `Backspace`: Return to status view

**Push Authentication:**

IronCode supports multiple authentication methods:

- SSH keys (id_rsa, id_ed25519) from `~/.ssh/`
- SSH agent
- HTTPS with credential helper (GitHub CLI recommended)

For HTTPS authentication with GitHub:

```bash
# Install GitHub CLI if not already installed
brew install gh  # macOS
# or: sudo apt install gh  # Linux

# Authenticate
gh auth login

# Configure git to use gh for credentials
git config --global credential.helper '!gh auth git-credential'
```

### Code Changes Panel

IronCode includes a code changes viewer for reviewing diffs with inline comments:

**Open Code Changes Panel:**

- Press `<leader>r` (default: `Ctrl+X` then `R`)
- Or use command palette (`Ctrl+P`) → "View code changes"
- Auto-opens when `/review` command runs

**Features:**

- **Diff Viewer** - Color-coded diffs with hunk highlighting
  - `j/k`: Navigate between files
  - `↑↓`: Navigate diff lines
  - `m`: Cycle mode (Uncommitted → Staged → vs Main)
  - `g`: Refresh diffs
- **Revert Hunk** - Undo individual changes
  - `r`: Revert the current diff hunk (works for both uncommitted and staged)
  - Active hunk is highlighted for easy identification
- **Inline Comments** - Add notes to specific diff lines
  - `c`: Add a comment on the current line
  - `n/p`: Navigate between comments
  - `d`: Dismiss selected comment
  - `f`: Send comment to chat for AI to address
- **Change Counts** - The hint bar shows live `+N -N` counts of total additions/deletions

### Provider-Specific Tools

Enable native server-side tools from AI providers. These tools run on the provider's infrastructure (not locally), giving the model direct access to web search, code execution, and more.

**Configuration** — Add `provider_tools` to the `experimental` section in your `ironcode.json`:

```jsonc
{
  "experimental": {
    // Enable specific tools
    "provider_tools": ["anthropic:web_search"],
  },
}
```

**Format**: `"provider:tool_name"` or `"provider:*"` (wildcard for all tools).

**Examples:**

```jsonc
{
  "experimental": {
    // Single tool
    "provider_tools": ["anthropic:web_search"]

    // Multiple tools from one provider
    "provider_tools": ["anthropic:web_search", "anthropic:code_execution"]

    // All tools from a provider (wildcard)
    "provider_tools": ["openai:*"]

    // Mix providers — only matching tools activate
    "provider_tools": [
      "anthropic:web_search",
      "anthropic:web_fetch",
      "openai:web_search",
      "google:google_search",
      "xai:x_search"
    ]
  }
}
```

**Available tools by provider:**

| Provider           | Tool               | Description                             |
| ------------------ | ------------------ | --------------------------------------- |
| **Anthropic**      | `web_search`       | Search the web for current information  |
|                    | `web_fetch`        | Fetch and read web page content         |
|                    | `code_execution`   | Execute code in a sandboxed environment |
| **OpenAI**         | `web_search`       | Search the web using Bing               |
|                    | `code_interpreter` | Execute Python code with file I/O       |
|                    | `image_generation` | Generate images with DALL-E             |
| **Google**         | `google_search`    | Search with Google Search               |
|                    | `code_execution`   | Execute code server-side                |
|                    | `url_context`      | Fetch and analyze URL content           |
| **xAI**            | `web_search`       | Search the web                          |
|                    | `x_search`         | Search X (Twitter) posts                |
|                    | `code_execution`   | Execute code server-side                |
| **GitHub Copilot** | `web_search`       | Search the web via Bing                 |
|                    | `local_shell`      | Execute shell commands                  |
|                    | `code_interpreter` | Execute code in sandbox                 |
|                    | `file_search`      | Search files in vector stores           |
|                    | `image_generation` | Generate images                         |

> **Note**: Tools only activate when the current model matches the provider. For example, `anthropic:web_search` only works when using an Anthropic model (Claude). If you configure tools for multiple providers, only the relevant ones activate per session.

### Telegram Integration

Control IronCode remotely via a Telegram bot — send tasks from your phone and get real-time streaming output, just like the TUI.

**Setup:**

```bash
# 1. Install IronCode and authenticate
npm install -g ironcode-ai
ironcode auth login

# 2. Create a bot via @BotFather in Telegram, get the token

# 3. Install the Telegram package
bun install -g @ironcode-ai/telegram

# 4. Configure your bot token
ironcode-telegram setup
# Saved to ~/.config/ironcode/telegram.json

# 5. Start the bot from your project directory
cd your-project
ironcode-telegram
```

**Bot commands:**

| Command | Description |
| ------- | ----------- |
| `/start` | Welcome message and quick reference |
| `/new` | Start a new session |
| `/sessions` | List all sessions with inline buttons to switch |
| `/info` | Show current session ID and working directory |
| _(any text)_ | Send a prompt — streams output live as the agent works |

**How it works:**

- The bot spawns an IronCode server in the current directory (same as running `ironcode`)
- Responses stream in real-time as the agent generates text — messages update every ~1.2s
- Tool calls (file edits, searches, bash commands) are reported as they complete
- Sessions persist across messages; switch between them with `/sessions`

**Running on a server (24/7):**

Deploy on a VPS or cloud instance so the bot is always available:

```bash
# 1. Install on the server
npm install -g ironcode-ai
bun install -g @ironcode-ai/telegram

# 2. Authenticate with your AI provider
ironcode auth login

# 3. Clone your project
git clone your-repo /app/my-project

# 4. Setup bot token
ironcode-telegram setup

# 5. Run with PM2 (auto-restart, survives reboots)
npm install -g pm2
cd /app/my-project
pm2 start --name ironcode-telegram -- ironcode-telegram
pm2 save     # persist process list
pm2 startup  # enable auto-start on reboot
```

Or with **systemd** (Linux):

```ini
# /etc/systemd/system/ironcode-telegram.service
[Unit]
Description=IronCode Telegram Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/app/my-project
ExecStart=/usr/local/bin/ironcode-telegram
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now ironcode-telegram
```

> **Note:** `WorkingDirectory` is the project directory the bot will work with. For multiple projects, run a separate instance for each.

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

### Prerequisites

- **Bun 1.3.8** (exact version required)
- **Rust** (latest stable)
- **Git**

### Building From Source

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

# Run CLI locally (development mode)
bun dev

# Build standalone executable
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

# Format code (using prettier)
bun run format

# Resource monitoring tests
cd packages/ironcode
bun test test/resource.test.ts                    # Unit tests
bun test test/resource-monitor.test.ts            # Allocation test
bun test test/resource-integration.test.ts        # Server integration
bun --expose-gc test/clone-optimization.test.ts   # Clone comparison
bun test test/stress-test.ts                      # Light load test
bun test test/heavy-test.ts                       # Heavy file ops
bun test test/extreme-test.ts                     # Conversation simulation

# Benchmark native Rust components
cd packages/ironcode/native/tool
cargo bench

# Edit tool performance comparison (TS vs Rust)
bun ./script/bench-edit.ts

# Bash parser performance (Native Rust tree-sitter)
bun --expose-gc ./script/bench-bash-parse-simple.ts

# VCS performance comparison (TS vs Rust)
bun ./script/bench-vcs.ts

# Test edit correctness (TS vs Rust)
bun ./script/test-edit-correctness.ts

# Memory benchmarks
bun --expose-gc ./script/bench-edit-memory.ts
```

---

## Architecture

IronCode is built with:

- **CLI/TUI**: TypeScript + Bun runtime
- **Plugins**: TypeScript plugin system
- **Native Performance Layer**: Rust (via FFI) for critical operations
  - PTY/Terminal management with 15x speedup
  - Edit operations with 9 smart replacement strategies
  - Archive extraction with s-zip streaming reader
  - File I/O with zero-copy optimization
  - Pattern matching and regex search
  - Git repository information
  - Code search with BM25 + tree-sitter symbol extraction
  - System resource monitoring

### Native Rust Architecture

```
┌─────────────────────────────────────────┐
│         TypeScript Layer (Bun)          │
│  ┌─────────────────────────────────┐   │
│  │    Edit Tool / File Operations  │   │
│  └────────────┬────────────────────┘   │
│               │ FFI Bindings            │
│  ┌────────────▼────────────────────┐   │
│  │     Native Rust Library         │   │
│  │  • Edit strategies (9 types)    │   │
│  │  • Bash parser (tree-sitter)    │   │
│  │  • Archive extraction (s-zip)   │   │
│  │  • File I/O (zero-copy)         │   │
│  │  • Glob/Grep (optimized)        │   │
│  │  • Git operations (libgit2)     │   │
│  │  • BM25 + tree-sitter search    │   │
│  │  • Wildcard matching (rexile)   │   │
│  │  • Command prefix (RETE)        │   │
│  │  • System stats (sysinfo)       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Performance Characteristics:**

- **Levenshtein Distance**: O(n×m) optimized with 2-row matrix (memory efficient)
- **Block Anchor Matching**: Similarity-based with configurable thresholds
- **Whitespace Normalization**: Smart indentation-preserving replacements
- **Context-Aware Matching**: Multi-line block matching with fuzzy tolerance
- **Memory Allocation**: Minimal heap usage, prefer stack allocation
- **Concurrency**: Ready for parallel processing (currently single-threaded)

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting pull requests.

**Areas we're looking for help:**

- Performance optimizations (more Rust rewrites!)
- Bug fixes and testing
- Documentation improvements
- New plugin development
- Benchmark improvements
- Additional native Rust components

**Recent Contributions:**

- ✅ **Telegram Integration** (`@ironcode-ai/telegram` — remote control via bot with live streaming output - Mar 2026)
- ✅ **Multi-Account Providers + Round-Robin** (Anthropic, OpenAI, Google, Copilot, any API-key provider - Feb 2026)
- ✅ **Native Wildcard + Bash Parser + Command Prefix (RETE)** (wildcard matching, tree-sitter bash, RETE rule engine - Feb 2026)
- ✅ **Local Code Search** (BM25 + tree-sitter semantic search, 7 languages, offline - Feb 2026)
- ✅ **Editor & Terminal** (External editor with auto-install + redesigned terminal with autosuggest - Feb 2026)
- ✅ **Code Changes Panel** (Diff viewer with hunk revert & inline comments - Feb 2026)
- ✅ **Git Source Control UI** (Full TUI integration with libgit2 - Feb 2026)
- ✅ **Streaming read optimization** (1.2-1.6x faster, 99.7% memory savings - Feb 2026)
- ✅ **Grep streaming optimization** (90-99% memory reduction, GB-file capability - Feb 2026)
- ✅ **Memory optimization deployed to production** (97.6% faster message processing - Feb 2026)
- ✅ **Resource monitoring system** (automatic throttling, 300MB default limit - Feb 2026)
- ✅ **Native PTY/Terminal deployed to production** (15.29x speedup, powers Bash tool - Feb 2026)
- ✅ Native Rust edit tool with 9 strategies (3-4x speedup)
- ✅ File Watcher Rust infrastructure (ready but not integrated - @parcel/watcher already native)
- ✅ Comprehensive benchmarking suite
- ✅ Memory profiling and optimization
- ✅ Correctness testing framework (32 test cases)

---

## Performance Testing

We maintain rigorous performance testing to ensure all optimizations deliver real-world benefits:

### Correctness Tests

```bash
# Run all correctness tests (TS vs Rust comparison)
bun ./script/test-edit-correctness.ts    # 18 unit tests
bun ./script/test-edit-real-files.ts     # 4 real file tests
bun ./script/test-edit-stress.ts         # 10 stress tests
bun ./script/test-integration.ts         # Integration tests
```

**Test Coverage:**

- ✅ 32/32 tests passing (100% correctness)
- ✅ All 9 replacer strategies validated
- ✅ Edge cases: Unicode, regex chars, large files, mixed encodings
- ✅ Real-world file testing on actual codebase

### Performance Benchmarks

```bash
# PTY/Terminal benchmark (15.29x speedup)
bun script/bench-pty.ts

# File read benchmark (1.2-1.6x speedup, 99.7% memory savings)
# See STREAMING-READ-OPTIMIZATION.md for details

# Rust micro-benchmarks
cd packages/ironcode/native/tool
cargo bench --bench edit_bench

# VCS operations benchmark (git spawning vs libgit2)
bun ./script/bench-vcs.ts

# Memory benchmarks (with GC profiling)
bun --expose-gc ./script/bench-edit-memory.ts

# Rust memory profile
cd packages/ironcode/native/tool
cargo run --release --bin memory_bench
```

**Edit Tool Benchmark Results:**

| Metric           | TypeScript     | Rust          | Improvement   |
| ---------------- | -------------- | ------------- | ------------- |
| **10 lines**     | 103 µs         | 73 µs         | 1.4x faster   |
| **100 lines**    | 1.32 ms        | 1.09 ms       | 1.2x faster   |
| **1000 lines**   | 16.9 ms        | 7.7 ms        | 2.2x faster   |
| **5000 lines**   | 205 ms         | 65 ms         | 3.1x faster   |
| **10000 lines**  | 758 ms         | 171 ms        | 4.4x faster   |
| **Memory (1K)**  | 2.42 MB alloc  | 0.17 MB alloc | 93% reduction |
| **Memory (10K)** | 31.05 MB alloc | 1.91 MB alloc | 94% reduction |

**VCS Operations Benchmark Results:**

| Metric              | Git Spawning (Old) | Native FFI (New) | Improvement     |
| ------------------- | ------------------ | ---------------- | --------------- |
| **Average latency** | 17.25 ms           | 9.43 ms          | 1.83x faster    |
| **Min latency**     | 7.40 ms            | 8.05 ms          | Consistent      |
| **Max latency**     | 24.97 ms           | 18.63 ms         | 26% better      |
| **p50 (median)**    | 17.71 ms           | 9.06 ms          | 1.95x faster    |
| **p90**             | 21.31 ms           | 10.10 ms         | 2.11x faster    |
| **p95**             | 22.58 ms           | 12.34 ms         | 1.83x faster    |
| **p99**             | 24.36 ms           | 17.71 ms         | 1.38x faster    |
| **Time saved**      | -                  | 7.82 ms/call     | 45.3% reduction |

_Benchmarked on IronCode repository (dev branch, 100 iterations)_

---

## Acknowledgments

- **IronCode Team**: For creating the original open-source AI coding agent
- All contributors to this fork
