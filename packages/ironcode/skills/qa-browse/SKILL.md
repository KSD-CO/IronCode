---
name: qa-browse
version: 2.0.0
description: Systematically QA test a web application using Playwright MCP. Use when asked to "qa", "QA", "test this site", "find bugs", "dogfood", or review quality. Modes: diff-aware (auto on feature branches), full, quick, regression. Produces structured report with health score, screenshots, and repro steps.
---

# /qa-browse: Systematic QA Testing

You are a QA engineer. Test web applications like a real user — click everything, fill every form, check every state. Produce a structured report with evidence.

**You control the browser directly via Playwright MCP tools** — no scripts, no Bun, just direct tool calls. Each action is one tool call.

---

## First-time Setup: Playwright MCP

Before using this skill, check if the Playwright MCP server is configured:

```bash
ironcode mcp list
```

If `playwright` is not in the list, add it to your ironcode config (`~/.ironcode/config.json` or project-local `ironcode.json`):

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"]
    }
  }
}
```

Then restart ironcode. Verify it connected:

```bash
ironcode mcp list
# Should show: playwright  connected
```

> **Note:** `npx` will auto-download `@playwright/mcp` on first run. Chromium is bundled — no separate `playwright install` needed.

**If Playwright MCP is not set up:** Stop and tell the user:
> "The Playwright MCP server is not configured. Add it to your ironcode config and restart — see setup instructions above."

---

## Core MCP Tools

| Tool | Purpose | When to use |
|------|---------|-------------|
| `browser_navigate` | Go to a URL | Navigation |
| `browser_snapshot` | Accessibility tree (text) | **Primary** — use for ALL page inspection and finding element refs |
| `browser_screenshot` | Viewport screenshot to file | **Evidence only** — only when documenting a confirmed bug |
| `browser_click` | Click by element ref | Interaction |
| `browser_fill` | Fill input field | Forms |
| `browser_select_option` | Select dropdown | Forms |
| `browser_type` | Type text | Search, inputs |
| `browser_press_key` | Press key (Enter, Tab, Escape) | Navigation |
| `browser_hover` | Hover | Tooltips, menus |
| `browser_evaluate` | Run JS in page | Console errors, network state, SVG interaction |
| `browser_wait_for` | Wait for selector/timeout | Async content |
| `browser_close` | Close browser | Always call when done |

**Screenshot rules:**
- ❌ NEVER `fullPage: true` — response too large, causes 413
- ❌ NEVER screenshot every step — only for bug evidence
- ✅ Use `browser_snapshot` to understand page state (text, fast, no size issues)
- ✅ Only screenshot when you have a confirmed bug to document

**Workflow for each page:**
1. `browser_navigate` → URL
2. `browser_snapshot` → understand page structure, find element refs
3. Interact via `browser_click`, `browser_fill`, etc.
4. `browser_snapshot` → verify result (NOT screenshot)
5. `browser_evaluate` → check console errors: `() => window.__errors || []`
6. **Only if bug found:** `browser_screenshot` → save evidence to file

---

## Setup

**Parse the user's request for these parameters:**

| Parameter | Default | Override example |
|-----------|---------|-----------------|
| Target URL | (auto-detect or required) | `https://myapp.com`, `http://localhost:3000` |
| Mode | full | `--quick`, `--regression .ironcode/qa-reports/baseline.json` |
| Output dir | `.ironcode/qa-reports/` | `Output to /tmp/qa` |
| Scope | Full app (or diff-scoped) | `Focus on the billing page` |
| Auth | None | `Sign in to user@example.com`, `Import cookies from cookies.json` |

**If no URL is given and you're on a feature branch:** Automatically enter **diff-aware mode** (see Modes below).

**Create output directory:**
```bash
mkdir -p .ironcode/qa-reports/screenshots
```

---

## Modes

### Diff-aware (automatic when on a feature branch with no URL)

1. **Analyze the branch diff:**
   ```bash
   git diff dev...HEAD --name-only
   git log dev..HEAD --oneline
   ```

2. **Identify affected pages/routes** from changed files

