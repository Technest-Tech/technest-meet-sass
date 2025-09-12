# Almajd Meet DigitalOcean Deployment Guide

This guide will help you deploy the Almajd Meet application (backend + frontend) on a DigitalOcean droplet using Docker.

## Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- Basic knowledge of Linux commands
- SSH access to your droplet

## Step 1: Create DigitalOcean Droplet

### 1.1 Create a New Droplet
1. Log into your DigitalOcean dashboard
2. Click "Create" → "Droplets"
3. Choose configuration:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: 
     - Minimum: 2GB RAM, 1 vCPU (for testing)
     - Recommended: 4GB RAM, 2 vCPU (for production)
     - High traffic: 8GB RAM, 4 vCPU
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
   - **Hostname**: `almajd-meet-server` (or your preferred name)

### 1.2 Configure Firewall
Create a firewall with these rules:
- **Inbound Rules**:
  - SSH (22) - Your IP only
  - HTTP (80) - All IPv4, All IPv6
  - HTTPS (443) - All IPv4, All IPv6
  - Custom (7880-7882) - All IPv4, All IPv6 (for LiveKit)
- **Outbound Rules**: All traffic

## Step 2: Initial Server Setup

### 2.1 Connect to Your Droplet
```bash
ssh root@YOUR_DROPLET_IP
```

### 2.2 Update System
```bash
apt update && apt upgrade -y
```

### 2.3 Install Docker and Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Add user to docker group (if not using root)
usermod -aG docker $USER

# Start and enable Docker
systemctl start docker
systemctl enable docker
```

### 2.4 Install Additional Tools
```bash
# Install Git, Node.js (for pnpm), and other utilities
apt install -y git curl wget unzip

# Install Node.js 18 (for pnpm)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm
```

## Step 3: Deploy Almajd Meet Application

### 3.1 Clone Repository
```bash
# Create application directory
mkdir -p /opt/almajd-meet
cd /opt/almajd-meet

# Clone your repository
git clone https://github.com/TechNestAgency/almajd-meet-livekit.git .

# Or upload your code using SCP from local machine:
# scp -r /path/to/almajd-meet-livekit root@YOUR_DROPLET_IP:/opt/almajd-meet/
```

### 3.2 Configure Environment Variables
```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

Update the `.env` file with production values:
```env
# Database
DATABASE_URL="file:/app/data/prod.db"

# JWT Authentication
JWT_SECRET="almajd-meet-jwt-secret-2024-production-key-64chars-minimum"

# LiveKit Configuration
LIVEKIT_API_KEY="almajd-meet-api-key-prod-2024"
LIVEKIT_API_SECRET="almajd-meet-api-secret-production-2024-secure-key"
LIVEKIT_URL="ws://64.227.52.146:7880"

# Next.js
NEXT_PUBLIC_LIVEKIT_URL="ws://64.227.52.146:7880"
NEXT_PUBLIC_LK_RECORD_ENDPOINT="/api/record"
```

### 3.3 Configure LiveKit
```bash
# Edit LiveKit configuration
nano livekit.yaml
```

Update `livekit.yaml` for production:
```yaml
# LiveKit Server Configuration
port: 7880
bind_addresses: ["0.0.0.0"]

# API keys for authentication (match your .env)
keys:
  almajd-meet-api-key-prod-2024: almajd-meet-api-secret-production-2024-secure-key

# Logging
log_level: info

# Room settings
room:
  auto_create: true

# Production mode
development: false

# RTC configuration
rtc:
  use_external_ip: true
  tcp_port: 7881
  udp_port: 7882
```

### 3.4 Create Required Directories
```bash
# Create data and uploads directories
mkdir -p data uploads

# Set proper permissions
chown -R 1001:1001 data uploads
```

## Step 4: Deploy with Docker Compose

### 4.1 Start the Application
```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Check if all containers are running
docker compose -f docker-compose.prod.yml ps
```

### 4.2 Initialize Database
```bash
# Run database migrations
docker compose -f docker-compose.prod.yml exec newmeet-backend pnpm run db:push

# Or if you have a custom init script
docker compose -f docker-compose.prod.yml exec newmeet-backend node scripts/init-db.js
```

### 4.3 Verify Deployment
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://64.227.52.146/health

# Test API
curl http://64.227.52.146/api/health
```

## Step 5: Configure Domain and SSL (Optional but Recommended)

### 5.1 Point Domain to Droplet
1. In your domain registrar's DNS settings:
   - Create A record: `@` → `64.227.52.146`
   - Create A record: `api` → `64.227.52.146` (if using subdomain)

### 5.2 Install Certbot for SSL
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Stop nginx container temporarily
docker compose -f docker-compose.prod.yml stop nginx
```

### 5.3 Generate SSL Certificate
```bash
# Generate certificate (replace with your domain)
certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Create SSL directory for nginx
mkdir -p /opt/almajd-meet/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/almajd-meet/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/almajd-meet/ssl/key.pem
```

