#!/usr/bin/env bun
import { App } from "@slack/bolt"
import { createIroncode } from "@ironcode-ai/sdk"
import type { Session } from "@ironcode-ai/sdk"
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs"
import path from "path"
import { homedir, tmpdir } from "os"
import { pathToFileURL } from "url"
import * as readline from "readline"

// ── Config ────────────────────────────────────────────────────────────────────

type Config = {
  botToken: string
  signingSecret: string
  appToken: string
  model?: string
  groqApiKey?: string
}

function configPath() {
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config")
  return path.join(xdg, "ironcode", "slack.json")
}

function loadConfig(): Config | null {
  const p = configPath()
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as Config
    } catch {}
  }
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET && process.env.SLACK_APP_TOKEN) {
    return {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      appToken: process.env.SLACK_APP_TOKEN,
      model: process.env.SLACK_MODEL,
      groqApiKey: process.env.GROQ_API_KEY,
    }
  }
  return null
}

function saveConfig(cfg: Config) {
  const p = configPath()
  mkdirSync(path.join(p, ".."), { recursive: true })
  writeFileSync(p, JSON.stringify(cfg, null, 2))
}

async function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => {
      rl.close()
      resolve(ans.trim())
    })
  })
}

// ── Setup command ─────────────────────────────────────────────────────────────

if (process.argv[2] === "setup") {
  console.log("⚙️  ironcode-slack setup\n")
  console.log("Create a Slack App at https://api.slack.com/apps with:")
  console.log("  - Socket Mode enabled")
  console.log("  - Bot token scopes: chat:write, channels:history, groups:history, im:history, files:read")
  console.log("  - App-level token with connections:write scope\n")

  const existing = loadConfig()
  const botToken = await ask(`Bot Token (xoxb-...)${existing?.botToken ? " [keep: Enter]" : ""}: `)
  const signingSecret = await ask(`Signing Secret${existing?.signingSecret ? " [keep: Enter]" : ""}: `)
  const appToken = await ask(`App-Level Token (xapp-...)${existing?.appToken ? " [keep: Enter]" : ""}: `)
  const model = await ask(`Model [${existing?.model ?? "github-copilot/claude-sonnet-4.6"}]: `)
  const groqApiKey = await ask(
    `Groq API Key (for voice transcription, optional) [${existing?.groqApiKey ? "keep: Enter" : "skip: Enter"}]: `,
  )

  const cfg: Config = {
    botToken: botToken || existing?.botToken || "",
    signingSecret: signingSecret || existing?.signingSecret || "",
    appToken: appToken || existing?.appToken || "",
    model: model || existing?.model || "github-copilot/claude-sonnet-4.6",
    groqApiKey: groqApiKey || existing?.groqApiKey,
  }

  if (!cfg.botToken || !cfg.signingSecret || !cfg.appToken) {
    console.error("❌ Bot Token, Signing Secret, and App Token are required.")
    process.exit(1)
  }

  saveConfig(cfg)
  console.log(`\n✅ Config saved to ${configPath()}`)
  console.log("   Run: ironcode-slack\n")
  process.exit(0)
}

// ── Load config ───────────────────────────────────────────────────────────────

