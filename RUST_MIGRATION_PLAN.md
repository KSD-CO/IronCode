# Rust Migration Plan

## Overview

This document outlines the plan to migrate performance-critical TypeScript modules to Rust for improved performance and memory efficiency. The goal is to achieve 5-15x speedup on common operations while maintaining the existing TypeScript API surface.

**Current Status:**

- Total TypeScript: ~85,000 LOC
- Total Rust (native/tool): ~2,500 LOC
- Rust Adoption: ~3% (in critical paths)
- FFI Infrastructure: ✅ Mature and tested

---

## Architecture

```
┌──────────────────────────────────────┐
│   TypeScript Layer (Business Logic)  │
│   - Session management               │
│   - AI provider integration          │
│   - HTTP server (Hono)               │
│   - TUI (SolidJS + OpenTUI)          │
└─────────────┬────────────────────────┘
              │ FFI Calls (Bun FFI)
              ↓
┌──────────────────────────────────────┐
│   Rust Layer (Performance Critical)  │
│   Location: packages/ironcode/       │
│            native/tool/              │
│   - File operations                  │
│   - Text processing                  │
│   - Process management               │
│   - System utilities                 │
└──────────────────────────────────────┘
```

---

## Priority Tiers

### ✅ Already Implemented (Keep & Maintain)

- [x] Glob pattern matching (`glob.rs` - 80 LOC)
- [x] Grep/search (`grep.rs` - 171 LOC)
- [x] File listing (`ls.rs` - 154 LOC)
- [x] File read/write (`read.rs`, `write.rs` - 167 LOC)
- [x] Core edit/replace (`edit.rs` - 626 LOC)
- [x] VCS info (`vcs.rs` - 143 LOC)
- [x] System stats (`stats.rs` - 39 LOC)
- [x] Terminal/PTY basics (`terminal.rs` - 183 LOC)
- [x] Archive extraction (`archive.rs` - 50 LOC)

---

## Phase 1: Quick Wins (1-2 weeks)

**Goal:** Complete partially-migrated modules for immediate performance gains.

### 1.1 Complete Edit Tool Migration ⭐⭐⭐⭐⭐

**Status:** ✅ 100% complete

**Current State:**

- ✅ `native/tool/src/edit.rs` (626 LOC) - All 9 replacer strategies implemented
- ✅ `src/tool/edit.ts` (656 LOC) - Uses `editReplaceFFI()` for all replacements
- ✅ `src/tool/ffi.ts` - FFI bindings complete

**Completed Work:**

- [x] Migrate `SimpleReplacer` to Rust ✅
- [x] Migrate `LineTrimmedReplacer` to Rust ✅
- [x] Migrate `BlockAnchorReplacer` to Rust ✅
- [x] Migrate `WhitespaceNormalizedReplacer` to Rust ✅
- [x] Migrate `IndentationFlexibleReplacer` to Rust ✅
- [x] Migrate `EscapeNormalizedReplacer` to Rust ✅
- [x] Migrate `TrimmedBoundaryReplacer` to Rust ✅
- [x] Migrate `ContextAwareReplacer` to Rust ✅
- [x] Migrate `MultiOccurrenceReplacer` to Rust ✅
- [x] Migrate `levenshtein()` distance calculation to Rust ✅
- [x] Add FFI bindings (`edit_replace_ffi`) ✅
- [x] Update `src/tool/edit.ts` to use native functions (line 83) ✅

**Actual Results:**

All edit operations now use the native Rust implementation through `editReplaceFFI()`:

- TypeScript keeps only: Tool definition, file I/O, permission checking, diff generation, LSP integration
- Rust handles: All 9 replacement strategies, Levenshtein distance, pattern matching
- FFI overhead amortized over complex text transformations

**Files verified:**

- ✅ `packages/ironcode/native/tool/src/edit.rs` - All strategies complete
- ✅ `packages/ironcode/src/tool/edit.ts` - Uses FFI at line 83
- ✅ `packages/ironcode/src/tool/ffi.ts` - `editReplaceFFI()` function

