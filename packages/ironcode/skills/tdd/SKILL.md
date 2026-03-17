---
name: tdd
description: |
  Test-driven development. Use when implementing any feature, bugfix, or refactor.
  Enforces RED-GREEN-REFACTOR: write a failing test first, write minimal code to
  pass, refactor. Deletes code written before tests. No production code without a
  failing test first.
---

# /tdd: Test-Driven Development

You are running the `/tdd` workflow. Every line of production code must be justified by a failing test written first. No exceptions.

---

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? **Delete it. Start over.**

- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

**Violating the letter of this rule is violating the spirit of this rule.**

---

## The Cycle

Every unit of work follows RED → GREEN → REFACTOR. No skipping steps.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   RED ──→ Verify Fail ──→ GREEN ──→ Verify Pass     │
│                             │                       │
│                             ▼                       │
│                          REFACTOR ──→ Verify Pass   │
│                             │                       │
│                             ▼                       │
│                          Next test ──→ RED           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Step 1: RED — Write one failing test

Write one test that describes the behavior you want. Nothing else.

**Good test:**
```typescript
test("rejects empty email on signup", async () => {
  const result = await submitSignup({ email: "", password: "valid123" })
  expect(result.error).toBe("Email is required")
})
```

**Bad test:**
```typescript
test("signup works", async () => {
  const mock = jest.fn().mockResolvedValueOnce({ ok: true })
  await submitSignup(mock)
  expect(mock).toHaveBeenCalledTimes(1)
})
```

**Requirements for the RED step:**
- One behavior per test
- Clear name that describes the behavior — if the name has "and", split it
- Real code, not mocks (unless the dependency is truly external: network, DB, clock)
- Assert on outcomes, not on implementation details

---

## Step 2: Verify RED — Watch it fail

**MANDATORY. Never skip.**

Run the test and confirm:

1. It **fails** (not errors — a test that throws `ReferenceError: function not defined` is an error, not a proper failure)
2. The failure message matches your expectation (e.g., "expected 'Email is required', got undefined")
3. It fails **because the feature is missing**, not because of a typo or import error

```bash
bun test path/to/test.ts
```

**If the test passes immediately:** You're testing existing behavior. Rewrite the test so it tests something new.

**If the test errors instead of failing:** Fix the error (missing import, wrong path), re-run until it **fails correctly**.

---

## Step 3: GREEN — Write minimal code to pass

Write the **simplest** code that makes the test pass. Nothing more.

**Good:**
```typescript
function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required"
  return null
}
```

**Bad:**
```typescript
function validateEmail(email: string, options?: {
  allowPlus?: boolean
  checkMX?: boolean
  maxLength?: number
}): string | null {
  // YAGNI — you don't need this yet
}
```

**Rules for the GREEN step:**
- Don't add features the test doesn't require
- Don't refactor other code
- Don't "improve" anything beyond what the test demands
- If you're tempted to add something, write a test for it first

---

## Step 4: Verify GREEN — Watch it pass

**MANDATORY.**

```bash
bun test path/to/test.ts
```

Confirm:
- The new test passes
- **All** existing tests still pass
- No warnings or errors in output

**If the new test fails:** Fix the code, not the test.

**If other tests broke:** Fix them now. Don't move on with broken tests.

---

## Step 5: REFACTOR — Clean up

Only after GREEN. Improve the code without changing behavior:

- Remove duplication
- Improve names
- Extract helpers
- Simplify logic

**Run tests after every refactor change.** If any test fails, undo the refactor.

**Do NOT add behavior during refactor.** If you think of a new feature, write a test first (go back to RED).

---

## Step 6: Commit

After each RED-GREEN-REFACTOR cycle:

```bash
git add -A
git commit -m "feat: reject empty email on signup"
```

Small, atomic commits. Each commit should be a single behavior that passes all tests.

---

## Step 7: Repeat

Go back to RED with the next behavior.

---

## When to Use TDD

**Always:**
- New features
- Bug fixes (write a test that reproduces the bug first)
- Refactoring (ensure tests cover existing behavior before changing it)
- Behavior changes

**Exceptions (ask the user first):**
- Throwaway prototypes the user explicitly labels as disposable
- Generated code (codegen output)
- Pure configuration files

---

## Bug Fix Flow

When fixing a bug, TDD is especially valuable:

1. **RED:** Write a test that reproduces the bug exactly
2. **Verify RED:** Confirm the test fails with the same symptom as the bug
3. **GREEN:** Fix the bug with minimal code
4. **Verify GREEN:** Test passes, bug is gone
5. **REFACTOR:** Clean up if needed
6. **Commit:** The test is now a permanent regression guard

---

## Good Tests vs Bad Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | Tests one thing | Name has "and" — split it |
| **Clear name** | `rejects empty email` | `test1`, `it works` |
| **Shows intent** | Demonstrates the desired API | Asserts on internals |
| **Real code** | Calls the actual function | Mocks the thing being tested |
| **Outcome-based** | Checks return value, side effect | Checks mock call count |

---

## Common Rationalizations — All Invalid

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds. |
| "I'll write tests after" | Tests written after pass immediately. Passing immediately proves nothing. |
| "Tests after achieve the same goal" | Tests-after answer "what does this do?" Tests-first answer "what **should** this do?" — completely different. |
| "I already manually tested" | Manual testing is ad-hoc. No record, can't re-run, you'll forget cases. |
| "Deleting working code is wasteful" | Sunk cost fallacy. Code without tests is unverified — that's technical debt, not value. |
| "Need to explore first" | Fine. Throw away the exploration completely. Start fresh with TDD. |
| "Hard to test means the design is fine" | Hard to test = hard to use. Listen to the test — simplify the interface. |
| "TDD slows me down" | TDD is faster than debugging. You're trading 30 seconds of test-writing for hours of debugging. |
| "Just this once" | That's rationalization. No exceptions. |

---

## Red Flags — STOP and Start Over

If any of these happen, delete the production code and restart from RED:

- Wrote code before the test
- Test passes immediately on first run
- Can't explain why the test failed
- Added tests "later" to cover code already written
- Thinking "just this once, I'll skip the test"
- Kept code as "reference" while writing tests
- "It's about the spirit, not the ritual" — no. The ritual IS the spirit.

---

## Important Rules

1. **One test at a time.** Don't write 5 tests then implement. RED → GREEN → REFACTOR → commit → next RED.
2. **Tests are not optional.** Every new function, method, or behavior gets a test.
3. **Mocks are a last resort.** Only mock truly external dependencies (network, database, system clock). Never mock the code you're testing.
4. **Test names are documentation.** Someone reading only test names should understand what the module does.
5. **Keep tests fast.** If a test takes more than 2 seconds, it's probably testing too much.
6. **Delete code freely.** Code exists to pass tests. No test = no justification for that code.
