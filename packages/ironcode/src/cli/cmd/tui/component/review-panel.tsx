import { TextAttributes, ScrollBoxRenderable, RGBA, InputRenderable, Renderable } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useTerminalDimensions, useKeyboard, useRenderer } from "@opentui/solid"
import { For, Show, createEffect, createMemo, createSignal, batch, onMount } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Identifier } from "@/id/id"
import { gitStatusDetailedFFI, gitFileDiffFFI, type GitFileStatus } from "@/tool/ffi"
import { spawnSync } from "child_process"

interface UserComment {
  id: string
  lineIndex: number
  text: string
}

interface ChangedFile {
  path: string
  status: string
  diff: string
  additions: number
  deletions: number
  comments: UserComment[]
}

type ChangeMode = "uncommitted" | "staged" | "vs-main"

interface DiffHunk {
  startLine: number // index in diffLines array where @@ line is
  endLine: number // index of last line in this hunk (exclusive)
  header: string // the @@ line
}

function parseDiffHunks(diffText: string): { headerLines: string[]; hunks: DiffHunk[] } {
  const lines = diffText.split("\n")
  const hunks: DiffHunk[] = []
  const headerLines: string[] = []
  let foundFirstHunk = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("@@")) {
      if (!foundFirstHunk) {
        foundFirstHunk = true
      }
      const hunk: DiffHunk = { startLine: i, endLine: lines.length, header: lines[i] }
      if (hunks.length > 0) {
        hunks[hunks.length - 1].endLine = i
      }
      hunks.push(hunk)
    } else if (!foundFirstHunk) {
      headerLines.push(lines[i])
    }
  }

  return { headerLines, hunks }
}

function buildHunkPatch(diffText: string, hunkIndex: number): string | null {
  const { headerLines, hunks } = parseDiffHunks(diffText)
  const hunk = hunks[hunkIndex]
  if (!hunk) return null

  const lines = diffText.split("\n")
  const hunkLines = lines.slice(hunk.startLine, hunk.endLine)
  return [...headerLines, ...hunkLines, ""].join("\n")
}

