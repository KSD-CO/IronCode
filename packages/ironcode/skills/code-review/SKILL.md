---
name: code-review
description: |
  Pre-landing PR review. Analyzes diff against dev for type safety, error handling,
  injection vectors, concurrency issues, and other structural problems that tests
  don't catch. Two-pass review: critical (blocking) + informational.
---

# Pre-Landing PR Review

You are running the `/code-review` workflow. Analyze the current branch's diff against dev for structural issues that tests don't catch.

---

## Step 1: Check branch

1. Run `git branch --show-current` to get the current branch.
2. If on `dev`, output: **"Nothing to review — you're on dev or have no changes against dev."** and stop.
3. Run `git fetch origin dev --quiet && git diff origin/dev --stat` to check if there's a diff. If no diff, output the same message and stop.

---

## Step 2: Load review checklist

Use the following checklist for all reviews. This is the canonical review standard.

---

## Step 3: Get the diff

Fetch the latest dev to avoid false positives from a stale local dev:

```bash
git fetch origin dev --quiet
```

Run `git diff origin/dev` to get the full diff. This includes both committed and uncommitted changes against the latest dev.

---

## Step 4: Two-pass review

Apply the checklist against the diff in two passes:

### Pass 1 — CRITICAL (blocks shipping)

#### Type Safety & Data Validation
- Missing Zod validation at trust boundaries (API inputs, config parsing, file reads)
- `any` types that should be narrowed — especially in function parameters and return types
- Type assertions (`as Type`) without runtime validation — hiding potential runtime errors
- Unchecked `.json()` parsing — API responses parsed without schema validation

#### Injection & Command Safety
- String interpolation in `Bun.spawn`/`Bun.spawnSync` commands — user input could inject shell commands
- Path traversal: user-controlled paths not validated against a base directory (`path.resolve` + `startsWith` check)
- Unsanitized user input passed to `eval`, `new Function`, template literals used in prompts
- LLM prompt injection: user-controlled data interpolated directly into system prompts without escaping or framing

#### Concurrency & Race Conditions
- Read-check-write without atomicity (check if file exists, then write — another process could intervene)
- Shared mutable state accessed from async code without guards
- `Promise.all` where one rejection should not abort the others (should use `Promise.allSettled`)
- Event handlers that assume sequential execution but can fire concurrently

#### LLM Output Trust Boundary
- LLM-generated values (paths, commands, code) executed without validation
- Structured tool output accepted without type/shape checks before use
- LLM responses used to construct file paths, shell commands, or database queries without sanitization

### Pass 2 — INFORMATIONAL (included in review, non-blocking)

#### Error Handling Patterns
- Generic `catch (e)` without typed error checking — should use `NamedError.isInstance()` or specific error classes
- Errors caught and logged but not re-thrown or handled — silent swallowing
- Missing `.catch()` on fire-and-forget promises — unhandled rejection risk
- Error messages that don't include context (what was being attempted, with what input)

#### Code Quality
- Variables assigned but never read (dead code)
- Duplicated logic that should be extracted (DRY violations — reference existing file:line)
- Magic numbers/strings used in multiple places — should be named constants
- Comments/docstrings that describe old behavior after the code changed

#### Performance Concerns
- `fs.readFile`/`fs.writeFile` instead of `Bun.file()`/`Bun.write()` (Bun-native is faster)
- Synchronous file operations on hot paths — should be async
- Unbounded arrays/maps that grow without limit — needs a cap or LRU
- Module-level imports that could be lazy-loaded to improve startup time

#### Test Gaps
- New codepaths without corresponding test coverage
- Tests that assert on type/status but not side effects (file written? event emitted? state changed?)
- Missing negative-path tests (what happens when the operation fails?)
- Flaky test indicators: depends on timing, external services, file system ordering

#### Bun/TypeScript Patterns
- Using Node.js APIs when Bun equivalents exist and are faster
- Missing `using` for resource cleanup (Bun supports TC39 explicit resource management)
- Namespace pattern violations — IronCode uses `export namespace X { }` for module organization

---

## Step 5: Output findings

**Output format:**

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocking):
- [file:line] Problem description
  Fix: suggested fix

**INFORMATIONAL** (non-blocking):
- [file:line] Problem description
  Fix: suggested fix
```

If no issues found: `Pre-Landing Review: No issues found.`

**Always output ALL findings** — both critical and informational. The user must see every issue.

- If CRITICAL issues found: output all findings, then for EACH critical issue use a separate `question` tool call with the problem, your recommended fix, and options (A: Fix it now, B: Acknowledge and ship anyway, C: False positive — skip).
  After all critical questions are answered, output a summary of what the user chose for each issue. If the user chose A (fix) on any issue, apply the recommended fixes. If only B/C were chosen, no action needed.
- If only non-critical issues found: output findings. No further action needed.
- If no issues found: output `Pre-Landing Review: No issues found.`

---

## Step 6: TODOS cross-reference

Read `TODOS.md` in the repository root (if it exists). Cross-reference the PR against open TODOs:

- **Does this PR close any open TODOs?** If yes, note which items in your output: "This PR addresses TODO: <title>"
- **Does this PR create work that should become a TODO?** If yes, flag it as an informational finding.
- **Are there related TODOs that provide context for this review?** If yes, reference them when discussing related findings.

If TODOS.md doesn't exist, skip this step silently.

---

## Suppressions — DO NOT flag these

- "X is redundant with Y" when the redundancy is harmless and aids readability
- "Add a comment explaining why this threshold/constant was chosen" — thresholds change during tuning, comments rot
- "This assertion could be tighter" when the assertion already covers the behavior
- Suggesting consistency-only changes (wrapping a value in a conditional to match another pattern)
- "Regex doesn't handle edge case X" when the input is constrained and X never occurs in practice
- "Test exercises multiple guards simultaneously" — that's fine, tests don't need to isolate every guard
- Harmless no-ops (e.g., `.filter()` on an element that's never in the array)
- ANYTHING already addressed in the diff you're reviewing — read the FULL diff before commenting

## Important Rules

- **Read the FULL diff before commenting.** Do not flag issues already addressed in the diff.
- **Read-only by default.** Only modify files if the user explicitly chooses "Fix it now" on a critical issue.
- **Be terse.** One line problem, one line fix. No preamble.
- **Only flag real problems.** Skip anything that's fine.

## Gate Classification

```
CRITICAL (blocks shipping):          INFORMATIONAL (in review body):
├─ Type Safety & Data Validation     ├─ Error Handling Patterns
├─ Injection & Command Safety        ├─ Code Quality
├─ Concurrency & Race Conditions     ├─ Performance Concerns
└─ LLM Output Trust Boundary         ├─ Test Gaps
                                     └─ Bun/TypeScript Patterns
```
