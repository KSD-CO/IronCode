---
name: browse
version: 1.1.0
description: |
  Fast headless browser for QA testing and site dogfooding. Navigate any URL, interact with
  elements, verify page state, diff before/after actions, take annotated screenshots, check
  responsive layouts, test forms and uploads, handle dialogs, and assert element states.
  Use when you need to test a feature, verify a deployment, dogfood a user flow, or file
  a bug with evidence. Powered by Playwright.
allowed-tools:
  - bash
  - read
  - question
---

# /browse: QA Testing & Dogfooding

Persistent headless Chromium via Playwright. State persists between calls (cookies, tabs, login sessions).

## User-invocable
When the user types `/browse`, run this skill.

## Arguments
- `/browse <url>` — open URL and show snapshot
- `/browse` — show status of current browser session

## Setup

**Playwright setup (run once per session):**
```bash
# Check if playwright is available
npx playwright --version 2>/dev/null || bunx playwright --version 2>/dev/null
```

If Playwright is not installed, ask the user:
> "Playwright is required for browser testing. Install it? (`npm i -D playwright` or `bun add -d playwright`)"

After install, ensure browsers are ready:
```bash
npx playwright install chromium 2>/dev/null || bunx playwright install chromium 2>/dev/null
```

**Browser launch pattern:**
```typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: "IronCode-Browse/1.0",
});
const page = await context.newPage();
```

## Core QA Patterns

### 1. Verify a page loads correctly
```typescript
await page.goto("https://yourapp.com");
console.log(await page.textContent("body"));        // content loads?
page.on("console", msg => console.log(msg.text())); // JS errors?
console.log(await page.isVisible(".main-content"));  // key elements present?
```

### 2. Test a user flow
```typescript
await page.goto("https://app.com/login");
await page.fill('[name="email"]', "user@test.com");
await page.fill('[name="password"]', "password");
await page.click('button[type="submit"]');
await page.waitForSelector(".dashboard");  // success state present?
```

### 3. Verify an action worked
```typescript
// Baseline
const before = await page.textContent("body");
await page.click("#action-button");
await page.waitForTimeout(1000);
const after = await page.textContent("body");
// Compare before/after
```

### 4. Visual evidence for bug reports
```typescript
await page.screenshot({ path: "/tmp/bug.png", fullPage: true });
// Console errors
const errors: string[] = [];
page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
```

### 5. Find all interactive elements
```typescript
const interactiveSelector = 'a, button, input, select, textarea, [role="button"], [tabindex], [onclick]';
const elements = await page.$$(interactiveSelector);
for (const el of elements) {
  const tag = await el.evaluate(e => e.tagName.toLowerCase());
  const text = await el.textContent();
  const href = await el.getAttribute("href");
  console.log(`${tag}: "${text?.trim()}" ${href ? `→ ${href}` : ""}`);
}
```

### 6. Assert element states
```typescript
await page.isVisible(".modal");
await page.isEnabled("#submit-btn");
await page.isDisabled("#submit-btn");
await page.isChecked("#agree-checkbox");
await page.isEditable("#name-field");
const focused = await page.evaluate(() => document.activeElement?.id);
```

### 7. Test responsive layouts
```typescript
const viewports = [
  { name: "mobile",  width: 375,  height: 812 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
];
for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.screenshot({ path: `/tmp/layout-${vp.name}.png` });
}
```

### 8. Test file uploads
```typescript
const input = await page.$("#file-input");
await input?.setInputFiles("/path/to/file.pdf");
await page.waitForSelector(".upload-success");
```

### 9. Test dialogs
```typescript
page.on("dialog", async dialog => {
  console.log(`Dialog: ${dialog.type()} — "${dialog.message()}"`);
  await dialog.accept("yes");
});
await page.click("#delete-button");
```

### 10. Compare environments
```typescript
const page1 = await context.newPage();
await page1.goto("https://staging.app.com");
const text1 = await page1.textContent("body");

const page2 = await context.newPage();
await page2.goto("https://prod.app.com");
const text2 = await page2.textContent("body");

// Diff text1 vs text2
```

## Snapshot Pattern

The snapshot is your primary tool for understanding page state. Take a snapshot after every navigation and interaction.

