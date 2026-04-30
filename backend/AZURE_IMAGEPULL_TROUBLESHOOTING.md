# Azure App Service ImagePullFailure - แก้ไขปัญหา

## 🔴 ปัญหา: ImagePullFailure

```
Container pull image failed with reason: ImagePullFailure
Pulling image: acrscgjwddadev.azurecr.io/vb-backend:latest
```

## 🔍 สาเหตุที่เป็นไปได้

### 1. Image ไม่มีใน ACR (สาเหตุที่พบบ่อยที่สุด)
- Image ยังไม่ได้ push ไปยัง ACR
- Image name หรือ tag ไม่ถูกต้อง

### 2. Authentication Issue
- App Service ไม่มีสิทธิ์เข้าถึง ACR
- ACR credentials ไม่ถูกต้อง
- Managed Identity ไม่ได้ configure

### 3. Architecture Mismatch (M1 Mac / Apple Silicon) ⚠️
- **MacBook Air M1** build image เป็น **ARM64** แต่ Azure ต้องการ **AMD64**
- Image architecture ไม่ตรงกับ Azure App Service requirements
- **สาเหตุที่พบบ่อยบน M1 Mac!**

### 4. Network/Firewall Issue
- ACR firewall block App Service
- Network configuration ไม่ถูกต้อง

---

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบว่า Image มีใน ACR หรือไม่

```bash
# Login to ACR
az acr login --name acrscgjwddadev

# ตรวจสอบ images ใน ACR
az acr repository list --name acrscgjwddadev --output table

# ตรวจสอบ tags ของ image
az acr repository show-tags --name acrscgjwddadev --repository vb-backend --output table
```

**ถ้า image ไม่มี:** ต้อง build และ push image ก่อน

---

### ขั้นตอนที่ 2: Build และ Push Image ไปยัง ACR

#### วิธีที่ 1: ใช้ Azure CLI (แนะนำที่สุด - โดยเฉพาะ M1 Mac) ⭐

```bash
cd backend

# Build และ push ในคำสั่งเดียว
# ⚠️ สำคัญ: az acr build จะ build บน Azure cloud = ได้ AMD64 อัตโนมัติ
# Perfect สำหรับ M1 Mac (Apple Silicon) - ไม่ต้องใช้ buildx
az acr build \
  --registry acrscgjwddadev \
  --image vb-backend:latest \
  --file Dockerfile \
  .
```

**ทำไมแนะนำสำหรับ M1 Mac:**
- ✅ Build บน Azure cloud = ได้ AMD64 architecture อัตโนมัติ
- ✅ ไม่ต้อง setup Docker buildx
- ✅ เร็วกว่า (build บน cloud)
- ✅ ไม่กิน resources บน Mac

#### วิธีที่ 2: Build และ Push แยก

```bash
cd backend

# 1. Login to ACR
az acr login --name acrscgjwddadev

# 2. Build image
docker build -t acrscgjwddadev.azurecr.io/vb-backend:latest .

# 3. Push image
docker push acrscgjwddadev.azurecr.io/vb-backend:latest
```

#### วิธีที่ 3: ใช้ Docker buildx (สำหรับ build บน local - M1 Mac)

**Setup buildx (ครั้งแรกเท่านั้น):**
```bash
# สร้าง builder instance
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap
```

**Build และ push:**
```bash
cd backend

# Login to ACR
az acr login --name acrscgjwddadev

# Build สำหรับ AMD64 (สำคัญสำหรับ M1 Mac!)
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t acrscgjwddadev.azurecr.io/vb-backend:latest \
  -f Dockerfile \
  .
```

**⚠️ หมายเหตุสำหรับ M1 Mac:**
- ต้องระบุ `--platform linux/amd64` เสมอ
- ถ้าไม่ระบุ จะได้ ARM64 image ซึ่ง Azure ไม่รองรับ
- หรือใช้ `az acr build` แทน (แนะนำกว่า)

---

### ขั้นตอนที่ 3: ตั้งค่า App Service ให้เข้าถึง ACR