### 5.4 Update Nginx Configuration
```bash
# Use the full nginx.conf instead of nginx-simple.conf
# Update server_name in nginx.conf to your domain
nano nginx.conf
```

Update the server_name in `nginx.conf`:
```nginx
server_name yourdomain.com;
# and
server_name api.yourdomain.com;
```

### 5.5 Restart with SSL
```bash
# Start nginx with SSL configuration
docker compose -f docker-compose.prod.yml up -d nginx
```

## Step 6: Production Optimizations

### 6.1 Set Up Log Rotation
```bash
# Create logrotate configuration
cat > /etc/logrotate.d/almajd-meet << EOF
/opt/almajd-meet/data/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
```

### 6.2 Set Up Monitoring
```bash
# Install htop for monitoring
apt install -y htop

# Create a simple monitoring script
cat > /opt/almajd-meet/monitor.sh << 'EOF'
#!/bin/bash
echo "=== Almajd Meet System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Disk Usage:"
df -h
echo "Memory Usage:"
free -h
echo "Docker Containers:"
docker compose -f /opt/almajd-meet/docker-compose.prod.yml ps
echo "Container Logs (last 10 lines):"
docker compose -f /opt/almajd-meet/docker-compose.prod.yml logs --tail=10
EOF

chmod +x /opt/almajd-meet/monitor.sh
```

### 6.3 Set Up Auto-Start
```bash
# Create systemd service for auto-start
cat > /etc/systemd/system/almajd-meet.service << EOF
[Unit]
Description=Almajd Meet Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/almajd-meet
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl enable almajd-meet.service
systemctl start almajd-meet.service
```

## Step 7: Backup Strategy

### 7.1 Create Backup Script
```bash
cat > /opt/almajd-meet/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/almajd-meet"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /opt/almajd-meet/data/prod.db $BACKUP_DIR/prod_$DATE.db

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/almajd-meet/uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/almajd-meet/backup.sh
```

### 7.2 Set Up Cron Job for Backups
```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /opt/almajd-meet/backup.sh >> /var/log/almajd-meet-backup.log 2>&1
```

## Step 8: Security Hardening

### 8.1 Configure Firewall (UFW)
```bash
# Install UFW
apt install -y ufw

# Configure firewall rules
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 7880:7882/tcp
ufw allow 7882/udp

# Enable firewall
ufw --force enable
```

### 8.2 Secure SSH
```bash
# Edit SSH configuration
nano /etc/ssh/sshd_config

# Add/modify these settings:
# Port 2222  # Change default port
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes

# Restart SSH
systemctl restart ssh
```

## Step 9: Testing and Verification

### 9.1 Test All Endpoints
```bash
# Test health endpoint
curl http://yourdomain.com/health

# Test API endpoints
curl http://yourdomain.com/api/health

# Test LiveKit connection
curl http://64.227.52.146:7880/
```

### 9.2 Test Video Conference
1. Open your browser and go to `http://64.227.52.146` (or your domain if configured)
2. Create a room
3. Test video/audio functionality
4. Test screen sharing
5. Test recording (if enabled)

## Step 10: Maintenance Commands

### 10.1 Common Operations
```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Update application
cd /opt/almajd-meet
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Check system status
/opt/almajd-meet/monitor.sh

# Run backup
/opt/almajd-meet/backup.sh
```

### 10.2 Troubleshooting
```bash
# Check container status
docker ps -a

# Check container logs
docker logs newmeet-backend
docker logs livekit-server
docker logs nginx-proxy

# Check disk space
df -h

# Check memory usage
free -h

# Check network connectivity
netstat -tlnp
```

## Cost Estimation

### DigitalOcean Droplet Costs (Monthly)
- **Basic**: 2GB RAM, 1 vCPU - $12/month
- **Standard**: 4GB RAM, 2 vCPU - $24/month
- **Professional**: 8GB RAM, 4 vCPU - $48/month

### Additional Costs
- Domain name: $10-15/year
- SSL certificate: Free (Let's Encrypt)
- Backup storage: Minimal (included in droplet)

## Performance Recommendations

1. **For < 50 concurrent users**: 2GB RAM droplet
2. **For 50-200 concurrent users**: 4GB RAM droplet
3. **For 200+ concurrent users**: 8GB RAM droplet + load balancer

## Support and Maintenance

- Monitor logs regularly: `/opt/almajd-meet/monitor.sh`
- Keep system updated: `apt update && apt upgrade`
- Backup database daily
- Monitor disk space and memory usage
- Set up alerts for service failures

## Next Steps

1. Set up monitoring with tools like Prometheus + Grafana
2. Implement CDN for static assets
3. Set up load balancing for high availability
4. Configure automated deployments with CI/CD
5. Set up database replication for high availability

---

**Note**: Replace `yourdomain.com` with your actual domain name if you're using a custom domain. The droplet IP `64.227.52.146` is already configured throughout this guide.
