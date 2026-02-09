#!/usr/bin/env bun
import { grepFFI } from "../src/tool/ffi"
import { Ripgrep } from "../src/file/ripgrep"

const pattern = process.argv[2] || "function"
const searchPath = process.argv[3] || "packages/ironcode/src/tool"
const includeGlob = process.argv[4]

console.log(
  `Comparing FFI vs Ripgrep for pattern: "${pattern}" in ${searchPath}${includeGlob ? ` (${includeGlob})` : ""}\n`,
)

// Get FFI result
const ffiResult = grepFFI(pattern, searchPath, includeGlob)
console.log("FFI Result:")
console.log(`  Matches: ${ffiResult.metadata.count}`)
console.log(`  Truncated: ${ffiResult.metadata.truncated}`)

// Get Ripgrep result
const rgPath = await Ripgrep.filepath()
const args = ["-nH", "--hidden", "--no-messages", "--field-match-separator=|", "--regexp", pattern]
if (includeGlob) {
  args.push("--glob", includeGlob)
}
args.push(searchPath)

const proc = Bun.spawn([rgPath, ...args], {
  stdout: "pipe",
  stderr: "pipe",
})

const rgOutput = await new Response(proc.stdout).text()
await proc.exited

const rgLines = rgOutput
  .trim()
  .split(/\r?\n/)
  .filter((l) => l)

// Parse and process exactly like TypeScript version
const rgMatches = []
for (const line of rgLines) {
  const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
  if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

  const lineNum = parseInt(lineNumStr, 10)
  const lineText = lineTextParts.join("|")

  // Stat file to get modTime (exactly like TypeScript)
  const file = Bun.file(filePath)
  const stats = await file.stat().catch(() => null)
  if (!stats) continue

  rgMatches.push({
    path: filePath,
    modTime: stats.mtime.getTime(),
    lineNum,
    lineText,
  })
}

// Sort by modification time (newest first) - exactly like TypeScript
rgMatches.sort((a, b) => b.modTime - a.modTime)

// Truncate at 100 - exactly like TypeScript
const limit = 100
const truncated = rgMatches.length > limit
const finalRgMatches = truncated ? rgMatches.slice(0, limit) : rgMatches

console.log("\nRipgrep Result (after TypeScript processing):")
console.log(`  Total raw matches: ${rgLines.length}`)
console.log(`  After stat & sort: ${rgMatches.length}`)
console.log(`  Final matches: ${finalRgMatches.length}`)
console.log(`  Truncated: ${truncated}`)

// Parse both outputs
const ffiLines = ffiResult.output.split("\n")
const ffiMatches = new Map<string, Set<number>>()

let currentFile = ""
for (const line of ffiLines) {
  if (line.endsWith(":")) {
    currentFile = line.slice(0, -1)
  } else if (line.startsWith("  Line ")) {
    const match = line.match(/Line (\d+):/)
    if (match && currentFile) {
      if (!ffiMatches.has(currentFile)) {
        ffiMatches.set(currentFile, new Set())
      }
      ffiMatches.get(currentFile)!.add(parseInt(match[1]))
    }
  }
}

const rgMatchesMap = new Map<string, Set<number>>()
for (const m of finalRgMatches) {
  if (!rgMatchesMap.has(m.path)) {
    rgMatchesMap.set(m.path, new Set())
  }
  rgMatchesMap.get(m.path)!.add(m.lineNum)
}

// Compare
console.log("\n=== Comparison ===")

// Files only in FFI
const ffiOnlyFiles = [...ffiMatches.keys()].filter((f) => !rgMatchesMap.has(f))
if (ffiOnlyFiles.length > 0) {
  console.log("Files only in FFI:", ffiOnlyFiles)
}

// Files only in Ripgrep
const rgOnlyFiles = [...rgMatchesMap.keys()].filter((f) => !ffiMatches.has(f))
if (rgOnlyFiles.length > 0) {
  console.log("Files only in Ripgrep:", rgOnlyFiles)
}
Map

// Compare line numbers for common files
let differences = 0
for (const [file, ffiLineNums] of ffiMatches) {
  const rgLineNums = rgMatchesMap.get(file)
  if (!rgLineNums) continue

  const ffiOnly = [...ffiLineNums].filter((l) => !rgLineNums.has(l))
  const rgOnly = [...rgLineNums].filter((l) => !ffiLineNums.has(l))

  if (ffiOnly.length > 0 || rgOnly.length > 0) {
    differences++
    console.log(`\n${file}:`)
    if (ffiOnly.length > 0) {
      console.log(`  FFI only lines: ${ffiOnly.join(", ")}`)
    }
    if (rgOnly.length > 0) {
      console.log(`  Ripgrep only lines: ${rgOnly.join(", ")}`)
    }
  }
}

if (differences === 0 && ffiOnlyFiles.length === 0 && rgOnlyFiles.length === 0) {
  console.log("✅ Results match perfectly!")
} else {
  console.log(`\n❌ Found ${differences} files with differences`)
}

// Show sample output
console.log("\n=== Sample FFI Output (first 20 lines) ===")
console.log(ffiResult.output.split("\n").slice(0, 20).join("\n"))
