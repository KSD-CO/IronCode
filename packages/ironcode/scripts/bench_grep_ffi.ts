#!/usr/bin/env bun
import { grepFFI } from "../src/tool/ffi"
import { Ripgrep } from "../src/file/ripgrep"
import { $ } from "bun"

const iterations = 20
const pattern = process.argv[2] || "function"
const searchPath = process.argv[3] || "packages/ironcode/src"
const includeGlob = process.argv[4]

async function benchFFI() {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    grepFFI(pattern, searchPath, includeGlob)
    times.push(performance.now() - start)
  }
  return times
}

async function benchRipgrep() {
  const rgPath = await Ripgrep.filepath()
  const times: number[] = []

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
  return times
}

function stats(times: number[]) {
  const sorted = times.slice().sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b) / times.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return { avg, median, min, max }
}

console.log(
  `Pattern: ${pattern}, Search: ${searchPath}${includeGlob ? `, Include: ${includeGlob}` : ""}, Iterations: ${iterations}\n`,
)

const ffiTimes = await benchFFI()
const rgTimes = await benchRipgrep()

const ffiStats = stats(ffiTimes)
const rgStats = stats(rgTimes)

console.log("Rust FFI (zero spawn overhead):")
console.log(
  `  avg: ${ffiStats.avg.toFixed(2)}ms, median: ${ffiStats.median.toFixed(2)}ms, min: ${ffiStats.min.toFixed(2)}ms, max: ${ffiStats.max.toFixed(2)}ms`,
)

console.log("\nRipgrep (with spawn overhead):")
console.log(
  `  avg: ${rgStats.avg.toFixed(2)}ms, median: ${rgStats.median.toFixed(2)}ms, min: ${rgStats.min.toFixed(2)}ms, max: ${rgStats.max.toFixed(2)}ms`,
)

const speedup = rgStats.avg / ffiStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? "(Rust FFI faster)" : "(Ripgrep faster)"}\n`)

// Test correctness
console.log("=== Testing correctness ===")
try {
  const ffiResult = grepFFI(pattern, searchPath, includeGlob)
  console.log("FFI test passed, found", ffiResult.metadata.count, "matches")
} catch (e) {
  console.log("FFI test failed:", e instanceof Error ? e.message : String(e))
}
