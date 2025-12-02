# Server 4 Setup Instructions (167.99.107.128)

## Overview
This document provides step-by-step instructions to configure Server 4 as the second LiveKit server with rtc2.acadmyq.com.

## Prerequisites
- Server 4 IP: 167.99.107.128
- Domain: rtc2.acadmyq.com (DNS already configured)
- Same LiveKit API keys as Server 1

## Step 1: Initial Server Setup

```bash
# SSH into Server 4
ssh root@167.99.107.128

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Git
sudo apt install git -y

# Logout and login again to apply docker group changes
```

## Step 2: Clone Repository

```bash
# Clone repository
git clone <your-repo-url> /opt/almajd-meet-livekit
cd /opt/almajd-meet-livekit

# Verify files exist
ls -la
# Should see: livekit.yaml, docker-compose.server4.yml, nginx-server4.conf
```

## Step 3: Verify LiveKit Configuration

```bash
# Check livekit.yaml has correct API keys
cat livekit.yaml
# Should show:
# keys:
#   almajd-meet-api-key-prod-2024: almajd-meet-api-secret-production-2024-secure-key
```

## Step 4: Start LiveKit Container (Before SSL)

```bash
# Start only LiveKit container first (without Nginx)
docker compose -f docker-compose.server4.yml up -d livekit-server

# Verify LiveKit is running
docker compose -f docker-compose.server4.yml ps
docker compose -f docker-compose.server4.yml logs livekit-server
```

## Step 5: Setup SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Stop Nginx container temporarily (if running)
docker compose -f docker-compose.server4.yml stop nginx

# Get SSL certificate
sudo certbot certonly --standalone -d rtc2.acadmyq.com

# Verify certificate was created
sudo ls -la /etc/letsencrypt/live/rtc2.acadmyq.com/
# Should see: fullchain.pem, privkey.pem

# Test certificate renewal
sudo certbot renew --dry-run
```

## Step 6: Start All Services

```bash
# Start all services (LiveKit + Nginx)
docker compose -f docker-compose.server4.yml up -d

# Verify all containers are running
docker compose -f docker-compose.server4.yml ps

# Check logs
docker compose -f docker-compose.server4.yml logs -f
```

## Step 7: Configure Firewall

```bash
# Allow required ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
sudo ufw enable

# Check firewall status
sudo ufw status
```

## Step 8: Verify Setup

```bash
# Test HTTP redirect
curl -I http://rtc2.acadmyq.com
# Should return 301 redirect to HTTPS

# Test HTTPS connection
curl -I https://rtc2.acadmyq.com/rtc/validate
# Should return 200 OK

# Test LiveKit WebSocket endpoint
curl https://rtc2.acadmyq.com/rtc/validate
# Should return LiveKit validation response
```

## Step 9: Monitor Logs

```bash
# Watch LiveKit logs
docker compose -f docker-compose.server4.yml logs -f livekit-server

# Watch Nginx logs
docker compose -f docker-compose.server4.yml logs -f nginx
```

## Troubleshooting

### Issue: SSL certificate not found
```bash
# Check certificate path
sudo ls -la /etc/letsencrypt/live/rtc2.acadmyq.com/

# If missing, re-run certbot
sudo certbot certonly --standalone -d rtc2.acadmyq.com
```

### Issue: Nginx can't connect to LiveKit
```bash
# Check LiveKit container is running
docker compose -f docker-compose.server4.yml ps livekit-server

# Check network connectivity
docker compose -f docker-compose.server4.yml exec nginx ping livekit-server
```

### Issue: Port already in use
```bash
# Check what's using the port
sudo netstat -tulpn | grep 7880

# Stop conflicting service or change port in docker-compose
```

## Verification Checklist

- [ ] Docker and Docker Compose installed
- [ ] Repository cloned to /opt/almajd-meet-livekit
- [ ] livekit.yaml has correct API keys
- [ ] LiveKit container running and accessible
- [ ] SSL certificate obtained for rtc2.acadmyq.com
- [ ] Nginx container running with SSL config
- [ ] Firewall configured (ports 80, 443, 7880, 7881, 7882)
- [ ] HTTPS test: `curl https://rtc2.acadmyq.com/rtc/validate` returns 200
- [ ] DNS resolves rtc2.acadmyq.com to 167.99.107.128

## Next Steps

After Server 4 is configured:
1. Update Server 2 (App Server) with new environment variables
2. Deploy updated code to Server 2
3. Test room routing to verify consistent hashing works
4. Monitor both LiveKit servers for load distribution

