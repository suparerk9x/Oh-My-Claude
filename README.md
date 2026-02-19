# Oh My Claude

> Real-time monitoring dashboard for Claude Code — track tokens, agents, costs, and activity live.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

![Uploading image.png…]()
---

## Features

| Feature | Description |
|---------|-------------|
| **Token Tracking** | Session (5h) & Weekly usage with per-model breakdown |
| **Agent Monitoring** | Live main agents + subagents tree with status |
| **Activity Feed** | Tool calls, prompts, errors streamed in real-time |
| **Cost Estimation** | Monthly cost by model (Opus / Sonnet / Haiku) |
| **Mini Pop-out** | Floating mini window (220x450px) for compact monitoring |
| **Install as App** | PWA support — install to desktop, runs without browser UI |
| **Dark / Light Theme** | Toggle between dark and light mode |
| **Notifications** | Desktop notifications for events (bell toggle) |
| **Bilingual Guide** | Built-in help guide in English & Thai |
| **Chrome Extension** | Sync usage % directly from Claude.ai (optional) |
| **Demo Mode** | Try the dashboard with simulated data (no setup needed) |

### Usage Status Indicator

| Icon | Status | Range |
|------|--------|-------|
| 🪴 | Normal | < 60% |
| ⚡ | High | 60–84% |
| 🚨 | Near limit | 85–99% |
| 🫗 | Full | 100% |

---

## Quick Start

### Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Claude Code** | Latest | `claude --version` |

### Step 1: Clone & Install

```bash
git clone https://github.com/suparerk9x/Oh-My-Claude.git
cd Oh-My-Claude
npm run install:all
```

### Step 2: Configure Claude Code Hooks

> **Required** — without hooks, the dashboard won't receive any events.

Edit your Claude settings file:

| OS | Path |
|----|------|
| Windows | `C:\Users\<username>\.claude\settings.json` |
| macOS / Linux | `~/.claude/settings.json` |

Add the `hooks` section — replace `<PATH>` with your Oh-My-Claude folder path:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type PreToolUse"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type PostToolUse"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type SubagentStart"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type SubagentStop"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type UserPromptSubmit"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"<PATH>/Oh-My-Claude/hooks/send_event.js\" --event-type Stop"
          }
        ]
      }
    ]
  }
}
```

**Path examples** (use forward slashes `/` even on Windows):

| OS | Example |
|----|---------|
| Windows | `node "D:/Projects/Oh-My-Claude/hooks/send_event.js" --event-type PreToolUse` |
| macOS | `node "/Users/john/Oh-My-Claude/hooks/send_event.js" --event-type PreToolUse` |

### Step 3: Start

**Windows:**

```bash
start.bat
```

**Any OS:**

```bash
npm run dev
```

This starts both backend (port 4824) and frontend (port 4825).

### Step 4: Open Dashboard

Open **http://localhost:4825** — you should see:

- Header shows **LIVE** (green dot)
- Backend status shows **OK**

---

## Install as Desktop App (PWA)

Oh My Claude supports **Progressive Web App** — you can install it as a standalone desktop app:

1. Open **http://localhost:4825** in Chrome
2. Click the **Install app** icon (monitor with ↓ arrow) in the address bar
3. Click **"Install"** in the popup dialog
4. App opens in its own window — pin to taskbar!

**Benefits:**
- Runs in a clean window without browser tabs or address bar
- Can be pinned to taskbar / dock for quick access
- Works just like a native desktop app

> **Note:** The backend server (`npm run dev`) must be running for the app to work.

---

## Mini Pop-out Window

A compact floating window for monitoring while you work:

- Click the **Mini Pop-out** button (↗) in the header toolbar
- Opens a **220x450px** floating window
- Shows: connection status, token stats, agent list, and recent activity
- Perfect for keeping on the side while coding

---

## Chrome Extension (Optional)

Syncs your Claude.ai usage percentage to the dashboard automatically.

### Install

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### How it works

```
Claude.ai → Extension (fetches API every 1 min) → Backend :4824 → Dashboard
```

1. Log into [claude.ai](https://claude.ai)
2. Extension detects your organization and starts syncing
3. Dashboard header shows **Sync** badge when data arrives

---

## System Architecture

```mermaid
flowchart TD
    CC["💻 Claude Code\nTerminal / IDE"]
    CE["🌐 Chrome Extension\nFetches from claude.ai"]

    CC -->|"Hooks send events"| BS
    CE -->|"Sync usage %"| BS

    BS["🖥️ Backend Server\nExpress + WebSocket · port 4824"]

    BS --- Data["Events · Agents · Sessions · Usage %"]

    Data -->|"WebSocket live updates"| DB

    DB["📊 Dashboard\nReact UI · port 4825"]

    style CC fill:#1a1a2e,stroke:#7c3aed,color:#e2e8f0
    style CE fill:#1a1a2e,stroke:#0ea5e9,color:#e2e8f0
    style BS fill:#065f46,stroke:#10b981,color:#e2e8f0
    style Data fill:none,stroke:none,color:#94a3b8
    style DB fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
