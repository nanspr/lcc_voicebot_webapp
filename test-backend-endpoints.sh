#!/bin/bash

# Test Backend Endpoints
BACKEND_URL="https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net"

echo "🔍 Testing Backend Endpoints..."
echo ""

# Test 1: Health check
echo "1. Testing health check endpoint..."
curl -s "$BACKEND_URL/" | head -20
echo ""
echo ""

# Test 2: List all routes (if FastAPI docs available)
echo "2. Testing FastAPI docs (should show all endpoints)..."
curl -s "$BACKEND_URL/docs" | grep -o '"/api/[^"]*"' | head -10
echo ""
echo ""

# Test 3: Test TTS endpoint
echo "3. Testing TTS endpoint..."
curl -X POST "$BACKEND_URL/api/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"ทดสอบ","speaker":"1","volume":1,"speed":1,"type_media":"wav","language":"th"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""
echo ""

# Test 4: Test Phone Call endpoint
echo "4. Testing Phone Call endpoint..."
curl -X POST "$BACKEND_URL/api/phone-call" \
  -H "Content-Type: application/json" \
  -d '{"number":"60000","message":"ทดสอบ","phone_number":"60000","prompt_id":3}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""
echo ""

echo "✅ Testing completed!"
