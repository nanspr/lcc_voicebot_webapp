# Deployment Checklist สำหรับ Azure

## ✅ Dockerfile - ตรวจสอบแล้ว

### สิ่งที่แก้ไข/ปรับปรุง:

1. ✅ **Security**
   - เพิ่ม non-root user (`appuser`)
   - ใช้ `--chown` เพื่อ set ownership

2. ✅ **Azure Compatibility**
   - รองรับ PORT environment variable (Azure App Service ใช้)
   - ใช้ shell form ใน CMD เพื่อให้ expand variable ได้

3. ✅ **Production Ready**
   - เพิ่ม health check
   - ใช้ workers สำหรับ production (2 workers)
   - Upgrade pip ก่อน install dependencies

4. ✅ **Optimization**
   - ใช้ `--no-cache-dir` สำหรับ pip
   - ลบ apt cache หลัง install

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
ตรวจสอบว่าตั้งค่าใน Azure App Service:
- [ ] `AZURE_SQL_SERVER`
- [ ] `AZURE_SQL_DATABASE`
- [ ] `AZURE_SQL_USER`
- [ ] `AZURE_SQL_PASSWORD`
- [ ] `AZURE_SQL_PORT` (default: 1433)
- [ ] `PORT` (Azure จะ set ให้อัตโนมัติ)
- [ ] `ENVIRONMENT=production` (optional)

### 2. Azure SQL Firewall
- [ ] เปิด "Allow Azure services and resources to access this server"
- [ ] หรือเพิ่ม App Service outbound IPs ใน firewall rules

### 3. Security
- [ ] ใช้ Azure Key Vault สำหรับ secrets (แนะนำ)
- [ ] ตั้งค่า CORS ให้เฉพาะ domain ที่ต้องการ
- [ ] ตรวจสอบว่า non-root user ทำงานได้

### 4. Monitoring
- [ ] เปิดใช้งาน Application Insights
- [ ] ตั้งค่า alerts สำหรับ errors
- [ ] ตรวจสอบ logs

### 5. Performance
- [ ] ตั้งค่า Always On = true (production)
- [ ] ตรวจสอบ workers count (default: 2)
- [ ] ตั้งค่า auto-scaling (ถ้าจำเป็น)

## 🚀 Quick Deploy Commands

### Build และ Test Docker Image Locally

```bash
cd backend
docker build -t dashboard-api:test .
docker run -p 8000:8000 \
  -e AZURE_SQL_SERVER="your-server" \
  -e AZURE_SQL_DATABASE="your-db" \
  -e AZURE_SQL_USER="your-user" \
  -e AZURE_SQL_PASSWORD="your-password" \
  dashboard-api:test
```

### Deploy to Azure Container Registry

```bash
# Login
az acr login --name <your-acr-name>

# Build and push
az acr build --registry <your-acr-name> \
  --image dashboard-api:latest \
  --file backend/Dockerfile ./backend
```

### Update App Service

```bash
az webapp config container set \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name <your-acr>.azurecr.io/dashboard-api:latest
```

## 🔍 Testing After Deployment

1. **Health Check:**
```bash
curl https://<your-app>.azurewebsites.net/
```

2. **Dashboard API:**
```bash
curl https://<your-app>.azurewebsites.net/api/dashboard
```

3. **Calls by Time API:**
```bash
curl https://<your-app>.azurewebsites.net/api/dashboard/calls-by-time
```

## ⚠️ Common Issues

### Issue: Connection timeout to Azure SQL
**Solution:** ตรวจสอบ firewall rules และเปิด "Allow Azure services"

### Issue: ODBC Driver not found
**Solution:** ตรวจสอบว่า Dockerfile ติดตั้ง msodbcsql18 แล้ว

### Issue: Port binding error
**Solution:** Azure จะ set PORT อัตโนมัติ ไม่ต้องตั้งค่าเอง

### Issue: CORS errors
**Solution:** ตั้งค่า `allow_origins` ใน main.py ให้เฉพาะ domain ที่ต้องการ

## 📝 Notes

- Dockerfile ใช้ Python 3.11-slim (lightweight)
- Health check ทำงานทุก 30 วินาที
- ใช้ 2 workers สำหรับ production (ปรับได้ด้วย WORKERS env var)
- Non-root user ชื่อ `appuser` (UID 1000)

