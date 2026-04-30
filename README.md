# LCC Voicebot Frontend

ระบบ Voicebot Interface สำหรับส่งข้อความและแจ้งเตือนผ่านเสียงและโทรศัพท์

## คุณสมบัติ

- 📤 ส่งข้อความไปยัง API และรับข้อความตอบกลับ
- 🔊 แปลงข้อความเป็นเสียง (Text-to-Speech)
- 📞 โทรออกพร้อมข้อความแจ้งเตือน
- 🎨 UI สวยงามด้วย Gradient Text บนพื้นหลังสีขาว

## การติดตั้ง

```bash
npm install
```

## การรันโปรเจกต์

```bash
npm run dev
```

## การ Build

```bash
npm run build
```

## การตั้งค่า Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ root ของโปรเจกต์:

```env
VITE_INFORM_AGENT_API=https://n8n.scgjwd.com/webhook/InformAgent
VITE_TTS_API=https://voice-tts.botnoi.ai/scgjwd/api/doctts
VITE_PHONE_CALL_API=http://188.166.254.121:8502/scgjwd/add-que
VITE_DEFAULT_PHONE_NUMBER=60004
VITE_DEFAULT_PERSON_NAME=สมชาย ทัพเพชร

# Dashboard API (Voicebot Monitoring)
# URL ของ backend API ที่ query ข้อมูลจาก Azure SQL Server
# Default: FastAPI backend (port 8000) หรือ Node.js backend (port 3000)
#VITE_DASHBOARD_API=http://localhost:8000/api/dashboard

# Authentication สำหรับ TTS API
# ระบบจะใช้ Authorization header โดย default เพื่อหลีกเลี่ยง CORS preflight
# เพิ่ม API key ตามรูปแบบใดรูปแบบหนึ่ง:
# VITE_X_API_KEY=your_x_api_key_here
# VITE_API_KEY=your_api_key_here
# VITE_API_TOKEN=your_api_token_here

# ถ้า TTS API ต้องการ custom headers (x-api-key, key) แทน Authorization header
# ให้ตั้งค่า VITE_TTS_USE_CUSTOM_HEADERS=true (จะ trigger CORS preflight)
# VITE_TTS_USE_CUSTOM_HEADERS=false

# Authentication สำหรับ InformAgent API
# VITE_INFORM_AGENT_USER=username
# VITE_INFORM_AGENT_PASS=password
# VITE_INFORM_AGENT_TOKEN=your_inform_agent_token_here
```

## การตั้งค่า Backend API สำหรับ Dashboard

Dashboard ต้องการ backend API เพื่อ query ข้อมูลจาก Azure SQL Server

### วิธีที่ 1: ใช้ FastAPI Backend (Python) - แนะนำ

1. ไปที่โฟลเดอร์ `backend`:
```bash
cd backend
```

2. ติดตั้ง dependencies:
```bash
pip install -r requirements.txt
```

3. ติดตั้ง ODBC Driver สำหรับ SQL Server (ดูรายละเอียดใน `backend/README.md`)

4. สร้างไฟล์ `.env` จาก `env.example`:
```bash
cp env.example .env
```

5. แก้ไขไฟล์ `.env`:
```env
AZURE_SQL_USER=your_username
AZURE_SQL_PASSWORD=your_password
AZURE_SQL_SERVER=your_server.database.windows.net
AZURE_SQL_DATABASE=your_database
AZURE_SQL_PORT=1433
PORT=8000
```

6. รัน backend server:
```bash
python main.py
```

หรือใช้ uvicorn:
```bash
uvicorn main:app --reload --port 8000
```

ดูรายละเอียดเพิ่มเติมใน `backend/README.md`

### วิธีที่ 2: ใช้ Example Backend (Node.js)

1. ติดตั้ง dependencies:
```bash
npm install express mssql dotenv
```

2. สร้างไฟล์ `.env` สำหรับ backend:
```env
AZURE_SQL_USER=your_username
AZURE_SQL_PASSWORD=your_password
AZURE_SQL_SERVER=your_server.database.windows.net
AZURE_SQL_DATABASE=your_database
PORT=3000
```

3. รัน backend server:
```bash
node backend-api-example.js
```

