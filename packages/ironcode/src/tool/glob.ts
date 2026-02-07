import z from "zod"
import path from "path"
import { Tool } from "./tool"
import DESCRIPTION from "./glob.txt"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"

export const GlobTool = Tool.define("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe(
        `The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.`,
      ),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "glob",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
      },
    })

    let search = params.path ?? Instance.directory
    search = path.isAbsolute(search) ? search : path.resolve(Instance.directory, search)
    await assertExternalDirectory(ctx, search, { kind: "directory" })

    // Prefer the built native binary; fall back to `cargo run` if binary missing.
    const manifest = path.join(Instance.worktree, "packages/ironcode/native/glob/Cargo.toml")
    const bin = path.join(Instance.worktree, "packages/ironcode/native/glob/target/release/ironcode-glob")
    let stdout: string
    const exec = require("child_process").execFileSync
    const fs = require("fs")
    if (fs.existsSync(bin)) {
      stdout = exec(bin, [params.pattern, search], { encoding: "utf8" })
    } else {
      try {
        const args = ["run", "--quiet", "--manifest-path", manifest, "--", params.pattern, search]
        stdout = exec("cargo", args, { encoding: "utf8" })
      } catch (err) {
        throw err
      }
    }

    const parsed = JSON.parse(stdout)
    return parsed
  },
})
