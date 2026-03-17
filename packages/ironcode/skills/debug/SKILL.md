---
name: debug
description: |
  Systematic debugging. Use when encountering any bug, test failure, or unexpected
  behavior — before proposing fixes. Four phases: root cause investigation, pattern
  analysis, hypothesis testing, implementation. No fixes without root cause first.
  Use especially when under pressure or after multiple failed fix attempts.
---

# /debug: Systematic Debugging

You are running the `/debug` workflow. Find the root cause before attempting any fix. Random fixes waste time and create new bugs.

---

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you **cannot** propose fixes. Period.

---

## The Four Phases

```
Phase 1: ROOT CAUSE ──→ Phase 2: PATTERN ──→ Phase 3: HYPOTHESIS ──→ Phase 4: FIX
     │                       │                      │                      │
     │ Understand WHAT        │ Find WORKING          │ Test ONE thing        │ Write test,
     │ and WHY                │ example to compare    │ at a time             │ fix, verify
     │                       │                      │                      │
     └── Skip? STOP.         └── Skip? Guessing.    └── Multiple? STOP.    └── 3 fails? Rethink.
```

Complete each phase before moving to the next. No shortcuts.

---

## Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

### 1. Read error messages carefully

- Read the **full** stack trace — don't skip
- Note line numbers, file paths, error codes
- Error messages often contain the exact solution
- Don't stop at the first line — the root cause is usually deeper in the trace

### 2. Reproduce consistently

- Can you trigger it reliably? What are the exact steps?
- Does it happen every time? If intermittent, gather more data — don't guess
- Write down the reproduction steps (you'll need them for the test later)

### 3. Check recent changes

```bash
git log --oneline -20
git diff HEAD~5
```

- What changed recently that could cause this?
- New dependencies? Config changes? Environment differences?

### 4. Gather evidence at boundaries

**For multi-component systems** (API → service → database, CLI → server → browser):

Before proposing fixes, add diagnostic logging at each component boundary:

```bash
# At each layer boundary, log what goes in and what comes out
echo "=== Input to layer: ==="
echo "=== Output from layer: ==="
echo "=== Environment state: ==="
```

Run once to gather evidence showing **WHERE** it breaks. Then investigate that specific component.

### 5. Trace data flow

- Where does the bad value originate?
- What called this function with the bad input?
- Keep tracing backwards until you find the **source**, not the **symptom**
- Fix at the source, not where it manifests

---

## Phase 2: Pattern Analysis

### 1. Find working examples

- Locate similar **working** code in the same codebase
- What works that's similar to what's broken?

### 2. Compare against references

- If implementing a pattern, read the reference implementation **completely** — don't skim
- Understand the pattern fully before applying it

### 3. Identify differences

- What's different between working and broken?
- List **every** difference, however small
- Don't assume "that can't matter" — small differences cause bugs

### 4. Understand dependencies

- What other components does this need?
- What settings, config, environment does it assume?
- What version constraints exist?

---

## Phase 3: Hypothesis and Testing

### 1. Form a single hypothesis

State clearly: **"I think X is the root cause because Y"**

Write it down. Be specific, not vague.

- ❌ "Something is wrong with the config"
- ✅ "The `DATABASE_URL` env var is missing the port number because the .env parser strips colons after the third one"

### 2. Test minimally

Make the **SMALLEST** possible change to test your hypothesis:

- One variable at a time
- Don't fix multiple things at once
- If it doesn't work, you need to know exactly which change failed

### 3. Verify before continuing

- **Hypothesis confirmed?** → Go to Phase 4
- **Hypothesis wrong?** → Form a NEW hypothesis based on what you just learned
- **Don't** add more fixes on top of a failed attempt

### 4. When you don't know

- Say "I don't understand X" — don't pretend
- Ask the user for more context
- Research before guessing

---

## Phase 4: Implementation

### 1. Write a failing test

Before fixing the bug, write a test that **reproduces it**:

```typescript
test("handles missing port in DATABASE_URL", () => {
  const url = "postgres://user:pass@host/db" // no port
  expect(() => parseDbUrl(url)).not.toThrow()
  expect(parseDbUrl(url).port).toBe(5432) // should default
})
```

Run the test. Confirm it fails for the same reason as the bug.

This follows the `/tdd` workflow — RED first.

### 2. Implement a single fix

- Address the **root cause** you identified
- ONE change at a time
- No "while I'm here" improvements
- No bundled refactoring

### 3. Verify the fix

- Test passes now?
- No other tests broken?
- Original issue actually resolved (not just the test)?

### 4. If the fix doesn't work — count your attempts

- **< 3 failed fixes:** Return to Phase 1. Re-analyze with the new information you gained.
- **≥ 3 failed fixes:** **STOP.** You likely have an architectural problem, not a bug.

---

## The 3-Fix Rule

If you've tried 3+ fixes and none worked, **stop fixing and start questioning:**

**Signals of an architectural problem:**
- Each fix reveals new coupling in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere
- You're fighting the design, not a bug

**What to do:**
1. Stop all fix attempts
2. Ask the user: "I've tried 3 approaches and each revealed deeper issues. This may be an architectural problem, not a bug. Should we step back and rethink the design?"
3. Use a `question` tool call with options:
   - A) Step back — let's rethink the approach
   - B) Try one more targeted fix (explain what's different this time)
   - C) Ship it with a known limitation and track in TODOS.md

---

## Red Flags — STOP and Return to Phase 1

If you catch yourself thinking any of these, **STOP immediately**:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems:" (listing fixes without investigation)
- Proposing solutions before tracing data flow

**All of these mean: STOP. Go back to Phase 1.**

---

## Common Rationalizations — All Invalid

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need the process" | Simple issues have root causes too. The process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is **faster** than guess-and-check thrashing. |
| "Just try this first, then investigate" | The first fix sets the pattern. Do it right from the start. |
| "I'll write the test after confirming the fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Often introduces new bugs. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = likely architectural. Stop and rethink. |

---

## Quick Reference

| Phase | Key Activity | Success Criteria |
|-------|-------------|-----------------|
| **1. Root Cause** | Read errors, reproduce, check changes, trace data flow | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare differences | Identified what's different |
| **3. Hypothesis** | Form theory, test one change | Confirmed or formed new hypothesis |
| **4. Implementation** | Write failing test, fix, verify | Bug resolved, all tests pass |

---

## Important Rules

1. **Evidence before action.** Don't propose fixes until you understand the root cause.
2. **One change at a time.** Never test multiple hypotheses simultaneously.
3. **Write the test first.** Every bug fix starts with a test that reproduces the bug (see `/tdd`).
4. **Count your attempts.** After 3 failed fixes, escalate — it's probably architectural.
5. **Trace backwards.** Fix at the source, not where the symptom appears.
6. **Say "I don't know."** Pretending to understand wastes more time than admitting confusion.
