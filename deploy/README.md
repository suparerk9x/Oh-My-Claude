# Deploying Oh-My-Claude to a server

OMC monitors a machine's **Claude Code** usage: the real **subscription gauge** (5-hour /
weekly utilization via the OAuth token), real **per-model token + cost** (from the transcript
files), and a live **activity feed** (via Claude hooks). The backend serves the built UI + REST
(`/api/*`) + WebSocket on **one port** (default 4825).

> This kit is the battle-tested recipe from the first production deploy (Oracle ARM + Cloudflare
> + Nginx-Proxy-Manager + a dockerized `claude -p` proxy). Every section below has a **⚠ gotcha**
> that cost real debugging time — read them.

---

## 0. What you need

- A Linux box where **Claude Code (`claude`) actually runs** — interactively, or headless via a
  proxy/cron. OMC reads that box's `~/.claude` (OAuth creds + `~/.claude/projects` transcripts).
  *OMC running on a box with no Claude activity will show an empty gauge — it observes, it doesn't generate.*
- **Node 18+** on the box (`node -v`).
- A reverse proxy for the public URL (these notes cover **Nginx-Proxy-Manager** + raw **nginx**).

---

## 1. Install the app (automated)

```bash
git clone <your-oh-my-claude-repo> ~/oh-my-claude
cd ~/oh-my-claude
PORT=4825 CLAUDE_HOME=/home/ubuntu RUN_USER=root bash deploy/install.sh
```

`install.sh` does: backend `npm install`, frontend build (WS same-origin), bind `0.0.0.0`,
write+enable a `systemd` unit, health-check. Vars:

| var | default | meaning |
|---|---|---|
| `PORT` | `4825` | the single port (UI+API+WS) |
| `CLAUDE_HOME` | `$HOME` | the HOME whose `~/.claude` has the creds+transcripts |
| `RUN_USER` | `root` | service user — **must be able to read those files** |
| `OMC_DIR` | repo root | where the repo is |
| `NODE_BIN` | `$(command -v node)` | node path for the unit |

> ⚠ **Gotcha — file ownership.** If `claude` runs inside a **container** that bind-mounts the host
> `~/.claude` as root (e.g. a `claude -p` proxy with `-v /home/ubuntu/.claude:/root/.claude`), then
> `.credentials.json` + transcripts are **root-owned**. OMC must run as **`root` with
> `HOME=<that host home>`** to read them (the installer defaults to this). Running as a normal user
> → empty gauge.

Manage it: `sudo systemctl {status,restart} oh-my-claude` · logs `sudo journalctl -u oh-my-claude -f`.

---

## 2. Expose it publicly (reverse proxy + Basic-Auth + TLS)

The backend listens on `0.0.0.0:PORT` but your cloud firewall should NOT open that port — put it
behind your existing 80/443 reverse proxy.

> ⚠ **Gotcha — reverse-proxy in a container can't reach `127.0.0.1`.** If your proxy (NPM, nginx,
> Caddy) runs in Docker, `127.0.0.1:PORT` means the *proxy container's* localhost, not the host.
> Forward to the **docker bridge gateway** instead. Find it:
> ```bash
> docker inspect <proxy-container> --format '{{json .NetworkSettings.Networks}}' | grep -o '"Gateway":"[^"]*"'
> ```
> Use that IP (e.g. `172.25.0.1:PORT`). The OMC backend binds `0.0.0.0`, so it listens there too.

> ⚠ **Gotcha — strict-firewall hosts (Oracle Cloud, RHEL) drop bridge→host traffic.** Their
> `INPUT` chain ends with `REJECT --reject-with icmp-host-prohibited` → a reverse-proxy container
> gets **502 "no route to host"**. Allow the port for docker bridges, then persist:
> ```bash
> sudo iptables -I INPUT -s 172.16.0.0/12 -p tcp --dport 4825 -j ACCEPT
> sudo netfilter-persistent save     # or: iptables-save | sudo tee /etc/iptables/rules.v4
> ```

### Option A — Nginx Proxy Manager (GUI)
1. **Proxy Hosts → Add**: Domain `omc.example.com` · Scheme `http` · Forward **`172.25.0.1`** ·
   Port `4825` · ✅ **Websockets Support** *(without this the live gauge/feed never updates)* ·
   ✅ Block Common Exploits.
2. **SSL tab** → Request a new Let's Encrypt cert → ✅ Force SSL.
3. **Access Lists → Add** (Basic-Auth): add a username+password, **✅ turn ON "Satisfy Any"**, then
   attach it to the proxy host.
   > ⚠ **Gotcha — 403 for everyone.** With "Satisfy Any" OFF, NPM emits `deny all; satisfy all;` →
   > the IP rule denies before the password is even checked. "Satisfy Any" ON = password-only.

