# IronCode Agent Guidelines

This repository is a Bun-based monorepo with TypeScript web/CLI packages and native Rust components. This document provides explicit, actionable rules for agentic coding assistants operating here. Keep edits minimal, follow existing conventions, and avoid destructive operations unless the user explicitly requests them.

Project essentials

- Monorepo layout: Bun workspace under `packages/*`, plus `packages/sdk/js`. Native components use Cargo/Tauri under `packages/ironcode/native`.
- Default branch: `dev`. Create branches from `dev` and open PRs against it.
- Package manager: Bun (CI expects Bun 1.3.x). Use Bun for JS/TS tasks; use Cargo for Rust crates.

Developer quick commands (run from repo root)

- Development
  - Run core CLI/TUI (package context): `bun --cwd packages/ironcode dev`
  - Run web dev server: `bun --cwd packages/app run dev:web`
  - Run desktop (Tauri) dev: `bun --cwd packages/ironcode run dev:desktop`

- Build & lint
  - Build a JS/TS package: `bun --cwd packages/<package> run build`
  - Web production build: `bun --cwd packages/app run build`
  - Format workspace: `./script/format.ts` (Prettier driven; runs from repo root)

- Tests & typecheck
  - Run tests in a package (from inside the package): `bun test`
  - Run package tests from repo root: `bun --cwd packages/<package> test`
  - Run a single test file: `bun --cwd packages/<package> test path/to/file.test.ts`
  - Filter tests by name: `bun --cwd packages/<package> test --filter "partial test name"`
  - Typecheck entire workspace: `bun run typecheck` or `bun typecheck` (Turbo/TS)

- Native (Rust)
  - Run Rust tests/benches in a crate: `cargo test` / `cargo bench` (workdir: crate directory)

- Utilities
  - Regenerate SDKs (after changing routes/handlers): `./script/generate.ts`

Cursor / Copilot rules

- Current repo scan found no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files. If maintainers add them later, agents MUST incorporate their exact contents and prioritize those rules over this document.

Agent behavior and editing rules

- Minimal, targeted edits: prefer `apply_patch` for single-file changes. Avoid bulk rewrites unless asked. Do not revert unrelated user edits.
- Non-destructive git rules: never run `git reset --hard` or force-push to shared branches without explicit permission. Branch from `dev` and open PRs.
- Commit guidance: only commit when explicitly requested. When committing, stage only intended files and use short 1–2 sentence messages describing the why.

Code style & conventions (for agents)

- General
  - Single responsibility: functions and modules should have one clear purpose.
  - Prefer small pure helpers for domain logic; push side-effects to IO/boundary layers.
  - Use `const` by default; use `let` only for deliberate mutability.
  - Avoid `any`. Use inferred types, `unknown` validated with Zod, explicit interfaces, or generics.

- Imports
  - Use relative imports for local modules (e.g., `import { x } from "../x"`).
  - Prefer named exports/imports for local code; reserve default exports for modules that naturally expose a single primary value.
  - Use ESM (`type: "module"` in root `package.json`) consistently.

- Naming
  - Variables & functions: camelCase (e.g., `getUserById`).
  - Types, interfaces, classes, enums: PascalCase (e.g., `UserProfile`).
  - Constants: UPPER_SNAKE only for true runtime constants.
  - DB column names (Drizzle): snake_case.

- Files & module layout
  - One main responsibility per file when it improves discovery and testability.
  - Tests colocated under a package `test/` directory. Unit tests use `*.test.ts`, integration/e2e use `*.spec.ts`.

- Formatting & linting
  - Prettier config (root): `semi: false`, `printWidth: 120`.
  - Editor conventions: LF line endings, UTF-8 encoding, 2-space indent.
  - Aim for readable lines in editors (~80 cols); built/CI formatting can accept up to 120.
  - Run `./script/format.ts` before committing formatting-sensitive edits.

- Types & validation
  - Use Zod for runtime validation of incoming external inputs (HTTP payloads, CLI args, config files).
  - Prefer TypeScript discriminated unions and interfaces for internal modelling.
  - Convert `unknown` to typed shapes as early as possible (validate at boundary).

- Error handling
  - Avoid throwing for predictable control flow. Use Result-like returns for internal APIs where appropriate.
  - Catch and canonicalize external/IO errors at boundaries. Convert to typed error shapes before returning up the stack.
  - Use `try`/`catch` only at IO layers; prefer `.catch()` with contextual logging for promises when inline handling fits.

- Logging & observability
  - Use structured logging helpers (e.g., `Log.create({ service: "name" })`) when available.
  - Include keys (IDs, route, user, trace) in log lines for diagnosability.

Testing guidance (practical)

- Use Bun's test runner for JS/TS packages.
- To run a single test file quickly: `bun --cwd packages/<pkg> test path/to/file.test.ts`.
- To run just tests matching a name substring: `bun --cwd packages/<pkg> test --filter "name substring"`.
- When changing code with tests, run the package test suite and re-run failed tests locally before committing.

Repository maintenance rules for agents

- SDK generation: If you change server routes or handler signatures, run `./script/generate.ts` and update `packages/sdk` accordingly.
- Formatting: run `./script/format.ts` after changes; this ensures Prettier settings are applied across the workspace.
- Tests: when you modify behavior, run the relevant package tests: `bun --cwd packages/<package> test path/to/test`.

Where to look (quick pointers)

- Core CLI & server code: `packages/ironcode/src` — server routes: `packages/ironcode/src/server/routes/session.ts`.
- Web frontend: `packages/app`.
- Native tooling / Rust: `packages/ironcode/native/tool`.
- SDK generation & formatting: `script/generate.ts`, `script/format.ts`.

Escalation / questions

- If blocked by missing credentials, production secrets, or a destructive decision, ask one focused question and include a recommended default action. Complete non-blocking work first.

Short checklist for a new agent run

1. Confirm Bun: `bun --version` and `bun --cwd packages/ironcode --version`.
2. Run focused tests: `bun --cwd packages/<pkg> test --filter "test name"` or a single file.
3. Run `./script/format.ts` and address formatting issues.
4. If routes/SDKs changed: run `./script/generate.ts` and update `packages/sdk`.

This document is intentionally pragmatic: follow patterns in the codebase, run package tests for changed packages, and prefer minimal, well-explained changes.

File location: `AGENTS.md`
