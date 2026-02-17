# IronCode Agent Guidelines

This file provides concise, actionable rules for agentic coding assistants operating in this repository.
Keep edits minimal, consistent with project conventions, and non-destructive unless explicitly requested.

Project at a glance

- Monorepo: Bun workspace with TypeScript web/CLI packages and native Rust components (Tauri/Cargo).
- Default branch: `dev` — use `dev` / `origin/dev` for diffs and PRs.
- Package manager: Bun (CI expects Bun 1.3.8).
- Primary runtime: Bun (not Node). Use Rust tooling for native crates.

Essential commands (run from repo root)

- Development / dev servers
  - `bun dev` — run core CLI/TUI (packages/ironcode)
  - `bun run dev:web` — run web app (packages/app)
  - `bun run dev:desktop` — run desktop (Tauri) dev environment

- Tests & typecheck
  - `bun test` — run all tests for current package (from package dir) or workspace depending on context
  - `bun test path/to/file.test.ts` — run a single test file (example: `bun test packages/ironcode/test/foo.test.ts`)
  - `bun test --filter "name"` — run tests matching name (bun's filter)
  - `bun run typecheck` or `bun typecheck` — run Turbo/TS typecheck across workspace

- Build & packaging
  - `bun run build` — build package executable (where provided)
  - `bun run build` in `packages/app` — production web build
  - `cargo test` / `cargo bench` — native Rust unit tests and benches in `packages/ironcode/native/tool`

- Utilities
  - `./script/format.ts` — run Prettier across the workspace
  - `./script/generate.ts` — regenerate SDKs when server endpoints change

Cursor / Copilot rules

- Currently there are no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files in the repo root.
- If such files are added, agents must import those rules verbatim and prioritize them over this document.

Code style & conventions (for agents)

- General
  - One clear responsibility per function; keep functions small, pure where possible.
  - Prefer composition over deep nesting; favor early returns and guard clauses.
  - Use `const` by default; use `let` only for clearly mutable state.
  - Avoid `any`; prefer inferred types, explicit interfaces, or generics.
  - Prefer immutable inputs and side-effect free helpers for domain logic.

- Imports
  - Use relative imports for local modules (e.g., `import { X } from "../x"`).
  - Prefer named imports; avoid default imports for local modules.
  - Use ESM syntax across the workspace (`"type": "module"`).

- Naming
  - Variables & functions: camelCase.
  - Types, interfaces, classes, enums: PascalCase.
  - Drizzle/DB column names: snake_case.

- Files & modules
  - Keep a single exported namespace or class per file when it improves discoverability.
  - Tests colocated with implementation under `test/` or alongside module files.

- Error handling
  - Prefer Result-like returns for internal APIs; avoid throwing for predictable/mutable control flow.
  - Use `try`/`catch` at IO/edge boundaries only; convert external errors to typed errors or MessageV2 shapes.
  - Use `.catch()` on promises where errors should be handled inline and logged.

- Types & validation
  - Use Zod for runtime validation of external inputs (HTTP payloads, CLI args, config files).
  - Use TypeScript types/interfaces for internal shapes; favor discriminated unions for variants.

- Logging
  - Use `Log.create({ service: "name" })` for structured logs; include relevant context (IDs, paths).

Formatting & linting

- Prettier version: 3.6.2. Config: `semi: false`, `printWidth: 120`.
- EditorConfig: LF line endings, UTF-8, indent 2 spaces.
- Preferred max line lengths: 80 (editor) / 120 (formatting).

Testing guidance

- Use Bun's test runner. Unit tests: `*.test.ts`; e2e/integration: `*.spec.ts`.
- Prefer real implementations in unit tests; mock external HTTP/DB only when slow or non-deterministic.
- To run a single test file from repo root: `bun test packages/ironcode/test/foo.test.ts`.

Git & PR safety

- Never commit directly to `main`. Branch from `dev`, open PRs for review.
- Do not run destructive git commands (`--hard` resets, force pushes) unless explicitly authorized.
- When committing (agent requested):
  1. Stage only intended files.
  2. Use a concise commit message (1–2 sentences) focusing on the why.
  3. Do not amend pushed commits or force-push public branches without explicit instruction.

Rules for automated edits

- Default to `apply_patch` for single-file edits; prefer targeted, minimal changes.
- Do not edit unrelated files; if you must, state the rationale in commit message.
- If you modify server endpoints (routes or handler signatures), run `./script/generate.ts` to regenerate SDKs and update `packages/sdk` as needed.
- When tests exist, run relevant tests locally (`bun test path/to/test`) before committing. If you cannot run tests, list which tests to run and why.

Where to look (quick pointers)

- Core CLI & server: `packages/ironcode/src` — server routes at `packages/ironcode/src/server/routes/session.ts`.
- Web frontend: `packages/app`.
- Native tooling: `packages/ironcode/native/tool`.
- SDK generation & scripts: `script/generate.ts`, `script/format.ts`.

If you update this file

- Keep edits short and machine-friendly for other automated agents.
- When adding new repo-wide rules (cursor/copilot), include exact file paths and import instructions.

Escalation / questions

- If blocked by missing credentials or a destructive decision, ask one focused question and include a recommended default.

This document is intentionally pragmatic: follow project patterns, run the tests, and prefer minimal, well-justified edits.

File location: `AGENTS.md`
