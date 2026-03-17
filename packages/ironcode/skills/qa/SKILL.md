---
name: qa
description: |
  Systematically QA test a web application using Playwright. Use when asked to "qa",
  "QA", "test this site", "find bugs", "dogfood", or review quality. Four modes:
  diff-aware (automatic on feature branches — analyzes git diff, identifies affected
  pages, tests them), full (systematic exploration), quick (30-second smoke test),
  regression (compare against baseline). Produces structured report with health score,
  screenshots, and repro steps.
---

# /qa: Systematic QA Testing

You are a QA engineer. Test web applications like a real user — click everything, fill every form, check every state. Produce a structured report with evidence.

## Setup

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | full | `--quick`, `--regression .ironcode/qa-reports/baseline.json` |
| Output dir | `.ironcode/qa-reports/` | `Output to /tmp/qa` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com`, `Import cookies from cookies.json` |

**If no URL is given and you're on a feature branch:** Automatically enter **diff-aware mode** (see Modes below). This is the most common case — the user just shipped code on a branch and wants to verify it works.

**Playwright setup:**

Use Playwright for all browser automation. Write and execute scripts using the Playwright API:

```typescript
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: "IronCode-QA/1.0",
})
const page = await context.newPage()
```

If Playwright is not installed, install it:
```bash
bunx playwright install chromium
```

**Create output directories:**

```bash
REPORT_DIR=".ironcode/qa-reports"
mkdir -p "$REPORT_DIR/screenshots"
```

---

## Modes

### Diff-aware (automatic when on a feature branch with no URL)

This is the **primary mode** for developers verifying their work. When the user says `/qa` without a URL and the repo is on a feature branch, automatically:

1. **Analyze the branch diff** to understand what changed:
   ```bash
   git diff dev...HEAD --name-only
   git log dev..HEAD --oneline
   ```

2. **Identify affected pages/routes** from the changed files:
   - Route/handler files → which URL paths they serve
   - Component/template files → which pages render them
   - Service/model files → which pages use those (check handlers that reference them)
   - CSS/style files → which pages include those stylesheets
   - API endpoints → test them directly with `page.evaluate(() => fetch('/api/...'))`
   - Static pages → navigate to them directly

3. **Detect the running app** — check common local dev ports:
   ```typescript
   for (const port of [3000, 4000, 5173, 8080]) {
     try {
       const resp = await page.goto(`http://localhost:${port}`, { timeout: 3000 })
       if (resp?.ok()) { console.log(`Found app on :${port}`); break }
     } catch {}
   }
   ```
   If no local app is found, check for a staging/preview URL in the PR or environment. If nothing works, ask the user for the URL.

4. **Test each affected page/route:**
   - Navigate to the page
   - Take a screenshot
   - Check console for errors
   - If the change was interactive (forms, buttons, flows), test the interaction end-to-end
   - Compare page state before and after actions

5. **Cross-reference with commit messages and PR description** to understand *intent* — what should the change do? Verify it actually does that.

6. **Check TODOS.md** (if it exists) for known bugs or issues related to the changed files. If a TODO describes a bug that this branch should fix, add it to your test plan. If you find a new bug during QA that isn't in TODOS.md, note it in the report.

7. **Report findings** scoped to the branch changes:
   - "Changes tested: N pages/routes affected by this branch"
   - For each: does it work? Screenshot evidence.
   - Any regressions on adjacent pages?

**If the user provides a URL with diff-aware mode:** Use that URL as the base but still scope testing to the changed files.

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Produce health score. Takes 5-15 minutes depending on app size.

### Quick (`--quick`)
30-second smoke test. Visit homepage + top 5 navigation targets. Check: page loads? Console errors? Broken links? Produce health score. No detailed issue documentation.

### Regression (`--regression <baseline>`)
Run full mode, then load `baseline.json` from a previous run. Diff: which issues are fixed? Which are new? What's the score delta? Append regression section to report.

---

## Workflow

### Phase 1: Initialize

1. Launch Playwright browser
2. Create output directories
3. Start timer for duration tracking
4. Set up console error listener:
   ```typescript
   const consoleErrors: string[] = []
   page.on("console", msg => {
     if (msg.type() === "error") consoleErrors.push(msg.text())
   })
   ```

### Phase 2: Authenticate (if needed)

**If the user specified auth credentials:**

```typescript
await page.goto(loginUrl)
await page.fill('input[type="email"], input[name="email"]', 'user@example.com')
await page.fill('input[type="password"]', '[REDACTED]')
await page.click('button[type="submit"]')
await page.waitForNavigation()
await page.screenshot({ path: `${reportDir}/screenshots/post-login.png` })
```

**If the user provided a cookie file:**

```typescript
const cookies = JSON.parse(await Bun.file("cookies.json").text())
await context.addCookies(cookies)
await page.goto(targetUrl)
```

**If 2FA/OTP is required:** Ask the user for the code and wait.

**If CAPTCHA blocks you:** Tell the user: "Please complete the CAPTCHA in the browser, then tell me to continue."

### Phase 3: Orient

Get a map of the application:

```typescript
await page.goto(targetUrl)
await page.screenshot({ path: `${reportDir}/screenshots/initial.png`, fullPage: true })

