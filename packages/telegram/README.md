# @ironcode-ai/telegram

Telegram bot integration for ironcode. Send messages from Telegram to run an AI coding agent on your machine — tool calls, file edits, and responses stream back in real-time.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- [`ironcode-ai`](https://www.npmjs.com/package/ironcode-ai) CLI installed and authenticated

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

### 3. Create a Telegram Bot

1. Open Telegram → search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` → follow prompts → copy the **Bot Token**

### 4. Install ironcode-telegram

```bash
bun install -g @ironcode-ai/telegram
```

### 5. Configure

```bash
ironcode-telegram setup
# Bot Token (from @BotFather): ****
# Model [github-copilot/claude-sonnet-4.6]:
# ✅ Config saved to ~/.config/ironcode/telegram.json
```

Config is stored at `~/.config/ironcode/telegram.json`:

```json
{
  "token": "your-bot-token",
  "model": "github-copilot/claude-sonnet-4.6"
}
```

### 6. Run

```bash
# cd into the repo you want the agent to work on
cd /path/to/your/project

ironcode-telegram
```

The agent runs with the current directory as its working directory, so it can read and edit files in your project.

## Bot Commands

| Command     | Description                                               |
| ----------- | --------------------------------------------------------- |
| `/sessions` | List recent sessions — tap to switch                      |
| `/new`      | Start a new session                                       |
| `/info`     | Show current session details (title, ID, file changes)    |
| `/init`     | Analyze the project and create an `AGENTS.md` config file |
| `/diff`     | Show all file changes made in the current session         |
| `/start`    | Show help                                                 |

## How It Works

```
You send a message
  → Bot shows 🤔 Thinking... while the agent starts up
  → Bot creates/resumes an ironcode session on your machine
  → Agent reads/writes files, runs bash, calls LLM
  → Each completed tool call is sent as a separate message
  → Text response is streamed live by editing the placeholder
  → Final response replaces the placeholder when done
```

Each chat (DM, group, or group thread) gets its own independent session. Use `/sessions` to switch between them.

## Session Management

- **Automatic**: Each chat automatically gets its own session on first message.
- **Switch**: `/sessions` shows the 10 most recent sessions with an inline keyboard. Tap any to resume it.
- **New**: `/new` clears the current slot — your next message starts a fresh session.
- **Persistent**: Sessions and their file change history are preserved across bot restarts.