**Benchmark Results (actual measurements from `bun script/bench-edit.ts`):**

| File Size     | TypeScript | Rust FFI  | Speedup          | Improvement     |
| ------------- | ---------- | --------- | ---------------- | --------------- |
| **10 lines**  | 61.57 µs   | 30.06 µs  | **2.05x faster** | 51.2% reduction |
| **100 lines** | 419.84 µs  | 250.86 µs | **1.67x faster** | 40.2% reduction |
| **1K lines**  | 6.17 ms    | 2.78 ms   | **2.22x faster** | 54.9% reduction |
| **5K lines**  | 126.06 ms  | 29.67 ms  | **4.25x faster** | 76.5% reduction |
| **10K lines** | 451.59 ms  | 74.88 ms  | **6.03x faster** | 83.4% reduction |

**Key Insights:**

- ✅ Rust is **consistently faster** at all file sizes (2-6x)
- ✅ Performance gap **increases** with file size
- ✅ 10K lines: 376ms saved per operation (83.4% faster)
- ✅ No FFI overhead visible - Rust faster even on small files
- ✅ Excellent scalability for large file operations

Run benchmark: `bun script/bench-edit.ts`

---

### 1.2 Complete VCS Operations ⭐⭐⭐⭐

**Status:** ✅ 100% complete

**Current State:**

- ✅ `native/tool/src/vcs.rs` (143 LOC) - Complete VCS implementation with libgit2
- ✅ `src/project/vcs.ts` (95 LOC) - Now uses native FFI exclusively

**Completed Work:**

