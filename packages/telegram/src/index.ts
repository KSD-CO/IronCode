#!/usr/bin/env bun
import { Bot, InlineKeyboard } from "grammy"
import { createIroncode } from "@ironcode-ai/sdk"
import type { Session } from "@ironcode-ai/sdk"
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import * as readline from "readline"

// ── Config ────────────────────────────────────────────────────────────────────

type Config = {
  token: string
  model?: string
  groqApiKey?: string
}

function configPath() {
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(xdg, "ironcode", "telegram.json")
}

function loadConfig(): Config | null {
  const p = configPath()
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Config
  } catch {
    return null
  }
}

function saveConfig(cfg: Config) {
  const p = configPath()
  mkdirSync(join(p, ".."), { recursive: true })
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
  console.log("⚙️  ironcode-telegram setup\n")

  const existing = loadConfig()
  const token = await ask(`Bot Token (from @BotFather)${existing?.token ? " [keep current: Enter]" : ""}: `)
  const model = await ask(`Model [${existing?.model ?? "github-copilot/claude-sonnet-4.6"}]: `)
  const groqApiKey = await ask(`Groq API Key (for voice transcription, optional) [${existing?.groqApiKey ? "keep current: Enter" : "skip: Enter"}]: `)

  const cfg: Config = {
    token: token || existing?.token || "",
    model: model || existing?.model || "github-copilot/claude-sonnet-4.6",
    groqApiKey: groqApiKey || existing?.groqApiKey,
  }

  if (!cfg.token) {
    console.error("❌ Bot Token is required.")
    process.exit(1)
  }

  saveConfig(cfg)
  console.log(`\n✅ Config saved to ${configPath()}`)
  console.log("   Run: ironcode-telegram\n")
  process.exit(0)
}

// ── Load config ───────────────────────────────────────────────────────────────

const cfg = loadConfig()
if (!cfg) {
  console.error(`❌ No config found. Run:\n\n   ironcode-telegram setup\n`)
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

// ── Bot ───────────────────────────────────────────────────────────────────────

const bot = new Bot(cfg.token)

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
  chatId: number
  threadId?: number
  liveMessageId?: number
  liveText: string
  lastEditMs: number
  currentTool?: string
}

const EDIT_INTERVAL_MS = 1200

const sessions = new Map<string, SessionState>()

function getChatKey(chatId: number, threadId?: number) {
  return threadId ? `${chatId}-${threadId}` : `${chatId}`
}

async function editLive(state: SessionState, text: string) {
  if (!state.liveMessageId) return
  await bot.api
    .editMessageText(state.chatId, state.liveMessageId, text || "…")
    .catch(() => {})
}

// Event loop
;(async () => {
  const events = await client.event.subscribe()
  for await (const event of events.stream) {
    const getState = (sessionID: string) =>
      [...sessions.values()].find((s) => s.sessionId === sessionID)

    if (event.type === "message.part.updated") {
      const part = event.properties.part as any
      const state = getState(part.sessionID)
      if (!state) continue

      if (part.type === "text") {
        state.liveText = part.text
        const now = Date.now()
        if (state.liveMessageId && now - state.lastEditMs > EDIT_INTERVAL_MS) {
          await editLive(state, state.liveText)
          state.lastEditMs = now
        }
      } else if (part.type === "tool") {
        if (part.state?.status === "completed") {
          state.currentTool = undefined
          await bot.api
            .sendMessage(state.chatId, `🔧 *${part.tool}* — ${part.state.title}`, {
              parse_mode: "Markdown",
              ...(state.threadId ? { message_thread_id: state.threadId } : {}),
            })
            .catch(() => {})
        } else if (state.currentTool !== part.tool) {
          // Tool just started — show loading indicator if no text yet
          state.currentTool = part.tool
          if (!state.liveText.trim() && state.liveMessageId) {
            const now = Date.now()
            if (now - state.lastEditMs > 500) {
              await editLive(state, `⏳ ${part.tool}...`)
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
        await editLive(state, `❌ ${msg}`)
        state.liveMessageId = undefined
        state.liveText = ""
        state.currentTool = undefined
        continue
      }

      if (info.finish && info.finish !== "tool-calls" && info.finish !== "unknown") {
        const finalText = state.liveText.trim()
        const savedMessageId = state.liveMessageId

        if (finalText) {
          await editLive(state, finalText)
        } else if (savedMessageId) {
          // No text output (only tools ran) — show done in placeholder
          await bot.api.editMessageText(state.chatId, savedMessageId, "✅ Done").catch(() => {})
        }

        // Add ✅ reaction to signal completion
        if (savedMessageId) {
          await bot.api
            .setMessageReaction(state.chatId, savedMessageId, [{ type: "emoji", emoji: "👍" }])
            .catch(() => {})
        }

        state.liveMessageId = undefined
        state.liveText = ""
        state.currentTool = undefined
      }
    }
  }
})().catch((err) => console.error("[events] event loop crashed:", err))

bot.catch((err) => {
  console.error("❌ Unhandled bot error:", err.message)
  err.ctx.reply(`❌ ${err.message}`).catch(() => {})
})

// ── Commands ──────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *IronCode Bot*\n\n" +
      "Send a message to start coding with the AI agent.\n\n" +
      "Commands:\n" +
      "/sessions — list sessions\n" +
      "/new — start a new session\n" +
      "/info — current session details\n" +
      "/init — create AGENTS.md for current project\n" +
      "/diff — show code changes in this session",
    { parse_mode: "Markdown" },
  )
})

