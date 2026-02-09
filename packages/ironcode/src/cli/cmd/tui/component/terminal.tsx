import { createSignal, onCleanup, onMount, Show, For } from "solid-js"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes, ScrollBoxRenderable } from "@opentui/core"

export interface TerminalProps {
  height: number
  workingDirectory?: string
}

export function Terminal(props: TerminalProps) {
  const sdk = useSDK()
  const { theme } = useTheme()

  const [ptyID, setPtyID] = createSignal<string | null>(null)
  const [lines, setLines] = createSignal<string[]>([""])
  const [input, setInput] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  let scrollBoxRef: ScrollBoxRenderable
  let ws: WebSocket | null = null

  // Create PTY session on mount
  onMount(async () => {
    try {
      setLoading(true)
      const result = await sdk.client.pty.create({
        cwd: props.workingDirectory || process.cwd(),
      })

      if (!result.data) {
        throw new Error("Failed to create PTY session")
      }

      setPtyID(result.data.id)

      // Connect to PTY via WebSocket
      const wsUrl = sdk.url.replace("http://", "ws://").replace("https://", "wss://")
      ws = new WebSocket(`${wsUrl}/pty/${result.data.id}/connect`)

      ws.onopen = () => {
        setLoading(false)
        setError(null)
      }

      ws.onmessage = (event) => {
        const data = event.data as string
        // Split by newlines and append to lines
        setLines((prev) => {
          const lastLine = prev[prev.length - 1] || ""
          const newText = lastLine + data
          const split = newText.split("\n")
          return [...prev.slice(0, -1), ...split]
        })

        // Auto-scroll to bottom
        if (scrollBoxRef) {
          setTimeout(() => {
            scrollBoxRef.scrollTo(lines().length - 1)
          }, 0)
        }
      }

      ws.onerror = () => {
        setError("WebSocket connection failed")
      }

      ws.onclose = () => {
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create terminal")
      setLoading(false)
    }
  })

  // Cleanup on unmount
  onCleanup(async () => {
    if (ws) {
      ws.close()
      ws = null
    }

    const id = ptyID()
    if (id) {
      try {
        await sdk.client.pty.remove({ ptyID: id })
      } catch (err) {
        console.error("Failed to remove PTY:", err)
      }
    }
  })

  // Send input to PTY
  function sendInput(text: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(text)
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
