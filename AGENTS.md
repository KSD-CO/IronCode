# IronCode Agent Guidelines

Bun + TypeScript monorepo with a CLI/TUI, Hono HTTP server, SolidJS web frontend, and native Rust FFI tools. Default branch is `dev`. Package manager: `bun@1.3.11`.

## Project layout

| Path                                                      | Description                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/ironcode`                                       | Core CLI, TUI (SolidJS + OpenTUI), Hono server, AI tools, session management          |
| `packages/ironcode/native/tool`                           | Rust crate (`ironcode-tool`) — grep, glob, edit, read, VCS, fuzzy match, etc. via FFI |
| `packages/sdk/js`                                         | Auto-generated TypeScript SDK from OpenAPI spec                                       |
| `packages/plugin`                                         | Public plugin API (`Plugin`, `ToolDefinition`, `Hooks`)                               |
| `packages/util`                                           | Shared utilities (`NamedError`, typed error factory)                                  |
| `packages/script`                                         | Internal build/release scripts                                                        |
| `packages/slack`, `packages/telegram`, `packages/discord` | Chat bot integrations                                                                 |

## Build / lint / test commands

```bash
# Install
bun install

# Dev servers
bun --cwd packages/ironcode dev              # CLI/TUI
bun --cwd packages/app run dev:web            # Web frontend

# Build
bun --cwd packages/<pkg> run build

# Typecheck (runs turbo across all packages — most use tsgo, not tsc)
bun run typecheck

# Format (Prettier — semi:false, printWidth:120, config is inline in root package.json)
./script/format.ts

# Regenerate SDK after changing server routes
./script/generate.ts
```

### Running tests

Tests use Bun's built-in test runner. **Never run tests from the repo root** — the root `test` script deliberately exits 1.

```bash
# All tests in a package
bun --cwd packages/ironcode test

# Single test file
bun --cwd packages/ironcode test test/tool/grep.test.ts

# Filter by name substring
bun --cwd packages/ironcode test --filter "basic search"

# Rust crate tests/benchmarks (run from crate directory)
cargo test      # workdir: packages/ironcode/native/tool
cargo bench
```

Test files live in `packages/ironcode/test/` organized by domain (tool/, session/, provider/, util/, config/, server/, etc.). All tests use `*.test.ts` — no `.spec.ts` convention.

### Pre-push hook (Husky)

The pre-push hook validates the Bun version matches `packageManager` in root `package.json`, then runs `bun typecheck`. No pre-commit hook.

## Code style & conventions

### Namespace pattern (dominant architecture)

Namespaces own their domain — types and runtime functions coexist:

```ts
export namespace Session {
  const log = Log.create({ service: "session" })

  export const Info = z.object({ id: z.string(), title: z.string() })
  export type Info = z.output<typeof Info>

  export const create = fn(CreateInput, async (input) => { ... })
}
```

Key namespaces: `Session`, `Config`, `Tool`, `Bus`, `BusEvent`, `Storage`, `Server`, `Agent`, `Log`, `Instance`.

### Imports

- Relative imports for local modules: `import { Log } from "../util/log"`
- Path aliases in `packages/ironcode`: `@/*` → `./src/*`, `@tui/*` → `./src/cli/cmd/tui/*`
- Named imports only for local code; default imports for third-party when appropriate (`import z from "zod"`)
- ESM throughout (`"type": "module"`)

### Naming

- Variables & functions: `camelCase`
- Types, interfaces, namespaces, enums: `PascalCase`
- Constants: `UPPER_SNAKE` only for true runtime constants
- DB columns (Drizzle): `snake_case`

### Formatting

- Prettier: `semi: false`, `printWidth: 120` (configured in root `package.json`, no `.prettierrc` file)
- 2-space indent, LF line endings, UTF-8
- No ESLint, Biome, or editorconfig — Prettier is the only formatter
- Run `./script/format.ts` before committing

### Types & validation

- Zod at every boundary: HTTP payloads, CLI args, config, tool inputs
- Dual-declaration pattern: `export const Info = z.object({...})` + `export type Info = z.output<typeof Info>`
- `fn()` helper wraps functions with Zod input validation
- `z.discriminatedUnion()` for union types; `.safeParse()` for non-throwing validation
- Avoid `any` — prefer `unknown` validated through Zod, explicit interfaces, or generics
- Use `const` by default; `let` only for deliberate mutability

### Error handling

- `NamedError.create("NotFoundError", z.object({...}))` from `@ironcode-ai/util/error` for typed errors
- `NamedError.Unknown` as generic catch-all
- Avoid throwing for control flow — use Result-like return values for internal APIs
- `try`/`catch` at IO boundaries; `.catch(() => {})` for fire-and-forget
- Convert external errors to typed shapes at boundaries before returning

### Logging & events

- `const log = Log.create({ service: "name" })` at namespace scope
- `log.info(...)`, `log.error(...)`, `log.debug(...)` with structured context objects
- `using _ = log.time(id)` for timing with `Symbol.dispose`
- `BusEvent.define("session.created", z.object({...}))` for typed events
- `Bus.publish(event, data)` / `Bus.subscribe(event, callback)`
- Suppress logs in tests: `Log.init({ print: false })`

### State & dependency injection

- `Instance.state(async () => { ... })` for lazy per-instance state
- `Instance.provide({ directory, fn })` to isolate tests with project context

## Testing patterns

```ts
import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

// Minimal tool context for testing
const ctx = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

describe("tool.grep", () => {
  test("basic search", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const grep = await GrepTool.init()
        const result = await grep.execute({ pattern: "export", path: "..." }, ctx)
        expect(result.metadata.matches).toBeGreaterThan(0)
      },
    })
  })
})

// Temporary directory with git init + auto-cleanup
test("isolated environment", async () => {
  await using tmp = await tmpdir({ git: true })
  // tmp.path is an isolated temp directory
})
```

## Rust native tools

The `ironcode-tool` crate (`packages/ironcode/native/tool`) builds as a `cdylib` for FFI from Bun. Modules: `grep`, `glob`, `edit`, `read`, `bm25`, `codesearch`, `fuzzy`, `vcs`, `shell`, `file_list`, `file_ignore`, `watcher`, `permission`, `terminal`, `indexer`, `archive`, `lock`, `stats`, `ls`. Functions are exported as `extern "C"` taking C strings and returning JSON-serialized results. Includes tree-sitter grammars for ~15 languages.

## Cursor / Copilot rules

No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files exist in this repo. If maintainers add any, agents MUST incorporate their contents and prioritize them over this document.

## Git & editing safety

- Make minimal, targeted edits. Stage only intended files.
- Branch from `dev` and open PRs against `dev`.
- Never force-push or run destructive git commands without explicit approval.
- Do not commit unless the user explicitly asks. Write a 1–2 sentence message explaining why.

## See also

- `packages/ironcode/AGENTS.md` — package-specific notes on tools, architecture, and SDK generation.
