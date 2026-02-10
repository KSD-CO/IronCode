# HTTP Layer Overhead Analysis

## Problem Statement

IronCode local CLI sử dụng HTTP server layer (Hono) ngay cả khi chạy local, tạo overhead không cần thiết cho memory và CPU.

## Current Architecture

```
CLI (run.ts)
  ↓
createIroncodeClient (@ironcode-ai/sdk)
  ↓
HTTP Request/Response (in-memory fetch)
  ↓
Hono Server (routing, middleware)
  ↓
routes/session.ts
  ↓
SessionPrompt.prompt() ← ACTUAL WORK
```

## Measured Overhead

### 1. Memory Overhead

**Server Module Import**: **27.11MB**

- Hono framework
- All route handlers (~30 routes)
- Middleware (CORS, auth, logging, SSE)
- OpenAPI spec generation
- WebSocket support

**Impact on 300MB limit**:

- 27MB = **9%** of total memory limit
- Reduces available memory for AI work from 240MB → 213MB
- **11.3% less headroom** for conversations

### 2. CPU/Performance Overhead

**Per API call overhead**: **32x slower**

- Direct call: 0.0004ms
- Through HTTP layer: 0.0117ms
- **Overhead**: 0.0113ms per call

**Per session overhead** (9 API calls typical):

- Direct: 0.003ms
- HTTP: 0.068ms
- **Overhead**: 0.066ms (+2611% slower)

**Real-world impact** (100 sessions, ~10min usage):

- Time wasted: 0.01s (negligible)
- Memory wasted: minimal due to GC

### 3. Why Current Architecture Exists

✅ **Unified API**: Same codebase for:

- CLI local mode
- Web UI (desktop app)
- Remote server (`ironcode serve`)
- Multi-client (TUI attach to server)

✅ **Type Safety**: SDK auto-generated from OpenAPI spec

✅ **Consistency**: Same API contract everywhere

✅ **Already Optimized**: Uses in-memory fetch (no TCP)

## Optimization Options

### Option 1: Direct Call for Local Mode ⭐ RECOMMENDED

**Benefits**:

- Save **27MB memory** (9% of limit)
- 32x faster per call
- No HTTP serialization/deserialization

**Costs**:

- Must maintain 2 code paths (direct + HTTP)
- Slightly more complex codebase
- Need to ensure both paths stay in sync

**Implementation**:

```typescript
// In run.ts
if (args.attach) {
  // Remote mode: use HTTP
  const sdk = createIroncodeClient({ baseUrl: args.attach })
  await execute(sdk)
} else {
  // Local mode: call directly
  await executeDirect()
}

async function executeDirect() {
  const sessionID = await Session.create({ title: "test" })
  await SessionPrompt.prompt({ sessionID, agent, model, parts })
  // ... direct calls to Session.* functions
}
```

### Option 2: Lazy Load Server (Hybrid)

**Benefits**:

- Only load Server when needed (serve/web commands)
- Keep CLI lightweight
- Still use HTTP for consistency

**Costs**:

- Still have HTTP overhead when loaded
- More complex module structure

**Implementation**:

```typescript
// Make Server import conditional
if (command === "serve" || command === "web") {
  const { Server } = await import("./server/server")
  // ... use Server
}
```

### Option 3: Extract Core Logic (Refactor)

**Benefits**:

- Clean separation of concerns
- Core logic independent of HTTP
- Best long-term architecture

**Costs**:

- Large refactoring effort
- Risk of breaking changes
- Need comprehensive testing

**Implementation**:

```typescript
// packages/ironcode-core (no HTTP dependencies)
export { Session, SessionPrompt, Tool, Agent }

// packages/ironcode-server (with HTTP)
import * as Core from "ironcode-core"
app.post("/session", async (c) => {
  return c.json(await Core.Session.create())
})
```

## Recommendation

### For Immediate Impact: Option 1 (Direct Call)

**Target**: `run` command (most common CLI usage)

**Estimated Savings**:

- Memory: **27MB** (9% of limit, 11.3% more headroom)
- CPU: **32x faster** per call (negligible real-world impact)
- Complexity: **Low** (just one conditional in run.ts)

**Implementation Effort**: **2-3 hours**

### Long-term: Option 3 (Refactor)

When time permits, refactor to separate core logic from HTTP layer for cleaner architecture.

## Decision

Given:

- **Memory is tight** (300MB limit, user wants lower)
- **27MB = 9% of limit** is significant
- **CPU overhead is 32x** (though absolute time small)
- **Implementation is straightforward**

**Decision**: ✅ **Implement Option 1 for `run` command**

Keep HTTP layer for:

- `serve` command (needs HTTP)
- `web` command (needs HTTP)
- `attach` mode (connecting to remote)

Use direct calls for:

- Local `run` command (default usage)
- Save 27MB memory
- Reduce CPU overhead

## Next Steps

1. Create `executeDirect()` function in run.ts
2. Replace SDK calls with direct Session/SessionPrompt calls
3. Add conditional: local mode uses direct, remote uses HTTP
4. Test both paths thoroughly
5. Measure actual memory savings
6. Update documentation