export function ReviewPanel(props: {
  sessionID: string
  width: number
  onClose: () => void
  onRefine: (message: string) => void
}) {
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()

  // Save focused element on mount so we can restore it on close
  let savedFocus: Renderable | null = null
  onMount(() => {
    savedFocus = renderer.currentFocusedRenderable
  })
  function refocus() {
    setTimeout(() => {
      if (!savedFocus) return
      if (savedFocus.isDestroyed) return
      function find(item: Renderable): boolean {
        for (const child of item.getChildren()) {
          if (child === savedFocus) return true
          if (find(child)) return true
        }
        return false
      }
      const found = find(renderer.root)
      if (!found) return
      savedFocus.focus()
    }, 1)
  }

  const [store, setStore] = createStore({
    files: [] as ChangedFile[],
    selectedFileIndex: 0,
    selectedDiffLine: 0,
    selectedCommentIndex: -1,
    commenting: false,
    mode: "uncommitted" as ChangeMode,
    status: "idle" as "idle" | "loading" | "error",
    error: null as string | null,
  })

  let fileScrollRef: ScrollBoxRenderable
  let diffScrollRef: ScrollBoxRenderable
  let commentInputRef: InputRenderable
  const [commentText, setCommentText] = createSignal("")

  const cwd = createMemo(() => {
    if (route.data.type === "session") {
      const session = sync.session.get(route.data.sessionID)
      return session?.directory || "."
    }
    return "."
  })

  const maxHeight = createMemo(() => dimensions().height - 14)

  const selectedFile = createMemo(() => store.files[store.selectedFileIndex])

  const diffLines = createMemo(() => {
    const file = selectedFile()
    if (!file?.diff) return []
    return file.diff.split("\n")
  })

  const selectedFileComments = createMemo(() => {
    return selectedFile()?.comments ?? []
  })

  // Load git diffs
  function loadDiffs() {
    setStore("status", "loading")
    setStore("error", null)
    try {
      const status = gitStatusDetailedFFI(cwd())
      if (!status || status.files.length === 0) {
        setStore("files", [])
        setStore("status", "idle")
        return
      }

      const files: ChangedFile[] = status.files.map((file: GitFileStatus) => {
        const staged = store.mode === "staged"
        const diff = gitFileDiffFFI(cwd(), file.path, staged)
        const lines = diff.split("\n")
        const additions = lines.filter((l: string) => l.startsWith("+") && !l.startsWith("+++")).length
        const deletions = lines.filter((l: string) => l.startsWith("-") && !l.startsWith("---")).length
        return {
          path: file.path,
          status: file.status,
          diff,
          additions,
          deletions,
          comments: [],
        }
      })

      batch(() => {
        setStore("files", files)
        setStore("selectedFileIndex", 0)
        setStore("selectedDiffLine", 0)
        setStore("selectedCommentIndex", -1)
        setStore("commenting", false)
        setStore("status", "idle")
      })
    } catch (e) {
      setStore("status", "error")
      setStore("error", e instanceof Error ? e.message : "Failed to load diffs")
    }
  }

  // Load on mount and when session/cwd/mode changes
  createEffect(() => {
    const _m = store.mode
    const _cwd = cwd()
    const _sid = props.sessionID
    loadDiffs()
  })

  // Status helpers
  function statusIcon(status: string): string {
    switch (status) {
      case "modified":
        return "~"
      case "added":
        return "+"
      case "deleted":
        return "-"
      case "untracked":
        return "?"
      default:
        return " "
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "modified":
        return theme.warning
      case "added":
        return theme.success
      case "deleted":
        return theme.error
      case "untracked":
        return theme.textMuted
      default:
        return theme.text
    }
  }

  // Navigation
  function selectFile(delta: number) {
    const len = store.files.length
    if (len === 0) return
    const next = store.selectedFileIndex + delta
    if (next < 0) setStore("selectedFileIndex", len - 1)
    else if (next >= len) setStore("selectedFileIndex", 0)
    else setStore("selectedFileIndex", next)
    batch(() => {
      setStore("selectedDiffLine", 0)
      setStore("selectedCommentIndex", -1)
      setStore("commenting", false)
    })
    if (diffScrollRef) diffScrollRef.scrollTo(0)
  }

  function moveDiffLine(delta: number) {
    const len = diffLines().length
    if (len === 0) return
    let next = store.selectedDiffLine + delta
    if (next < 0) next = 0
    if (next >= len) next = len - 1
    setStore("selectedDiffLine", next)
  }

  function selectComment(delta: number) {
    const comments = selectedFileComments()
    if (comments.length === 0) return
    const next = store.selectedCommentIndex + delta
    if (next < -1) setStore("selectedCommentIndex", comments.length - 1)
    else if (next >= comments.length) setStore("selectedCommentIndex", -1)
    else setStore("selectedCommentIndex", next)
  }

  function startCommenting() {
    if (diffLines().length === 0) return
    setCommentText("")
    setStore("commenting", true)
    setTimeout(() => {
      if (commentInputRef && !commentInputRef.isDestroyed) {
        commentInputRef.focus()
      }
    }, 10)
  }

  function submitComment() {
    const text = commentText()
    if (!text.trim()) {
      setStore("commenting", false)
      return
    }
    const file = selectedFile()
    if (!file) return

    setStore(
      "files",
      store.selectedFileIndex,
      "comments",
      produce((comments) => {
        comments.push({
          id: Identifier.ascending("part"),
          lineIndex: store.selectedDiffLine,
          text: text.trim(),
        })
      }),
    )
    setStore("commenting", false)
  }

  function dismissComment() {
    if (store.selectedCommentIndex < 0) return
    const idx = store.selectedCommentIndex
    setStore("files", store.selectedFileIndex, "comments", (comments: UserComment[]) =>
      comments.filter((_: UserComment, i: number) => i !== idx),
    )
    if (store.selectedCommentIndex >= selectedFileComments().length) {
      setStore("selectedCommentIndex", selectedFileComments().length - 1)
    }
  }

  function sendCommentToChat() {
    if (store.selectedCommentIndex < 0) return
    const comment = selectedFileComments()[store.selectedCommentIndex]
    if (!comment) return
    const file = selectedFile()
    if (!file) return
    const diffLine = diffLines()[comment.lineIndex] ?? ""
    const message = `In ${file.path} (line ${comment.lineIndex + 1} of diff):\n> ${diffLine}\n\nComment: ${comment.text}\n\nPlease address this.`
    props.onRefine(message)
  }

  // Hunk detection and revert
  const currentHunkIndex = createMemo(() => {
    const file = selectedFile()
    if (!file?.diff) return -1
    const { hunks } = parseDiffHunks(file.diff)
    const line = store.selectedDiffLine
    for (let i = hunks.length - 1; i >= 0; i--) {
      if (line >= hunks[i].startLine) return i
    }
    return -1
  })

  function revertHunk() {
    const file = selectedFile()
    if (!file?.diff) return
    const hunkIdx = currentHunkIndex()
    if (hunkIdx < 0) return

    const patch = buildHunkPatch(file.diff, hunkIdx)
    if (!patch) return

    const args = ["apply", "--reverse"]
    if (store.mode === "staged") {
      args.push("--cached")
    }

    const result = spawnSync("git", args, {
      cwd: cwd(),
      input: patch,
      encoding: "utf-8",
    })

    if (result.status !== 0) {
      setStore("error", result.stderr?.toString().trim() || "Failed to revert hunk")
      setStore("status", "error")
      return
    }

    loadDiffs()
  }

  function cycleMode() {
    const modes: ChangeMode[] = ["uncommitted", "staged", "vs-main"]
    const current = modes.indexOf(store.mode)
    setStore("mode", modes[(current + 1) % modes.length])
  }

  // Keyboard
  useKeyboard((evt) => {
    const name = evt.name?.toLowerCase()

    // When commenting, handle Enter to submit and Esc to cancel
    if (store.commenting) {
      if (name === "return") {
        submitComment()
        evt.preventDefault()
        evt.stopPropagation()
      } else if (name === "escape") {
        setStore("commenting", false)
        evt.preventDefault()
        evt.stopPropagation()
      } else if (evt.ctrl && (name === "c" || name === "d")) {
        // Let app exit keys pass through
        setStore("commenting", false)
      }
      // Let input handle everything else
      return
    }

    if (name === "escape") {
      props.onClose()
      evt.preventDefault()
      evt.stopPropagation()
      refocus()
      return
    }
    if (name === "j") {
      selectFile(1)
      evt.preventDefault()
    } else if (name === "k") {
      selectFile(-1)
      evt.preventDefault()
    } else if (name === "down") {
      moveDiffLine(1)
      evt.preventDefault()
    } else if (name === "up") {
      moveDiffLine(-1)
      evt.preventDefault()
    } else if (name === "n") {
      selectComment(1)
      evt.preventDefault()
    } else if (name === "p") {
      selectComment(-1)
      evt.preventDefault()
    } else if (name === "c") {
      startCommenting()
      evt.preventDefault()
    } else if (name === "d") {
      dismissComment()
      evt.preventDefault()
    } else if (name === "f") {
      sendCommentToChat()
      evt.preventDefault()
    } else if (name === "m") {
      cycleMode()
      evt.preventDefault()
    } else if (name === "r") {
      revertHunk()
      evt.preventDefault()
    } else if (name === "g") {
      loadDiffs()
      evt.preventDefault()
    }
  })

  const modeLabel = createMemo(() => {
    switch (store.mode) {
      case "uncommitted":
        return "Uncommitted"
      case "staged":
        return "Staged"
      case "vs-main":
        return "vs Main"
    }
  })

  const totalComments = createMemo(() => store.files.reduce((sum, f) => sum + f.comments.length, 0))

  // Current hunk range for highlighting
  const currentHunkRange = createMemo(() => {
    const file = selectedFile()
    if (!file?.diff) return null
    const { hunks } = parseDiffHunks(file.diff)
    const idx = currentHunkIndex()
    if (idx < 0) return null
    return { start: hunks[idx].startLine, end: hunks[idx].endLine }
  })

  // Build diff lines with inline comments
  const diffWithComments = createMemo(() => {
    const lines = diffLines()
    const comments = selectedFileComments()

    const result: {
      type: "diff" | "comment" | "comment-input"
      text: string
      index: number
      comment?: UserComment
      commentIndex?: number
    }[] = []

    const commentsByLine = new Map<number, { comment: UserComment; commentIndex: number }[]>()
    comments.forEach((c, idx) => {
      const existing = commentsByLine.get(c.lineIndex) || []
      existing.push({ comment: c, commentIndex: idx })
      commentsByLine.set(c.lineIndex, existing)
    })

    for (let i = 0; i < lines.length; i++) {
      result.push({ type: "diff", text: lines[i], index: i })

      // Show existing comments for this line
      const lineComments = commentsByLine.get(i)
      if (lineComments) {
        for (const { comment, commentIndex } of lineComments) {
          result.push({ type: "comment", text: "", index: i, comment, commentIndex })
        }
      }

      // Show comment input if commenting on this line
      if (store.commenting && i === store.selectedDiffLine) {
        result.push({ type: "comment-input", text: "", index: i })
      }
    }
    return result
  })

  return (
    <box
      flexDirection="column"
      width={props.width}
      height={dimensions().height}
      backgroundColor={theme.backgroundPanel}
      paddingTop={1}
      paddingBottom={1}
      borderColor={theme.border}
      border={["left"]}
    >
      {/* Header */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.primary}>
            Code Changes
          </text>
          <box flexDirection="row" gap={2}>
            <text fg={theme.accent} onMouseUp={cycleMode}>
              [{modeLabel()}]
            </text>
            <text fg={theme.textMuted} onMouseUp={props.onClose}>
              [X]
            </text>
          </box>
        </box>
        <Show when={store.status === "error"}>
          <text fg={theme.error}>{store.error}</text>
        </Show>
        <Show when={totalComments() > 0}>
          <text fg={theme.accent}>
            {totalComments()} comment{totalComments() > 1 ? "s" : ""}
          </text>
        </Show>
      </box>

      {/* File list */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1}>
        <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
          Files ({store.files.length})
        </text>
        <Show
          when={store.files.length > 0}
          fallback={
            <box paddingTop={1}>
              <text fg={theme.textMuted}>{store.status === "loading" ? "Loading..." : "No changes detected"}</text>
            </box>
          }
        >
          <scrollbox ref={(r) => (fileScrollRef = r)} maxHeight={Math.min(store.files.length + 1, 8)} paddingTop={1}>
            <box flexDirection="column">
              <For each={store.files}>
                {(file, index) => {
                  const isSelected = createMemo(() => index() === store.selectedFileIndex)
                  const commentCount = createMemo(() => file.comments.length)
                  return (
                    <box
                      flexDirection="row"
                      justifyContent="space-between"
                      backgroundColor={isSelected() ? theme.backgroundElement : undefined}
                      paddingLeft={1}
                      paddingRight={1}
                      onMouseUp={() => {
                        batch(() => {
                          setStore("selectedFileIndex", index())
                          setStore("selectedCommentIndex", -1)
                          setStore("selectedDiffLine", 0)
                          setStore("commenting", false)
                        })
                      }}
                    >
                      <box flexDirection="row" gap={1}>
                        <text fg={statusColor(file.status)}>{statusIcon(file.status)}</text>
                        <text
                          fg={isSelected() ? theme.text : theme.textMuted}
                          attributes={isSelected() ? TextAttributes.BOLD : undefined}
                          overflow="hidden"
                          wrapMode="none"
                        >
                          {file.path}
                        </text>
                      </box>
                      <box flexDirection="row" gap={1}>
                        <Show when={commentCount() > 0}>
                          <text fg={theme.accent}>{commentCount()}</text>
                        </Show>
                        <Show when={file.additions > 0}>
                          <text fg={theme.success}>+{file.additions}</text>
                        </Show>
                        <Show when={file.deletions > 0}>
                          <text fg={theme.error}>-{file.deletions}</text>
                        </Show>
                      </box>
                    </box>
                  )
                }}
              </For>
            </box>
          </scrollbox>
        </Show>
      </box>

      {/* Diff view with inline comments */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1}>
        <Show when={selectedFile()}>
          <text fg={theme.text} attributes={TextAttributes.BOLD} paddingBottom={1}>
            {selectedFile()!.path}
          </text>
          <scrollbox
            ref={(r) => (diffScrollRef = r)}
            flexGrow={1}
            maxHeight={maxHeight()}
            backgroundColor={theme.backgroundElement}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
          >
            <Show
              when={diffLines().length > 0}
              fallback={
                <box alignItems="center" justifyContent="center">
                  <text fg={theme.textMuted}>No diff available</text>
                </box>
              }
            >
              <box flexDirection="column">
                <For each={diffWithComments()}>
                  {(item) => {
                    if (item.type === "comment-input") {
                      return (
                        <box
                          flexDirection="column"
                          border={["left"]}
                          borderColor={theme.primary}
                          marginBottom={1}
                          paddingLeft={2}
                          paddingRight={1}
                          backgroundColor={RGBA.fromInts(30, 40, 60, 255)}
                        >
                          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                            Add comment:
                          </text>
                          <input
                            ref={(r) => {
                              commentInputRef = r
                              setTimeout(() => {
                                if (!r.isDestroyed) r.focus()
                              }, 10)
                            }}
                            focusedBackgroundColor={RGBA.fromInts(30, 40, 60, 255)}
                            cursorColor={theme.primary}
                            focusedTextColor={theme.text}
                            placeholder="Type your comment, Enter to save"
                            onInput={(val) => setCommentText(val)}
                            onSubmit={() => submitComment()}
                          />
                        </box>
                      )
                    }

                    if (item.type === "diff") {
                      const isCurrentLine = createMemo(() => item.index === store.selectedDiffLine && !store.commenting)
                      const isInCurrentHunk = createMemo(() => {
                        const range = currentHunkRange()
                        if (!range) return false
                        return item.index >= range.start && item.index < range.end
                      })
                      let color = theme.textMuted
                      let attrs: number | undefined = undefined

                      if (item.text.startsWith("+")) {
                        color = theme.success
                      } else if (item.text.startsWith("-")) {
                        color = theme.error
                      } else if (item.text.startsWith("@@")) {
                        color = theme.primary
                        attrs = TextAttributes.BOLD
                      } else if (
                        item.text.startsWith("diff") ||
                        item.text.startsWith("index") ||
                        item.text.startsWith("---") ||
                        item.text.startsWith("+++")
                      ) {
                        color = theme.accent
                        attrs = TextAttributes.BOLD
                      }

                      const bg = () =>
                        isCurrentLine()
                          ? RGBA.fromInts(255, 255, 255, 20)
                          : isInCurrentHunk()
                            ? RGBA.fromInts(255, 255, 255, 8)
                            : undefined

                      return (
                        <box backgroundColor={bg()} onMouseUp={() => setStore("selectedDiffLine", item.index)}>
                          <text fg={color} attributes={attrs}>
                            {item.text || " "}
                          </text>
                        </box>
                      )
                    }

                    // User comment inline
                    const comment = item.comment!
                    const isActive = createMemo(() => item.commentIndex === store.selectedCommentIndex)

                    return (
                      <box
                        flexDirection="column"
                        border={["left"]}
                        borderColor={isActive() ? theme.primary : theme.accent}
                        backgroundColor={isActive() ? RGBA.fromInts(40, 40, 50, 255) : undefined}
                        marginBottom={1}
                        paddingLeft={2}
                        paddingRight={1}
                        onMouseUp={() => setStore("selectedCommentIndex", item.commentIndex!)}
                      >
                        <text fg={theme.text} wrapMode="word">
                          {comment.text}
                        </text>
                        <Show when={isActive()}>
                          <box flexDirection="row" gap={2} paddingTop={1}>
                            <text fg={theme.primary} onMouseUp={sendCommentToChat}>
                              [f:Send to chat]
                            </text>
                            <text fg={theme.textMuted} onMouseUp={dismissComment}>
                              [d:Dismiss]
                            </text>
                          </box>
                        </Show>
                      </box>
                    )
                  }}
                </For>
              </box>
            </Show>
          </scrollbox>
        </Show>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={2} paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0} flexWrap="wrap">
        <text fg={theme.textMuted}>j/k:files</text>
        <text fg={theme.textMuted}>↑↓:lines</text>
        <text fg={theme.textMuted}>r:revert hunk</text>
        <text fg={theme.textMuted}>c:comment</text>
        <text fg={theme.textMuted}>m:mode</text>
        <text fg={theme.textMuted}>Esc:close</text>
      </box>
    </box>
  )
}
