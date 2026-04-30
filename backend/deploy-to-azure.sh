#!/bin/bash

# Azure Deployment Script for Backend
# สคริปต์สำหรับ build และ push Docker image ไปยัง Azure Container Registry

set -e

# Configuration - แก้ไขตาม environment ของคุณ
ACR_NAME="acrscgjwddadev"
IMAGE_NAME="vb-backend"
IMAGE_TAG="latest"
APP_NAME="app-scgjwdvoicebot-webbackend-dev"
RESOURCE_GROUP=""  # ใส่ resource group name ของคุณ

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Azure Backend Deployment Script${NC}"
echo ""

# Check if resource group is set
if [ -z "$RESOURCE_GROUP" ]; then
    echo -e "${YELLOW}⚠️  RESOURCE_GROUP is not set. Please edit this script and set RESOURCE_GROUP variable.${NC}"
    echo ""
    echo "Or set it as environment variable:"
    echo "  export RESOURCE_GROUP=your-resource-group-name"
    echo ""
    read -p "Enter Resource Group name (or press Enter to skip App Service config): " RESOURCE_GROUP
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo "🔐 Checking Azure login..."
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Logging in...${NC}"
    az login
fi

echo -e "${GREEN}✅ Logged in to Azure${NC}"
echo ""

# Step 1: Build and push image to ACR
echo "🔨 Step 1: Building and pushing image to ACR..."
echo "   ACR: $ACR_NAME"
echo "   Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build and push using ACR build (recommended)
# This builds on Azure cloud, automatically gets AMD64 architecture
# Perfect for M1 Mac (Apple Silicon) - no need for buildx or emulation
echo "📦 Building image on Azure cloud (AMD64 architecture)..."
echo "   Note: This is especially important for M1 Mac users!"
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$IMAGE_TAG \
  --file Dockerfile \
  . || {
    echo -e "${RED}❌ Failed to build and push image${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if you're logged in: az account show"
    echo "  2. Check ACR name: az acr list"
    echo "  3. Check permissions: az acr show --name $ACR_NAME"
    exit 1
  }

echo -e "${GREEN}✅ Image built and pushed successfully!${NC}"
echo ""

# Step 2: Verify image exists
echo "🔍 Step 2: Verifying image in ACR..."
az acr repository show-tags \
  --name $ACR_NAME \
  --repository $IMAGE_NAME \
  --output table || {
    echo -e "${YELLOW}⚠️  Could not verify image tags${NC}"
  }
echo ""

# Step 3: Configure App Service (if resource group is set)
if [ -n "$RESOURCE_GROUP" ]; then
    echo "🔧 Step 3: Configuring App Service..."
    echo "   App Name: $APP_NAME"
    echo "   Resource Group: $RESOURCE_GROUP"
    echo ""
    
    # Check if App Service exists
    if az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        echo "📝 Updating container settings..."
        
        # Try to use Managed Identity first
        echo "   Attempting to use Managed Identity..."
        
        # Enable Managed Identity if not already enabled
        IDENTITY=$(az webapp identity show \
          --name $APP_NAME \
          --resource-group $RESOURCE_GROUP \
          --query principalId -o tsv 2>/dev/null || echo "")
        
        if [ -z "$IDENTITY" ]; then
            echo "   Enabling Managed Identity..."
            az webapp identity assign \
              --name $APP_NAME \
              --resource-group $RESOURCE_GROUP
            
            IDENTITY=$(az webapp identity show \
              --name $APP_NAME \
              --resource-group $RESOURCE_GROUP \
              --query principalId -o tsv)
        fi
        
        # Grant ACR pull permission
        if [ -n "$IDENTITY" ]; then
            echo "   Granting ACR pull permission to Managed Identity..."
            ACR_ID=$(az acr show \
              --name $ACR_NAME \
              --resource-group $RESOURCE_GROUP \
              --query id -o tsv 2>/dev/null || echo "")
            
            if [ -n "$ACR_ID" ]; then
                az role assignment create \
                  --assignee $IDENTITY \
                  --scope $ACR_ID \
                  --role AcrPull \
                  --output none 2>/dev/null || echo "   (Permission may already exist)"
            fi
        fi
        
        # Update container settings
        echo "   Updating container configuration..."
        az webapp config container set \
          --name $APP_NAME \
          --resource-group $RESOURCE_GROUP \
          --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
          --docker-registry-server-url https://$ACR_NAME.azurecr.io \
          --output none || {
            echo -e "${YELLOW}⚠️  Failed to update container settings. Trying with admin credentials...${NC}"
            
            # Fallback to admin credentials
            ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
            ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
            
            az webapp config container set \
              --name $APP_NAME \
              --resource-group $RESOURCE_GROUP \
              --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
              --docker-registry-server-url https://$ACR_NAME.azurecr.io \
              --docker-registry-server-user $ACR_USERNAME \
              --docker-registry-server-password $ACR_PASSWORD \
              --output none
          }
        
        echo -e "${GREEN}✅ App Service configured!${NC}"
        echo ""
        
        # Step 4: Restart App Service
        echo "🔄 Step 4: Restarting App Service..."
        az webapp restart \
          --name $APP_NAME \
          --resource-group $RESOURCE_GROUP \
          --output none
        
        echo -e "${GREEN}✅ App Service restarted!${NC}"
        echo ""
        
        echo -e "${GREEN}📋 Deployment Summary:${NC}"
        echo "   Image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
        echo "   App Service: $APP_NAME"
        echo "   Resource Group: $RESOURCE_GROUP"
        echo ""
        echo "📝 Next steps:"
        echo "   1. Check logs: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
        echo "   2. Check status: az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query state"
        echo ""
    else
        echo -e "${YELLOW}⚠️  App Service '$APP_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
        echo "   Skipping App Service configuration."
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  RESOURCE_GROUP not set. Skipping App Service configuration.${NC}"
    echo ""
    echo "To configure App Service manually, run:"
    echo "  az webapp config container set \\"
    echo "    --name $APP_NAME \\"
    echo "    --resource-group <your-resource-group> \\"
    echo "    --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \\"
    echo "    --docker-registry-server-url https://$ACR_NAME.azurecr.io"
    echo ""
fi

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "🔗 Useful commands:"
echo "   View logs: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo "   Check status: az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo "   List images: az acr repository show-tags --name $ACR_NAME --repository $IMAGE_NAME"
echo ""

