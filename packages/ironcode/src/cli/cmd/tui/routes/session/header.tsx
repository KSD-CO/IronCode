import { type Accessor, createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { pipe, sumBy } from "remeda"
import { useTheme } from "@tui/context/theme"
import { SplitBorder } from "@tui/component/border"
import type { AssistantMessage, Session } from "@ironcode-ai/sdk/v2"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "../../context/keybind"
import { Installation } from "@/installation"
import { useTerminalDimensions } from "@opentui/solid"
import { getSystemStatsFFI, type SystemStats } from "@/tool/ffi"
import { ProviderRegistry } from "@/provider/provider"

const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme()
  return (
    <text fg={theme.text} wrapMode="none">
      <span style={{ fg: theme.primary, bold: true }}>#</span>{" "}
      <span style={{ bold: true }}>{props.session().title}</span>
    </text>
  )
}

const ContextInfo = (props: { context: Accessor<string | undefined>; cost: Accessor<string> }) => {
  const { theme } = useTheme()
  return (
    <Show when={props.context()}>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        <span style={{ fg: theme.info }}>&#x25C8;</span> {props.context()}{" "}
        <span style={{ fg: theme.textMuted }}>({props.cost()})</span>
      </text>
    </Show>
  )
}

function MiniBar(props: { value: number; max: number; width: number; color: any; bgColor: any }) {
  const filled = () => Math.max(0, Math.min(props.width, Math.round((props.value / props.max) * props.width)))
  return (
    <text>
      <span style={{ fg: props.color }}>{"█".repeat(filled())}</span>
      <span style={{ fg: props.bgColor }}>{"░".repeat(props.width - filled())}</span>
    </text>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

  const [stats, setStats] = createSignal<SystemStats>({
    cpu_usage: 0,
    memory_used_mb: 0,
    memory_total_mb: 0,
    memory_percent: 0,
  })

  onMount(() => {
    const updateStats = () => {
      try {
        setStats(getSystemStatsFFI())
      } catch (e) {
        // Ignore errors
      }
    }
    updateStats()
  })

  const interval = setInterval(() => {
    try {
      setStats(getSystemStatsFFI())
    } catch (e) {
      // Ignore errors
    }
  }, 2000)

  onCleanup(() => clearInterval(interval))

  const cost = createMemo(() => {
    const total = pipe(
      messages(),
      sumBy((x) => (x.role === "assistant" ? x.cost : 0)),
    )
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const { providerID, modelID } = ProviderRegistry.parse(last.model)
    const model = sync.data.provider.find((x) => x.id === providerID)?.models[modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const { theme } = useTheme()
  const keybind = useKeybind()
  const command = useCommandDialog()
  const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
  const dimensions = useTerminalDimensions()
  const narrow = createMemo(() => dimensions().width < 80)
  const mobile = createMemo(() => dimensions().width < 60)

  const cpuColor = createMemo(() => {
    const cpu = stats().cpu_usage
    return cpu > 80 ? theme.error : cpu > 60 ? theme.warning : theme.success
  })

  const memColor = createMemo(() => {
    const used = stats().memory_used_mb
    const total = stats().memory_total_mb || 1
    const pct = (used / total) * 100
    return pct > 80 ? theme.error : pct > 60 ? theme.warning : theme.success
  })

  return (
    <box flexShrink={0}>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.primary}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="column" gap={1}>
              <box flexDirection={narrow() ? "column" : "row"} justifyContent="space-between" gap={narrow() ? 1 : 0}>
                <text fg={theme.text}>
                  <span style={{ fg: theme.secondary }}>&#x25C7;</span> <b>Subagent session</b>
                </text>
                <box flexDirection="row" gap={2} flexShrink={0}>
                  <ContextInfo context={context} cost={cost} />
                  <Show when={!mobile()}>
                    <box flexDirection="row" gap={1} flexShrink={0}>
                      <text fg={cpuColor()} wrapMode="none">
                        CPU {stats().cpu_usage.toFixed(0)}%
                      </text>
                      <MiniBar
                        value={stats().cpu_usage}
                        max={100}
                        width={5}
                        color={cpuColor()}
                        bgColor={theme.borderSubtle}
                      />
                      <text fg={theme.textMuted} wrapMode="none">
                        &#x2502;
                      </text>
                      <text fg={memColor()} wrapMode="none">
                        Mem {(stats().memory_used_mb / 1024).toFixed(1)}G
                      </text>
                      <MiniBar
                        value={stats().memory_used_mb}
                        max={stats().memory_total_mb || 1}
                        width={5}
                        color={memColor()}
                        bgColor={theme.borderSubtle}
                      />
                    </box>
                    <text fg={theme.textMuted}>v{Installation.VERSION}</text>
                  </Show>
                </box>
              </box>
              <box flexDirection="row" gap={2}>
                <box
                  onMouseOver={() => setHover("parent")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.parent")}
                  backgroundColor={hover() === "parent" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    <span style={{ fg: theme.primary }}>&#x25B2;</span> Parent{" "}
                    <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("prev")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.previous")}
                  backgroundColor={hover() === "prev" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    <span style={{ fg: theme.primary }}>&#x25C0;</span> Prev{" "}
                    <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("next")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.next")}
                  backgroundColor={hover() === "next" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    Next <span style={{ fg: theme.primary }}>&#x25B6;</span>{" "}
                    <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
                  </text>
                </box>
              </box>
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection={narrow() ? "column" : "row"} justifyContent="space-between" gap={1}>
              <Title session={session} />
              <box flexDirection="row" gap={2} flexShrink={0}>
                <ContextInfo context={context} cost={cost} />
                <Show when={!mobile()}>
                  <box flexDirection="row" gap={1} flexShrink={0}>
                    <text fg={cpuColor()} wrapMode="none">
                      CPU {stats().cpu_usage.toFixed(0)}%
                    </text>
                    <MiniBar
                      value={stats().cpu_usage}
                      max={100}
                      width={5}
                      color={cpuColor()}
                      bgColor={theme.borderSubtle}
                    />
                    <text fg={theme.textMuted} wrapMode="none">
                      &#x2502;
                    </text>
                    <text fg={memColor()} wrapMode="none">
                      Mem {(stats().memory_used_mb / 1024).toFixed(1)}G
                    </text>
                    <MiniBar
                      value={stats().memory_used_mb}
                      max={stats().memory_total_mb || 1}
                      width={5}
                      color={memColor()}
                      bgColor={theme.borderSubtle}
                    />
                  </box>
                  <text fg={theme.textMuted}>v{Installation.VERSION}</text>
                </Show>
              </box>
            </box>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
