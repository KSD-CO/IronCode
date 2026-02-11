import { EOL } from "os"
import { Ripgrep } from "../../../file/ripgrep"
import { Instance } from "../../../project/instance"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"
import { grepFFI } from "../../../tool/ffi"

export const RipgrepCommand = cmd({
  command: "rg",
  describe: "ripgrep debugging utilities",
  builder: (yargs) => yargs.command(TreeCommand).command(FilesCommand).command(SearchCommand).demandCommand(),
  async handler() {},
})

const TreeCommand = cmd({
  command: "tree",
  describe: "show file tree using ripgrep",
  builder: (yargs) =>
    yargs.option("limit", {
      type: "number",
    }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      process.stdout.write((await Ripgrep.tree({ cwd: Instance.directory, limit: args.limit })) + EOL)
    })
  },
})

const FilesCommand = cmd({
  command: "files",
  describe: "list files using ripgrep",
  builder: (yargs) =>
    yargs
      .option("query", {
        type: "string",
        description: "Filter files by query",
      })
      .option("glob", {
        type: "string",
        description: "Glob pattern to match files",
      })
      .option("limit", {
        type: "number",
        description: "Limit number of results",
      }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const files: string[] = []
      for await (const file of Ripgrep.files({
        cwd: Instance.directory,
        glob: args.glob ? [args.glob] : undefined,
      })) {
        files.push(file)
        if (args.limit && files.length >= args.limit) break
      }
      process.stdout.write(files.join(EOL) + EOL)
    })
  },
})

const SearchCommand = cmd({
  command: "search <pattern>",
  describe: "search file contents using ripgrep",
  builder: (yargs) =>
    yargs
      .positional("pattern", {
        type: "string",
        demandOption: true,
        description: "Search pattern",
      })
      .option("glob", {
        type: "array",
        description: "File glob patterns",
      })
      .option("limit", {
        type: "number",
        description: "Limit number of results",
      }),
  async handler(args) {
    // Use native Rust grep FFI instead of spawning ripgrep
    const result = grepFFI(args.pattern, process.cwd(), args.glob ? args.glob.join(",") : undefined)

    // Parse output to extract structured matches
    const lines = result.output.split("\n")
    const matches: any[] = []

    let currentFile = ""
    for (const line of lines) {
      // Match file path lines (format: "path:")
      const fileMatch = line.match(/^(.+):$/)
      if (fileMatch) {
        currentFile = fileMatch[1]
        continue
      }

      // Match result lines (format: "  Line N: content")
      const lineMatch = line.match(/^\s+Line (\d+): (.+)$/)
      if (lineMatch && currentFile) {
        const lineNum = parseInt(lineMatch[1], 10)
        const lineText = lineMatch[2]

        matches.push({
          path: { text: currentFile },
          lines: { text: lineText },
          line_number: lineNum,
        })

        // Apply limit if specified
        if (args.limit && matches.length >= args.limit) break
      }
    }

    process.stdout.write(JSON.stringify(matches, null, 2) + EOL)
  },
})
