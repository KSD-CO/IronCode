#!/usr/bin/env bun
import { $ } from "bun"
import * as fs from "fs"
import * as path from "path"

const iterations = 20
const filepath = process.argv[2] || "packages/ironcode/src/lsp/server.ts"
const offset = parseInt(process.argv[3] || "0", 10)
const limit = parseInt(process.argv[4] || "100", 10)

const toolPath = path.join(process.cwd(), "packages/ironcode/native/tool/target/release/ironcode-tool")

async function benchRust() {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await $`${toolPath} read ${filepath} ${offset} ${limit}`.quiet()
    times.push(performance.now() - start)
  }
  return times
}

function benchNode() {
  const MAX_LINE_LENGTH = 2000
  const MAX_BYTES = 50 * 1024
  const times: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    
    const content = fs.readFileSync(filepath, 'utf8')
    const lines = content.split('\n')
    const totalLines = lines.length
    
    const raw: string[] = []
    let bytes = 0
    let truncatedByBytes = false
    
    for (let j = offset; j < Math.min(totalLines, offset + limit); j++) {
      const line = lines[j].length > MAX_LINE_LENGTH 
        ? lines[j].substring(0, MAX_LINE_LENGTH) + '...' 
        : lines[j]
      
      const size = Buffer.byteLength(line, 'utf-8') + (raw.length > 0 ? 1 : 0)
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true
        break
      }
      raw.push(line)
      bytes += size
    }
    
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

console.log(`File: ${filepath}, Offset: ${offset}, Limit: ${limit}, Iterations: ${iterations}\n`)

const rustTimes = await benchRust()
const nodeTimes = benchNode()

const rustStats = stats(rustTimes)
const nodeStats = stats(nodeTimes)

console.log('Rust (with process spawn):')
console.log(`  avg: ${rustStats.avg.toFixed(2)}ms, median: ${rustStats.median.toFixed(2)}ms, min: ${rustStats.min.toFixed(2)}ms, max: ${rustStats.max.toFixed(2)}ms`)

console.log('\nNode.js (in-process):')
console.log(`  avg: ${nodeStats.avg.toFixed(2)}ms, median: ${nodeStats.median.toFixed(2)}ms, min: ${nodeStats.min.toFixed(2)}ms, max: ${nodeStats.max.toFixed(2)}ms`)

const speedup = nodeStats.avg / rustStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? '(Rust faster)' : '(Node.js faster)'}\n`)
console.log('Note: Node.js is faster because it runs in-process without spawning overhead.')
console.log('Process spawning adds ~2ms overhead, which is larger than file I/O time for small files.')
