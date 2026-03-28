# Discord Implement Slash Command — Design Spec

## Overview

A Claude Code slash command (`/discord-implement <thread_id>`) that reads a Discord thread (starter message + all replies, including images) using the Discord REST API, synthesizes the content into a feature request, and kicks off the brainstorming skill to design and implement the feature.

## Approach

Single skill file at `.claude/commands/discord-implement.md`. No new dependencies — uses Claude Code's built-in tools (`Bash`, `WebFetch`, `Skill`) to interact with the Discord API directly.

## Flow

### Step 1: Read Bot Token

Use `Bash` to read `DISCORD_BOT_TOKEN` from the project `.env` file. Fail with a clear error if the token is missing.

### Step 2: Fetch Thread Metadata

`WebFetch` → `GET https://discord.com/api/v10/channels/{thread_id}`

Headers: `Authorization: Bot {token}`

This returns thread metadata including the thread name, parent channel ID, and message count. Used to confirm the thread exists and get context.

### Step 3: Fetch All Messages

`WebFetch` → `GET https://discord.com/api/v10/channels/{thread_id}/messages?limit=100`

Headers: `Authorization: Bot {token}`

Messages are returned newest-first. If the thread has >100 messages, paginate using `before={oldest_message_id}` until all messages are retrieved. Reverse the collected messages to chronological order.

Each message object includes:
- `content` — text body
- `author.username` / `author.global_name` — who posted
- `attachments[]` — file attachments with URLs, content types, dimensions
- `embeds[]` — embedded content
- `timestamp` — when posted

### Step 4: Download and View Images

For each message attachment where `content_type` starts with `image/`:
- Use `WebFetch` to download the image URL
- Claude views the image inline to understand mockups, screenshots, or visual references

### Step 5: Synthesize Feature Request

Compile all thread content (text + image observations) into a structured summary:
- **Thread title** (from thread name)
- **Participants** (unique authors)
- **Feature request** — distilled from the conversation
- **Visual references** — descriptions of any images/mockups found
- **Key decisions/constraints** — anything agreed upon in the thread

Present this synthesis to the user for confirmation before proceeding.

### Step 6: Invoke Brainstorming

Use the `Skill` tool to invoke `superpowers:brainstorming` with the synthesized feature request as the task context. This begins the full design → plan → implementation cycle.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| `.env` missing or no `DISCORD_BOT_TOKEN` | Error: "No Discord bot token found. Add `DISCORD_BOT_TOKEN` to your `.env` file." |
| Thread ID not provided | Error: "Usage: `/discord-implement <thread_id>`" |
| API returns 404 | Error: "Thread not found. Check that the thread ID is correct and the bot has access to the channel." |
| API returns 401/403 | Error: "Bot token is invalid or the bot lacks permission to read this channel." |
| API returns 429 (rate limit) | Wait for `retry_after` seconds, then retry once. If still rate limited, report the error. |
| Thread has no messages | Warn user and stop. |

## File Location

```
.claude/commands/discord-implement.md
```

## Invocation

```
/discord-implement 1234567890123456789
```

Where the argument is a Discord thread/channel ID (snowflake).
