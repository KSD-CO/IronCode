import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "path"

// Resolve from workspace root
const workspaceRoot = process.cwd()
const libPath = path.join(
  workspaceRoot,
  `packages/ironcode/native/tool/target/release/libironcode_tool.${suffix}`
)

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
  const ptr = lib.symbols.grep_ffi(
    Buffer.from(pattern + "\0"),
    Buffer.from(searchPath + "\0"),
    includePtr
  )
  if (!ptr) throw new Error("grep_ffi returned null")
  
  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)
  
  return JSON.parse(jsonStr)
}

export function lsFFI(searchPath: string, ignorePatterns: string[] = []) {
  const ignoreJson = JSON.stringify(ignorePatterns)
  const ptr = lib.symbols.ls_ffi(
    Buffer.from(searchPath + "\0"),
    Buffer.from(ignoreJson + "\0")
  )
  if (!ptr) throw new Error("ls_ffi returned null")
  
  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)
  
  return JSON.parse(jsonStr)
}

export function readFFI(filepath: string, offset: number = 0, limit: number = 2000) {
  const ptr = lib.symbols.read_ffi(
    Buffer.from(filepath + "\0"),
    offset,
    limit
  )
  if (!ptr) throw new Error("read_ffi returned null")
  
  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)
  
  return JSON.parse(jsonStr)
}
