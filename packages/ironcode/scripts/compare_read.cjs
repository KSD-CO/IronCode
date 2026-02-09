#!/usr/bin/env node
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")

function runRust(filepath, offset, limit) {
  const bin = path.join(process.cwd(), "packages/ironcode/native/tool/target/release/ironcode-tool")
  const args = ["read", filepath]
  if (offset !== undefined) args.push(String(offset))
  if (limit !== undefined) args.push(String(limit))

  try {
    const out = execFileSync(bin, args, { encoding: "utf8" })
    return JSON.parse(out)
  } catch (e) {
    throw new Error(`Rust failed: ${e.message}`)
  }
}

function runNode(filepath, offset = 0, limit = 2000) {
  const MAX_LINE_LENGTH = 2000
  const MAX_BYTES = 50 * 1024

  const content = fs.readFileSync(filepath, "utf8")
  const lines = content.split("\n")
  const totalLines = lines.length

  const raw = []
  let bytes = 0
  let truncatedByBytes = false

  for (let i = offset; i < Math.min(totalLines, offset + limit); i++) {
    const line = lines[i].length > MAX_LINE_LENGTH ? lines[i].substring(0, MAX_LINE_LENGTH) + "..." : lines[i]

    const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0)
    if (bytes + size > MAX_BYTES) {
      truncatedByBytes = true
      break
    }
    raw.push(line)
    bytes += size
  }

  const formatted = raw.map((line, index) => {
    return `${String(index + offset + 1).padStart(5, "0")}| ${line}`
  })

  let output = "<file>\n"
  output += formatted.join("\n")

  const lastReadLine = offset + raw.length
  const hasMoreLines = totalLines > lastReadLine
  const truncated = hasMoreLines || truncatedByBytes

  if (truncatedByBytes) {
    output += `\n\n(Output truncated at ${MAX_BYTES} bytes. Use 'offset' parameter to read beyond line ${lastReadLine})`
  } else if (hasMoreLines) {
    output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`
  } else {
    output += `\n\n(End of file - total ${totalLines} lines)`
  }
  output += "\n</file>"

  return {
    title: filepath,
    metadata: {
      count: raw.length,
      truncated,
    },
    output,
  }
}

function compare(rust, node) {
  console.log("Rust title:", rust.title)
  console.log("Node title:", node.title)
  console.log("Rust count:", rust.metadata.count, "Node count:", node.metadata.count)
  console.log("Rust truncated:", rust.metadata.truncated, "Node truncated:", node.metadata.truncated)

  // Compare line by line
  const rustLines = rust.output.split("\n")
  const nodeLines = node.output.split("\n")

  if (rustLines.length !== nodeLines.length) {
    console.log("\n❌ Line count mismatch:", rustLines.length, "vs", nodeLines.length)
    return false
  }

  let differences = 0
  for (let i = 0; i < Math.min(rustLines.length, nodeLines.length); i++) {
    if (rustLines[i] !== nodeLines[i]) {
      differences++
      if (differences <= 5) {
        console.log(`\nLine ${i} differs:`)
        console.log("Rust:", rustLines[i].substring(0, 100))
        console.log("Node:", nodeLines[i].substring(0, 100))
      }
    }
  }

  if (differences === 0) {
    console.log("\n✅ Perfect match!")
    return true
  } else {
    console.log(`\n❌ ${differences} lines differ`)
    return false
  }
}

const filepath = process.argv[2] || "packages/ironcode/src/tool/read.ts"
const offset = parseInt(process.argv[3] || "0", 10)
const limit = parseInt(process.argv[4] || "50", 10)

console.log("File:", filepath, "Offset:", offset, "Limit:", limit)

try {
  const rust = runRust(filepath, offset, limit)
  const node = runNode(filepath, offset, limit)
  const match = compare(rust, node)
  process.exit(match ? 0 : 1)
} catch (e) {
  console.error("Error:", e.message)
  process.exit(2)
}
