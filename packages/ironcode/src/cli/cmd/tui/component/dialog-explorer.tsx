import { createSignal, createMemo, For, Show, onMount, createEffect } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useTheme, selectedForeground } from "../context/theme"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { readdir, readFile, stat } from "fs/promises"
import { join, dirname, extname, basename } from "path"
import { homedir } from "os"
import { highlightLine, getLanguageFromExtension, type Theme as SyntaxTheme } from "../util/syntax-highlight"

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  isExpanded: boolean
  level: number
  size?: number
  children?: FileNode[]
}

export function DialogExplorer() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const [currentPath, setCurrentPath] = createSignal(process.cwd())
  const [files, setFiles] = createSignal<FileNode[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  // File preview state
  const [previewContent, setPreviewContent] = createSignal<string>("")
  const [previewLoading, setPreviewLoading] = createSignal(false)
  const [previewError, setPreviewError] = createSignal<string | null>(null)

  let fileScrollBoxRef: ScrollBoxRenderable
  let previewScrollBoxRef: ScrollBoxRenderable

  async function loadDirectory(path: string, level: number = 0): Promise<FileNode[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true })
      const nodes: FileNode[] = []

      // Filter out common ignore patterns but keep git folders
      const filtered = entries.filter((entry) => {
        const name = entry.name
        // Keep .git and .github folders
        if (name === ".git" || name === ".github") return true
        // Filter other hidden files
        if (name.startsWith(".")) return false
        if (name === "node_modules") return false
        if (name === "dist") return false
        if (name === "build") return false
        return true
      })

      // Sort: directories first, then files, alphabetically
      filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of filtered) {
        const fullPath = join(path, entry.name)
        let size: number | undefined

        if (!entry.isDirectory()) {
          try {
            const stats = await stat(fullPath)
            size = stats.size
          } catch (err) {
            // Ignore stat errors
          }
        }

        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          isExpanded: false,
          level,
          size,
          children: entry.isDirectory() ? [] : undefined,
        })
      }

      return nodes
    } catch (err) {
      console.error("Error loading directory:", err)
      return []
    }
  }

  async function refreshFiles() {
    setLoading(true)
    setError(null)
    try {
      const nodes = await loadDirectory(currentPath())
      setFiles(nodes)
      setSelectedIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory")
    } finally {
      setLoading(false)
    }
  }

  async function loadFilePreview(filePath: string) {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewContent("")

    try {
      const stats = await stat(filePath)

      // Don't preview files larger than 1MB
      if (stats.size > 1024 * 1024) {
        setPreviewError("File too large to preview (> 1MB)")
        setPreviewLoading(false)
        return
      }

      const content = await readFile(filePath, "utf-8")
      setPreviewContent(content)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("EISDIR")) {
          setPreviewError("Cannot preview directory")
        } else if (err.message.includes("EACCES")) {
          setPreviewError("Permission denied")
        } else {
          setPreviewError("Cannot read file (binary or encoding issue)")
        }
      } else {
        setPreviewError("Failed to load file")
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  onMount(() => {
    refreshFiles()
  })

  // Flatten the tree for rendering and navigation
  const flattenedFiles = createMemo(() => {
    const result: FileNode[] = []
    function flatten(nodes: FileNode[]) {
      for (const node of nodes) {
        result.push(node)
        if (node.isExpanded && node.children) {
          flatten(node.children)
        }
      }
    }
    flatten(files())
    return result
  })

  // Load preview when selection changes
  createEffect(() => {
    const selected = flattenedFiles()[selectedIndex()]
    if (selected && !selected.isDirectory) {
      loadFilePreview(selected.path)
    } else {
      setPreviewContent("")
      setPreviewError(null)
    }
  })

  async function toggleExpand(node: FileNode) {
    if (!node.isDirectory) return

    setFiles((prev) => {
      const updated = [...prev]
      function update(nodes: FileNode[]): boolean {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].path === node.path) {
            nodes[i] = { ...nodes[i], isExpanded: !nodes[i].isExpanded }
            if (nodes[i].isExpanded && (!nodes[i].children || nodes[i].children!.length === 0)) {
              loadDirectory(nodes[i].path, nodes[i].level + 1).then((children) => {
                setFiles((prev) => {
                  const updated = [...prev]
                  function setChildren(nodes: FileNode[]): boolean {
                    for (let i = 0; i < nodes.length; i++) {
                      if (nodes[i].path === node.path) {
                        nodes[i] = { ...nodes[i], children }
                        return true
                      }
                      if (nodes[i].children && setChildren(nodes[i].children!)) {
                        return true
                      }
                    }
                    return false
                  }
                  setChildren(updated)
                  return updated
                })
              })
            }
            return true
          }
          if (nodes[i].children && update(nodes[i].children!)) {
            return true
          }
        }
        return false
      }
      update(updated)
      return updated
    })
  }

  function moveSelection(delta: number) {
    const newIndex = selectedIndex() + delta
    const max = flattenedFiles().length - 1
    if (newIndex < 0) {
      setSelectedIndex(max)
    } else if (newIndex > max) {
      setSelectedIndex(0)
    } else {
      setSelectedIndex(newIndex)
    }

    // Scroll to keep selection visible
    if (fileScrollBoxRef) {
      fileScrollBoxRef.scrollTo(selectedIndex())
    }
  }

  function goUp() {
    const parent = dirname(currentPath())
    if (parent !== currentPath()) {
      setCurrentPath(parent)
      refreshFiles()
    }
  }

  function selectFile() {
    const selected = flattenedFiles()[selectedIndex()]
    if (!selected) return

    if (selected.isDirectory) {
      toggleExpand(selected)
    } else {
      // Just toggle preview, don't close dialog
      // User can close with ESC key
      console.log("Selected file:", selected.path)
      // TODO: Insert file path into prompt or open in editor
    }
  }

  useKeyboard((evt) => {
    const name = evt.name?.toLowerCase()

    if (name === "down" || name === "j") {
      moveSelection(1)
      evt.preventDefault()
    } else if (name === "up" || name === "k") {
      moveSelection(-1)
      evt.preventDefault()
    } else if (name === "return") {
      selectFile()
      evt.preventDefault()
    } else if (name === "left" || name === "h") {
      const selected = flattenedFiles()[selectedIndex()]
      if (selected && selected.isDirectory && selected.isExpanded) {
        toggleExpand(selected)
      } else {
        goUp()
      }
      evt.preventDefault()
    } else if (name === "right" || name === "l") {
      const selected = flattenedFiles()[selectedIndex()]
      if (selected && selected.isDirectory && !selected.isExpanded) {
        toggleExpand(selected)
      }
      evt.preventDefault()
    } else if (name === "r") {
      refreshFiles()
      evt.preventDefault()
    } else if (name === "~") {
      setCurrentPath(homedir())
      refreshFiles()
      evt.preventDefault()
    } else if (name === ".") {
      setCurrentPath(process.cwd())
      refreshFiles()
      evt.preventDefault()
    }
  })

  const displayPath = createMemo(() => {
    const path = currentPath()
    const home = homedir()
    if (path === home) return "~"
    if (path.startsWith(home)) return "~" + path.slice(home.length)
    return path
  })

  const maxHeight = createMemo(() => dimensions().height - 10)

  function formatFileSize(bytes?: number): string {
    if (bytes === undefined) return ""
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const selectedFile = createMemo(() => flattenedFiles()[selectedIndex()])

  const previewLines = createMemo(() => {
    const content = previewContent()
    if (!content) return []
    return content.split("\n")
  })

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

  const language = createMemo(() => {
    const file = selectedFile()
    if (!file || file.isDirectory) return undefined
    return getLanguageFromExtension(file.path)
  })

  return (
    <box flexDirection="column" width="100%" height="100%" gap={1}>
      {/* Header */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.primary}>
            📁 Project Explorer
          </text>
          <text fg={theme.textMuted}>Press Esc to close</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>Path:</text>
          <text>{displayPath()}</text>
        </box>
      </box>

      {/* Main content - split panel */}
      <box flexDirection="row" width="100%" gap={2} paddingLeft={2} paddingRight={2}>
        {/* Left panel - File tree */}
        <box flexDirection="column" width="30%" gap={1}>
          <box flexDirection="row" gap={2} paddingBottom={1}>
            <text fg={theme.textMuted}>↑↓/jk: navigate</text>
            <text fg={theme.textMuted}>←→/hl: expand</text>
            <text fg={theme.textMuted}>Enter: select</text>
          </box>

          <Show when={!loading()} fallback={<text>Loading...</text>}>
            <Show when={!error()} fallback={<text fg={theme.error}>{error()}</text>}>
              <scrollbox
                ref={(ref) => (fileScrollBoxRef = ref)}
                height={maxHeight()}
                backgroundColor={theme.backgroundElement}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
              >
                <box flexDirection="column">
                  <For each={flattenedFiles()}>
                    {(node, index) => {
                      const isSelected = createMemo(() => index() === selectedIndex())
                      const indent = "  ".repeat(node.level)
                      const icon = node.isDirectory ? (node.isExpanded ? "▼ " : "▶ ") : "  "

                      return (
                        <box
                          flexDirection="row"
                          backgroundColor={isSelected() ? theme.backgroundPanel : undefined}
                          paddingLeft={1}
                          paddingRight={1}
                          onMouseMove={() => setSelectedIndex(index())}
                          onMouseUp={() => selectFile()}
                        >
                          <text
                            fg={node.isDirectory ? theme.primary : isSelected() ? theme.text : theme.textMuted}
                            attributes={isSelected() ? TextAttributes.BOLD : undefined}
                          >
                            {indent}
                            {icon}
                            {node.name}
                            {node.isDirectory ? "/" : ""}
                          </text>
                        </box>
                      )
                    }}
                  </For>
                </box>
              </scrollbox>
            </Show>
          </Show>

          <box flexDirection="row" gap={2} paddingTop={1}>
            <text fg={theme.textMuted}>r: refresh</text>
            <text fg={theme.textMuted}>~: home</text>
            <text fg={theme.textMuted}>.: project root</text>
          </box>
        </box>

        {/* Right panel - File preview */}
        <box flexDirection="column" width="70%" gap={1}>
          <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
            <text attributes={TextAttributes.BOLD} fg={theme.accent}>
              {selectedFile()?.isDirectory ? "Directory" : "Preview"}
            </text>
            <Show when={selectedFile() && !selectedFile()!.isDirectory}>
              <text fg={theme.textMuted}>{formatFileSize(selectedFile()?.size)}</text>
            </Show>
          </box>

          <Show
            when={selectedFile()}
            fallback={
              <box
                height={maxHeight()}
                backgroundColor={theme.backgroundElement}
                alignItems="center"
                justifyContent="center"
              >
                <text fg={theme.textMuted}>Select a file to preview</text>
              </box>
            }
          >
            <Show when={!selectedFile()!.isDirectory}>
              <scrollbox
                ref={(ref) => (previewScrollBoxRef = ref)}
                height={maxHeight()}
                backgroundColor={theme.backgroundElement}
                paddingLeft={2}
                paddingRight={2}
                paddingTop={1}
                paddingBottom={1}
              >
                <Show
                  when={!previewLoading() && !previewError()}
                  fallback={
                    <box flexDirection="column" gap={1}>
                      <Show when={previewLoading()}>
                        <text fg={theme.textMuted}>Loading preview...</text>
                      </Show>
                      <Show when={previewError()}>
                        <text fg={theme.error}>{previewError()}</text>
                      </Show>
                    </box>
                  }
                >
                  <box flexDirection="column">
                    <For each={previewLines()}>
                      {(line, index) => {
                        const tokens = language()
                          ? highlightLine(line || " ", language()!, syntaxTheme())
                          : [{ text: line || " " }]

                        return (
                          <box flexDirection="row">
                            <text fg={theme.textMuted} minWidth={4}>
                              {(index() + 1).toString().padStart(4, " ")}
                            </text>
                            <box flexDirection="row" paddingLeft={1}>
                              <For each={tokens}>
                                {(token) => <text fg={token.color || theme.text}>{token.text}</text>}
                              </For>
                            </box>
                          </box>
                        )
                      }}
                    </For>
                  </box>
                </Show>
              </scrollbox>
            </Show>

            <Show when={selectedFile()!.isDirectory}>
              <box
                height={maxHeight()}
                backgroundColor={theme.backgroundElement}
                alignItems="center"
                justifyContent="center"
                paddingLeft={2}
                paddingRight={2}
              >
                <box flexDirection="column" gap={1} alignItems="center">
                  <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                    📁 {selectedFile()!.name}
                  </text>
                  <text fg={theme.textMuted}>Press → or Enter to expand</text>
                </box>
              </box>
            </Show>
          </Show>

          <box flexDirection="row" gap={1} paddingTop={1}>
            <text fg={theme.textMuted}>Full path:</text>
            <text fg={theme.text}>{selectedFile()?.path || "No file selected"}</text>
          </box>
        </box>
      </box>
    </box>
  )
}
