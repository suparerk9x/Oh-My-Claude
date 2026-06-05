# Backlog — Oh-My-Claude + claude-proxy

งานที่ตั้งใจทำแต่ยังไม่ลงมือ. เก็บไว้กลับมาหยิบ. (อันที่ทำเสร็จแล้วย้ายไป git log / CLAUDE.md)

---

## 1. ปิด loop "PC → push → prod pull" ของ claude-proxy

**บริบท (2026-06-05):** `D:\Antigravity\Suparerk\claude-proxy` เพิ่ง git-init + baseline (`527fa06`)
โดย sync โค้ดลงมาจาก **live Oracle** (`enterprise-oracle` = 161.33.204.39, ตัว `ai-ceo-thailand`
ARM). ตอนนี้ local เป็น git แล้ว **แต่ยังไม่ถึงระดับ deploy-by-git เหมือน OMC.**

**ทำไมยังไม่ครบ (2 ช่องโหว่):**
1. Oracle `~/claude-proxy` **ยังไม่ใช่ git** — ยังถูกแก้มือได้ → drift กลับมาได้ทุกเมื่อ
   (นี่คือต้นเหตุเดิมที่ local ตามหลัง). live รันเป็น Docker container `claude-proxy` (port 3210,
   CMD `node src/index.js`, **ไม่ใช่ PM2**).
2. proxy repo **ยังไม่มี GitHub remote** → push ไม่ได้

**Definition of done:**
- [ ] สร้าง GitHub repo `claude-proxy` (private) → `git remote add origin … && git push -u origin main`
- [ ] เปลี่ยน Oracle `~/claude-proxy` ให้เป็น git clone ที่ pull จาก remote
  - ⚠ **ระวังตอนแปลง:** อย่าให้โดน `data/` (sqlite `proxy.db`) + `logs/` — ทั้งคู่อยู่ใน `.gitignore`
    แล้วและเป็น docker volume (`./data:/app/data`, `./logs:/app/logs`). backup `data/proxy.db` ก่อน.
  - ⚠ mount อื่นที่ห้ามแตะ: `/home/ubuntu/.claude`, `/home/ubuntu/vault-hermes-output`,
    `/home/ubuntu/.hermes/*` (ดู `docker-compose.yml`).
  - วิธีปลอดภัย: `git init` ใน dir เดิม → `git remote add` → `git fetch` → `git reset --soft origin/main`
    (ไม่แตะ working tree/ไฟล์ที่ไม่ track) → ตรวจ `git status` ว่า data/logs ไม่หลุด
- [ ] deploy ใหม่ = `git pull && docker compose up -d --build` (เขียนลง README proxy)
- [ ] ลบ `.bak` ที่ Oracle (`src/claude.js.bak`, `src/index.js.bak`) — git ทำหน้าที่ backup แทนแล้ว

**ผลลัพธ์:** claude-proxy ได้ deploy-by-git แบบเดียวกับ OMC (ดู `CLAUDE.md` § "Two instances, one repo").

---

## 2. (optional, จาก deploy/README §4) ปรับปรุง OMC / hooks

- [ ] `CLAUDE_PROJECT` pretty-name map เป็น **config** แทน hardcode ใน `hooks/send_event.js`
  (เช่น `{'tts-web':'TTS Director'}`) — ตอนนี้ใช้ค่า env ดิบเป็น label
- [ ] `install.sh` wizard: ครอบ reverse-proxy / firewall (NPM proxy host, iptables bridge rule)
  ให้อัตโนมัติ — ตอนนี้เป็น manual ตาม `deploy/README` §2
- [ ] พิจารณา health-check ระหว่าง proxy ↔ OMC: ถ้า OMC ล่ม `/v1/usage` ของ proxy คืน `omc:null`
  เงียบๆ (graceful แล้ว แต่ไม่มี alert)

---

## หลักที่ยึด (อย่าลืม)

- **Env diff ห้าม hardcode ในโค้ด → ดันเป็น env var / install arg** (OMC `CLAUDE.md` กฎเหล็ก)
- **Sync ทิศเดียว: dev ที่ PC → push → prod pull. ห้ามแก้โค้ดบน server ตรงๆ.**