**หมายเหตุ:** อย่าลืมตั้งค่า `VITE_DASHBOARD_API=http://localhost:3000/api/dashboard` ในไฟล์ `.env` ของ frontend

### วิธีที่ 3: ใช้ Backend ที่มีอยู่แล้ว

ตั้งค่า `VITE_DASHBOARD_API` ใน `.env` ให้ชี้ไปที่ backend API endpoint ของคุณ

### Backend API Response Format

Backend API ควร return JSON ในรูปแบบนี้:

```json
{
  "totalCalls": 150,
  "totalDrivers": 45,
  "totalCarriers": 12,
  "reasonChart": [
    { "reason_text": "Seatbelt reminder", "count": 50 },
    { "reason_text": "Speed warning", "count": 30 },
    { "reason_text": "Route deviation", "count": 20 }
  ],
  "topDrivers": [
    { "person_name": "John Doe", "count": 25 }
  ],
  "topCarriers": [
    { "carrier_name": "Carrier A", "count": 30 }
  ]
}
```

## API Endpoints

1. **InformAgent API**: `https://n8n.scgjwd.com/webhook/InformAgent`
   - รับข้อความและส่งข้อความตอบกลับ
   - หากได้รับ error 401 Unauthorized ให้เพิ่ม API key ใน `.env`

2. **TTS API**: `https://voice-tts.botnoi.ai/scgjwd/api/doctts`
   - แปลงข้อความเป็นเสียง MP3

3. **Phone Call API**: `http://188.166.254.121:8502/scgjwd/add-que`
   - โทรออกพร้อมข้อความแจ้งเตือน

## การแก้ปัญหา Error 401 Unauthorized

หากได้รับ error 401 Unauthorized:

1. ตรวจสอบว่า API ต้องการ authentication หรือไม่
2. เพิ่ม API key/token ในไฟล์ `.env` ตามรูปแบบที่ API ต้องการ
3. รีสตาร์ท dev server (`npm run dev`) หลังจากแก้ไข `.env`

## การแก้ปัญหา CORS Preflight (401)

หากได้รับ error "Preflight response is not successful. Status code: 401" เมื่อกดปุ่ม "ฟังเสียง":

**สาเหตุ:**
- TTS API ใช้ custom headers (`x-api-key`, `key`) ซึ่งจะ trigger CORS preflight request (OPTIONS)
- API server ไม่ได้ตั้งค่า CORS ให้รองรับ headers เหล่านี้ ทำให้ preflight request ได้ 401

**วิธีแก้ (อัตโนมัติ):**
โค้ดปัจจุบันใช้ **Authorization header** แทน custom headers โดย default เพื่อหลีกเลี่ยง CORS preflight request

**ถ้ายังมีปัญหา:**
1. **วิธีที่ 1:** ตรวจสอบว่า API รองรับ Authorization header หรือไม่
   - ถ้า API ต้องการ custom headers (`x-api-key`, `key`) จริงๆ ให้ตั้งค่า `VITE_TTS_USE_CUSTOM_HEADERS=true` ใน `.env`
   - แล้วติดต่อทีม backend เพื่อตั้งค่า CORS:
     ```
     Access-Control-Allow-Headers: x-api-key, key, Content-Type
     Access-Control-Allow-Methods: POST, OPTIONS
     Access-Control-Allow-Origin: *
     ```

2. **วิธีที่ 2:** สร้าง backend proxy เพื่อเรียก TTS API แทนการเรียกจาก browser โดยตรง

3. **วิธีที่ 3:** ใช้ query parameters สำหรับ authentication (โค้ดรองรับแล้ว)

**หมายเหตุ:** 
- โค้ดปัจจุบันใช้ `response_format: 'url'` เพื่อขอ URL จาก API แทนไฟล์โดยตรง
- ใช้ Authorization header แทน custom headers โดย default เพื่อหลีกเลี่ยง CORS preflight
- ถ้าต้องการใช้ custom headers ให้ตั้งค่า `VITE_TTS_USE_CUSTOM_HEADERS=true` ใน `.env`

## เทคโนโลยีที่ใช้

- React 18
- Vite
- Axios
- CSS3 (Gradient & Animations)

