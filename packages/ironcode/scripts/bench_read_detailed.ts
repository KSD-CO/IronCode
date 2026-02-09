import { readFFI } from "../src/tool/ffi"
import { readFileSync } from "fs"
import { join } from "path"

async function benchmark(filePath: string, offset: number, limit: number, iterations = 20) {
  console.log(`File: ${filePath}, Offset: ${offset}, Limit: ${limit}, Iterations: ${iterations}\n`)

  const ffiTimes: number[] = []
  const nodeTimes: number[] = []
  let ffiMemDelta = 0
  let nodeMemDelta = 0

  // Warm up
  for (let i = 0; i < 3; i++) {
    readFFI(filePath, offset, limit)
    const content = readFileSync(filePath, "utf-8")
    content
      .split("\n")
      .slice(offset, offset + limit)
      .join("\n")
  }

  // Benchmark FFI
  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed
    const start = performance.now()
    readFFI(filePath, offset, limit)
    const end = performance.now()
    const memAfter = process.memoryUsage().heapUsed
    ffiTimes.push(end - start)
    ffiMemDelta = Math.max(ffiMemDelta, memAfter - memBefore)
  }

  // Benchmark Node.js
  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed
    const start = performance.now()
    const content = readFileSync(filePath, "utf-8")
    content
      .split("\n")
      .slice(offset, offset + limit)
      .join("\n")
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

  console.log("\nNode.js (readFileSync + split):")
  console.log(
    `  avg: ${nodeStats.avg.toFixed(2)}ms, median: ${nodeStats.median.toFixed(2)}ms, p95: ${nodeStats.p95.toFixed(2)}ms`,
  )
  console.log(`  min: ${nodeStats.min.toFixed(2)}ms, max: ${nodeStats.max.toFixed(2)}ms`)
  console.log(`  peak memory delta: ${(nodeMemDelta / 1024 / 1024).toFixed(2)}MB`)

  const speedup = nodeStats.avg / ffiStats.avg
  console.log(`\nSpeedup: ${speedup.toFixed(2)}x (${speedup > 1 ? "Rust FFI" : "Node.js"} faster)`)
  console.log(`Memory saved: ${((nodeMemDelta - ffiMemDelta) / 1024 / 1024).toFixed(2)}MB`)

  console.log("\n=== Testing correctness ===")
  const ffiResult = readFFI(filePath, offset, limit)
  const nodeContent = readFileSync(filePath, "utf-8")
  const nodeLines = nodeContent.split("\n").slice(offset, offset + limit)

  console.log(`FFI lines: ${ffiResult.metadata.count}, Node lines: ${nodeLines.length}`)
  console.log(`FFI truncated: ${ffiResult.metadata.truncated}`)
  console.log("✅ Read test completed")
}

const filePath = process.argv[2] || "packages/ironcode/src/tool/grep.ts"
const offset = parseInt(process.argv[3] || "0")
const limit = parseInt(process.argv[4] || "1000")

benchmark(join(process.cwd(), filePath), offset, limit)
