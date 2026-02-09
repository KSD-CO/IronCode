#!/usr/bin/env node
const { spawnSync } = require("child_process")
const path = require("path")

const ITER = parseInt(process.argv[3] || "3", 10)
const pattern = process.argv[2] || "**/*.ts"
const search = process.argv[4] || "."

const repoRoot = process.cwd()
const manifest = path.join(repoRoot, "packages/ironcode/native/tool/Cargo.toml")
const bin = path.join(repoRoot, "packages/ironcode/native/tool/target/release/ironcode-tool")

function ensureBinary() {
  const build = spawnSync("cargo", ["build", "--release", "--manifest-path", manifest], {
    encoding: "utf8",
    stdio: "inherit",
  })
  if (build.status !== 0) throw new Error("cargo build failed")
}

function runTimed(cmd, args) {
  // use /usr/bin/time -l to capture resource usage on macOS
  const full = ["/usr/bin/time", "-l", cmd, ...args]
  const t0 = process.hrtime.bigint()
  const r = spawnSync(full[0], full.slice(1), { encoding: "utf8" })
  const t1 = process.hrtime.bigint()
  const wallMs = Number(t1 - t0) / 1e6
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, wallMs }
}

function benchRust(iter) {
  ensureBinary()
  const results = []
  for (let i = 0; i < iter; i++) {
    const r = runTimed("bash", ["-lc", `${bin} glob ${escapeArg(pattern)} ${escapeArg(search)}`])
    results.push(r)
  }
  return results
}

function benchRgNode(iter) {
  const runner = path.join(repoRoot, "packages/ironcode/scripts/rg_runner.cjs")
  const results = []
  for (let i = 0; i < iter; i++) {
    const r = runTimed("node", [runner, pattern, search])
    results.push(r)
  }
  return results
}

function escapeArg(s) {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function summarize(name, runs) {
  const walls = runs.map((r) => r.wallMs)
  const avg = walls.reduce((a, b) => a + b, 0) / walls.length
  console.log(`\n== ${name} ==`)
  console.log(`runs: ${runs.length}, avg wall ms: ${avg.toFixed(2)}`)
  runs.forEach((r, i) => {
    console.log(
      `run ${i}: status=${r.status} wallMs=${r.wallMs.toFixed(2)} stderr-lines=${r.stderr ? r.stderr.split(/\r?\n/).length : 0}`,
    )
  })
  console.log("raw stderr of last run:\n", runs[runs.length - 1].stderr)
}

console.log("Pattern:", pattern, "Search:", search, "Iterations:", ITER)
const rustRuns = benchRust(ITER)
const rgRuns = benchRgNode(ITER)
summarize("Rust binary", rustRuns)
summarize("rg+node", rgRuns)
