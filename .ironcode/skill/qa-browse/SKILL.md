---
name: qa-browse
description: |-
  Systematic QA testing with browser automation for IronCode. Uses Playwright to navigate, interact, screenshot, and verify. Analyzes git diff to find affected routes, tests them end-to-end. Four modes: diff-aware, full, quick, regression.
---

# /qa-browse: Systematic QA Testing

You are a QA engineer. Test web applications like a real user — click everything, fill every form, check every state. Produce a structured report with evidence.

---

## Setup

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | diff-aware (on feature branch) | `--full`, `--quick`, `--regression baseline.json` |
| Scope | Diff-scoped or full app | `Focus on the billing page` |
| Auth | none | `--login` (human-in-the-loop), `--auth auth.json` (reuse saved session) |

**Ensure Playwright is available:**

Write a small test script using Playwright's Bun-compatible API. If Playwright is not installed:
1. Tell the user: "Playwright not found. Run: `bun add -d playwright && bunx playwright install chromium`"
2. STOP and wait.

**Create output directories:**

```bash
REPORT_DIR=".ironcode/qa-reports"
mkdir -p "$REPORT_DIR/screenshots"
```

---

## Authentication (Human-in-the-Loop)

When the app requires login, handle auth BEFORE starting any tests.

### Check for saved session

Always check first:
```bash
ls .ironcode/qa-reports/auth.json 2>/dev/null
```

- If `auth.json` exists → ask the user: "Found saved session from previous run. Use it? (yes / no — login again)"
- If not found, or user says no → run the login flow below.

### Login flow (`--login` or when auth.json not found)

Write and run this Bun script to open a headed browser for manual login:

```typescript
// .ironcode/qa-reports/qa-login.ts
import { chromium } from "playwright"

const AUTH_FILE = ".ironcode/qa-reports/auth.json"
const TARGET_URL = process.argv[2] || "http://localhost:3000"

const browser = await chromium.launch({
  headless: false,
  args: ["--start-maximized"],
})
const context = await browser.newContext({ viewport: null })
const page = await context.newPage()

// Inject a floating "Done" button on every page navigation
await context.addInitScript(() => {
  const btn = document.createElement("button")
  btn.id = "__qa_done_btn__"
  btn.innerText = "✅ Done — Save Session"
  btn.style.cssText = [
    "position:fixed", "bottom:24px", "right:24px", "z-index:999999",
    "padding:12px 20px", "background:#16a34a", "color:#fff",
    "font-size:15px", "font-weight:bold", "border:none",
    "border-radius:8px", "cursor:pointer", "box-shadow:0 4px 12px rgba(0,0,0,0.3)",
  ].join(";")
  btn.onclick = () => { (window as any).__qa_done__ = true }
  document.body?.appendChild(btn)
  // retry if body not ready yet
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(btn))
  }
})

await page.goto(TARGET_URL)

console.log("Browser opened. Log in, then click the green '✅ Done — Save Session' button.")

// Wait for user to click the Done button (up to 10 minutes)
await page.waitForFunction(() => (window as any).__qa_done__ === true, { timeout: 600000, polling: 500 })

await context.storageState({ path: AUTH_FILE })
console.log(`Session saved to ${AUTH_FILE}`)
await browser.close()
```

Run it:
```bash
bun run .ironcode/qa-reports/qa-login.ts <TARGET_URL>
```

Tell the user: **"Browser opened — log in, then click the green '✅ Done — Save Session' button in the bottom-right corner."**

Wait for the script to finish before proceeding.

### Using saved session in tests

In all subsequent Playwright scripts, load the saved session:

```typescript
import { chromium } from "playwright"

const AUTH_FILE = ".ironcode/qa-reports/auth.json"
const fs = await import("fs")

const contextOptions = fs.existsSync(AUTH_FILE)
  ? { storageState: AUTH_FILE }
  : {}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext(contextOptions)
const page = await context.newPage()
// ... rest of test
```

### Session expiry

If during testing a page redirects to login, the session has expired:
1. Delete the old session: `rm .ironcode/qa-reports/auth.json`
2. Re-run the login flow above
3. Resume testing

---

**Helper approach — write inline Bun scripts:**

For each test action, write and execute a short Bun script that uses Playwright. Example pattern:

```typescript
// qa-action.ts (written to .ironcode/qa-reports/qa-action.ts, then run with `bun run`)
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()
await page.goto("http://localhost:3000")
await page.screenshot({ path: ".ironcode/qa-reports/screenshots/home.png", fullPage: true })
const errors: string[] = []
page.on("pageerror", (err) => errors.push(err.message))
// ... interactions ...
console.log(JSON.stringify({ title: await page.title(), url: page.url(), errors }))
await browser.close()
```

This gives you full control: navigation, clicks, fills, screenshots, console error capture, network monitoring — all via Playwright's native API.

---

## Modes

### Diff-aware (automatic on feature branches)

This is the primary mode. When the user says `/qa-browse` without a URL and the repo is on a feature branch:

1. **Analyze the branch diff:**
   ```bash
   git diff dev...HEAD --name-only
   git log dev..HEAD --oneline
   ```

2. **Map changed files → affected routes:**
   - `src/server/routes/*.ts` → API endpoints to test
   - `packages/app/src/pages/**` → web UI pages to visit
   - `packages/app/src/components/**` → find which pages use them
   - `packages/ironcode/src/cli/**` → CLI changes (skip browser test, note in report)

