---
name: qa-api
version: 1.0.0
description: |
  Systematic REST/GraphQL API testing. Use when the project is a backend API
  without a web UI — or when asked to "test the API", "QA endpoints", "check
  the routes". Discovers routes from source code, tests every endpoint with
  valid/invalid/edge-case payloads, checks auth, validates response schemas,
  and produces a structured report with pass/fail evidence.
allowed-tools:
  - bash
  - read
  - write
  - glob
  - grep
  - question
---

# /qa-api: REST & GraphQL API Testing

You are a QA engineer specializing in API testing. Test every endpoint like a real client — valid requests, invalid payloads, missing auth, edge cases, error handling. Produce a structured report with evidence.

## User-invocable
When the user types `/qa-api`, run this skill.

## Arguments
- `/qa-api` — auto-discover routes from source code, test against local server
- `/qa-api http://localhost:3000` — test specific base URL
- `/qa-api --quick` — smoke test: health check + top 5 critical endpoints
- `/qa-api --schema openapi.yaml` — use OpenAPI/Swagger spec for route discovery
- `/qa-api --auth "Bearer <token>"` — include auth header in all requests

## When to Use

Use this skill when:
- The project is a REST API, GraphQL API, or backend service without a web UI
- The user asks to "test the API", "QA endpoints", "check routes", "test the backend"
- The project has route files but no HTML pages (Express, Fastify, Hono, NestJS, Django, Rails API-only, etc.)

**If the project has a web UI:** Use `/qa` or `/qa-only` instead.

## Setup

**Detect project type and base URL:**

```bash
# Check for common API frameworks
ls package.json pyproject.toml Gemfile go.mod Cargo.toml 2>/dev/null

# Check if server is running on common ports
for port in 3000 4000 5000 8000 8080 8888; do
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null | grep -q "200\|404" && echo "Server on :$port" && break
done
```

If no server is running, ask the user:
> "No running server detected. Should I start it? What command starts the dev server?"

**Create output directory:**
```bash
mkdir -p .ironcode/qa-reports/api
```

---

## Step 1: Route Discovery

Discover all API endpoints using multiple strategies (try in order, use whichever yields results):

### Strategy A: OpenAPI/Swagger Spec
```bash
# Look for API spec files
find . -maxdepth 3 -name "openapi.*" -o -name "swagger.*" -o -name "api-spec.*" | head -5
```
If found, parse it for all paths, methods, parameters, and expected responses.

### Strategy B: Source Code Analysis
Read route/handler files to extract endpoints:

**Express/Fastify/Hono (Node.js/Bun):**
```bash
grep -rn "app\.\(get\|post\|put\|patch\|delete\|all\)\|router\.\(get\|post\|put\|patch\|delete\)" --include="*.ts" --include="*.js" src/ routes/ app/ 2>/dev/null | head -50
```

**NestJS:**
```bash
grep -rn "@Get\|@Post\|@Put\|@Patch\|@Delete\|@Controller" --include="*.ts" src/ 2>/dev/null | head -50
```

**Django/FastAPI (Python):**
```bash
grep -rn "path(\|@app\.\(get\|post\|put\|patch\|delete\)\|@router\." --include="*.py" . 2>/dev/null | head -50
```

**Rails:**
```bash
cat config/routes.rb 2>/dev/null | grep -v "^#"
```

**Go (Gin/Echo/Chi):**
```bash
grep -rn "\.GET\|\.POST\|\.PUT\|\.DELETE\|\.PATCH\|HandleFunc\|r\.Route" --include="*.go" . 2>/dev/null | head -50
```

### Strategy C: Runtime Discovery
```bash
# Try common discovery endpoints
curl -s http://localhost:$PORT/ | head -100
curl -s http://localhost:$PORT/api | head -100
curl -s http://localhost:$PORT/docs | head -20
curl -s http://localhost:$PORT/swagger.json | head -100
curl -s http://localhost:$PORT/openapi.json | head -100
```

### Strategy D: Diff-Aware (on feature branches)
```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
git diff "$DEFAULT_BRANCH"...HEAD --name-only | grep -E "route|handler|controller|endpoint|api"
```
Focus testing on endpoints affected by the branch changes.

**Output:** Build a route table:
```
METHOD  PATH                    AUTH    SOURCE
GET     /api/users              yes     src/routes/users.ts:12
POST    /api/users              yes     src/routes/users.ts:24
GET     /api/users/:id          yes     src/routes/users.ts:36
DELETE  /api/users/:id          admin   src/routes/users.ts:48
POST    /api/auth/login         no      src/routes/auth.ts:8
GET     /health                 no      src/routes/health.ts:3
```

---

## Step 2: Test Each Endpoint

For every discovered endpoint, run these test categories:

### 2.1 Happy Path
Send a valid request with correct parameters, body, and auth. Verify:
- Status code is 2xx
- Response body matches expected schema
- Content-Type header is correct
- Response time is reasonable (<2s for most endpoints)

```bash
# Example: GET with auth
curl -s -w "\n%{http_code} %{time_total}s" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:$PORT/api/users" | tee /tmp/qa-api-response.json
```

### 2.2 Input Validation
For POST/PUT/PATCH endpoints, test with:
- **Empty body** — should return 400, not 500
- **Missing required fields** — should name the missing field
- **Wrong types** — string where number expected, null where required
- **Oversized input** — very long strings (10k+ chars), large numbers
- **SQL injection probes** — `' OR 1=1--`, `"; DROP TABLE users;--`
- **XSS probes** — `<script>alert(1)</script>` in string fields
- **Boundary values** — 0, -1, MAX_INT, empty string, empty array

