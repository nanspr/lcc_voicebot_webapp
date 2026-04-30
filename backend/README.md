# Dashboard API Backend (FastAPI)

FastAPI backend สำหรับ Dashboard ที่เชื่อมต่อกับ Azure SQL Server

## การติดตั้ง

### 1. ติดตั้ง Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. ติดตั้ง ODBC Driver

สำหรับ macOS:
```bash
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install msodbcsql18 mssql-tools18
```

สำหรับ Linux (Ubuntu/Debian):
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list > /etc/apt/sources.list.d/mssql-release.list
apt-get update
apt-get install -y msodbcsql18
```

สำหรับ Windows:
- ดาวน์โหลดและติดตั้งจาก: https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` และใส่ค่าต่อไปนี้:
- `AZURE_SQL_SERVER`: Azure SQL Server address (เช่น: your-server.database.windows.net)
- `AZURE_SQL_DATABASE`: ชื่อ database
- `AZURE_SQL_USER`: username สำหรับเชื่อมต่อ
- `AZURE_SQL_PASSWORD`: password สำหรับเชื่อมต่อ
- `AZURE_SQL_PORT`: port ของ SQL Server (default: 1433)
- `PORT`: port ที่ FastAPI จะรัน (default: 8000)

## การรัน

### Development Mode

```bash
python main.py
```

หรือใช้ uvicorn โดยตรง:

```bash
uvicorn main:app --reload --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### GET `/api/dashboard`

ดึงข้อมูล dashboard statistics

**Response:**
```json
{
  "totalCalls": 150,
  "totalDrivers": 45,
  "totalCarriers": 12,
  "reasonChart": [
    {
      "reason_text": "Seatbelt reminder",
      "count": 50
    }
  ],
  "topDrivers": [
    {
      "person_name": "John Doe",
      "count": 25
    }
  ],
  "topCarriers": [
    {
      "carrier_name": "Carrier A",
      "count": 30
    }
  ]
}
```

## การ Deploy

### Docker

สร้าง Dockerfile:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install ODBC Driver
RUN apt-get update && apt-get install -y \
    curl apt-transport-https gnupg \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build และ run:

```bash
docker build -t dashboard-api .
docker run -p 8000:8000 --env-file .env dashboard-api
```

### Cloud Platforms

สามารถ deploy ไปยัง:
- Azure App Service
- AWS Elastic Beanstalk
- Google Cloud Run
- Heroku
- Railway
- Render

## หมายเหตุ

- API นี้ใช้ ODBC Driver 18 for SQL Server
- ต้องมี ODBC Driver ติดตั้งในระบบที่รัน
- สำหรับ production ควรตั้งค่า CORS ให้เฉพาะ domain ที่ต้องการ

