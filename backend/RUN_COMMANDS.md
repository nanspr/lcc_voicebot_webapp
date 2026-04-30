# คำสั่งรัน API Backend

คู่มือคำสั่งสำหรับรัน FastAPI Backend ในรูปแบบต่างๆ

## 📋 Prerequisites

1. สร้างไฟล์ `.env` จาก `env.example`:
   ```bash
   cp env.example .env
   ```

2. แก้ไข `.env` ให้มีข้อมูล Azure SQL ที่ถูกต้อง:
   ```
   AZURE_SQL_SERVER=your-server.database.windows.net
   AZURE_SQL_DATABASE=your-database-name
   AZURE_SQL_USER=your-username
   AZURE_SQL_PASSWORD=your-password
   AZURE_SQL_PORT=1433
   PORT=8000
   ```

---

## 🚀 วิธีที่ 1: รันแบบ Local (ไม่ใช้ Docker)

### ใช้ Script (แนะนำ)

```bash
cd backend
chmod +x run.sh
./run.sh
```

### รันด้วย Python โดยตรง

```bash
cd backend

# สร้าง virtual environment (ครั้งแรกเท่านั้น)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# หรือ
venv\Scripts\activate  # Windows

# ติดตั้ง dependencies (ครั้งแรกเท่านั้น)
pip install -r requirements.txt

# รัน API
python main.py
```

### รันด้วย uvicorn โดยตรง

```bash
cd backend
source venv/bin/activate

# Development mode (hot reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Production mode (with workers)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

---

## 🐳 วิธีที่ 2: รันด้วย Docker (Development)

### ใช้ Script (แนะนำ)

```bash
cd backend
chmod +x docker-run.sh
./docker-run.sh
```

### รันด้วย Docker Command

```bash
cd backend

# Build image
docker build -t voicebot-backend:latest .

# Run container (development mode with hot reload)
docker run -d \
  --name voicebot-backend \
  -p 8000:8000 \
  -v "$(pwd):/usr/app" \
  --env-file .env \
  -e ENVIRONMENT=development \
  -e PORT=8000 \
  voicebot-backend:latest

# ดู logs
docker logs -f voicebot-backend
```

### คำสั่งจัดการ Container

```bash
# ดู logs
docker logs -f voicebot-backend

# หยุด container
docker stop voicebot-backend

# เริ่ม container ใหม่
docker start voicebot-backend

# ลบ container
docker rm -f voicebot-backend

# เข้าไปใน container
docker exec -it voicebot-backend /bin/bash
```

---

## 🏭 วิธีที่ 3: รันด้วย Docker (Production)

### ใช้ Script (แนะนำ)

```bash
cd backend
chmod +x docker-run-prod.sh
./docker-run-prod.sh
```

### รันด้วย Docker Command

```bash
cd backend

# Build image
docker build -t voicebot-backend:latest .

# Run container (production mode)
docker run -d \
  --name voicebot-backend-prod \
  -p 8000:8000 \
  --env-file .env \
  -e ENVIRONMENT=production \
  -e PORT=8000 \
  -e WORKERS=2 \
  --restart unless-stopped \
  voicebot-backend:latest

# ดู logs
docker logs -f voicebot-backend-prod
```

---

## 🔧 คำสั่งที่มีประโยชน์

### ตรวจสอบว่า API ทำงาน

```bash
# Health check
curl http://localhost:8000/

# Dashboard API
curl http://localhost:8000/api/dashboard

# Calls by time
curl http://localhost:8000/api/dashboard/calls-by-time
```

### ดู Logs

```bash
# Local (ถ้ารันด้วย python main.py)
# Logs จะแสดงใน terminal

# Docker
docker logs -f voicebot-backend

# Docker (ล่าสุด 100 บรรทัด)
docker logs --tail 100 voicebot-backend
```

### หยุด/เริ่ม/ลบ Container

```bash
# หยุด
docker stop voicebot-backend

# เริ่ม
docker start voicebot-backend

# Restart
docker restart voicebot-backend

# ลบ
docker rm -f voicebot-backend

# ลบ image
docker rmi voicebot-backend:latest
```

### เปลี่ยน Port

```bash
# Local
PORT=3000 python main.py

# Docker
docker run -d \
  --name voicebot-backend \
  -p 3000:8000 \
  --env-file .env \
  -e PORT=8000 \
  voicebot-backend:latest
```

---

## 🌐 Environment Variables

### Development Mode

```bash
ENVIRONMENT=development python main.py
# หรือ
docker run ... -e ENVIRONMENT=development ...
```

- ✅ Hot reload enabled
- ✅ Single worker
- ✅ Debug mode

### Production Mode

```bash
ENVIRONMENT=production python main.py
# หรือ
docker run ... -e ENVIRONMENT=production -e WORKERS=2 ...
```

- ✅ Multiple workers (default: 2)
- ✅ No hot reload
- ✅ Optimized for performance

---

## 🐛 Troubleshooting

### Port ถูกใช้งานแล้ว

```bash
# ตรวจสอบว่า port ถูกใช้หรือไม่
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# เปลี่ยน port
PORT=3000 python main.py
```

### Container ไม่ start

```bash
# ดู logs
docker logs voicebot-backend

# ตรวจสอบว่า .env มีข้อมูลครบ
cat .env
```

### Connection Error to Azure SQL

```bash
# ตรวจสอบ environment variables
docker exec voicebot-backend env | grep AZURE_SQL

# Test connection จาก container
docker exec -it voicebot-backend python -c "import pyodbc; print(pyodbc.drivers())"
```

---

## 📝 Quick Reference

### รันแบบ Local (Development)
```bash
cd backend && ./run.sh
```

### รันด้วย Docker (Development)
```bash
cd backend && ./docker-run.sh
```

### รันด้วย Docker (Production)
```bash
cd backend && ./docker-run-prod.sh
```

### ตรวจสอบ API
```bash
curl http://localhost:8000/
```

### ดู Logs
```bash
docker logs -f voicebot-backend
```

---

## 🔗 API Endpoints

เมื่อรัน API แล้ว สามารถเข้าถึงได้ที่:

- **Health Check**: http://localhost:8000/
- **Dashboard**: http://localhost:8000/api/dashboard
- **Calls by Time**: http://localhost:8000/api/dashboard/calls-by-time
- **Alerts Call Report**: http://localhost:8000/api/reports/alerts-call
- **Web Call Report**: http://localhost:8000/api/reports/web-call
- **Report Filters**: http://localhost:8000/api/reports/filters
- **API Docs (Swagger)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc

