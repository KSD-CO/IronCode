#!/usr/bin/env node
const { spawnSync } = require("child_process")
const path = require("path")
const fs = require("fs")

const ITER = parseInt(process.argv[4] || "5", 10)
const filepath = process.argv[2] || "packages/ironcode/src/tool/read.ts"
const offset = parseInt(process.argv[3] || "0", 10)
const limit = 100

const repoRoot = process.cwd()
const bin = path.join(repoRoot, "packages/ironcode/native/tool/target/release/ironcode-tool")

function runRust(iter) {
  const results = []
  for (let i = 0; i < iter; i++) {
    const t0 = process.hrtime.bigint()
    const r = spawnSync(bin, ["read", filepath, String(offset), String(limit)], { encoding: "utf8" })
    const t1 = process.hrtime.bigint()
    const wallMs = Number(t1 - t0) / 1e6
    results.push({ status: r.status, wallMs })
  }
  return results
}

function runNode(iter) {
  const results = []
  const MAX_LINE_LENGTH = 2000
  const MAX_BYTES = 50 * 1024

  for (let i = 0; i < iter; i++) {
    const t0 = process.hrtime.bigint()

    const content = fs.readFileSync(filepath, "utf8")
    const lines = content.split("\n")
    const totalLines = lines.length

    const raw = []
    let bytes = 0
    let truncatedByBytes = false

    for (let j = offset; j < Math.min(totalLines, offset + limit); j++) {
      const line = lines[j].length > MAX_LINE_LENGTH ? lines[j].substring(0, MAX_LINE_LENGTH) + "..." : lines[j]

      const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0)
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true
        break
      }
      raw.push(line)
      bytes += size
    }

    const t1 = process.hrtime.bigint()
    const wallMs = Number(t1 - t0) / 1e6
    results.push({ status: 0, wallMs })
  }
  return results
}

function stats(runs) {
  const times = runs.map((r) => r.wallMs)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const sorted = [...times].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return { avg, median, min, max }
}

console.log("File:", filepath, "Offset:", offset, "Limit:", limit, "Iterations:", ITER)

const rustRuns = runRust(ITER)
const nodeRuns = runNode(ITER)

const rustStats = stats(rustRuns)
const nodeStats = stats(nodeRuns)

console.log("\n== Rust ==")
console.log(
  `avg: ${rustStats.avg.toFixed(2)}ms, median: ${rustStats.median.toFixed(2)}ms, min: ${rustStats.min.toFixed(2)}ms, max: ${rustStats.max.toFixed(2)}ms`,
)

console.log("\n== Node.js ==")
console.log(
  `avg: ${nodeStats.avg.toFixed(2)}ms, median: ${nodeStats.median.toFixed(2)}ms, min: ${nodeStats.min.toFixed(2)}ms, max: ${nodeStats.max.toFixed(2)}ms`,
)

const speedup = nodeStats.avg / rustStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? "(Rust faster)" : "(Node.js faster)"}`)
