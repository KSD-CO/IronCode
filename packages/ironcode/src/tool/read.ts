import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { Instance } from "../project/instance"
import { Identifier } from "../id/id"
import { assertExternalDirectory } from "./external-directory"
import { InstructionPrompt } from "../session/instruction"
import { readRawFFI } from "./ffi"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000
const MAX_BYTES = 50 * 1024

export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(Instance.directory, filepath)
    }
    const title = path.relative(Instance.worktree, filepath)

    await assertExternalDirectory(ctx, filepath, {
      bypass: Boolean(ctx.extra?.["bypassCwdCheck"]),
    })

    await ctx.ask({
      permission: "read",
      patterns: [filepath],
      always: ["*"],
      metadata: {},
    })

    const file = Bun.file(filepath)
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filepath}`)
    }

    const instructions = await InstructionPrompt.resolve(ctx.messages, filepath, ctx.messageID)

    const isImage =
      file.type.startsWith("image/") && file.type !== "image/svg+xml" && file.type !== "image/vnd.fastbidsheet"
    const isPdf = file.type === "application/pdf"
    if (isImage || isPdf) {
      const mime = file.type
      const msg = `${isImage ? "Image" : "PDF"} read successfully`
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
          truncated: false,
          ...(instructions.length > 0 && { loaded: instructions.map((i) => i.filepath) }),
        },
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime,
            url: `data:${mime};base64,${Buffer.from(await file.bytes()).toString("base64")}`,
          },
        ],
      }
    }

    const offset = params.offset || 0
    const limit = params.limit || DEFAULT_READ_LIMIT

    const content = readRawFFI(filepath)
    const lines = content.split("\n")

    const startLine = offset
    const endLine = Math.min(startLine + limit, lines.length)
    const selectedLines = lines.slice(startLine, endLine)

    const truncated =
      endLine < lines.length ||
      content.length > MAX_BYTES ||
      selectedLines.some((line) => line.length > MAX_LINE_LENGTH)

    const numberedLines = selectedLines
      .map((line, index) => {
        const lineNumber = startLine + index + 1
        const truncatedLine = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line
        return `${String(lineNumber).padStart(5, "0")}| ${truncatedLine}`
      })
      .join("\n")

    LSP.touchFile(filepath, false)
    FileTime.read(ctx.sessionID, filepath)

    let output = numberedLines
    if (instructions.length > 0) {
      output += `\n\n<system-reminder>\n${instructions.map((i) => i.content).join("\n\n")}\n</system-reminder>`
    }

    return {
      title,
      output,
      metadata: {
        preview: numberedLines.split("\n").slice(0, 20).join("\n"),
        truncated,
        ...(instructions.length > 0 && { loaded: instructions.map((i) => i.filepath) }),
      },
    }
  },
})
