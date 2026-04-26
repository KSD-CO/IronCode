---
name: security-review
description: |
  Security-focused code review. Scans the current branch diff for vulnerabilities:
  injection, broken auth, authorization bypasses, cryptographic weaknesses, sensitive
  data exposure, and supply chain risks. Writes findings to SECURITY-REVIEW.md —
  read-only, no code changes. Human decides what to fix. Integrates Semgrep MCP when available.
---

# /security-review: Security Vulnerability Review

You are running the `/security-review` workflow. Scan the current branch's diff for security vulnerabilities and write a report to `SECURITY-REVIEW.md`. **Do not modify any source files.** Fixing is the human's decision.

---

## Step 0: Check for Semgrep MCP

Check if the `semgrep` MCP server is connected by looking at the available tools list.

- **If Semgrep is available:** run it on changed files (Step 2b) and merge findings into the report under `[SEMGREP]`.
- **If not available:** skip Step 2b. The manual checklist (Step 3) is the sole analysis.

> To enable Semgrep, add to `ironcode.json`: `{ "mcp": { "semgrep": { "type": "local", "command": ["npx", "@modular-intelligence/semgrep"] } } }` and install the CLI: `brew install semgrep`. Then restart IronCode.

---

## Step 1: Check branch

1. Run `git branch --show-current`.
2. If on `main` or `dev` with no diff, output: **"Nothing to review — no changes against main/dev."** and stop.
3. Run `git fetch origin --quiet && git diff origin/main --stat 2>/dev/null || git diff origin/dev --stat` to confirm a diff exists.

---

## Step 2: Get the diff

```bash
git fetch origin --quiet
git diff origin/main 2>/dev/null || git diff origin/dev
```

Get the list of changed files:

```bash
git diff origin/main --name-only 2>/dev/null || git diff origin/dev --name-only
```

Read the full diff before starting any analysis. Do NOT flag issues already addressed in the diff.

Detect languages present in the changed files by their extensions:

