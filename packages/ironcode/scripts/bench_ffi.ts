#!/usr/bin/env bun
import { globFFI, readFFI } from "../src/tool/ffi"
import * as fs from "fs"

const iterations = 20
const filepath = process.argv[2] || "packages/ironcode/src/lsp/server.ts"
const offset = parseInt(process.argv[3] || "0", 10)
const limit = parseInt(process.argv[4] || "100", 10)

async function benchFFI() {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    readFFI(filepath, offset, limit)
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

const ffiTimes = await benchFFI()
const nodeTimes = benchNode()

const ffiStats = stats(ffiTimes)
const nodeStats = stats(nodeTimes)

console.log('Rust FFI (zero spawn overhead):')
console.log(`  avg: ${ffiStats.avg.toFixed(2)}ms, median: ${ffiStats.median.toFixed(2)}ms, min: ${ffiStats.min.toFixed(2)}ms, max: ${ffiStats.max.toFixed(2)}ms`)

console.log('\nNode.js (in-process):')
console.log(`  avg: ${nodeStats.avg.toFixed(2)}ms, median: ${nodeStats.median.toFixed(2)}ms, min: ${nodeStats.min.toFixed(2)}ms, max: ${nodeStats.max.toFixed(2)}ms`)

const speedup = nodeStats.avg / ffiStats.avg
console.log(`\nSpeedup: ${speedup.toFixed(2)}x ${speedup > 1 ? '(Rust FFI faster)' : '(Node.js faster)'}\n`)

// Test correctness
console.log('=== Testing correctness ===')
try {
  const ffiResult = readFFI(filepath, 0, 10)
  console.log('FFI test passed, read', ffiResult.metadata.count, 'lines')
} catch (e) {
  console.log('FFI test failed:', e instanceof Error ? e.message : String(e))
}
