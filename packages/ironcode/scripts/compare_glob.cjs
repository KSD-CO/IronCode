#!/usr/bin/env node
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")

function runRust(pattern, search) {
  const manifest = path.join(process.cwd(), "packages/ironcode/native/tool/Cargo.toml")
  const bin = path.join(process.cwd(), "packages/ironcode/native/tool/target/release/ironcode-tool")
  try {
    const out = execFileSync("cargo", ["run", "--quiet", "--manifest-path", manifest, "--", "glob", pattern, search], {
      encoding: "utf8",
    })
    return JSON.parse(out)
  } catch (e) {
    // fallback to built binary
    const out = execFileSync(bin, ["glob", pattern, search], { encoding: "utf8" })
    return JSON.parse(out)
  }
}

function runRg(pattern, search) {
  let filesOut
  try {
    filesOut = execFileSync("rg", ["--files", "--glob", pattern], { cwd: search, encoding: "utf8" })
  } catch (e) {
    filesOut = ""
  }
  const files = filesOut
    .split(/\r?\n/)
    .filter(Boolean)
    .map((f) => path.resolve(search, f))
  const list = files.map((f) => {
    let mtime = 0
    try {
      mtime = fs.statSync(f).mtimeMs
    } catch (e) {}
    return { path: f, mtime }
  })
  list.sort((a, b) => b.mtime - a.mtime)
  const limit = 100
  const truncated = list.length >= limit
  const sliced = list.slice(0, limit)
  let output
  if (sliced.length === 0) output = "No files found"
  else {
    output = sliced.map((x) => x.path).join("\n")
    if (truncated) output += "\n\n(Results are truncated. Consider using a more specific path or pattern.)"
  }
  return {
    title: path.relative(process.cwd(), search),
    metadata: { count: sliced.length, truncated },
    output,
  }
}

function compare(a, b) {
  console.log("Rust title:", a.title)
  console.log("RG title:  ", b.title)
  console.log("Rust count:", a.metadata.count, "RG count:", b.metadata.count)
  const norm = (s) =>
    s
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith("("))
      .map((x) => {
        if (path.isAbsolute(x)) return path.normalize(x)
        // strip leading ./ if present
        const clean = x.startsWith("./") ? x.slice(2) : x
        return path.normalize(path.resolve(process.cwd(), clean))
      })

  const rustLines = norm(a.output)
  const rgLines = norm(b.output)

  const onlyInRust = rustLines.filter((x) => !rgLines.includes(x))
  const onlyInRg = rgLines.filter((x) => !rustLines.includes(x))

  console.log("\nOnly in Rust (first 20):")
  console.log(onlyInRust.slice(0, 20).join("\n") || "(none)")
  console.log("\nOnly in RG (first 20):")
  console.log(onlyInRg.slice(0, 20).join("\n") || "(none)")

  const same = onlyInRust.length === 0 && onlyInRg.length === 0
  console.log("\nMatch:", same)
  process.exit(same ? 0 : 3)
}

const pattern = process.argv[2] || "**/*.ts"
const search = process.argv[3] || "."

console.log("Pattern:", pattern, "Search:", search)
const rust = runRust(pattern, search)
const rg = runRg(pattern, search)
compare(rust, rg)
