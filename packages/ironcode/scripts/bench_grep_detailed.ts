#!/usr/bin/env bun
import { grepFFI } from "../src/tool/ffi"
import { Ripgrep } from "../src/file/ripgrep"

const iterations = 20
const pattern = process.argv[2] || "function"
const searchPath = process.argv[3] || "packages/ironcode/src/tool"
const includeGlob = process.argv[4]

async function benchFFI() {
  const times: number[] = []
  const memBefore = process.memoryUsage().heapUsed

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    grepFFI(pattern, searchPath, includeGlob)
    times.push(performance.now() - start)
  }

  const memAfter = process.memoryUsage().heapUsed
  const memDelta = (memAfter - memBefore) / 1024 / 1024

  return { times, memDelta }
}

async function benchRipgrep() {
  const rgPath = await Ripgrep.filepath()
  const times: number[] = []
  const memBefore = process.memoryUsage().heapUsed

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()

    const args = ["-nH", "--hidden", "--no-messages", "--field-match-separator=|", "--regexp", pattern]
    if (includeGlob) {
      args.push("--glob", includeGlob)
    }
    args.push(searchPath)

    const proc = Bun.spawn([rgPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    await new Response(proc.stdout).text()
    await proc.exited

    times.push(performance.now() - start)
  }

  const memAfter = process.memoryUsage().heapUsed
  const memDelta = (memAfter - memBefore) / 1024 / 1024

  return { times, memDelta }
}

function stats(times: number[]) {
  const sorted = times.slice().sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b) / times.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  return { avg, median, min, max, p95 }
}

console.log(
  `Pattern: ${pattern}, Search: ${searchPath}${includeGlob ? `, Include: ${includeGlob}` : ""}, Iterations: ${iterations}\n`,
)

const ffiResult = await benchFFI()
const rgResult = await benchRipgrep()

const ffiStats = stats(ffiResult.times)
const rgStats = stats(rgResult.times)

console.log("Rust FFI (zero spawn overhead):")
console.log(
  `  avg: ${ffiStats.avg.toFixed(2)}ms, median: ${ffiStats.median.toFixed(2)}ms, p95: ${ffiStats.p95.toFixed(2)}ms`,
)
console.log(`  min: ${ffiStats.min.toFixed(2)}ms, max: ${ffiStats.max.toFixed(2)}ms`)
console.log(`  memory delta: ${ffiResult.memDelta.toFixed(2)}MB`)

console.log("\nRipgrep (with spawn overhead):")
console.log(
  `  avg: ${rgStats.avg.toFixed(2)}ms, median: ${rgStats.median.toFixed(2)}ms, p95: ${rgStats.p95.toFixed(2)}ms`,
)
console.log(`  min: ${rgStats.min.toFixed(2)}ms, max: ${rgStats.max.toFixed(2)}ms`)
console.log(`  memory delta: ${rgResult.memDelta.toFixed(2)}MB`)

const speedup = rgStats.avg / ffiStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? "(Rust FFI faster)" : "(Ripgrep faster)"}\n`)

// Test correctness
console.log("=== Testing correctness ===")
try {
  const ffiTest = grepFFI(pattern, searchPath, includeGlob)
  console.log("FFI test passed, found", ffiTest.metadata.count, "matches")
} catch (e) {
  console.log("FFI test failed:", e instanceof Error ? e.message : String(e))
}
