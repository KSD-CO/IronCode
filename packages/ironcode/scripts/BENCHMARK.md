# Benchmark Results: Rust vs Node.js + Ripgrep

## Performance Comparison

| Test Case                              | Ripgrep (Node.js) | Rust   | Speedup    |
| -------------------------------------- | ----------------- | ------ | ---------- |
| `**/*.ts` in `packages/ironcode/src`   | 61.48ms           | 2.59ms | **23.75x** |
| `*.ts` in `packages/ironcode/src/tool` | 61.28ms           | 2.01ms | **30.52x** |
| `**/*.txt` in `packages/ironcode/src`  | 60.54ms           | 1.95ms | **31.00x** |

## Key Differences

### Output Format

- **Ripgrep**: Returns absolute paths
- **Rust**: Returns relative paths (more consistent with glob pattern matching)

### Performance

- **Rust implementation is 23-31x faster**
- Ripgrep has ~60ms overhead from Node.js process spawning
- Rust native binary has minimal startup overhead (~2ms total)

### Architecture

- **Ripgrep**: Node.js script → spawn rg process → parse output → stat files → sort
- **Rust**: Single compiled binary using `ignore` + `globset` crates, direct file system access

## Conclusion

The Rust implementation provides:

- ✅ **30x performance improvement**
- ✅ Consistent relative path output
- ✅ Same metadata format (title, count, truncated)
- ✅ No external dependencies (rg binary not required)
- ✅ Lower memory footprint
