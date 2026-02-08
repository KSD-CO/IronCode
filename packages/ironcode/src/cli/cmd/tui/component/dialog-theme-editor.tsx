import { InputRenderable, RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useTheme, selectedForeground } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { DialogColorPicker } from "./dialog-color-picker"
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"

type ColorField = {
  key: string
  label: string
  category: string
  value: { dark: string; light: string }
}

const COLOR_CATEGORIES = {
  "Primary Colors": [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
    { key: "error", label: "Error" },
    { key: "warning", label: "Warning" },
    { key: "success", label: "Success" },
    { key: "info", label: "Info" },
  ],
  "Text Colors": [
    { key: "text", label: "Text" },
    { key: "textMuted", label: "Text Muted" },
  ],
  "Background Colors": [
    { key: "background", label: "Background" },
    { key: "backgroundPanel", label: "Background Panel" },
    { key: "backgroundElement", label: "Background Element" },
  ],
  "Border Colors": [
    { key: "border", label: "Border" },
    { key: "borderActive", label: "Border Active" },
    { key: "borderSubtle", label: "Border Subtle" },
  ],
  "Diff Colors": [
    { key: "diffAdded", label: "Added" },
    { key: "diffRemoved", label: "Removed" },
    { key: "diffContext", label: "Context" },
    { key: "diffHunkHeader", label: "Hunk Header" },
    { key: "diffHighlightAdded", label: "Highlight Added" },
    { key: "diffHighlightRemoved", label: "Highlight Removed" },
    { key: "diffAddedBg", label: "Added Background" },
    { key: "diffRemovedBg", label: "Removed Background" },
    { key: "diffContextBg", label: "Context Background" },
    { key: "diffLineNumber", label: "Line Number" },
    { key: "diffAddedLineNumberBg", label: "Added Line Number BG" },
    { key: "diffRemovedLineNumberBg", label: "Removed Line Number BG" },
  ],
  "Markdown Colors": [
    { key: "markdownText", label: "Text" },
    { key: "markdownHeading", label: "Heading" },
    { key: "markdownLink", label: "Link" },
    { key: "markdownLinkText", label: "Link Text" },
    { key: "markdownCode", label: "Code" },
    { key: "markdownBlockQuote", label: "Block Quote" },
    { key: "markdownEmph", label: "Emphasis" },
    { key: "markdownStrong", label: "Strong" },
    { key: "markdownHorizontalRule", label: "Horizontal Rule" },
    { key: "markdownListItem", label: "List Item" },
    { key: "markdownListEnumeration", label: "List Enumeration" },
    { key: "markdownImage", label: "Image" },
    { key: "markdownImageText", label: "Image Text" },
    { key: "markdownCodeBlock", label: "Code Block" },
  ],
  "Syntax Colors": [
    { key: "syntaxComment", label: "Comment" },
    { key: "syntaxKeyword", label: "Keyword" },
    { key: "syntaxFunction", label: "Function" },
    { key: "syntaxVariable", label: "Variable" },
    { key: "syntaxString", label: "String" },
    { key: "syntaxNumber", label: "Number" },
    { key: "syntaxType", label: "Type" },
    { key: "syntaxOperator", label: "Operator" },
    { key: "syntaxPunctuation", label: "Punctuation" },
  ],
}

