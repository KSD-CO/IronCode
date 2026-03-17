---
name: verify
description: |
  Verification before completion. Use before claiming work is done, tests pass,
  bugs are fixed, or builds succeed. Requires running the actual verification
  command and reading the output before making any success claim. Evidence before
  assertions, always.
---

# /verify: Verification Before Completion

You are running the `/verify` workflow. No completion claims without fresh evidence. Run the command, read the output, then — and only then — state the result.

---

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command **in this response**, you cannot claim it passes.

---

## The Gate

Before claiming ANY status or expressing ANY satisfaction:

```
1. IDENTIFY  →  What command proves this claim?
2. RUN       →  Execute the FULL command (fresh, right now)
3. READ      →  Full output — check exit code, count failures
4. VERIFY    →  Does output actually confirm the claim?
                 ├── NO  →  State actual status with evidence
                 └── YES →  State claim WITH evidence
5. ONLY THEN →  Make the claim
```

Skip any step = making an unverified claim.

---

## What Requires Verification

| Claim | Must Run | NOT Sufficient |
|-------|----------|---------------|
| "Tests pass" | Test command output showing 0 failures | Previous run, "should pass", "I'm confident" |
| "Linter clean" | Linter output showing 0 errors | Partial check, extrapolation |
| "Build succeeds" | Build command with exit 0 | "Linter passed so build should too" |
| "Bug fixed" | Reproduce original symptom — now passes | "Code changed, should be fixed" |
| "Regression test works" | RED-GREEN cycle verified | Test passes once without seeing it fail first |
| "No type errors" | `bun check` or `tsc --noEmit` output | "I didn't add any types that could break" |
| "Requirements met" | Line-by-line checklist against spec | "Tests pass" |
| "Ready to ship" | All of the above | Any subset |

---

## Patterns

### Tests

```
✅  $ bun test
   34/34 pass
   "All tests pass."

❌  "Should pass now"
❌  "Looks correct"
❌  "Tests were passing earlier"
```

### Bug fix (TDD Red-Green)

```
✅  Write test → Run (FAIL) → Fix → Run (PASS) → Revert fix → Run (MUST FAIL) → Restore → Run (PASS)
    "Bug fix verified with red-green cycle."

❌  "I've written a regression test" (without running it)
❌  "Fixed the bug" (without reproducing it first)
```

### Build

```
✅  $ bun build
   exit code: 0
   "Build passes."

❌  "Linter passed so it should build"
❌  "No errors in the code I wrote"
```

### Requirements

```
✅  Re-read spec → Create checklist → Verify each item → Report gaps or completion
    "All 7 requirements met. Checklist: [...]"

❌  "Tests pass, must be complete"
❌  "I implemented everything you asked for"
```

---

## Red Flags — STOP and Verify

If you catch yourself about to say any of these, **STOP** and run the actual command:

- "Should work now"
- "Looks correct"
- "I'm confident this is right"
- "Great, that should fix it!"
- "Done!"
- "Perfect!"
- "Tests were passing before my change"
- "Just this once, I'll skip the check"
- "It's a minor change, can't break anything"

**All of these are unverified claims.** Run the command. Read the output. Then talk.

---

## Common Rationalizations — All Invalid

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification command |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler ≠ tests |
| "It's a trivial change" | Trivial changes cause production outages |
| "I'm tired, let's wrap up" | Exhaustion ≠ excuse. Run the command. |
| "Partial check is enough" | Partial proves nothing about the whole |

---

## Integration With Other Skills

- **After `/tdd`:** Verify the full test suite passes, not just the test you wrote.
- **After `/debug`:** Verify the original bug is actually fixed AND no other tests broke.
- **Before `/code-ship`:** Verify build, tests, and linter all pass. Ship should never be the first time you check.
- **After `/code-review`:** If you fixed critical issues, verify each fix individually.

---

## Important Rules

1. **Fresh evidence only.** A test run from 10 minutes ago is not verification. Run it again.
2. **Full output.** Don't grep for "pass" — read the complete output including warnings.
3. **Exit codes matter.** A command that prints "success" but exits with code 1 is not success.
4. **No compound claims.** "Tests pass and build works" requires running BOTH commands, not just one.
5. **Verify the negative.** For bug fixes, confirm the bug test fails WITHOUT the fix, then passes WITH it.
6. **State evidence with claims.** Don't just say "tests pass" — say "34/34 tests pass, 0 failures, exit code 0."
