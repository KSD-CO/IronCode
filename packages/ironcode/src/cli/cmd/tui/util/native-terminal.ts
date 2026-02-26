import { dlopen, FFIType, suffix, ptr, CString, toArrayBuffer } from "bun:ffi"
import { join } from "path"

const libPath = join(import.meta.dir, "../../../../../native/tool/target/release", `libironcode_tool.${suffix}`)

const lib = dlopen(libPath, {
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
  free_string: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
})

export interface TerminalInfo {
  id: string
  pid: number
  cwd: string
}

export interface TerminalOutput {
  data: string
}

export namespace NativeTerminal {
  export function create(id: string, cwd: string, rows: number, cols: number): TerminalInfo | null {
    const idBuf = Buffer.from(id + "\0", "utf-8")
    const cwdBuf = Buffer.from(cwd + "\0", "utf-8")
    const result = lib.symbols.terminal_create(ptr(idBuf), ptr(cwdBuf), rows, cols)

    if (!result) {
      return null
    }

    const jsonStr = new CString(result)
    const info = JSON.parse(jsonStr.toString())
    lib.symbols.free_string(result)

    return info
  }

  export function write(id: string, data: string): boolean {
    const idBuf = Buffer.from(id + "\0", "utf-8")
    const dataBuf = Buffer.from(data + "\0", "utf-8")
    return lib.symbols.terminal_write(ptr(idBuf), ptr(dataBuf))
  }

  export function read(id: string): TerminalOutput | null {
    const idBuf = Buffer.from(id + "\0", "utf-8")
    const result = lib.symbols.terminal_read(ptr(idBuf))

    if (!result) {
      return null
    }

    const jsonStr = new CString(result)
    const output = JSON.parse(jsonStr.toString())
    lib.symbols.free_string(result)

    return output
  }

  export function resize(id: string, rows: number, cols: number): boolean {
    const idBuf = Buffer.from(id + "\0", "utf-8")
    return lib.symbols.terminal_resize(ptr(idBuf), rows, cols)
  }

  export function close(id: string): boolean {
    const idBuf = Buffer.from(id + "\0", "utf-8")
    return lib.symbols.terminal_close(ptr(idBuf))
  }
}
