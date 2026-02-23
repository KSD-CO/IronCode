import z from "zod"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { codesearchIndexFFI, codesearchSearchFFI, codesearchStatsFFI, codesearchUpdateFFI, codesearchRemoveFFI } from "./ffi"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"

const DESCRIPTION = `Search the local codebase for functions, classes, and symbols by concept or purpose using BM25 semantic search.

PREFER this tool over grep whenever you are searching by concept, purpose, or meaning rather than an exact known string.
Use grep only when you know the exact text/pattern to match.

When to use search_codebase (NOT grep):
- Looking for code that handles a concept: "authentication", "error handling", "database connection"
- Finding a function by what it does: "parse user input", "send email", "validate token"
- Exploring an unfamiliar codebase: "how does routing work", "where is configuration loaded"
- Avoid building OR-patterns like \b(auth|login|token|session)\b — just search "authentication" here

When to use grep instead:
- You know the exact function/variable name: "getUserById", "MAX_RETRIES"
- Searching for a specific string literal: "TODO:", "console.log"
- Regex pattern matching across files

Examples:
- "authentication logic" → finds login/auth/session related functions
- "database connection pool" → finds DB setup and query functions
- "error handling middleware" → finds Express/Fastify error handlers
- "rate limiting" → finds throttle/debounce/limiter implementations

Returns the source code of the top matching symbols with file paths and line numbers.`

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyw",
  ".rs",
  ".go",
  ".java",
  ".cs",
  ".rb", ".rake", ".gemspec",
  ".c", ".h",
  ".cpp", ".cc", ".cxx", ".hpp", ".hxx",
  ".php", ".php8", ".php7",
  ".scala", ".sc",
])

function isCodeFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".")
  if (dot === -1) return false
  return CODE_EXTENSIONS.has(filePath.slice(dot))
}

// Track whether the current project has been indexed
let indexedProject: string | null = null
let watcherSubscribed = false

async function ensureIndexed(projectPath: string): Promise<void> {
  // Register file watcher subscription lazily, from within an Instance context,
  // so the Bus can route events correctly (it uses Instance.directory for scoping).
  if (!watcherSubscribed) {
    Bus.subscribe(FileWatcher.Event.Updated, ({ properties: { file, event } }) => {
      if (indexedProject === null) return
      if (!isCodeFile(file)) return
      if (event === "unlink") {
        codesearchRemoveFFI(file)
      } else {
        // "add" or "change"
        codesearchUpdateFFI(file)
      }
    })
    watcherSubscribed = true
  }

  if (indexedProject === projectPath) return
  codesearchIndexFFI(projectPath)
  indexedProject = projectPath
}

export const LocalCodeSearchTool = Tool.define("search_codebase", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Natural language or identifier query. E.g. 'authentication middleware', 'getUserById', 'database connection pool'",
      ),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of top results to return (1-20, default 5)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "grep",
      patterns: [params.query],
      always: ["*"],
      metadata: { query: params.query },
    })

    const projectPath = Instance.directory

    // Index on first call (or if project changed)
    await ensureIndexed(projectPath)

    const results = codesearchSearchFFI(params.query, params.top_k ?? 5)

    const stats = codesearchStatsFFI()

    if (results.length === 0) {
      return {
        title: `search_codebase: ${params.query}`,
        output: "No matching symbols found. Try a different query or use the grep tool for exact text search.",
        metadata: {
          query: params.query,
          results: 0,
          index_files: stats.total_files,
          index_symbols: stats.total_symbols,
        },
      }
    }

    const lines: string[] = []

    for (const r of results) {
      const { symbol, score } = r
      const rel = symbol.file_path.replace(projectPath, "").replace(/^\//, "")
      lines.push(`### ${symbol.kind} \`${symbol.name}\` — ${rel}:${symbol.line_start}-${symbol.line_end} (score: ${score.toFixed(3)})`)
      lines.push("```" + symbol.language)
      lines.push(symbol.content.trimEnd())
      lines.push("```")
      lines.push("")
    }

    return {
      title: `search_codebase: ${params.query}`,
      output: lines.join("\n"),
      metadata: {
        query: params.query,
        results: results.length,
        index_files: stats.total_files,
        index_symbols: stats.total_symbols,
      },
    }
  },
})

/** Re-index the current project (e.g. after many file changes) */
export function reindexProject(): void {
  const projectPath = Instance.directory
  codesearchIndexFFI(projectPath)
  indexedProject = projectPath
}