const cfg = loadConfig()
if (!cfg) {
  console.error(`❌ No config found. Run:\n\n   ironcode-slack setup\n`)
  console.error("   Or set env vars: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN")
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseModel(model: string) {
  const [providerID, ...rest] = model.split("/")
  return { providerID, modelID: rest.join("/") }
}

function relativeTime(ms: number) {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function sessionLabel(s: Session, isCurrent: boolean) {
  const changes = s.summary ? ` (+${s.summary.additions}/-${s.summary.deletions})` : ""
  const cur = isCurrent ? " ✓" : ""
  return `${s.title}${changes} · ${relativeTime(s.time.updated)}${cur}`
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new App({
  token: cfg.botToken,
  signingSecret: cfg.signingSecret,
  socketMode: true,
  appToken: cfg.appToken,
})

console.log("🚀 Starting ironcode server...")
let localServer: Awaited<ReturnType<typeof createIroncode>>
try {
  localServer = await createIroncode({ port: 0 })
} catch (err: any) {
  const msg = err?.message ?? String(err)
  if (msg.includes("exited with code 0") || msg.includes("ENOENT") || msg.includes("Illegal instruction")) {
    console.error("❌ Failed to start ironcode server.\n")
    console.error("   Make sure the ironcode CLI is installed and authenticated:")
    console.error("   1. npm install -g ironcode-ai")
    console.error("   2. ironcode auth login")
    console.error("   3. ironcode serve  ← test manually first\n")
  } else {
    console.error("❌ Failed to start ironcode server:", msg)
  }
  process.exit(1)
}
console.log("✅ Ironcode server ready at", localServer.server.url)
const client = localServer.client

type SessionState = {
  sessionId: string
  channel: string
  thread: string
  liveMsgTs?: string
  liveText: string
  lastEditMs: number
  currentTool?: string
}

const EDIT_INTERVAL_MS = 1200

const sessions = new Map<string, SessionState>()

// Tracks the most recently active session key per channel (for slash commands)
const channelActive = new Map<string, string>()

function getThreadKey(channel: string, thread: string) {
  return `${channel}-${thread}`
}

async function updateLive(state: SessionState, text: string) {
  if (!state.liveMsgTs) return
  await app.client.chat
    .update({ channel: state.channel, ts: state.liveMsgTs, text: text || "…" })
    .catch(() => {})
}

// ── Event loop ────────────────────────────────────────────────────────────────

;(async () => {
  const events = await client.event.subscribe()
  for await (const event of events.stream) {
    const getState = (sessionID: string) => [...sessions.values()].find((s) => s.sessionId === sessionID)

    if (event.type === "message.part.updated") {
      const part = event.properties.part as any
      const state = getState(part.sessionID)
      if (!state) continue

      if (part.type === "text") {
        state.liveText = part.text
        const now = Date.now()
        if (state.liveMsgTs && now - state.lastEditMs > EDIT_INTERVAL_MS) {
          await updateLive(state, state.liveText)
          state.lastEditMs = now
        }
      } else if (part.type === "tool") {
        if (part.state?.status === "completed") {
          state.currentTool = undefined
          await app.client.chat
            .postMessage({
              channel: state.channel,
              thread_ts: state.thread,
              text: `:wrench: *${part.tool}* — ${part.state.title}`,
            })
            .catch(() => {})
        } else if (state.currentTool !== part.tool) {
          state.currentTool = part.tool
          if (!state.liveText.trim() && state.liveMsgTs) {
            const now = Date.now()
            if (now - state.lastEditMs > 500) {
              await updateLive(state, `:hourglass_flowing_sand: ${part.tool}...`)
              state.lastEditMs = now
            }
          }
        }
      }
    } else if (event.type === "message.updated") {
      const info = event.properties.info as any
      if (info.role !== "assistant") continue
      const state = getState(info.sessionID)
      if (!state) continue

      if (info.error) {
        const msg = info.error.data?.message ?? info.error.name ?? "Unknown error"
        await updateLive(state, `:x: ${msg}`)
        state.liveMsgTs = undefined
        state.liveText = ""
        state.currentTool = undefined
        continue
      }

      if (info.finish && info.finish !== "tool-calls" && info.finish !== "unknown") {
        const finalText = state.liveText.trim()
        const savedTs = state.liveMsgTs

        if (finalText) {
          await updateLive(state, finalText)
        } else if (savedTs) {
          await app.client.chat.update({ channel: state.channel, ts: savedTs, text: "✅ Done" }).catch(() => {})
        }

        state.liveMsgTs = undefined
        state.liveText = ""
        state.currentTool = undefined
      }
    }
  }
})().catch((err) => console.error("[events] event loop crashed:", err))

// ── File handling ─────────────────────────────────────────────────────────────

type FilePart = { type: "file"; url: string; filename: string; mime: string }

const MAX_FILE_SIZE = 20 * 1024 * 1024

async function downloadSlackFile(urlPrivate: string, filename: string): Promise<FilePart> {
  const response = await fetch(urlPrivate, {
    headers: { Authorization: `Bearer ${cfg!.botToken}` },
  })
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)

  const ext = path.extname(filename).toLowerCase()
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".py": "text/x-python",
    ".zip": "application/zip",
  }

  const blob = await response.blob()
  const tmpPath = path.join(tmpdir(), `slack-${Date.now()}-${filename}`)
  await Bun.write(tmpPath, blob)

  const mime = mimeMap[ext] || (blob.type && blob.type !== "application/octet-stream" ? blob.type : "application/octet-stream")
  return { type: "file", url: pathToFileURL(tmpPath).href, filename, mime }
}

// ── Voice transcription ───────────────────────────────────────────────────────

async function transcribeVoice(urlPrivate: string, groqApiKey: string): Promise<string> {
  const response = await fetch(urlPrivate, {
    headers: { Authorization: `Bearer ${cfg!.botToken}` },
  })
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`)

  const blob = await response.blob()
  const form = new FormData()
  form.append("file", new File([blob], "audio.mp4", { type: "audio/mp4" }))
  form.append("model", "whisper-large-v3-turbo")
  form.append("response_format", "json")

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }
  const data = (await res.json()) as { text: string }
  return data.text.trim()
}

// ── Main message handler ──────────────────────────────────────────────────────

async function handleMessage(channel: string, thread: string, text: string, files?: FilePart[]) {
  const key = getThreadKey(channel, thread)
  let state = sessions.get(key)

  if (!state) {
    const res = await client.session.create({ body: { title: `Slack ${channel} ${thread}` } })
    if (res.error) {
      await app.client.chat.postMessage({
        channel,
        thread_ts: thread,
        text: `❌ Failed to create session: ${JSON.stringify(res.error)}`,
      })
      return
    }
    state = { sessionId: res.data.id, channel, thread, liveText: "", lastEditMs: 0 }
    sessions.set(key, state)
    channelActive.set(channel, key)

    const share = await client.session.share({ path: { id: res.data.id } })
    if (!share.error && share.data?.share?.url) {
      await app.client.chat.postMessage({ channel, thread_ts: thread, text: `🔗 Session: ${share.data.share.url}` })
    }
  } else {
    channelActive.set(channel, key)
  }

  const placeholder = await app.client.chat.postMessage({
    channel,
    thread_ts: thread,
    text: ":thinking_face: Thinking...",
  })
  state.liveMsgTs = placeholder.ts as string
  state.liveText = ""
  state.lastEditMs = 0
  state.currentTool = undefined

  const model = cfg!.model ? parseModel(cfg!.model) : undefined
  const parts: Array<{ type: "text"; text: string } | FilePart> = []
  if (files?.length) parts.push(...files)
  parts.push({ type: "text", text })

  const result = await client.session.promptAsync({
    path: { id: state.sessionId },
    body: { parts, model },
  })

  if (result.error) {
    await app.client.chat
      .update({ channel, ts: state.liveMsgTs!, text: `❌ ${JSON.stringify(result.error)}` })
      .catch(() => {})
    state.liveMsgTs = undefined
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

app.message(async ({ message }) => {
  if (message.subtype || !("text" in message) || !message.text) return

  const channel = message.channel
  const thread = (message as any).thread_ts || message.ts
  const files: FilePart[] = []

  // Handle attached files
  if ((message as any).files?.length) {
    for (const f of (message as any).files as any[]) {
      if (f.size > MAX_FILE_SIZE) continue

      // Skip audio files handled separately
      if (f.subtype === "slack_audio" || f.filetype === "m4a" || f.filetype === "mp4") {
        if (!cfg!.groqApiKey) continue
        try {
          const statusMsg = await app.client.chat.postMessage({
            channel,
            thread_ts: thread,
            text: ":microphone: Transcribing...",
          })
          const transcribed = await transcribeVoice(f.url_private, cfg!.groqApiKey)
          await app.client.chat
            .update({ channel, ts: statusMsg.ts as string, text: `🎤 _${transcribed}_` })
            .catch(() => {})
          files.push({ type: "file" as const, url: "", filename: transcribed, mime: "text/plain" })
        } catch (err: any) {
          await app.client.chat
            .postMessage({ channel, thread_ts: thread, text: `❌ Transcription failed: ${err.message}` })
            .catch(() => {})
        }
        continue
      }

      try {
        const url = f.url_private || f.url_private_download
        if (url) {
          const part = await downloadSlackFile(url, f.name || "file")
          files.push(part)
        }
      } catch {}
    }
  }

  await handleMessage(channel, thread, message.text, files.length ? files : undefined)
})

// ── Slash commands ────────────────────────────────────────────────────────────

function getActiveState(channel: string): SessionState | undefined {
  const key = channelActive.get(channel)
  return key ? sessions.get(key) : undefined
}

app.command("/new", async ({ command, ack }) => {
  await ack()
  const key = channelActive.get(command.channel_id)
  if (key) sessions.delete(key)
  channelActive.delete(command.channel_id)
  await app.client.chat.postMessage({
    channel: command.channel_id,
    text: "✨ New session will be created on your next message.",
  })
})

app.command("/info", async ({ command, ack }) => {
  await ack()
  const state = getActiveState(command.channel_id)

  if (!state) {
    await app.client.chat.postMessage({
      channel: command.channel_id,
      text: "No active session. Send a message to create one.",
    })
    return
  }

  const res = await client.session.get({ path: { id: state.sessionId } })
  if (res.error) {
    await app.client.chat.postMessage({ channel: command.channel_id, text: `❌ ${JSON.stringify(res.error)}` })
    return
  }

  const s = res.data
  const changes = s.summary
    ? `📊 ${s.summary.files} files · +${s.summary.additions}/-${s.summary.deletions}`
    : "📊 No changes yet"

  await app.client.chat.postMessage({
    channel: command.channel_id,
    thread_ts: state.thread,
    text:
      `*${s.title}*\n` +
      `ID: \`${s.id}\`\n` +
      `Created: ${relativeTime(s.time.created)}\n` +
      `Updated: ${relativeTime(s.time.updated)}\n` +
      changes,
  })
})

