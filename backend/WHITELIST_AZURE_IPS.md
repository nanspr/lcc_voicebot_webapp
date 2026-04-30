# Whitelist Azure App Service IPs สำหรับ Phone Call API

## Azure App Service Outbound IPs

### Current Outbound IPs (ปัจจุบัน)
ต้อง whitelist IPs เหล่านี้ใน firewall ของ Phone Call API server (`188.166.254.121:8502`):

```
20.43.151.156
20.43.151.243
20.44.216.95
20.44.216.107
20.44.216.134
20.44.216.176
20.43.132.130
```

### Possible Outbound IPs (แนะนำให้ whitelist ทั้งหมด)
⚠️ **สำคัญ**: Azure App Service outbound IPs อาจเปลี่ยนได้ ดังนั้นแนะนำให้ whitelist **Possible Outbound IPs ทั้งหมด**:

```
20.43.132.130
20.43.145.81
20.43.147.13
20.43.147.49
20.43.149.197
20.43.149.214
20.43.149.230
20.43.149.47
20.43.150.121
20.43.150.255
20.43.150.35
20.43.150.89
20.43.151.118
20.43.151.156
20.43.151.243
20.43.165.24
20.43.166.112
20.43.166.148
20.43.166.158
20.43.166.172
20.43.166.176
20.44.216.107
20.44.216.134
20.44.216.176
20.44.216.95
```

**แนะนำ**: Whitelist IPs ทั้งหมดใน Possible Outbound IPs เพื่อป้องกันปัญหาเมื่อ outbound IPs เปลี่ยน

## วิธี Whitelist

### 1. ถ้า Phone Call API Server ใช้ Linux (iptables)

```bash
# SSH เข้าไปที่ Phone Call API server (188.166.254.121)
ssh user@188.166.254.121

# Whitelist Azure IPs (แนะนำให้ whitelist ทั้งหมด)
AZURE_IPS=(
  "20.43.132.130"
  "20.43.145.81"
  "20.43.147.13"
  "20.43.147.49"
  "20.43.149.197"
  "20.43.149.214"
  "20.43.149.230"
  "20.43.149.47"
  "20.43.150.121"
  "20.43.150.255"
  "20.43.150.35"
  "20.43.150.89"
  "20.43.151.118"
  "20.43.151.156"
  "20.43.151.243"
  "20.43.165.24"
  "20.43.166.112"
  "20.43.166.148"
  "20.43.166.158"
  "20.43.166.172"
  "20.43.166.176"
  "20.44.216.107"
  "20.44.216.134"
  "20.44.216.176"
  "20.44.216.95"
)

for ip in "${AZURE_IPS[@]}"; do
  sudo iptables -A INPUT -p tcp --dport 8502 -s "$ip" -j ACCEPT
done

# Save iptables rules (ถ้าใช้ Ubuntu/Debian)
sudo iptables-save > /etc/iptables/rules.v4

# หรือถ้าใช้ CentOS/RHEL
sudo service iptables save
```

### 2. ถ้า Phone Call API Server ใช้ Windows Firewall