| Extension | Language |
|-----------|----------|
| `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | TypeScript / JavaScript |
| `.py` | Python |
| `.java` | Java |
| `.go` | Go |
| `.php` | PHP |
| `.rb` | Ruby |
| `.rs` | Rust |
| `.cs` | C# |
| `.c` `.cpp` `.h` `.hpp` | C / C++ |
| `.kt` `.kts` | Kotlin |
| `.swift` | Swift |

Apply the generic checklist (Step 3) to all languages, **plus** the language-specific patterns below for each detected language.

---

## Step 2c: Language-specific vulnerability patterns

Apply these patterns **in addition to** the generic OWASP checklist for each detected language.

### Python

**CRITICAL:**
- `subprocess.call(..., shell=True)` / `os.system(user_input)` — command injection; use `subprocess.run([...])` array form
- `eval(user_input)` / `exec(user_input)` — arbitrary code execution
- `pickle.loads(data)` / `marshal.loads(data)` on untrusted input — deserialization RCE
- `yaml.load(data)` without `Loader=yaml.SafeLoader` — code execution via YAML
- SQL built with f-strings: `` f"SELECT * FROM users WHERE id={uid}" `` — use parameterized queries
- `SECRET_KEY` / `PASSWORD` / `API_KEY` hardcoded in source or `settings.py`
- `DEBUG = True` committed in Django/Flask production settings

**INFORMATIONAL:**
- `hashlib.md5()` / `hashlib.sha1()` for security hashing — use `hashlib.sha256()` or `bcrypt`
- `random.random()` / `random.randint()` for tokens — use `secrets.token_hex()`
- `assert` statements used for access control — stripped in optimized mode (`python -O`)
- Unbounded `**kwargs` passed into ORM query constructors — mass assignment risk

---

### Java

**CRITICAL:**
- `Runtime.getRuntime().exec(userInput)` / `ProcessBuilder` with string concat — command injection
- JDBC query built with `+` concatenation: `"SELECT * FROM users WHERE id=" + id` — SQL injection
- `ObjectInputStream.readObject()` on untrusted data — deserialization RCE (CVE class)
- `DocumentBuilderFactory` without `setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)` — XXE
- `MessageDigest.getInstance("MD5")` / `"SHA-1"` for security — use `SHA-256` or stronger
- `Math.random()` for session IDs or tokens — use `SecureRandom`
- Hardcoded credentials in source: `String password = "..."` / `@Value` with literal

**INFORMATIONAL:**
- Catching `Exception` or `Throwable` and swallowing security exceptions silently
- Logging `password`, `token`, `secret` fields via `log.info()` / `System.out.println()`
- Missing `@PreAuthorize` / `@Secured` on controller methods that mutate state
- Serializable classes with sensitive fields not marked `transient`

---

### Go

**CRITICAL:**
- `exec.Command(fmt.Sprintf("... %s", userInput))` — command injection; pass args as separate strings
- `crypto/md5` / `crypto/sha1` used for security hashing — use `crypto/sha256` or `golang.org/x/crypto/bcrypt`
- SQL via `fmt.Sprintf`: `` db.Query(fmt.Sprintf("SELECT ... WHERE id=%s", id)) `` — use `?` placeholders
- `http.ListenAndServe` (plain HTTP) for sensitive services — use `ListenAndServeTLS`
- `math/rand` for secrets or tokens — use `crypto/rand`

**INFORMATIONAL:**
- `ioutil.ReadAll` / `http.Get` without response size limit — DoS via large response
- `os.Getenv` results used without validation at trust boundary
- Missing `context` timeout on outbound HTTP calls — can hang indefinitely
- Goroutine started without WaitGroup or cancellation — goroutine leak

---

### PHP

**CRITICAL:**
- `system()` / `exec()` / `shell_exec()` / `passthru()` / backtick execution with `$_GET`/`$_POST` — command injection
- `eval($_REQUEST[...])` / `assert($userInput)` / `preg_replace('/pattern/e', ...)` — code execution
- SQL via concat: `"SELECT * FROM users WHERE id=" . $_GET['id']` — use PDO prepared statements
- `include`/`require`/`include_once` with user-controlled path — local/remote file inclusion
- `$_GET`/`$_POST` echoed directly into HTML without `htmlspecialchars()` — XSS
- `md5($password)` / `sha1($password)` for passwords — use `password_hash()` with `PASSWORD_BCRYPT`
- `unserialize($_COOKIE[...])` / `unserialize($_POST[...])` — deserialization RCE

**INFORMATIONAL:**
- `error_reporting(E_ALL)` / `display_errors = On` in production — stack trace disclosure
- `$_FILES` upload without MIME type validation and extension allowlist
- Missing CSRF token on state-mutating forms
- `rand()` / `mt_rand()` for tokens — use `random_bytes()` / `random_int()`

---

### Ruby

**CRITICAL:**
- `system("... #{user_input}")` / `` `cmd #{user_input}` `` / `exec(...)` with string interpolation — command injection; pass args as separate array elements
- `eval(user_input)` / `send(method_name)` with user-controlled method name — code execution
- `YAML.load(data)` on untrusted input — use `YAML.safe_load()`
- `Marshal.load(data)` on untrusted input — deserialization RCE
- SQL built with string interpolation in ActiveRecord: `User.where("name = '#{params[:name]}'")` — use `?` placeholders
- `MD5::Digest` / `Digest::SHA1` for security — use `Digest::SHA256` / `bcrypt`

**INFORMATIONAL:**
- `Rails.application.secrets` values hardcoded in `secrets.yml` committed to repo
- `protect_from_forgery` disabled on controllers that mutate state
- `attr_accessible` replaced with `permit` — verify strong params cover all sensitive fields
- `render inline:` with user input — template injection

---

### Rust

**CRITICAL:**
- `unsafe` blocks touching raw pointers from external input — memory safety boundary
- `Command::new(format!("... {}", user_input))` — command injection; use `.arg(user_input)` separately
- Hardcoded secrets / API keys in source

**INFORMATIONAL:**
- `unwrap()` / `expect()` in production code on fallible paths — panic on unexpected input
- `std::mem::transmute` between types of different sizes — UB risk
- External crates added without checking for typosquatting (verify on crates.io)

---

### C# / .NET

**CRITICAL:**
- `Process.Start(userInput)` / `cmd /c " + userInput` — command injection
- `SqlCommand` built with string concat — SQL injection; use parameterized `@param`
- `BinaryFormatter.Deserialize()` / `NetDataContractSerializer` on untrusted data — deserialization RCE (deprecated in .NET 5+)
- `XmlDocument` / `XmlReader` without `XmlReaderSettings.DtdProcessing = DtdProcessing.Prohibit` — XXE
- `MD5.Create()` / `SHA1.Create()` for passwords — use `Rfc2898DeriveBytes` (PBKDF2) or BCrypt
- `RNGCryptoServiceProvider` replaced with `Random` for tokens — use `RandomNumberGenerator`

**INFORMATIONAL:**
- `[AllowAnonymous]` on controllers that should be auth-gated
- LINQ queries using raw string interpolation via `FromSqlRaw($"...{input}")` — use `FromSqlInterpolated`
- `Response.Write(Request.QueryString[...])` without encoding — XSS

---

## Step 2b: Semgrep scan (only if Semgrep MCP is connected)

Run three scans in sequence. Collect all findings. Continue even if one scan errors.

**1. Get project root:**

```bash
git rev-parse --show-toplevel
git branch -r | grep -E "origin/(main|dev|master)" | head -1 | xargs
```

**2. SAST scan — `semgrep_ci_report`** (diff-aware, only new findings vs base branch):

```json
{
  "path": "<absolute project root>",
  "config": "auto",
  "baseline_ref": "origin/main"
}
```

`baseline_ref` makes Semgrep only report findings introduced by the current branch — not pre-existing issues. Use the base branch detected above (`origin/main`, `origin/dev`, etc.).

**3. Secrets scan — `semgrep_secrets`**:

```json
{
  "path": "<absolute project root>"
}
```

Detects hardcoded API keys, tokens, passwords, private keys using the `p/secrets` ruleset.

**4. Supply chain scan — `semgrep_supply_chain`**:

```json
{
  "path": "<absolute project root>"
}
```

Detects vulnerable dependencies using the `p/supply-chain` ruleset.

**5. Parse all findings:**

| Semgrep field | Maps to |
|---------------|---------|
| `check_id` | Rule name (e.g. `javascript.lang.security.audit.dangerous-exec`) |
| `path` + `start.line` | File location |
| `extra.message` | Description |
| `extra.severity: "ERROR"` | → CRITICAL |
| `extra.severity: "WARNING"` | → INFORMATIONAL |
| `extra.severity: "INFO"` | → INFORMATIONAL |

**6.** Store all findings to merge into Step 4 output under `[SEMGREP file:line]` tag.

> If any scan errors (Semgrep CLI not installed, timeout), print one warning per failed scan and continue: `Semgrep: <tool> failed — <error>`

---

## Step 3: Two-pass security review

Apply the checklist in two passes.

---

### Pass 1 — CRITICAL (blocks shipping)

#### A1 — Injection

- **Command injection:** User-controlled input passed to `Bun.spawn`, `exec`, `execSync`, `child_process` — must use array form, never string interpolation
- **Path traversal:** User-supplied paths not validated with `path.resolve` + `startsWith(baseDir)` before file operations
- **SQL / NoSQL injection:** Query strings built with string concatenation or template literals instead of parameterized queries / prepared statements
- **Prompt injection:** User-controlled data interpolated directly into LLM system prompts without a trust boundary (e.g., `system: \`...${userInput}...\``)
- **Template injection:** Untrusted strings passed to template engines (`Handlebars`, `EJS`, `Pug`) without sandboxing
- **Log injection:** Unsanitized user input written to logs — can forge log entries or inject control characters

