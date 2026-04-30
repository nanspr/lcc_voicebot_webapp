#!/bin/bash

# Script สำหรับ deploy backend ใหม่และ restart App Service

set -e

ACR_NAME="acrscgjwddadev"
IMAGE_NAME="vb-backend"
IMAGE_TAG="latest"
APP_NAME="app-scgjwdvoicebot-webbackend-dev"
RESOURCE_GROUP=""  # ใส่ resource group ของคุณ

echo "🚀 Backend Deployment Fix Script"
echo ""

# Check if resource group is set
if [ -z "$RESOURCE_GROUP" ]; then
    echo "⚠️  RESOURCE_GROUP is not set."
    echo "Please set it as environment variable:"
    echo "  export RESOURCE_GROUP=your-resource-group-name"
    echo ""
    read -p "Enter Resource Group name: " RESOURCE_GROUP
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Step 1: Building and pushing new image to ACR..."
echo "   This will build the image with the latest code including /api/tts and /api/phone-call endpoints"
echo ""

# Build and push using ACR build
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$IMAGE_TAG \
  --file Dockerfile \
  . || {
    echo "❌ Failed to build and push image"
    exit 1
  }

echo ""
echo "✅ Image built and pushed successfully!"
echo ""

# Verify image exists
echo "🔍 Step 2: Verifying image in ACR..."
az acr repository show-tags \
  --name $ACR_NAME \
  --repository $IMAGE_NAME \
  --output table
echo ""

# Update App Service to use new image
echo "🔧 Step 3: Updating App Service container configuration..."
az webapp config container set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --output none || {
    echo "⚠️  Failed to update container config. Trying with admin credentials..."
    
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

echo "✅ Container configuration updated!"
echo ""

# Restart App Service (IMPORTANT!)
echo "🔄 Step 4: Restarting App Service (this is critical!)..."
az webapp restart \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

echo "✅ App Service restarted!"
echo ""

# Wait a bit for the service to start
echo "⏳ Waiting 10 seconds for service to start..."
sleep 10

# Test endpoints
echo "🧪 Step 5: Testing endpoints..."
echo ""

BACKEND_URL="https://$APP_NAME.azurewebsites.net"

# Test health check
echo "Testing health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/")
if [ "$HEALTH" == "200" ]; then
    echo "   ✅ Health check: OK"
else
    echo "   ❌ Health check: FAILED ($HEALTH)"
fi

# Test TTS endpoint
echo "Testing TTS endpoint..."
TTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"ทดสอบ","speaker":"1","volume":1,"speed":1,"type_media":"wav","language":"th"}')
if [ "$TTS_RESPONSE" == "200" ] || [ "$TTS_RESPONSE" == "502" ] || [ "$TTS_RESPONSE" == "500" ]; then
    echo "   ✅ TTS endpoint: EXISTS ($TTS_RESPONSE)"
    echo "   (502/500 means endpoint exists but may need env vars)"
else
    echo "   ❌ TTS endpoint: NOT FOUND ($TTS_RESPONSE)"
    echo "   ⚠️  Endpoint may not be deployed correctly"
fi

# Test Phone Call endpoint
echo "Testing Phone Call endpoint..."
CALL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/phone-call" \
  -H "Content-Type: application/json" \
  -d '{"number":"60000","message":"ทดสอบ","phone_number":"60000","prompt_id":3}')
if [ "$CALL_RESPONSE" == "200" ] || [ "$CALL_RESPONSE" == "502" ] || [ "$CALL_RESPONSE" == "500" ]; then
    echo "   ✅ Phone Call endpoint: EXISTS ($CALL_RESPONSE)"
    echo "   (502/500 means endpoint exists but may need env vars)"
else
    echo "   ❌ Phone Call endpoint: NOT FOUND ($CALL_RESPONSE)"
    echo "   ⚠️  Endpoint may not be deployed correctly"
fi

echo ""
echo "📋 Summary:"
echo "   - Image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
echo "   - App Service: $APP_NAME"
echo "   - Resource Group: $RESOURCE_GROUP"
echo ""
echo "📝 Next steps:"
echo "   1. Check logs: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo "   2. Check FastAPI docs: $BACKEND_URL/docs"
echo "   3. Verify environment variables are set correctly"
echo ""
echo "✅ Deployment completed!"











