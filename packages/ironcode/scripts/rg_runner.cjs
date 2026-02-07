#!/usr/bin/env node
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const pattern = process.argv[2] || '**/*.ts'
const search = process.argv[3] || '.'

function runRg(pattern, search) {
  let filesOut = ''
  try {
    const r = spawnSync('rg', ['--files', '--glob', pattern], { cwd: search, encoding: 'utf8' })
    if (r.status !== 0 && r.stderr) throw new Error(r.stderr)
    filesOut = r.stdout || ''
  } catch (e) {
    filesOut = ''
  }
  const files = filesOut.split(/\r?\n/).filter(Boolean).map((f) => path.resolve(search, f))
  const list = files.map((f) => {
    let mtime = 0
    try { mtime = fs.statSync(f).mtimeMs } catch (e) {}
    return { path: f, mtime }
  })
  list.sort((a,b) => b.mtime - a.mtime)
  const limit = 100
  const truncated = list.length > limit
  const sliced = list.slice(0, limit)
  let output
  if (sliced.length === 0) output = 'No files found'
  else {
    output = sliced.map(x=>x.path).join('\n')
    if (truncated) output += '\n\n(Results are truncated. Consider using a more specific path or pattern.)'
  }
  return {
    title: path.relative(process.cwd(), search),
    metadata: { count: sliced.length, truncated },
    output,
  }
}

console.log(JSON.stringify(runRg(pattern, search)))
