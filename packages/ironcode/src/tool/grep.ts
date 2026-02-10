import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./grep.txt"
import { Instance } from "../project/instance"
import path from "path"
import { assertExternalDirectory } from "./external-directory"
import { grepFFI } from "./ffi"

const MAX_LINE_LENGTH = 2000

export const GrepTool = Tool.define("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    await ctx.ask({
      permission: "grep",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
      },
    })

    let searchPath = params.path ?? Instance.directory
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(Instance.directory, searchPath)
    await assertExternalDirectory(ctx, searchPath, { kind: "directory" })

    const result = grepFFI(params.pattern, searchPath, params.include)

    // Map Rust's 'count' field to 'matches' for compatibility
    return {
      ...result,
      metadata: {
        ...result.metadata,
        matches: result.metadata.count,
      },
    }
  },
})
