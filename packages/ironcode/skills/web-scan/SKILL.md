---
name: web-scan
description: |
  Active web security scanner. Probes a live URL for security misconfigurations,
  exposed sensitive files, HTTP security headers, SSL/TLS issues, CORS policy,
  and information disclosure. Uses only curl + python3 — no extra tools needed.
  Only scan targets you own or have explicit written authorization to test.
---

# /web-scan: Web Security Scanner

You are running the `/web-scan` workflow. Actively probe a live target for security vulnerabilities and misconfigurations.

> **IMPORTANT:** Only run against targets you own or have explicit written authorization to test. Unauthorized scanning may be illegal.

---

## Step 1: Get target

If the user provided a URL as an argument, use it.
Otherwise ask: **"Enter the target URL to scan (e.g. https://example.com):"**

Normalize the target:
- If no scheme, prepend `https://`
- Strip trailing slash
- Extract base origin: `ORIGIN=https://example.com`

---

## Step 2: Connectivity check

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$ORIGIN" 
```

If result is `000` (connection failed/timeout): output **"Target unreachable — aborting."** and stop.

---

## Step 3: Run all probes

Run all probes below. Collect all findings. Do NOT stop on errors — continue to the next probe.

---

### Probe A — HTTP Security Headers

Fetch headers only:

```bash
curl -s -I --max-time 10 -L "$ORIGIN"
```

Check for presence/correctness of each header:

| Header | Expected | Risk if missing/wrong |
|--------|----------|-----------------------|
| `Strict-Transport-Security` | `max-age` ≥ 31536000, ideally `includeSubDomains; preload` | Downgrade to HTTP, MITM |
| `Content-Security-Policy` | Must exist, should not be `default-src *` or `unsafe-inline` alone | XSS |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `no-referrer` or `strict-origin-when-cross-origin` | Info leak |
| `Permissions-Policy` | Should exist | Feature abuse |
| `Server` | Should NOT expose version (e.g. `nginx/1.18.0`) | Fingerprinting |
| `X-Powered-By` | Should NOT exist | Fingerprinting |
| `X-AspNet-Version` | Should NOT exist | Fingerprinting |

Flag as CRITICAL if HSTS or CSP is missing entirely.
Flag as CRITICAL if `Server` or `X-Powered-By` exposes a version number.

---

### Probe B — SSL/TLS Configuration

```bash
curl -s -o /dev/null -w "%{ssl_verify_result}\n%{scheme}\n" --max-time 10 "$ORIGIN"
curl -s -o /dev/null --max-time 10 --tlsv1.0 --tls-max 1.0 "$ORIGIN" && echo "TLS1.0_SUPPORTED" || echo "TLS1.0_REJECTED"
curl -s -o /dev/null --max-time 10 --tlsv1.1 --tls-max 1.1 "$ORIGIN" && echo "TLS1.1_SUPPORTED" || echo "TLS1.1_REJECTED"
```

Check:
- `ssl_verify_result != 0` → CRITICAL: invalid/self-signed certificate
- Scheme is `http` (not https) → CRITICAL: no TLS at all
- `TLS1.0_SUPPORTED` → CRITICAL: TLS 1.0 enabled (deprecated, POODLE/BEAST)
- `TLS1.1_SUPPORTED` → CRITICAL: TLS 1.1 enabled (deprecated)

Also check if HTTP redirects to HTTPS:

```bash
curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "http://${TARGET_HOST}"
```

If HTTP does NOT redirect to HTTPS → CRITICAL.

---

### Probe C — Sensitive File Exposure

Probe each path. A `200` response with non-trivial body is a finding.

```bash
PATHS=(
  "/.git/HEAD"
  "/.git/config"
  "/.env"
  "/.env.local"
  "/.env.production"
  "/config.json"
  "/config.yml"
  "/config.yaml"
  "/secrets.json"
  "/credentials.json"
  "/.DS_Store"
  "/backup.zip"
  "/backup.sql"
  "/dump.sql"
  "/db.sqlite"
  "/database.sql"
  "/wp-config.php"
  "/web.config"
  "/phpinfo.php"
  "/info.php"
  "/server-status"
  "/server-info"
  "/.htaccess"
  "/robots.txt"
  "/sitemap.xml"
  "/crossdomain.xml"
  "/clientaccesspolicy.xml"
  "/.well-known/security.txt"
  "/api/swagger"
  "/api/swagger.json"
  "/api/openapi.json"
  "/swagger-ui.html"
  "/v1/api-docs"
  "/actuator"
  "/actuator/health"
  "/actuator/env"
  "/actuator/mappings"
  "/_profiler"
  "/debug/pprof"
  "/__debug__"
  "/admin"
  "/admin/login"
  "/.well-known/jwks.json"
)

