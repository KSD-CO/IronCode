import z from "zod"
import { Tool } from "./tool"
import * as path from "path"
import DESCRIPTION from "./ls.txt"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"
import { lsFFI } from "./ffi"

export const IGNORE_PATTERNS = [
  "node_modules/",
  "__pycache__/",
  ".git/",
  "dist/",
  "build/",
  "target/",
  "vendor/",
  "bin/",
  "obj/",
  ".idea/",
  ".vscode/",
  ".zig-cache/",
  "zig-out",
  ".coverage",
  "coverage/",
  "vendor/",
  "tmp/",
  "temp/",
  ".cache/",
  "cache/",
  "logs/",
  ".venv/",
  "venv/",
  "env/",
]

export const ListTool = Tool.define("list", {
  description: DESCRIPTION,
  parameters: z.object({
    path: z.string().describe("The absolute path to the directory to list (must be absolute, not relative)").optional(),
    ignore: z.array(z.string()).describe("List of glob patterns to ignore").optional(),
  }),
  async execute(params, ctx) {
    const searchPath = path.resolve(Instance.directory, params.path || ".")
    await assertExternalDirectory(ctx, searchPath, { kind: "directory" })

    await ctx.ask({
      permission: "list",
      patterns: [searchPath],
      always: ["*"],
      metadata: {
        path: searchPath,
      },
    })

    const ignorePatterns = params.ignore || IGNORE_PATTERNS.map((p) => p.replace(/\/$/, ""))
    const result = lsFFI(searchPath, ignorePatterns)

    return {
      title: path.relative(Instance.worktree, searchPath),
      metadata: result.metadata,
      output: result.output,
    }
  },
})
