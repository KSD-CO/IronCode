import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Identifier } from "../id/id"
import { Log } from "../util/log"
import type { WSContext } from "hono/ws"
import { Instance } from "../project/instance"
import {
  terminalCreateFFI,
  terminalWriteFFI,
  terminalReadFFI,
  terminalResizeFFI,
  terminalCloseFFI,
  terminalGetInfoFFI,
  terminalUpdateTitleFFI,
  terminalMarkExitedFFI,
  terminalGetBufferFFI,
  terminalDrainBufferFFI,
  terminalClearBufferFFI,
  terminalGetBufferInfoFFI,
  terminalListFFI,
  type TerminalInfo as NativeTerminalInfo,
} from "../tool/ffi"

export namespace PtyNative {
  const log = Log.create({ service: "pty.native" })

  const BUFFER_LIMIT = 1024 * 1024 * 2 // 2MB
  const BUFFER_CHUNK = 64 * 1024 // 64KB

  export const Info = z
    .object({
      id: Identifier.schema("pty"),
      title: z.string(),
      command: z.string(),
      args: z.array(z.string()),
      cwd: z.string(),
      status: z.enum(["running", "exited"]),
      pid: z.number(),
    })
    .meta({ ref: "Pty" })

  export type Info = z.infer<typeof Info>

  export const CreateInput = z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })

  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z.object({
    title: z.string().optional(),
    size: z
      .object({
        rows: z.number(),
        cols: z.number(),
      })
      .optional(),
  })

  export type UpdateInput = z.infer<typeof UpdateInput>

  export const Event = {
    Created: BusEvent.define("pty.created", z.object({ info: Info })),
    Updated: BusEvent.define("pty.updated", z.object({ info: Info })),
    Exited: BusEvent.define("pty.exited", z.object({ id: Identifier.schema("pty"), exitCode: z.number() })),
    Deleted: BusEvent.define("pty.deleted", z.object({ id: Identifier.schema("pty") })),
  }

  interface ActiveSession {
    info: Info
    subscribers: Set<WSContext>
    readInterval?: Timer
  }

  const state = Instance.state(
    () => new Map<string, ActiveSession>(),
    async (sessions) => {
      for (const [id, session] of sessions.entries()) {
        try {
          if (session.readInterval) {
            clearInterval(session.readInterval)
          }
          terminalCloseFFI(id)
        } catch {}
        for (const ws of session.subscribers) {
          ws.close()
        }
      }
      sessions.clear()
    },
  )

  export function list() {
    return Array.from(state().values()).map((s) => s.info)
  }

  export function get(id: string) {
    return state().get(id)?.info
  }

  export async function create(input: CreateInput) {
    const id = Identifier.create("pty", false)
    const cwd = input.cwd || Instance.directory

    log.info("creating native session", { id, cwd })

    // Create native terminal session
    const nativeInfo = terminalCreateFFI(id, cwd, 24, 80) // Default 24x80

    // Update title if provided
    if (input.title) {
      terminalUpdateTitleFFI(id, input.title)
    }

    const info: Info = {
      id: nativeInfo.id,
      title: input.title || nativeInfo.title,
      command: nativeInfo.command,
      args: nativeInfo.args,
      cwd: nativeInfo.cwd,
      status: nativeInfo.status,
      pid: nativeInfo.pid,
    }

    const session: ActiveSession = {
      info,
      subscribers: new Set(),
    }

    // Start polling for output (non-blocking reads)
    session.readInterval = setInterval(() => {
      try {
        const output = terminalReadFFI(id)
        if (output.data.length > 0) {
          // Broadcast to all subscribers
          const textDecoder = new TextDecoder()
          const text = textDecoder.decode(output.data)

          for (const ws of session.subscribers) {
            if (ws.readyState !== 1) {
              session.subscribers.delete(ws)
              continue
            }
            ws.send(text)
          }
        }

        // Check if process exited (when native reads return empty repeatedly)
        const nativeInfo = terminalGetInfoFFI(id)
        if (nativeInfo.status === "exited" && session.info.status === "running") {
          session.info.status = "exited"
          log.info("session exited", { id })
          Bus.publish(Event.Exited, { id, exitCode: 0 })

          // Clear interval
          if (session.readInterval) {
            clearInterval(session.readInterval)
            session.readInterval = undefined
          }

          // Close all subscribers
          for (const ws of session.subscribers) {
            ws.close()
          }
          session.subscribers.clear()
        }
      } catch (error) {
        log.error("read error", { id, error })
      }
    }, 50) // Poll every 50ms

    state().set(id, session)
    Bus.publish(Event.Created, { info })
    return info
  }

  export async function update(id: string, input: UpdateInput) {
    const session = state().get(id)
    if (!session) return

    if (input.title) {
      session.info.title = input.title
      terminalUpdateTitleFFI(id, input.title)
    }

    if (input.size) {
      terminalResizeFFI(id, input.size.rows, input.size.cols)
    }

    Bus.publish(Event.Updated, { info: session.info })
    return session.info
  }

  export async function remove(id: string) {
    const session = state().get(id)
    if (!session) return

    log.info("removing native session", { id })

    if (session.readInterval) {
      clearInterval(session.readInterval)
    }

    try {
      terminalCloseFFI(id)
    } catch {}

    for (const ws of session.subscribers) {
      ws.close()
    }

    state().delete(id)
    Bus.publish(Event.Deleted, { id })
  }

  export function resize(id: string, cols: number, rows: number) {
    const session = state().get(id)
    if (session && session.info.status === "running") {
      terminalResizeFFI(id, rows, cols)
    }
  }

  export function write(id: string, data: string) {
    const session = state().get(id)
    if (session && session.info.status === "running") {
      terminalWriteFFI(id, data)
    }
  }

  export function connect(id: string, ws: WSContext) {
    const session = state().get(id)
    if (!session) {
      ws.close()
      return
    }

    log.info("client connected to native session", { id })
    session.subscribers.add(ws)

    // Send buffered data
    try {
      const buffer = terminalGetBufferFFI(id)
      if (buffer.length > 0) {
        const textDecoder = new TextDecoder()
        const text = textDecoder.decode(buffer)

        // Send in chunks
        for (let i = 0; i < text.length; i += BUFFER_CHUNK) {
          ws.send(text.slice(i, i + BUFFER_CHUNK))
        }

        // Clear buffer after sending
        terminalClearBufferFFI(id)
      }
    } catch (error) {
      log.error("failed to send buffer", { id, error })
      session.subscribers.delete(ws)
      ws.close()
      return
    }

    return {
      onMessage: (message: string | ArrayBuffer) => {
        terminalWriteFFI(id, String(message))
      },
      onClose: () => {
        log.info("client disconnected from native session", { id })
        session.subscribers.delete(ws)
      },
    }
  }
}
