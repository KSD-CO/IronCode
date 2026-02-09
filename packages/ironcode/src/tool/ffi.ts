import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "path"

// Resolve from package root (packages/ironcode)
const packageRoot = import.meta.dir ? path.resolve(import.meta.dir, "../..") : process.cwd()
const libPath = path.join(packageRoot, `native/tool/target/release/libironcode_tool.${suffix}`)

const lib = dlopen(libPath, {
  glob_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
    returns: FFIType.ptr,
  },
  grep_ffi: {
    args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],
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
  write_ffi: {
    args: [FFIType.cstring, FFIType.cstring],
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

export function writeFFI(filepath: string, content: string) {
  const ptr = lib.symbols.write_ffi(Buffer.from(filepath + "\0"), Buffer.from(content + "\0"))
  if (!ptr) throw new Error("write_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// Optimized write that skips JSON serialization - returns success code
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