bot.command("new", async (ctx) => {
  const key = getChatKey(ctx.chat.id, ctx.message?.message_thread_id)
  sessions.delete(key)
  await ctx.reply("✨ New session will be created on your next message.")
})

bot.command("info", async (ctx) => {
  const key = getChatKey(ctx.chat.id, ctx.message?.message_thread_id)
  const state = sessions.get(key)

  if (!state) {
    await ctx.reply("No active session. Send a message to create one.")
    return
  }

  const res = await client.session.get({ path: { id: state.sessionId } })
  if (res.error) {
    await ctx.reply(`❌ ${JSON.stringify(res.error)}`)
    return
  }

  const s = res.data
  const changes = s.summary
    ? `📊 ${s.summary.files} files · +${s.summary.additions}/-${s.summary.deletions}`
    : "📊 No changes yet"

  await ctx.reply(
    `*${s.title}*\n` +
      `ID: \`${s.id}\`\n` +
      `Created: ${relativeTime(s.time.created)}\n` +
      `Updated: ${relativeTime(s.time.updated)}\n` +
      changes,
    { parse_mode: "Markdown" },
  )
})

bot.command("init", async (ctx) => {
  const key = getChatKey(ctx.chat.id, ctx.message?.message_thread_id)
  let state = sessions.get(key)

  if (!state) {
    const res = await client.session.create({
      body: { title: `Telegram ${ctx.chat.type} ${key}` },
    })
    if (res.error) {
      await ctx.reply(`❌ Failed to create session: ${JSON.stringify(res.error)}`)
      return
    }
    state = { sessionId: res.data.id, chatId: ctx.chat.id, threadId: ctx.message?.message_thread_id, liveText: "", lastEditMs: 0 }
    sessions.set(key, state)
  }

  const placeholder = await ctx.reply("⏳ Analyzing project and creating AGENTS.md...")

  const model = cfg.model ? parseModel(cfg.model) : undefined
  const res = await client.session.command({
    path: { id: state.sessionId },
    body: { command: "init", arguments: "", ...(model ? { model: `${model.providerID}/${model.modelID}` } : {}) },
  })

  if (res.error) {
    await bot.api
      .editMessageText(ctx.chat.id, placeholder.message_id, `❌ ${JSON.stringify(res.error)}`)
      .catch(() => {})
    return
  }

  await bot.api
    .editMessageText(ctx.chat.id, placeholder.message_id, "✅ *AGENTS.md created!*\n\nThe AI agent has analyzed your project and written configuration.", {
      parse_mode: "Markdown",
    })
    .catch(() => {})
})

bot.command("diff", async (ctx) => {
  const key = getChatKey(ctx.chat.id, ctx.message?.message_thread_id)
  const state = sessions.get(key)

  if (!state) {
    await ctx.reply("No active session. Send a message to create one.")
    return
  }

  const res = await client.session.diff({ path: { id: state.sessionId } })
  if (res.error) {
    await ctx.reply(`❌ ${JSON.stringify(res.error)}`)
    return
  }

  const diffs = res.data ?? []

  if (diffs.length === 0) {
    await ctx.reply("📊 No code changes in this session.")
    return
  }

  const totalAdd = diffs.reduce((s, d) => s + d.additions, 0)
  const totalDel = diffs.reduce((s, d) => s + d.deletions, 0)

  const fileLines = diffs.map((d) => `✏️ \`${d.file}\` (+${d.additions}/-${d.deletions})`).join("\n")

  const msg = `📝 *Code Changes* — ${diffs.length} files · +${totalAdd}/-${totalDel}\n\n${fileLines}`

  await ctx.reply(msg.slice(0, 4096), { parse_mode: "Markdown" })
})

