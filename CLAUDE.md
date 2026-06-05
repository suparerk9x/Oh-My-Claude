# Oh-My-Claude (OMC)

Dashboard ที่มอนิเตอร์การใช้ **Claude Code** ของเครื่อง: subscription usage % (5h / 7-day จาก
OAuth token), token + cost จริง per-model (จาก transcript files), และ activity feed สด (จาก Claude
hooks). มันแค่ **อ่าน** `~/.claude` ของเครื่องที่ claude รัน — ไม่ได้ generate อะไรเอง.

- npm name: `claude-agent-monitor` · เวอร์ชันปัจจุบัน **v2.3** · remote = github.com/suparerk9x/Oh-My-Claude
- โหมดสื่อสาร: **product/SaaS** (build-verify loop, product Thai). สรุปก่อน, push back ตรงๆ.

## Architecture (single-origin)

Backend เดียว (Express, **port 4825**) เสิร์ฟทั้ง 3 อย่างบนพอร์ตเดียว:
1. UI ที่ build แล้ว (`frontend/dist`, มี 4 mode: full / medium / mini + index)
2. REST `/api/*` + endpoints ล่างนี้
3. WebSocket (same-origin) — push `init / event / stats / usage`

แหล่งข้อมูล (ทั้งหมดอ่าน local, ไม่มี DB):
- **Usage gauge** ← `~/.claude/.credentials.json` (OAuth) → ดู `five_hour` / `seven_day` utilization
- **Token + cost** ← transcript ใน `~/.claude/projects/**/*.jsonl` (`statsReader.js`)
- **Activity feed** ← Claude hooks POST มาที่ `/events` (`hooks/send_event.js`)

> Frontend ต้อง build โดย **`VITE_WS_URL` ไม่ตั้งค่า** เสมอ → ใช้ `wss://${location.host}` (same-origin).
> ถ้า bake เป็น `ws://localhost:4825` หน้าเว็บจะไปต่อ WS ที่ **เครื่องคนเปิดดู** (ผิดเครื่อง). ดู deploy/README §2.

## Layout

| path | สิ่งที่อยู่ |
|---|---|
| `backend/server.js` | Express + WS, ~2500 บรรทัด, endpoints ทั้งหมด, อ่าน creds/transcript |
| `backend/statsReader.js` | parse transcript → token/cost per-model |
| `backend/usageBackoff.js` | backoff ตอน sync usage (กัน 429 cascade — ดู commit ล่าสุด) |
| `backend/__tests__` | jest (`cd backend && npm test`) |
| `frontend/src` | Vite + Tailwind UI; build → `frontend/dist` |
| `hooks/send_event.js` | hook script ที่ claude เรียก แล้ว POST event ไป OMC |
| `extension/` | Chrome extension (เสริม) |
| `deploy/` | **deploy kit** — install.sh + systemd unit + hooks example + README (อ่านก่อน deploy เครื่องอื่น) |
| `docs/` | audit / code-review / context-window notes |

Endpoints หลัก: `/health` · `/usage` · `/stats` · `/events` (GET+POST) · `/agents` · `/sessions`
· `/teams` · `/context-update` (POST) · `/restart` (POST).

## รัน / dev

- Dev: `npm run dev` (concurrently backend `--watch` + frontend Vite). Build UI: `npm run build`.
- **Production runtime ของเครื่อง Suparerk (Windows): PM2 single-port 4825 + boot-start VBS** —
  รายละเอียดอยู่ใน auto-memory `omc-runtime-pm2.md`. Restart ให้ match **port 4825 (dev 5173)**
  เท่านั้น — **อย่า** match `"server.js"` (มี process อื่นชื่อซ้ำ). ดู memory `omc-process-kill-scope.md`.
- Test: `cd backend && npm test`.

## State files = runtime, อย่าแก้มือ

`backend/agents.json` + `backend/events.json` เป็น **runtime state** ที่ server เขียนทับตลอดเวลา —
diff ที่ขึ้นใน git เป็น noise จาก session ปัจจุบัน. `usage-history.json` / `usage-snapshot.json`
ถูก gitignore แล้ว แต่สองไฟล์นั้น **ยัง tracked อยู่** (พิจารณา gitignore + `git rm --cached`).
อย่า commit การเปลี่ยนของสองไฟล์นี้ปนกับงาน source.

## Deploy (สรุปจาก deploy/README.md — อ่านตัวเต็มก่อนลงมือ)

Recipe จาก production แรก: Oracle ARM Ubuntu หลัง Cloudflare + Nginx-Proxy-Manager, ดึง usage จาก
subscription ของ dockerized `claude -p` proxy. Gotcha ที่กัดจริง:
- **creds เป็น root-owned** (container bind-mount `~/.claude`) → OMC ต้องรันเป็น `root` + `HOME=<host home>`
- reverse-proxy ใน Docker เข้า `127.0.0.1` ไม่ถึง host → ต้องชี้ **docker bridge gateway** (เช่น `172.25.0.1`)
- Oracle/RHEL firewall `REJECT` bridge→host → 502 → ต้อง `iptables -I INPUT -s 172.16.0.0/12 --dport 4825 -j ACCEPT`
- NPM Access List ต้องเปิด **"Satisfy Any"** ไม่งั้น 403 ทุกคน
- ต้องเปิด **Websockets Support** ที่ proxy ไม่งั้น gauge/feed ไม่ live
- **VITE_WS_URL phone-home bug** (ข้างบน)

## งานค้าง / known issues

- [ ] commit + push: `deploy/` kit + แก้ `hooks/send_event.js` (รองรับ env `CLAUDE_PROJECT` ใช้ label session)
- [ ] **bug:** `hooks/send_event.js:143` hardcode `127.0.0.1:4825` ที่ POST `/context-update`
  (ขณะที่ event ปกติใช้ `MONITOR_SERVER`) → fail เงียบในคอนเทนเนอร์. ควรใช้ `MONITOR_SERVER` เหมือนกัน.
- [ ] (optional) ทำ `CLAUDE_PROJECT` pretty-name map เป็น config แทน hardcode
- [ ] (optional) install.sh wizard ครอบ reverse-proxy/firewall อัตโนมัติ
- พิจารณา gitignore `backend/agents.json` + `backend/events.json`

## Related repo (คนละ repo)

ฝั่ง proxy integration อยู่ที่ `D:\Antigravity\Suparerk\claude-proxy` — proxy spawn `claude` ด้วย env
`CLAUDE_PROJECT` + มี endpoint `/v1/usage` ที่ fetch OMC `/usage`+`/stats` มารวมในผลของตัวเอง.
**Live บน Oracle แล้ว แต่ local repo ยังไม่ sync.**
