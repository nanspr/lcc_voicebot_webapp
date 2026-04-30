# Backend Proxy Setup Guide

## ภาพรวม

ระบบได้ถูกปรับปรุงให้ใช้ **Backend Proxy** สำหรับการเรียก TTS API และ Phone Call API แทนการเรียกโดยตรงจาก frontend เพื่อแก้ปัญหา CORS และ Mixed Content (HTTP/HTTPS)

## สิ่งที่เปลี่ยนแปลง

### 1. Backend (FastAPI)
- เพิ่ม endpoint `/api/tts` สำหรับ proxy TTS API
- เพิ่ม endpoint `/api/phone-call` สำหรับ proxy Phone Call API
- API keys ถูกเก็บไว้ฝั่ง backend (ไม่โผล่ใน browser)

### 2. Frontend
- แก้ไข `VoicebotInterface.jsx` ให้เรียกผ่าน backend proxy แทนการเรียก API โดยตรง
- ไม่ต้องส่ง API keys จาก frontend อีกต่อไป

## การตั้งค่า Environment Variables

### Backend Environment Variables

เพิ่ม environment variables ต่อไปนี้ใน backend (`.env` หรือ Azure App Service Configuration):

```bash
# TTS API Configuration (ใช้ VITE_TTS_API ที่มีอยู่แล้ว)
VITE_TTS_API=https://voice-tts.botnoi.ai/scgjwd/api/doctts
VITE_X_API_KEY=Sh59yS363eb5tJJ9oA70CaOOLMVPA6m7vq72451mi7pS
VITE_API_KEY=N1jRb6b6DHSineGWl3JENVnCaiDqOHve

# Phone Call API Configuration (ใช้ VITE_PHONE_CALL_API ที่มีอยู่แล้ว)
VITE_PHONE_CALL_API=http://188.166.254.121:8502/scgjwd/add-que

# Phone Call Token (ถ้ามี)
VITE_PHONE_CALL_TOKEN=your_phone_call_token_here  # ถ้ามี
VITE_API_TOKEN=your_api_token_here  # fallback ถ้าไม่มี VITE_PHONE_CALL_TOKEN

# Default values
VITE_DEFAULT_PHONE_NUMBER=60000
VITE_DEFAULT_PERSON_NAME=web app voicebot
```

**หมายเหตุ:** 
- Backend ใช้ environment variables เดียวกันกับ frontend (`VITE_*`) เพื่อความสะดวกในการจัดการ
- สำหรับ Phone Call API ถ้ามี token ให้ตั้งค่า `VITE_PHONE_CALL_TOKEN` หรือ `VITE_API_TOKEN`

### Frontend Environment Variables

Frontend ยังคงใช้ `VITE_API_BASE_URL` เพื่อชี้ไปที่ backend:

```bash
# Backend API Base URL
VITE_API_BASE_URL=https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net

# Optional: ถ้าต้องการ override dashboard API
# VITE_DASHBOARD_API=https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net/api/dashboard
```

**หมายเหตุ:** 
- `VITE_TTS_API` และ `VITE_PHONE_CALL_API` ไม่จำเป็นต้องใช้ใน frontend อีกต่อไป (แต่ยังคงไว้เพื่อ backward compatibility)
- Frontend จะเรียก `/api/tts` และ `/api/phone-call` ผ่าน `VITE_API_BASE_URL` แทน

## การติดตั้ง Dependencies

### Backend

```bash
cd backend
pip install -r requirements.txt
```

**Dependencies ที่เพิ่ม:**
- `httpx>=0.25.0` - สำหรับ async HTTP client ในการเรียก external APIs

## การทดสอบ

### 1. ทดสอบ Backend Proxy

```bash
# Start backend server
cd backend
python main.py

# Test TTS endpoint
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "สวัสดีค่ะ",
    "speaker": "1",
    "volume": 1,
    "speed": 1,
    "type_media": "wav",
    "language": "th"
  }'

# Test Phone Call endpoint
curl -X POST http://localhost:8000/api/phone-call \
  -H "Content-Type: application/json" \
  -d '{
    "number": "60000",
    "message": "กรุณาคาดเข็มขัดนิรภัยขณะขับรถค่ะ",
    "phone_number": "60000",
    "person_name": "web app voicebot",
    "prompt_id": 3
  }'
```

