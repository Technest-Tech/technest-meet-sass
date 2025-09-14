# NewMeet Video Conferencing App - Complete Deployment Guide

## Overview
This guide provides a complete walkthrough for deploying the NewMeet video conferencing application on DigitalOcean with proper SSL, WebSocket support, and LiveKit integration.

## Architecture
- **Frontend/Backend**: Next.js application
- **WebRTC Service**: LiveKit server
- **Reverse Proxy**: Nginx with SSL termination
- **Database**: SQLite (can be upgraded to PostgreSQL)
- **Hosting**: DigitalOcean Droplet

## Prerequisites
- DigitalOcean account
- Domain name (e.g., `live.almajd.link`)
- Basic knowledge of Docker and Linux

## Step 1: Server Setup

### 1.1 Create DigitalOcean Droplet
```bash
# Create a droplet with:
# - Ubuntu 22.04 LTS
# - At least 2GB RAM, 2 vCPUs
# - 50GB SSD storage
# - Enable monitoring
```

### 1.2 Initial Server Configuration
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Logout and login again to apply docker group changes
```

## Step 2: Application Deployment

### 2.1 Clone and Setup Application
```bash
# Clone your repository
git clone <your-repo-url> /opt/newmeet
cd /opt/newmeet

# Make sure you have the correct files
ls -la
# Should include: Dockerfile, docker-compose.yml, nginx.conf, livekit.yaml
```

### 2.2 Environment Configuration
Create `env.production`:
```bash
NODE_ENV=production
DATABASE_URL=file:/app/data/prod.db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-64chars-minimum
LIVEKIT_API_KEY=your-livekit-api-key-prod-2024
LIVEKIT_API_SECRET=your-livekit-api-secret-production-2024-secure-key
LIVEKIT_URL=http://livekit-server:7880
NEXT_PUBLIC_LIVEKIT_URL=wss://your-domain.com/rtc
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
```

### 2.3 Docker Compose Configuration
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  newmeet-app:
    build: .
    container_name: newmeet-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/prod.db
      - JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-64chars-minimum
      - LIVEKIT_API_KEY=your-livekit-api-key-prod-2024
      - LIVEKIT_API_SECRET=your-livekit-api-secret-production-2024-secure-key
      - LIVEKIT_URL=http://livekit-server:7880
      - NEXT_PUBLIC_LIVEKIT_URL=wss://your-domain.com/rtc
      - NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    depends_on:
      - livekit-server

  livekit-server:
    image: livekit/livekit-server:latest
    container_name: livekit-server
    ports:
      - "7880:7880"  # API and WebSocket signaling
      - "7881:7881"  # TCP fallback
      - "7882:7882/udp"  # UDP for media traffic
    environment:
      LIVEKIT_PORT: "7880"
      LIVEKIT_BIND_ADDRESSES: "0.0.0.0:7880"
      LIVEKIT_TCP_PORT: "7881"
      LIVEKIT_TCP_BIND_ADDRESSES: "0.0.0.0:7881"
      LIVEKIT_UDP_PORT: "7882"
      LIVEKIT_UDP_BIND_ADDRESSES: "0.0.0.0:7882"
    volumes:
      - ./livekit.yaml:/config.yaml
    command: --config /config.yaml
    restart: unless-stopped

  nginx-proxy:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    restart: unless-stopped
    depends_on:
      - newmeet-app
      - livekit-server
```

### 2.4 LiveKit Configuration
Create `livekit.yaml`:
```yaml
# LiveKit Server Configuration
port: 7880
bind_addresses: ["0.0.0.0"]

# API keys for authentication - MUST MATCH your environment variables
keys:
  your-livekit-api-key-prod-2024: your-livekit-api-secret-production-2024-secure-key

# Logging
log_level: info

# Room settings
room:
  auto_create: true

# Development mode (no database required)
development: true

# RTC configuration
rtc:
  use_external_ip: true
  tcp_port: 7881
  udp_port: 7882
```

