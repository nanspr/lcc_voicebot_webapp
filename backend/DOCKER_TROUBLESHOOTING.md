# 🔧 Docker Troubleshooting Guide

## ปัญหา: ImagePullFailure

### สาเหตุ
1. **Image ยังไม่ได้ build** - Docker พยายาม pull image จาก registry แต่ image ยังไม่มี
2. **Image name ไม่ถูกต้อง** - ชื่อ image ที่ระบุไม่ตรงกับ image ที่มีอยู่

### วิธีแก้ไข

#### วิธีที่ 1: ใช้ script (แนะนำ - ง่ายที่สุด)
```bash
cd backend
./docker-run.sh
```

Script นี้จะ:
- Build image อัตโนมัติ
- สร้าง container พร้อม volume mount (sync code)
- ตั้งค่า hot reload

#### วิธีที่ 2: Build image เอง
```bash
cd backend
docker build -t voicebot-backend:latest .
```

#### วิธีที่ 3: ตรวจสอบ image ที่มีอยู่
```bash
docker images | grep voicebot
```

---

## ปัญหา: Code ไม่ Sync (Hot Reload ไม่ทำงาน)

### สาเหตุ
- ไม่มี volume mount ทำให้ code changes ไม่ sync เข้า container
- Container ใช้ code ที่ copy ตอน build เท่านั้น

### วิธีแก้ไข

#### ใช้ script (แนะนำ)
```bash
cd backend
./docker-run.sh
```

Script นี้จะ mount volume อัตโนมัติ ทำให้ code changes sync ทันที

#### ใช้ Docker run แบบ manual
```bash
cd backend

# Build image
docker build -t voicebot-backend:latest .

# Run with volume mount (development)
docker run -d \
  --name voicebot-backend \
  -p 8000:8000 \
  -v $(pwd):/usr/app \
  -v /usr/app/venv \
  --env-file .env \
  -e ENVIRONMENT=development \
  voicebot-backend:latest
```

---

## 🚀 วิธีใช้งาน

### Development Mode (Hot Reload) - แนะนำ
```bash
cd backend

# สร้างไฟล์ .env จาก env.example (ถ้ายังไม่มี)
cp env.example .env
# แก้ไข .env ให้มีค่าที่ถูกต้อง

# Run ด้วย script (ง่ายที่สุด)
./docker-run.sh
```

Script จะ:
- ✅ Build image อัตโนมัติ
- ✅ Mount volume (code sync)
- ✅ ตั้งค่า hot reload
- ✅ แสดง logs

### Production Mode
```bash
cd backend

# Run ด้วย script
./docker-run-prod.sh

# หรือ manual
docker build -t voicebot-backend:latest .
docker run -d \
  --name voicebot-backend-prod \
  -p 8000:8000 \
  --env-file .env \
  -e ENVIRONMENT=production \
  voicebot-backend:latest
```

---

## 📝 หมายเหตุ

1. **Volume Mount**: 
   - Development: ใช้ volume mount เพื่อ sync code
   - Production: ไม่ใช้ volume mount (ใช้ code ที่ build ใน image)

2. **Hot Reload**:
   - Development: ใช้ `reload=True` ใน uvicorn
   - Production: ใช้ workers (ไม่มี reload)

3. **Environment Variables**:
   - สร้างไฟล์ `.env` จาก `env.example`
   - ตั้งค่า Azure SQL credentials ให้ถูกต้อง

---

## 🔍 ตรวจสอบปัญหา

### ตรวจสอบ container กำลังรัน
```bash
docker ps
# หรือ
docker ps -a | grep voicebot
```

### ดู logs
```bash
# Development container
docker logs -f voicebot-backend

# Production container
docker logs -f voicebot-backend-prod

# หรือใช้ container ID
docker logs -f <container-id>
```

### เข้าไปใน container
```bash
docker exec -it voicebot-backend /bin/bash
# หรือ
docker exec -it <container-id> /bin/bash
```

### หยุด container
```bash
# Development
docker stop voicebot-backend

# Production
docker stop voicebot-backend-prod
```

### ลบ container และ image เก่า
```bash
# หยุดและลบ container
docker stop voicebot-backend
docker rm voicebot-backend

# ลบ image
docker rmi voicebot-backend:latest

# หรือลบทั้งหมด (container + image)
docker rm -f voicebot-backend
docker rmi voicebot-backend:latest
```

