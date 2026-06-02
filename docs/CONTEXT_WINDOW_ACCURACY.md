# Context Window % — Why It Doesn't Match & How We Fixed It

## Problem

The `ctx %` shown on the Oh-My-Claude dashboard did not match Claude Code's built-in display (e.g., dashboard showed 63% while Claude Code showed 81%).

## Claude Code's Formula

Reverse-engineered from the minified source (`cli.js`):

```
used = Math.round((input_tokens + cache_creation_input_tokens + cache_read_input_tokens) / (model context window) * 100)
```

- `contextWindow` is **model-aware**: Opus/Sonnet 4.x = 1,000,000 tokens (1M is the GA default); Haiku 4.5 = 200,000 tokens. Rule: `limit = /haiku/i.test(model) ? 200000 : 1000000`
- `output_tokens` is **NOT** included
- Messages with `model === '<synthetic>'` (compaction summaries) are **skipped**

## Root Causes

### 1. Transcript Buffering

Claude Code uses a buffered writer (`flushIntervalMs: 1000, maxBufferSize: 100`) for the `.jsonl` transcript file. During active tool-call loops, the file may not be updated for several seconds. Claude Code's display uses **in-memory** data, so it's always ahead of what we can read from disk.

### 2. StatusLine Only Works in CLI

Claude Code's `statusLine` command receives real-time `context_window.used_percentage` via stdin — directly from in-memory state. However, this mechanism **only works in CLI mode**. The VSCode extension does not invoke the `statusLine` command from `settings.json`.

### 3. getAgents() Was Overwriting Real-Time Data

Every dashboard poll called `getAgents()`, which always recalculated `contextPct` from transcript data. This overwrote any more accurate value that had been set by the `/context-update` endpoint.

## Solution

Two data paths feed into the same `/context-update` backend endpoint:

### Path A: StatusLine Wrapper (CLI only)

```
Claude Code statusLine → statusline_wrapper.js (stdin JSON)
  → extracts context_window.used_percentage
  → POST /context-update
```

File: `hooks/statusline_wrapper.js`

This gives the **exact** value from Claude Code's in-memory state, updated every ~300ms. Only available when running Claude Code in the terminal (not VSCode).

### Path B: Hook-Based Transcript Tail-Read (VSCode + CLI)

```
Claude Code → PostToolUse/Stop hook → send_event.js
  → reads last 32KB of transcript file
  → finds last assistant message with usage (skips synthetic)
  → POSTs raw { sessionId, lastInputTokens, model } (no precomputed %)
  → server computes ctx% per-model (/haiku/ → 200k, else 1M)
  → POST /context-update
```

File: `hooks/send_event.js`

This fires after every tool call. By that point, the assistant message (with usage data) from the previous API call has typically been flushed to disk, so the data is close to real-time (~1-2s delay).

### Backend: Prefer Real-Time Over Stale

File: `backend/server.js`

- `/context-update` endpoint stores values in `statusLineContextCache` (TTL: 10s)
- `getAgents()` checks the cache first:
  - If a recent value exists → use it (matches Claude Code closely)
  - Otherwise → fall back to transcript tail-read calculation

```
statusLineContextCache hit? ──yes──→ use cached contextPct
         │ no
         ▼
readSessionContext() tail-read → calculate from transcript
```

## Remaining Limitations

| Limitation | Impact | Why |
|---|---|---|
| ~1-2s delay in VSCode | Minor | Transcript buffer flush interval |
| Exact match only possible in CLI | N/A for VSCode users | StatusLine is a CLI-only feature |
| 32KB tail-read window | Negligible | Covers ~10-20 assistant messages, more than enough |
| Per-model context limit | None | The hook now POSTs raw `lastInputTokens` + `model`; the server computes the percentage per model (`/haiku/i.test(model) ? 200000 : 1000000`). Opus/Sonnet 4.x use the 1M GA window, Haiku 4.5 uses 200k. |

## Files Involved

| File | Role |
|---|---|
| `hooks/send_event.js` | PostToolUse/Stop → transcript tail-read → POST `/context-update` |
| `hooks/statusline_wrapper.js` | CLI statusLine → extract `used_percentage` → POST `/context-update` |
| `backend/server.js` | `/context-update` endpoint + `statusLineContextCache` + `getAgents()` priority logic |