### Option B — raw nginx
```nginx
server {
  listen 443 ssl http2; server_name omc.example.com;
  ssl_certificate     /etc/letsencrypt/live/omc.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/omc.example.com/privkey.pem;
  auth_basic "OMC"; auth_basic_user_file /etc/nginx/.htpasswd;   # htpasswd -c /etc/nginx/.htpasswd you
  location / {
    proxy_pass http://127.0.0.1:4825;       # 127.0.0.1 OK only if nginx runs on the HOST (not a container)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;  # WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

### DNS / Cloudflare
Add an `A` record for the subdomain → the server's public IP. If proxied (orange cloud), NPM/nginx
still needs its own origin cert; if Let's Encrypt issuance fails behind the orange cloud, set the
record to **DNS-only** during issuance, then re-enable the proxy.

> ⚠ **Gotcha — the page phoned home to the VIEWER's localhost.** The frontend's `VITE_WS_URL`. If
> it's baked to `ws://localhost:4825` at build time, the page (served from your server) opens its
> WebSocket to **whoever's browser** (their own local OMC), showing the WRONG machine's data.
> `install.sh` disables `VITE_WS_URL` so the build uses `wss://${location.host}` (same-origin).
> **Always build with `VITE_WS_URL` unset for a reverse-proxy deploy.** Hard-refresh + unregister
> the service worker after redeploying (PWA caches the bundle).

---

## 3. (Optional) Live activity feed — install Claude hooks

The gauge + token/cost work **without** hooks (they read OAuth + transcripts). The **agent/activity
feed** needs Claude Code hooks that POST events to OMC.

1. Put the hook script where `claude` can run it. If `claude` runs in a container bind-mounting host
   `~/.claude → /root/.claude`, copy to the **host** path:
   ```bash
   mkdir -p ~/.claude/hooks && cp ~/oh-my-claude/hooks/send_event.js ~/.claude/hooks/
   ```
2. Merge `deploy/claude-hooks.example.json`'s `hooks` block into the `~/.claude/settings.json` that
   `claude` reads (keep existing keys like `model`). Replace placeholders:
   - `__OMC_URL__` → `http://<gateway>:4825` reachable from where claude runs (e.g. `172.25.0.1:4825`
     from a container; `127.0.0.1:4825` if claude runs on the host).
   - `__NODE__` → absolute node path in the claude env (`/usr/local/bin/node` in many containers,
     `/usr/bin/node` on the host).
   - `__HOOKS_DIR__` → `/root/.claude/hooks` (container) or `~/.claude/hooks` (host).
3. Verify: trigger one `claude -p "say OK"` and check `curl -s http://127.0.0.1:4825/events` → count > 0.

> ⚠ **Gotcha — same firewall rule.** The hook POSTs from inside the claude container to the host
> gateway:PORT → needs the same `172.16.0.0/12 --dport PORT ACCEPT` rule from §2.
> Hooks **inherit the spawned claude's environment** (verified) — that's how `CLAUDE_PROJECT` and
> `MONITOR_SERVER` reach `send_event.js`.

---

## 4. (Optional) For a `claude -p` proxy that serves many projects

If one box runs a proxy that calls `claude -p` for several projects (so every session shows the
same cwd, e.g. `/app`), and you want per-project labels + the real gauge inside another app:

- **Label sessions by project:** have the proxy spawn `claude` with `env.CLAUDE_PROJECT=<project>`.
  `send_event.js` already prefers `CLAUDE_PROJECT` as the displayed label. For pretty names, edit
  its `cwd:` line to a map, e.g. `({'tts-web':'TTS Director'}[process.env.CLAUDE_PROJECT] || process.env.CLAUDE_PROJECT || hookData.cwd || process.cwd())`.
- **Expose the real numbers to a downstream app** (without giving it the OMC Basic-Auth): have the
  proxy (same box, localhost-fast) fetch OMC `/usage` + `/stats` and include them in its own
  response. E.g. in a `/v1/usage` handler:
  ```js
  let omc = null;
  try {
    const OMC = process.env.OMC_URL || 'http://172.25.0.1:4825';
    const [u, s] = await Promise.all([
      fetch(OMC + '/usage').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(OMC + '/stats').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    omc = { usage: u, tokens: s ? s.tokens : null };
  } catch {}
  // ...include `omc` in the JSON you return
  ```

---

## 5. Endpoints (for integration)

`GET /health` · `GET /usage` (subscription: `five_hour.utilization`, `seven_day.utilization`,
burn rate, ETA) · `GET /stats` (`.tokens`: month/week tokens + cost, per-model) · `GET /events`,
`/agents`, `/sessions` · WebSocket on the same origin (init/event/stats/usage pushes).

## 6. Troubleshooting cheat-sheet

| symptom | cause | fix |
|---|---|---|
| empty gauge (0%) | OMC can't read creds | run as `root` + `HOME=<claude home>`; check `~/.claude/.credentials.json` readable |
| `403 openresty` | NPM Access List "Satisfy Any" OFF | turn it ON |
| `502 no route to host` | firewall REJECT bridge→host | `iptables -I INPUT -s 172.16.0.0/12 --dport PORT -j ACCEPT` |
| gauge/feed never updates live | WebSocket not proxied | enable Websockets Support / `Upgrade` headers |
| shows the *viewer's* machine | `VITE_WS_URL` baked to localhost | rebuild with it unset; hard-refresh + unregister SW |
| feed empty (but gauge works) | no Claude hooks on this box | §3 |
| all sessions labelled the same | proxy runs claude in one cwd | §4 (`CLAUDE_PROJECT`) |