#### A2 — Cryptographic Failures

- Hardcoded secrets: API keys, tokens, passwords, private keys committed in source (check `.env` reads too — are they validated?)
- Weak or deprecated algorithms: `MD5`, `SHA1` for security purposes, `DES`, `RC4` — must use `SHA-256+`, `AES-GCM`, `ChaCha20-Poly1305`
- Insecure random: `Math.random()` used for security tokens, session IDs, or nonces — must use `crypto.getRandomValues()` or `crypto.randomBytes()`
- Missing encryption at rest for sensitive stored data (PII, auth tokens, private keys)
- TLS disabled or `rejectUnauthorized: false` set anywhere

#### A3 — Broken Authentication & Session Management

- Tokens or session IDs exposed in URLs, query strings, or logs
- JWT verification skipped or using `alg: none` / weak HMAC secret
- Missing token expiration or no refresh rotation logic
- OAuth state parameter missing or not validated (CSRF on OAuth flows)
- Passwords stored without bcrypt/Argon2/scrypt (any plain or reversible storage)

#### A4 — Broken Access Control

- Missing authorization checks before operating on user-owned resources (IDOR: `GET /resource/:id` without ownership check)
- Role checks client-side only — no server-side enforcement
- Sensitive endpoints missing authentication middleware
- `allowlist` replaced with `denylist` patterns — new paths unprotected by default
- Directory listing enabled or sensitive files served under a public route

#### A5 — Security Misconfiguration

- CORS `origin: "*"` with `credentials: true` — browsers will block this but it signals intent error
- Verbose error responses exposing stack traces, internal paths, or DB schemas to clients
- Debug mode / development flags left enabled in production paths
- Default credentials or placeholder secrets that were never replaced
- Missing `HttpOnly` / `Secure` / `SameSite` flags on auth cookies

#### A6 — Vulnerable & Outdated Components

- New `require()`/`import` of packages with known CVEs (cross-reference against package name changes or typosquatting)
- Prototype pollution: `Object.assign({}, userInput)` or `JSON.parse(userInput)` merged into shared objects without key filtering
- `eval()`, `new Function(str)`, or `vm.runInThisContext()` with any external input
- Dependency confusion risk: internal package names that could be registered on npm

---

### Pass 2 — INFORMATIONAL (non-blocking)

#### Security Hardening

- Missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers on HTTP responses
- `Referrer-Policy` not set — leaks origin to third-party requests
- Sensitive data in browser `localStorage` instead of `sessionStorage` or `HttpOnly` cookies
- Missing rate limiting on authentication or sensitive endpoints
- No CSRF token on state-mutating non-API form endpoints

#### Data Handling & Privacy

- PII (emails, names, phone numbers) logged at DEBUG/INFO level — should be redacted or hashed
- Sensitive fields returned in API responses that are never used client-side (over-fetching)
- Missing data retention / TTL on stored sensitive records
- User-enumeration possible via distinct error messages (`"user not found"` vs `"wrong password"`)

#### Dependency & Supply Chain

- New direct dependencies added without a comment explaining why
- `*` or `latest` version pins for security-sensitive packages
- Post-install scripts in new dependencies (can run arbitrary code at install time)
- Native addons (`.node` files) added — needs manual review

#### Security Observability

- Auth failures not logged (failed login, invalid token, permission denied)
- No audit trail for privileged operations (admin actions, data deletion, config changes)
- Error handlers that silently swallow security exceptions
- Missing alerting hooks for repeated auth failures (brute-force detection)

---

## Step 4: Write SECURITY-REVIEW.md

Merge manual checklist findings (Step 3) with Semgrep findings (Step 2b, if available), then write the report to `SECURITY-REVIEW.md` in the project root. **Do not edit any other file.**