export function DialogThemeEditor(props: { themeName: string; onSave?: (name: string, theme: any) => void }) {
  const themeContext = useTheme()
  const dialog = useDialog()
  const dimensions = useTerminalDimensions()
  const [store, setStore] = createStore({
    selected: 0,
    mode: themeContext.mode,
    editing: null as string | null,
    themeName: props.themeName,
  })

  // Load the theme data
  const themeData = createMemo(() => {
    const allThemes = themeContext.all()
    return allThemes[props.themeName]
  })

  // Convert theme to editable format
  const initialColors = (): Record<string, { dark: string; light: string }> => {
    const theme = themeData()
    if (!theme) return {}

    const result: Record<string, { dark: string; light: string }> = {}
    const themeObj = theme.theme
    const defs = theme.defs || {}

    // Helper function to resolve color references to hex
    const resolveColorValue = (colorValue: any, mode: "dark" | "light"): string => {
      if (typeof colorValue === "string") {
        // Check if it starts with #, if so it's already hex
        if (colorValue.startsWith("#")) {
          return colorValue
        }
        // Check if it's in defs
        if (defs[colorValue]) {
          const defValue = defs[colorValue]
          if (typeof defValue === "string" && defValue.startsWith("#")) {
            return defValue
          }
          // Recursively resolve if def references another def
          return resolveColorValue(defValue, mode)
        }
        // Check if it references another theme color
        if (themeObj[colorValue as keyof typeof themeObj]) {
          const refValue = themeObj[colorValue as keyof typeof themeObj]
          return resolveColorValue(refValue, mode)
        }
        // If we can't resolve, return as is (might be transparent/none)
        return colorValue
      } else if (typeof colorValue === "object" && colorValue !== null) {
        // Handle { dark: "...", light: "..." }
        if ("dark" in colorValue && "light" in colorValue) {
          return resolveColorValue(colorValue[mode], mode)
        }
      }
      return "#000000" // fallback
    }

    Object.keys(COLOR_CATEGORIES).forEach((category) => {
      COLOR_CATEGORIES[category as keyof typeof COLOR_CATEGORIES].forEach(({ key }) => {
        const value = themeObj[key as keyof typeof themeObj]
        if (value) {
          if (typeof value === "string") {
            const resolved = resolveColorValue(value, "dark")
            result[key] = { dark: resolved, light: resolved }
          } else if (typeof value === "object" && "dark" in value && "light" in value) {
            result[key] = {
              dark: resolveColorValue(value, "dark"),
              light: resolveColorValue(value, "light"),
            }
          }
        }
      })
    })

    return result
  }

  const [colors, setColors] = createStore<Record<string, { dark: string; light: string }>>(initialColors())

  const flatFields = createMemo(() => {
    const fields: ColorField[] = []
    Object.entries(COLOR_CATEGORIES).forEach(([category, items]) => {
      items.forEach(({ key, label }) => {
        if (colors[key]) {
          fields.push({
            key,
            label,
            category,
            value: colors[key],
          })
        }
      })
    })
    return fields
  })

  let scrollBox: ScrollBoxRenderable
  let input: InputRenderable

  function saveTheme() {
    const theme = themeData()
    if (!theme) return

    const updatedTheme = {
      ...theme,
      theme: {
        ...theme.theme,
        ...Object.fromEntries(
          Object.entries(colors).map(([key, value]) => {
            if (value.dark === value.light) {
              return [key, value.dark]
            }
            return [key, { dark: value.dark, light: value.light }]
          }),
        ),
      },
    }

    themeContext.save(store.themeName, updatedTheme)
    dialog.clear()
  }

  async function renameTheme() {
    const newName = await DialogPrompt.show(dialog, "Rename Theme", {
      placeholder: "Enter new theme name",
      value: store.themeName,
    })

    if (newName && newName !== store.themeName) {
      setStore("themeName", newName)
    }
  }

  async function saveAsNewTheme() {
    const newName = await DialogPrompt.show(dialog, "Save As New Theme", {
      placeholder: "Enter new theme name",
      value: `${store.themeName}-custom`,
    })

    if (newName) {
      const theme = themeData()
      if (!theme) return

      const updatedTheme = {
        ...theme,
        theme: {
          ...theme.theme,
          ...Object.fromEntries(
            Object.entries(colors).map(([key, value]) => {
              if (value.dark === value.light) {
                return [key, value.dark]
              }
              return [key, { dark: value.dark, light: value.light }]
            }),
          ),
        },
      }

      await themeContext.save(newName, updatedTheme)
      themeContext.set(newName)
      dialog.clear()
    }
  }

  function openColorPicker() {
    const field = flatFields()[store.selected]
    if (!field) return

    const mode = getCurrentMode()
    const currentValue = colors[field.key]?.[mode] || "#000000"

    dialog.replace(
      () => (
        <DialogColorPicker
          initialColor={currentValue}
          onSelect={(color) => {
            updateColor(field.key, mode, color)
            dialog.replace(() => <DialogThemeEditor themeName={store.themeName} />)
          }}
          onCancel={() => {
            dialog.replace(() => <DialogThemeEditor themeName={store.themeName} />)
          }}
        />
      ),
      () => {
        // onClose callback
      },
    )
  }

  function updateColor(key: string, mode: "dark" | "light", value: string) {
    setColors(key, mode, value)
  }

  const getCurrentMode = createMemo((): "dark" | "light" => {
    const m: any = store.mode
    return m === "dark" || m === "light" ? m : "dark"
  })

  useKeyboard((evt) => {
    if (store.editing) {
      if (evt.name === "escape" || evt.name === "return") {
        setStore("editing", null)
        setTimeout(() => scrollBox?.focus(), 1)
      }
      return
    }

    if (evt.name === "up" || (evt.name === "k" && !evt.ctrl && !evt.meta)) {
      setStore("selected", (prev) => Math.max(0, prev - 1))
    } else if (evt.name === "down" || (evt.name === "j" && !evt.ctrl && !evt.meta)) {
      setStore("selected", (prev) => Math.min(flatFields().length - 1, prev + 1))
    } else if (evt.name === "return" || evt.name === "space") {
      const field = flatFields()[store.selected]
      if (field) {
        setStore("editing", field.key)
        setTimeout(() => input?.focus(), 10)
      }
    } else if (evt.name === "t") {
      setStore("mode", (prev: any) => (prev === "dark" ? "light" : "dark"))
    } else if (evt.name === "p") {
      openColorPicker()
    } else if (evt.name === "n" && (evt.meta || evt.ctrl)) {
      renameTheme()
    } else if ((evt.meta || evt.ctrl) && evt.name === "s") {
      if (evt.shift) {
        saveAsNewTheme()
      } else {
        saveTheme()
      }
    } else if (evt.name === "escape") {
      dialog.clear()
    }
  })

  onMount(() => {
    dialog.setSize("large")
    setTimeout(() => scrollBox?.focus(), 1)
  })

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={themeContext.theme.backgroundPanel}>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text attributes={TextAttributes.BOLD} fg={themeContext.theme.text}>
            Edit Theme: {store.themeName}
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={themeContext.theme.textMuted}>
              Mode: <span style={{ fg: themeContext.theme.text }}>{getCurrentMode()}</span>
            </text>
          </box>
        </box>
      </box>

      {/* Color list */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollBox = r)}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        maxHeight={dimensions().height - 10}
        scrollbarOptions={{ visible: false }}
      >
        <box flexDirection="column" gap={0}>
          <For each={flatFields()}>
            {(field, index) => {
              const isSelected = () => index() === store.selected
              const isEditing = () => store.editing === field.key
              const mode = getCurrentMode()
              const currentValue = () => colors[field.key]?.[mode] || "#000000"

              // Show category header
              const showCategory = () => {
                if (index() === 0) return true
                const prev = flatFields()[index() - 1]
                return prev && prev.category !== field.category
              }

              return (
                <>
                  <Show when={showCategory()}>
                    <box paddingTop={index() === 0 ? 0 : 1} paddingBottom={1}>
                      <text attributes={TextAttributes.BOLD} fg={themeContext.theme.primary}>
                        {field.category}
                      </text>
                    </box>
                  </Show>
                  <box
                    flexDirection="row"
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={0}
                    paddingBottom={0}
                    backgroundColor={isSelected() ? themeContext.theme.primary : undefined}
                    gap={1}
                  >
                    {/* Color preview */}
                    <box width={3} height={1} backgroundColor={RGBA.fromHex(currentValue())} />

                    {/* Label */}
                    <box width={25}>
                      <text fg={isSelected() ? selectedForeground(themeContext.theme) : themeContext.theme.text}>
                        {field.label}
                      </text>
                    </box>

                    {/* Value input/display */}
                    <box width={40}>
                      <Show
                        when={isEditing()}
                        fallback={
                          <text
                            fg={isSelected() ? selectedForeground(themeContext.theme) : themeContext.theme.textMuted}
                          >
                            {currentValue()}
                          </text>
                        }
                      >
                        <input
                          ref={(r) => (input = r)}
                          value={currentValue()}
                          onInput={(val) => updateColor(field.key, mode, val)}
                          onSubmit={() => {
                            setStore("editing", null)
                            setTimeout(() => scrollBox?.focus(), 1)
                          }}
                          textColor={themeContext.theme.text}
                          cursorColor={themeContext.theme.primary}
                        />
                      </Show>
                    </box>
                  </box>
                </>
              )
            }}
          </For>
        </box>
      </scrollbox>

      {/* Footer */}
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} backgroundColor={themeContext.theme.backgroundPanel}>
        <box flexDirection="column" gap={0}>
          <box flexDirection="row" gap={2}>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>enter</span> edit
            </text>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>p</span> picker
            </text>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>t</span> toggle mode
            </text>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>⌘/ctrl+n</span> rename
            </text>
          </box>
          <box flexDirection="row" gap={2}>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>⌘/ctrl+s</span> save
            </text>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>⇧⌘/⇧ctrl+s</span> save as
            </text>
            <text fg={themeContext.theme.text}>
              <span style={{ fg: themeContext.theme.textMuted }}>esc</span> cancel
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}