app.command("/diff", async ({ command, ack }) => {
  await ack()
  const state = getActiveState(command.channel_id)

  if (!state) {
    await app.client.chat.postMessage({
      channel: command.channel_id,
      text: "No active session. Send a message to create one.",
    })
    return
  }

  const res = await client.session.diff({ path: { id: state.sessionId } })
  if (res.error) {
    await app.client.chat.postMessage({ channel: command.channel_id, text: `❌ ${JSON.stringify(res.error)}` })
    return
  }

  const diffs = res.data ?? []
  if (diffs.length === 0) {
    await app.client.chat.postMessage({ channel: command.channel_id, text: "📊 No code changes in this session." })
    return
  }

  const totalAdd = diffs.reduce((s, d) => s + d.additions, 0)
  const totalDel = diffs.reduce((s, d) => s + d.deletions, 0)
  const fileLines = diffs.map((d) => `✏️ \`${d.file}\` (+${d.additions}/-${d.deletions})`).join("\n")

  await app.client.chat.postMessage({
    channel: command.channel_id,
    thread_ts: state.thread,
    text: `📝 *Code Changes* — ${diffs.length} files · +${totalAdd}/-${totalDel}\n\n${fileLines}`.slice(0, 4000),
  })
})

app.command("/sessions", async ({ command, ack }) => {
  await ack()
  const currentState = getActiveState(command.channel_id)

  const res = await client.session.list()
  if (res.error) {
    await app.client.chat.postMessage({ channel: command.channel_id, text: `❌ ${JSON.stringify(res.error)}` })
    return
  }

  const list = res
    .data!.filter((s: any) => !s.time?.archived)
    .sort((a: any, b: any) => b.time.updated - a.time.updated)
    .slice(0, 10)

  if (list.length === 0) {
    await app.client.chat.postMessage({ channel: command.channel_id, text: "No sessions yet." })
    return
  }

  const blocks: any[] = [
    { type: "section", text: { type: "mrkdwn", text: "*Select a session to continue:*" } },
    ...list.map((s: any) => ({
      type: "section",
      text: { type: "mrkdwn", text: sessionLabel(s, s.id === currentState?.sessionId) },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Switch" },
        value: JSON.stringify({ sessionId: s.id, channel: command.channel_id }),
        action_id: "switch_session",
      },
    })),
  ]

  await app.client.chat.postMessage({ channel: command.channel_id, blocks })
})