bot.command("sessions", async (ctx) => {
  const key = getChatKey(ctx.chat.id, ctx.message?.message_thread_id)
  const currentState = sessions.get(key)

  const res = await client.session.list()
  if (res.error) {
    await ctx.reply(`❌ ${JSON.stringify(res.error)}`)
    return
  }

  const list = res.data!
    .filter((s: any) => !s.time?.archived)
    .sort((a: any, b: any) => b.time.updated - a.time.updated)
    .slice(0, 10)

  if (list.length === 0) {
    await ctx.reply("No sessions yet.")
    return
  }

  const kb = new InlineKeyboard()
  for (const s of list) {
    kb.text(sessionLabel(s, s.id === currentState?.sessionId), `switch:${s.id}`).row()
  }

  await ctx.reply("Select a session to continue:", { reply_markup: kb })
})

bot.callbackQuery(/^switch:(.+)$/, async (ctx) => {
  const sessionId = ctx.match[1]
  const chatId = ctx.chat!.id
  const threadId = (ctx.callbackQuery.message as any)?.message_thread_id
  const key = getChatKey(chatId, threadId)

  const res = await client.session.get({ path: { id: sessionId } })
  if (res.error) {
    await ctx.answerCallbackQuery({ text: "❌ Session not found" })
    return
  }

  const existing = sessions.get(key)
  sessions.set(key, { sessionId, chatId, threadId, liveText: "", lastEditMs: 0, liveMessageId: existing?.liveMessageId })

  await ctx.answerCallbackQuery({ text: "✓ Session switched" })
  await ctx.editMessageText(`✅ Now using: *${res.data!.title}*`, { parse_mode: "Markdown" })
})

// ── Voice transcription ───────────────────────────────────────────────────────

async function transcribeVoice(fileUrl: string, groqApiKey: string): Promise<string> {
  const audioResponse = await fetch(fileUrl)
  if (!audioResponse.ok) throw new Error(`Failed to download voice file: ${audioResponse.status}`)
  const blob = await audioResponse.blob()

  const form = new FormData()
  form.append("file", new File([blob], "voice.ogg", { type: "audio/ogg" }))
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

async function handleMessage(ctx: any, chatId: number, threadId: number | undefined, text: string) {
  const key = getChatKey(chatId, threadId)
  let state = sessions.get(key)

  if (!state) {
    const res = await client.session.create({
      body: { title: `Telegram ${ctx.chat.type} ${key}` },
    })
    if (res.error) {
      await ctx.reply(`❌ Failed to create session: ${JSON.stringify(res.error)}`)
      return
    }
    state = { sessionId: res.data.id, chatId, threadId, liveText: "", lastEditMs: 0 }
    sessions.set(key, state)

    const share = await client.session.share({ path: { id: res.data.id } })
    if (!share.error && share.data?.share?.url) {
      await ctx.reply(`🔗 Session: ${share.data.share.url}`)
    }
  }

  const placeholder = await ctx.reply("🤔 Thinking\\.\\.\\.", {
    parse_mode: "MarkdownV2",
    ...(threadId ? { message_thread_id: threadId } : {}),
  })
  state.liveMessageId = placeholder.message_id
  state.liveText = ""
  state.lastEditMs = 0
  state.currentTool = undefined

  const sendTyping = () =>
    bot.api.sendChatAction(chatId, "typing", threadId ? { message_thread_id: threadId } : {}).catch(() => {})
  sendTyping()
  const typingInterval = setInterval(() => {
    if (!state.liveMessageId) return
    sendTyping()
  }, 4000)

  const model = cfg!.model ? parseModel(cfg!.model) : undefined

  const result = await client.session.promptAsync({
    path: { id: state.sessionId },
    body: { parts: [{ type: "text", text }], model },
  })

  clearInterval(typingInterval)

  if (result.error) {
    await ctx.api.editMessageText(chatId, placeholder.message_id, `❌ ${JSON.stringify(result.error)}`)
    state.liveMessageId = undefined
  }
}

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text
  if (text.startsWith("/")) return
  await handleMessage(ctx, ctx.chat.id, ctx.message.message_thread_id, text)
})

bot.on("message:voice", async (ctx) => {
  if (!cfg.groqApiKey) {
    await ctx.reply("❌ Voice messages require a Groq API key. Run `ironcode-telegram setup` to configure.")
    return
  }

  const statusMsg = await ctx.reply("🎤 Transcribing...")
  let text: string
  try {
    const file = await ctx.getFile()
    const fileUrl = `https://api.telegram.org/file/bot${cfg.token}/${file.file_path}`
    text = await transcribeVoice(fileUrl, cfg.groqApiKey)
  } catch (err: any) {
    await bot.api
      .editMessageText(ctx.chat.id, statusMsg.message_id, `❌ Transcription failed: ${err.message}`)
      .catch(() => {})
    return
  }

  await bot.api
    .editMessageText(ctx.chat.id, statusMsg.message_id, `🎤 _${text}_`, { parse_mode: "Markdown" })
    .catch(() => {})

  await handleMessage(ctx, ctx.chat.id, ctx.message.message_thread_id, text)
})

await bot.start()
console.log("⚡️ Telegram bot is running!")