```

**Data Flow:**

1. **Claude Code** → Hooks fire events (PreToolUse, PostToolUse, SubagentStart, etc.) → Backend
2. **Chrome Extension** → Fetches usage % from claude.ai → Backend (every 1 min)
3. **Backend** → Aggregates all data → Broadcasts via WebSocket
4. **Dashboard** → Receives via WebSocket → Renders in real-time

---

## Project Structure

```
Oh-My-Claude/
├── package.json              # Root scripts (npm run dev, install:all)
├── start.bat                 # Windows quick start
├── README.md
│
├── backend/
│   ├── server.js             # Express + WebSocket server (port 4824)
│   ├── statsReader.js        # Read transcript files for token stats
│   ├── events.json           # Event history (auto-created)
│   ├── agents.json           # Agent state (auto-created)
│   └── __tests__/            # Jest tests
│
├── frontend/
│   ├── index.html            # Main dashboard entry
│   ├── mini.html             # Mini pop-out entry
│   ├── vite.config.js        # Vite config (port 4825, proxy)
│   ├── public/
│   │   ├── favicon.svg       # App icon
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # Service worker for PWA
│   └── src/
│       ├── App.jsx           # Main dashboard
│       ├── MiniApp.jsx       # Mini pop-out window
│       ├── main.jsx          # Main entry + PWA registration
│       ├── mini-main.jsx     # Mini entry + PWA registration
│       ├── config/
│       │   ├── theme.js      # Dark/Light theme colors
│       │   └── eventTypes.js # Event type definitions
│       ├── hooks/
│       │   ├── useNotifications.js  # Desktop notifications
│       │   └── usePolling.js        # API polling hook
│       ├── utils/
│       │   └── format.js     # Token/number formatting
│       └── components/
│           ├── AgentTree.jsx       # Agent hierarchy tree
│           ├── AgentCard.jsx       # Single agent display
│           ├── ActivityItem.jsx    # Event list item
│           ├── TokenGauge.jsx      # Circular usage gauge
│           ├── TokenStats.jsx      # Model breakdown stats
│           ├── HourlyBreakdown.jsx # Hourly usage chart
│           └── HelpGuide.jsx       # Help guide (EN/TH)
│
├── hooks/
│   └── send_event.js         # Hook script → sends events to backend
│
└── extension/                # Chrome extension (optional)
    ├── manifest.json         # Manifest V3
    ├── background.js         # Background sync worker
    ├── content.js            # Fetches usage from claude.ai
    └── icons/                # Extension icons
```

---

## Configuration

### Ports

| Service | Port | File |
|---------|------|------|
| Backend | 4824 | `backend/server.js` |
| Frontend | 4825 | `frontend/vite.config.js` |

### Agent Timeout

| Setting | Default | Description |
|---------|---------|-------------|
| Timeout | 30 min | Mark as inactive (gray) |
| Cleanup | 60 min | Remove from list |

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend + frontend |
| `npm run install:all` | Install all dependencies |
| `npm run build` | Build frontend for production |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: LIVE · Sync · Toolbar · Clock · Status     │
├───────────┬──────────────┬──────────────────────────┤
│  Token    │   Agents     │   Activity Feed          │
│  Usage    │   Tree       │   (real-time events)     │
│  (200px)  │   (340px)    │   (flex)                 │
├───────────┴──────────────┴──────────────────────────┤
│  Event Detail Panel (expandable)                     │
├─────────────────────────────────────────────────────┤
│  Footer: Event Filters │ Monthly Cost │ Clock       │
└─────────────────────────────────────────────────────┘
```

### Header Toolbar

| Button | Description |
|--------|-------------|
| **View Mode** | Cycle: Full → Compact → Expanded → Hidden |
| **Theme** | Toggle Dark / Light |
| **Mini** | Open mini pop-out window |
| **Notifications** | Toggle: Off / Bell |
| **Guide** | Help guide with Demo toggle |
| **Status Badge** | Usage status (🪴⚡🚨🫗) |

### Agent Status

| Status | Color | Meaning |
|--------|-------|---------|
| Active | 🟢 Green | Currently receiving events |
| Stopped | 🔴 Red | Agent finished / stopped |
| Timeout | ⚪ Gray | 30+ min no activity |

### Model Icons

| Model | Icon | Color |
|-------|------|-------|
| Opus 4 | ◆ | Violet |
| Sonnet 4 | ● | Blue |
| Haiku 3.5 | ▪ | Green |

---

## Verify Installation

```bash
# Test 1: Backend health
curl http://localhost:4824/health
# → {"status":"ok"}

# Test 2: Send a message in Claude Code
# → Events should appear in Activity Feed

# Test 3: Check agents panel
# → Your session appears as "Main" agent with green status
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard shows **OFF** | 1. Check backend: `curl http://localhost:4824/health` <br> 2. Check browser console for WebSocket errors <br> 3. Hard refresh: `Ctrl+Shift+R` |
| No events appearing | 1. Verify hooks in `~/.claude/settings.json` <br> 2. Check path uses forward slashes `/` <br> 3. Restart Claude Code terminal |
| Extension not syncing | 1. Must be logged into claude.ai <br> 2. Check extension enabled at `chrome://extensions/` <br> 3. Check backend console for "Usage received" |
| PWA not installable | 1. Must access via `http://localhost:4825` (not IP) <br> 2. Use Chrome or Edge <br> 3. Check DevTools → Application → Manifest |

---

## API Reference

### REST

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Token stats + agents |
| GET | `/events` | Recent events (last 100) |
| GET | `/sessions` | Session list |
| POST | `/events` | Receive hook events |
| POST | `/usage` | Receive Chrome extension data |

### WebSocket

Connect: `ws://localhost:4824`

| Message | Direction | Description |
|---------|-----------|-------------|
| `init` | Server → Client | Initial state (agents, events, stats) |
| `event` | Server → Client | New event arrived |
| `stats` | Server → Client | Updated token stats |
| `agents` | Server → Client | Updated agent list |
| `usage` | Server → Client | Usage data from extension |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, WebSocket (ws), Zod |
| Frontend | React 18, Vite, Tailwind CSS |
| PWA | Service Worker, Web App Manifest |
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