// Gather all links
const links = await page.$$eval('a[href]', els =>
  els.map(a => ({ text: a.textContent?.trim(), href: a.href }))
    .filter(l => l.href.startsWith(page.url().split('/').slice(0, 3).join('/')))
)

// Check for console errors on landing
console.log(`Console errors on landing: ${consoleErrors.length}`)
```

**Detect framework** (note in report metadata):
- `__next` in HTML or `_next/data` requests → Next.js
- `csrf-token` meta tag → Rails
- `wp-content` in URLs → WordPress
- Client-side routing with no page reloads → SPA
- `<script type="module">` with Vite → Vite SPA

**For SPAs:** Links may be sparse because navigation is client-side. Use Playwright to find nav elements (buttons, menu items) instead:
```typescript
const navItems = await page.$$eval(
  'nav a, nav button, [role="navigation"] a, [role="menuitem"]',
  els => els.map(el => ({ text: el.textContent?.trim(), tag: el.tagName }))
)
```

### Phase 4: Explore

Visit pages systematically. At each page:

```typescript
await page.goto(pageUrl)
await page.screenshot({ path: `${reportDir}/screenshots/${pageName}.png`, fullPage: true })
const pageErrors = consoleErrors.splice(0) // drain errors for this page
```

Then follow the **per-page exploration checklist:**

1. **Visual scan** — Look at the screenshot for layout issues, broken images, overflow
2. **Interactive elements** — Click buttons, links, controls. Do they work?
   ```typescript
   const buttons = await page.$$('button, [role="button"], input[type="submit"]')
   for (const btn of buttons) {
     const text = await btn.textContent()
     // Click and observe — does something happen?
   }
   ```
3. **Forms** — Fill and submit. Test empty, invalid, edge cases
   ```typescript
   // Fill form fields
   await page.fill('input[name="name"]', 'Test User')
   await page.fill('input[name="email"]', 'test@example.com')
   // Submit and check result
   await page.click('button[type="submit"]')
   await page.waitForTimeout(1000)
   await page.screenshot({ path: `${reportDir}/screenshots/${pageName}-submitted.png` })
   ```
4. **Navigation** — Check all paths in and out
5. **States** — Empty state, loading, error, overflow
6. **Console** — Any new JS errors after interactions?
7. **Responsiveness** — Check mobile viewport if relevant:
   ```typescript
   await page.setViewportSize({ width: 375, height: 812 })
   await page.screenshot({ path: `${reportDir}/screenshots/${pageName}-mobile.png` })
   await page.setViewportSize({ width: 1280, height: 720 })
   ```

**Depth judgment:** Spend more time on core features (homepage, dashboard, checkout, search) and less on secondary pages (about, terms, privacy).

**Quick mode:** Only visit homepage + top 5 navigation targets from the Orient phase. Skip the per-page checklist — just check: loads? Console errors? Broken links visible?

### Phase 5: Document

Document each issue **immediately when found** — don't batch them.

**Two evidence tiers:**

**Interactive bugs** (broken flows, dead buttons, form failures):
1. Take a screenshot before the action
2. Perform the action
3. Take a screenshot showing the result
4. Write repro steps referencing screenshots

```typescript
await page.screenshot({ path: `${reportDir}/screenshots/issue-001-before.png` })
await page.click('#submit-btn')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${reportDir}/screenshots/issue-001-after.png` })
```

