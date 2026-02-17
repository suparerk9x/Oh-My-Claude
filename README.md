> Real-time monitoring dashboard for Claude Code usage and multi-agent observability.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What is Oh My Claude?

A dashboard that monitors your **Claude Code** (CLI) usage in real-time:

| Feature | Description |
|---------|-------------|
| **Token Usage** | Track Session (5h) & Weekly usage with model breakdown |
| **Agent Monitoring** | See main agents and subagents with live status |
| **Activity Feed** | Watch tool calls, prompts, and errors as they happen |
| **Cost Estimation** | Monthly cost breakdown by model (Opus/Sonnet/Haiku) |
| **Chrome Extension** | Sync usage % from Claude.ai (optional) |


<img width="938" height="864" alt="Oh-My-Claude--02-17-2026_08_25_PM" src="https://github.com/user-attachments/assets/f4ec79d7-4a30-477d-bdb1-82b1d9df3dc1" /># Oh My Claude


**Layout Structure:**
- **Header**: Connection status, clock, theme toggle, view mode, guide button, usage status
- **Main (3 columns)**: Token Usage (200px) | Agents Panel (280px) | Activity Feed + Sessions
- **Footer Row 1**: Event Detail Panel (expandable - shows selected event details)
- **Footer Row 2**: Status Bar (event filters left, monthly cost right)

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Claude Code** | Latest | `claude --version` |

---

## Installation

### Step 1: Download

```bash
# Clone repository
git clone https://github.com/anthropics/oh-my-claude.git
cd oh-my-claude
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (root + backend + frontend)
npm run install:all
```

Or manually:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Step 3: Configure Claude Code Hooks

**This is required** - without hooks, the dashboard won't receive events.

Open your Claude settings file:

| OS | Path |
|----|------|
| Windows | `C:\Users\<username>\.claude\settings.json` |
| macOS | `~/.claude/settings.json` |
| Linux | `~/.claude/settings.json` |

Add the `hooks` section (replace `<PATH>` with your oh-my-claude folder):

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type PreToolUse"
      }]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type PostToolUse"
      }]
    }],
    "SubagentStart": [{
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type SubagentStart"
      }]
    }],
    "SubagentStop": [{
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type SubagentStop"
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type UserPromptSubmit"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node \"<PATH>/oh-my-claude/hooks/send_event.js\" --event-type Stop"
      }]
    }]
  }
}
```

**Path Examples:**

| OS | Example |
|----|---------|
| Windows | `"node \"D:/Projects/oh-my-claude/hooks/send_event.js\" --event-type PreToolUse"` |
| macOS | `"node \"/Users/john/oh-my-claude/hooks/send_event.js\" --event-type PreToolUse"` |

> Use forward slashes `/` even on Windows

### Step 4: Start Dashboard

**Windows (easiest):**
```bash
# Double-click start.bat
# Or from terminal:
start.bat
```

**Any OS:**
```bash
npm run dev
```

This starts both backend (port 4000) and frontend (port 3001).

**Manual start:**
```bash
# Terminal 1: Backend
cd backend && node server.js

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Step 5: Open Dashboard

Open browser: **http://localhost:3001**

You should see:
- Header shows **LIVE** (green dot)
- Backend status shows **OK**

---

## Verify Installation

### Test 1: Backend Health

```bash
curl http://localhost:4000/health
# Response: {"status":"ok"}
```

### Test 2: Events Flowing

1. Open Claude Code in a terminal: `claude`
2. Send any message
3. Check dashboard - events should appear in Activity Feed

### Test 3: Agent Tracking

In the Agents panel:
- Your session should appear as "Main" agent
- Status should be green (active)

---

## Optional: Chrome Extension

Syncs your Claude.ai usage % to the dashboard.

### Install

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `oh-my-claude/extension` folder

### Verify

