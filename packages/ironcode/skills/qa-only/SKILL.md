---
name: qa-only
version: 1.0.0
description: |
  Report-only QA testing. Systematically tests a web application and produces a
  structured report with health score, screenshots, and repro steps — but never
  fixes anything. Use when asked to "just report bugs", "qa report only", or
  "test but don't fix". For the full test-fix-verify loop, use /qa instead.
allowed-tools:
  - bash
  - read
  - write
  - question
---

# /qa-only: Report-Only QA Testing

You are a QA engineer. Test web applications like a real user — click everything, fill every form, check every state. Produce a structured report with evidence. **NEVER fix anything.**

## User-invocable
When the user types `/qa-only`, run this skill.

## Arguments
- `/qa-only <url>` — test URL in full mode
- `/qa-only` — diff-aware mode (automatic on feature branches)
- `/qa-only <url> --quick` — 30-second smoke test
- `/qa-only <url> --regression <baseline>` — compare against baseline

## Setup

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | full | `--quick`, `--regression .ironcode/qa-reports/baseline.json` |
| Output dir | `.ironcode/qa-reports/` | `Output to /tmp/qa` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com`, `Import cookies from cookies.json` |

**If no URL is given and you're on a feature branch:** Automatically enter **diff-aware mode**.

**Playwright setup:**

Use Playwright for all browser automation:
```typescript
import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: "IronCode-QA/1.0",
})
const page = await context.newPage()
```

If Playwright is not installed:
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

When the user says `/qa-only` without a URL and the repo is on a feature branch:

1. **Analyze the branch diff:**
   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
   git diff "$DEFAULT_BRANCH"...HEAD --name-only
   git log "$DEFAULT_BRANCH"..HEAD --oneline
   ```

2. **Identify affected pages/routes** from the changed files:
   - Route/handler files → which URL paths they serve
   - Component/template files → which pages render them
   - Service/model files → which pages use those
   - API endpoints → test them directly
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
   If no local app found, ask the user for the URL.

4. **Test each affected page/route** — navigate, screenshot, check console, test interactions.

5. **Cross-reference with commit messages** to understand intent — verify the change does what it should.

6. **Report findings** scoped to the branch changes.

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Produce health score. Takes 5-15 minutes.

### Quick (`--quick`)
30-second smoke test. Homepage + top 5 navigation targets. Loads? Console errors? Broken links? Health score.

### Regression (`--regression <baseline>`)
Run full mode, then diff against baseline: issues fixed, new issues, score delta.

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
await page.fill('input[type="email"]', 'user@example.com')
await page.fill('input[type="password"]', '[REDACTED]')
await page.click('button[type="submit"]')
await page.waitForNavigation()
```

**If the user provided a cookie file:**
```typescript
const cookies = JSON.parse(await Bun.file("cookies.json").text())
await context.addCookies(cookies)
```

**If 2FA/OTP is required:** Ask the user for the code.
**If CAPTCHA blocks you:** Tell the user to complete it manually.

### Phase 3: Orient

```typescript
await page.goto(targetUrl)
await page.screenshot({ path: `${reportDir}/screenshots/initial.png`, fullPage: true })

// Gather all internal links
const links = await page.$$eval('a[href]', els =>
  els.map(a => ({ text: a.textContent?.trim(), href: a.href }))
    .filter(l => l.href.startsWith(new URL(page.url()).origin))
)

// Check console errors on landing
console.log(`Console errors on landing: ${consoleErrors.length}`)
```

**Detect framework** (note in report):
- `__next` or `_next/data` → Next.js
- `csrf-token` meta → Rails
- `wp-content` → WordPress
- Client-side routing → SPA

**For SPAs:** Use element selectors for navigation since link enumeration misses client-side routes.

### Phase 4: Explore

Visit pages systematically. At each page:
```typescript
await page.goto(pageUrl)
await page.screenshot({ path: `${reportDir}/screenshots/${pageName}.png`, fullPage: true })
const pageErrors = consoleErrors.splice(0)
```

**Per-page exploration checklist:**
1. **Visual scan** — Layout issues, broken images, overflow
2. **Interactive elements** — Click buttons, links, controls
3. **Forms** — Fill and submit. Test empty, invalid, edge cases
4. **Navigation** — Check all paths in and out
5. **States** — Empty state, loading, error, overflow
6. **Console** — Any new JS errors after interactions?
7. **Responsiveness** — Check mobile viewport:
   ```typescript
   await page.setViewportSize({ width: 375, height: 812 })
   await page.screenshot({ path: `${reportDir}/screenshots/${pageName}-mobile.png` })
   await page.setViewportSize({ width: 1280, height: 720 })
   ```

**Depth judgment:** More time on core features (homepage, dashboard, checkout) less on secondary pages (about, terms).

### Phase 5: Document

Document each issue **immediately when found** — don't batch.

**Interactive bugs** (broken flows, dead buttons, form failures):
```typescript
await page.screenshot({ path: `${reportDir}/screenshots/issue-001-before.png` })
await page.click('#submit-btn')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${reportDir}/screenshots/issue-001-after.png` })
```

**Static bugs** (typos, layout issues, missing images):
Single screenshot + description.

### Phase 6: Wrap Up

1. Compute health score using the rubric below
2. Write "Top 3 Things to Fix"
3. Write console health summary
4. Update severity counts in summary table
5. Fill in report metadata
6. Close browser: `await browser.close()`
7. Save `baseline.json` for future regression testing

---

## Health Score Rubric

### Console (weight: 15%)
- 0 errors → 100 | 1-3 → 70 | 4-10 → 40 | 10+ → 10

### Links (weight: 10%)
- 0 broken → 100 | Each broken → -15 (minimum 0)

### Per-Category Scoring
Each starts at 100. Deduct: Critical -25, High -15, Medium -8, Low -3.

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
- Check for hydration errors in console
- Monitor `_next/data` requests — 404s = broken data fetching
- Test client-side navigation (click links, don't just goto)
- Check for CLS on pages with dynamic content

### Rails
- Check for N+1 query warnings
- Verify CSRF token in forms
- Test Turbo/Stimulus integration

### WordPress
- Check for plugin JS conflicts
- Test REST API endpoints (`/wp-json/`)
- Check for mixed content warnings

### General SPA (React, Vue, Angular)
- Use element selectors for navigation
- Check for stale state (navigate away and back)
- Test browser back/forward history
- Watch for memory leaks

---

## Important Rules

1. **NEVER fix bugs.** Find and document only. Do not read source code, edit files, or suggest fixes. Use `/qa` for the test-fix-verify loop.
2. **Repro is everything.** Every issue needs at least one screenshot. No exceptions.
3. **Verify before documenting.** Retry the issue once to confirm it's reproducible.
4. **Never include credentials.** Write `[REDACTED]` for passwords.
5. **Write incrementally.** Append each issue as you find it.
6. **Never read source code.** Test as a user, not a developer.
7. **Check console after every interaction.** JS errors that don't surface visually are still bugs.
8. **Test like a user.** Use realistic data. Walk through complete workflows.
9. **Depth over breadth.** 5-10 well-documented issues > 20 vague descriptions.
10. **Never delete output files.** Screenshots and reports accumulate.
11. **Always close the browser.** Use `await browser.close()` to avoid zombie processes.

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
