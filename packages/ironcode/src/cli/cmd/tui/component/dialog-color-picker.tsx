import { RGBA, TextAttributes } from "@opentui/core"
import { useTheme, selectedForeground } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard } from "@opentui/solid"

const COLOR_PALETTE = [
  // Reds
  ["#ff0000", "#ff4444", "#ff6b6b", "#ee5a6f", "#c92a2a"],
  // Oranges
  ["#ff6b00", "#ff8c00", "#ffa500", "#ffb347", "#fd7e14"],
  // Yellows
  ["#ffd700", "#ffeb3b", "#fff59d", "#ffe082", "#f9ca24"],
  // Greens
  ["#00ff00", "#4caf50", "#66bb6a", "#81c784", "#26de81"],
  // Cyans
  ["#00ffff", "#00acc1", "#26c6da", "#4dd0e1", "#20bf6b"],
  // Blues
  ["#0000ff", "#2196f3", "#42a5f5", "#64b5f6", "#1e90ff"],
  // Purples
  ["#9c27b0", "#ab47bc", "#ba68c8", "#ce93d8", "#8e44ad"],
  // Pinks
  ["#e91e63", "#ec407a", "#f06292", "#f48fb1", "#fd79a8"],
  // Grays
  ["#000000", "#424242", "#757575", "#9e9e9e", "#bdbdbd"],
  // Light grays & white
  ["#e0e0e0", "#eeeeee", "#f5f5f5", "#fafafa", "#ffffff"],
]

export function DialogColorPicker(props: {
  initialColor: string
  onSelect: (color: string) => void
  onCancel: () => void
}) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const [store, setStore] = createStore({
    selectedRow: 0,
    selectedCol: 0,
    customColor: props.initialColor,
    mode: "palette" as "palette" | "custom",
  })

  useKeyboard((evt) => {
    if (store.mode === "palette") {
      if (evt.name === "up" || evt.name === "k") {
        setStore("selectedRow", (prev) => Math.max(0, prev - 1))
      } else if (evt.name === "down" || evt.name === "j") {
        setStore("selectedRow", (prev) => Math.min(COLOR_PALETTE.length - 1, prev + 1))
      } else if (evt.name === "left" || evt.name === "h") {
        setStore("selectedCol", (prev) => Math.max(0, prev - 1))
      } else if (evt.name === "right" || evt.name === "l") {
        setStore("selectedCol", (prev) => Math.min(COLOR_PALETTE[0].length - 1, prev + 1))
      } else if (evt.name === "return") {
        const color = COLOR_PALETTE[store.selectedRow][store.selectedCol]
        props.onSelect(color)
      } else if (evt.name === "c") {
        setStore("mode", "custom")
      } else if (evt.name === "escape") {
        props.onCancel()
      }
    }
  })

  return (
    <box gap={1} paddingBottom={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Color Picker
        </text>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={theme.textMuted}>Current:</text>
          <box width={6} height={1} backgroundColor={RGBA.fromHex(props.initialColor)} />
          <text fg={theme.textMuted}>{props.initialColor}</text>
        </box>
      </box>

      {/* Color palette grid */}
      <box paddingTop={1} paddingBottom={1} gap={0}>
        <For each={COLOR_PALETTE}>
          {(row, rowIndex) => (
            <box flexDirection="row" gap={1}>
              <For each={row}>
                {(color, colIndex) => {
                  const isSelected = () => rowIndex() === store.selectedRow && colIndex() === store.selectedCol
                  return (
                    <box
                      width={6}
                      height={2}
                      backgroundColor={RGBA.fromHex(color)}
                      borderStyle={isSelected() ? "single" : undefined}
                      borderColor={isSelected() ? theme.primary : undefined}
                    >
                      <Show when={isSelected()}>
                        <text fg={theme.background}>●</text>
                      </Show>
                    </box>
                  )
                }}
              </For>
            </box>
          )}
        </For>
      </box>

      {/* Preview */}
      <box flexDirection="row" gap={2} paddingTop={1} alignItems="center">
        <text fg={theme.text}>Preview:</text>
        <box width={8} height={2} backgroundColor={RGBA.fromHex(COLOR_PALETTE[store.selectedRow][store.selectedCol])} />
        <text fg={theme.textMuted}>{COLOR_PALETTE[store.selectedRow][store.selectedCol]}</text>
      </box>

      {/* Footer */}
      <box paddingTop={1} gap={1} flexDirection="row">
        <text fg={theme.text}>
          <span style={{ fg: theme.textMuted }}>←↓↑→/hjkl</span> move
        </text>
        <text fg={theme.text}>
          <span style={{ fg: theme.textMuted }}>enter</span> select
        </text>
        <text fg={theme.text}>
          <span style={{ fg: theme.textMuted }}>c</span> custom hex
        </text>
        <text fg={theme.text}>
          <span style={{ fg: theme.textMuted }}>esc</span> cancel
        </text>
      </box>
    </box>
  )
}
