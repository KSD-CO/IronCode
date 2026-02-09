import { createSignal, Show, For, onMount, createMemo } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes, ScrollBoxRenderable, RGBA } from "@opentui/core"
import { spawn } from "child_process"
import { highlightLine, getLanguageFromExtension, type Theme as SyntaxTheme } from "../util/syntax-highlight"
import { extname } from "path"

interface CommandResult {
  command: string
  output: string
  error?: string
  exitCode?: number
  collapsed?: boolean
}

export function DialogTerminalSimple() {
  const dialog = useDialog()
  const { theme } = useTheme()

  const [history, setHistory] = createSignal<CommandResult[]>([])
  const [input, setInput] = createSignal("")
  const [cwd, setCwd] = createSignal(process.env.IRONCODE_PROJECT_ROOT || process.cwd())
  const [running, setRunning] = createSignal(false)
  const [historyIndex, setHistoryIndex] = createSignal<number>(-1) // -1 means not navigating
  const [tempInput, setTempInput] = createSignal("") // Store current input when navigating

  let scrollBoxRef: ScrollBoxRenderable

  // Reversed history - newest first
  const reversedHistory = createMemo(() => [...history()].reverse())

  // Syntax highlighting theme
  const syntaxTheme = createMemo((): SyntaxTheme => {
    const t = theme
    return {
      keyword: RGBA.fromInts(197, 134, 192, 255), // Purple
      string: RGBA.fromInts(152, 195, 121, 255), // Green
      comment: RGBA.fromInts(92, 99, 112, 255), // Gray
      number: RGBA.fromInts(209, 154, 102, 255), // Orange
      function: RGBA.fromInts(97, 175, 239, 255), // Blue
      type: RGBA.fromInts(229, 192, 123, 255), // Yellow
      variable: t.text,
      operator: RGBA.fromInts(171, 178, 191, 255), // Light gray
      punctuation: RGBA.fromInts(171, 178, 191, 255), // Light gray
      heading: RGBA.fromInts(224, 108, 117, 255), // Red/Pink for headings
      link: RGBA.fromInts(97, 175, 239, 255), // Blue for links
      bold: t.text, // Normal text but will use BOLD attribute
      italic: RGBA.fromInts(171, 178, 191, 255), // Light gray for italic
    }
  })

  // Detect file extension from command (cat file.js, less file.md, etc)
  function detectLanguageFromCommand(command: string): string | undefined {
    const match = command.match(/(?:cat|less|more|head|tail)\s+(.+?)(?:\s|$)/)
    if (match) {
      const filename = match[1]
      return getLanguageFromExtension(filename)
    }
    return undefined
  }

  // Helper to wrap long lines
  function wrapLine(line: string, maxWidth: number = 150): string[] {
    if (line.length <= maxWidth) return [line]

    const wrapped: string[] = []
    for (let i = 0; i < line.length; i += maxWidth) {
      wrapped.push(line.slice(i, i + maxWidth))
    }
    return wrapped
  }

  // Execute command
  async function executeCommand(cmd: string) {
    if (!cmd.trim()) return

    setRunning(true)
    const command = cmd.trim()

    // Handle 'cd' command specially
    if (command.startsWith("cd ")) {
      const dir = command.slice(3).trim() || process.env.HOME || "~"
      try {
        const { resolve } = await import("path")
        const newDir = resolve(cwd(), dir.replace(/^~/, process.env.HOME || ""))
        setCwd(newDir)
        setHistory((prev) => [
          ...prev,
          {
            command,
            output: `Changed directory to: ${newDir}`,
          },
        ])
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          {
            command,
            output: "",
            error: `cd: ${err instanceof Error ? err.message : "Failed to change directory"}`,
          },
        ])
      }
      setRunning(false)
      setInput("")
      return
    }

    return new Promise<void>((resolve) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh"
      const args = process.platform === "win32" ? ["/c", command] : ["-c", command]

      const proc = spawn(shell, args, {
        cwd: cwd(),
        env: process.env,
      })

      proc.stdout?.on("data", (data: Buffer) => {
        stdoutChunks.push(data)
      })

      proc.stderr?.on("data", (data: Buffer) => {
        stderrChunks.push(data)
      })

      proc.on("close", (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf-8")
        const stderr = Buffer.concat(stderrChunks).toString("utf-8")

        setHistory((prev) => [
          ...prev,
          {
            command,
            output: stdout,
            error: stderr,
            exitCode: code || undefined,
          },
        ])
        setRunning(false)
        setInput("")
        resolve()
      })
    })
  }

  // Handle keyboard events
  useKeyboard((evt) => {
    if (running()) return // Ignore input while running

    const name = evt.name?.toLowerCase()

    if (name === "return") {
      executeCommand(input())
      setHistoryIndex(-1) // Reset history navigation
      setTempInput("") // Clear temp input
      evt.preventDefault()
    } else if (name === "backspace") {
      setInput((prev) => prev.slice(0, -1))
      setHistoryIndex(-1) // Reset history navigation when typing
      evt.preventDefault()
    } else if (name === "tab") {
      setInput((prev) => prev + "  ")
      setHistoryIndex(-1) // Reset history navigation when typing
      evt.preventDefault()
    } else if (name === "up") {
      // Navigate backward in history (older commands)
      const currentHistory = history()
      if (currentHistory.length === 0) return

      const currentIndex = historyIndex()

      // First time pressing up - save current input
      if (currentIndex === -1) {
        setTempInput(input())
        setHistoryIndex(0)
        setInput(currentHistory[currentHistory.length - 1].command)
      } else if (currentIndex < currentHistory.length - 1) {
        // Go to older command
        const newIndex = currentIndex + 1
        setHistoryIndex(newIndex)
        setInput(currentHistory[currentHistory.length - 1 - newIndex].command)
      }
      evt.preventDefault()
    } else if (name === "down") {
      // Navigate forward in history (newer commands)
      const currentIndex = historyIndex()

      if (currentIndex === -1) return // Not navigating

      if (currentIndex === 0) {
        // Return to temp input
        setInput(tempInput())
        setHistoryIndex(-1)
        setTempInput("")
      } else {
        // Go to newer command
        const newIndex = currentIndex - 1
        setHistoryIndex(newIndex)
        const currentHistory = history()
        setInput(currentHistory[currentHistory.length - 1 - newIndex].command)
      }
      evt.preventDefault()
    } else if (evt.sequence && !evt.ctrl && !evt.meta) {
      setInput((prev) => prev + evt.sequence)
      setHistoryIndex(-1) // Reset history navigation when typing
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%" gap={1}>
      {/* Header */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.primary}>
            💻 Command Runner
          </text>
          <text fg={theme.textMuted}>Press Esc to close</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>Working Directory:</text>
          <text>{cwd()}</text>
        </box>
      </box>

      {/* Command history */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} flexGrow={1}>
        <scrollbox
          ref={(ref) => (scrollBoxRef = ref)}
          backgroundColor={theme.backgroundElement}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
        >
          <box flexDirection="column">
            {/* Current prompt - show at top */}
            <box flexDirection="row" gap={1} paddingBottom={1}>
              <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                $
              </text>
              <text fg={theme.text}>{input()}</text>
              <text fg={theme.primary}>▊</text>
            </box>

            {/* History - newest first */}
            <For each={reversedHistory()}>
              {(result, index) => {
                const outputLines = result.output.split("\n")
                const errorLines = result.error?.split("\n") || []
                const language = detectLanguageFromCommand(result.command)

                return (
                  <box flexDirection="column" paddingBottom={1}>
                    {/* Command */}
                    <box flexDirection="row" gap={1}>
                      <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                        $
                      </text>
                      <text fg={theme.text}>{result.command}</text>
                    </box>

                    {/* Output */}
                    <Show when={result.output}>
                      <box flexDirection="column" paddingLeft={2} width="100%">
                        <For each={outputLines}>
                          {(line, lineIndex) => {
                            // Apply syntax highlighting if language detected
                            const tokens = language
                              ? highlightLine(line || " ", language, syntaxTheme())
                              : [{ text: line || " " }]

                            return (
                              <box flexDirection="row">
                                <For each={tokens}>
                                  {(token) => <text fg={token.color || theme.text}>{token.text}</text>}
                                </For>
                              </box>
                            )
                          }}
                        </For>
                        <text fg={theme.textMuted}>
                          [{result.output.length} bytes, {outputLines.length} lines]
                          {language && ` | ${language}`}
                        </text>
                      </box>
                    </Show>

                    {/* Error */}
                    <Show when={result.error}>
                      <box flexDirection="column" paddingLeft={2}>
                        <For each={errorLines}>
                          {(line, lineIndex) => {
                            // Wrap long lines to multiple display lines
                            const maxWidth = 140
                            const wrappedLines: string[] = []

                            if (line.length <= maxWidth) {
                              wrappedLines.push(line || " ")
                            } else {
                              for (let i = 0; i < line.length; i += maxWidth) {
                                wrappedLines.push(line.slice(i, i + maxWidth))
                              }
                            }

                            return (
                              <For each={wrappedLines}>
                                {(wrappedLine) => (
                                  <box flexDirection="row">
                                    <text fg={theme.error}>{wrappedLine}</text>
                                  </box>
                                )}
                              </For>
                            )
                          }}
                        </For>
                      </box>
                    </Show>

                    {/* Exit code */}
                    <Show when={result.exitCode !== undefined && result.exitCode !== 0}>
                      <text fg={theme.error} paddingLeft={2}>
                        [Exit code: {result.exitCode}]
                      </text>
                    </Show>
                  </box>
                )
              }}
            </For>
          </box>
        </scrollbox>
      </box>

      {/* Footer */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>
          {running() ? "Running command..." : "Type command and press Enter | ↑↓: history | Esc: close"}
        </text>
        <text fg={theme.textMuted}>Note: Interactive commands (vim, nano, etc) not supported</text>
      </box>
    </box>
  )
}
