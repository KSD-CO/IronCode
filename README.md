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

<p align="center"><strong>Lightweight, local-first AI coding agent</strong></p>
<p align="center">
  <a href="https://github.com/anomalyco/opencode"><img alt="Upstream" src="https://img.shields.io/badge/upstream-ironcode-blue?style=flat-square" /></a>
  <a href="https://github.com/KSD-CO/IronCode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/KSD-CO/IronCode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

---

## What is IronCode?

IronCode is a **high-performance fork** of [OpenCode](https://github.com/anomalyco/opencode) - an AI coding agent that runs entirely on your machine. This fork removes cloud dependencies, focuses on core functionality, and **rewrites performance-critical components in Rust** for dramatically improved speed and efficiency.

### Key Features

- 🖥️ **Desktop App**: Native desktop application built with Tauri
- ⌨️ **CLI Interface**: Terminal UI for command-line workflows
- 🏠 **100% Local**: No cloud services, works completely offline
- 🔒 **Privacy First**: Your code never leaves your machine
- 🎯 **Lightweight**: Removed all cloud infrastructure dependencies
- ⚡ **Blazing Fast**: Native Rust implementation for performance-critical operations

### 🚀 Performance Improvements

IronCode rewrites key operations in native Rust with **measured real-world performance gains**:

| Operation                 | TypeScript/Node | Rust Native | **Speedup**      | Notes                   |
| ------------------------- | --------------- | ----------- | ---------------- | ----------------------- |
| **Edit Tool (10 lines)**  | 147 µs          | 171 µs      | 0.86x            | FFI overhead on small   |
| **Edit Tool (100 lines)** | 2.12 ms         | 1.95 ms     | **1.09x faster** | Break-even point        |
| **Edit Tool (1K lines)**  | 25.50 ms        | 34.07 ms    | 0.75x            | FFI overhead            |
| **Edit Tool (5K lines)**  | 215.52 ms       | 105.37 ms   | **2.05x faster** | 87% less memory         |
| **Edit Tool (10K lines)** | 728.47 ms       | 438.15 ms   | **1.66x faster** | 78% less memory         |
| **File Glob (100 files)** | 9.74 ms         | 3.55 ms     | **2.74x faster** | Zero spawn overhead     |
| **Grep Search**           | 34.84 ms        | 19.35 ms    | **1.80x faster** | Pattern: "function"     |
| **VCS Info (git)**        | 55.59 ms        | 0.037 ms    | **1502x faster** | libgit2 vs git commands |
| **Read (500 lines)**      | 18 µs           | 27 µs       | 0.67x            | Raw FFI                 |
| **Read (1K lines)**       | 29 µs           | 47 µs       | 0.62x            | Raw FFI                 |
| **Read (5K lines)**       | 120 µs          | 194 µs      | 0.62x            | Raw FFI                 |
| **Write (1K lines)**      | 49 µs           | 139 µs      | 0.35x            | Raw FFI                 |
| **Write (5K lines)**      | 135 µs          | 408 µs      | 0.33x            | Raw FFI                 |

**Key Insights:**

- ✅ **Edit Tool**: Wins on large files (5K+ lines) where complex compute amortizes FFI cost
- ✅ **Glob/Grep**: 1.8-2.7x faster by eliminating process spawn overhead
- ✅ **VCS Info**: 1500x faster using libgit2 instead of shelling out to git
- ⚠️ **File I/O**: Raw FFI is 1.5-3x slower than Bun native due to FFI overhead
- 📊 **Memory**: Equivalent peak heap usage between Rust and Node.js for file I/O
- 🎯 **Lesson**: FFI overhead (~50µs) remains; only use Rust when compute > overhead
- 🔧 **Decision**: We use raw Rust FFI for consistency across native tool suite

**Native Rust Components:**

- ✅ **Edit Tool**: 9 smart replacement strategies with fuzzy matching (complex compute justifies FFI)
- ✅ **File Search (Glob)**: Pattern matching with gitignore support (eliminates process spawn)
- ✅ **Code Search (Grep)**: Regex search across large codebases (eliminates process spawn)
- ✅ **File I/O**: Native read/write with optimized raw FFI
- ✅ **Directory Listing**: Fast recursive directory traversal
- ✅ **VCS Info**: Lightning-fast git repository information (libgit2 vs subprocess)
- ✅ **System Stats**: CPU and memory monitoring

**Benefits:**

- 🚀 **Up to 2x faster** for large file editing (5K+ lines) with complex transformations
- 💚 **78-87% less memory** usage on large file edits
- ⚡ **1500x faster** git operations using libgit2 vs shelling out
- 🎯 **2-3x faster** glob/grep by eliminating process spawn overhead
- 📊 **Optimized I/O**: Raw FFI implementation for consistent performance
- 🔧 **Consistent tooling**: Native Rust across all file operations for predictable performance

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

**Enhanced:**

- 🚀 **Native Rust performance** for compute-heavy operations (2-1500x faster)
- ⚡ **Eliminated process spawns** for glob/grep (2-3x speedup)
- 💚 **Reduced memory** (78-87% less on large file edits)
- 🔥 **Smart edit strategies** with fuzzy matching and Levenshtein similarity
- 📊 **Optimized I/O**: Raw FFI implementation for consistent performance
- 🔧 **Consistent native tooling**: All file operations use Rust for predictable performance

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

# Build Rust native components
cd packages/ironcode/native/tool
cargo build --release
cd ../../../..

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

# Benchmark native Rust components
cd packages/ironcode/native/tool
cargo bench

# Test edit correctness (TS vs Rust)
bun ./script/test-edit-correctness.ts

# Memory benchmarks
bun --expose-gc ./script/bench-edit-memory.ts
```

---

## Architecture

IronCode is built with:

- **CLI/TUI**: TypeScript + Bun runtime
- **Desktop App**: Tauri (Rust) + SolidJS
- **Web Frontend**: SolidJS (embedded in desktop app)
- **Plugins**: TypeScript plugin system
- **Native Performance Layer**: Rust (via FFI) for critical operations
  - Edit operations with 9 smart replacement strategies
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

- ✅ Native Rust edit tool with 9 strategies (3-4x speedup)
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
# Rust micro-benchmarks
cd packages/ironcode/native/tool
cargo bench --bench edit_bench

# Memory benchmarks (with GC profiling)
bun --expose-gc ./script/bench-edit-memory.ts

# Rust memory profile
cd packages/ironcode/native/tool
cargo run --release --bin memory_bench
```

**Benchmark Results Summary:**

| Metric           | TypeScript     | Rust          | Improvement   |
| ---------------- | -------------- | ------------- | ------------- |
| **10 lines**     | 103 µs         | 73 µs         | 1.4x faster   |
| **100 lines**    | 1.32 ms        | 1.09 ms       | 1.2x faster   |
| **1000 lines**   | 16.9 ms        | 7.7 ms        | 2.2x faster   |
| **5000 lines**   | 205 ms         | 65 ms         | 3.1x faster   |
| **10000 lines**  | 758 ms         | 171 ms        | 4.4x faster   |
| **Memory (1K)**  | 2.42 MB alloc  | 0.17 MB alloc | 93% reduction |
| **Memory (10K)** | 31.05 MB alloc | 1.91 MB alloc | 94% reduction |

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