### 2. ทดสอบ Frontend

1. ตรวจสอบว่า `VITE_API_BASE_URL` ชี้ไปที่ backend ที่ถูกต้อง
2. เปิดหน้าเว็บและทดสอบ:
   - **ฟังเสียง**: ใส่ข้อความแล้วกด "ฟังเสียง" - ควรได้เสียงกลับมา
   - **โทรออก**: ใส่ข้อความและเบอร์โทรแล้วกด "โทรออก" - ควรโทรได้สำเร็จ

## ประโยชน์ของการใช้ Backend Proxy

1. **แก้ปัญหา CORS**: ไม่ต้องตั้งค่า CORS บน external APIs
2. **แก้ปัญหา Mixed Content**: Backend สามารถเรียก HTTP API ได้แม้ frontend อยู่บน HTTPS
3. **ความปลอดภัย**: API keys ถูกเก็บไว้ฝั่ง backend ไม่โผล่ใน browser
4. **จัดการง่าย**: จัดการ API keys และ error handling ที่จุดเดียว
5. **Logging**: สามารถ log requests ทั้งหมดได้ที่ backend

## Troubleshooting

### ปัญหา: Frontend ไม่สามารถเชื่อมต่อกับ backend proxy ได้

**สาเหตุที่เป็นไปได้:**
- Backend server ไม่ทำงาน
- `VITE_API_BASE_URL` ไม่ถูกต้อง
- CORS ไม่ได้ตั้งค่าใน backend (ควรตั้งค่าให้รองรับ origin ของ frontend)

**วิธีแก้:**
1. ตรวจสอบว่า backend server ทำงานอยู่
2. ตรวจสอบ `VITE_API_BASE_URL` ใน frontend
3. ตรวจสอบ CORS settings ใน `backend/main.py` (ตอนนี้ตั้งเป็น `allow_origins=["*"]` สำหรับ development)

### ปัญหา: TTS API ไม่ทำงาน

**สาเหตุที่เป็นไปได้:**
- `VITE_X_API_KEY` หรือ `VITE_API_KEY` ไม่ถูกต้อง
- `VITE_TTS_API` ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ environment variables ใน backend (`VITE_TTS_API`, `VITE_X_API_KEY`, `VITE_API_KEY`)
2. ดู logs ใน backend console
3. ทดสอบ endpoint โดยตรงด้วย curl

### ปัญหา: Phone Call API ไม่ทำงาน

**สาเหตุที่เป็นไปได้:**
- `VITE_PHONE_CALL_API` ไม่ถูกต้อง
- Phone Call API server ไม่ทำงาน

**วิธีแก้:**
1. ตรวจสอบ `VITE_PHONE_CALL_API` ใน backend
2. ทดสอบ Phone Call API โดยตรง
3. ดู logs ใน backend console

## Migration Notes

### สำหรับ Production Deployment

1. **ตั้งค่า Environment Variables ใน Azure App Service:**
   - ไปที่ Azure Portal → App Service → Configuration → Application settings
   - เพิ่ม environment variables ตามที่ระบุด้านบน

2. **Deploy Backend:**
   - Deploy backend code ที่มี proxy endpoints ใหม่
   - ตรวจสอบว่า `requirements.txt` มี `httpx` แล้ว

3. **Deploy Frontend:**
   - Deploy frontend code ที่แก้ไขแล้ว
   - ตรวจสอบว่า `VITE_API_BASE_URL` ชี้ไปที่ backend ที่ถูกต้อง

4. **ทดสอบ:**
   - ทดสอบฟีเจอร์ "ฟังเสียง" และ "โทรออก" ใน production
   - ตรวจสอบ logs ใน backend

## สรุป

ระบบตอนนี้ใช้ **Backend Proxy Pattern** ซึ่งเป็น best practice สำหรับการจัดการ external APIs:
- Frontend → Backend Proxy → External APIs
- API keys ปลอดภัยใน backend
- ไม่มีปัญหา CORS และ Mixed Content
- จัดการง่ายและขยายได้

