#!/usr/bin/env bun
import { $ } from "bun"
import path from "path"

const iterations = 10
const testCases = [
  { pattern: "**/*.ts", search: "packages/ironcode/src" },
  { pattern: "*.ts", search: "packages/ironcode/src/tool" },
  { pattern: "**/*.txt", search: "packages/ironcode/src" },
]

async function benchRg(pattern: string, search: string) {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await $`node ${path.join(import.meta.dir, "rg_runner.cjs")} ${pattern} ${search}`.quiet()
    times.push(performance.now() - start)
  }
  return times
}

async function benchRust(pattern: string, search: string) {
  const toolPath = path.join(import.meta.dir, "../native/tool/target/release/ironcode-tool")
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await $`${toolPath} glob ${pattern} ${search}`.quiet()
    times.push(performance.now() - start)
  }
  return times
}

function stats(times: number[]) {
  const sorted = times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return { avg, median, min, max }
}

console.log(`Benchmarking ${iterations} iterations each...\n`)

for (const tc of testCases) {
  console.log(`Test: glob "${tc.pattern}" in ${tc.search}`)
  
  const rgTimes = await benchRg(tc.pattern, tc.search)
  const rgStats = stats(rgTimes)
  
  const rustTimes = await benchRust(tc.pattern, tc.search)
  const rustStats = stats(rustTimes)
  
  console.log(`  Ripgrep (Node.js):`)
  console.log(`    avg: ${rgStats.avg.toFixed(2)}ms, median: ${rgStats.median.toFixed(2)}ms, min: ${rgStats.min.toFixed(2)}ms, max: ${rgStats.max.toFixed(2)}ms`)
  
  console.log(`  Rust:`)
  console.log(`    avg: ${rustStats.avg.toFixed(2)}ms, median: ${rustStats.median.toFixed(2)}ms, min: ${rustStats.min.toFixed(2)}ms, max: ${rustStats.max.toFixed(2)}ms`)
  
  const speedup = rgStats.avg / rustStats.avg
  console.log(`  Speedup: ${speedup.toFixed(2)}x ${speedup > 1 ? '(Rust faster)' : '(Ripgrep faster)'}`)
  console.log()
}
