import { writeRawFFI } from "../src/tool/ffi"
import { writeFileSync, existsSync, unlinkSync } from "fs"
import { join } from "path"

async function benchmark(content: string, label: string, iterations = 50) {
  const testFile = join(process.cwd(), "bench-write-test.txt")

  console.log(`\n${label} (${content.length} bytes, ${iterations} iterations)`)

  const ffiTimes: number[] = []
  const nodeTimes: number[] = []
  let ffiMemDelta = 0
  let nodeMemDelta = 0

  // Warm up
  for (let i = 0; i < 3; i++) {
    writeRawFFI(testFile, content)
    writeFileSync(testFile, content)
  }

  // Benchmark FFI
  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed
    const start = performance.now()
    writeRawFFI(testFile, content)
    const end = performance.now()
    const memAfter = process.memoryUsage().heapUsed
    ffiTimes.push(end - start)
    ffiMemDelta = Math.max(ffiMemDelta, memAfter - memBefore)
  }

  // Benchmark Node.js
  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed
    const start = performance.now()
    writeFileSync(testFile, content)
    const end = performance.now()
    const memAfter = process.memoryUsage().heapUsed
    nodeTimes.push(end - start)
    nodeMemDelta = Math.max(nodeMemDelta, memAfter - memBefore)
  }

  const stats = (times: number[]) => {
    const sorted = times.sort((a, b) => a - b)
    return {
      avg: times.reduce((a, b) => a + b) / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }

  const ffiStats = stats(ffiTimes)
  const nodeStats = stats(nodeTimes)

  console.log("Rust FFI:")
  console.log(
    `  avg: ${ffiStats.avg.toFixed(2)}ms, median: ${ffiStats.median.toFixed(2)}ms, p95: ${ffiStats.p95.toFixed(2)}ms`,
  )
  console.log(`  min: ${ffiStats.min.toFixed(2)}ms, max: ${ffiStats.max.toFixed(2)}ms`)
  console.log(`  peak memory delta: ${(ffiMemDelta / 1024 / 1024).toFixed(2)}MB`)

  console.log("\nNode.js (writeFileSync):")
  console.log(
    `  avg: ${nodeStats.avg.toFixed(2)}ms, median: ${nodeStats.median.toFixed(2)}ms, p95: ${nodeStats.p95.toFixed(2)}ms`,
  )
  console.log(`  min: ${nodeStats.min.toFixed(2)}ms, max: ${nodeStats.max.toFixed(2)}ms`)
  console.log(`  peak memory delta: ${(nodeMemDelta / 1024 / 1024).toFixed(2)}MB`)

  const speedup = nodeStats.avg / ffiStats.avg
  console.log(`\nSpeedup: ${speedup.toFixed(2)}x (${speedup > 1 ? "Rust FFI" : "Node.js"} faster)`)
  console.log(
    `Memory: ${((nodeMemDelta - ffiMemDelta) / 1024 / 1024).toFixed(2)}MB ${nodeMemDelta > ffiMemDelta ? "saved" : "more"}`,
  )

  // Clean up
  if (existsSync(testFile)) {
    unlinkSync(testFile)
  }
}

// Test cases
const small = "Hello, World!\n".repeat(10) // ~140 bytes
const medium = "Line of text here\n".repeat(500) // ~9 KB
const large = "Some content on this line\n".repeat(5000) // ~130 KB

await benchmark(small, "Small file (140 bytes)")
await benchmark(medium, "Medium file (9 KB)")
await benchmark(large, "Large file (130 KB)")
