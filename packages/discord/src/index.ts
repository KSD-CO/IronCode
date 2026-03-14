#!/usr/bin/env bun
import { Client, GatewayIntentBits, REST, Routes, AttachmentBuilder, EmbedBuilder } from "discord.js"
import { createIroncode } from "@ironcode-ai/sdk"
import type { Session } from "@ironcode-ai/sdk"
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs"
import path from "path"
import { homedir, tmpdir } from "os"
import { pathToFileURL } from "url"
import * as readline from "readline"

// ── Config ────────────────────────────────────────────────────────────────────

type Config = {
  token: string
  model?: string
  groqApiKey?: string
}

function configPath() {
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config")
  return path.join(xdg, "ironcode", "discord.json")
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
  console.log("⚙️  ironcode-discord setup\n")

  const existing = loadConfig()
  const token = await ask(
    `Bot Token (from Discord Developer Portal)${existing?.token ? " [keep current: Enter]" : ""}: `,
  )
  const model = await ask(`Model [${existing?.model ?? "github-copilot/claude-sonnet-4.6"}]: `)
  const groqApiKey = await ask(
    `Groq API Key (for voice transcription, optional) [${existing?.groqApiKey ? "keep current: Enter" : "skip: Enter"}]: `,
  )

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
  console.log("   Run: ironcode-discord\n")
  process.exit(0)
}

// ── Load config ───────────────────────────────────────────────────────────────

const cfg = loadConfig()
if (!cfg) {
  console.error(`❌ No config found. Run:\n\n   ironcode-discord setup\n`)
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseModel(model: string) {
  const [providerID, ...rest] = model.split("/")
  return { providerID: providerID!, modelID: rest.join("/") }
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

// ── Discord Client ────────────────────────────────────────────────────────────

console.log("🚀 Starting Discord client...")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
})

client.once("clientReady", () => {
  console.log(`✅ Discord bot logged in as ${client.user?.tag}`)
})

await client.login(cfg.token)

// ── Register Slash Commands ───────────────────────────────────────────────────

const commands = [
  {
    name: "start",
    description: "Show bot help and features",
  },
  {
    name: "new",
    description: "Start a new session",
  },
  {
    name: "info",
    description: "Show current session details",
  },
  {
    name: "sessions",
    description: "List recent sessions",
  },
  {
    name: "diff",
    description: "Show code changes in current session",
  },
  {
    name: "init",
    description: "Analyze project and create AGENTS.md",
  },
]

const rest = new REST({ version: "10" }).setToken(cfg.token)

try {
  console.log("📝 Registering slash commands...")
  await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
  console.log("✅ Slash commands registered!")
} catch (error) {
  console.error("❌ Failed to register commands:", error)
}

// ── Start Ironcode server ─────────────────────────────────────────────────────

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
const ironcodeClient = localServer.client

// ── Session state management ──────────────────────────────────────────────────

type SessionState = {
  sessionId: string
  channelId: string
  liveMessageId?: string
  liveText: string
  lastEditMs: number
  currentTool?: string
}

type FilePart = {
  type: "file"
  url: string
  filename: string
  mime: string
}

const EDIT_INTERVAL_MS = 2000 // Discord rate limits are stricter
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB for Discord

const sessions = new Map<string, SessionState>()

async function editLive(state: SessionState, text: string) {
  if (!state.liveMessageId) return
  try {
    const channel = await client.channels.fetch(state.channelId)
    if (channel?.isTextBased()) {
      const msg = await channel.messages.fetch(state.liveMessageId)
      if (msg) {
        await msg.edit(text.slice(0, 2000) || "…") // Discord 2000 char limit
      }
    }
  } catch {}
}

// ── Event loop ────────────────────────────────────────────────────────────────

;(async () => {
  const events = await ironcodeClient.event.subscribe()
  for await (const event of events.stream) {
    const getState = (sessionID: string) => [...sessions.values()].find((s) => s.sessionId === sessionID)

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
          try {
            const channel = await client.channels.fetch(state.channelId)
            if (channel?.isTextBased() && "send" in channel) {
              await (channel as any).send(`🔧 **${part.tool}** — ${part.state.title}`)
            }
          } catch {}
        } else if (state.currentTool !== part.tool) {
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
          await editLive(state, "✅ Done")
        }

        if (savedMessageId) {
          try {
            const channel = await client.channels.fetch(state.channelId)
            if (channel?.isTextBased()) {
              const msg = await channel.messages.fetch(savedMessageId)
              if (msg) await msg.react("👍")
            }
          } catch {}
        }

        state.liveMessageId = undefined
        state.liveText = ""
        state.currentTool = undefined
      }
    }
  }
})().catch((err) => console.error("[events] event loop crashed:", err))

