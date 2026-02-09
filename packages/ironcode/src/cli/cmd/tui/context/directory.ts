import { createMemo } from "solid-js"
import { useSync } from "./sync"
import { Global } from "@/global"

export function useDirectory() {
  const sync = useSync()
  return createMemo(() => {
    const directory = sync.data.path.directory || process.cwd()
    const result = directory.replace(Global.Path.home, "~")

    // Add branch name
    let output = result
    if (sync.data.vcs?.branch) output += ":" + sync.data.vcs.branch

    // Add git status counts if available
    if (sync.data.vcs?.added || sync.data.vcs?.modified || sync.data.vcs?.deleted) {
      const parts = []
      if (sync.data.vcs.added) parts.push(`+${sync.data.vcs.added}`)
      if (sync.data.vcs.modified) parts.push(`~${sync.data.vcs.modified}`)
      if (sync.data.vcs.deleted) parts.push(`-${sync.data.vcs.deleted}`)
      if (parts.length > 0) output += " " + parts.join(" ")
    }

    return output
  })
}
