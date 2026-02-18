import { createSignal, Show, For, createMemo, createEffect } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes, type ScrollBoxRenderable, RGBA } from "@opentui/core"
import { spawn } from "child_process"
import { readdirSync } from "fs"
import { resolve as pathResolve, dirname, basename } from "path"
import { highlightLine, getLanguageFromExtension, type Theme as SyntaxTheme } from "../util/syntax-highlight"

interface OutputLine {
  text: string
  type: "stdout" | "stderr" | "command" | "info"
  language?: string
}

export function DialogTerminalSimple() {
  const dialog = useDialog()
  const { theme } = useTheme()

  const [lines, setLines] = createSignal<OutputLine[]>([])
  const [input, setInput] = createSignal("")
  const [cwd, setCwd] = createSignal(process.env.IRONCODE_PROJECT_ROOT || process.cwd())
  const [running, setRunning] = createSignal(false)
  const [commandHistory, setCommandHistory] = createSignal<string[]>([])
  const [historyIndex, setHistoryIndex] = createSignal<number>(-1)
  const [tempInput, setTempInput] = createSignal("")
  const [cursorPos, setCursorPos] = createSignal(0)

  let scrollBoxRef: ScrollBoxRenderable

  // Fish-style history autosuggest
  const suggestion = createMemo(() => {
    const current = input()
    if (!current) return ""
    const hist = commandHistory()
    // Search from most recent
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].startsWith(current) && hist[i] !== current) {
        return hist[i].slice(current.length)
      }
    }
    return ""
  })

  // Tab completion for file paths
  function completeInput() {
    const current = input()
    const pos = cursorPos()
    const beforeCursor = current.slice(0, pos)

    // Extract the last word (the token being completed)
    const lastSpaceIdx = beforeCursor.lastIndexOf(" ")
    const word = beforeCursor.slice(lastSpaceIdx + 1)

    if (!word) return

    // Resolve the path relative to cwd
    const expandedWord = word.replace(/^~/, process.env.HOME || "")
    const fullPath = pathResolve(cwd(), expandedWord)

    try {
      // Try to list directory contents for completion
      let dir: string
      let prefix: string

      try {
        const entries = readdirSync(fullPath, { withFileTypes: true })
        // Word is a complete directory path — list its contents
        dir = fullPath
        prefix = word.endsWith("/") ? word : word + "/"
        const matches = entries
          .filter((e) => !e.name.startsWith("."))
          .map((e) => prefix + e.name + (e.isDirectory() ? "/" : ""))

        if (matches.length === 1) {
          const completed = matches[0]
          const newInput = current.slice(0, lastSpaceIdx + 1) + completed + current.slice(pos)
          setInput(newInput)
          setCursorPos(lastSpaceIdx + 1 + completed.length)
        }
        return
      } catch {
        // Not a directory — complete in parent dir
      }

      dir = dirname(fullPath)
      const partial = basename(fullPath)
      const entries = readdirSync(dir, { withFileTypes: true })
      const matches = entries
        .filter((e) => e.name.startsWith(partial))
        .map((e) => e.name + (e.isDirectory() ? "/" : ""))

      if (matches.length === 0) return

      if (matches.length === 1) {
        const wordDir = word.includes("/") ? word.slice(0, word.lastIndexOf("/") + 1) : ""
        const completed = wordDir + matches[0]
        const newInput = current.slice(0, lastSpaceIdx + 1) + completed + current.slice(pos)
        setInput(newInput)
        setCursorPos(lastSpaceIdx + 1 + completed.length)
      } else {
        // Find common prefix among matches
        let common = matches[0]
        for (let i = 1; i < matches.length; i++) {
          let j = 0
          while (j < common.length && j < matches[i].length && common[j] === matches[i][j]) j++
          common = common.slice(0, j)
        }
        if (common.length > partial.length) {
          const wordDir = word.includes("/") ? word.slice(0, word.lastIndexOf("/") + 1) : ""
          const completed = wordDir + common
          const newInput = current.slice(0, lastSpaceIdx + 1) + completed + current.slice(pos)
          setInput(newInput)
          setCursorPos(lastSpaceIdx + 1 + completed.length)
        } else {
          // Show possible completions
          setLines((prev) => [
            ...prev,
            { text: promptPrefix() + current, type: "command" },
            { text: matches.join("  "), type: "info" },
          ])
        }
      }
    } catch {
      // Can't read directory
    }
  }

  const promptPrefix = createMemo(() => {
    const dir = cwd()
    const home = process.env.HOME || ""
    const display = home && dir.startsWith(home) ? "~" + dir.slice(home.length) : dir
    return display + " $ "
  })

  function scrollToBottom() {
    if (scrollBoxRef) {
      scrollBoxRef.scrollTo(scrollBoxRef.scrollHeight)
    }
  }

  createEffect(() => {
    lines()
    input()
    scrollToBottom()
  })

  async function executeCommand(cmd: string) {
    const command = cmd.trim()
    if (!command) return

    setCommandHistory((prev) => [...prev, command])
    setHistoryIndex(-1)
    setTempInput("")
    setLines((prev) => [...prev, { text: promptPrefix() + command, type: "command" }])
    setInput("")
    setCursorPos(0)

    if (command === "clear" || command === "cls") {
      setLines([])
      return
    }

    if (command === "cd" || command.startsWith("cd ")) {
      const dir = command.slice(3).trim() || process.env.HOME || "~"
      try {
        const { resolve } = await import("path")
        const { statSync } = await import("fs")
        const newDir = resolve(cwd(), dir.replace(/^~/, process.env.HOME || ""))
        const stat = statSync(newDir)
        if (!stat.isDirectory()) {
          setLines((prev) => [...prev, { text: `cd: not a directory: ${dir}`, type: "stderr" }])
          return
        }
        setCwd(newDir)
      } catch {
        setLines((prev) => [...prev, { text: `cd: no such file or directory: ${dir}`, type: "stderr" }])
      }
      return
    }

    if (command === "exit") {
      dialog.clear()
      return
    }

    setRunning(true)
    const lang = detectLanguage(command)

    return new Promise<void>((resolve) => {
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh"
      const args = process.platform === "win32" ? ["/c", command] : ["-c", command]

      const proc = spawn(shell, args, {
        cwd: cwd(),
        env: process.env,
      })

      proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf-8")
        const outputLines = text.split("\n")
        for (const line of outputLines) {
          if (line || outputLines.length === 1) {
            setLines((prev) => [...prev, { text: line, type: "stdout", language: lang }])
          }
        }
      })

      proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf-8")
        const outputLines = text.split("\n")
        for (const line of outputLines) {
          if (line || outputLines.length === 1) {
            setLines((prev) => [...prev, { text: line, type: "stderr" }])
          }
        }
      })

      proc.on("close", (code) => {
        if (code && code !== 0) {
          setLines((prev) => [...prev, { text: `[exit ${code}]`, type: "info" }])
        }
        setRunning(false)
        resolve()
      })

      proc.on("error", (err) => {
        setLines((prev) => [...prev, { text: err.message, type: "stderr" }])
        setRunning(false)
        resolve()
      })
    })
  }

  useKeyboard((evt) => {
    if (running()) return

    const name = evt.name?.toLowerCase()

    if (name === "return") {
      executeCommand(input())
      evt.preventDefault()
    } else if (name === "backspace") {
      const pos = cursorPos()
      if (pos > 0) {
        setInput((prev) => prev.slice(0, pos - 1) + prev.slice(pos))
        setCursorPos(pos - 1)
      }
      setHistoryIndex(-1)
      evt.preventDefault()
    } else if (name === "delete") {
      const pos = cursorPos()
      setInput((prev) => prev.slice(0, pos) + prev.slice(pos + 1))
      evt.preventDefault()
    } else if (name === "left") {
      setCursorPos((prev) => Math.max(0, prev - 1))
      evt.preventDefault()
    } else if (name === "right") {
      if (cursorPos() >= input().length && suggestion()) {
        // Accept suggestion
        const s = suggestion()
        setInput((prev) => prev + s)
        setCursorPos(input().length + s.length)
      } else {
        setCursorPos((prev) => Math.min(input().length, prev + 1))
      }
      evt.preventDefault()
    } else if (name === "home" || (evt.ctrl && name === "a")) {
      setCursorPos(0)
      evt.preventDefault()
    } else if (name === "end" || (evt.ctrl && name === "e")) {
      if (suggestion()) {
        const s = suggestion()
        setInput((prev) => prev + s)
        setCursorPos(input().length + s.length)
      } else {
        setCursorPos(input().length)
      }
      evt.preventDefault()
    } else if (name === "tab") {
      completeInput()
      evt.preventDefault()
    } else if (evt.ctrl && name === "u") {
      setInput((prev) => prev.slice(cursorPos()))
      setCursorPos(0)
      evt.preventDefault()
    } else if (evt.ctrl && name === "k") {
      setInput((prev) => prev.slice(0, cursorPos()))
      evt.preventDefault()
    } else if (evt.ctrl && name === "w") {
      const pos = cursorPos()
      const before = input().slice(0, pos)
      const trimmed = before.replace(/\s+$/, "")
      const lastSpace = trimmed.lastIndexOf(" ")
      const newPos = lastSpace === -1 ? 0 : lastSpace + 1
      setInput(input().slice(0, newPos) + input().slice(pos))
      setCursorPos(newPos)
      evt.preventDefault()
    } else if (evt.ctrl && name === "l") {
      setLines([])
      evt.preventDefault()
    } else if (name === "up") {
      const hist = commandHistory()
      if (hist.length === 0) return
      const idx = historyIndex()
      if (idx === -1) {
        setTempInput(input())
        setHistoryIndex(0)
        const cmd = hist[hist.length - 1]
        setInput(cmd)
        setCursorPos(cmd.length)
      } else if (idx < hist.length - 1) {
        const newIdx = idx + 1
        setHistoryIndex(newIdx)
        const cmd = hist[hist.length - 1 - newIdx]
        setInput(cmd)
        setCursorPos(cmd.length)
      }
      evt.preventDefault()
    } else if (name === "down") {
      const idx = historyIndex()
      if (idx === -1) return
      if (idx === 0) {
        const tmp = tempInput()
        setInput(tmp)
        setCursorPos(tmp.length)
        setHistoryIndex(-1)
        setTempInput("")
      } else {
        const newIdx = idx - 1
        setHistoryIndex(newIdx)
        const hist = commandHistory()
        const cmd = hist[hist.length - 1 - newIdx]
        setInput(cmd)
        setCursorPos(cmd.length)
      }
      evt.preventDefault()
    } else if (evt.sequence && !evt.ctrl && !evt.meta) {
      const pos = cursorPos()
      setInput((prev) => prev.slice(0, pos) + evt.sequence + prev.slice(pos))
      setCursorPos(pos + evt.sequence.length)
      setHistoryIndex(-1)
      evt.preventDefault()
    }
  })

  const syntaxTheme = createMemo((): SyntaxTheme => ({
    keyword: RGBA.fromInts(197, 134, 192, 255),
    string: RGBA.fromInts(152, 195, 121, 255),
    comment: RGBA.fromInts(92, 99, 112, 255),
    number: RGBA.fromInts(209, 154, 102, 255),
    function: RGBA.fromInts(97, 175, 239, 255),
    type: RGBA.fromInts(229, 192, 123, 255),
    variable: theme.text,
    operator: RGBA.fromInts(171, 178, 191, 255),
    punctuation: RGBA.fromInts(171, 178, 191, 255),
    heading: RGBA.fromInts(224, 108, 117, 255),
    link: RGBA.fromInts(97, 175, 239, 255),
    bold: theme.text,
    italic: RGBA.fromInts(171, 178, 191, 255),
  }))

  function detectLanguage(command: string): string | undefined {
    const match = command.match(/(?:cat|less|more|head|tail|bat)\s+(\S+)/)
    if (match) return getLanguageFromExtension(match[1])
    return undefined
  }

  const errorColor = createMemo(() => RGBA.fromInts(224, 108, 117, 255))
  const infoColor = createMemo(() => RGBA.fromInts(92, 99, 112, 255))

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Output area */}
      <scrollbox
        ref={(ref) => (scrollBoxRef = ref)}
        flexGrow={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <box flexDirection="column">
          <For each={lines()}>
            {(line) => {
              if (line.language && line.type === "stdout") {
                const tokens = highlightLine(line.text || " ", line.language, syntaxTheme())
                return (
                  <box flexDirection="row">
                    <For each={tokens}>
                      {(token) => <text fg={token.color || theme.text}>{token.text}</text>}
                    </For>
                  </box>
                )
              }
              return (
                <box flexDirection="row">
                  <text
                    fg={
                      line.type === "stderr"
                        ? errorColor()
                        : line.type === "command"
                          ? theme.primary
                          : line.type === "info"
                            ? infoColor()
                            : theme.text
                    }
                    attributes={line.type === "command" ? TextAttributes.BOLD : 0}
                  >
                    {line.text || " "}
                  </text>
                </box>
              )
            }}
          </For>
        </box>
      </scrollbox>

      {/* Prompt line at bottom */}
      <box flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {promptPrefix()}
        </text>
        <Show when={!running()} fallback={<text fg={theme.textMuted}>running...</text>}>
          <text fg={theme.text}>{input().slice(0, cursorPos())}</text>
          <Show
            when={cursorPos() < input().length}
            fallback={
              <>
                <box backgroundColor={theme.text}>
                  <text fg={theme.background}>{suggestion() ? suggestion()[0] : " "}</text>
                </box>
                <Show when={suggestion().length > 1}>
                  <text fg={theme.textMuted}>{suggestion().slice(1)}</text>
                </Show>
              </>
            }
          >
            <box backgroundColor={theme.text}>
              <text fg={theme.background}>{input()[cursorPos()]}</text>
            </box>
            <text fg={theme.text}>{input().slice(cursorPos() + 1)}</text>
          </Show>
        </Show>
      </box>
    </box>
  )
}
