# Azure Deployment Guide

คู่มือการ deploy FastAPI backend ไปยัง Azure App Service

## Prerequisites

1. Azure CLI ติดตั้งแล้ว
2. Docker ติดตั้งแล้ว (ถ้าใช้ Container Registry)
3. Azure subscription

## วิธีที่ 1: Deploy ด้วย Azure Container Registry (ACR)

### 1. สร้าง Azure Container Registry

```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-voicebot-backend --location southeastasia

# Create Azure Container Registry
az acr create --resource-group rg-voicebot-backend \
  --name acrvoicebot \
  --sku Basic \
  --admin-enabled true
```

### 2. Build และ Push Docker Image

```bash
# Login to ACR
az acr login --name acrvoicebot

# Build image
cd backend
docker build -t acrvoicebot.azurecr.io/dashboard-api:latest .

# Push to ACR
docker push acrvoicebot.azurecr.io/dashboard-api:latest
```

### 3. สร้าง Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name plan-voicebot-backend \
  --resource-group rg-voicebot-backend \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --plan plan-voicebot-backend \
  --deployment-container-image-name acrvoicebot.azurecr.io/dashboard-api:latest

# Configure ACR credentials
az webapp config container set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --docker-custom-image-name acrvoicebot.azurecr.io/dashboard-api:latest \
  --docker-registry-server-url https://acrvoicebot.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name acrvoicebot --query username -o tsv) \
  --docker-registry-server-password $(az acr credential show --name acrvoicebot --query passwords[0].value -o tsv)
```

### 4. ตั้งค่า Environment Variables

```bash
az webapp config appsettings set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --settings \
    AZURE_SQL_SERVER="sql-scgllcc-prd.database.windows.net" \
    AZURE_SQL_DATABASE="sqldb-scgjwd-voicebot-prd" \
    AZURE_SQL_USER="your-username" \
    AZURE_SQL_PASSWORD="your-password" \
    AZURE_SQL_PORT="1433" \
    PORT="8000" \
    ENVIRONMENT="production"
```

### 5. เปิดใช้งาน Always On (แนะนำ)

```bash
az webapp config set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --always-on true
```

## วิธีที่ 2: Deploy ด้วย Azure App Service (Local Git)

### 1. สร้าง App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name plan-voicebot-backend \
  --resource-group rg-voicebot-backend \
  --sku B1 \
  --is-linux

# Create Web App with Python runtime
az webapp create \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --plan plan-voicebot-backend \
  --runtime "PYTHON:3.11"
```

### 2. ตั้งค่า Environment Variables

```bash
az webapp config appsettings set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --settings \
    AZURE_SQL_SERVER="sql-scgllcc-prd.database.windows.net" \
    AZURE_SQL_DATABASE="sqldb-scgjwd-voicebot-prd" \
    AZURE_SQL_USER="your-username" \
    AZURE_SQL_PASSWORD="your-password" \
    AZURE_SQL_PORT="1433" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

### 3. Deploy Code

```bash
# Get deployment URL
DEPLOYMENT_URL=$(az webapp deployment source show \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --query url -o tsv)

# Add remote and push
cd backend
git remote add azure $DEPLOYMENT_URL
git push azure main
```

## วิธีที่ 3: Deploy ด้วย GitHub Actions (CI/CD) - Optional

ถ้าต้องการใช้ GitHub Actions สำหรับ CI/CD สามารถสร้าง workflow ได้ตามตัวอย่างใน `GITHUB_ACTIONS_EXPLAINED.md`

**หมายเหตุ:** วิธีนี้เป็น optional ไม่จำเป็นต้องใช้ สามารถ deploy แบบ manual ด้วยวิธีที่ 1 หรือ 2 ได้

## ตรวจสอบการ Deploy

### 1. ตรวจสอบ Logs

```bash
az webapp log tail \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend
```

### 2. ทดสอบ API

```bash
# Get app URL
APP_URL=$(az webapp show \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --query defaultHostName -o tsv)

# Test health endpoint
curl https://$APP_URL/

# Test dashboard endpoint
curl https://$APP_URL/api/dashboard
```

## Security Best Practices

1. **ใช้ Azure Key Vault สำหรับ secrets:**
```bash
# Create Key Vault
az keyvault create \
  --name kv-voicebot-secrets \
  --resource-group rg-voicebot-backend \
  --location southeastasia

# Store secrets
az keyvault secret set \
  --vault-name kv-voicebot-secrets \
  --name azure-sql-password \
  --value "your-password"

# Reference in App Service
az webapp config appsettings set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --settings \
    AZURE_SQL_PASSWORD="@Microsoft.KeyVault(SecretUri=https://kv-voicebot-secrets.vault.azure.net/secrets/azure-sql-password/)"
```

2. **ตั้งค่า CORS ให้เฉพาะ domain ที่ต้องการ:**
   - แก้ไข `allow_origins` ใน `main.py` ให้เป็น domain ที่ต้องการ

3. **ใช้ Managed Identity สำหรับ Azure SQL:**
   - ใช้ Azure AD authentication แทน username/password

## Troubleshooting

### ปัญหา: Connection timeout
- ตรวจสอบว่า Azure SQL firewall อนุญาตให้ App Service IP
- ใช้ "Allow Azure services and resources to access this server"

### ปัญหา: ODBC Driver not found
- ตรวจสอบว่า Dockerfile ติดตั้ง msodbcsql18 แล้ว
- ตรวจสอบ logs: `az webapp log tail`

### ปัญหา: Port binding
- Azure App Service ใช้ PORT environment variable
- ตรวจสอบว่า CMD ใน Dockerfile ใช้ `${PORT:-8000}`

## Cost Optimization

1. ใช้ App Service Plan B1 (Basic) สำหรับ development
2. ใช้ Always On = false สำหรับ non-production (ประหยัด cost)
3. ใช้ Auto-scaling สำหรับ production

## Monitoring

1. เปิดใช้งาน Application Insights:
```bash
az monitor app-insights component create \
  --app voicebot-dashboard-api \
  --location southeastasia \
  --resource-group rg-voicebot-backend

# Link to App Service
az webapp config appsettings set \
  --name voicebot-dashboard-api \
  --resource-group rg-voicebot-backend \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY="your-instrumentation-key"
```