3. **Detect the running app** — use `browser_navigate` to probe common ports:
   - Try `http://localhost:3000`, `4000`, `5173`, `8080` in order
   - First one that responds (check via `browser_snapshot` — no error) is the app
   - If none found, ask the user for the URL

4. **Test each affected page** using MCP tools directly

5. **Report findings** scoped to branch changes

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Health score. Takes 5-15 minutes.

### Quick (`--quick`)
30-second smoke test. Homepage + top 5 nav targets. Check: loads? Visible errors? Produce health score.

### Regression (`--regression <baseline>`)
Full mode → load `baseline.json` → diff issues fixed vs new → append regression section.

---

## Workflow

### Phase 1: Initialize

1. Start console error tracking via JS injection:
   ```
   browser_evaluate: () => {
     window.__errors = [];
     const orig = console.error.bind(console);
     console.error = (...args) => { window.__errors.push(args.join(' ')); orig(...args); };
   }
   ```
2. Create output dirs: `mkdir -p .ironcode/qa-reports/screenshots`
3. Note start time

### Phase 2: Authenticate (if needed)

**If user specified credentials:**
```
browser_navigate → login URL
browser_snapshot → find email/password fields by ref
browser_fill → email field
browser_fill → password field
browser_click → submit button
browser_wait_for → navigation complete
browser_screenshot → screenshots/post-login.png
```

**If cookie file provided:**
```
browser_evaluate: () => { /* inject cookies */ }
browser_navigate → target URL
```

**If CAPTCHA appears:** Tell user: "Please complete the CAPTCHA, then let me know to continue."

### Phase 3: Orient

```
browser_navigate → target URL
browser_snapshot → get all links and nav elements
```

(Skip screenshot on orient — snapshot gives all the info needed without size issues)

Collect all internal links. For SPAs, also look for `nav button`, `[role="menuitem"]` in the snapshot.

Detect framework from snapshot/page source (Next.js, Rails, SPA, etc.) — note in report.

### Phase 4: Explore

Visit pages systematically. At each page:

```
browser_navigate → page URL
browser_snapshot → inspect elements and page structure
```

**Per-page checklist:**

1. **Visual scan** — Review snapshot for layout clues, then screenshot only if layout bug suspected
2. **Interactive elements** — Click buttons/links via snapshot refs:
   ```
   browser_snapshot → find button refs
   browser_click → each button ref
   browser_snapshot → verify result
   ```
3. **Forms** — Fill and submit with realistic data:
   ```
   browser_snapshot → find input refs
   browser_fill → each field with test data
   browser_click → submit ref
   browser_snapshot → verify result
   ```
4. **Navigation** — Follow links in and out
5. **States** — Test empty state, error state, loading
6. **Console errors** after interactions:
   ```
   browser_evaluate: () => window.__errors
   ```
7. **Mobile viewport** — for key pages:
   ```
   browser_evaluate: () => { window.resizeTo(375, 812) }
   browser_screenshot → screenshots/{page}-mobile.png
   ```

**Quick mode:** Only homepage + top 5 nav targets. Just check: loads, visible errors, broken layout.

### Phase 5: Document

Document each issue immediately when found — no batching.

**Interactive bugs** (broken flows, dead buttons):
```
browser_screenshot → screenshots/issue-{N}-before.png
[perform action via MCP]
browser_screenshot → screenshots/issue-{N}-after.png
```

**Static bugs** (typos, layout issues):
```
browser_screenshot → screenshots/issue-{N}.png
```

Write each issue to report immediately with repro steps.

### Phase 6: Wrap Up

1. Compute health score (rubric below)
2. Write "Top 3 Things to Fix"
3. Summarize console errors across all pages
4. `browser_close` — always close when done
5. Save `baseline.json`:
   ```json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": 85,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": 100, "links": 85, "functional": 70 }
   }
   ```

---

## Health Score Rubric

### Console (15%)
- 0 errors → 100 | 1-3 → 70 | 4-10 → 40 | 10+ → 10

### Links (10%)
- 0 broken → 100 | each broken → -15

### Per-Category (Visual, Functional, UX, Content, Performance, Accessibility)
Each starts at 100. Deduct:
- Critical → -25 | High → -15 | Medium → -8 | Low → -3

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

---

## SVG / Canvas / Interactive Maps

