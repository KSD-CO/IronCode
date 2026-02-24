# IronCode Agent Guidelines

This repository is a Bun-based monorepo with TypeScript web/CLI packages and native Rust components. This document gives precise, actionable rules for agentic coding assistants operating here. Keep edits minimal, consistent with existing conventions, and non-destructive unless explicitly requested.

Project essentials

- Monorepo: Bun workspace (packages/\* and packages/sdk/js). Native parts use Cargo/Tauri.
- Default branch: `dev` — create branches from `dev` and open PRs against it.
- Package manager: Bun (CI expects Bun 1.3.x). Use Bun CLI for JS/TS tasks and Cargo for Rust.

Quick commands (run from repo root)

- Development
  - `bun dev` — run core CLI/TUI in `packages/ironcode`
  - `bun run dev:web` — run the web app (packages/app)
  - `bun run dev:desktop` — run desktop (Tauri) dev environment

- Tests & typecheck
  - `bun test` — run tests for the current package (run this from the package dir)
  - From repo root to run tests in a package: `bun --cwd packages/ironcode test`
  - Run a single file: `bun test packages/ironcode/test/foo.test.ts` or from package dir `bun test path/to/file.test.ts`
  - Filter by test name: `bun test --filter "name"`
  - Typecheck workspace: `bun run typecheck` or `bun typecheck` (runs Turbo/TS)

- Build & native
  - JS/TS build: `bun run build` (run in specific package dir for package builds)
  - Web production build: `bun --cwd packages/app run build` or `bun run --cwd packages/app build`
  - Rust tests/benches: `cargo test` / `cargo bench` in `packages/ironcode/native/tool` or respective crate dir

- Utilities
  - Format workspace: `./script/format.ts`
  - Regenerate SDKs: `./script/generate.ts` (run after changing HTTP routes or handler signatures)

Cursor / Copilot rules

- I searched for repository rules: there are no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files present. If such files are added later, import them verbatim and prioritize those rules over this document.

Code style & conventions (for agents)

- General
  - Single responsibility: functions should do one thing and be small.
  - Prefer composition and small helpers over nested conditionals; use early returns and guard clauses.
  - Use `const` by default; `let` only when state is intentionally mutable.
  - Avoid `any`. Prefer inferred types, explicit interfaces, generics, or `unknown` converted via validation.
  - Favor pure helpers for domain logic; push side effects to IO boundaries.

- Imports
  - Use relative imports for local modules (e.g. `import { x } from "../x"`).
  - Prefer named imports for local modules; avoid default exports for local code unless the module naturally represents a single primary value.
  - Use ESM syntax across the workspace (`"type": "module"` in root package.json).

- Naming
  - Variables & functions: camelCase (e.g., `getUserById`).
  - Types, interfaces, classes, enums: PascalCase (e.g., `UserProfile`, `DbResult`).
  - Constants: UPPER_SNAKE when truly constant across runtime (rare).
  - DB column names (Drizzle): snake_case.

- Files & modules
  - One main exported responsibility per file when it improves discoverability.
  - Keep tests colocated with implementation under `test/` or in the same package's `test` directory.

- Formatting & linting
  - Prettier config: `semi: false`, `printWidth: 120` (root package.json). Use `./script/format.ts` to apply workspace formatting.
  - Editor conventions: LF line endings, UTF-8, 2-space indent.
  - Line length: aim for 80 in editors; formatted files are allowed up to 120.

- Types & validation
  - Use Zod for runtime validation of external inputs (HTTP payloads, CLI args, config files).
  - Prefer TypeScript types/interfaces and discriminated unions for internal shapes and variant modelling.
  - Convert `unknown` to typed shapes as soon as possible using validators.

- Error handling
  - Avoid throwing for predictable control flow. Prefer Result-like return types for internal APIs (e.g., `Result<T, E>` pattern).
  - Use `try`/`catch` at IO and boundary layers; convert external errors to typed or canonical error shapes before returning/upstreaming.
  - For promises where inline handling is appropriate, use `.catch()` and log context.

- Logging & observability
  - Use structured logging helpers: `Log.create({ service: "name" })` when available. Always include context (IDs, paths) with logs.

Testing guidance

- Use Bun's test runner. Tests naming: unit `*.test.ts`, integration/e2e `*.spec.ts`.
- Prefer real implementations in unit tests where fast and deterministic; mock external HTTP/DB only for slow or non-deterministic dependencies.
- From repo root: run a package test suite with `bun --cwd packages/<package> test`.
- To run a single test file: `bun test packages/<package>/test/that.test.ts` (or cd into the package and run `bun test path/to/file.test.ts`).

Git, commits & PR safety

- Never commit directly to `main`. Branch from `dev` and open a PR for review.
- Avoid destructive git operations. Never use `git reset --hard` or force-push to shared branches without explicit permission.
- Commit rules when asked to commit:
  1. Stage only intended files.
  2. Use a concise commit message (1–2 sentences) focused on the why.
  3. Do not amend pushed commits or force-push public branches unless explicitly authorized.

Rules for automated edits (agents)

- Prefer `apply_patch` for single-file edits; make minimal, targeted patches.
- Do not modify unrelated files. If a larger change is necessary, explain the reason in the commit message.
- If you change server routes or handler signatures, run `./script/generate.ts` to regenerate SDKs and update `packages/sdk`.
- When tests exist, run relevant tests locally: `bun --cwd packages/<package> test path/to/test` before committing. If you cannot run tests, list which tests to run and why.

Where to look (quick pointers)

- Core CLI & server: `packages/ironcode/src` — server routes at `packages/ironcode/src/server/routes/session.ts`.
- Web frontend: `packages/app`.
- Native tooling / Rust: `packages/ironcode/native/tool`.
- SDK generation & formatting scripts: `script/generate.ts`, `script/format.ts`.

If you update this file

- Keep edits short and machine-friendly. When adding repo-wide rules (cursor/copilot), include exact file paths and import instructions.

Escalation / questions

- If blocked by missing credentials or a destructive decision, ask one focused question and include a recommended default. Do other non-blocking work first.

Short checklist for new agent runs

1. Run `bun --version` and `bun --cwd packages/ironcode --version` to verify Bun version.
2. Run `bun --cwd packages/ironcode test --filter "your test name"` to execute a focused test.
3. Use `./script/format.ts` before committing formatting-sensitive changes.

This document is intentionally pragmatic: follow patterns in the codebase, run the tests for changed packages, and prefer minimal, well-justified edits.

File location: `AGENTS.md`
