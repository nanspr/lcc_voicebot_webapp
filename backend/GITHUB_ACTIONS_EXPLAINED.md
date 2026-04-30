# GitHub Actions สำหรับ Deploy ไป Azure - อธิบาย

## 🤔 GitHub Actions คืออะไร?

GitHub Actions เป็นระบบ **CI/CD (Continuous Integration/Continuous Deployment)** ที่ทำงานอัตโนมัติเมื่อคุณ push code ไปยัง GitHub

## 📋 GitHub Actions ที่สร้างไว้ทำอะไร?

ไฟล์ `.github/workflows/azure-deploy.yml` จะทำงานอัตโนมัติเมื่อ:

1. **คุณ push code ไปยัง branch `main`**
2. **มีการแก้ไขไฟล์ในโฟลเดอร์ `backend/`**

### ขั้นตอนที่ทำงานอัตโนมัติ:

```
1. Checkout code (ดึง code จาก GitHub)
   ↓
2. Set up Python 3.11
   ↓
3. Login เข้า Azure
   ↓
4. Build Docker image และ push ไปยัง Azure Container Registry (ACR)
   ↓
5. Deploy image ไปยัง Azure App Service
```

## 🎯 ประโยชน์

### ✅ ไม่ต้องทำเองทุกครั้ง
- **ปกติ:** คุณต้อง build Docker image, push ไป ACR, deploy เองทุกครั้ง
- **มี GitHub Actions:** แค่ push code ไป GitHub แล้วระบบจะทำให้อัตโนมัติ

### ✅ ปลอดภัย
- ใช้ secrets จาก GitHub (ไม่ต้องเก็บ credentials ใน code)
- มี audit trail (รู้ว่าใคร deploy เมื่อไหร่)

### ✅ เร็ว
- Deploy อัตโนมัติทันทีที่ push code
- ไม่ต้องรอให้คนมา deploy

## 📝 วิธีใช้งาน

### 1. ตั้งค่า Secrets ใน GitHub

ไปที่ GitHub Repository → Settings → Secrets and variables → Actions

เพิ่ม secrets ต่อไปนี้:

```
AZURE_CREDENTIALS
  - ใช้คำสั่งนี้สร้าง:
  az ad sp create-for-rbac --name "github-actions" \
    --role contributor \
    --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group> \
    --sdk-auth

AZURE_ACR_NAME
  - ชื่อ Azure Container Registry (เช่น: acrvoicebot)

AZURE_WEBAPP_NAME (optional - มี default อยู่แล้ว)
  - ชื่อ App Service (เช่น: voicebot-dashboard-api)

AZURE_RESOURCE_GROUP (optional - มี default อยู่แล้ว)
  - ชื่อ Resource Group (เช่น: rg-voicebot-backend)
```

### 2. Push Code ไป GitHub

```bash
git add .
git commit -m "Update backend code"
git push origin main
```

### 3. ดูผลลัพธ์

- ไปที่ GitHub Repository → Actions tab
- จะเห็น workflow กำลังทำงาน
- รอให้เสร็จ (ประมาณ 5-10 นาที)
- ตรวจสอบว่า deploy สำเร็จหรือไม่

## 🔄 Workflow Flow

```
Developer pushes code
        ↓
GitHub detects change in backend/
        ↓
GitHub Actions starts
        ↓
1. Checkout code
2. Setup Python
3. Login to Azure
4. Build Docker image → Push to ACR
5. Deploy to Azure App Service
        ↓
✅ Deploy สำเร็จ!
```

## ⚙️ ตั้งค่าเพิ่มเติม

### ถ้าต้องการ deploy แบบ manual

แก้ไขไฟล์ `.github/workflows/azure-deploy.yml`:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:  # ← เพิ่มบรรทัดนี้
```

แล้วจะสามารถกดปุ่ม "Run workflow" ใน GitHub Actions ได้

### ถ้าต้องการ deploy branch อื่น

แก้ไข:

```yaml
on:
  push:
    branches:
      - main
      - staging  # ← เพิ่ม branch ที่ต้องการ
```

## 🚨 Troubleshooting

### ปัญหา: Workflow fail ที่ "Login to Azure"
**แก้ไข:** ตรวจสอบว่า `AZURE_CREDENTIALS` secret ถูกต้อง

### ปัญหา: Workflow fail ที่ "Build Docker image"
**แก้ไข:** ตรวจสอบว่า `AZURE_ACR_NAME` ถูกต้อง และมีสิทธิ์ push

### ปัญหา: Workflow fail ที่ "Deploy to Azure App Service"
**แก้ไข:** ตรวจสอบว่า App Service name และ Resource Group ถูกต้อง

## 📊 ดู Logs

1. ไปที่ GitHub Repository → Actions
2. คลิก workflow run ที่ต้องการ
3. คลิก job ที่ต้องการ
4. จะเห็น logs ทุกขั้นตอน

## 💡 Tips

1. **ทดสอบ workflow ก่อน:** ใช้ `workflow_dispatch` เพื่อทดสอบ manual
2. **ตรวจสอบ logs:** ถ้า fail ให้ดู logs เพื่อหาสาเหตุ
3. **ใช้ staging environment:** สร้าง workflow แยกสำหรับ staging และ production

## 🎯 สรุป

GitHub Actions = **ผู้ช่วยอัตโนมัติ** ที่จะ:
- Build Docker image ให้
- Push ไป ACR ให้
- Deploy ไป Azure App Service ให้

**คุณแค่ push code ไป GitHub แล้วระบบจะทำให้อัตโนมัติ!** 🚀