Use this exact template:

```markdown
# Security Review

**Branch:** <current branch>
**Date:** <YYYY-MM-DD>
**Scanned:** <list of changed files>
**Semgrep:** enabled ✓ (SAST + secrets + supply chain)  <!-- or: not connected -->

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | X |
| 🟡 Informational | Y |
| **Total** | N |

---

## Critical Findings

> Must be resolved before shipping.

### 1. [Vulnerability type] — `file:line`

**Source:** manual checklist  <!-- or: Semgrep · rule-id -->
**Risk:** what an attacker could do
**Suggested fix:** concrete remediation

```code snippet if helpful```

---

### 2. ...

---

## Informational Findings

> Non-blocking. Address before GA or next sprint.

### 1. [Issue] — `file:line`

**Source:** manual checklist  <!-- or: Semgrep · rule-id -->
**Suggested fix:** suggestion

---

## No Action Required

> Items reviewed and considered safe.

- `Math.random()` in retry jitter — not security-sensitive
<!-- list suppressions applied, so reviewer understands what was skipped and why -->
```

**Rules:**
- Write ALL findings — nothing omitted.
- If no issues found: write the template with `0` in the summary table and a single line under each section: `_No findings._`
- One heading per finding — not a flat list.
- Always include the Semgrep status line.
- **Never modify source code. Never suggest applying fixes inline. This is a report only.**

---

## Step 5: Triage critical findings

After writing `SECURITY-REVIEW.md`, triage each **critical** finding one by one using a `question` tool call.

For each critical finding, ask:

> **[file:line] Vulnerability type**
> Risk: ...
> Suggested fix: ...
>
> What do you want to do?
> **A — Fix it now** (apply the fix immediately)
> **B — Add to TODO** (track for later, don't block shipping)
> **C — Accept risk** (acknowledge and ship, note reason)
> **D — False positive** (skip, remove from report)

After all critical findings are triaged, apply decisions:

- **A (Fix):** Apply the suggested fix to the source file. Update the finding in `SECURITY-REVIEW.md` with status `✅ Fixed`.
- **B (TODO):** Append to `TODOS.md` in the project root (create if missing):
  ```markdown
  ## [Security] Vulnerability type — file:line
  <!-- auto-added by /security-review on YYYY-MM-DD -->
  Risk: ...
  Fix: ...
  ```
  Update the finding in `SECURITY-REVIEW.md` with status `📋 TODO`.
- **C (Accept):** Ask the user for a one-line reason. Update the finding in `SECURITY-REVIEW.md` with status `⚠️ Accepted — <reason>`.
- **D (False positive):** Remove the finding from `SECURITY-REVIEW.md` entirely.

After all decisions are applied, print:

```
Security review complete → SECURITY-REVIEW.md (X critical, Y informational)
TODOs added: N  |  Fixed: N  |  Accepted: N  |  False positives: N
```

---

## Suppressions — DO NOT flag these

- Theoretical vulnerabilities with no realistic attack vector given the actual input sources
- Cryptographic agility code that supports both old and new algorithms where old is only used for legacy decryption (not new encryption)
- `Math.random()` used for non-security purposes (UI shuffle, A/B assignment, retry jitter)
- Missing security headers on non-HTTP code (CLI tools, background workers)
- Dependency versions that are outdated but have no known CVEs
- ANYTHING already addressed in the diff you're reviewing

---

## Gate Classification

```
CRITICAL (blocks shipping):              INFORMATIONAL (address before GA):
├─ A1 Injection                          ├─ Security Hardening Headers
├─ A2 Cryptographic Failures             ├─ Data Handling & Privacy
├─ A3 Broken Authentication              ├─ Dependency & Supply Chain
├─ A4 Broken Access Control              └─ Security Observability
├─ A5 Security Misconfiguration
└─ A6 Vulnerable Components
```
