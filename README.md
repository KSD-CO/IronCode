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
- 🎯 **Git Source Control**: Full Git integration - stage, commit, diff, push without leaving TUI
- 🔍 **Code Changes Panel**: Diff viewer with inline comments, hunk revert, and live change counts
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
