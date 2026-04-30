#!/bin/bash

# Script สำหรับตรวจสอบ Azure App Service Outbound IPs

APP_NAME="app-scgjwdvoicebot-webbackend-dev"
RESOURCE_GROUP=""  # ใส่ resource group ของคุณ

echo "🔍 Checking Azure App Service Outbound IPs..."
echo ""

if [ -z "$RESOURCE_GROUP" ]; then
    echo "⚠️  RESOURCE_GROUP is not set."
    read -p "Enter Resource Group name: " RESOURCE_GROUP
fi

echo "📋 App Service: $APP_NAME"
echo "📋 Resource Group: $RESOURCE_GROUP"
echo ""

# Get outbound IPs
echo "🌐 Outbound IP Addresses:"
OUTBOUND_IPS=$(az webapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query outboundIpAddresses -o tsv)

if [ -n "$OUTBOUND_IPS" ]; then
    echo "$OUTBOUND_IPS" | tr ',' '\n' | nl
    echo ""
    echo "📝 คุณต้อง whitelist IPs เหล่านี้ใน firewall ของ Phone Call API server"
    echo "   Phone Call API: http://188.166.254.121:8502"
    echo ""
else
    echo "❌ ไม่สามารถดึง outbound IPs ได้"
fi

# Get possible outbound IPs (if outbound IPs change)
echo "🌐 Possible Outbound IPs (if outbound IPs change):"
POSSIBLE_IPS=$(az webapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query possibleOutboundIpAddresses -o tsv)

if [ -n "$POSSIBLE_IPS" ]; then
    echo "$POSSIBLE_IPS" | tr ',' '\n' | nl
    echo ""
    echo "📝 คุณอาจต้อง whitelist IPs เหล่านี้ด้วย (ถ้า outbound IPs เปลี่ยน)"
fi

echo ""
echo "✅ ตรวจสอบเสร็จแล้ว!"
echo ""
echo "📋 Next steps:"
echo "   1. Whitelist IPs เหล่านี้ใน firewall ของ Phone Call API server (188.166.254.121)"
echo "   2. หรือตั้งค่า firewall ให้อนุญาตให้ Azure App Service เข้าถึงได้"
echo "   3. Deploy backend ใหม่และทดสอบอีกครั้ง"





