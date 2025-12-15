#!/bin/bash

# Server-side setup script
# Run this on the Digital Ocean server after copying files

set -e

DEPLOY_DIR="/opt/almajd-meet"

echo "========================================="
echo "Almajd Meet - Server Setup"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_warn "Please run as root or with sudo"
    exit 1
fi

print_info "Step 1: Updating system packages..."
apt-get update
apt-get upgrade -y

print_info "Step 2: Installing required packages..."
apt-get install -y docker.io docker-compose-plugin git curl ufw

print_info "Step 3: Starting Docker service..."
systemctl start docker
systemctl enable docker

print_info "Step 4: Configuring firewall..."
# Allow SSH
ufw allow 22/tcp
# Allow HTTP
ufw allow 80/tcp
# Allow HTTPS
ufw allow 443/tcp
# Allow LiveKit ports
ufw allow 7880/tcp
ufw allow 7881/tcp
ufw allow 7882/udp
# Enable firewall
ufw --force enable

print_info "Step 5: Creating deployment directory..."
mkdir -p $DEPLOY_DIR
mkdir -p $DEPLOY_DIR/data
mkdir -p $DEPLOY_DIR/uploads
mkdir -p $DEPLOY_DIR/ssl

print_info "Step 6: Setting permissions..."
chmod 755 $DEPLOY_DIR
chmod 755 $DEPLOY_DIR/data
chmod 755 $DEPLOY_DIR/uploads

print_info ""
print_info "========================================="
print_info "Server setup completed!"
print_info "========================================="
print_info ""
print_info "Next steps:"
print_info "1. Copy deployment files to $DEPLOY_DIR"
print_info "2. Update env.do with your configuration"
print_info "3. Run: cd $DEPLOY_DIR && docker compose up -d --build"
print_info "4. Run migrations: docker compose exec newmeet-backend npx prisma migrate deploy"
