import { TextAttributes, ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import { For, Show, createSignal, createEffect, createMemo } from "solid-js"
import {
  gitStatusDetailedFFI,
  gitStageFilesFFI,
  gitUnstageFilesFFI,
  gitCommitFFI,
  gitListBranchesFFI,
  gitCheckoutBranchFFI,
  gitFileDiffFFI,
  gitPushFFI,
  type GitFileStatus,
  type GitBranchInfo,
} from "@/tool/ffi"

type View = "status" | "branches" | "commit" | "diff"

export function DialogGit() {
  const sync = useSync()
  const route = useRoute()
  const { theme } = useTheme()
  const dialog = useDialog()
  const dimensions = useTerminalDimensions()
  const [hover, setHover] = createSignal(false)
  const [view, setView] = createSignal<View>("status")
  const [files, setFiles] = createSignal<GitFileStatus[]>([])
  const [branches, setBranches] = createSignal<GitBranchInfo[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [commitMessage, setCommitMessage] = createSignal("")
  const [diffContent, setDiffContent] = createSignal("")
  const [selectedFile, setSelectedFile] = createSignal<GitFileStatus | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null)

  let diffScrollBoxRef: ScrollBoxRenderable

  const cwd = createMemo(() => {
    if (route.data.type === "session") {
      const session = sync.session.get(route.data.sessionID)
      return session?.directory || "."
    }
    return "."
  })
  const branch = createMemo(() => sync.data.vcs?.branch || "main")

  const stagedFiles = createMemo(() => files().filter((f) => f.staged))
  const unstagedFiles = createMemo(() => files().filter((f) => !f.staged))

  const maxHeight = createMemo(() => dimensions().height - 12)

  const diffLines = createMemo(() => {
    const content = diffContent()
    if (!content) return []
    return content.split("\n")
  })

  // Get current list items for navigation
  const currentItems = createMemo(() => {
    const currentView = view()
    if (currentView === "status") {
      return files()
    } else if (currentView === "branches") {
      return branches()
    }
    return []
  })

  // Reset selection when view or items change
  createEffect(() => {
    const items = currentItems()
    if (selectedIndex() >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1))
    }
  })

  // Load git status on mount
  createEffect(() => {
    if (view() === "status") {
      refreshStatus()
    } else if (view() === "branches") {
      refreshBranches()
    }
  })

  const refreshStatus = () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      const status = gitStatusDetailedFFI(cwd())
      if (status) {
        setFiles(status.files)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get Git status")
    } finally {
      setLoading(false)
    }
  }

  const refreshBranches = () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      const branchList = gitListBranchesFFI(cwd())
      setBranches(branchList)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list branches")
    } finally {
      setLoading(false)
    }
  }

  const handleStage = (file: GitFileStatus) => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      gitStageFilesFFI(cwd(), [file.path])
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stage file")
    } finally {
      setLoading(false)
    }
  }

  const handleUnstage = (file: GitFileStatus) => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      gitUnstageFilesFFI(cwd(), [file.path])
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unstage file")
    } finally {
      setLoading(false)
    }
  }

  const handleStageAll = () => {
    try {
      setLoading(true)
      setError(null)
      gitStageFilesFFI(cwd(), [])
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stage all")
    } finally {
      setLoading(false)
    }
  }

  const handleUnstageAll = () => {
    try {
      setLoading(true)
      setError(null)
      gitUnstageFilesFFI(cwd(), [])
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unstage all")
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = () => {
    const msg = commitMessage().trim()
    if (!msg) {
      setError("Commit message cannot be empty")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      const result = gitCommitFFI(cwd(), msg)

      if (result.success) {
        const commitHash = result.commit ? result.commit.substring(0, 7) : "unknown"
        setSuccessMessage(`✓ Committed ${commitHash}: ${msg}`)
        setCommitMessage("")
        setView("status")
        refreshStatus()

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000)
      } else if (result.error) {
        setError(result.error)
      } else {
        setError("Commit failed")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to commit")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = (branchName: string) => {
    try {
      setLoading(true)
      setError(null)
      gitCheckoutBranchFFI(cwd(), branchName)
      setView("status")
      refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to checkout branch")
    } finally {
      setLoading(false)
    }
  }

  const handleShowDiff = (file: GitFileStatus) => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      const diff = gitFileDiffFFI(cwd(), file.path, file.staged)
      setDiffContent(diff)
      setSelectedFile(file)
      setView("diff")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get diff")
    } finally {
      setLoading(false)
    }
  }

  const handlePush = () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      const result = gitPushFFI(cwd())

      if (result.success && result.message) {
        setSuccessMessage(`✓ ${result.message}`)
        setTimeout(() => setSuccessMessage(null), 3000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to push")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return "+"
      case "modified":
        return "~"
      case "deleted":
        return "-"
      case "untracked":
        return "?"
      default:
        return "•"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "added":
        return theme.success
      case "modified":
        return theme.warning
      case "deleted":
        return theme.error
      case "untracked":
        return theme.textMuted
      default:
        return theme.text
    }
  }

  // Keyboard navigation
  function moveSelection(delta: number) {
    const items = currentItems()
    if (items.length === 0) return

    const newIndex = selectedIndex() + delta
    if (newIndex < 0) {
      setSelectedIndex(items.length - 1)
    } else if (newIndex >= items.length) {
      setSelectedIndex(0)
    } else {
      setSelectedIndex(newIndex)
    }
  }

  function handleEnter() {
    const currentView = view()
    const index = selectedIndex()

    if (currentView === "status") {
      const allFiles = files()
      if (index < allFiles.length) {
        handleShowDiff(allFiles[index])
      }
    } else if (currentView === "branches") {
      const branchList = branches()
      if (index < branchList.length) {
        const branch = branchList[index]
        if (!branch.is_head) {
          handleCheckout(branch.name)
        }
      }
    } else if (currentView === "diff") {
      setView("status")
    }
  }

  function handleSpace() {
    const currentView = view()
    if (currentView !== "status") return

    const allFiles = files()
    const index = selectedIndex()
    if (index >= allFiles.length) return

    const file = allFiles[index]
    if (file.staged) {
      handleUnstage(file)
    } else {
      handleStage(file)
    }
  }

  useKeyboard((evt) => {
    const name = evt.name?.toLowerCase()
    const currentView = view()

    // Handle text input in commit view
    if (currentView === "commit") {
      if (name === "return") {
        handleCommit()
        evt.preventDefault()
      } else if (name === "backspace") {
        setCommitMessage((prev) => prev.slice(0, -1))
        evt.preventDefault()
      } else if (name === "escape") {
        // Let escape close the dialog (don't preventDefault)
        return
      } else if (evt.sequence && !evt.ctrl && !evt.meta && evt.sequence.length === 1) {
        // Add typed character
        setCommitMessage((prev) => prev + evt.sequence)
        evt.preventDefault()
      }
      return
    }

    // Navigation and actions for other views
    if (name === "down" || name === "j") {
      moveSelection(1)
      evt.preventDefault()
    } else if (name === "up" || name === "k") {
      moveSelection(-1)
      evt.preventDefault()
    } else if (name === "return") {
      handleEnter()
      evt.preventDefault()
    } else if (name === "space") {
      handleSpace()
      evt.preventDefault()
    } else if (name === "1") {
      setView("status")
      evt.preventDefault()
    } else if (name === "2") {
      setView("branches")
      evt.preventDefault()
    } else if (name === "3") {
      if (stagedFiles().length > 0) {
        setView("commit")
      } else {
        setError("No files staged for commit. Stage files first with Space or 'a'")
        setTimeout(() => setError(null), 2000)
      }
      evt.preventDefault()
    } else if (name === "backspace" || name === "h") {
      if (view() === "diff") {
        setView("status")
        evt.preventDefault()
      }
    } else if (name === "r") {
      if (view() === "status") {
        refreshStatus()
        evt.preventDefault()
      } else if (view() === "branches") {
        refreshBranches()
        evt.preventDefault()
      }
    } else if (name === "a" && view() === "status") {
      handleStageAll()
      evt.preventDefault()
    } else if (name === "u" && view() === "status") {
      handleUnstageAll()
      evt.preventDefault()
    } else if (name === "p" && view() === "status") {
      handlePush()
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%" gap={1}>
      {/* Header */}
      <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Git: {branch()}
          </text>
          <box
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={hover() ? theme.primary : undefined}
            onMouseOver={() => setHover(true)}
            onMouseOut={() => setHover(false)}
            onMouseUp={() => dialog.clear()}
          >
            <text fg={hover() ? theme.selectedListItemText : theme.textMuted}>esc</text>
          </box>
        </box>

        {/* Keyboard shortcuts help */}
        <box paddingLeft={2} paddingRight={2}>
          <Show when={view() === "status"}>
            <text fg={theme.textMuted}>
              ↑↓/jk: navigate | Enter: diff | Space: stage/unstage | a: stage all | u: unstage all | p: push | r:
              refresh
            </text>
          </Show>
          <Show when={view() === "branches"}>
            <text fg={theme.textMuted}>↑↓/jk: navigate | Enter: checkout | r: refresh</text>
          </Show>
          <Show when={view() === "commit"}>
            <text fg={theme.textMuted}>Type message | Enter: commit | Esc: cancel</text>
          </Show>
          <Show when={view() === "diff"}>
            <text fg={theme.textMuted}>h/Backspace: back to status</text>
          </Show>
        </box>

        {/* Main Content Area */}
        <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1} flexGrow={1} gap={1}>
          {/* Error display */}
          <Show when={error()}>
            <text fg={theme.error}>{error()}</text>
          </Show>

          {/* Success message */}
          <Show when={successMessage()}>
            <text fg={theme.success}>{successMessage()}</text>
          </Show>

          {/* Loading indicator */}
          <Show when={loading()}>
            <text fg={theme.textMuted}>Loading...</text>
          </Show>

          {/* View Tabs */}
          <box flexDirection="row" justifyContent="space-between" alignItems="center">
            <box flexDirection="row" gap={2}>
              <text
                fg={view() === "status" ? theme.primary : theme.textMuted}
                attributes={view() === "status" ? TextAttributes.BOLD : undefined}
                onMouseUp={() => setView("status")}
              >
                Status
              </text>
              <text
                fg={view() === "branches" ? theme.primary : theme.textMuted}
                attributes={view() === "branches" ? TextAttributes.BOLD : undefined}
                onMouseUp={() => setView("branches")}
              >
                Branches
              </text>
              <text
                fg={view() === "commit" ? theme.primary : theme.textMuted}
                attributes={view() === "commit" ? TextAttributes.BOLD : undefined}
                onMouseUp={() => {
                  if (stagedFiles().length > 0) {
                    setView("commit")
                  } else {
                    setError("No files staged for commit. Stage files first.")
                    setTimeout(() => setError(null), 2000)
                  }
                }}
              >
                Commit {stagedFiles().length > 0 ? `(${stagedFiles().length})` : ""}
              </text>
            </box>

            {/* Push button - always visible */}
            <box
              paddingLeft={2}
              paddingRight={2}
              paddingTop={0}
              paddingBottom={0}
              backgroundColor={theme.primary}
              onMouseUp={handlePush}
            >
              <text fg={theme.selectedListItemText} attributes={TextAttributes.BOLD}>
                Push (p)
              </text>
            </box>
          </box>

          {/* Status View */}
          <Show when={view() === "status"}>
            <scrollbox
              height={maxHeight()}
              backgroundColor={theme.backgroundElement}
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
            >
              <box flexDirection="column" gap={1}>
                {/* Staged Changes */}
                <Show when={stagedFiles().length > 0}>
                  <box flexDirection="column">
                    <box flexDirection="row" justifyContent="space-between">
                      <text fg={theme.success} attributes={TextAttributes.BOLD}>
                        Staged Changes ({stagedFiles().length})
                      </text>
                      <text fg={theme.textMuted} onMouseUp={handleUnstageAll}>
                        [unstage all]
                      </text>
                    </box>
                    <For each={files()}>
                      {(file, index) => (
                        <Show when={file.staged}>
                          <box
                            flexDirection="row"
                            gap={1}
                            backgroundColor={index() === selectedIndex() ? theme.backgroundPanel : undefined}
                            paddingLeft={1}
                            paddingRight={1}
                            onMouseMove={() => setSelectedIndex(index())}
                          >
                            <text fg={getStatusColor(file.status)}>{getStatusIcon(file.status)}</text>
                            <text
                              fg={theme.text}
                              flexGrow={1}
                              onMouseUp={() => handleShowDiff(file)}
                              attributes={index() === selectedIndex() ? TextAttributes.BOLD : undefined}
                            >
                              {file.path}
                            </text>
                            <text fg={theme.textMuted} onMouseUp={() => handleUnstage(file)}>
                              [-]
                            </text>
                          </box>
                        </Show>
                      )}
                    </For>
                  </box>
                </Show>

                {/* Unstaged Changes */}
                <Show when={unstagedFiles().length > 0}>
                  <box flexDirection="column">
                    <box flexDirection="row" justifyContent="space-between">
                      <text fg={theme.warning} attributes={TextAttributes.BOLD}>
                        Changes ({unstagedFiles().length})
                      </text>
                      <text fg={theme.textMuted} onMouseUp={handleStageAll}>
                        [stage all]
                      </text>
                    </box>
                    <For each={files()}>
                      {(file, index) => (
                        <Show when={!file.staged}>
                          <box
                            flexDirection="row"
                            gap={1}
                            backgroundColor={index() === selectedIndex() ? theme.backgroundPanel : undefined}
                            paddingLeft={1}
                            paddingRight={1}
                            onMouseMove={() => setSelectedIndex(index())}
                          >
                            <text fg={getStatusColor(file.status)}>{getStatusIcon(file.status)}</text>
                            <text
                              fg={theme.text}
                              flexGrow={1}
                              onMouseUp={() => handleShowDiff(file)}
                              attributes={index() === selectedIndex() ? TextAttributes.BOLD : undefined}
                            >
                              {file.path}
                            </text>
                            <text fg={theme.textMuted} onMouseUp={() => handleStage(file)}>
                              [+]
                            </text>
                          </box>
                        </Show>
                      )}
                    </For>
                  </box>
                </Show>

                <Show when={files().length === 0 && !loading()}>
                  <text fg={theme.textMuted}>No changes</text>
                </Show>
              </box>
            </scrollbox>
          </Show>

          {/* Branches View */}
          <Show when={view() === "branches"}>
            <scrollbox
              height={maxHeight()}
              backgroundColor={theme.backgroundElement}
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
            >
              <box flexDirection="column" gap={1}>
                <For each={branches()}>
                  {(branch, index) => (
                    <box
                      flexDirection="row"
                      gap={1}
                      backgroundColor={index() === selectedIndex() ? theme.backgroundPanel : undefined}
                      paddingLeft={1}
                      paddingRight={1}
                      onMouseMove={() => setSelectedIndex(index())}
                    >
                      <text fg={branch.is_head ? theme.success : theme.textMuted}>{branch.is_head ? "* " : "  "}</text>
                      <text
                        fg={branch.is_head ? theme.success : theme.text}
                        attributes={branch.is_head || index() === selectedIndex() ? TextAttributes.BOLD : undefined}
                        onMouseUp={() => !branch.is_head && handleCheckout(branch.name)}
                      >
                        {branch.name}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            </scrollbox>
          </Show>

          {/* Commit View */}
          <Show when={view() === "commit"}>
            <box flexDirection="column" gap={1}>
              <text fg={theme.text} attributes={TextAttributes.BOLD}>
                Commit Message:
              </text>
              <text fg={theme.textMuted}>Files to commit: {stagedFiles().length}</text>
              <box border={["top", "right", "bottom", "left"]} borderColor={theme.border} padding={1} minHeight={3}>
                <box flexDirection="row">
                  <text fg={theme.text}>{commitMessage()}</text>
                  <text fg={theme.primary}>▊</text>
                </box>
              </box>
              <text fg={theme.textMuted}>Type your commit message, then press Enter to commit</text>
              <box flexDirection="row" gap={2}>
                <text fg={theme.primary} onMouseUp={handleCommit}>
                  [Commit]
                </text>
                <text fg={theme.textMuted} onMouseUp={() => setView("status")}>
                  [Cancel]
                </text>
              </box>
            </box>
          </Show>

          {/* Diff View */}
          <Show when={view() === "diff"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <box flexDirection="row" justifyContent="space-between">
                <text fg={theme.text} attributes={TextAttributes.BOLD}>
                  {selectedFile()?.path}
                </text>
                <text fg={theme.textMuted} onMouseUp={() => setView("status")}>
                  [Back]
                </text>
              </box>

              <scrollbox
                ref={(ref) => (diffScrollBoxRef = ref)}
                height={maxHeight()}
                backgroundColor={theme.backgroundElement}
                paddingLeft={2}
                paddingRight={2}
                paddingTop={1}
                paddingBottom={1}
              >
                <Show
                  when={diffLines().length > 0}
                  fallback={
                    <box alignItems="center" justifyContent="center">
                      <text fg={theme.textMuted}>No changes</text>
                    </box>
                  }
                >
                  <box flexDirection="column">
                    <For each={diffLines()}>
                      {(line) => {
                        // Diff syntax highlighting
                        let color = theme.text
                        let attrs = undefined

                        if (line.startsWith("+")) {
                          color = theme.success // Green for additions
                        } else if (line.startsWith("-")) {
                          color = theme.error // Red for deletions
                        } else if (line.startsWith("@@")) {
                          color = theme.primary // Blue for line numbers
                          attrs = TextAttributes.BOLD
                        } else if (
                          line.startsWith("diff") ||
                          line.startsWith("index") ||
                          line.startsWith("---") ||
                          line.startsWith("+++")
                        ) {
                          color = theme.accent // Accent for file headers
                          attrs = TextAttributes.BOLD
                        } else {
                          color = theme.textMuted // Gray for context
                        }

                        return (
                          <box flexDirection="row">
                            <text fg={color} attributes={attrs}>
                              {line || " "}
                            </text>
                          </box>
                        )
                      }}
                    </For>
                  </box>
                </Show>
              </scrollbox>
            </box>
          </Show>
        </box>
      </box>
    </box>
  )
}
