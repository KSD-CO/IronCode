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

### ⚠️ Use Rust FFI Carefully For:

1. **Simple File I/O** (FFI overhead is significant but we still use it)
   - Read 1K lines ~49µs vs Bun 34µs (1.4x slower)
   - Write 1K lines: Bun 4x faster even with optimization
   - **We use native Rust for consistency** despite performance trade-off
   - **Optimization**: Use `readRawFFI`/`writeRawFFI` instead of `readFFI`/`writeFFI`

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
Original FFI overhead (with JSON) ≈ 400-500µs per call

Breakdown:
- Boundary crossing: ~20-30µs
- String serialization (to C): ~10-20µs
- JSON serialization (from Rust): ~300-400µs ⚠️ MAJOR BOTTLENECK
- Memory allocation/free: ~10-20µs

Optimized FFI overhead (no JSON) ≈ 50-100µs per call

Breakdown:
- Boundary crossing: ~20-30µs
- String serialization (to C): ~10-20µs
- Raw string return: ~10-20µs ✅ OPTIMIZED
- Memory allocation/free: ~10-20µs
```

**Key insight**: Removing JSON serialization improves performance by 75-90%, but Bun's native APIs are still faster for simple I/O.

## Optimization Strategies

### 1. Use Raw FFI Functions for Read/Write

IronCode uses native Rust read/write for consistency, but we optimize by skipping JSON serialization:

**❌ BAD (with JSON overhead):**

```typescript
import { readFFI } from "./ffi"
const result = readFFI("/path/to/file.txt", 0, 1000) // 517µs for 1K lines
const content = result.output
```

**✅ GOOD (optimized, no JSON):**

```typescript
import { readRawFFI } from "./ffi"
const content = readRawFFI("/path/to/file.txt") // 49µs for 1K lines
// Manual line slicing if needed
const lines = content.split("\n").slice(offset, offset + limit)
```

**For writes:**

```typescript
// ❌ BAD (with JSON)
import { writeFFI } from "./ffi"
writeFFI("/path/to/file.txt", content) // Returns JSON result

// ✅ GOOD (optimized)
import { writeRawFFI } from "./ffi"
writeRawFFI("/path/to/file.txt", content) // Returns boolean
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

| Operation             | TypeScript | Rust FFI (JSON) | Rust FFI (Raw) | Winner         | Reason                       |
| --------------------- | ---------- | --------------- | -------------- | -------------- | ---------------------------- |
| Edit 5K lines         | 215ms      | 105ms           | N/A            | **Rust 2x**    | Compute > FFI cost           |
| Glob 100 files        | 9.74ms     | 3.55ms          | N/A            | **Rust 2.7x**  | No process spawn             |
| VCS info              | 55.59ms    | 0.037ms         | N/A            | **Rust 1502x** | libgit2 vs subprocess        |
| Read 500 lines (29KB) | 18µs       | 248µs           | 27µs           | **TS 1.5x**    | FFI overhead (even w/o JSON) |
| Read 1K lines (58KB)  | 29µs       | 443µs           | 47µs           | **TS 1.6x**    | FFI overhead                 |
| Read 5K lines (304KB) | 120µs      | 732µs           | 194µs          | **TS 1.6x**    | FFI overhead                 |
| Write 1K lines        | 49µs       | 193µs           | 139µs          | **TS 2.8x**    | FFI overhead                 |
| Write 5K lines        | 135µs      | 636µs           | 408µs          | **TS 3x**      | FFI overhead                 |

**Key Findings:**

- JSON serialization adds 300-400µs overhead (75-90% of total FFI cost)
- Removing JSON improves read performance by 80-90%
- Even optimized, Rust FFI is 1.5-3x slower than Bun native for simple I/O
- We use Rust for consistency across the native tool suite

## Conclusion

**Golden Rule**: Only use Rust FFI when compute complexity > FFI overhead (~50-100µs for raw, ~400µs with JSON)

- ✅ Complex algorithms, parsing, transformations
- ✅ Eliminating subprocess spawns
- ✅ Operations > 1ms
- ⚠️ Simple file I/O (we use optimized raw FFI despite being slower than Bun native)
- ❌ Quick operations < 500µs
- ❌ Memory-only transforms

**For Read/Write operations:**

- Always use `readRawFFI`/`writeRawFFI` (not `readFFI`/`writeFFI`)
- This removes JSON serialization overhead (75-90% improvement)
- Still 1.5-3x slower than Bun native, but acceptable for consistency

When in doubt, benchmark! Use `script/bench-optimized-io.ts` as a template.