**Static bugs** (typos, layout issues, missing images):
1. Take a single screenshot showing the problem
2. Describe what's wrong

**Write each issue to the report immediately** using the template format.

### Phase 6: Wrap Up

1. **Compute health score** using the rubric below
2. **Write "Top 3 Things to Fix"** — the 3 highest-severity issues
3. **Write console health summary** — aggregate all console errors seen across pages
4. **Update severity counts** in the summary table
5. **Fill in report metadata** — date, duration, pages visited, screenshot count, framework
6. **Close browser:**
   ```typescript
   await browser.close()
   ```
7. **Save baseline** — write `baseline.json` with:
   ```json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": 85,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": 100, "links": 85, "functional": 70 }
   }
   ```

**Regression mode:** After writing the report, load the baseline file. Compare:
- Health score delta
- Issues fixed (in baseline but not current)
- New issues (in current but not baseline)
- Append the regression section to the report

---

## Health Score Rubric

Compute each category score (0-100), then take the weighted average.

### Console (weight: 15%)
- 0 errors → 100
- 1-3 errors → 70
- 4-10 errors → 40
- 10+ errors → 10

### Links (weight: 10%)
- 0 broken → 100
- Each broken link → -15 (minimum 0)

### Per-Category Scoring (Visual, Functional, UX, Content, Performance, Accessibility)
Each category starts at 100. Deduct per finding:
- Critical issue → -25
- High issue → -15
- Medium issue → -8
- Low issue → -3
Minimum 0 per category.

### Weights
| Category | Weight |
|----------|--------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### Final Score
`score = Σ (category_score × weight)`

---

## Framework-Specific Guidance

### Next.js
- Check console for hydration errors (`Hydration failed`, `Text content did not match`)
- Monitor `_next/data` requests — 404s indicate broken data fetching:
  ```typescript
  page.on("response", resp => {
    if (resp.url().includes("_next/data") && resp.status() === 404)
      console.log(`Broken data fetch: ${resp.url()}`)
  })
  ```
- Test client-side navigation (click links, don't just `goto`) — catches routing issues
- Check for CLS (Cumulative Layout Shift) on pages with dynamic content

### Rails
- Check for N+1 query warnings in console (if development mode)
- Verify CSRF token presence in forms
- Test Turbo/Stimulus integration — do page transitions work smoothly?
- Check for flash messages appearing and dismissing correctly

### WordPress
- Check for plugin conflicts (JS errors from different plugins)
- Verify admin bar visibility for logged-in users
- Test REST API endpoints (`/wp-json/`)
- Check for mixed content warnings (common with WP)

### General SPA (React, Vue, Angular)
- Use Playwright element selectors for navigation — link enumeration misses client-side routes
- Check for stale state (navigate away and back — does data refresh?)
- Test browser back/forward — does the app handle history correctly?
  ```typescript
  await page.goBack()
  await page.waitForTimeout(500)
  // Is the previous page state correct?
  await page.goForward()
  ```
- Check for memory leaks (monitor console after extended use)

---

## Important Rules

1. **Repro is everything.** Every issue needs at least one screenshot. No exceptions.
2. **Verify before documenting.** Retry the issue once to confirm it's reproducible, not a fluke.
3. **Never include credentials.** Write `[REDACTED]` for passwords in repro steps.
4. **Write incrementally.** Append each issue to the report as you find it. Don't batch.
5. **Never read source code.** Test as a user, not a developer.
6. **Check console after every interaction.** JS errors that don't surface visually are still bugs.
7. **Test like a user.** Use realistic data. Walk through complete workflows end-to-end.
8. **Depth over breadth.** 5-10 well-documented issues with evidence > 20 vague descriptions.
9. **Never delete output files.** Screenshots and reports accumulate — that's intentional.
10. **Always close the browser.** Use `await browser.close()` in a finally block to avoid zombie processes.

---

## Output Structure

```
.ironcode/qa-reports/
├── qa-report-{domain}-{YYYY-MM-DD}.md    # Structured report
├── screenshots/
│   ├── initial.png                        # Landing page screenshot
│   ├── issue-001-before.png               # Per-issue evidence
│   ├── issue-001-after.png
│   └── ...
└── baseline.json                          # For regression mode
```

Report filenames use the domain and date: `qa-report-myapp-com-2026-03-12.md`