// ── Voice transcription ───────────────────────────────────────────────────────

async function transcribeVoice(audioUrl: string, groqApiKey: string): Promise<string> {
  const response = await fetch(audioUrl)
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`)
  const blob = await response.blob()

  const form = new FormData()
  form.append("file", blob, "voice.ogg")
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

// ── File download helper ──────────────────────────────────────────────────────

async function downloadDiscordFile(url: string, filename: string): Promise<FilePart> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)

  const blob = await response.blob()

  // File size check
  if (blob.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max 25MB)`)
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const tmpPath = path.join(tmpdir(), `discord-${Date.now()}-${filename}`)
  // @ts-ignore - Bun.write is available in Bun runtime
  await Bun.write(tmpPath, buffer)

  // Detect MIME type from extension
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
  }

  return {
    type: "file",
    url: pathToFileURL(tmpPath).href,
    filename,
    mime: mimeMap[ext] || "application/octet-stream",
  }
}

// ── Main message handler ──────────────────────────────────────────────────────

async function handleMessage(message: any, text: string, files?: FilePart[]) {
  const channelId = message.channelId
  let state = sessions.get(channelId)

  if (!state) {
    const res = await ironcodeClient.session.create({
      body: { title: `Discord ${message.guild?.name ?? "DM"} #${message.channel.name ?? channelId}` },
    })
    if (res.error) {
      await message.reply(`❌ Failed to create session: ${JSON.stringify(res.error)}`)
      return
    }
    state = { sessionId: res.data.id, channelId, liveText: "", lastEditMs: 0 }
    sessions.set(channelId, state)

    const share = await ironcodeClient.session.share({ path: { id: res.data.id } })
    if (!share.error && share.data?.share?.url) {
      await message.reply(`🔗 Session: ${share.data.share.url}`)
    }
  }

  const placeholder = await message.reply("🤔 Thinking...")
  state.liveMessageId = placeholder.id
  state.liveText = ""
  state.lastEditMs = 0
  state.currentTool = undefined

  const model = cfg?.model ? parseModel(cfg.model) : undefined

  // Build parts array: files first, then text
  const parts: Array<{ type: "text"; text: string } | FilePart> = []
  if (files && files.length > 0) {
    parts.push(...files)
  }
  parts.push({ type: "text", text })

  const result = await ironcodeClient.session.promptAsync({
    path: { id: state.sessionId },
    body: { parts, model },
  })

  if (result.error) {
    try {
      await placeholder.edit(`❌ ${JSON.stringify(result.error)}`)
    } catch {}
    state.liveMessageId = undefined
  }
}

