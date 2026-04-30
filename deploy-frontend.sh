#!/bin/bash

# Frontend Deployment Script
# Deploy React/Vite frontend to Azure App Service

set -e  # Exit on error

echo "🚀 Starting Frontend Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="RG-SCGLDATAANALYTICS-DEV"
APP_NAME="app-scgjwdvoicebot-webfrontend-dev"
PROJECT_DIR="/Users/supisara/Documents/LCC_voicebot_frontend"

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Step 1: Checking prerequisites...${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 2: Check environment variables
echo -e "${YELLOW}📋 Step 2: Checking environment variables...${NC}"

cd "$PROJECT_DIR"

if [ ! -f "local.env" ]; then
    echo -e "${RED}❌ local.env file not found${NC}"
    exit 1
fi

# Check if VITE_API_BASE_URL is set
if ! grep -q "VITE_API_BASE_URL" local.env; then
    echo -e "${RED}❌ VITE_API_BASE_URL not found in local.env${NC}"
    exit 1
fi

API_BASE_URL=$(grep "VITE_API_BASE_URL" local.env | cut -d '=' -f2)
echo -e "${GREEN}✅ VITE_API_BASE_URL: $API_BASE_URL${NC}"

# Step 3: Install dependencies (if needed)
echo -e "${YELLOW}📋 Step 3: Installing dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo -e "${GREEN}✅ node_modules exists, skipping install${NC}"
fi

# Step 4: Build frontend
echo -e "${YELLOW}📋 Step 4: Building frontend...${NC}"

# Vite will read environment variables from local.env or .env
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist folder not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Step 5: Copy web.config to dist folder (for SPA routing)
echo -e "${YELLOW}📋 Step 5: Copying web.config to dist folder...${NC}"

if [ -f "web.config" ]; then
    cp web.config dist/
    echo -e "${GREEN}✅ web.config copied${NC}"
else
    echo -e "${YELLOW}⚠️  web.config not found, but continuing...${NC}"
fi

# Step 6: Create zip file
echo -e "${YELLOW}📋 Step 6: Creating deployment package...${NC}"

cd dist
zip -r ../dist.zip . > /dev/null
cd ..

echo -e "${GREEN}✅ dist.zip created${NC}"

# Step 7: Deploy to Azure
echo -e "${YELLOW}📋 Step 7: Deploying to Azure App Service...${NC}"

az webapp deployment source config-zip \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src dist.zip

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}🌐 Frontend URL: https://${APP_NAME}.azurewebsites.net${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Open https://${APP_NAME}.azurewebsites.net in your browser"
    echo "2. Check browser console for any errors"
    echo "3. Test the phone call feature"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Deployment completed!${NC}"
