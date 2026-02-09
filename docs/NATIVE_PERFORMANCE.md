# Native Performance Guidelines

## When to Use Rust FFI vs Native Bun/Node.js

Based on comprehensive benchmarking, here's when to use each approach:

### ✅ Use Rust FFI When:

1. **Compute-Heavy Operations** (FFI cost < compute cost)
   - Edit tool with 9 replacement strategies: 2x faster on 5K+ lines
   - Complex parsing/transformation logic
   - Fuzzy matching, similarity detection (Levenshtein)
   - Example: 215ms (TS) → 105ms (Rust) for 5K line edit

2. **Eliminating Process Spawns** (saves 5-50ms per spawn)
   - File glob: 2.74x faster (9.74ms → 3.55ms)
   - Grep search: 1.80x faster (34.84ms → 19.35ms)
   - VCS info: 1502x faster (55.59ms → 0.037ms) using libgit2
3. **Batch Operations** (amortizes FFI cost)
   - Processing multiple files in one call
   - Bulk transformations where setup cost is shared

### ❌ DON'T Use Rust FFI For:

1. **Simple File I/O** (FFI overhead dominates)
   - Read 1K lines: Bun 15x faster (34µs vs 517µs)
   - Write 1K lines: Bun 4x faster (71µs vs 281µs)
   - FFI overhead (~50-100µs) never amortizes for simple read/write
   - **Use**: `fs.readFileSync()` / `fs.writeFileSync()` instead

2. **Operations < 1ms** (FFI cost too high)
   - Quick lookups, simple transformations
   - Single string operations
   - **Rule of thumb**: If operation < 500µs in TS, don't FFI

3. **Memory-Only Operations** (no I/O benefit)
   - String manipulation, array operations
   - JSON parse/stringify
   - Bun's JS engine is already highly optimized

## FFI Overhead Breakdown

Every FFI call incurs these costs:

```
Total FFI overhead ≈ 50-100µs per call

Breakdown:
- Boundary crossing: ~20-30µs
- String serialization (to C): ~10-20µs
- JSON serialization (from Rust): ~20-40µs
- Memory allocation/free: ~10-20µs
```

## Optimization Strategies

### 1. Avoid Simple File I/O via FFI

**❌ BAD:**

```typescript
import { readFFI } from "./ffi"
const content = readFFI("/path/to/file.txt") // 517µs for 1K lines
```

**✅ GOOD:**

```typescript
import fs from "fs"
const content = fs.readFileSync("/path/to/file.txt", "utf-8") // 34µs for 1K lines
```

### 2. Use FFI for Compute, Not I/O

**❌ BAD:**

```typescript
// Reading then simple transformation
const content = readFFI(file) // FFI overhead
const upper = content.toUpperCase() // Could do in TS
```

**✅ GOOD:**

```typescript
// Complex transformation that justifies FFI
const content = fs.readFileSync(file, "utf-8")  // Fast I/O
const result = editReplaceFFI(content, old, new, replaceAll)  // Complex compute in Rust
```

### 3. Batch When Possible

**❌ BAD:**

```typescript
for (const file of files) {
  const info = vcsInfoFFI(file) // 100µs × N files
}
```

**✅ GOOD:**

```typescript
const infos = vcsInfoBatchFFI(files) // 100µs + (37µs × N files)
```

## Benchmark Results Summary

| Operation      | TypeScript | Rust FFI | Winner         | Reason                |
| -------------- | ---------- | -------- | -------------- | --------------------- |
| Edit 5K lines  | 215ms      | 105ms    | **Rust 2x**    | Compute > FFI cost    |
| Glob 100 files | 9.74ms     | 3.55ms   | **Rust 2.7x**  | No process spawn      |
| VCS info       | 55.59ms    | 0.037ms  | **Rust 1502x** | libgit2 vs subprocess |
| Read 1K lines  | 34µs       | 517µs    | **TS 15x**     | FFI dominates         |
| Write 1K lines | 71µs       | 281µs    | **TS 4x**      | FFI dominates         |

## Conclusion

**Golden Rule**: Only use Rust FFI when compute complexity > FFI overhead (~50-100µs)

- ✅ Complex algorithms, parsing, transformations
- ✅ Eliminating subprocess spawns
- ✅ Operations > 1ms
- ❌ Simple file I/O
- ❌ Quick operations < 500µs
- ❌ Memory-only transforms

When in doubt, benchmark! Use `script/bench-read-write-memory.ts` as a template.