3. **Detect the running app:**
   Write a quick Playwright script that tries `http://localhost:3000`, `:4321`, `:8080` in sequence.
   If nothing found, suggest: "Start the dev server with `bun dev` and try again."

4. **Test each affected route** — navigate, interact, screenshot, check console.

5. **Report findings** scoped to the branch changes.

### Full (default when URL is provided)

Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Produce health score. Takes 5-15 minutes.

### Quick (`--quick`)

30-second smoke test. Homepage + top 5 navigation targets. Check: loads? Console errors? Broken links?

### Regression (`--regression <baseline>`)

Run full mode, then load `baseline.json` from a previous run. Diff: which issues are fixed? Which are new? Score delta?

---

## Workflow

### Phase 1: Initialize

1. Verify Playwright installed
2. Create output directories
3. Start timer

### Phase 2: Orient

Write and run a Playwright script that:
- Navigates to target URL
- Takes a full-page screenshot
- Extracts all links on the page
- Captures any console errors

### Phase 3: Explore

Visit pages systematically. For each page, write a Playwright script that:

1. `page.goto(url)` — navigate
2. `page.screenshot({ path, fullPage: true })` — capture visual state
3. Listen for `pageerror` events — JS errors
4. `page.locator('a').all()` — enumerate links
5. `page.locator('button, input, select, textarea').all()` — enumerate interactive elements

Per-page checklist:
1. **Visual scan** — screenshot for layout issues
2. **Interactive elements** — click buttons, links, controls. Do they work?
3. **Forms** — fill and submit. Test empty, invalid, edge cases
4. **Navigation** — all paths in and out
5. **States** — empty state, loading, error, overflow
6. **Console** — any new JS errors after interactions?

### Phase 4: Document issues

Document each issue **immediately when found** with evidence:

**Interactive bugs:**
```typescript
await page.screenshot({ path: "issue-001-before.png" })
await page.click("button#submit")
await page.screenshot({ path: "issue-001-after.png" })
```

**Form testing:**
```typescript
await page.fill("input[name='email']", "test@example.com")
await page.fill("input[name='password']", "short")
await page.click("button[type='submit']")
// Check for validation errors
const error = await page.locator(".error-message").textContent()
```

### Phase 5: Report

```
## QA Report: [branch-name or URL]

**Date:** YYYY-MM-DD
**Duration:** Nm Ns
**Mode:** diff-aware | full | quick | regression
**Routes tested:** N
**Screenshots:** N

### Health Score: N/100

### Top 3 Things to Fix
1. [CRITICAL] Description — screenshot link
2. [HIGH] Description — screenshot link
3. [MEDIUM] Description — screenshot link

### All Issues
| # | Severity | Page | Description | Evidence |
|---|----------|------|-------------|----------|
| 1 | CRITICAL | /page | What's broken | screenshot |

### Console Health
- Total errors across all pages: N
- Pages with errors: list

### Pages Tested
| Route | Status | Console | Notes |
|-------|--------|---------|-------|
| / | ✅ | 0 errors | Loads correctly |
```

---

## Health Score Rubric

| Category | Weight |
|----------|--------|
| Console errors | 15% |
| Broken links | 10% |
| Visual issues | 10% |
| Functional issues | 20% |
| UX issues | 15% |
| Performance | 10% |
| Content issues | 5% |
| Accessibility | 15% |

Each category starts at 100. Deduct per finding: Critical -25, High -15, Medium -8, Low -3.

---

## Playwright Patterns Cheat Sheet

| Action | Playwright code |
|--------|----------------|
| Navigate | `await page.goto(url)` |
| Screenshot | `await page.screenshot({ path, fullPage: true })` |
| Click | `await page.click("selector")` |
| Fill input | `await page.fill("selector", "value")` |
| Select dropdown | `await page.selectOption("selector", "value")` |
| Press key | `await page.keyboard.press("Enter")` |
| Get text | `await page.locator("selector").textContent()` |
| Get all links | `await page.locator("a[href]").evaluateAll(els => els.map(e => e.href))` |
| Check visible | `await page.locator("selector").isVisible()` |
| Wait for load | `await page.waitForLoadState("networkidle")` |
| Console errors | `page.on("pageerror", err => ...)` |
| Network monitor | `await page.on("response", res => ...)` |
| Execute JS | `await page.evaluate(() => document.title)` |
| Mobile viewport | `await page.setViewportSize({ width: 375, height: 812 })` |
| Tablet viewport | `await page.setViewportSize({ width: 768, height: 1024 })` |

---

## Important Rules

1. **Repro is everything.** Every issue needs at least one screenshot. No exceptions.
2. **Verify before documenting.** Retry once to confirm reproducibility.
3. **Check console after every interaction.** JS errors that don't surface visually are still bugs.
4. **Test like a user.** Use realistic data. Complete full workflows end-to-end.
5. **Depth over breadth.** 5 well-documented issues with evidence > 20 vague descriptions.
6. **Compare before/after screenshots.** Verify actions had the expected effect.
7. **Never read source code during QA.** Test as a user, not a developer.
8. **Write incrementally.** Append each issue to the report as found. Don't batch.
9. **Use headless Chromium.** Always `chromium.launch({ headless: true })` unless user asks for headed mode.