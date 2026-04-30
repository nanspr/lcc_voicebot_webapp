# การ Deploy จาก MacBook Air M1 (Apple Silicon) ไปยัง Azure

## 🔴 ปัญหา: Architecture Mismatch

**MacBook Air M1** ใช้ **ARM64** architecture  
**Azure App Service** ต้องการ **AMD64 (x86_64)** architecture

ถ้า build image บน M1 โดยไม่ระบุ platform จะได้ **ARM64 image** ซึ่ง Azure App Service **ไม่สามารถรันได้**

---

## ✅ วิธีแก้ไข (3 วิธี)

### วิธีที่ 1: ใช้ Azure Container Registry Build (แนะนำที่สุด) ⭐

**ข้อดี:** Build บน Azure cloud อัตโนมัติได้ AMD64, ไม่ต้องใช้ Docker buildx

```bash
cd backend

# Build และ push ในคำสั่งเดียว (build บน Azure cloud = AMD64 อัตโนมัติ)
az acr build \
  --registry acrscgjwddadev \
  --image vb-backend:latest \
  --file Dockerfile \
  .
```

**นี่คือวิธีที่แนะนำที่สุด!** เพราะ:
- ✅ Build บน Azure cloud (ได้ AMD64 อัตโนมัติ)
- ✅ ไม่ต้อง setup Docker buildx
- ✅ เร็วกว่า (build บน cloud)
- ✅ ไม่กิน resources บน Mac

---

### วิธีที่ 2: ใช้ Docker buildx (สำหรับ build บน local)

#### Setup buildx (ครั้งแรกเท่านั้น)

```bash
# 1. สร้าง builder instance
docker buildx create --name multiarch --use

# 2. Inspect builder
docker buildx inspect --bootstrap
```

#### Build image สำหรับ AMD64

```bash
cd backend

# Login to ACR
az acr login --name acrscgjwddadev

# Build และ push สำหรับ AMD64
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t acrscgjwddadev.azurecr.io/vb-backend:latest \
  -f Dockerfile \
  .
```

**หมายเหตุ:** ต้องมี Docker Desktop และ buildx enabled

---

### วิธีที่ 3: ใช้ Docker build แบบธรรมดา (ไม่แนะนำ)

```bash
cd backend

# Build สำหรับ AMD64 (ใช้ emulation - ช้ามาก)
docker build \
  --platform linux/amd64 \
  -t acrscgjwddadev.azurecr.io/vb-backend:latest \
  .

# Push
az acr login --name acrscgjwddadev
docker push acrscgjwddadev.azurecr.io/vb-backend:latest
```

**ข้อเสีย:** ช้ามากเพราะต้อง emulate AMD64 บน ARM64

---

## 🔍 ตรวจสอบ Architecture ของ Image

### ตรวจสอบ image ใน ACR

```bash
# ดู manifest ของ image
az acr manifest show \
  --registry acrscgjwddadev \
  --name vb-backend:latest

# หรือใช้ Docker
docker manifest inspect acrscgjwddadev.azurecr.io/vb-backend:latest
```

### ตรวจสอบ image ที่ build บน local

```bash
# ดู architecture ของ image
docker inspect <image-name> | grep Architecture

# หรือ
docker image inspect <image-name> --format '{{.Architecture}}'
```

---

## 📋 Quick Start สำหรับ M1 Mac

### ใช้ Script (แนะนำ)

```bash
cd backend

# แก้ไข deploy-to-azure.sh ให้ใส่ RESOURCE_GROUP
nano deploy-to-azure.sh

# รัน script (จะใช้ az acr build ซึ่ง build บน cloud = AMD64 อัตโนมัติ)
./deploy-to-azure.sh
```

### หรือใช้คำสั่งเดียว

```bash
cd backend

az acr build \
  --registry acrscgjwddadev \
  --image vb-backend:latest \
  --file Dockerfile \
  .
```

---

## 🐛 Troubleshooting

### ปัญหา: "exec format error" หรือ "platform not supported"

**สาเหตุ:** Image เป็น ARM64 แต่ Azure ต้องการ AMD64

**แก้ไข:** ใช้ `az acr build` หรือ `docker buildx build --platform linux/amd64`

### ปัญหา: Docker buildx ไม่มี

**แก้ไข:**
```bash
# Docker Desktop บน M1 มี buildx อยู่แล้ว
# ถ้าไม่มี ให้ install Docker Desktop

# ตรวจสอบ
docker buildx version
```

### ปัญหา: Build ช้ามาก

**สาเหตุ:** ใช้ `docker build --platform linux/amd64` ซึ่งต้อง emulate

**แก้ไข:** ใช้ `az acr build` แทน (build บน cloud)

---

## 💡 Best Practices สำหรับ M1 Mac

1. **ใช้ `az acr build`** เสมอ (build บน cloud = AMD64 อัตโนมัติ)
2. **อย่าใช้ `docker build`** โดยตรง (จะได้ ARM64)
3. **ใช้ `docker buildx`** ถ้าต้องการ build บน local
4. **ตรวจสอบ architecture** ก่อน push

---

## 🔗 Related Commands

```bash
# ตรวจสอบ architecture ของ Mac
uname -m  # ควรได้ arm64

# ตรวจสอบ Docker platform
docker version

# ดู builder instances
docker buildx ls

# ใช้ builder
docker buildx use multiarch
```

---

## 📝 Summary

| วิธี | Platform | ความเร็ว | แนะนำ |
|------|----------|---------|-------|
| `az acr build` | AMD64 (อัตโนมัติ) | ⚡⚡⚡ เร็ว | ✅ แนะนำที่สุด |
| `docker buildx --platform linux/amd64` | AMD64 | ⚡⚡ ปานกลาง | ✅ ใช้ได้ |
| `docker build --platform linux/amd64` | AMD64 | ⚡ ช้ามาก | ❌ ไม่แนะนำ |
| `docker build` (ไม่ระบุ platform) | ARM64 | ⚡⚡⚡ เร็ว | ❌ ใช้ไม่ได้กับ Azure |

**สรุป: ใช้ `az acr build` เสมอ!** 🚀

