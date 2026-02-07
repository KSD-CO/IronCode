#!/usr/bin/env bun
import { globFFI } from "../src/tool/ffi"
import { $ } from "bun"

const iterations = 20
const pattern = process.argv[2] || "**/*.ts"
const search = process.argv[3] || "packages/ironcode/src"

async function benchFFI() {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    globFFI(pattern, search)
    times.push(performance.now() - start)
  }
  return times
}

async function benchRipgrep() {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await $`rg --files --glob ${pattern} ${search}`.quiet()
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

console.log(`Pattern: ${pattern}, Search: ${search}, Iterations: ${iterations}\n`)

const ffiTimes = await benchFFI()
const rgTimes = await benchRipgrep()

const ffiStats = stats(ffiTimes)
const rgStats = stats(rgTimes)

console.log('Rust FFI (zero spawn overhead):')
console.log(`  avg: ${ffiStats.avg.toFixed(2)}ms, median: ${ffiStats.median.toFixed(2)}ms, min: ${ffiStats.min.toFixed(2)}ms, max: ${ffiStats.max.toFixed(2)}ms`)

console.log('\nRipgrep (with spawn overhead):')
console.log(`  avg: ${rgStats.avg.toFixed(2)}ms, median: ${rgStats.median.toFixed(2)}ms, min: ${rgStats.min.toFixed(2)}ms, max: ${rgStats.max.toFixed(2)}ms`)

const speedup = rgStats.avg / ffiStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? '(Rust FFI faster)' : '(Ripgrep faster)'}\n`)

// Test correctness
console.log('=== Testing correctness ===')
try {
  const ffiResult = globFFI(pattern, search)
  const fileCount = ffiResult.metadata.count
  console.log('FFI test passed, found', fileCount, 'files')
  if (ffiResult.output) {
    const firstFile = ffiResult.output.split('\n')[0]
    console.log('First file:', firstFile)
  }
} catch (e) {
  console.log('FFI test failed:', e instanceof Error ? e.message : String(e))
}