```powershell
# เปิด PowerShell as Administrator
# Whitelist Azure IPs (แนะนำให้ whitelist ทั้งหมด)
$azureIPs = @(
  "20.43.132.130", "20.43.145.81", "20.43.147.13", "20.43.147.49",
  "20.43.149.197", "20.43.149.214", "20.43.149.230", "20.43.149.47",
  "20.43.150.121", "20.43.150.255", "20.43.150.35", "20.43.150.89",
  "20.43.151.118", "20.43.151.156", "20.43.151.243", "20.43.165.24",
  "20.43.166.112", "20.43.166.148", "20.43.166.158", "20.43.166.172",
  "20.43.166.176", "20.44.216.107", "20.44.216.134", "20.44.216.176",
  "20.44.216.95"
)

$counter = 1
foreach ($ip in $azureIPs) {
  New-NetFirewallRule -DisplayName "Allow Azure App Service $counter" `
    -Direction Inbound -RemoteAddress $ip -Protocol TCP -LocalPort 8502 -Action Allow
  $counter++
}
```

### 3. ถ้า Phone Call API Server อยู่บน Cloud (AWS/Azure/GCP)

#### AWS Security Group
- ไปที่ EC2 → Security Groups
- เพิ่ม Inbound Rule:
  - Type: Custom TCP
  - Port: 8502
  - Source: 20.43.132.130/32,20.43.145.81/32,20.43.147.13/32,20.43.147.49/32,20.43.149.197/32,20.43.149.214/32,20.43.149.230/32,20.43.149.47/32,20.43.150.121/32,20.43.150.255/32,20.43.150.35/32,20.43.150.89/32,20.43.151.118/32,20.43.151.156/32,20.43.151.243/32,20.43.165.24/32,20.43.166.112/32,20.43.166.148/32,20.43.166.158/32,20.43.166.172/32,20.43.166.176/32,20.44.216.107/32,20.44.216.134/32,20.44.216.176/32,20.44.216.95/32

#### Azure Network Security Group (NSG)
- ไปที่ Network Security Groups
- เพิ่ม Inbound security rule:
  - Source: IP Addresses
  - Source IP addresses/CIDR ranges: 20.43.132.130,20.43.145.81,20.43.147.13,20.43.147.49,20.43.149.197,20.43.149.214,20.43.149.230,20.43.149.47,20.43.150.121,20.43.150.255,20.43.150.35,20.43.150.89,20.43.151.118,20.43.151.156,20.43.151.243,20.43.165.24,20.43.166.112,20.43.166.148,20.43.166.158,20.43.166.172,20.43.166.176,20.44.216.107,20.44.216.134,20.44.216.176,20.44.216.95
  - Destination port ranges: 8502
  - Protocol: TCP
  - Action: Allow

#### GCP Firewall Rules
```bash
gcloud compute firewall-rules create allow-azure-app-service \
  --allow tcp:8502 \
  --source-ranges 20.43.132.130/32,20.43.145.81/32,20.43.147.13/32,20.43.147.49/32,20.43.149.197/32,20.43.149.214/32,20.43.149.230/32,20.43.149.47/32,20.43.150.121/32,20.43.150.255/32,20.43.150.35/32,20.43.150.89/32,20.43.151.118/32,20.43.151.156/32,20.43.151.243/32,20.43.165.24/32,20.43.166.112/32,20.43.166.148/32,20.43.166.158/32,20.43.166.172/32,20.43.166.176/32,20.44.216.107/32,20.44.216.134/32,20.44.216.176/32,20.44.216.95/32 \
  --target-tags phone-call-api
```

### 4. ถ้าใช้ Application-level Firewall (เช่น nginx, Apache)

#### nginx
```nginx
# ในไฟล์ nginx config
location /scgjwd/add-que {
    # Whitelist Azure IPs (แนะนำให้ whitelist ทั้งหมด)
    allow 20.43.132.130;
    allow 20.43.145.81;
    allow 20.43.147.13;
    allow 20.43.147.49;
    allow 20.43.149.197;
    allow 20.43.149.214;
    allow 20.43.149.230;
    allow 20.43.149.47;
    allow 20.43.150.121;
    allow 20.43.150.255;
    allow 20.43.150.35;
    allow 20.43.150.89;
    allow 20.43.151.118;
    allow 20.43.151.156;
    allow 20.43.151.243;
    allow 20.43.165.24;
    allow 20.43.166.112;
    allow 20.43.166.148;
    allow 20.43.166.158;
    allow 20.43.166.172;
    allow 20.43.166.176;
    allow 20.44.216.107;
    allow 20.44.216.134;
    allow 20.44.216.176;
    allow 20.44.216.95;
    deny all;
    
    proxy_pass http://localhost:8502;
}
```

## ตรวจสอบว่า Whitelist ทำงาน

หลัง whitelist IPs แล้ว ทดสอบจาก Azure backend:

```bash
# ดู backend logs
az webapp log tail \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group RG-SCGLDATAANALYTICS-DEV
```

หรือทดสอบจาก frontend - ควรจะโทรได้สำเร็จแล้ว

## หมายเหตุ

⚠️ **Important**: Azure App Service outbound IPs อาจเปลี่ยนได้ถ้า:
- Scale up/down App Service Plan
- Restart App Service
- Deploy ใหม่

**แนะนำ**: Whitelist **Possible Outbound IPs ทั้งหมด** (24 IPs) เพื่อป้องกันปัญหาเมื่อ outbound IPs เปลี่ยน

ดู Possible Outbound IPs อีกครั้ง (ถ้าต้องการ):
```bash
az webapp show \
  --name app-scgjwdvoicebot-webbackend-dev \
  --resource-group RG-SCGLDATAANALYTICS-DEV \
  --query possibleOutboundIpAddresses -o tsv
```

