# IronCode Agent Guidelines

This repository is a Bun-based monorepo containing TypeScript web/CLI packages and native Rust components. This document tells agentic coding assistants how to build, test, lint, and make safe, minimal edits here. Keep changes focused: prefer small, well-documented patches and follow the repo conventions.

Key pointers (quick)

- Use Bun for JS/TS work and Cargo for Rust crates; default branch is `dev`.
- Run package-level commands with `bun --cwd packages/<pkg> ...` from the repo root.
- Regenerate SDKs after changing server routes: run `./script/generate.ts` and update `packages/sdk`.
- Format using `./script/format.ts` before committing.

Project layout

- Monorepo root: packages under `packages/*` and `packages/sdk/js`.
- Core CLI & server: `packages/ironcode/src` (server routes: `packages/ironcode/src/server/routes/session.ts`).
- Web frontend: `packages/app`.
- Native (Rust) tools: `packages/ironcode/native/tool`.

Build / lint / test (use these exact commands)

- Install dependencies (repo root):
  - `bun install`
- Development servers / quick runs:
  - Core CLI/TUI: `bun --cwd packages/ironcode dev`
  - Web dev server: `bun --cwd packages/app run dev:web`
  - Desktop (Tauri) dev: `bun --cwd packages/ironcode run dev:desktop`
- Build / production:
  - Build a JS/TS package: `bun --cwd packages/<package> run build`
  - Web production build: `bun --cwd packages/app run build`
- Lint / format:
  - Format workspace (Prettier): `./script/format.ts`
  - Follow `.prettierrc` in the repo root (see formatting rules below)
- Tests / typecheck:
  - Run all tests in a package (from package dir): `bun test`
  - Run package tests from repo root: `bun --cwd packages/<package> test`
  - Run a single test file quickly: `bun --cwd packages/<package> test path/to/file.test.ts`
  - Run tests by name filter: `bun --cwd packages/<package> test --filter "partial test name"`
  - Typecheck entire workspace: `bun run typecheck` or `bun typecheck`
- Native (Rust):
  - Run crate tests/benches: `cargo test` / `cargo bench` (run with workdir set to crate directory)

Cursor / Copilot rules

- Current scan: there are no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files in this repo. If maintainers add any of those, agents MUST incorporate their exact contents and prioritize them over this document.

Editing and Git safety rules for agents

- Make minimal, targeted edits. Prefer `apply_patch` for single-file changes.
- Never run destructive git commands (e.g., `git reset --hard`) or force-push to shared branches without explicit user approval.
- Branch from `dev` and open PRs against `dev` for feature work.
- Do not commit automatically unless the user explicitly asks. If asked to commit, stage only intended files and write a 1–2 sentence message explaining why.

Code style & conventions (for agents and contributors)

- General
  - Functions and modules should have single responsibility.
  - Prefer small, pure helpers for domain logic; push side-effects to IO/boundary layers.
  - Use `const` by default; use `let` only for deliberate mutability.
  - Avoid `any`. Prefer inferred types, `unknown` validated with Zod, explicit interfaces, or generics.

- Imports
  - Use relative imports for local modules (e.g., `import { x } from "../x"`).
  - Prefer named exports/imports for local code; reserve default exports for modules that naturally expose a single primary value.
  - Use ESM consistently (`type: "module"` in root `package.json`).

- Naming
  - Variables & functions: camelCase (e.g., `getUserById`).
  - Types, interfaces, classes, enums: PascalCase (e.g., `UserProfile`).
  - Constants: UPPER_SNAKE only for true runtime constants.
  - DB column names (Drizzle): snake_case.

- Files & tests
  - Keep one main responsibility per file when it improves discoverability and testability.
  - Tests live under package `test/` directories. Unit tests use `*.test.ts`, integration/e2e can use `*.spec.ts`.

- Formatting & linting specifics
  - Prettier root: `semi: false`, `printWidth: 120`.
  - Editor conventions: LF line endings, UTF-8 encoding, 2-space indent.
  - Aim for readable lines in editors (~80 cols); CI allows up to 120.
  - Run `./script/format.ts` before committing changes that touch formatting.

- Types & runtime validation
  - Validate external inputs at the boundary with Zod (HTTP payloads, CLI args, config files).
  - Prefer TypeScript discriminated unions and interfaces for internal models.
  - Convert `unknown` to typed shapes as early as possible.

- Error handling
  - Avoid throwing for predictable control flow. Use Result-like return values for internal APIs when appropriate.
  - Catch and canonicalize external/IO errors at boundaries; convert to typed error shapes before returning.
  - Use `try`/`catch` at IO boundaries; prefer `.catch()` with contextual logging for promise chains when inline handling fits.

- Logging & observability
  - Use structured logging helpers when available (e.g., `Log.create({ service: "name" })`).
  - Include keys (IDs, route, user, trace) in log lines for diagnosability.

Testing guidance (practical notes)

- Use Bun's test runner for JS/TS packages.
- To run a single test file quickly from the repo root:
  - `bun --cwd packages/<pkg> test path/to/file.test.ts`
- To run tests by name substring:
  - `bun --cwd packages/<pkg> test --filter "name substring"`
- When changing behavior, run the package test suite and re-run failing tests locally before committing.

Repository maintenance (agent checklist)

1. Confirm Bun is available: `bun --version` and verify package context: `bun --cwd packages/ironcode --version`.
2. Run focused tests: `bun --cwd packages/<pkg> test --filter "test name"` or run a single file.
3. Run `./script/format.ts` to apply consistent Prettier formatting.
4. If server routes changed: run `./script/generate.ts` and update `packages/sdk`.

Where to look (quick file references)

- Core CLI & server code: `packages/ironcode/src`.
- Server routes example: `packages/ironcode/src/server/routes/session.ts`.
- Web frontend: `packages/app`.
- Native tooling / Rust: `packages/ironcode/native/tool`.
- SDK generation & formatting scripts: `script/generate.ts`, `script/format.ts`.

If you need to ask maintainers

- Ask one focused question when blocked by secrets/credentials or destructive choices. Provide a recommended default and explain what changes based on the response.

Notes

- This file complements `packages/ironcode/AGENTS.md` — see that file for package-specific notes (tools, tests, and examples).
- Keep changes minimal and well-documented. When in doubt, run package tests and formatting before committing.

File location: `AGENTS.md`
