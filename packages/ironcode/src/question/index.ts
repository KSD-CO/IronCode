import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"
import z from "zod"

export namespace Question {
  const log = Log.create({ service: "question" })

  export const Option = z
    .object({
      label: z.string().describe("Display text (1-5 words, concise)"),
      description: z.string().describe("Explanation of choice"),
    })
    .meta({
      ref: "QuestionOption",
    })
  export type Option = z.infer<typeof Option>

  export const Info = z
    .object({
      question: z.string().describe("Complete question"),
      header: z.string().describe("Very short label (max 30 chars)"),
      options: z.array(Option).describe("Available choices"),
      multiple: z.boolean().optional().describe("Allow selecting multiple choices"),
      custom: z.boolean().optional().describe("Allow typing a custom answer (default: true)"),
    })
    .meta({
      ref: "QuestionInfo",
    })
  export type Info = z.infer<typeof Info>

  export const Request = z
    .object({
      id: Identifier.schema("question"),
      sessionID: Identifier.schema("session"),
      questions: z.array(Info).describe("Questions to ask"),
      tool: z
        .object({
          messageID: z.string(),
          callID: z.string(),
        })
        .optional(),
    })
    .meta({
      ref: "QuestionRequest",
    })
  export type Request = z.infer<typeof Request>

  export const Answer = z.array(z.string()).meta({
    ref: "QuestionAnswer",
  })
  export type Answer = z.infer<typeof Answer>

  export const Reply = z.object({
    answers: z
      .array(Answer)
      .describe("User answers in order of questions (each answer is an array of selected labels)"),
  })
  export type Reply = z.infer<typeof Reply>

  export const Event = {
    Asked: BusEvent.define("question.asked", Request),
    Replied: BusEvent.define(
      "question.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        answers: z.array(Answer),
      }),
    ),
    Rejected: BusEvent.define(
      "question.rejected",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
      }),
    ),
  }

  const state = Instance.state(async () => {
    const pending: Record<
      string,
      {
        info: Request
        resolve: (answers: Answer[]) => void
        reject: (e: any) => void
      }
    > = {}

    // Sessions where a question tool call has been approved (needsApproval=false)
    // but execute hasn't started yet (Question.ask not called). Prevents race
    // condition in ai@6 parallel execution where other tools' needsApproval runs
    // before question's execute registers the actual pending entry.
    const preAsk: Set<string> = new Set()

    // Sessions where the user dismissed/rejected a question without answering.
    // When this is set, other tools that were waiting should also be blocked
    // instead of auto-running once the question clears.
    const rejected: Set<string> = new Set()

    return {
      pending,
      preAsk,
      rejected,
    }
  })

  // Signal that the question tool has been approved and is about to execute.
  // Called from needsApproval before execute runs, so other tools see the
  // signal immediately and wait (fixes ai@6 parallel execution race condition).
  // Also clears any previous rejected flag so a new question cycle is fresh.
  export async function preAsk(sessionID: string): Promise<void> {
    const s = await state()
    s.preAsk.add(sessionID)
    s.rejected.delete(sessionID) // reset for a new question cycle
  }

  // Returns true if the user dismissed/rejected a question in this session
  // without answering. Used by needsApproval so other tools don't auto-run.
  export async function wasRejected(sessionID: string): Promise<boolean> {
    const s = await state()
    return s.rejected.has(sessionID)
  }

  // Clear the rejected flag (e.g. when the session step is done and the outer
  // loop starts fresh so the next user turn isn't inadvertently blocked).
  export async function clearRejected(sessionID: string): Promise<void> {
    const s = await state()
    s.rejected.delete(sessionID)
  }

  // Remove the pre-ask signal. Called inside ask() when registering actual
  // pending (atomic transition), and as safety cleanup in execute wrapper.
  export async function clearPreAsk(sessionID: string): Promise<void> {
    const s = await state()
    s.preAsk.delete(sessionID)
  }

  export async function ask(input: {
    sessionID: string
    questions: Info[]
    tool?: { messageID: string; callID: string }
  }): Promise<Answer[]> {
    const s = await state()
    const id = Identifier.ascending("question")

    log.info("asking", { id, questions: input.questions.length })

    return new Promise<Answer[]>((resolve, reject) => {
      const info: Request = {
        id,
        sessionID: input.sessionID,
        questions: input.questions,
        tool: input.tool,
      }
      // Clear preAsk and register actual pending atomically so there is no
      // window where hasPending returns false between the two states.
      s.preAsk.delete(input.sessionID)
      s.pending[id] = {
        info,
        resolve,
        reject,
      }
      Bus.publish(Event.Asked, info)
    })
  }

  export async function reply(input: { requestID: string; answers: Answer[] }): Promise<void> {
    const s = await state()
    const existing = s.pending[input.requestID]
    if (!existing) {
      log.warn("reply for unknown request", { requestID: input.requestID })
      return
    }
    delete s.pending[input.requestID]

    log.info("replied", { requestID: input.requestID, answers: input.answers })

    Bus.publish(Event.Replied, {
      sessionID: existing.info.sessionID,
      requestID: existing.info.id,
      answers: input.answers,
    })

    existing.resolve(input.answers)
  }

  export async function reject(requestID: string): Promise<void> {
    const s = await state()
    const existing = s.pending[requestID]
    if (!existing) {
      log.warn("reject for unknown request", { requestID })
      return
    }
    delete s.pending[requestID]

    log.info("rejected", { requestID })

    // Mark the session so that other tools waiting in needsApproval don't
    // auto-run now that hasPending has cleared. They will see wasRejected=true
    // and return true (block) instead of proceeding.
    s.rejected.add(existing.info.sessionID)

    Bus.publish(Event.Rejected, {
      sessionID: existing.info.sessionID,
      requestID: existing.info.id,
    })

    existing.reject(new RejectedError())
  }

  export class RejectedError extends Error {
    constructor() {
      super("The user dismissed this question")
    }
  }

  export async function list() {
    return state().then((x) => Object.values(x.pending).map((x) => x.info))
  }

  export async function hasPending(sessionID: string): Promise<boolean> {
    const s = await state()
    return s.preAsk.has(sessionID) || Object.values(s.pending).some((p) => p.info.sessionID === sessionID)
  }
}
