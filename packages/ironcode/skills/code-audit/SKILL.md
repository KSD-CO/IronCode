---
name: code-audit
description: |
  White-box code security audit. 5-phase protocol covering 55+ vulnerability types
  across 9 languages (Java, Python, Go, PHP, JS/TS, C/C++, C#, Ruby, Rust) and
  10 security dimensions (D1-D10). Dual-track model: sink-driven + control-driven.
  Taint analysis, anti-hallucination verification. Writes CODE-AUDIT.md — read-only,
  no code changes. Human triages findings. Integrates Semgrep MCP when available.
---

# /code-audit: White-Box Code Security Audit

You are running the `/code-audit` workflow. Perform a systematic white-box security audit and write findings to `CODE-AUDIT.md`. **Do not modify any source files. Fixing is the human's decision.**

---

## Anti-Hallucination Rules (enforce throughout all phases)

These rules are mandatory. Violating them produces worthless reports.

1. **File existence first** — before reporting any finding, verify the file exists via Read/Glob. Never assume project structure.
2. **Code snippets from actual reads** — every code excerpt must come from a real Read tool call, not from memory or training data.
3. **Line numbers must be accurate** — verify line numbers fall within the file's actual line count.
4. **Tech stack consistency** — findings must match the actual tech stack. No SQL injection in a pure Rust CLI, no Java deserialization in a Go service.
5. **Knowledge base isolation** — framework documentation examples ≠ project code. Do not confuse the two.

> **Core principle: 宁可漏报，不可误报 — better to miss a finding than report a false positive.**

---

## Step 0: Scan mode

Determine mode from user input (or ask if unclear):

| Mode | When | Coverage |
|------|------|----------|
| **Quick** | CI/CD, small PRs | D1 injection, D2 secrets, D10 deps — high-risk only |
| **Standard** | Regular audit | D1-D8, OWASP Top 10, auth, crypto |
| **Deep** | Critical systems, pentest | All D1-D10, attack chains, business logic, full taint |

Default to **Standard** if no keyword given.

---

## Step 0b: Check Semgrep MCP

Check if the `semgrep` MCP server is connected.

- **Connected:** use `semgrep_ci_report`, `semgrep_secrets`, `semgrep_supply_chain` in Phase 2 to surface findings, then validate with taint analysis in Phase 3.
- **Not connected:** rely on Grep/Read pattern matching. Print: `Semgrep: not connected — pattern matching only`

> To enable: `{ "mcp": { "semgrep": { "type": "local", "command": ["npx", "@modular-intelligence/semgrep"] } } }` + `brew install semgrep`

---

## Phase 1 — Reconnaissance & Attack Surface Mapping (10%)

**Goal:** understand what exists before touching any code.

1. **Project structure** — run `find . -type f | grep -v -E "(node_modules|vendor|dist|build|\.git|__pycache__)" | head -100` to get layout.
2. **Tech stack detection** — identify languages (by file extensions), frameworks (by config files: `pom.xml`, `requirements.txt`, `go.mod`, `composer.json`, `package.json`, `Gemfile`, `Cargo.toml`, `*.csproj`), and deployment (Docker, k8s, serverless).
3. **Entry point enumeration** — find all external input surfaces:
   - HTTP routes: grep for `@GetMapping`, `@PostMapping`, `router.`, `app.get(`, `func.*Handler`, `Route::`, `def get`, `def post`, `r.GET`, `r.POST`
   - CLI args: `os.Args`, `argv`, `argparse`, `cobra`, `click`, `urfave/cli`
   - File inputs: `multipart`, `upload`, `file`, `stream`
   - Message queues: `kafka`, `rabbitmq`, `sqs`, `pubsub`
   - Scheduled jobs: `cron`, `@Scheduled`, `celery`, `sidekiq`
4. **Auth boundary detection** — find middleware, interceptors, guards: `middleware`, `@PreAuthorize`, `authenticate`, `requireAuth`, `before_action`
5. **Data store inventory** — SQL (JDBC, SQLAlchemy, GORM, Sequelize), NoSQL (MongoDB, Redis), file system, external APIs

**Output (internal, not written to file yet):**
```
Attack surface: N entry points, M auth boundaries
Tech stack: <languages> / <frameworks>
High-risk areas: <list top 5 by entry point density>
```

---

## Phase 2 — Parallel Pattern Matching (30%)

**Goal:** broad sweep across all 10 dimensions to find candidates.

Run **sink-driven** and **control-driven** tracks in parallel.

### Track A — Sink-Driven (D1, D4, D5, D6)

Search for dangerous sinks and trace backward to user-controlled sources.

#### D1 — Injection Sinks

```bash
# Command injection sinks
grep -rn "exec\|spawn\|system\|popen\|subprocess\|Runtime\.exec\|ProcessBuilder\|os\.system\|shell_exec\|passthru\|backtick" --include="*.java,*.py,*.go,*.php,*.rb,*.js,*.ts,*.cs" .

# SQL sinks
grep -rn "query\|execute\|rawQuery\|db\.Raw\|fromRaw\|SqlCommand\|cursor\.execute\|db\.Exec" --include="*.java,*.py,*.go,*.php,*.rb,*.js,*.ts,*.cs" .

# Template/SSTI sinks
grep -rn "render\|template\|eval\|exec\|new Function\|assert\|preg_replace.*\/e" --include="*.js,*.ts,*.py,*.php,*.rb" .

# JNDI/SpEL (Java-specific)
grep -rn "InitialContext\|lookup\|SpelExpressionParser\|parseExpression" --include="*.java" .

# Log injection
grep -rn "log\.\(info\|debug\|warn\|error\).*req\.\|logger\.\(info\|debug\).*user\|console\.log.*req" --include="*.js,*.ts,*.java,*.py" .
```

#### D4 — Deserialization Sinks

```bash
grep -rn "ObjectInputStream\|readObject\|pickle\.loads\|marshal\.loads\|yaml\.load[^s]\|YAML\.load[^_]\|Marshal\.load\|JSON\.parse\|BinaryFormatter\|NetDataContractSerializer\|unserialize" --include="*.java,*.py,*.rb,*.php,*.cs" .
```

#### D5 — File Operation Sinks

```bash
grep -rn "readFile\|writeFile\|path\.join\|open(\|fopen\|include\|require\|File\.\|os\.path\|filepath\.\|ioutil\." --include="*.js,*.ts,*.py,*.php,*.go,*.java,*.rb" .
```

#### D6 — SSRF Sinks

```bash
grep -rn "fetch\|axios\|requests\.get\|http\.Get\|curl_exec\|RestTemplate\|WebClient\|HttpClient\|urllib\.request\|Net::HTTP" --include="*.js,*.ts,*.py,*.php,*.go,*.java,*.rb,*.cs" .
```

### Track B — Control-Driven (D2, D3, D8, D9)

Enumerate endpoints and verify security controls exist.

#### D2 — Authentication Controls

```bash
# Find auth middleware attachment
grep -rn "passport\|jwt\.verify\|authenticate\|requireAuth\|@PreAuthorize\|before_action.*authenticate\|middleware.*auth" --include="*.js,*.ts,*.java,*.rb,*.py,*.cs,*.go" .

# Find password storage
grep -rn "password\|passwd\|bcrypt\|argon2\|scrypt\|hashlib\|crypt\|MD5\|SHA1\|SHA-1" --include="*.java,*.py,*.go,*.php,*.rb,*.js,*.ts,*.cs" .

# Find JWT config
grep -rn "jwt\|HS256\|RS256\|secret.*=\|key.*=\|alg.*none\|verify.*false\|ignoreExpiration" --include="*.js,*.ts,*.java,*.py,*.go,*.cs" .
```

#### D3 — Authorization Controls

```bash
# Find resource access without ownership check
grep -rn "findById\|getById\|find_by_id\|where.*id.*=\|db\.First\|db\.Find" --include="*.js,*.ts,*.java,*.py,*.go,*.php,*.rb,*.cs" .

# Find admin/privileged endpoints
grep -rn "admin\|superuser\|is_staff\|@AdminOnly\|RequireRole\|hasRole" --include="*.js,*.ts,*.java,*.py,*.go,*.php,*.rb,*.cs" .
```

#### D8 — Configuration Issues

```bash
# CORS
grep -rn "cors\|Access-Control-Allow-Origin\|origin.*\*\|allowedOrigins" --include="*.js,*.ts,*.java,*.py,*.go,*.php,*.cs" .

# Debug/dev mode
grep -rn "DEBUG.*=.*True\|debug.*=.*true\|development\|isDev\|NODE_ENV" --include="*.py,*.js,*.ts,*.java,*.go" .

# Hardcoded secrets
grep -rn "api_key\|apikey\|secret\|password\|token\|private_key\|ACCESS_KEY\|SECRET_KEY" --include="*.js,*.ts,*.java,*.py,*.go,*.php,*.rb,*.cs,*.yaml,*.yml,*.json,*.env" . | grep -v "process\.env\|os\.environ\|viper\.\|config\.\|getenv\|\.example"
```

#### D9 — Business Logic

```bash
# Race condition candidates
grep -rn "check.*then.*update\|read.*then.*write\|balance\|inventory\|stock\|coupon\|quota\|limit" --include="*.js,*.ts,*.java,*.py,*.go,*.php,*.rb,*.cs" .

# Mass assignment
grep -rn "Object\.assign\|\.\.\.req\.body\|spread\|update_attributes\|assign_attributes\|bind\b" --include="*.js,*.ts,*.rb,*.py" .
```

### Track C — Semgrep (if connected)

```json
semgrep_ci_report: { "path": "<project_root>", "config": "auto", "baseline_ref": "origin/main" }
semgrep_secrets:   { "path": "<project_root>" }
semgrep_supply_chain: { "path": "<project_root>" }
```

Merge Semgrep findings into the candidate list with tag `[SEMGREP]`.

**Output:** raw candidate list (unverified). No findings reported yet.

---

## Phase 3 — Deep Taint Tracking & Validation (40%)

**Goal:** for each candidate from Phase 2, trace the full data flow and confirm exploitability.

### Taint Analysis Protocol

For each candidate:

1. **Identify the sink** — read the file, find the exact line (verify line number).
2. **Trace backward** — follow the variable up through callers using Read + Grep:
   - Is the value user-controlled (HTTP param, file upload, env var, DB read of user data)?
   - Does it pass through a sanitizer? If yes — is the sanitizer effective for this sink type?
   - Post-sanitization concatenation? (cleaned param + unvalidated param = bypass)
3. **Classify slot type** (for injection findings):
   - `SQL-val` → parameterized binding works
   - `SQL-ident` (table/column name) → binding does NOT work, needs allowlist
   - `CMD-arg` → array form prevents injection
   - `TEMPLATE` → sandboxing or allowlist required
4. **Confirm reachability** — is the sink reachable from an authenticated or unauthenticated entry point?
5. **Verdict:**
   - ✅ **Confirmed** — full source→sink path, user-controlled, no effective sanitizer
   - ⚠️ **Potential** — partial path traced, sanitizer present but possibly bypassable
   - ❌ **False positive** — sanitizer effective, not user-controlled, or unreachable

### Language-Specific Validation

Apply per detected language:

**Java:** Check if `PreparedStatement` is used correctly (no concatenation after `?`). Verify `@RequestParam`/`@PathVariable` reaches sink without going through a model with validation. Check `ObjectInputStream` source — does it read from network/file?

**Python:** Confirm `shell=True` with `subprocess` and user input. Check `yaml.load` — is `Loader=yaml.SafeLoader`? Is `pickle` source from untrusted input?

**Go:** Verify `fmt.Sprintf` result passed to `exec.Command` as single string vs array. Check `crypto/rand` vs `math/rand` usage context.

**PHP:** Confirm `$_GET`/`$_POST`/`$_REQUEST` reaches sink without `htmlspecialchars`/`intval`/`PDO`. Check `include`/`require` with user-controlled path.

**JavaScript/TypeScript:** Trace `req.body`/`req.params`/`req.query` to sink. Check if `eval`/`new Function` source is controllable. Verify prototype pollution: does `Object.assign({}, req.body)` merge into a shared prototype-accessible object?

**Ruby:** Confirm string interpolation in `system()`/backticks. Check `YAML.load` vs `YAML.safe_load`. Verify ActiveRecord raw string interpolation vs `?` placeholders.

**C#:** Check `SqlCommand` — `CommandText` built with `+` or `$"..."`. Verify `BinaryFormatter` source is untrusted input.

**Rust:** Flag `unsafe` blocks accessing data from network/file. Confirm `Command::new` uses `.arg()` separately vs format string.

**D7 — Crypto Validation:**

Read crypto usage sites and check:
- Algorithm: MD5/SHA1/DES/RC4 for security → flag. AES without GCM mode → flag.
- Key/IV: hardcoded, static, or derived from weak source → flag.
- Random: non-CSPRNG for security tokens → flag.
- TLS: `verify=False`/`rejectUnauthorized: false`/`InsecureSkipVerify: true` → flag.

**D10 — Supply Chain Validation:**

```bash
# Check for known-bad patterns
cat package.json | grep -E '"[^"]+": "\*|latest"'
cat requirements.txt | grep -v "=="
cat go.mod | grep -v "// indirect"
```

If Semgrep `semgrep_supply_chain` ran in Phase 2, cross-reference findings here.

---

## Phase 4 — Attack Chain Construction (15%)

**Goal:** for each confirmed finding, build an exploitable attack chain.

For every **Confirmed** finding:

1. **Entry point** → route/function the attacker calls
2. **Payload** → concrete example input (sanitized for report — no live weaponized payloads)
3. **Propagation path** → `entry_function() → helper() → dangerous_sink()` with file:line at each step
4. **Impact** → what an attacker achieves (data exfil, RCE, auth bypass, privilege escalation)
5. **Preconditions** → authenticated? specific role? network access?

**Severity scoring (CVSS-inspired):**

| Score | Label | Criteria |
|-------|-------|----------|
| Critical | 🔴 | Unauthenticated RCE, SQLi with data exfil, auth bypass → full access |
| High | 🟠 | Auth-required RCE, IDOR with PII, stored XSS in admin panel |
| Medium | 🟡 | Reflected XSS, info disclosure, SSRF to internal network |
| Low | 🟢 | Best practice deviation, weak crypto without active exploitation path |
| Info | ⚪ | Hardening suggestion, missing security header |

**Coverage gate check:**

Verify dimension coverage before Phase 5:
- D1 (Injection) — sink-driven, ≥30% of found sinks traced
- D2 (Auth) — baseline verified
- D3 (AuthZ) — ≥50% of resource endpoints checked
- D4–D6 — sink-driven checked
- D7–D8 — config baseline checked
- D9 (Business Logic) — race condition and mass assignment candidates reviewed
- D10 (Supply Chain) — dependency scan completed

If fewer than 8/10 dimensions covered: continue scanning before writing report. D1, D2, D3 are mandatory — never skip.

---

## Phase 5 — Write CODE-AUDIT.md + Triage (5%)

Write `CODE-AUDIT.md` to the project root using this template:

```markdown
# Code Security Audit

**Date:** YYYY-MM-DD
**Mode:** Quick / Standard / Deep
**Target:** <project name or path>
**Languages:** <detected>
**Frameworks:** <detected>
**Semgrep:** enabled ✓ (SAST + secrets + supply chain)  <!-- or: not connected -->
**Coverage:** D1 ✓ D2 ✓ D3 ✓ D4 ✓ D5 ✓ D6 ✓ D7 ✓ D8 ✓ D9 ✓ D10 ✓

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | X |
| 🟠 High | X |
| 🟡 Medium | X |
| 🟢 Low | X |
| ⚪ Info | X |
| **Total** | N |

---

## Findings

### [CRIT-001] 🔴 SQL Injection — `src/db/user.go:42`

**Dimension:** D1 — Injection
**Source:** Semgrep · `go.lang.security.audit.database.sql-string-formatting`  <!-- or: manual taint analysis -->
**Entry point:** `POST /api/users/search` → `SearchHandler()` → `db.Query()`
**Propagation:** `req.Body.query` → `SearchRequest.Query` → `fmt.Sprintf("SELECT ... WHERE name='%s'", q)` → `db.Query()`
**Payload example:** `' OR 1=1--`
**Impact:** Full database read; potential data exfiltration of all user records
**Preconditions:** Unauthenticated

**Suggested fix:** Use parameterized query: `db.Query("SELECT ... WHERE name=?", q)`

---

### [HIGH-001] 🟠 ...

---

## Informational

### [INFO-001] ⚪ Missing HSTS header — `src/server/middleware.go`
**Suggested fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## False Positives Reviewed

- `crypto/rand` usage in `pkg/token.go:18` — correctly uses CSPRNG, not flagged

---

## Coverage Matrix

| Dimension | Status | Findings |
|-----------|--------|----------|
| D1 Injection | ✅ checked | 2 critical |
| D2 Authentication | ✅ checked | 0 |
| D3 Authorization | ✅ checked | 1 high |
| D4 Deserialization | ✅ checked | 0 |
| D5 File Operations | ✅ checked | 1 medium |
| D6 SSRF | ✅ checked | 0 |
| D7 Encryption | ✅ checked | 1 low |
| D8 Configuration | ✅ checked | 1 info |
| D9 Business Logic | ✅ checked | 0 |
| D10 Supply Chain | ✅ checked | 0 |
```

**Rules:**
- One `###` heading per finding with ID (CRIT-001, HIGH-001, MED-001, LOW-001, INFO-001).
- Every finding must have: entry point, propagation chain, payload example, impact, preconditions.
- **Never modify source code. This is a report only.**

---

## Triage (Critical and High findings only)

After writing the file, triage each 🔴 Critical and 🟠 High finding one by one using a `question` tool call:

> **[CRIT-001] Finding title — file:line**
> Impact: ...
> Suggested fix: ...
>
> A — Fix it now
> B — Add to TODO
> C — Accept risk (ask for reason)
> D — False positive (remove from report)

Apply decisions:
- **A:** Apply fix. Update finding status in `CODE-AUDIT.md` to `✅ Fixed`.
- **B:** Append to `TODOS.md` (create if missing). Update status to `📋 TODO`.
- **C:** Ask for one-line reason. Update status to `⚠️ Accepted — <reason>`.
- **D:** Remove finding from `CODE-AUDIT.md`, add to False Positives section.

Final summary line:

```
Code audit complete → CODE-AUDIT.md (X critical, Y high, Z medium)
TODOs: N  |  Fixed: N  |  Accepted: N  |  False positives: N
```

---

## Suppressions — DO NOT flag

- Crypto used for non-security purposes (checksums, fingerprinting, deduplication)
- `Math.random()` for UI shuffle, A/B tests, retry jitter
- SQL queries with no user-controlled input in the data path
- Framework internals — only flag code the project authors wrote
- Test files (already excluded by file patterns)
- Findings in files outside the project root
