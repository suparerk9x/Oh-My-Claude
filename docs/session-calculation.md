# Session & Usage Data Guide

## Data Sources

Oh My Claude uses **two data sources** for displaying usage information:

### 1. Chrome Extension (Primary - Real-time Usage)

Session and weekly usage data comes from the **Chrome Extension** that reads data directly from Claude.ai:

| Metric | Source | Description |
|--------|--------|-------------|
| Session Usage | Claude.ai | 5-hour block usage (real-time) |
| Weekly All Models | Claude.ai | Weekly usage across all models |
| Weekly Sonnet | Claude.ai | Weekly Sonnet-specific usage |
| Reset Times | Claude.ai | Accurate reset timestamps |

**If no extension data**: Dashboard shows "N/A" for these metrics.

### 2. Session Files (Secondary - Cost Calculation)

Monthly cost breakdown is calculated from **Claude Code session files** (`.jsonl`):

```
Location: ~/.claude/projects/**/*.jsonl
```

| Metric | Source | Description |
|--------|--------|-------------|
| Monthly Cost | Session files | Calculated from token usage |
| Model Breakdown | Session files | Opus/Sonnet/Haiku split |
| Input/Output | Session files | Token type breakdown |
| Cache Usage | Session files | Cache read/creation tokens |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Claude.ai                         │
│  (Actual usage limits & reset times)                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Chrome Extension                        │
│  • Reads usage data from Claude.ai                  │
│  • Sends to Oh My Claude backend                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Oh My Claude Backend                   │
│  • Receives claudeUsage from extension              │
│  • Reads session files for cost calculation         │
│  • Merges data and sends to frontend                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Oh My Claude Frontend                  │
│  • Displays usage gauges                            │
│  • Shows cost breakdown by model                    │
└─────────────────────────────────────────────────────┘
```

---

## Token Limits (Reference)

These are estimated limits based on observed Claude.ai behavior:

| Metric | Estimated Limit | Notes |
|--------|-----------------|-------|
| Session (5h) | ~92,600 tokens | Per 5-hour block |
| Weekly All | ~714,000 tokens | All models combined |
| Weekly Sonnet | ~83,400 tokens | Sonnet only |

**Note**: Actual limits may vary. The Chrome extension provides real percentages from Claude.ai.

---

## Cost Calculation

Monthly costs are calculated using Anthropic's official pricing:

| Model | Input (per 1M) | Output (per 1M) | Cache Read | Cache Creation |
|-------|----------------|-----------------|------------|----------------|
| Opus | $15.00 | $75.00 | $1.50 | $18.75 |
| Sonnet | $3.00 | $15.00 | $0.30 | $3.75 |
| Haiku | $0.25 | $1.25 | $0.03 | $0.30 |

---

*Last Updated: 11 Feb 2026*
