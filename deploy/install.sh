#!/usr/bin/env bash
# ============================================================================
# Oh-My-Claude — one-box installer.
# The backend serves the built UI + /api + WebSocket on a SINGLE port.
# Re-runnable (idempotent). Run this ON THE TARGET SERVER, as a user with sudo.
#
#   git clone <your oh-my-claude repo> ~/oh-my-claude
#   cd ~/oh-my-claude
#   PORT=4825 CLAUDE_HOME=/home/ubuntu RUN_USER=root bash deploy/install.sh
#
# After this: see deploy/README.md to (a) expose it via your reverse proxy + auth,
# (b) open the firewall path, and (c) optionally wire Claude hooks for the live feed.
# ============================================================================
set -euo pipefail

OMC_DIR="${OMC_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"   # repo root (parent of deploy/)
PORT="${PORT:-4825}"
RUN_USER="${RUN_USER:-root}"            # MUST be able to read ~/.claude/.credentials.json + ~/.claude/projects
CLAUDE_HOME="${CLAUDE_HOME:-$HOME}"     # the HOME whose ~/.claude holds the OAuth creds + transcripts
NODE_BIN="${NODE_BIN:-$(command -v node || echo /usr/bin/node)}"

echo ">> OMC_DIR=$OMC_DIR  PORT=$PORT  RUN_USER=$RUN_USER  CLAUDE_HOME=$CLAUDE_HOME  NODE=$NODE_BIN"
[ -d "$OMC_DIR/backend" ] || { echo "!! $OMC_DIR/backend not found — run from the repo"; exit 1; }

# 1) backend deps (no native modules — better-sqlite3 in node_modules is orphaned/unused)
( cd "$OMC_DIR/backend" && npm install --no-audit --no-fund )

# 2) frontend: build for SAME-ORIGIN WebSocket. CRITICAL: VITE_WS_URL must NOT be baked in,
#    otherwise the page (served from this server) opens its WS to the VIEWER's localhost.
if [ -f "$OMC_DIR/frontend/.env" ]; then
  sed -i 's#^VITE_WS_URL=## VITE_WS_URL= (disabled by deploy/install.sh for reverse-proxy; WS uses location.host) #' "$OMC_DIR/frontend/.env" || true
fi
( cd "$OMC_DIR/frontend" && npm install --no-audit --no-fund && npm run build )

# 3) bind backend to 0.0.0.0 so a reverse-proxy CONTAINER can reach it over the docker bridge.
#    Public access stays gated by your firewall + the reverse proxy's auth.
if grep -q "server.listen(PORT, '127.0.0.1'" "$OMC_DIR/backend/server.js" 2>/dev/null; then
  sed -i "s/server.listen(PORT, '127.0.0.1'/server.listen(PORT, '0.0.0.0'/" "$OMC_DIR/backend/server.js"
elif grep -q "server.listen(PORT, () =>" "$OMC_DIR/backend/server.js" 2>/dev/null; then
  sed -i "s/server.listen(PORT, () =>/server.listen(PORT, '0.0.0.0', () =>/" "$OMC_DIR/backend/server.js"
fi

# 4) systemd service — User=root + HOME=CLAUDE_HOME so it can read root-owned creds/transcripts
#    (common when `claude` runs in a container that bind-mounts the host ~/.claude as root).
sudo tee /etc/systemd/system/oh-my-claude.service >/dev/null <<UNIT
[Unit]
Description=Oh-My-Claude usage monitor
After=network-online.target

[Service]
Type=simple
User=$RUN_USER
Environment=HOME=$CLAUDE_HOME
Environment=PORT=$PORT
Environment=NODE_OPTIONS=--max-old-space-size=512
WorkingDirectory=$OMC_DIR/backend
ExecStart=$NODE_BIN server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now oh-my-claude

echo ">> waiting for health..."
curl -s --retry 15 --retry-delay 1 --retry-connrefused "http://127.0.0.1:$PORT/health" && echo
echo ""
echo "=============================================================================="
echo " OMC backend is up on  http://127.0.0.1:$PORT   (UI + /api + WebSocket)"
echo " It reads usage/cost from $CLAUDE_HOME/.claude  (OAuth + transcripts)."
echo ""
echo " NEXT (server-specific — see deploy/README.md):"
echo "  1. Open the firewall path if needed (Oracle/strict INPUT chains):"
echo "       sudo iptables -I INPUT -s 172.16.0.0/12 -p tcp --dport $PORT -j ACCEPT"
echo "       sudo netfilter-persistent save"
echo "  2. Reverse-proxy + Basic-Auth + TLS for a public URL (forward to the docker"
echo "     gateway, e.g. 172.x.0.1:$PORT — NOT 127.0.0.1 — if the proxy is a container)."
echo "  3. (optional) Live activity feed: install Claude hooks (deploy/claude-hooks.example.json)."
echo "=============================================================================="
