import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { $ } from "bun"
import path from "path"
import z from "zod"
import { Log } from "@/util/log"
import { Instance } from "./instance"
import { FileWatcher } from "@/file/watcher"
import { getVcsInfoFFI } from "@/tool/ffi"

const log = Log.create({ service: "vcs" })

export namespace Vcs {
  export const Event = {
    BranchUpdated: BusEvent.define(
      "vcs.branch.updated",
      z.object({
        branch: z.string().optional(),
      }),
    ),
  }

  export const Info = z
    .object({
      branch: z.string(),
      added: z.number().optional(),
      modified: z.number().optional(),
      deleted: z.number().optional(),
    })
    .meta({
      ref: "VcsInfo",
    })
  export type Info = z.infer<typeof Info>

  async function currentBranch() {
    return $`git rev-parse --abbrev-ref HEAD`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()
      .then((x) => x.trim())
      .catch(() => undefined)
  }

  async function getStatus() {
    try {
      const output = await $`git status --porcelain`.quiet().nothrow().cwd(Instance.worktree).text()
      const lines = output
        .trim()
        .split("\n")
        .filter((line) => line.trim())

      let added = 0
      let modified = 0
      let deleted = 0

      for (const line of lines) {
        const status = line.substring(0, 2)
        if (status.includes("?") || status.includes("A")) added++
        else if (status.includes("M")) modified++
        else if (status.includes("D")) deleted++
      }

      return { added, modified, deleted }
    } catch {
      return { added: 0, modified: 0, deleted: 0 }
    }
  }

  const state = Instance.state(
    async () => {
      if (Instance.project.vcs !== "git") {
        return {
          branch: async () => undefined,
          status: async () => ({ added: 0, modified: 0, deleted: 0 }),
          unsubscribe: undefined,
        }
      }
      let current = await currentBranch()
      log.info("initialized", { branch: current })

      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
        if (evt.properties.file.endsWith("HEAD")) return
        const next = await currentBranch()
        if (next !== current) {
          log.info("branch changed", { from: current, to: next })
          current = next
          Bus.publish(Event.BranchUpdated, { branch: next })
        }
      })

      return {
        branch: async () => current,
        status: getStatus,
        unsubscribe,
      }
    },
    async (state) => {
      state.unsubscribe?.()
    },
  )

  export async function init() {
    return state()
  }

  export async function branch() {
    return await state().then((s) => s.branch())
  }

  export async function info(): Promise<Info | undefined> {
    const s = await state()
    const branch = await s.branch()
    if (!branch) return undefined

    // Use native Rust implementation for better performance
    const result = getVcsInfoFFI(Instance.worktree)
    if (!result) return undefined

    return {
      branch: result.branch,
      added: result.added,
      modified: result.modified,
      deleted: result.deleted,
    }
  }
}