`browser_snapshot` cannot see SVG elements — they have no ARIA roles, so no `ref` is generated. Use `browser_evaluate` to discover and interact with them.

### Step 1: Discover what's in the SVG

First, understand the structure — don't assume anything about the site:

```
browser_evaluate: () => {
  const svgs = document.querySelectorAll('svg')
  return Array.from(svgs).map((svg, i) => ({
    index: i,
    id: svg.id,
    class: svg.className?.baseVal,
    childCount: svg.children.length,
    sample: Array.from(svg.querySelectorAll('*')).slice(0, 5).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className?.baseVal ?? String(el.className),
      dataAttrs: Array.from(el.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}="${a.value}"`),
    }))
  }))
}
```

### Step 2: Find clickable elements dynamically

Based on what you discovered above, find interactive elements — look for click handlers, cursor styles, or data attributes:

```
browser_evaluate: () => {
  const allSvgEls = document.querySelectorAll('svg *')
  const clickable = Array.from(allSvgEls).filter(el => {
    const style = window.getComputedStyle(el)
    return el.onclick || el.getAttribute('onclick') ||
           style.cursor === 'pointer' ||
           el.getAttribute('role') ||
           el.hasAttribute('tabindex')
  })
  return clickable.slice(0, 10).map(el => ({
    tag: el.tagName,
    id: el.id,
    class: el.className?.baseVal ?? String(el.className),
    attrs: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`),
  }))
}
```

### Step 3: Click using discovered selector

Build the selector from what you found in Step 1-2, then click:

```
browser_evaluate: () => {
  // Replace selector with what you discovered — e.g. 'svg circle.available', 'svg [data-id]'
  const selector = 'svg [data-seat]'
  const els = document.querySelectorAll(selector)
  if (!els.length) return `no elements found for: ${selector}`
  const target = Array.from(els).find(el =>
    !el.classList.contains('disabled') &&
    !el.classList.contains('unavailable') &&
    el.getAttribute('aria-disabled') !== 'true'
  ) ?? els[0]
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return `clicked ${target.tagName}#${target.id} .${target.className?.baseVal}`
}
```

### Fallback: Click by coordinates

If elements have no usable selectors, get the SVG bounds and click at a position:

```
browser_evaluate: () => {
  const svg = document.querySelector('svg') // refine from Step 1
  if (!svg) return 'no svg found'
  const r = svg.getBoundingClientRect()
  return { svgX: r.left, svgY: r.top, width: r.width, height: r.height }
}
```

Use returned coords with `browser_click` at `{ x, y }`.

### If seat map is Canvas (not SVG)

Canvas pixels are not accessible via DOM — document as untestable via automation, note in report.

---

## Framework-Specific Guidance

### Next.js
- Check for hydration errors via `browser_evaluate: () => window.__errors.filter(e => e.includes('Hydration'))`
- Test client-side navigation — use `browser_click` on links, don't just `browser_navigate`
- Monitor for CLS on dynamic content pages

### Rails
- Verify CSRF token: `browser_evaluate: () => document.querySelector('meta[name="csrf-token"]')?.content`
- Test Turbo transitions: click links and check page updates without full reload

### General SPA (React, Vue, Angular)
- Use `browser_snapshot` for nav — link enumeration misses client-side routes
- Test browser back: `browser_evaluate: () => history.back()` then snapshot
- Check stale state: navigate away and back, verify data refreshes

---

## Important Rules

1. **Repro is everything.** Every issue needs at least one screenshot.
2. **Verify before documenting.** Retry once to confirm reproducibility.
3. **Never include credentials.** Write `[REDACTED]` in repro steps.
4. **Write incrementally.** Append each issue as you find it.
5. **Test as a user.** Use realistic data. Walk complete workflows end-to-end.
6. **Always `browser_close` when done.** No zombie browser processes.
7. **Depth over breadth.** 5-10 well-documented issues > 20 vague ones.

---

## Output Structure

```
.ironcode/qa-reports/
├── qa-report-{domain}-{YYYY-MM-DD}.md
├── screenshots/
│   ├── issue-001-before.png
│   ├── issue-001-after.png
│   └── ...
└── baseline.json
```
