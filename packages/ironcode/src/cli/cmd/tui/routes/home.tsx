import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createMemo, createSignal, Match, onMount, onCleanup, Show, Switch } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { Logo } from "../component/logo"
import { Tips } from "../component/tips"
import { Locale } from "@/util/locale"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useDirectory } from "../context/directory"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { Installation } from "@/installation"
import { useKV } from "../context/kv"
import { useCommandDialog } from "../component/dialog-command"
import { getSystemStatsFFI, type SystemStats } from "@/tool/ffi"

// TODO: what is the best way to do this?
let once = false

export function Home() {
  const sync = useSync()
  const kv = useKV()
  const { theme } = useTheme()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const command = useCommandDialog()
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0)
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed")
  })

  const [stats, setStats] = createSignal<SystemStats>({
    cpu_usage: 0,
    memory_used_mb: 0,
    memory_total_mb: 0,
    memory_percent: 0,
  })

  // Update stats every 2 seconds
  onMount(() => {
    const updateStats = () => {
      try {
        setStats(getSystemStatsFFI())
      } catch (e) {
        // Ignore errors
      }
    }
    updateStats()
    const interval = setInterval(updateStats, 2000)
    onCleanup(() => clearInterval(interval))
  })

  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length
  })

  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0)
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false))
  const showTips = createMemo(() => {
    // Don't show tips for first-time users
    if (isFirstTimeUser()) return false
    return !tipsHidden()
  })

  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips",
      value: "tips.toggle",
      keybind: "tips_toggle",
      category: "System",
      onSelect: (dialog) => {
        kv.set("tips_hidden", !tipsHidden())
        dialog.clear()
      },
    },
  ])

  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      <box flexShrink={0} flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <Switch>
            <Match when={mcpError()}>
              <span style={{ fg: theme.error }}>•</span> mcp errors{" "}
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span>
            </Match>
            <Match when={true}>
              <span style={{ fg: theme.success }}>•</span>{" "}
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")}
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef
  const args = useArgs()
  onMount(() => {
    if (once) return
    if (route.initialPrompt) {
      prompt.set(route.initialPrompt)
      once = true
    } else if (args.prompt) {
      prompt.set({ input: args.prompt, parts: [] })
      once = true
      prompt.submit()
    }
  })
  const directory = useDirectory()

  const keybind = useKeybind()

  return (
    <>
      <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
        <box height={3} />
        <Logo />
        <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1}>
          <Prompt
            ref={(r) => {
              prompt = r
              promptRef.set(r)
            }}
            hint={Hint}
          />
        </box>
        <box height={3} width="100%" maxWidth={75} alignItems="center" paddingTop={2}>
          <Show when={showTips()}>
            <Tips />
          </Show>
        </box>
        <Toast />
      </box>
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{directory()}</text>
        <box gap={1} flexDirection="row" flexShrink={0}>
          <Show when={mcp()}>
            <text fg={theme.text}>
              <Switch>
                <Match when={mcpError()}>
                  <span style={{ fg: theme.error }}>⊙ </span>
                </Match>
                <Match when={true}>
                  <span style={{ fg: connectedMcpCount() > 0 ? theme.success : theme.textMuted }}>⊙ </span>
                </Match>
              </Switch>
              {connectedMcpCount()} MCP
            </text>
            <text fg={theme.textMuted}>/status</text>
          </Show>
        </box>
        <box flexGrow={1} />
        <box flexShrink={0} gap={2} flexDirection="row">
          <text fg={theme.textMuted}>
            {(() => {
              const cpu = stats().cpu_usage
              const cpuColor = cpu > 80 ? theme.error : cpu > 60 ? theme.warning : theme.success
              const bars = Math.max(0, Math.min(5, Math.round(cpu / 20)))
              const barStr = "▓".repeat(bars) + "░".repeat(5 - bars)
              return (
                <span style={{ fg: cpuColor }}>
                  CPU {stats().cpu_usage.toFixed(2)}% {barStr}
                </span>
              )
            })()}{" "}
            {(() => {
              const used = stats().memory_used_mb
              const total = stats().memory_total_mb || 1
              const memPct = total > 0 ? (used / total) * 100 : 0
              const memColor = memPct > 80 ? theme.error : memPct > 60 ? theme.warning : theme.success
              const bars = Math.max(0, Math.min(5, Math.round((used / total) * 5)))
              const barStr = "▓".repeat(bars) + "░".repeat(5 - bars)
              return (
                <span style={{ fg: memColor }}>
                  Mem {(used / 1024).toFixed(2)}/{(total / 1024).toFixed(2)}G {barStr}
                </span>
              )
            })()}
          </text>
          <text fg={theme.textMuted}>{Installation.VERSION}</text>
        </box>
      </box>
    </>
  )
}