#### วิธีที่ 1: ใช้ Admin Credentials (ง่าย แต่ไม่ปลอดภัย)

```bash
# 1. เปิดใช้งาน admin user
az acr update --name acrscgjwddadev --admin-enabled true

# 2. ดึง username และ password
ACR_USERNAME=$(az acr credential show --name acrscgjwddadev --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name acrscgjwddadev --query passwords[0].value -o tsv)

# 3. ตั้งค่า App Service container settings
az webapp config container set \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group> \
  --docker-custom-image-name acrscgjwddadev.azurecr.io/vb-backend:latest \
  --docker-registry-server-url https://acrscgjwddadev.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD
```

#### วิธีที่ 2: ใช้ Managed Identity (แนะนำ - ปลอดภัยกว่า)

```bash
# 1. เปิดใช้งาน Managed Identity
az webapp identity assign \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>

# 2. ดู Principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group> \
  --query principalId -o tsv)

# 3. ให้สิทธิ์ App Service เข้าถึง ACR
ACR_ID=$(az acr show \
  --name acrscgjwddadev \
  --resource-group <your-resource-group> \
  --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull

# 4. ตั้งค่า App Service container settings (ไม่ต้องใส่ credentials)
az webapp config container set \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group> \
  --docker-custom-image-name acrscgjwddadev.azurecr.io/vb-backend:latest \
  --docker-registry-server-url https://acrscgjwddadev.azurecr.io
```

---

### ขั้นตอนที่ 4: ตรวจสอบ ACR Firewall Settings

```bash
# ตรวจสอบ firewall settings
az acr show \
  --name acrscgjwddadev \
  --resource-group <your-resource-group> \
  --query networkRuleSet

# ถ้า firewall เปิดอยู่ ต้องเพิ่ม App Service outbound IPs
# หรือเปิด "Allow Azure services" (แนะนำ)
az acr update \
  --name acrscgjwddadev \
  --default-action Allow
```

---

## 🔧 Quick Fix Script

สร้างไฟล์ `deploy-to-azure.sh`:

```bash
#!/bin/bash

# Configuration
ACR_NAME="acrscgjwddadev"
IMAGE_NAME="vb-backend"
APP_NAME="app-scgjwdvoicebot-webbackend-dev"
RESOURCE_GROUP="<your-resource-group>"

echo "🔨 Building and pushing image to ACR..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:latest \
  --file backend/Dockerfile \
  ./backend

echo "✅ Image pushed successfully!"

echo "🔧 Configuring App Service..."
az webapp config container set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io

echo "✅ App Service configured!"
echo "🚀 Restarting App Service..."
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP

echo "✅ Done! Check logs: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
```

---

## 📋 Checklist

- [ ] Image มีใน ACR (`az acr repository show-tags`)
- [ ] Image name และ tag ถูกต้อง
- [ ] App Service มีสิทธิ์เข้าถึง ACR (credentials หรือ Managed Identity)
- [ ] ACR firewall อนุญาตให้ App Service เข้าถึง
- [ ] Container settings ใน App Service ถูกต้อง
- [ ] Environment variables ตั้งค่าแล้ว

---

## 🐛 Debug Commands

```bash
# ดู container settings
az webapp config container show \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>

# ดู logs
az webapp log tail \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>

# Test pull image จาก local
az acr login --name acrscgjwddadev
docker pull acrscgjwddadev.azurecr.io/vb-backend:latest

# ตรวจสอบ ACR access
az acr repository list --name acrscgjwddadev
```

---

## 💡 Best Practices

1. **ใช้ Managed Identity** แทน admin credentials
2. **Tag images** ด้วย version numbers (ไม่ใช่แค่ `latest`)
3. **เปิด "Allow Azure services"** ใน ACR firewall
4. **ใช้ staging slots** สำหรับ testing ก่อน deploy production
5. **Monitor logs** หลัง deploy

---

## 🔗 Related Commands

```bash
# ดู App Service details
az webapp show \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>

# Restart App Service
az webapp restart \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>

# ดู deployment history
az webapp deployment list-publishing-profiles \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group <your-resource-group>
```

