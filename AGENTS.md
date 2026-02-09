# IronCode Agent Guidelines

This document provides essential information for AI coding agents working in the IronCode repository.

## Project Overview

- **Type**: Bun workspace monorepo with TypeScript/Rust hybrid architecture
- **Default branch**: `dev` (local `main` may not exist; use `dev` or `origin/dev` for diffs)
- **Package manager**: Bun 1.3.8 (exact version required)
- **Primary runtime**: Bun (not Node.js)
- **Build orchestration**: Turbo 2.5.6

## Build, Lint, and Test Commands

### Root Commands (run from repo root)

```bash
bun dev                 # Run CLI/TUI (packages/ironcode)
bun run dev:desktop     # Run Tauri desktop app
bun run dev:web         # Run web app dev server (packages/app)
bun typecheck           # Type check all packages via Turbo
```

### Core Package (packages/ironcode)

```bash
bun test                # Run all unit tests
bun test path/to/file.test.ts  # Run single test file
bun run typecheck       # TypeScript type checking
bun run build           # Build standalone executable
bun run dev             # Run CLI locally
```

### App Package (packages/app)

```bash
bun dev                 # Vite dev server
bun run build           # Production build
bun run test:unit       # Unit tests with HappyDOM
bun run test:unit:watch # Unit tests in watch mode
bun run test:e2e        # Playwright E2E tests
bun run test:e2e:ui     # Playwright UI mode
bun typecheck           # Type checking
```

### Native Components (packages/ironcode/native/tool)

```bash
cargo test              # Run Rust unit tests
cargo bench             # Run benchmarks
```

### Formatting

```bash
./script/format.ts      # Format all files with Prettier
```

### SDK Regeneration

```bash
./script/generate.ts    # Regenerate SDK from OpenAPI spec
# Run after modifying server endpoints in packages/ironcode/src/server/server.ts
```

## Code Style Guidelines

### General Principles

- Keep logic in one function unless composable or reusable
- Avoid `try`/`catch` blocks where possible (prefer Result patterns)
- Avoid using the `any` type
- Prefer single-word variable names where possible
- **Use Bun APIs** when possible: `Bun.file()`, `Bun.write()`, etc.
- Rely on type inference; avoid explicit type annotations unless needed for exports or clarity
- Prefer functional array methods (`flatMap`, `filter`, `map`) over for loops
- Use type guards with `filter` to maintain type inference downstream

### Imports

- Use relative imports for local modules
- Prefer named imports over default imports
- ESM only (`"type": "module"` in all packages)

```ts
// Good
import { Tool } from "../tool/tool"
import { Session } from "./session"

// Avoid
import Tool from "../tool/tool"
```

### Naming Conventions

- **Variables/functions**: camelCase, prefer single words
- **Classes/namespaces**: PascalCase
- **Database fields**: snake_case (Drizzle schemas)
- Inline values used only once to reduce variable count

```ts
// Good
const foo = 1
function journal(dir: string) {}
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns and guard clauses.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Error Handling

- Prefer Result patterns over throwing exceptions in tools
- Use `.catch()` on promises when appropriate
- Avoid `try`/`catch` unless absolutely necessary

### Type Definitions

- Use Zod schemas for runtime validation
- Use TypeScript interfaces/types for structure
- Leverage catalog versioning for shared dependencies (see `workspaces.catalog` in root `package.json`)

### Schema Definitions (Drizzle ORM)

Use snake_case for field names so column names don't need string redefinition.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Architecture Patterns

- **Namespace-based organization**: `Tool.define()`, `Session.create()`, `Log.create()`
- **Dependency injection**: Use `App.provide()` for DI container
- **Event bus**: `Bus.subscribe()` for pub/sub patterns
- **Result patterns**: For error handling in tools
- **API communication**: TUI (SolidJS + OpenTUI) communicates with server via `@ironcode-ai/sdk`

## Testing Guidelines

- **Framework**: Bun's built-in test runner (`bun:test`)
- **Test patterns**: `*.test.ts` for unit tests, `*.spec.ts` for E2E (Playwright)
- **Philosophy**:
  - Avoid mocks as much as possible
  - Test actual implementation, not mock behavior
  - Don't duplicate business logic into tests
- **Test organization**: Colocated in `test/` directories or alongside source

```ts
// Example test structure
import { describe, expect, test } from "bun:test"
import { Scheduler } from "../src/scheduler"

describe("Scheduler.register", () => {
  test("defaults to instance scope per directory", async () => {
    // Test implementation
    expect(runs.count).toBe(1)
  })
})
```

## Formatting Rules

- **Formatter**: Prettier 3.6.2
- **Config**: `semi: false`, `printWidth: 120`
- **Line endings**: LF (Unix-style)
- **Charset**: UTF-8
- **Indentation**: 2 spaces
- **Max line length**: 80 (EditorConfig), 120 (Prettier)
- **Insert final newline**: Yes

## Git Workflow

- **Pre-push hooks**: Validates Bun version and runs `bun typecheck`
- Always use parallel tools when applicable
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety concerns

## Important Notes

- Never commit directly to `main` (if it exists); use `dev` branch
- After modifying server endpoints, regenerate SDK with `./script/generate.ts`
- Use Bun APIs (`Bun.file()`) instead of Node.js equivalents (`fs.readFile()`)
- Version catalog in root `package.json` centralizes dependency versions across packages
