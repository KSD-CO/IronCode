import { getSystemStatsFFI } from "../src/tool/ffi"

console.log("Testing system stats FFI...")

try {
  const stats = getSystemStatsFFI()

  console.log("\n📊 System Statistics:")
  console.log(`  CPU Usage: ${stats.cpu_usage.toFixed(1)}%`)
  console.log(`  Memory: ${stats.memory_used_mb}MB / ${stats.memory_total_mb}MB (${stats.memory_percent.toFixed(1)}%)`)

  console.log("\n✅ Stats test passed!")
} catch (e) {
  console.error("❌ Stats test failed:", e instanceof Error ? e.message : String(e))
}
