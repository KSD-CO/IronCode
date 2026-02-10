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
  <a href="https://github.com/anomalyco/opencode"><img alt="Upstream" src="https://img.shields.io/badge/upstream-opencode-blue?style=flat-square" /></a>
  <a href="https://github.com/KSD-CO/IronCode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/KSD-CO/IronCode/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://www.npmjs.com/package/ironcode-ai"><img alt="npm version" src="https://img.shields.io/npm/v/ironcode-ai?style=flat-square" /></a>
</p>

---

## What is IronCode?

IronCode is a **high-performance CLI fork** of [OpenCode](https://github.com/anomalyco/opencode) - an AI coding agent that runs entirely on your machine. This fork focuses on the command-line experience, removes cloud dependencies, and **rewrites performance-critical components in Rust** for dramatically improved speed and efficiency.

### Key Features

- ⌨️ **CLI-First**: Powerful terminal UI optimized for command-line workflows
- 🏠 **100% Local**: No cloud services, works completely offline
- 🔒 **Privacy First**: Your code never leaves your machine
- 🎯 **Lightweight**: Stripped down to core functionality - CLI only
- ⚡ **Blazing Fast**: Native Rust implementation for performance-critical operations
- 📦 **Easy Installation**: Available via npm, Homebrew, or direct download

### 🚀 Performance Improvements

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
| **VCS Info (git)**        | 17.25 ms        | 9.43 ms     | **1.83x faster**   | libgit2, no spawning   |
| **Archive (small, 10)**   | 5.48 ms         | 1.93 ms     | **2.8x faster**    | s-zip vs unzip         |
| **Archive (medium, 100)** | 90.43 ms        | 18.07 ms    | **5.0x faster**    | s-zip vs unzip         |
| **Archive (large, 500)**  | 740.29 ms       | 142.88 ms   | **5.2x faster**    | s-zip vs unzip         |
| **Read (500 lines)**      | 18 µs           | 27 µs       | 0.67x              | Raw FFI                |
| **Read (1K lines)**       | 29 µs           | 47 µs       | 0.62x              | Raw FFI                |
| **Read (5K lines)**       | 120 µs          | 194 µs      | 0.62x              | Raw FFI                |
| **Write (1K lines)**      | 49 µs           | 139 µs      | 0.35x              | Raw FFI                |
| **Write (5K lines)**      | 135 µs          | 408 µs      | 0.33x              | Raw FFI                |

**Key Insights:**

- 🎯 **PTY/Terminal**: **15.29x faster** (exceeded 10x target!) - Native ring buffer, zero-copy reads
- ✅ **Edit Tool**: 2-6x faster across all file sizes with all 9 smart replacement strategies
- ✅ **Bash Parser**: 50-100x faster using native tree-sitter vs WASM (0.020ms per command, no initialization overhead)
- ✅ **Glob/Grep**: 1.8-2.7x faster by eliminating process spawn overhead
- ✅ **VCS Info**: 1.83x faster using libgit2 directly (no process spawning, 45% latency reduction)
- ✅ **Archive Extraction**: 3-5x faster using s-zip vs shell commands (unzip/PowerShell)
- ⚠️ **File I/O**: Raw FFI is 1.5-3x slower than Bun native due to FFI overhead
- 📊 **Memory**: Equivalent peak heap usage between Rust and Node.js for file I/O
- 🎯 **Lesson**: FFI overhead (~50µs) remains; only use Rust when compute > overhead
- 🔧 **Decision**: We use raw Rust FFI for consistency across native tool suite

**Native Rust Components:**

- ✅ **PTY/Terminal**: Full terminal session management with 2MB ring buffer, zero-copy streaming (15.29x faster) - Powers all Bash tool operations
- ✅ **Edit Tool**: 9 smart replacement strategies with fuzzy matching (complex compute justifies FFI)
- ✅ **File Listing**: Native ignore crate for fast directory traversal (eliminates process spawn)
- ✅ **File Search (Glob)**: Pattern matching with gitignore support (eliminates process spawn)
- ✅ **Code Search (Grep)**: Regex search across large codebases (eliminates process spawn)
- ✅ **Archive Extraction**: ZIP file extraction using s-zip streaming reader (3-5x faster, cross-platform)
- ✅ **Bash Parser**: Native tree-sitter bash command parsing (50-100x faster than WASM, 0.020ms per command)
- ✅ **File I/O**: Native read/write with optimized raw FFI
- ✅ **Directory Listing**: Fast recursive directory traversal
- ✅ **VCS Info**: Lightning-fast git repository information (libgit2 vs subprocess)
- ✅ **System Stats**: CPU and memory monitoring

**Benefits:**

- 🚀 **Up to 6x faster** text editing with 9 smart replacement strategies (Levenshtein, fuzzy matching)
- 🚀 **Up to 5x faster** archive extraction (ZIP files) with cross-platform native code
- 💚 **83% less time** on large file edits (10K lines: 451ms → 75ms)
- ⚡ **1.83x faster** git operations using libgit2 (no process spawning)
- 🎯 **2-3x faster** glob/grep by eliminating process spawn overhead
- 📊 **Optimized I/O**: Raw FFI implementation for consistent performance
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
- ⚡ **Eliminated process spawns** for glob/grep (2-3x speedup)
- 🗜️ **Fast archive extraction** with s-zip (3-5x faster, cross-platform native)
- 💚 **Faster edits** (2-6x improvement, scales with file size)
- 🔥 **Smart edit strategies** with fuzzy matching and Levenshtein similarity
- 📊 **Optimized I/O**: Raw FFI implementation for consistent performance
- 🔧 **Consistent native tooling**: All file operations use Rust for predictable performance

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

```bash
# Add the tap
brew tap KSD-CO/tap

# Install IronCode
brew install ironcode

# Update to latest version
brew upgrade ironcode
```

### Direct Download

Download pre-built binaries for your platform from [GitHub Releases](https://github.com/KSD-CO/IronCode/releases):

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

### Arch Linux (AUR)

_Coming soon - AUR package will be available in the future_

---

## Usage

### Quick Start

```bash
# Start interactive session in current directory
ironcode

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
- [IronCode Documentation](https://ironcode.cloud/docs)
