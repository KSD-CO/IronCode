import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "path"
import fs from "fs"

// Resolve library path based on whether we're running from source or compiled binary
function resolveLibPath(): string {
  // Check if running from compiled binary by looking for bunfs in the path
  const isCompiled = import.meta.path?.includes("/$bunfs/") || import.meta.path?.includes("B:/~BUN/")

  if (isCompiled) {
    // Running from compiled binary - library should be next to executable
    // Use process.execPath which points to the actual binary
    const execPath = fs.realpathSync(process.execPath)
    const execDir = path.dirname(execPath)
    const libName = suffix === "dylib" || suffix === "so" ? `libironcode_tool.${suffix}` : `ironcode_tool.${suffix}`
    return path.join(execDir, libName)
  }

  // Running from source - use development path
  const packageRoot = import.meta.dir ? path.resolve(import.meta.dir, "../..") : process.cwd()
  return path.join(packageRoot, `native/tool/target/release/libironcode_tool.${suffix}`)
}

const libPath = resolveLibPath()

// Debug logging
if (process.env.DEBUG_FFI || !fs.existsSync(libPath)) {
  console.log(`[FFI Debug] Looking for native library at: ${libPath}`)
  console.log(`[FFI Debug] File exists: ${fs.existsSync(libPath)}`)
  console.log(`[FFI Debug] execPath: ${process.execPath}`)
  console.log(`[FFI Debug] import.meta.path: ${import.meta.path}`)

  if (!fs.existsSync(libPath)) {
    const dir = path.dirname(libPath)
    console.log(`[FFI Debug] Contents of ${dir}:`)
    try {
      const files = fs.readdirSync(dir)
      files.forEach((f) => console.log(`[FFI Debug]   - ${f}`))
    } catch (e) {
      console.log(`[FFI Debug] Could not list directory: ${e}`)
    }
  }
}

const lib = dlopen(libPath, {
  glob_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.ptr,
  },
  grep_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],
    returns: FFIType.ptr,
  },
  fuzzy_search_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.i32],
    returns: FFIType.ptr,
  },
  fuzzy_search_raw_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.i32],
    returns: FFIType.ptr,
  },
  ls_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.ptr,
  },
  read_ffi: {
    args: [FFIType.cstring, FFIType.i32, FFIType.i32],
    returns: FFIType.ptr,
  },
  read_raw_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  write_raw_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.i32,
  },
  stats_ffi: {
    args: [],
    returns: FFIType.ptr,
  },
  vcs_info_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  edit_replace_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.bool],
    returns: FFIType.ptr,
  },
  file_exists_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
  file_stat_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  extract_zip_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.i32,
  },
  parse_bash_command_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.ptr,
  },
  file_list_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.bool, FFIType.bool, FFIType.i32],
    returns: FFIType.ptr,
  },
  terminal_create: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.u16, FFIType.u16],
    returns: FFIType.ptr,
  },
  terminal_write: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.bool,
  },
  terminal_read: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_resize: {
    args: [FFIType.cstring, FFIType.u16, FFIType.u16],
    returns: FFIType.bool,
  },
  terminal_close: {
    args: [FFIType.cstring],
    returns: FFIType.bool,
  },
  terminal_get_info: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_update_title: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.bool,
  },
  terminal_check_status: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_mark_exited: {
    args: [FFIType.cstring],
    returns: FFIType.bool,
  },
  terminal_get_buffer: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_drain_buffer: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_clear_buffer: {
    args: [FFIType.cstring],
    returns: FFIType.bool,
  },
  terminal_get_buffer_info: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  terminal_list: {
    args: [],
    returns: FFIType.ptr,
  },
  terminal_cleanup_idle: {
    args: [FFIType.u64],
    returns: FFIType.ptr,
  },
  watcher_create_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.u64],
    returns: FFIType.ptr,
  },
  watcher_poll_events_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  watcher_pending_count_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
  watcher_remove_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  watcher_list_ffi: {
    args: [],
    returns: FFIType.ptr,
  },
  watcher_get_info_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  lock_acquire_read_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  lock_acquire_write_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  lock_check_read_ffi: {
    args: [FFIType.cstring, FFIType.u64],
    returns: FFIType.i32,
  },
  lock_check_write_ffi: {
    args: [FFIType.cstring, FFIType.u64],
    returns: FFIType.i32,
  },
  lock_finalize_read_ffi: {
    args: [FFIType.cstring, FFIType.u64],
    returns: FFIType.i32,
  },
  lock_finalize_write_ffi: {
    args: [FFIType.cstring, FFIType.u64],
    returns: FFIType.i32,
  },
  lock_release_read_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
  lock_release_write_ffi: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
  lock_get_stats_ffi: {
    args: [],
    returns: FFIType.ptr,
  },
  free_string: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
})

export function globFFI(pattern: string, search: string = ".") {
  const ptr = lib.symbols.glob_ffi(Buffer.from(pattern + "\0"), Buffer.from(search + "\0"))
  if (!ptr) throw new Error("glob_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function grepFFI(pattern: string, searchPath: string = ".", includeGlob?: string) {
  const includePtr = includeGlob ? Buffer.from(includeGlob + "\0") : null
  const ptr = lib.symbols.grep_ffi(Buffer.from(pattern + "\0"), Buffer.from(searchPath + "\0"), includePtr)
  if (!ptr) throw new Error("grep_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function fuzzySearchFFI(query: string, items: string[], limit?: number): string[] {
  const itemsJson = JSON.stringify(items)
  const limitValue = limit ?? -1 // -1 means no limit in Rust
  const ptr = lib.symbols.fuzzy_search_ffi(Buffer.from(query + "\0"), Buffer.from(itemsJson + "\0"), limitValue)
  if (!ptr) throw new Error("fuzzy_search_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function fuzzySearchRawFFI(query: string, items: string[], limit?: number): string[] {
  // Join items with newlines (avoid JSON serialization)
  const itemsNewlineSeparated = items.join("\n")
  const limitValue = limit ?? -1 // -1 means no limit in Rust

  const ptr = lib.symbols.fuzzy_search_raw_ffi(
    Buffer.from(query + "\0"),
    Buffer.from(itemsNewlineSeparated + "\0"),
    limitValue,
  )
  if (!ptr) throw new Error("fuzzy_search_raw_ffi returned null")

  const resultStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  // Parse newline-separated results (much faster than JSON)
  return resultStr ? resultStr.split("\n") : []
}

export function lsFFI(searchPath: string, ignorePatterns: string[] = []) {
  const ignoreJson = JSON.stringify(ignorePatterns)
  const ptr = lib.symbols.ls_ffi(Buffer.from(searchPath + "\0"), Buffer.from(ignoreJson + "\0"))
  if (!ptr) throw new Error("ls_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function readFFI(filepath: string, offset: number = 0, limit: number = 2000) {
  const ptr = lib.symbols.read_ffi(Buffer.from(filepath + "\0"), offset, limit)
  if (!ptr) throw new Error("read_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// Optimized read that skips JSON serialization - returns raw string content
export function readRawFFI(filepath: string): string {
  const ptr = lib.symbols.read_raw_ffi(Buffer.from(filepath + "\0"))
  if (!ptr) throw new Error("read_raw_ffi returned null")

  const content = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return content
}

// Write file with automatic parent directory creation
export function writeRawFFI(filepath: string, content: string): boolean {
  const result = lib.symbols.write_raw_ffi(Buffer.from(filepath + "\0"), Buffer.from(content + "\0"))
  if (result !== 0) {
    throw new Error(`Failed to write file: ${filepath}`)
  }
  return true
}

export interface SystemStats {
  cpu_usage: number
  memory_used_mb: number
  memory_total_mb: number
  memory_percent: number
}

export function getSystemStatsFFI(): SystemStats {
  const ptr = lib.symbols.stats_ffi()
  if (!ptr) throw new Error("stats_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export interface VcsInfo {
  branch: string
  added?: number
  modified?: number
  deleted?: number
}

export function getVcsInfoFFI(cwd: string = "."): VcsInfo | null {
  const ptr = lib.symbols.vcs_info_ffi(Buffer.from(cwd + "\0"))
  if (!ptr) return null

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export interface EditReplaceResponse {
  success: boolean
  content?: string
  error?: string
}

export function editReplaceFFI(content: string, oldString: string, newString: string, replaceAll: boolean): string {
  const ptr = lib.symbols.edit_replace_ffi(
    Buffer.from(content + "\0"),
    Buffer.from(oldString + "\0"),
    Buffer.from(newString + "\0"),
    replaceAll,
  )
  if (!ptr) throw new Error("edit_replace_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  const response: EditReplaceResponse = JSON.parse(jsonStr)
  if (!response.success) {
    throw new Error(response.error || "Unknown error from native replace")
  }

  return response.content!
}

// Check if file exists
export function fileExistsFFI(filepath: string): boolean {
  const result = lib.symbols.file_exists_ffi(Buffer.from(filepath + "\0"))
  return result === 1
}

// Get file metadata
export interface FileStat {
  exists: boolean
  size: number
  modified: number
  is_file: boolean
  is_dir: boolean
}

export function fileStatFFI(filepath: string): FileStat {
  const ptr = lib.symbols.file_stat_ffi(Buffer.from(filepath + "\0"))
  if (!ptr) throw new Error("file_stat_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// Extract zip archive
export function extractZipFFI(zipPath: string, destDir: string): void {
  const result = lib.symbols.extract_zip_ffi(Buffer.from(zipPath + "\0"), Buffer.from(destDir + "\0"))
  if (result !== 0) {
    throw new Error(`Failed to extract zip: ${zipPath} to ${destDir}`)
  }
}

// Parse bash command using tree-sitter
export interface BashParseResult {
  directories: string[]
  patterns: string[]
  always: string[]
}

export function parseBashCommandFFI(command: string, cwd: string): BashParseResult {
  const ptr = lib.symbols.parse_bash_command_ffi(Buffer.from(command + "\0"), Buffer.from(cwd + "\0"))
  if (!ptr) throw new Error("parse_bash_command_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// List files using ignore crate (replacement for ripgrep --files)
export function fileListFFI(
  cwd: string,
  globs: string[] = [],
  hidden: boolean = false,
  follow: boolean = false,
  maxDepth?: number,
): string[] {
  const globsJson = JSON.stringify(globs)
  const maxDepthValue = maxDepth ?? -1 // -1 means no limit
  const ptr = lib.symbols.file_list_ffi(
    Buffer.from(cwd + "\0"),
    Buffer.from(globsJson + "\0"),
    hidden,
    follow,
    maxDepthValue,
  )
  if (!ptr) throw new Error("file_list_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  const result = JSON.parse(jsonStr)

  // Check if result contains an error
  if (result.error) {
    throw new Error(result.error)
  }

  return result
}

// Terminal FFI Wrappers

export interface TerminalInfo {
  id: string
  pid: number
  cwd: string
  status: "running" | "exited"
  title: string
  command: string
  args: string[]
}

export interface TerminalOutput {
  data: Uint8Array
  buffered_size: number
}

export interface BufferInfo {
  size: number
  limit: number
  chunks: number
}

export function terminalCreateFFI(id: string, cwd: string | null, rows: number, cols: number): TerminalInfo {
  const cwdPtr = cwd ? Buffer.from(cwd + "\0") : null
  const ptr = lib.symbols.terminal_create(Buffer.from(id + "\0"), cwdPtr, rows, cols)
  if (!ptr) throw new Error("terminal_create returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function terminalWriteFFI(id: string, data: string): boolean {
  return lib.symbols.terminal_write(Buffer.from(id + "\0"), Buffer.from(data + "\0"))
}

export function terminalReadFFI(id: string): TerminalOutput {
  const ptr = lib.symbols.terminal_read(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_read returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  const result = JSON.parse(jsonStr)
  // Convert data array back to Uint8Array
  return {
    data: new Uint8Array(result.data),
    buffered_size: result.buffered_size,
  }
}

export function terminalResizeFFI(id: string, rows: number, cols: number): boolean {
  return lib.symbols.terminal_resize(Buffer.from(id + "\0"), rows, cols)
}

export function terminalCloseFFI(id: string): boolean {
  return lib.symbols.terminal_close(Buffer.from(id + "\0"))
}

export function terminalGetInfoFFI(id: string): TerminalInfo {
  const ptr = lib.symbols.terminal_get_info(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_get_info returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function terminalUpdateTitleFFI(id: string, title: string): boolean {
  return lib.symbols.terminal_update_title(Buffer.from(id + "\0"), Buffer.from(title + "\0"))
}

export function terminalCheckStatusFFI(id: string): "running" | "exited" {
  const ptr = lib.symbols.terminal_check_status(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_check_status returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function terminalMarkExitedFFI(id: string): boolean {
  return lib.symbols.terminal_mark_exited(Buffer.from(id + "\0"))
}

export function terminalGetBufferFFI(id: string): Uint8Array {
  const ptr = lib.symbols.terminal_get_buffer(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_get_buffer returned null")

  const base64Str = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  // Decode base64 to bytes
  return base64Decode(base64Str)
}

export function terminalDrainBufferFFI(id: string): Uint8Array {
  const ptr = lib.symbols.terminal_drain_buffer(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_drain_buffer returned null")

  const base64Str = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  // Decode base64 to bytes
  return base64Decode(base64Str)
}

export function terminalClearBufferFFI(id: string): boolean {
  return lib.symbols.terminal_clear_buffer(Buffer.from(id + "\0"))
}

export function terminalGetBufferInfoFFI(id: string): BufferInfo {
  const ptr = lib.symbols.terminal_get_buffer_info(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("terminal_get_buffer_info returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function terminalListFFI(): TerminalInfo[] {
  const ptr = lib.symbols.terminal_list()
  if (!ptr) throw new Error("terminal_list returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function terminalCleanupIdleFFI(timeoutSecs: number): string[] {
  const ptr = lib.symbols.terminal_cleanup_idle(BigInt(timeoutSecs))
  if (!ptr) throw new Error("terminal_cleanup_idle returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// Helper: Decode base64 string to Uint8Array
function base64Decode(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0)

  // Use Bun's built-in base64 decoder if available, otherwise manual
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return new Uint8Array(Buffer.from(base64, "base64"))
  }

  // Manual base64 decode (fallback)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i
  }

  const len = base64.length
  const paddingCount = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  const outputLen = (len * 3) / 4 - paddingCount
  const output = new Uint8Array(outputLen)

  let outputIndex = 0
  for (let i = 0; i < len; i += 4) {
    const a = lookup[base64.charCodeAt(i)]
    const b = lookup[base64.charCodeAt(i + 1)]
    const c = lookup[base64.charCodeAt(i + 2) || 0]
    const d = lookup[base64.charCodeAt(i + 3) || 0]

    output[outputIndex++] = (a << 2) | (b >> 4)
    if (outputIndex < outputLen) output[outputIndex++] = ((b & 15) << 4) | (c >> 2)
    if (outputIndex < outputLen) output[outputIndex++] = ((c & 3) << 6) | d
  }

  return output
}

// =====================
// File Watcher FFI
// =====================

export interface WatcherEvent {
  path: string
  event_type: "add" | "change" | "unlink"
  timestamp: number
}

export interface WatcherInfo {
  id: string
  path: string
  ignore_patterns: string[]
  max_queue_size: number
  event_count: number
}

export function watcherCreateFFI(
  id: string,
  path: string,
  ignorePatterns: string[] = [],
  maxQueueSize: number = 1000,
): void {
  const ignorePatternsJson = JSON.stringify(ignorePatterns)
  const ptr = lib.symbols.watcher_create_ffi(
    Buffer.from(id + "\0"),
    Buffer.from(path + "\0"),
    Buffer.from(ignorePatternsJson + "\0"),
    BigInt(maxQueueSize),
  )

  if (ptr) {
    const errorStr = new CString(ptr).toString()
    lib.symbols.free_string(ptr)
    throw new Error(errorStr)
  }
  // Success: ptr is null
}

export function watcherPollEventsFFI(id: string): WatcherEvent[] {
  const ptr = lib.symbols.watcher_poll_events_ffi(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("watcher_poll_events_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function watcherPendingCountFFI(id: string): number {
  const count = lib.symbols.watcher_pending_count_ffi(Buffer.from(id + "\0"))
  if (count < 0) throw new Error(`Watcher not found: ${id}`)
  return count
}

export function watcherRemoveFFI(id: string): void {
  const ptr = lib.symbols.watcher_remove_ffi(Buffer.from(id + "\0"))
  if (ptr) {
    const errorStr = new CString(ptr).toString()
    lib.symbols.free_string(ptr)
    throw new Error(errorStr)
  }
  // Success: ptr is null
}

export function watcherListFFI(): string[] {
  const ptr = lib.symbols.watcher_list_ffi()
  if (!ptr) throw new Error("watcher_list_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function watcherGetInfoFFI(id: string): WatcherInfo {
  const ptr = lib.symbols.watcher_get_info_ffi(Buffer.from(id + "\0"))
  if (!ptr) throw new Error("watcher_get_info_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// ============================================================================
// Lock FFI Functions
// ============================================================================

export interface LockAcquireResult {
  ticket: number
  acquired: boolean
}

export interface LockStats {
  total_locks: number
  active_readers: number
  active_writers: number
  waiting_readers: number
  waiting_writers: number
}

export function lockAcquireReadFFI(key: string): LockAcquireResult {
  const ptr = lib.symbols.lock_acquire_read_ffi(Buffer.from(key + "\0"))
  if (!ptr) throw new Error("lock_acquire_read_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function lockAcquireWriteFFI(key: string): LockAcquireResult {
  const ptr = lib.symbols.lock_acquire_write_ffi(Buffer.from(key + "\0"))
  if (!ptr) throw new Error("lock_acquire_write_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

export function lockCheckReadFFI(key: string, ticket: number): boolean {
  const result = lib.symbols.lock_check_read_ffi(Buffer.from(key + "\0"), ticket)
  if (result < 0) throw new Error("lock_check_read_ffi failed")
  return result === 1
}

export function lockCheckWriteFFI(key: string, ticket: number): boolean {
  const result = lib.symbols.lock_check_write_ffi(Buffer.from(key + "\0"), ticket)
  if (result < 0) throw new Error("lock_check_write_ffi failed")
  return result === 1
}

export function lockFinalizeReadFFI(key: string, ticket: number): void {
  const result = lib.symbols.lock_finalize_read_ffi(Buffer.from(key + "\0"), ticket)
  if (result !== 0) throw new Error("lock_finalize_read_ffi failed")
}

export function lockFinalizeWriteFFI(key: string, ticket: number): void {
  const result = lib.symbols.lock_finalize_write_ffi(Buffer.from(key + "\0"), ticket)
  if (result !== 0) throw new Error("lock_finalize_write_ffi failed")
}

export function lockReleaseReadFFI(key: string): void {
  const result = lib.symbols.lock_release_read_ffi(Buffer.from(key + "\0"))
  if (result !== 0) throw new Error("lock_release_read_ffi failed")
}

export function lockReleaseWriteFFI(key: string): void {
  const result = lib.symbols.lock_release_write_ffi(Buffer.from(key + "\0"))
  if (result !== 0) throw new Error("lock_release_write_ffi failed")
}

export function lockGetStatsFFI(): LockStats {
  const ptr = lib.symbols.lock_get_stats_ffi()
  if (!ptr) throw new Error("lock_get_stats_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}