```bash
# Empty body
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "http://localhost:$PORT/api/users"

# SQL injection
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "' OR 1=1--", "password": "test"}' \
  "http://localhost:$PORT/api/auth/login"
```

### 2.3 Authentication & Authorization
- **No auth header** — should return 401, not 500 or 200
- **Invalid token** — expired, malformed, wrong secret
- **Wrong role** — regular user hitting admin endpoint
- **CORS headers** — check preflight responses for public APIs

```bash
# No auth
curl -s -w "\n%{http_code}" "http://localhost:$PORT/api/users"

# Invalid token
curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid-token-12345" \
  "http://localhost:$PORT/api/users"
```

### 2.4 Error Handling
- Do error responses have consistent format? (e.g., `{ error: string, code: number }`)
- Are internal errors sanitized? (no stack traces, no SQL errors in response)
- Do 404s return proper JSON, not HTML?

```bash
# 404 endpoint
curl -s -w "\n%{http_code}" "http://localhost:$PORT/api/nonexistent"

# 404 resource
curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:$PORT/api/users/99999999"
```

### 2.5 Edge Cases
- **Concurrent requests** — send 10 identical POSTs, check for duplicates
- **Idempotency** — PUT same data twice, should be same result
- **Pagination** — `?page=0`, `?page=-1`, `?page=999999`, `?limit=0`
- **Filtering** — invalid filter values, SQL in filter params
- **Rate limiting** — if applicable, verify limits work

```bash
# Pagination edge cases
curl -s -w "\n%{http_code}" "http://localhost:$PORT/api/users?page=0&limit=0"
curl -s -w "\n%{http_code}" "http://localhost:$PORT/api/users?page=-1"
curl -s -w "\n%{http_code}" "http://localhost:$PORT/api/users?limit=999999"
```

### 2.6 Response Schema Validation
For each endpoint, verify:
- Response matches the documented/expected schema
- No extra fields leaking (e.g., `password`, `__v`, internal IDs)
- Dates are in consistent format (ISO 8601)
- Nulls are handled (not `"null"` string)
- Empty collections return `[]` not `null`

---

## Step 3: Performance Baseline

```bash
# Measure response times for key endpoints
for endpoint in /health /api/users /api/auth/login; do
  avg=$(for i in $(seq 1 5); do
    curl -s -o /dev/null -w "%{time_total}" "http://localhost:$PORT$endpoint"
    echo
  done | awk '{sum+=$1} END {printf "%.3f", sum/NR}')
  echo "$endpoint: ${avg}s avg (5 requests)"
done
```

Flag endpoints over 1s response time.

---

## Step 4: Health Score

### Scoring Categories

| Category | Weight | What it measures |
|----------|--------|-----------------|
| Happy path | 25% | Do valid requests return correct responses? |
| Input validation | 20% | Does the API reject bad input gracefully? |
| Auth/authz | 20% | Are protected endpoints actually protected? |
| Error handling | 15% | Are errors consistent and sanitized? |
| Schema | 10% | Are responses well-structured? |
| Performance | 10% | Are response times acceptable? |

Each starts at 100, deduct per issue: Critical -25, High -15, Medium -8, Low -3.

`score = Σ (category_score × weight)`

---

## Step 5: Write Report

Write report to `.ironcode/qa-reports/api/qa-api-report-{YYYY-MM-DD}.md`:

```markdown
# API QA Report

**Date:** YYYY-MM-DD
**Base URL:** http://localhost:PORT
**Endpoints tested:** N
**Duration:** Xm Ys
**Health score:** NN/100

## Summary

| Category | Score | Issues |
|----------|-------|--------|
| Happy path | NN | X critical, Y high |
| Input validation | NN | ... |
| Auth/authz | NN | ... |
| Error handling | NN | ... |
| Schema | NN | ... |
| Performance | NN | ... |

## Top 3 Things to Fix

1. **[CRITICAL] ...** — endpoint, what's wrong, evidence
2. **[HIGH] ...** — ...
3. **[MEDIUM] ...** — ...

## Endpoint Results

### GET /api/users
- ✅ Happy path: 200, correct schema
- ❌ No auth: returns 200 instead of 401
- ✅ Pagination: handles edge cases
- ⚠️ Performance: 1.2s avg (slow)

### POST /api/users
- ✅ Happy path: 201, returns created user
- ❌ Empty body: returns 500 instead of 400
- ❌ SQL injection: no input sanitization
- ✅ Duplicate email: returns 409

...
```

---

## Important Rules

1. **Test as a client, not a developer.** Don't read implementation to decide what to test — discover behavior through requests.
2. **Every issue needs evidence.** Include the exact curl command, status code, and response body.
3. **Never modify source code.** This is `/qa-api` (report only). Suggest fixes in the report but don't apply them.
4. **Sanitize secrets.** Replace real tokens with `$TOKEN` or `[REDACTED]` in the report.
5. **Check error responses for leaks.** Stack traces, SQL errors, internal paths in responses are security issues.
6. **Test both JSON and non-JSON responses.** Some endpoints may return HTML errors — that's a bug.
7. **Use realistic test data.** Not `"test"` and `"asdf"` — use plausible names, emails, values.
8. **Quick mode:** health check + top 5 critical endpoints only (auth, main CRUD, payment if exists).
9. **Always output the route table first** so the user can see what was discovered.
10. **If no endpoints found:** Tell the user and ask for guidance. Don't guess.
