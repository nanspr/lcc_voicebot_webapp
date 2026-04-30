#!/bin/bash

# Script สำหรับตรวจสอบว่า backend endpoints ทำงานหรือไม่

BACKEND_URL="https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net"
RESOURCE_GROUP=""  # ใส่ resource group ของคุณ
APP_NAME="app-scgjwdvoicebot-webbackend-dev"

echo "🔍 Checking Backend Deployment..."
echo ""

# 1. Test health check
echo "1. Testing health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/")
if [ "$HEALTH" == "200" ]; then
    echo "   ✅ Health check: OK ($HEALTH)"
else
    echo "   ❌ Health check: FAILED ($HEALTH)"
fi
echo ""

# 2. Test TTS endpoint
echo "2. Testing TTS endpoint (/api/tts)..."
TTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"ทดสอบ","speaker":"1","volume":1,"speed":1,"type_media":"wav","language":"th"}')
if [ "$TTS_RESPONSE" == "200" ] || [ "$TTS_RESPONSE" == "502" ] || [ "$TTS_RESPONSE" == "500" ]; then
    echo "   ✅ TTS endpoint exists ($TTS_RESPONSE) - endpoint is registered!"
    echo "   (502/500 means endpoint exists but may have config issues)"
else
    echo "   ❌ TTS endpoint: NOT FOUND ($TTS_RESPONSE)"
fi
echo ""

# 3. Test Phone Call endpoint
echo "3. Testing Phone Call endpoint (/api/phone-call)..."
CALL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/phone-call" \
  -H "Content-Type: application/json" \
  -d '{"number":"60000","message":"ทดสอบ","phone_number":"60000","prompt_id":3}')
if [ "$CALL_RESPONSE" == "200" ] || [ "$CALL_RESPONSE" == "502" ] || [ "$CALL_RESPONSE" == "500" ]; then
    echo "   ✅ Phone Call endpoint exists ($CALL_RESPONSE) - endpoint is registered!"
    echo "   (502/500 means endpoint exists but may have config issues)"
else
    echo "   ❌ Phone Call endpoint: NOT FOUND ($CALL_RESPONSE)"
fi
echo ""

# 4. Check FastAPI docs
echo "4. Checking FastAPI docs..."
DOCS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/docs")
if [ "$DOCS" == "200" ]; then
    echo "   ✅ FastAPI docs available: $BACKEND_URL/docs"
    echo "   📝 You can check all endpoints there"
else
    echo "   ⚠️  FastAPI docs not available ($DOCS)"
fi
echo ""

# 5. Check if App Service needs restart
if [ -n "$RESOURCE_GROUP" ]; then
    echo "5. Checking App Service status..."
    STATE=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query state -o tsv 2>/dev/null)
    if [ -n "$STATE" ]; then
        echo "   App Service State: $STATE"
        if [ "$STATE" != "Running" ]; then
            echo "   ⚠️  App Service is not running! Restarting..."
            az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"
        fi
    fi
fi
echo ""

echo "📋 Summary:"
echo "   - If endpoints return 404, the code may not be deployed correctly"
echo "   - If endpoints return 502/500, check environment variables"
echo "   - Visit $BACKEND_URL/docs to see all available endpoints"
echo ""





