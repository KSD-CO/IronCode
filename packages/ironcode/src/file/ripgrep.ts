// File listing and tree utilities using native Rust FFI
import path from "path"
import z from "zod"
import { Log } from "@/util/log"
import { fileListFFI } from "@/tool/ffi"

export namespace Ripgrep {
  const log = Log.create({ service: "ripgrep" })

  // Schema for grep match results (used by API route schema)
  export const Match = z.object({
    type: z.literal("match"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      lines: z.object({
        text: z.string(),
      }),
      line_number: z.number(),
      absolute_offset: z.number(),
      submatches: z.array(
        z.object({
          match: z.object({
            text: z.string(),
          }),
          start: z.number(),
          end: z.number(),
        }),
      ),
    }),
  })

  export type Match = z.infer<typeof Match>

  export async function* files(input: {
    cwd: string
    glob?: string[]
    hidden?: boolean
    follow?: boolean
    maxDepth?: number
    signal?: AbortSignal
  }) {
    input.signal?.throwIfAborted()

    // Convert glob patterns to include .git exclusion
    const globs = input.glob ? [...input.glob, "!.git/*"] : ["!.git/*"]

    try {
      // Use native Rust FFI for file listing (faster than spawning ripgrep)
      const files = fileListFFI(
        input.cwd,
        globs,
        input.hidden ?? true, // Default to showing hidden files (matches ripgrep --hidden)
        input.follow ?? false,
        input.maxDepth,
      )

      // Yield files one by one to maintain generator interface
      for (const file of files) {
        input.signal?.throwIfAborted()
        yield file
      }
    } catch (error: any) {
      // Convert native errors to match Bun.spawn error format
      if (error.message && error.message.includes("No such file or directory")) {
        throw Object.assign(new Error(`No such file or directory: '${input.cwd}'`), {
          code: "ENOENT",
          errno: -2,
          path: input.cwd,
        })
      }
      throw error
    }

    input.signal?.throwIfAborted()
  }

  export async function tree(input: { cwd: string; limit?: number; signal?: AbortSignal }) {
    log.info("tree", input)
    const files = await Array.fromAsync(Ripgrep.files({ cwd: input.cwd, signal: input.signal }))
    interface Node {
      name: string
      children: Map<string, Node>
    }

    function dir(node: Node, name: string) {
      const existing = node.children.get(name)
      if (existing) return existing
      const next = { name, children: new Map() }
      node.children.set(name, next)
      return next
    }

    const root: Node = { name: "", children: new Map() }
    for (const file of files) {
      if (file.includes(".ironcode")) continue
      const parts = file.split(path.sep)
      if (parts.length < 2) continue
      let node = root
      for (const part of parts.slice(0, -1)) {
        node = dir(node, part)
      }
    }

    function count(node: Node): number {
      let total = 0
      for (const child of node.children.values()) {
        total += 1 + count(child)
      }
      return total
    }

    const total = count(root)
    const limit = input.limit ?? total
    const lines: string[] = []
    const queue: { node: Node; path: string }[] = []
    for (const child of Array.from(root.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
      queue.push({ node: child, path: child.name })
    }

    let used = 0
    for (let i = 0; i < queue.length && used < limit; i++) {
      const { node, path } = queue[i]
      lines.push(path)
      used++
      for (const child of Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
        queue.push({ node: child, path: `${path}/${child.name}` })
      }
    }

    if (total > used) lines.push(`[${total - used} truncated]`)

    return lines.join("\n")
  }
}