// ── Slash Command handlers ────────────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction

  if (commandName === "start") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("👋 IronCode Bot")
      .setDescription("Send a message to start coding with the AI agent.")
      .addFields(
        {
          name: "Commands",
          value:
            "`/sessions` — list sessions\n`/new` — start new session\n`/info` — session details\n`/init` — create AGENTS.md\n`/diff` — show code changes",
        },
        {
          name: "Upload Support",
          value:
            "📸 Images — screenshots, diagrams\n📄 Files — code, PDFs, text (up to 25MB)\n🎤 Voice — transcribed via Groq",
        },
      )
    await interaction.reply({ embeds: [embed] })
  } else if (commandName === "new") {
    const channelId = interaction.channelId
    sessions.delete(channelId)
    await interaction.reply("✨ New session will be created on your next message.")
  } else if (commandName === "info") {
    const channelId = interaction.channelId
    const state = sessions.get(channelId)

    if (!state) {
      await interaction.reply("No active session. Send a message to create one.")
      return
    }

    const res = await ironcodeClient.session.get({ path: { id: state.sessionId } })
    if (res.error) {
      await interaction.reply(`❌ ${JSON.stringify(res.error)}`)
      return
    }

    const s = res.data
    const changes = s.summary
      ? `📊 ${s.summary.files} files · +${s.summary.additions}/-${s.summary.deletions}`
      : "📊 No changes yet"

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(s.title)
      .addFields(
        { name: "Session ID", value: s.id },
        { name: "Created", value: relativeTime(s.time.created) },
        { name: "Updated", value: relativeTime(s.time.updated) },
        { name: "Changes", value: changes },
      )
    await interaction.reply({ embeds: [embed] })
  } else if (commandName === "sessions") {
    const channelId = interaction.channelId
    const currentState = sessions.get(channelId)

    const res = await ironcodeClient.session.list()
    if (res.error) {
      await interaction.reply(`❌ ${JSON.stringify(res.error)}`)
      return
    }

    const list = res
      .data!.filter((s: any) => !s.time?.archived)
      .sort((a: any, b: any) => b.time.updated - a.time.updated)
      .slice(0, 10)

    if (list.length === 0) {
      await interaction.reply("No sessions yet.")
      return
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Available Sessions")
      .setDescription(
        list.map((s: any, i: number) => `${i + 1}. ${sessionLabel(s, s.id === currentState?.sessionId)}`).join("\n"),
      )
    await interaction.reply({ embeds: [embed] })
  } else if (commandName === "diff") {
    const channelId = interaction.channelId
    const state = sessions.get(channelId)

    if (!state) {
      await interaction.reply("No active session. Send a message to create one.")
      return
    }

    const res = await ironcodeClient.session.diff({ path: { id: state.sessionId } })
    if (res.error) {
      await interaction.reply(`❌ ${JSON.stringify(res.error)}`)
      return
    }

    const diffs = res.data ?? []

    if (diffs.length === 0) {
      await interaction.reply("📊 No code changes in this session.")
      return
    }

    const totalAdd = diffs.reduce((s, d) => s + d.additions, 0)
    const totalDel = diffs.reduce((s, d) => s + d.deletions, 0)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📝 Code Changes — ${diffs.length} files · +${totalAdd}/-${totalDel}`)
      .setDescription(diffs.map((d) => `✏️ \`${d.file}\` (+${d.additions}/-${d.deletions})`).join("\n"))
    await interaction.reply({ embeds: [embed] })
  } else if (commandName === "init") {
    const channelId = interaction.channelId
    let state = sessions.get(channelId)

    if (!state) {
      const res = await ironcodeClient.session.create({
        body: { title: `Discord ${interaction.guild?.name ?? "DM"}` },
      })
      if (res.error) {
        await interaction.reply(`❌ Failed to create session: ${JSON.stringify(res.error)}`)
        return
      }
      state = { sessionId: res.data.id, channelId, liveText: "", lastEditMs: 0 }
      sessions.set(channelId, state)
    }

    await interaction.reply("⏳ Analyzing project and creating AGENTS.md...")

    const model = cfg.model ? parseModel(cfg.model) : undefined
    const res = await ironcodeClient.session.command({
      path: { id: state.sessionId },
      body: { command: "init", arguments: "", ...(model ? { model: `${model.providerID}/${model.modelID}` } : {}) },
    })

    if (res.error) {
      await interaction.followUp(`❌ ${JSON.stringify(res.error)}`)
      return
    }

    await interaction.followUp("✅ **AGENTS.md created!**\n\nThe AI agent has analyzed your project.")
  }
})

// ── Regular message handler ───────────────────────────────────────────────────

client.on("messageCreate", async (message) => {
  if (message.author.bot) return
  if (!message.content && message.attachments.size === 0) return

  const text = message.content || "Analyze these files"
  const files: FilePart[] = []

  // Handle attachments (images, documents, audio)
  if (message.attachments.size > 0) {
    const statusMsg = await message.reply(`📥 Processing ${message.attachments.size} file(s)...`)

    try {
      for (const [, attachment] of message.attachments) {
        // Voice/audio files
        if (attachment.contentType?.startsWith("audio/") && cfg.groqApiKey) {
          const transcribedText = await transcribeVoice(attachment.url, cfg.groqApiKey)
          await statusMsg.edit(`🎤 _${transcribedText}_`)
          await handleMessage(message, transcribedText)
          return
        }

        // Images & documents
        const file = await downloadDiscordFile(attachment.url, attachment.name)
        files.push(file)
      }

      await statusMsg.delete()
    } catch (err: any) {
      await statusMsg.edit(`❌ ${err.message}`)
      return
    }
  }

  // Send to IronCode
  await handleMessage(message, text, files.length > 0 ? files : undefined)
})

console.log("⚡️ Discord bot is running!")
