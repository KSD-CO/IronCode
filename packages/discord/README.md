# @ironcode-ai/discord

Discord bot integration for IronCode. Send messages from Discord to run an AI coding agent on your machine — tool calls, file edits, and responses stream back in real-time.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- [`ironcode-ai`](https://www.npmjs.com/package/ironcode-ai) CLI installed and authenticated
- Discord account (any account, no special permissions needed)

## Installation

### 1. Install ironcode-ai CLI

```bash
bun install -g ironcode-ai
```

### 2. Authenticate a provider

```bash
ironcode auth login            # GitHub Copilot (recommended)
ironcode auth login anthropic  # Anthropic
ironcode auth login openai     # OpenAI
```

List available models:

```bash
ironcode models
```

### 3. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → give it a name
3. Go to "Bot" section → click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - ✅ Message Content Intent
5. Click "Reset Token" → copy the bot token
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions: `Send Messages`, `Read Messages/View Channels`, `Use Slash Commands`, `Add Reactions`
9. Copy the generated URL and open it to invite bot to your server

### 4. Install ironcode-discord

```bash
bun install -g @ironcode-ai/discord
```

### 5. Configure

```bash
ironcode-discord setup
# Bot Token (from Discord Developer Portal): paste_your_token_here
# Model [github-copilot/claude-sonnet-4.6]:
# Groq API Key (for voice transcription, optional) [skip: Enter]:
# ✅ Config saved to ~/.config/ironcode/discord.json
```

Config is stored at `~/.config/ironcode/discord.json`:

```json
{
  "token": "your-bot-token",
  "model": "github-copilot/claude-sonnet-4.6",
  "groqApiKey": "optional-for-voice"
}
```

### 6. Run

```bash
# cd into the repo you want the agent to work on
cd /path/to/your/project

ironcode-discord
```

The agent runs with the current directory as its working directory, so it can read and edit files in your project.

## Bot Commands

Discord uses **slash commands** (type `/` to see all commands):

| Command     | Description                                               |
| ----------- | --------------------------------------------------------- |
| `/start`    | Show bot help and features                                |
| `/new`      | Start a new session                                       |
| `/info`     | Show current session details (title, ID, file changes)    |
| `/sessions` | List recent sessions                                      |
| `/diff`     | Show all file changes made in the current session         |
| `/init`     | Analyze the project and create an `AGENTS.md` config file |

## How It Works

```
You send a message or use /command
  → Bot replies "🤔 Thinking..."
  → Bot creates/resumes an ironcode session on your machine
  → Agent reads/writes files, runs bash, calls LLM
  → Each completed tool call is sent as a separate message
  → Text response is streamed live by editing the placeholder (every 2s)
  → Final response + 👍 reaction when done
```

Each channel (text channel or DM) gets its own independent session. Sessions are persistent across bot restarts.

## Upload Support

The bot supports multiple file types for code analysis and generation:

### 📸 Images

- **Screenshots** — UI bugs, design mockups, error messages
- **Diagrams** — Architecture diagrams, flowcharts, wireframes
- **Code screenshots** — OCR extraction and conversion
- Supported: JPG, PNG, GIF, WebP
- Just drag & drop or attach images to your message!

### 📄 Documents

- **Code files** — `.js`, `.ts`, `.py`, `.java`, etc.
- **Text files** — `.txt`, `.md`, `.json`, `.xml`
- **PDFs** — Technical docs, API specs
- **Any file type** — up to 25MB per file
- Discord automatically previews many file types

### 🎤 Voice/Audio Messages

- Transcribed using Groq Whisper API
- Requires Groq API key in config (`ironcode-discord setup`)
- Perfect for hands-free coding instructions
- Supports Discord voice messages

**Usage Examples:**

```
You: [Upload screenshot.png] "Fix this bug"
Bot: 📥 Processing 1 file(s)...
Bot: 🤔 Thinking...
Bot: [AI analyzes screenshot and provides fix]
```

```
You: [Upload 3 files: app.py, utils.py, test.py] "Add docstrings"
Bot: 📥 Processing 3 file(s)...
Bot: 🤔 Thinking...
Bot: [AI adds docstrings to all files]
```

```
You: [Record voice message] "Refactor the database module"
Bot: 🎤 Refactor the database module
Bot: 🤔 Thinking...
Bot: [AI refactors the code]
```

## Features

✅ Slash commands (modern Discord UX)  
✅ Text channels & DM support  
✅ Real-time response streaming (edits every 2s)  
✅ Image upload and analysis  
✅ Document upload (any file type, up to 25MB)  
✅ Voice/audio transcription  
✅ Tool call notifications (🔧 tool completed)  
✅ Session sharing (generates URL on first message)  
✅ Multi-session management (one per channel)  
✅ File editing and tracking  
✅ Git diff support  
✅ Embeds for better formatting

## Comparison with Other Integrations

| Feature          | Discord          | Telegram           | Slack          |
| ---------------- | ---------------- | ------------------ | -------------- |
| Authentication   | Bot token        | Bot token          | OAuth + Socket |
| File size limit  | 25MB             | 20MB               | 1GB            |
| Commands         | Slash commands   | Text commands      | Slash commands |
| Setup complexity | Easy             | Easy               | Medium         |
| Voice support    | ✅               | ✅                 | ❌             |
| Streaming edits  | ✅ (2s interval) | ✅ (1.2s interval) | ❌             |
| Embeds           | ✅               | ❌                 | ✅             |

## Troubleshooting

### "Invalid token"

- Make sure you copied the bot token correctly
- Run `ironcode-discord setup` again
- Generate a new token in Discord Developer Portal

### "Missing Permissions"

- Make sure "Message Content Intent" is enabled in Discord Developer Portal
- Re-invite the bot with correct permissions (use OAuth2 URL generator)

### "Failed to start ironcode server"

- Make sure ironcode CLI is installed: `ironcode --version`
- Authenticate with a provider: `ironcode auth login`
- Test manually: `ironcode serve`

### Voice messages not working

- Add Groq API key: `ironcode-discord setup`
- Get free key at: https://console.groq.com

### Bot not responding to messages

- Check bot has "Message Content Intent" enabled
- Make sure bot has permissions in the channel
- Check terminal for error logs

## Security

- Bot token is stored locally at `~/.config/ironcode/discord.json`
- Bot runs on your machine with your file permissions
- No data is sent to external servers except:
  - LLM provider (for AI responses)
  - Groq (for voice transcription, optional)
  - Discord API (for sending/receiving messages)

## Development

```bash
# Clone the repo
git clone https://github.com/sst/ironcode
cd ironcode/packages/discord

# Install dependencies
bun install

# Run in dev mode
bun run dev

# Type check
bun run typecheck
```

## Tips

- **Use threads** - Discord threads keep conversations organized
- **Pin important messages** - Pin session URLs or important code snippets
- **Use embeds** - Commands like `/info` and `/sessions` use rich embeds
- **Multiple channels** - Each channel gets its own session automatically
- **Voice channels** - Record voice messages for hands-free coding

## Example Workflow

```
1. Invite bot to your server
2. Create a channel: #coding-agent
3. Run: ironcode-discord (in your project directory)
4. In Discord #coding-agent:
   - Type: /init (creates AGENTS.md)
   - Upload screenshot of bug
   - Message: "Fix this bug"
   - Bot analyzes and fixes
   - Type: /diff (see all changes)
```

## License

MIT
