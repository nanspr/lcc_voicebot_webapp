# Frontend Deployment Guide - Azure App Service

คู่มือการ deploy React/Vite frontend ไปยัง Azure App Service

## 📋 Prerequisites

1. Azure CLI ติดตั้งแล้ว (`az --version`)
2. Node.js และ npm ติดตั้งแล้ว
3. Azure subscription และสิทธิ์ในการ deploy

## 🎯 ข้อมูล App Service

- **App Service Name:** `app-scgjwdvoicebot-webfrontend-dev`
- **Resource Group:** `RG-SCGLDATAANALYTICS-DEV`

## 📝 ขั้นตอนการ Deploy

### วิธีที่ 1: Deploy Static Files (แนะนำ - ง่ายที่สุด)

#### Step 1: Build Frontend

```bash
# 1. ไปที่ root directory ของโปรเจกต์
cd /Users/supisara/Documents/LCC_voicebot_frontend

# 2. สร้างไฟล์ .env สำหรับ production (ถ้ายังไม่มี)
# หรือแก้ไข local.env ให้มีค่าที่ถูกต้องสำหรับ production

# 3. Build frontend (Vite จะ embed environment variables ใน build time)
npm run build
```

**หมายเหตุ:** 
- Vite จะอ่าน environment variables ที่ขึ้นต้นด้วย `VITE_` จาก `.env` หรือ `local.env`
- Environment variables จะถูก embed ใน JavaScript bundle ตอน build time
- **ต้อง build ใหม่ทุกครั้งที่เปลี่ยน environment variables**

#### Step 2: Deploy ไปที่ Azure App Service

**Option A: ใช้ Azure CLI (แนะนำ)**

```bash
# 1. Login to Azure
az login

# 2. Deploy dist folder ไปที่ App Service
az webapp deployment source config-zip \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --src dist.zip
```

**หรือใช้ `az webapp up` (ง่ายกว่า):**

```bash
# 1. ไปที่ root directory
cd /Users/supisara/Documents/LCC_voicebot_frontend

# 2. สร้าง zip file จาก dist folder
cd dist
zip -r ../dist.zip .
cd ..

# 3. Deploy
az webapp up \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --html
```

**Option B: ใช้ Azure Portal**

1. ไปที่ Azure Portal > App Service > `app-scgjwdvoicebot-webfrontend-dev`
2. ไปที่ **Deployment Center** > **Local Git** หรือ **FTP**
3. Upload ไฟล์ทั้งหมดใน `dist/` folder

**Option C: ใช้ VS Code Azure Extension**

1. ติดตั้ง Azure App Service extension ใน VS Code
2. Right-click ที่ `dist` folder > Deploy to Web App

#### Step 3: ตั้งค่า Static Site Configuration

```bash
# ตั้งค่าให้ App Service serve static files
az webapp config set \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --startup-file ""

# ตั้งค่า default documents
az webapp config set \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --default-documents index.html
```

#### Step 4: ตั้งค่า SPA Routing (สำคัญ!)

React Router ต้องการให้ทุก route ไปที่ `index.html`:

```bash
# สร้างไฟล์ web.config สำหรับ IIS (Windows App Service)
# หรือ .htaccess สำหรับ Linux App Service
```

**สำหรับ Linux App Service:** สร้างไฟล์ `staticwebapp.config.json` ใน `dist/` folder:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*"]
  }
}
```

**สำหรับ Windows App Service:** สร้างไฟล์ `web.config` ใน `dist/` folder:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".woff" mimeType="application/font-woff" />
      <mimeMap fileExtension=".woff2" mimeType="application/font-woff2" />
    </staticContent>
    <defaultDocument>
      <files>
        <clear />
        <add value="index.html" />
      </files>
    </defaultDocument>
    <httpErrors errorMode="Detailed" />
  </system.webServer>
</configuration>
```

**หมายเหตุ:** ไฟล์ `web.config` ถูกสร้างไว้ใน root directory แล้ว ให้ copy ไปที่ `dist/` folder ก่อน deploy หรือ deploy ไปพร้อมกัน

### วิธีที่ 2: Deploy ด้วย Docker (ถ้าต้องการ control มากขึ้น)

#### Step 1: สร้าง Dockerfile สำหรับ Frontend

สร้างไฟล์ `Dockerfile` ใน root directory:

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build (Vite จะ embed environment variables)
# ต้อง set environment variables ก่อน build
ARG VITE_API_BASE_URL
ARG VITE_DASHBOARD_API
ARG VITE_INFORM_AGENT_API
ARG VITE_TTS_API
ARG VITE_PHONE_CALL_API
ARG VITE_DEFAULT_PHONE_NUMBER
ARG VITE_DEFAULT_PERSON_NAME
ARG VITE_X_API_KEY
ARG VITE_API_KEY
ARG VITE_INFORM_AGENT_USER
ARG VITE_INFORM_AGENT_PASS

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DASHBOARD_API=$VITE_DASHBOARD_API
ENV VITE_INFORM_AGENT_API=$VITE_INFORM_AGENT_API
ENV VITE_TTS_API=$VITE_TTS_API
ENV VITE_PHONE_CALL_API=$VITE_PHONE_CALL_API
ENV VITE_DEFAULT_PHONE_NUMBER=$VITE_DEFAULT_PHONE_NUMBER
ENV VITE_DEFAULT_PERSON_NAME=$VITE_DEFAULT_PERSON_NAME
ENV VITE_X_API_KEY=$VITE_X_API_KEY
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_INFORM_AGENT_USER=$VITE_INFORM_AGENT_USER
ENV VITE_INFORM_AGENT_PASS=$VITE_INFORM_AGENT_PASS

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