### 2.5 Nginx Configuration
Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream newmeet-app {
        server newmeet-app:3000;
    }

    upstream livekit-server {
        server livekit-server:7880;
    }

    # HTTP server - redirect to HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL configuration with Let's Encrypt certificates
        ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # LiveKit WebSocket - handle WebSocket connections
        location /rtc {
            proxy_pass http://livekit-server/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400;
        }

        # Main application
        location / {
            proxy_pass http://newmeet-app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API endpoints
        location /api/ {
            proxy_pass http://newmeet-app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Step 3: SSL Certificate Setup

### 3.1 Stop Services Temporarily
```bash
cd /opt/newmeet
docker compose down
sudo systemctl stop nginx  # Stop any system nginx
```

### 3.2 Get SSL Certificate
```bash
# Replace your-domain.com with your actual domain
sudo certbot certonly --standalone -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com
```

### 3.3 Update Nginx Configuration
Update the SSL certificate paths in `nginx.conf` to match your domain:
```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

## Step 4: Deploy Application

### 4.1 Start Services
```bash
cd /opt/newmeet
docker compose up -d
```

### 4.2 Verify Deployment
```bash
# Check all containers are running
docker ps

# Test HTTPS connection
curl -I https://your-domain.com

# Test WebSocket endpoint
curl -I https://your-domain.com/rtc

# Test API endpoint
curl -s "https://your-domain.com/api/connection-details?roomName=test&participantName=TestUser&participantType=host" | jq .
```

## Step 5: Troubleshooting Common Issues

### 5.1 WebSocket Connection Issues

**Problem**: Mixed content errors or WebSocket connection failures
**Solution**: Ensure `NEXT_PUBLIC_LIVEKIT_URL` uses `wss://` protocol

```bash
# Check environment variables
docker exec newmeet-app env | grep LIVEKIT

# Should show:
# NEXT_PUBLIC_LIVEKIT_URL=wss://your-domain.com/rtc
# LIVEKIT_URL=http://livekit-server:7880
```

### 5.2 API Key Mismatch

**Problem**: "invalid API key" errors
**Solution**: Ensure LiveKit server and application use the same API keys

```bash
# Check livekit.yaml matches your environment variables
cat livekit.yaml | grep -A 2 "keys:"

# Restart LiveKit server after changes
docker compose restart livekit-server
```

### 5.3 Double /rtc in URL

**Problem**: WebSocket tries to connect to `/rtc/rtc`
**Solution**: Use correct nginx proxy configuration

```nginx
# Correct configuration
location /rtc {
    proxy_pass http://livekit-server/;  # Note the trailing slash
    # ... other proxy settings
}
```

### 5.4 Container Networking Issues

**Problem**: Containers can't communicate
**Solution**: Ensure all services are in the same Docker network

```bash
# Check network
docker network ls
docker network inspect newmeet_default

# Restart all services
docker compose down
docker compose up -d
```

## Step 6: Monitoring and Maintenance

### 6.1 Log Monitoring
```bash
# View application logs
docker logs newmeet-app -f

# View LiveKit logs
docker logs livekit-server -f

# View nginx logs
docker logs nginx-proxy -f
```

### 6.2 SSL Certificate Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Set up automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 6.3 Backup Database
```bash
# Backup SQLite database
cp /opt/newmeet/data/prod.db /opt/newmeet/data/prod.db.backup.$(date +%Y%m%d)
```

## Step 7: Performance Optimization

### 7.1 Resource Limits
Add to `docker-compose.yml`:
```yaml
services:
  newmeet-app:
    # ... existing config
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

### 7.2 Database Upgrade (Optional)
For production, consider upgrading to PostgreSQL:

```yaml
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: newmeet
      POSTGRES_USER: newmeet
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

## Final Verification Checklist

- [ ] Domain points to your server IP
- [ ] SSL certificate is valid and working
- [ ] All Docker containers are running
- [ ] WebSocket endpoint responds with HTTP 200
- [ ] API returns correct serverUrl with wss://
- [ ] Video calls work in browser
- [ ] No mixed content errors in browser console
- [ ] No "invalid API key" errors in logs

## Quick Commands Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker logs <container-name> -f

# Restart specific service
docker compose restart <service-name>

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Check SSL certificate
sudo certbot certificates

# Test WebSocket
curl -I https://your-domain.com/rtc

# Test API
curl -s "https://your-domain.com/api/connection-details?roomName=test&participantName=TestUser&participantType=host"
```

## Security Considerations

1. **Change default passwords and secrets**
2. **Use strong JWT secrets (64+ characters)**
3. **Keep Docker and system packages updated**
4. **Configure firewall to only allow necessary ports**
5. **Regular security updates**
6. **Monitor logs for suspicious activity**

## Support

If you encounter issues:
1. Check container logs: `docker logs <container-name>`
2. Verify environment variables match between services
3. Ensure SSL certificate is valid
4. Check nginx configuration syntax
5. Verify LiveKit API keys match in both places

---

**Note**: Replace `your-domain.com` with your actual domain name throughout this guide.
