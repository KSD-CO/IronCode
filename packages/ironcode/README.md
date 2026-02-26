# IronCode

An AI coding assistant with a native Rust backend for high-performance local tooling.

## Key Features

- **AI Coding Agent** — multi-provider LLM support (Anthropic, OpenAI, Gemini, Bedrock, etc.)
- **Multi-Account Providers** — connect multiple accounts per provider (Anthropic, OpenAI, Google, Copilot, …) with automatic round-robin load balancing
- **Built-in Terminal** — native PTY with external editor support
- **File Watcher** — real-time filesystem change tracking
- **🔎 Local Code Search** — BM25 + tree-sitter semantic symbol search
- **Git Integration** — diff, blame, branch management

## Native Rust Components

All performance-critical components are compiled to a native `.dylib` via FFI:

| Component              | Status | Description                                           |
| ---------------------- | ------ | ----------------------------------------------------- |
| File Watcher           | ✅     | Cross-platform via `notify` crate                     |
| Fuzzy Match            | ✅     | `nucleo-matcher` for fast scoring                     |
| Code Search (BM25)     | ✅     | tree-sitter symbol indexing + BM25 ranking            |
| VCS (git2)             | ✅     | Native git operations                                 |
| PTY                    | ✅     | `portable-pty` for terminal emulation                 |
| Wildcard Matching      | ✅     | `*`/`?` glob patterns via `rexile`, replaces JS impl  |
| Bash Parser            | ✅     | tree-sitter bash — extracts dirs, patterns, always    |
| Command Prefix (RETE)  | ✅     | GRL rule engine maps commands → arity for prefix      |

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

## Multi-Account Providers & Round-Robin

IronCode supports connecting **multiple accounts for any provider** and automatically distributing requests across them to avoid rate limits.

Supported via round-robin: **Anthropic**, **OpenAI**, **Google**, **GitHub Copilot**, **MiniMax**, **Qwen**, and any other API-key-based provider.

### Connecting accounts

**Via TUI** (`ironcode`):

1. Press `p` (or open the provider dialog)
2. Select a provider — first connect uses the standard auth flow (OAuth or API key)
3. After the first account is connected, clicking the provider row again shows **"Add another account"** or **"Replace existing"**
4. Once 2+ accounts are connected, the dialog shows one row per account plus a **"Provider · Add account"** row
5. Each row shows **Connected** in the footer so you know its status

**Via CLI** (API key providers: Anthropic, OpenAI, Google, etc.):

```bash
ironcode auth login
# Select provider (e.g. Anthropic)
# If an account already exists, choose "Add another account" or "Replace existing"
# Enter the API key for the new account
```

**Via CLI** (GitHub Copilot OAuth):

```bash
ironcode auth login
# Select "GitHub Copilot"
# If an account already exists, choose "Add another account" or "Replace existing"
```

### How round-robin works

Once two or more accounts of the same provider are connected, every message is routed to the next account automatically — **no configuration needed**:

| Message | Account used |
|---------|-------------|
| 1 | Anthropic (Account 1) |
| 2 | Anthropic (Account 2) |
| 3 | Anthropic (Account 1) |
| … | … |

- The **model you selected** (e.g. `claude-sonnet-4`) is preserved across accounts — only the provider account rotates
- Works **within the same session** as well as across different sessions
- Each message header shows which account was actually used: `Build · claude-sonnet-4 · Anthropic (Account 2) · 1.2s`
- Each provider family has its own independent round-robin counter (Anthropic accounts don't interfere with OpenAI accounts)

### Identifying which account is active

The per-message footer in the chat view shows the actual account used for that response:

```
▣ Build · claude-sonnet-4 · Anthropic          ← account 1
▣ Build · claude-sonnet-4 · Anthropic (Account 2) · 3.4s  ← account 2
```

The bottom status bar shows your currently configured provider. This does not update per-message since round-robin happens server-side.

### Removing an account

In the TUI provider dialog, select the account row you want to replace and re-authenticate. To remove all accounts, use:

```bash
ironcode auth logout anthropic
ironcode auth logout anthropic-2   # if added a second account

ironcode auth logout github-copilot
ironcode auth logout github-copilot-2   # if added a second account
```

### Auth storage

Accounts are stored in `~/.local/share/ironcode/auth.json`:

```json
{
  "anthropic":   { "type": "api", "key": "sk-ant-..." },
  "anthropic-2": { "type": "api", "key": "sk-ant-..." },
  "openai":      { "type": "api", "key": "sk-..." },
  "openai-2":    { "type": "api", "key": "sk-..." },
  "github-copilot":   { "type": "oauth", "access": "...", "refresh": "gho_..." },
  "github-copilot-2": { "type": "oauth", "access": "...", "refresh": "gho_..." }
}
```

Virtual accounts are auto-discovered at startup — no extra configuration needed.

## Changelog

### Feb 26, 2026 — Multi-Account Support for All Providers

Generalized multi-account + round-robin to work with any API-key-based provider (Anthropic, OpenAI, Google, MiniMax, Qwen, etc.):

- **Generic virtual account discovery** — at startup, any `{base}-{N}` key in `auth.json` (e.g. `anthropic-2`, `openai-2`) automatically gets a cloned database entry with full model list
- **Generic round-robin** — `Provider.nextAccountModel()` replaces `nextCopilotModel()`, derives base provider ID from any `providerID`, and rotates across all accounts in that family; each provider family has its own independent counter
- **TUI: "Add another / Replace" prompt** — clicking a connected single-account provider now shows a choice instead of silently replacing the key
- **TUI: generic multi-account rows** — once 2+ accounts are connected for any provider, dialog shows individual rows + "Provider · Add account" row
- **CLI: generic multi-account prompt** — `ironcode auth login` offers "Add another account" or "Replace existing" for any API-key provider that already has credentials stored

### Feb 26, 2026 — Multi-Account GitHub Copilot with Round-Robin

Added support for connecting multiple GitHub Copilot accounts and distributing requests across them automatically:

- **Multi-account connect** — TUI provider dialog shows one row per connected Copilot account plus an "Add account" row; CLI `ironcode auth login` prompts to add or replace when an account already exists
- **Round-robin per message** — `Provider.nextAccountModel()` intercepts every prompt in `createUserMessage()`, rotates the `providerID` across connected accounts while preserving the user's chosen `modelID`
- **Per-message account indicator** — assistant message header shows the actual provider name used (e.g. `GitHub Copilot (Account 2)`) via `props.message.providerID` lookup in sync data
- **Provider name resolution** — `local.model.parsed()` falls back to `provider_next.all` so virtual providers (`github-copilot-2`, etc.) display their friendly names instead of raw IDs
- **Auth storage** — virtual accounts saved as `github-copilot-2`, `github-copilot-3`, … in `auth.json`; `ProviderAuth.authorize()` resolves virtual IDs to the base provider's OAuth methods

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
