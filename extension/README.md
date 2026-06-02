# Oh My Claude - Usage Sync Extension (Optional Fallback)

Chrome extension ที่ดึงข้อมูล usage จาก Claude.ai และส่งไปยัง Oh My Claude dashboard โดยอัตโนมัติ

> ⚠️ **ปกติไม่จำเป็นต้องใช้ตัวนี้แล้ว** — Oh My Claude sync usage % อัตโนมัติจาก OAuth token ของ Claude Code บนเครื่องเดียวกันอยู่แล้ว (ไม่ต้องเปิด browser, ไม่ต้องติดตั้ง extension) extension นี้เก็บไว้เป็น **ทางเลือกสำรอง** สำหรับกรณีเดียว: Claude Code อยู่คนละเครื่องกับ dashboard จึงต้องยืม session ของ claude.ai ใน browser แทนการอ่าน token ในเครื่อง
>
> *Not needed in the normal setup — the dashboard already syncs usage % automatically from Claude Code's local OAuth token. Use this extension only when Claude Code runs on a different machine than the dashboard.*

## How it works

```
Claude.ai → Extension (ดึง API ทุก 1 นาที) → Backend :4824 → Dashboard
```

## Installation

### 1. Load Extension ใน Chrome

1. เปิด Chrome → `chrome://extensions/`
2. เปิด **Developer mode** (มุมขวาบน)
3. คลิก **Load unpacked**
4. เลือก folder `extension` นี้

### 2. เชื่อมต่อ

1. เปิด https://claude.ai และ login
2. Extension จะตรวจจับ organization ID อัตโนมัติ
3. ข้อมูล usage จะ sync ไป dashboard ทุก 1 นาที

### 3. ดูผลใน Dashboard

```bash
cd projects/Oh-My-Claude
npm run dev
```

Dashboard จะแสดง:
- **Session %** - จาก Claude.ai โดยตรง
- **Weekly %** - All models
- **Reset time** - เวลาจริงจาก API
- **LIVE badge** - เมื่อได้ข้อมูลจาก extension

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Extension config |
| `background.js` | ดึง usage API + ส่ง backend |
| `content.js` | หา org ID จาก claude.ai |

## Troubleshooting

### Extension ไม่ sync
```
1. ตรวจสอบว่า login ที่ claude.ai แล้ว
2. Refresh หน้า claude.ai
3. ดู console: chrome://extensions/ > Details > Inspect service worker
```

### Dashboard ไม่แสดง LIVE badge
```
1. ตรวจสอบว่า backend รันอยู่ (npm run dev)
2. ดู Network tab ว่า POST /usage สำเร็จ
3. curl http://localhost:4824/usage
```