for path in "${PATHS[@]}"; do
  status=$(curl -s -o /tmp/webscan_body -w "%{http_code}" --max-time 8 -L "$ORIGIN$path")
  body_size=$(wc -c < /tmp/webscan_body)
  if [ "$status" = "200" ] && [ "$body_size" -gt 10 ]; then
    echo "FOUND $status $path ($body_size bytes)"
  fi
done
```

Severity by path type:
- `.git/`, `.env*`, `config.*`, `secrets.*`, `credentials.*`, `*.sql`, `*.sqlite` → **CRITICAL**
- `phpinfo.php`, `server-status`, `actuator/env`, `actuator/mappings` → **CRITICAL**
- `swagger*`, `api-docs`, `openapi*` → **INFORMATIONAL** (check if auth-gated)
- `robots.txt`, `sitemap.xml` → **INFORMATIONAL** (read content for interesting paths)
- `admin` returning 200 → **INFORMATIONAL**
- `.well-known/security.txt` missing → **INFORMATIONAL**

---

### Probe D — CORS Policy

```bash
curl -s -I --max-time 10 \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  "$ORIGIN/api" 2>/dev/null
```

Also try a few common API paths: `/api`, `/api/v1`, `/graphql`, `/v1`

Check response headers:
- `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` → **CRITICAL**
- `Access-Control-Allow-Origin: https://evil.com` (reflected origin) → **CRITICAL**
- `Access-Control-Allow-Origin: null` → **CRITICAL** (null origin bypass)
- `Access-Control-Allow-Methods: *` or includes `DELETE, PUT, PATCH` without auth check → **INFORMATIONAL**

---

### Probe E — Information Disclosure via Error Pages

```bash
curl -s --max-time 10 "$ORIGIN/this-path-does-not-exist-$(date +%s)"
curl -s --max-time 10 -X POST -d "test=<script>" "$ORIGIN/this-path-does-not-exist-$(date +%s)"
```