- [x] Add libgit2 dependency to Cargo.toml (git2 = "0.19")
- [x] Implement native git status parsing
- [x] Implement file change counting in Rust
- [x] Create FFI bindings for VCS functions
- [x] Update TypeScript wrapper to use native functions exclusively
- [x] Remove all git process spawning (no more `$\`git ...``)
- [x] Tests passing (cargo test vcs, bun typecheck)

**Actual Results (Benchmark):**

- ✅ **1.83x faster** on average (45.3% reduction in latency)
- ✅ Old pattern: 17.25ms avg (2x git spawning)
- ✅ New pattern: 9.43ms avg (single libgit2 call)
- ✅ Time saved: 7.82ms per call, 781ms per 100 calls
- ✅ More consistent performance (p99: 17.71ms vs 24.36ms)
- ✅ Direct libgit2 integration (no process spawning)
- ✅ Better latency distribution across all percentiles

Run benchmark: `bun script/bench-vcs.ts`

**Files modified:**

- ✅ `packages/ironcode/native/tool/Cargo.toml` (libgit2 dependency)
- ✅ `packages/ironcode/native/tool/src/vcs.rs` (complete implementation)
- ✅ `packages/ironcode/src/project/vcs.ts` (native-only)
- ✅ `packages/ironcode/src/tool/ffi.ts` (FFI bindings)

---

## Phase 2: High-Impact Modules (3-4 weeks)

**Goal:** Migrate CPU-intensive and frequently-used modules.

### 2.1 File Search Module ⭐⭐⭐⭐⭐

**Status:** 0% (wraps external tools currently)

**Current State:**

- `src/file/index.ts` - File search orchestration
- `src/file/ripgrep.ts` - Wraps ripgrep binary
- Uses `fuzzysort` npm package for fuzzy search

**Migration Plan:**

- [ ] Create `native/tool/src/search.rs`
- [ ] Implement native fuzzy search algorithm (similar to fuzzysort)
- [ ] Integrate ripgrep as library (rg crate) instead of binary
- [ ] Implement directory tree building in Rust
- [ ] Add file ignore pattern matching (reuse glob logic)
- [ ] Create FFI bindings
- [ ] Update TypeScript wrapper

**Expected Outcome:**

- 5-10x faster fuzzy search
- Zero-copy file operations
- Integrated ripgrep (no process spawning)
- Better memory usage for large file lists

**Dependencies:**

- `fuzzy-matcher` crate (or custom implementation)
- `ignore` crate (for .gitignore patterns)
- Reuse existing glob logic

**Estimated Effort:** 2 weeks

**Files to create/modify:**

- `packages/ironcode/native/tool/src/search.rs` (new)
- `packages/ironcode/native/tool/src/lib.rs`
- `packages/ironcode/src/file/index.ts`
- `packages/ironcode/src/tool/ffi.ts`

---

### 2.2 Bash/Shell Tool ⭐⭐⭐⭐

**Status:** 0% (uses WASM tree-sitter currently)

**Current State:**

- `src/tool/bash.ts` (269 LOC)
- Uses `web-tree-sitter` (WASM) for parsing
- Uses `tree-sitter-bash` (WASM)
- Bun spawn for process management

**Migration Plan:**

- [ ] Create `native/tool/src/shell.rs`
- [ ] Add tree-sitter and tree-sitter-bash to Cargo dependencies
- [ ] Implement native command parsing (replace WASM)
- [ ] Implement process spawning with timeout
- [ ] Implement output buffering and streaming
- [ ] Add process tree killing (cross-platform)
- [ ] Create FFI bindings for parse, spawn, kill operations
- [ ] Update TypeScript wrapper to use native functions

**Expected Outcome:**

- 15x faster command parsing (no WASM overhead)
- Better process control and cleanup
- Native tree-sitter integration
- More efficient output streaming

**Dependencies:**

- `tree-sitter` crate
- `tree-sitter-bash` crate
- Native process APIs (already used in terminal.rs)

**Estimated Effort:** 1.5 weeks

**Files to create/modify:**

- `packages/ironcode/native/tool/Cargo.toml`
- `packages/ironcode/native/tool/src/shell.rs` (new)
- `packages/ironcode/native/tool/src/lib.rs`
- `packages/ironcode/src/tool/bash.ts`
- `packages/ironcode/src/tool/ffi.ts`

---

## Phase 3: Infrastructure Improvements (2-3 weeks)

**Goal:** Complete infrastructure pieces and optimize remaining bottlenecks.

### 3.1 Complete PTY/Terminal Implementation ⭐⭐⭐⭐

**Status:** 40% complete (basic terminal functions done)

**Current State:**

- ✅ `native/tool/src/terminal.rs` (183 LOC) - Basic create/read/write/resize
- ⏳ `src/pty/index.ts` (251 LOC) - Buffer management, WebSocket streaming in TS

**Remaining Work:**

- [ ] Implement native buffer management (2MB limit, chunking)
- [ ] Add native streaming support (remove intermediate copies)
- [ ] Implement process lifecycle tracking in Rust
- [ ] Add timeout and cleanup logic
- [ ] Create FFI bindings for buffer operations
- [ ] Update TypeScript to use native buffer management

**Expected Outcome:**

- 10x faster I/O operations
- Lower memory overhead for terminals
- Better buffer management
- Reduced FFI boundary crossings

**Estimated Effort:** 1 week

**Files to modify:**

- `packages/ironcode/native/tool/src/terminal.rs`
- `packages/ironcode/src/pty/index.ts`
- `packages/ironcode/src/tool/ffi.ts`

---

### 3.2 File Watcher Integration ⭐⭐⭐

**Status:** 0% (wraps @parcel/watcher)

**Current State:**

- `src/file/watcher.ts` (128 LOC)
- Uses `@parcel/watcher` (native C++ bindings)

**Migration Plan:**

- [ ] Create `native/tool/src/watcher.rs`
- [ ] Add `notify` crate for cross-platform file watching
- [ ] Implement event filtering and debouncing in Rust
- [ ] Add ignore pattern matching (reuse glob logic)
- [ ] Create FFI bindings with callback support
- [ ] Update TypeScript wrapper

**Expected Outcome:**

- Reduced FFI overhead
- Integrated filtering (no TypeScript callback overhead)
- Native debouncing

**Dependencies:**

- `notify` crate (cross-platform file watching)

**Estimated Effort:** 1 week

**Files to create/modify:**

- `packages/ironcode/native/tool/src/watcher.rs` (new)
- `packages/ironcode/src/file/watcher.ts`
- `packages/ironcode/src/tool/ffi.ts`

---

### 3.3 Lock/Concurrency Utilities ⭐⭐⭐

**Status:** 0% (pure TypeScript)

**Current State:**

- `src/util/lock.ts` (98 LOC)
- Custom reader-writer lock implementation
- Used for coordinating file access

**Migration Plan:**

- [ ] Create `native/tool/src/lock.rs`
- [ ] Use Rust's native `RwLock` or `tokio::sync::RwLock`
- [ ] Implement priority handling (writers over readers)
- [ ] Create FFI bindings for lock acquire/release
- [ ] Update TypeScript wrapper with RAII pattern

**Expected Outcome:**

- Better performance under high contention
- Memory safety guarantees
- OS-level lock optimization

**Estimated Effort:** 3-4 days

**Files to create/modify:**

- `packages/ironcode/native/tool/src/lock.rs` (new)
- `packages/ironcode/src/util/lock.ts`
- `packages/ironcode/src/tool/ffi.ts`

---

## Modules NOT to Migrate

### ❌ Business Logic Heavy

- Session Processor (`src/session/processor.ts`)
  - Reason: Deep TypeScript ecosystem integration (AI SDK, Drizzle ORM)
  - Heavy business logic, not CPU-bound
- Provider Integration (`src/provider/`)
  - Reason: AI SDK dependent, frequent API changes
- Agent System (`src/agent/`)
  - Reason: Business logic, orchestration layer

### ❌ HTTP/Network Layer

- Server Routes (`src/server/server.ts`, `src/server/routes/`)
  - Reason: Hono framework works well, OpenAPI auto-generation
- LSP Client (`src/lsp/`)
  - Reason: Protocol handling, library ecosystem

### ❌ UI Components

- TUI (`packages/app/`)
  - Reason: SolidJS + OpenTUI, not performance-critical

---

## Performance Targets

| Module          | Current (TS) | Target (Rust) | Speedup Goal |
| --------------- | ------------ | ------------- | ------------ |
| Edit/Replace    | ~10ms        | <0.5ms        | 20x          |
| File Search     | ~50ms        | <5ms          | 10x          |
| Fuzzy Search    | ~20ms        | <2ms          | 10x          |
| Bash Parsing    | ~15ms        | <1ms          | 15x          |
| Git Status      | ~30ms        | <3ms          | 10x          |
| PTY I/O         | 5ms/MB       | <0.5ms/MB     | 10x          |
| Lock Operations | ~1ms         | <0.1ms        | 10x          |

**Overall Goal:** 5-15x performance improvement on common operations.

---

## Testing Strategy

### For Each Migration:

1. **Benchmark before migration**
   - Use `bun test` with performance measurements
   - Record baseline numbers

2. **Implement Rust version**
   - Write comprehensive Rust tests (`cargo test`)
   - Write benchmarks (`cargo bench`)

3. **FFI Integration**
   - Test FFI boundary (serialization/deserialization)
   - Ensure memory safety (no leaks)

4. **TypeScript Integration Tests**
   - Ensure API compatibility
   - Run existing test suite
   - Compare outputs with TS version

5. **Performance Validation**
   - Compare benchmarks (Rust vs TypeScript)
   - Verify speedup targets met
   - Profile memory usage

### Existing Test Infrastructure:

- `bun test` - TypeScript unit tests
- `cargo test` - Rust unit tests
- `cargo bench` - Rust benchmarks (Criterion)
- `packages/ironcode/test/` - Integration tests

---

## FFI Guidelines

### Current FFI Pattern (from existing code):

```rust
// Rust side (native/tool/src/lib.rs)
#[no_mangle]
pub extern "C" fn function_name_ffi(
    param: *const c_char
) -> *mut c_char {
    // 1. Parse C strings safely
    let param_str = unsafe {
        if param.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(param).to_str().unwrap_or("")
    };

    // 2. Call Rust implementation
    match module::function(param_str) {
        Ok(output) => {
            // 3. Serialize to JSON
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe { let _ = CString::from_raw(s); }
    }
}
```

```typescript
// TypeScript side (src/tool/ffi.ts)
import { dlopen, FFIType, suffix } from "bun:ffi"

const lib = dlopen(`native/tool/target/release/libironcode_tool.${suffix}`, {
  function_name_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.cstring,
  },
  free_string: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },
})