app.command("/init", async ({ command, ack }) => {
  await ack()
  let state = getActiveState(command.channel_id)

  if (!state) {
    const res = await client.session.create({ body: { title: `Slack ${command.channel_id}` } })
    if (res.error) {
      await app.client.chat.postMessage({ channel: command.channel_id, text: `❌ ${JSON.stringify(res.error)}` })
      return
    }
    const thread = new Date().getTime().toString()
    state = { sessionId: res.data.id, channel: command.channel_id, thread, liveText: "", lastEditMs: 0 }
    const key = getThreadKey(command.channel_id, thread)
    sessions.set(key, state)
    channelActive.set(command.channel_id, key)
  }

  const placeholder = await app.client.chat.postMessage({
    channel: command.channel_id,
    text: "⏳ Analyzing project and creating AGENTS.md...",
  })

  const model = cfg!.model ? parseModel(cfg!.model) : undefined
  const res = await client.session.command({
    path: { id: state.sessionId },
    body: { command: "init", arguments: "", ...(model ? { model: `${model.providerID}/${model.modelID}` } : {}) },
  })

  await app.client.chat
    .update({
      channel: command.channel_id,
      ts: placeholder.ts as string,
      text: res.error
        ? `❌ ${JSON.stringify(res.error)}`
        : "✅ *AGENTS.md created!* The AI agent has analyzed your project and written configuration.",
    })
    .catch(() => {})
})

// ── Session switch action ─────────────────────────────────────────────────────

app.action("switch_session", async ({ action, ack, body }) => {
  await ack()
  const { sessionId, channel } = JSON.parse((action as any).value)

  const res = await client.session.get({ path: { id: sessionId } })
  if (res.error) {
    await app.client.chat.postMessage({ channel, text: "❌ Session not found" })
    return
  }

  // Find or create a session state for this session
  let existingKey: string | undefined
  for (const [k, s] of sessions) {
    if (s.sessionId === sessionId) {
      existingKey = k
      break
    }
  }

  if (!existingKey) {
    const thread = new Date().getTime().toString()
    existingKey = getThreadKey(channel, thread)
    sessions.set(existingKey, { sessionId, channel, thread, liveText: "", lastEditMs: 0 })
  }

  channelActive.set(channel, existingKey)

  await app.client.chat.postMessage({ channel, text: `✅ Now using: *${res.data!.title}*` })
})

await app.start()
console.log("⚡️ Slack bot is running!")