Inspect response body for:
- Stack traces (keywords: `at `, `Traceback`, `Exception`, `Error:`, `caused by`) → **CRITICAL**
- Framework version strings (`Laravel`, `Django`, `Express`, `Rails`, `Spring Boot`) → **INFORMATIONAL**
- Internal file paths (`/var/www`, `/home/`, `C:\Users\`, `/app/`) → **INFORMATIONAL**
- Database error messages (`SQL syntax`, `ORA-`, `mysql_fetch`, `pg_query`) → **CRITICAL**
- XSS reflection: check if `<script>` appears unescaped in response → **CRITICAL**

---

### Probe F — Cookie Security Flags

```bash
curl -s -I --max-time 10 -c /tmp/webscan_cookies "$ORIGIN" | grep -i "set-cookie"
```

For each `Set-Cookie` header check:
- Missing `HttpOnly` → **INFORMATIONAL** (CRITICAL if it's a session/auth cookie by name: `session`, `token`, `auth`, `jwt`, `sid`)
- Missing `Secure` → **CRITICAL** if site uses HTTPS
- Missing `SameSite` → **INFORMATIONAL**
- `SameSite=None` without `Secure` → **CRITICAL**

---

### Probe G — HTTP Methods

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X OPTIONS "$ORIGIN" -I
curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X TRACE "$ORIGIN"
curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X PUT "$ORIGIN/test-$(date +%s)"
```

Check:
- TRACE returns `200` → **CRITICAL** (Cross-Site Tracing / XST attack)
- PUT returns `200` or `201` → **CRITICAL** (arbitrary file upload possible)
- OPTIONS `Allow:` header exposes `TRACE`, `CONNECT`, `PUT`, `DELETE` → **INFORMATIONAL**

---

## Step 4: Output findings

```
Web Scan: $ORIGIN
──────────────────────────────────────
N issues found (X critical, Y informational)

CRITICAL (immediate action required):
[HEADER]   Missing HSTS — HTTP downgrade possible
[SSL]      TLS 1.0 supported — deprecated protocol, disable in server config
[FILE]     /.env exposed (200, 432 bytes) — likely contains secrets
[CORS]     Reflected origin on /api — credential theft possible
[COOKIE]   session= missing Secure flag — transmittable over HTTP

INFORMATIONAL:
[HEADER]   Server: nginx/1.18.0 — remove version from server_tokens
[FILE]     /swagger-ui.html accessible — verify auth is required
[FILE]     /robots.txt found — review for sensitive path disclosure
[COOKIE]   auth= missing SameSite — CSRF risk on older browsers

──────────────────────────────────────
Scan complete. X critical issue(s) require immediate remediation.
```

- Print ALL findings.
- Each finding: `[CATEGORY]  Description — remediation hint`
- End with summary count.
- If zero issues: `Web Scan: No issues found on $ORIGIN`

---

## Step 5: Enhanced scan (optional)

After outputting findings, ask:
**"Run enhanced scan? This checks for common CVE paths, default credentials on admin panels, and API endpoint discovery. (y/n)"**

If yes, run additional probes:

```bash
# Common CVE indicator paths
CVE_PATHS=(
  "/cgi-bin/bash"
  "/.git/FETCH_HEAD"
  "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php"
  "/solr/admin/info/system"
  "/telescope/requests"
  "/horizon/api/jobs"
  "/.aws/credentials"
  "/etc/passwd"
  "/proc/self/environ"
)

# API discovery
API_PATHS=(
  "/graphql"
  "/api/users"
  "/api/user"
  "/api/me"
  "/api/admin"
  "/api/config"
  "/api/health"
  "/api/version"
  "/api/debug"
  "/v1/users"
  "/v2/users"
)

for path in "${CVE_PATHS[@]}" "${API_PATHS[@]}"; do
  status=$(curl -s -o /tmp/webscan_body -w "%{http_code}" --max-time 8 -L "$ORIGIN$path")
  if [ "$status" = "200" ]; then
    body_size=$(wc -c < /tmp/webscan_body)
    echo "FOUND $status $path ($body_size bytes)"
  fi
done
```

Report any new findings appended to the previous output.

---

## Important Rules

- **Authorization first.** If the user has not confirmed they own or are authorized to test the target, ask before running any probes.
- **No destructive tests.** Do not attempt actual exploitation — only passive probing and header inspection.
- **Rate-limit naturally.** Each curl has `--max-time 8-10`. Do not add artificial delays.
- **Interpret results.** A 200 response alone is not a finding — check body content and context.
- **No credentials.** Do not attempt login, brute force, or authentication bypass.

---

## If enhanced tools are available

If `nuclei` is installed (`which nuclei`), append this after Step 3:

```bash
nuclei -u "$ORIGIN" -severity critical,high -silent
```

If `nikto` is installed (`which nikto`):

```bash
nikto -h "$ORIGIN" -nointeractive -maxtime 60
```

Merge their output into the findings report under `[NUCLEI]` / `[NIKTO]` categories.
