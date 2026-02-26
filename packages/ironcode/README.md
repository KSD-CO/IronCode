# IronCode

An AI coding assistant with a native Rust backend for high-performance local tooling.

## Key Features

- **AI Coding Agent** — multi-provider LLM support (Anthropic, OpenAI, Gemini, Bedrock, etc.)
- **Built-in Terminal** — native PTY with external editor support
- **File Watcher** — real-time filesystem change tracking
- **🔎 Local Code Search** — BM25 + tree-sitter semantic symbol search
- **Git Integration** — diff, blame, branch management

## Native Rust Components

All performance-critical components are compiled to a native `.dylib` via FFI:

| Component             | Status | Description                                          |
| --------------------- | ------ | ---------------------------------------------------- |
| File Watcher          | ✅     | Cross-platform via `notify` crate                    |
| Fuzzy Match           | ✅     | `nucleo-matcher` for fast scoring                    |
| Code Search (BM25)    | ✅     | tree-sitter symbol indexing + BM25 ranking           |
| VCS (git2)            | ✅     | Native git operations                                |
| PTY                   | ✅     | `portable-pty` for terminal emulation                |
| Wildcard Matching     | ✅     | `*`/`?` glob patterns via `rexile`, replaces JS impl |
| Bash Parser           | ✅     | tree-sitter bash — extracts dirs, patterns, always   |
| Command Prefix (RETE) | ✅     | GRL rule engine maps commands → arity for prefix     |

## Local Code Search (BM25 + tree-sitter)

Indexes source files using tree-sitter for accurate symbol extraction, then ranks results with BM25 for fast semantic search.

### Supported Languages (12)

| Language   | Extensions                    | Extracted Symbols                                        |
| ---------- | ----------------------------- | -------------------------------------------------------- |
| TypeScript | `.ts`, `.tsx`                 | functions, classes, interfaces, types, enums, namespaces |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | functions, classes, arrow functions                      |
| Python     | `.py`, `.pyw`                 | functions, classes, decorators                           |
| Rust       | `.rs`                         | functions, structs, enums, traits, types, impl methods   |
| Go         | `.go`                         | functions, methods, structs, interfaces, types           |
| Java       | `.java`                       | classes, interfaces, enums, methods, constructors        |
| C#         | `.cs`                         | namespaces, classes, interfaces, enums, methods          |
| Ruby       | `.rb`, `.rake`                | modules, classes, methods                                |
| C          | `.c`, `.h`                    | functions, structs, enums, typedefs                      |
| C++        | `.cpp`, `.cc`, `.hpp`         | namespaces, classes, structs, functions                  |
| PHP        | `.php`                        | functions, classes, interfaces, traits, enums            |
| Scala      | `.scala`, `.sc`               | classes, objects, traits, functions, vals                |

### Performance

Benchmarked on `rust-rule-engine` (137 files, 2221 Rust symbols):

- **Index time**: ~423ms
- **Search latency**: <1ms per query
- **Memory**: ~15MB index

### Usage

The `search_codebase` tool is preferred over grep for concept-based searches:

```
search_codebase("authentication middleware")
search_codebase("database connection pool")
search_codebase("error handling")
```

Use `grep` only for exact known strings or regex patterns.

## Architecture

```
packages/ironcode/
├── src/
│   ├── tool/
│   │   ├── bash.ts               # Bash tool (uses native parser via FFI)
│   │   ├── codesearch-local.ts   # BM25 search tool (FFI wrapper)
│   │   ├── grep.ts               # Exact text search
│   │   └── ffi.ts                # Native library bindings
│   ├── util/
│   │   └── wildcard.ts           # Wildcard matching (delegates to FFI)
│   ├── project/instance.ts       # Project context / AsyncLocalStorage
│   └── bus/                      # Event bus (file watcher events)
└── native/tool/
    ├── src/
    │   ├── indexer.rs            # tree-sitter symbol extractor
    │   ├── codesearch.rs         # BM25 index + search
    │   ├── shell.rs              # Bash parser + command prefix (RETE)
    │   ├── wildcard.rs           # Wildcard matching via rexile
    │   └── ffi.rs                # C FFI exports
    └── Cargo.toml
```

## Changelog

### Feb 26, 2026 — Native Wildcard, Bash Parser, Command Prefix (RETE)

Moved three performance-sensitive subsystems into the native Rust library:

- **Wildcard matching** — `wildcard.rs` uses `rexile` for `*`/`?` glob patterns.
  Handles the special `" *"` trailing-wildcard form (e.g. `"ls *"` matches both
  `"ls"` and `"ls -la"`). `util/wildcard.ts` now delegates to `wildcardMatchFFI`.

- **Bash command parser** — `shell.rs` uses tree-sitter-bash to walk the AST and
  extract directories, full command patterns, and `always`-allow prefixes.
  `bash.ts` calls `parseBashCommandFFI` instead of the WASM tree-sitter path.

- **Command prefix extraction (RETE rule engine)** — `extract_command_prefix` in
  `shell.rs` loads 137 GRL rules into an `IncrementalEngine` (rust-rule-engine).
  Each rule fires with `no-loop`; taking `max(rule_name_to_arity)` over all fired
  rule names gives the correct longest-prefix arity regardless of activation order.
  Mirrors `BashArity.prefix()` from `permission/arity.ts` exactly.

### Feb 23, 2026 — Local Code Search (BM25 + tree-sitter)

Added `search_codebase` tool backed by a Rust native library:

- **tree-sitter** parses source files to extract named symbols (functions, classes, etc.) rather than splitting by line count
- **BM25** ranks results by term frequency/inverse document frequency — the same algorithm used by Elasticsearch and most search engines
- Supports 12 languages: TypeScript, JavaScript, Python, Rust, Go, Java, C#, Ruby, C, C++, PHP, Scala
- Incremental re-indexing via file watcher (adds/changes/deletes update the index automatically)
- Fallback to 50-line overlapping chunks when a file has no extractable symbols

## Development

```bash
bun install
bun run typecheck

# Build native library
cd packages/ironcode/native/tool
cargo build --release
```