export function functionName(param: string): Result {
  const ptr = lib.symbols.function_name_ffi(Buffer.from(param))
  if (!ptr) throw new Error("FFI call failed")

  const json = new CString(ptr)
  lib.symbols.free_string(ptr)

  return JSON.parse(json.toString())
}
```

### Best Practices:

- ✅ Always check for null pointers
- ✅ Use JSON for complex data structures
- ✅ Always free allocated strings
- ✅ Return null on errors (or use Result pattern)
- ✅ Use `serde` for serialization
- ✅ Keep FFI layer thin (business logic in pure Rust)

---

## Success Metrics

### Performance:

- [ ] 10x speedup on file search operations
- [ ] 20x speedup on text editing/replacement
- [ ] 15x speedup on command parsing
- [ ] 10x speedup on git operations
- [ ] Overall 5-15x improvement on common workflows

### Code Quality:

- [ ] All Rust tests passing (`cargo test`)
- [ ] All TypeScript tests passing (`bun test`)
- [ ] No memory leaks (valgrind/sanitizers)
- [ ] Code coverage >80% for new Rust code

### User Experience:

- [ ] No API changes (backward compatible)
- [ ] No regressions in functionality
- [ ] Faster perceived performance
- [ ] Lower CPU/memory usage

---

## Timeline Estimate

| Phase                   | Duration      | Modules                     |
| ----------------------- | ------------- | --------------------------- |
| Phase 1: Quick Wins     | 1-2 weeks     | Edit (finish), VCS (finish) |
| Phase 2: High Impact    | 3-4 weeks     | File Search, Bash Tool      |
| Phase 3: Infrastructure | 2-3 weeks     | PTY, Watcher, Lock          |
| **Total**               | **6-9 weeks** | **7 modules**               |

---

## Dependencies & Prerequisites

### Rust Crates to Add:

- `libgit2-sys` / `git2` - Git operations
- `fuzzy-matcher` - Fuzzy search
- `tree-sitter` - Command parsing
- `tree-sitter-bash` - Bash grammar
- `notify` - File watching
- `tokio` (optional) - Async runtime if needed

### Build Tools:

- Bun 1.3.8 (exact version)
- Cargo 1.70+
- Rust 1.70+

### Existing Infrastructure:

- ✅ FFI layer (`src/tool/ffi.ts`)
- ✅ Cargo workspace (`native/tool/`)
- ✅ Build scripts
- ✅ Test infrastructure

---

## Progress Tracking

Update this section as work progresses.

### Phase 1 Status: ✅ 100% Complete

- [x] Edit Tool (complete migration) ✅
- [x] VCS Operations (complete migration) ✅

### Phase 2 Status: 🔴 Not Started

- [ ] File Search Module
- [ ] Bash/Shell Tool

### Phase 3 Status: 🔴 Not Started

- [ ] PTY/Terminal (complete)
- [ ] File Watcher
- [ ] Lock Utilities

---

## References

- Existing Rust code: `packages/ironcode/native/tool/src/`
- FFI layer: `packages/ironcode/src/tool/ffi.ts`
- Build config: `packages/ironcode/native/tool/Cargo.toml`
- Repository guidelines: `AGENTS.md`