สร้างไฟล์ `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - redirect all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Step 2: Build และ Deploy Docker Image

```bash
# 1. Build image
docker build \
  --build-arg VITE_API_BASE_URL=https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net \
  --build-arg VITE_INFORM_AGENT_API=https://n8n.scgjwd.com/webhook/InformAgent \
  --build-arg VITE_TTS_API=https://voice-tts.botnoi.ai/scgjwd/api/doctts \
  --build-arg VITE_PHONE_CALL_API=http://188.166.254.121:8502/scgjwd/add-que \
  --build-arg VITE_DEFAULT_PHONE_NUMBER=60000 \
  --build-arg VITE_DEFAULT_PERSON_NAME="web app voicebot" \
  --build-arg VITE_X_API_KEY=Sh59yS363eb5tJJ9oA70CaOOLMVPA6m7vq72451mi7pS \
  --build-arg VITE_API_KEY=N1jRb6b6DHSineGWl3JENVnCaiDqOHve \
  --build-arg VITE_INFORM_AGENT_USER=voicebot_classify \
  --build-arg VITE_INFORM_AGENT_PASS=Voicebot@scgjwd \
  -t frontend:latest .

# 2. Tag และ push ไปที่ ACR (ถ้าใช้ ACR เดียวกับ backend)
az acr login --name acrscgjwddadev
docker tag frontend:latest acrscgjwddadev.azurecr.io/vb-frontend:latest
docker push acrscgjwddadev.azurecr.io/vb-frontend:latest

# 3. Update App Service
az webapp config container set \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --docker-custom-image-name acrscgjwddadev.azurecr.io/vb-frontend:latest \
  --docker-registry-server-url https://acrscgjwddadev.azurecr.io
```

## 🔧 Environment Variables สำหรับ Production

**สำคัญ:** Vite จะ embed environment variables ใน build time ดังนั้น:

1. **ต้อง build ใหม่ทุกครั้งที่เปลี่ยน environment variables**
2. **ไม่สามารถเปลี่ยน environment variables ใน runtime ได้** (ต่างจาก backend)

### Environment Variables ที่ต้องตั้งค่า:

```bash
VITE_API_BASE_URL=https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net
VITE_INFORM_AGENT_API=https://n8n.scgjwd.com/webhook/InformAgent
VITE_TTS_API=https://voice-tts.botnoi.ai/scgjwd/api/doctts
VITE_PHONE_CALL_API=http://188.166.254.121:8502/scgjwd/add-que
VITE_DEFAULT_PHONE_NUMBER=60000
VITE_DEFAULT_PERSON_NAME=web app voicebot
VITE_X_API_KEY=Sh59yS363eb5tJJ9oA70CaOOLMVPA6m7vq72451mi7pS
VITE_API_KEY=N1jRb6b6DHSineGWl3JENVnCaiDqOHve
VITE_INFORM_AGENT_USER=voicebot_classify
VITE_INFORM_AGENT_PASS=Voicebot@scgjwd
```

### วิธีตั้งค่า:

**Option 1: สร้างไฟล์ `.env.production`**

```bash
# สร้างไฟล์ .env.production ใน root directory
cp local.env .env.production

# แก้ไขค่าที่ต้องการเปลี่ยนสำหรับ production
# จากนั้น build
npm run build
```

**Option 2: ใช้ environment variables ตรงๆ**

```bash
VITE_API_BASE_URL=https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net \
npm run build
```

## ✅ Checklist ก่อน Deploy

- [ ] Environment variables ถูกต้องสำหรับ production
- [ ] Build สำเร็จ (`npm run build`)
- [ ] ไฟล์ใน `dist/` folder ครบถ้วน
- [ ] ตั้งค่า SPA routing (web.config หรือ staticwebapp.config.json)
- [ ] Test build locally (`npm run preview`)
- [ ] ตรวจสอบว่า API endpoints ถูกต้อง

## 🧪 ทดสอบหลัง Deploy

```bash
# 1. ตรวจสอบว่า App Service ทำงาน
az webapp show \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --query state

# 2. เปิด browser ไปที่
# https://app-scgjwdvoicebot-webfrontend-dev.azurewebsites.net

# 3. ตรวจสอบ logs
az webapp log tail \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev
```

## 🔄 การ Update Frontend

เมื่อต้องการ update frontend:

```bash
# 1. แก้ไข code
# 2. Build ใหม่
npm run build

# 3. Deploy ใหม่
cd dist
zip -r ../dist.zip .
cd ..
az webapp deployment source config-zip \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --name app-scgjwdvoicebot-webfrontend-dev \
  --src dist.zip
```

## ⚠️ ปัญหาที่พบบ่อย

### 1. 404 Error เมื่อ refresh หน้า

**สาเหตุ:** SPA routing ไม่ได้ตั้งค่า

**แก้ไข:** เพิ่ม `web.config` หรือ `staticwebapp.config.json` ตามที่อธิบายไว้ข้างต้น

### 2. Environment Variables ไม่ทำงาน

**สาเหตุ:** Vite จะ embed environment variables ตอน build time เท่านั้น

**แก้ไข:** Build ใหม่หลังจากเปลี่ยน environment variables

### 3. CORS Error

**สาเหตุ:** Backend ไม่ได้ตั้งค่า CORS ให้รองรับ frontend domain

**แก้ไข:** ตรวจสอบ CORS settings ใน backend `main.py`

## 📚 เอกสารเพิ่มเติม

- [Azure App Service Static Files](https://docs.microsoft.com/en-us/azure/app-service/configure-common)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Router Deployment](https://reactrouter.com/en/main/start/overview#deploying)

