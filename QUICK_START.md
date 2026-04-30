# Quick Start Guide - Dashboard API

## วิธีรัน FastAPI Backend

1. **เปิด Terminal ใหม่** และไปที่โฟลเดอร์ backend:
```bash
cd backend
```

2. **ติดตั้ง dependencies** (ครั้งแรกเท่านั้น):
```bash
pip install -r requirements.txt
```

3. **สร้างไฟล์ .env** (ถ้ายังไม่มี):
```bash
cp env.example .env
# แก้ไข .env ด้วยข้อมูล Azure SQL ของคุณ
```

4. **รัน FastAPI backend**:
```bash
python main.py
# หรือ
uvicorn main:app --reload --port 8000
```

Backend จะรันที่: `http://localhost:8000`

## วิธีรัน Frontend

1. **เปิด Terminal ใหม่** (แยกจาก backend):
```bash
# อยู่ที่ root directory ของโปรเจกต์
npm run dev
```

2. **ตรวจสอบว่า frontend เรียก API ถูกต้อง**:
   - เปิด Browser Console (F12)
   - ดูว่า log แสดง: `📊 Fetching dashboard data from: http://localhost:8000/api/dashboard`
   - ถ้ายังแสดง port 3000 แสดงว่ายังใช้ค่าเก่า

3. **ถ้ายังมีปัญหา**:
   - Restart frontend dev server (Ctrl+C แล้วรัน `npm run dev` ใหม่)
   - Hard refresh browser (Ctrl+Shift+R หรือ Cmd+Shift+R)
   - ตรวจสอบไฟล์ `.env` ใน root directory ว่ามี `VITE_DASHBOARD_API=http://localhost:8000/api/dashboard` หรือไม่

## ตรวจสอบว่า API ทำงาน

ทดสอบ API ด้วย curl:
```bash
curl http://localhost:8000/api/dashboard
```

ควรได้ JSON response กลับมา

## Troubleshooting

### Network Error ในหน้า Dashboard

1. **ตรวจสอบว่า backend รันอยู่**:
   ```bash
   curl http://localhost:8000/api/dashboard
   ```

2. **ตรวจสอบ CORS**:
   - Backend ตั้งค่า CORS ให้รองรับทุก origin แล้ว
   - ถ้ายังมีปัญหา ให้ตรวจสอบ browser console

3. **ตรวจสอบ Environment Variables**:
   - Frontend: ตรวจสอบ `.env` ใน root directory
   - Backend: ตรวจสอบ `.env` ใน `backend/` directory

4. **Restart ทั้งสอง**:
   - Restart backend (Ctrl+C แล้วรันใหม่)
   - Restart frontend (Ctrl+C แล้วรัน `npm run dev` ใหม่)

