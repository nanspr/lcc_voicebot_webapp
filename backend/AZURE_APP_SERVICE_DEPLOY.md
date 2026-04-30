# Azure App Service Deployment Guide

คู่มือการ deploy backend ไปยัง Azure App Service ด้วย Dockerfile

## โครงสร้างไฟล์ที่ปรับปรุงแล้ว

```
backend/
├── Dockerfile              # Dockerfile ที่ปรับให้เหมาะกับ Azure App Service
├── .dockerignore           # ไฟล์ที่ต้อง exclude จาก Docker build
├── main.py                 # FastAPI application (รองรับ PORT env var)
├── requirements.txt        # Python dependencies
├── env.example            # ตัวอย่าง environment variables
└── AZURE_APP_SERVICE_DEPLOY.md  # ไฟล์นี้
```

## สิ่งที่ปรับปรุงใน Dockerfile

1. ✅ ใช้ `python:3.11-slim` (image เล็กลง)
2. ✅ สร้าง non-root user (`appuser`) เพื่อความปลอดภัย
3. ✅ รองรับ PORT environment variable (Azure App Service set อัตโนมัติ)
4. ✅ เพิ่ม HEALTHCHECK สำหรับ monitoring
5. ✅ ใช้ `--no-install-recommends` เพื่อลดขนาด image

## วิธี Deploy

### วิธีที่ 1: Deploy จาก Local Docker Image

```bash
# 1. Build Docker image
cd backend
docker build -t voicebot-backend:latest .

# 2. Tag image สำหรับ Azure Container Registry
docker tag voicebot-backend:latest <your-acr>.azurecr.io/voicebot-backend:latest

# 3. Login to Azure Container Registry
az acr login --name <your-acr>

# 4. Push image to ACR
docker push <your-acr>.azurecr.io/voicebot-backend:latest

# 5. Update App Service to use new image
az webapp config container set \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name <your-acr>.azurecr.io/voicebot-backend:latest
```

### วิธีที่ 2: Deploy จาก Source Code (GitHub/Azure DevOps)

Azure App Service สามารถ build Dockerfile โดยอัตโนมัติ:

1. **ตั้งค่า Deployment Center:**
   - ไปที่ Azure Portal > App Service > Deployment Center
   - เลือก Source: GitHub / Azure Repos / Local Git
   - เลือก Build Provider: App Service build service

2. **ตั้งค่า Build Configuration:**
   - Platform: Docker Container
   - Dockerfile path: `backend/Dockerfile`
   - Docker context: `backend/`

### วิธีที่ 3: ใช้ Azure Container Registry Build

```bash
# Build และ push ในคำสั่งเดียว
az acr build \
  --registry <your-acr> \
  --image voicebot-backend:latest \
  --file backend/Dockerfile \
  ./backend
```

## ตั้งค่า Environment Variables

ตั้งค่าใน Azure Portal > App Service > Configuration > Application settings:

```
AZURE_SQL_SERVER=<your-server>.database.windows.net
AZURE_SQL_DATABASE=<your-database>
AZURE_SQL_USER=<your-username>
AZURE_SQL_PASSWORD=<your-password>
AZURE_SQL_PORT=1433
ENVIRONMENT=production
WORKERS=2
```

**หมายเหตุ:** `PORT` จะถูก set อัตโนมัติโดย Azure App Service ไม่ต้องตั้งค่าเอง

## ตั้งค่า Azure SQL Firewall

1. ไปที่ Azure Portal > SQL Server > Networking
2. เปิด "Allow Azure services and resources to access this server"
3. หรือเพิ่ม App Service outbound IPs ใน firewall rules

หา App Service outbound IPs:
```bash
az webapp show \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --query outboundIpAddresses \
  --output tsv
```

## ตรวจสอบการ Deploy

### 1. Health Check
```bash
curl https://<your-app>.azurewebsites.net/
```

ควรได้ response:
```json
{"message": "Dashboard API is running", "status": "ok"}
```

### 2. Dashboard API
```bash
curl https://<your-app>.azurewebsites.net/api/dashboard
```

### 3. ดู Logs
```bash
# Azure CLI
az webapp log tail \
  --name <your-app-name> \
  --resource-group <your-resource-group>

# หรือดูใน Azure Portal
# App Service > Log stream
```

## Troubleshooting

### Issue: Container ไม่ start
- ตรวจสอบ logs: `az webapp log tail`
- ตรวจสอบว่า PORT environment variable ถูก set
- ตรวจสอบว่า main.py รันได้

### Issue: Connection timeout to Azure SQL
- ตรวจสอบ firewall rules
- เปิด "Allow Azure services"
- ตรวจสอบ connection string

### Issue: ODBC Driver not found
- ตรวจสอบว่า Dockerfile ติดตั้ง `msodbcsql18` แล้ว
- ดู logs เพื่อยืนยัน

### Issue: Permission denied
- ตรวจสอบว่าใช้ non-root user (`appuser`)
- ตรวจสอบ file permissions

## Best Practices

1. ✅ ใช้ Azure Key Vault สำหรับ secrets
2. ✅ ตั้งค่า CORS ให้เฉพาะ domain ที่ต้องการ
3. ✅ เปิดใช้งาน Application Insights
4. ✅ ตั้งค่า Always On = true (production)
5. ✅ ใช้ staging slots สำหรับ testing
6. ✅ ตั้งค่า auto-scaling ตามความต้องการ

## Monitoring

### Application Insights
```bash
# สร้าง Application Insights
az monitor app-insights component create \
  --app <app-insights-name> \
  --location <location> \
  --resource-group <resource-group>

# เชื่อมต่อกับ App Service
az webapp config appsettings set \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=<instrumentation-key>
```

## Scaling

```bash
# Scale up (เปลี่ยน pricing tier)
az appservice plan update \
  --name <plan-name> \
  --resource-group <resource-group> \
  --sku P1V2

# Scale out (เพิ่ม instances)
az appservice plan update \
  --name <plan-name> \
  --resource-group <resource-group> \
  --number-of-workers 3
```

## Security Checklist

- [ ] ใช้ non-root user ใน container
- [ ] ใช้ Azure Key Vault สำหรับ secrets
- [ ] ตั้งค่า CORS ให้เฉพาะ domain ที่ต้องการ
- [ ] เปิดใช้งาน HTTPS only
- [ ] ตั้งค่า firewall rules สำหรับ Azure SQL
- [ ] ใช้ managed identity (ถ้าเป็นไปได้)
- [ ] เปิดใช้งาน Application Insights
- [ ] ตั้งค่า alerts สำหรับ errors

