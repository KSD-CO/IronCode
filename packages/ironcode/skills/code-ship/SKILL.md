---
name: code-ship
description: |
  Ship workflow: merge dev, run tests + typecheck, review diff, update CHANGELOG,
  commit bisectable chunks, push, create PR. Fully automated — user says /code-ship
  and the next thing they see is the PR URL.
---

# Ship: Fully Automated Ship Workflow

You are running the `/code-ship` workflow. This is a **non-interactive, fully automated** workflow. Do NOT ask for confirmation at any step. The user said `/code-ship` which means DO IT. Run straight through and output the PR URL at the end.

**Only stop for:**
- On `dev` branch (abort)
- Merge conflicts that can't be auto-resolved (stop, show conflicts)
- Test failures (stop, show failures)
- Typecheck failures (stop, show errors)
- Pre-landing review finds CRITICAL issues and user chooses to fix (not acknowledge or skip)
- TODOS.md missing and user wants to create one (ask — see Step 5.5)
- TODOS.md disorganized and user wants to reorganize (ask — see Step 5.5)

**Never stop for:**
- Uncommitted changes (always include them)
- CHANGELOG content (auto-generate from diff)
- Commit message approval (auto-commit)
- Multi-file changesets (auto-split into bisectable commits)
- TODOS.md completed-item detection (auto-mark)

---

## Step 1: Pre-flight

1. Check the current branch. If on `dev`, **abort**: "You're on dev. Ship from a feature branch."

2. Run `git status`. Uncommitted changes are always included — no need to ask.

3. Run `git diff dev...HEAD --stat` and `git log dev..HEAD --oneline` to understand what's being shipped.

---

## Step 2: Merge origin/dev (BEFORE tests)

Fetch and merge `origin/dev` into the feature branch so tests run against the merged state:

```bash
git fetch origin dev && git merge origin/dev --no-edit
```

**If there are merge conflicts:** Try to auto-resolve if they are simple (CHANGELOG ordering, lock files). If conflicts are complex or ambiguous, **STOP** and show them.

**If already up to date:** Continue silently.

---

## Step 3: Run tests and typecheck (on merged code)

Run tests and typecheck:

```bash
cd packages/ironcode && bun test 2>&1 | tee /tmp/ship_tests.txt
```

Then run typecheck:

```bash
cd packages/ironcode && bun run typecheck 2>&1 | tee /tmp/ship_typecheck.txt
```

After both complete, read the output files and check pass/fail.

**If any test fails or typecheck has errors:** Show the failures and **STOP**. Do not proceed.

**If all pass:** Continue silently — just note the counts briefly.

---

## Step 3.5: Pre-Landing Review

Review the diff for structural issues that tests don't catch.

1. Run the `/code-review` workflow mentally — apply the two-pass checklist against the diff:
   - **Pass 1 (CRITICAL):** Type Safety & Data Validation, Injection & Command Safety, Concurrency & Race Conditions, LLM Output Trust Boundary
   - **Pass 2 (INFORMATIONAL):** Error Handling Patterns, Code Quality, Performance Concerns, Test Gaps, Bun/TypeScript Patterns

2. Run `git diff origin/dev` to get the full diff (scoped to feature changes against the freshly-fetched remote dev).

3. **Always output ALL findings** — both critical and informational. The user must see every issue found.

4. Output a summary header: `Pre-Landing Review: N issues (X critical, Y informational)`

5. **If CRITICAL issues found:** For EACH critical issue, use a separate `question` tool call with:
   - The problem (`file:line` + description)
   - Your recommended fix
   - Options: A) Fix it now (recommend), B) Acknowledge and ship anyway, C) It's a false positive — skip
   After resolving all critical issues: if the user chose A (fix) on any issue, apply the recommended fixes, then commit only the fixed files by name (`git add <fixed-files> && git commit -m "fix: apply pre-landing review fixes"`), then **STOP** and tell the user to run `/code-ship` again to re-test with the fixes applied. If the user chose only B (acknowledge) or C (false positive) on all issues, continue with Step 4.

6. **If only non-critical issues found:** Output them and continue. They will be included in the PR body at Step 7.

7. **If no issues found:** Output `Pre-Landing Review: No issues found.` and continue.

Save the review output — it goes into the PR body in Step 7.

---

## Step 4: CHANGELOG (auto-generate)

1. Read `CHANGELOG.md` header to know the format.

2. Auto-generate the entry from **ALL commits on the branch** (not just recent ones):
   - Use `git log dev..HEAD --oneline` to see every commit being shipped
   - Use `git diff dev...HEAD` to see the full diff against dev
   - The CHANGELOG entry must be comprehensive of ALL changes going into the PR
   - If existing CHANGELOG entries on the branch already cover some commits, replace them with one unified entry for the new version
   - Categorize changes into applicable sections:
     - `### Added` — new features
     - `### Changed` — changes to existing functionality
     - `### Fixed` — bug fixes
     - `### Removed` — removed features
   - Write concise, descriptive bullet points
   - Insert after the file header, dated today
   - Format: `## [Unreleased] - YYYY-MM-DD`

**Do NOT ask the user to describe changes.** Infer from the diff and commit history.

---

## Step 5: Format check

Run the formatter to ensure code style is consistent:

```bash
cd packages/ironcode && bun run format 2>&1 || true
```

If any files were modified by the formatter, include them in the next commit.

---

## Step 5.5: TODOS.md (auto-update)

Cross-reference the project's TODOS.md against the changes being shipped. Mark completed items automatically; prompt only if the file is missing or disorganized.

**1. Check if TODOS.md exists** in the repository root.

**If TODOS.md does not exist:** Use the `question` tool:
- Message: "IronCode recommends maintaining a TODOS.md organized by component, then priority (P0 at top through P4, then Completed at bottom). Would you like to create one?"
- Options: A) Create it now, B) Skip for now
- If A: Create `TODOS.md` with a skeleton (# TODOS heading + ## Completed section). Continue to step 3.
- If B: Skip the rest of Step 5.5. Continue to Step 6.

**2. Check structure and organization:**

Read TODOS.md and verify it follows the recommended structure:
- Items grouped under `## <Component>` headings
- Each item has `**Priority:**` field with P0-P4 value
- A `## Completed` section at the bottom

**If disorganized** (missing priority fields, no component groupings, no Completed section): Use the `question` tool:
- Message: "TODOS.md doesn't follow the recommended structure (component groupings, P0-P4 priority, Completed section). Would you like to reorganize it?"
- Options: A) Reorganize now (recommended), B) Leave as-is
- If A: Reorganize in-place. Preserve all content — only restructure, never delete items.
- If B: Continue to step 3 without restructuring.

**3. Detect completed TODOs:**

This step is fully automatic — no user interaction.

Use the diff and commit history already gathered in earlier steps:
- `git diff dev...HEAD` (full diff against dev)
- `git log dev..HEAD --oneline` (all commits being shipped)

For each TODO item, check if the changes in this PR complete it by:
- Matching commit messages against the TODO title and description
- Checking if files referenced in the TODO appear in the diff
- Checking if the TODO's described work matches the functional changes

**Be conservative:** Only mark a TODO as completed if there is clear evidence in the diff. If uncertain, leave it alone.

**4. Move completed items** to the `## Completed` section at the bottom. Append: `**Completed:** YYYY-MM-DD`

**5. Output summary:**
- `TODOS.md: N items marked complete (item1, item2, ...). M items remaining.`
- Or: `TODOS.md: No completed items detected. M items remaining.`
- Or: `TODOS.md: Created.` / `TODOS.md: Reorganized.`

**6. Defensive:** If TODOS.md cannot be written (permission error, disk full), warn the user and continue. Never stop the ship workflow for a TODOS failure.

Save this summary — it goes into the PR body in Step 7.

---

## Step 6: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect` and help reviewers understand what changed.

1. Analyze the diff and group changes into logical commits. Each commit should represent **one coherent change** — not one file, but one logical unit.

2. **Commit ordering** (earlier commits first):
   - **Infrastructure:** config changes, schema additions, new dependencies
   - **Core logic:** new modules, services, types (with their tests)
   - **Integration:** commands, routes, UI components (with their tests)
   - **CHANGELOG + TODOS.md:** always in the final commit

3. **Rules for splitting:**
   - A module and its test file go in the same commit
   - A service and its test file go in the same commit
   - A command, its handler, and its test go in the same commit
   - Config/schema changes can group with the feature they enable
   - If the total diff is small (< 50 lines across < 4 files), a single commit is fine

4. **Each commit must be independently valid** — no broken imports, no references to code that doesn't exist yet. Order commits so dependencies come first.

5. Compose each commit message:
   - First line: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - Body: brief description of what this commit contains
   - Only the **final commit** (CHANGELOG) gets the co-author trailer:

```bash
git commit -m "$(cat <<'EOF'
chore: update changelog

Co-Authored-By: IronCode AI <noreply@ironcode.cloud>
EOF
)"
```

---

## Step 7: Push and create PR

Push to the remote with upstream tracking:

```bash
git push -u origin <branch-name>
```

Create a pull request using `gh`:

```bash
gh pr create --base dev --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Pre-Landing Review
<findings from Step 3.5, or "No issues found.">

## Tests
- [x] All tests pass (`bun test` — N tests)
- [x] Typecheck passes (`bun run typecheck`)

## TODOS
<If items marked complete: bullet list of completed items>
<If no items completed: "No TODO items completed in this PR.">
<If TODOS.md created or reorganized: note that>
<If TODOS.md doesn't exist and user skipped: omit this section>

🤖 Generated with [IronCode](https://ironcode.cloud)
EOF
)"
```

**Output the PR URL** — this should be the final output the user sees.

---

## Important Rules

- **Never skip tests.** If tests fail, stop.
- **Never skip typecheck.** If typecheck fails, stop.
- **Never skip the pre-landing review.** Always run the two-pass checklist.
- **Never force push.** Use regular `git push` only.
- **Never ask for confirmation** except for CRITICAL review findings (one question per critical issue with fix recommendation).
- **Date format in CHANGELOG:** `YYYY-MM-DD`
- **Split commits for bisectability** — each commit = one logical change.
- **TODOS.md completion detection must be conservative.** Only mark items as completed when the diff clearly shows the work is done.
- **PR base branch is always `dev`.** Never target `main` directly.
- **The goal is: user says `/code-ship`, next thing they see is the review + PR URL.**