```typescript
// Full accessibility tree
const snapshot = await page.accessibility.snapshot();

// Interactive elements only
const interactive = await page.$$eval(
  'a, button, input, select, textarea, [role="button"]',
  els => els.map((el, i) => ({
    ref: `@e${i + 1}`,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role") || el.tagName.toLowerCase(),
    text: el.textContent?.trim().slice(0, 80),
    type: el.getAttribute("type"),
    name: el.getAttribute("name"),
    href: el.getAttribute("href"),
    disabled: (el as HTMLButtonElement).disabled,
  }))
);
```

**After snapshot, use selectors to interact:**
```typescript
// By text
await page.click('text="Submit"');
// By CSS
await page.click("#submit-btn");
// By role
await page.click('role=button[name="Submit"]');
// nth match
await page.click(':nth-match(button, 3)');
```

## Full Command Reference

### Navigation
| Action | Playwright |
|--------|-----------|
| Go to URL | `page.goto(url)` |
| Back | `page.goBack()` |
| Forward | `page.goForward()` |
| Reload | `page.reload()` |
| Current URL | `page.url()` |
| Wait for load | `page.waitForLoadState("networkidle")` |

### Reading
| Action | Playwright |
|--------|-----------|
| Page text | `page.textContent("body")` |
| HTML | `page.innerHTML(selector)` or `page.content()` |
| All links | `page.$$eval("a", els => els.map(e => ({ text: e.textContent, href: e.href })))` |
| Form fields | `page.$$eval("input,select,textarea", ...)` |
| Title | `page.title()` |

### Interaction
| Action | Playwright |
|--------|-----------|
| Click | `page.click(selector)` |
| Fill input | `page.fill(selector, value)` |
| Type text | `page.type(selector, text)` |
| Select dropdown | `page.selectOption(selector, value)` |
| Check/uncheck | `page.check(selector)` / `page.uncheck(selector)` |
| Hover | `page.hover(selector)` |
| Press key | `page.keyboard.press("Enter")` |
| Upload file | `page.setInputFiles(selector, filepath)` |
| Scroll | `page.evaluate("window.scrollTo(0, document.body.scrollHeight)")` |

### Inspection
| Action | Playwright |
|--------|-----------|
| Is visible | `page.isVisible(selector)` |
| Is enabled | `page.isEnabled(selector)` |
| Is checked | `page.isChecked(selector)` |
| Get attribute | `page.getAttribute(selector, name)` |
| CSS value | `page.$eval(selector, (el, prop) => getComputedStyle(el).getPropertyValue(prop), prop)` |
| Run JS | `page.evaluate(expression)` |
| Console log | `page.on("console", msg => ...)` |
| Network | `page.on("request", req => ...)` / `page.on("response", res => ...)` |
| Cookies | `context.cookies()` |
| Set cookie | `context.addCookies([{ name, value, domain, path }])` |
| Storage | `page.evaluate(() => ({ ...localStorage }))` |

### Visual
| Action | Playwright |
|--------|-----------|
| Screenshot | `page.screenshot({ path, fullPage? })` |
| Element screenshot | `(await page.$(selector))?.screenshot({ path })` |
| PDF | `page.pdf({ path })` |
| Viewport | `page.setViewportSize({ width, height })` |

### Tabs
| Action | Playwright |
|--------|-----------|
| New tab | `context.newPage()` |
| List tabs | `context.pages()` |
| Switch tab | `const pages = context.pages(); await pages[n].bringToFront()` |
| Close tab | `page.close()` |

## Important Rules

- Always use `page.waitForLoadState("networkidle")` or `page.waitForSelector()` after navigation — don't assume the page is ready
- Take screenshots as evidence for every bug found
- Use `page.waitForTimeout()` sparingly — prefer explicit waits (`waitForSelector`, `waitForResponse`)
- Always close the browser when done: `await browser.close()`
- If a selector is not found, try alternative selectors (text, role, css, xpath)
- Capture console errors throughout — they reveal hidden issues
- When testing forms, always test both valid and invalid submissions
- For SPAs, use `page.waitForURL()` or `page.waitForSelector()` instead of `page.waitForNavigation()`
- All output goes to the conversation — screenshots saved to `/tmp/` or `.ironcode/qa-reports/`
