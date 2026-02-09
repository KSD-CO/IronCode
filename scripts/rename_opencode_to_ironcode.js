#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

const root = process.cwd()

const excludeDirs = [".git", "node_modules", "target", "dist", "packages/*/node_modules"]

function shouldSkip(file) {
  for (const ex of excludeDirs) {
    if (file.includes(ex)) return true
  }
  return false
}

function processFile(file) {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile()) return
    if (stat.size > 1024 * 1024) return // skip large files
    const ext = path.extname(file)
    if ([".png", ".jpg", ".jpeg", ".gif", ".wasm", ".zip", ".tar", ".gz", ".ico"].includes(ext)) return
    let txt = fs.readFileSync(file, "utf8")
    let orig = txt
    // Case-sensitive replacements
    txt = txt.replace(/IronCode/g, "IronCode")
    txt = txt.replace(/ironcode/g, "ironcode")
    txt = txt.replace(/@ironcode-ai/g, "@ironcode-ai")
    txt = txt.replace(/ironcode.ai/g, "ironcode.ai")
    if (txt !== orig) {
      fs.writeFileSync(file, txt, "utf8")
      console.log("patched", file)
    }
  } catch (e) {
    // ignore
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir)
  for (const name of entries) {
    const file = path.join(dir, name)
    if (shouldSkip(file)) continue
    try {
      const stat = fs.statSync(file)
      if (stat.isDirectory()) walk(file)
      else processFile(file)
    } catch (e) {}
  }
}

console.log("Starting rename ironcode -> ironcode in", root)
walk(root)
console.log("Done")