1. Log into [claude.ai](https://claude.ai)
2. Extension syncs every 1 minute
3. Dashboard header shows **Sync** badge

---

## Project Structure

```
oh-my-claude/
├── package.json           # Root scripts (npm run dev, install:all)
├── start.bat              # Windows quick start
├── README.md              # This file
├── CODE_REVIEW.md         # Code review report
│
├── backend/
│   ├── server.js          # Express + WebSocket server (port 4000)
│   ├── statsReader.js     # Read transcript files for token stats
│   ├── fileWatcher.js     # Watch for file changes
│   ├── events.json        # Event history (auto-created)
│   ├── agents.json        # Agent state (auto-created)
│   └── __tests__/         # Jest tests
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main dashboard component
│   │   └── components/
│   │       ├── AgentTree.jsx       # Agent hierarchy (main + subagents)
│   │       ├── AgentCard.jsx       # Single agent display
│   │       ├── TokenGauge.jsx      # Circular usage gauge
│   │       ├── TokenStats.jsx      # Model breakdown stats
│   │       ├── ActivityItem.jsx    # Event list item
│   │       ├── HelpGuide.jsx       # Help modal (EN/TH)
│   │       └── HourlyBreakdown.jsx # Hourly usage chart
│   ├── package.json
│   └── vite.config.js
│
├── hooks/
│   └── send_event.js      # Hook script (sends events to backend)
│
├── extension/             # Chrome extension
│   ├── manifest.json      # Extension manifest v3
│   ├── background.js      # Background sync worker
│   ├── content.js         # Scrapes claude.ai
│   ├── icons/             # Extension icons
│   └── README.md
│
└── docs/
    └── session-calculation.md  # How session tokens are calculated
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend + frontend |
| `npm run install:all` | Install all dependencies |
| `npm run build` | Build frontend for production |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |

---

## Configuration

### Ports

| Service | Port | Configure In |
|---------|------|--------------|
| Backend | 4000 | `backend/server.js` |
| Frontend | 3001 | `frontend/vite.config.js` |

### Agent Timeout

Agents auto-timeout after inactivity:

| Setting | Default | Description |
|---------|---------|-------------|
| Timeout | 30 min | Mark as inactive (gray) |
| Cleanup | 60 min | Remove from list |

Edit in `backend/server.js`:
```javascript
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;
const AGENT_CLEANUP_MS = 60 * 60 * 1000;
```

---

## Dashboard Features

### Header Bar

| Element | Description |
|---------|-------------|
| **LIVE/OFF** | WebSocket connection status (green = connected) |
| **Sync** | Shows when Chrome extension is syncing data |
| **Clock** | Live clock (HH:MM:SS) |
| **Dark/Light** | Theme toggle |
| **Full/Compact** | Agent panel view mode toggle |
| **Guide** | Opens help modal (EN/TH) |
| **Status** | Usage status (Normal/High/Near limit) |

### Token Usage Panel (Left)

| Section | Description |
|---------|-------------|
| **Session Gauge** | 5-hour rolling usage % (from Chrome extension) |
| **Weekly Gauge** | 7-day rolling usage % (from Chrome extension) |
| **Last 12 Hours** | Hourly token breakdown chart |
| **By Model** | Token count per model (Opus/Sonnet/Haiku) |

### Agents Panel (Center)

| Element | Description |
|---------|-------------|
| **Main agents** | Your Claude Code sessions |
| **Subagents** | Task/Explore agents spawned by main |
| **Status dot** | Green=active, Gray=timeout, Red=stopped |
| **Duration** | How long agent has been running |
| **Tokens** | Token count for that agent |

### Activity Feed (Right)

| Element | Description |
|---------|-------------|
| **Event list** | Scrollable list of recent events (last 100) |
| **Quick filters** | 🔧 Tools, ✓ Success, ✗ Errors, ▸ Prompts |
| **Session selector** | Filter events by session |

### Footer - Event Detail Panel

| Element | Description |
|---------|-------------|
| **Event type** | Color-coded (cyan=tool, green=success, red=error, amber=prompt) |
| **Tool name** | Which tool was called |
| **Session ID** | Which session this event belongs to |
| **Input/Output** | Tool parameters and response |
| **Collapse button** | Hide/show detail panel |

### Footer - Status Bar

| Left Side | Right Side |
|-----------|------------|
| Event filters: 🔧 ✅ ❌ 💬 | Monthly cost by model: ◆ ● ▪ |
| Click to filter Activity Feed | ◆ Opus, ● Sonnet, ▪ Haiku |

### Model Icons

| Model | Icon | Color |
|-------|------|-------|
| Opus 4.5 | ◆ | Violet |
| Sonnet 4.5 | ● | Blue |
| Haiku 3.5 | ▪ | Green |

### Agent Status Colors

| Status | Color | Meaning |
|--------|-------|---------|
| Active | Green | Receiving events |
| Timeout | Gray | 30+ min no activity |
| Stopped | Red | Subagent finished |

---

## Troubleshooting

### Dashboard shows "OFF"

1. Check backend: `curl http://localhost:4000/health`
2. Check browser console for WebSocket errors
3. Hard refresh: `Ctrl+Shift+R`

### No events appearing

1. Verify hooks in `~/.claude/settings.json`
2. Check path is correct (use forward slashes)
3. Restart Claude Code terminal
4. Check backend console for errors

### Extension not syncing

1. Must be logged into claude.ai
2. Check extension enabled: `chrome://extensions/`
3. Check backend console for "Usage received"

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Token stats + agents |
| GET | `/events` | Recent events (last 100) |
| GET | `/sessions` | Session list |
| POST | `/events` | Receive hook events |
| POST | `/usage` | Receive Chrome extension data |

### WebSocket

Connect: `ws://localhost:4000`

| Message | Direction | Description |
|---------|-----------|-------------|
| `init` | Server → Client | Initial state |
| `event` | Server → Client | New event |
| `stats` | Server → Client | Updated stats |
| `agents` | Server → Client | Updated agents |
| `usage` | Server → Client | Usage data |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, WebSocket (ws) |
| Frontend | React 18, Vite, Tailwind CSS |
| Extension | Chrome Manifest V3 |

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Open Pull Request

---

*Built with Claude Code*
