import { createSignal, onCleanup, onMount, Show, For } from "solid-js"
import { useTheme } from "../context/theme"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes, ScrollBoxRenderable } from "@opentui/core"
import { NativeTerminal } from "../util/native-terminal"
import { Identifier } from "../../../../id/id"

export interface TerminalProps {
  height: number
  workingDirectory?: string
}

export function Terminal(props: TerminalProps) {
  const { theme } = useTheme()

  const [terminalID, setTerminalID] = createSignal<string | null>(null)
  const [lines, setLines] = createSignal<string[]>([""])
  const [input, setInput] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  let scrollBoxRef: ScrollBoxRenderable
  let pollInterval: Timer | null = null

  // Create terminal session on mount
  onMount(async () => {
    try {
      setLoading(true)

      const id = `term_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const info = NativeTerminal.create(id, props.workingDirectory || process.cwd(), props.height - 4, 80)

      if (!info) {
        throw new Error("Failed to create terminal session")
      }

      setTerminalID(info.id)
      setLoading(false)
      setError(null)

      // Poll for output
      pollInterval = setInterval(() => {
        const id = terminalID()
        if (!id) return

        const output = NativeTerminal.read(id)
        if (output && output.data) {
          // Append data to lines
          setLines((prev) => {
            const lastLine = prev[prev.length - 1] || ""
            const newText = lastLine + output.data
            const split = newText.split("\n")
            return [...prev.slice(0, -1), ...split]
          })

          // Auto-scroll to bottom
          if (scrollBoxRef && !scrollBoxRef.isDestroyed) {
            setTimeout(() => {
              scrollBoxRef.scrollTo(lines().length - 1)
            }, 0)
          }
        }
      }, 50) // Poll every 50ms
    } catch (err) {
      console.error("Failed to create terminal:", err)
      setError(err instanceof Error ? err.message : "Failed to create terminal")
      setLoading(false)
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }

    const id = terminalID()
    if (id) {
      NativeTerminal.close(id)
    }
  })

  // Send input to terminal
  function sendInput(text: string) {
    const id = terminalID()
    if (id) {
      NativeTerminal.write(id, text)
    }
  }

  // Handle keyboard events
  useKeyboard((evt) => {
    const name = evt.name?.toLowerCase()

    if (name === "return") {
      sendInput(input() + "\n")
      setInput("")
      evt.preventDefault()
    } else if (name === "backspace") {
      setInput((prev) => prev.slice(0, -1))
      sendInput("\x7f")
      evt.preventDefault()
    } else if (name === "tab") {
      sendInput("\t")
      evt.preventDefault()
    } else if (evt.sequence && !evt.ctrl && !evt.meta) {
      setInput((prev) => prev + evt.sequence)
      sendInput(evt.sequence)
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" width="100%" height={props.height} gap={1}>
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.accent}>
          Terminal
        </text>
        <text fg={theme.textMuted}>{props.workingDirectory || process.cwd()}</text>
      </box>

      <Show
        when={!loading() && !error()}
        fallback={
          <box
            backgroundColor={theme.backgroundElement}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            height={props.height - 2}
            alignItems="center"
            justifyContent="center"
          >
            <Show when={loading()}>
              <text fg={theme.textMuted}>Starting terminal...</text>
            </Show>
            <Show when={error()}>
              <text fg={theme.error}>{error()}</text>
            </Show>
          </box>
        }
      >
        <scrollbox
          ref={(ref) => (scrollBoxRef = ref)}
          height={props.height - 4}
          backgroundColor={theme.backgroundElement}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
        >
          <box flexDirection="column">
            <For each={lines()}>{(line) => <text fg={theme.text}>{line || " "}</text>}</For>
            <box flexDirection="row">
              <text fg={theme.text}>{input()}</text>
              <text fg={theme.text}>▊</text>
            </box>
          </box>
        </scrollbox>
      </Show>

      <text fg={theme.textMuted}>Type to input | Enter to execute | Ctrl+C: interrupt</text>
    </box>
  )
}
