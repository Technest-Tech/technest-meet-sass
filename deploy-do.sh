#!/bin/bash

# Digital Ocean Deployment Script
# This script deploys the Almajd Meet application to Digital Ocean server

set -e

SERVER_IP="152.42.249.147"
SERVER_USER="root"
SERVER_PASSWORD="Ad@#\$E31Ju"
DEPLOY_DIR="/opt/almajd-meet"

echo "========================================="
echo "Almajd Meet - Digital Ocean Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    print_warn "sshpass not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew &> /dev/null; then
            print_error "Homebrew not found. Please install Homebrew first: https://brew.sh"
            exit 1
        fi
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    else
        print_error "Unsupported OS. Please install sshpass manually."
        exit 1
    fi
fi

# Function to execute remote command
remote_exec() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$SERVER_USER@$SERVER_IP" "$1"
}

# Function to copy file to remote
remote_copy() {
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$1" "$SERVER_USER@$SERVER_IP:$2"
}

# Function to copy directory to remote
remote_copy_dir() {
    sshpass -p "$SERVER_PASSWORD" scp -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$1" "$SERVER_USER@$SERVER_IP:$2"
}

print_info "Step 1: Checking server connection..."
if ! remote_exec "echo 'Connection successful'"; then
    print_error "Failed to connect to server. Please check credentials and network."
    exit 1
fi
print_info "Server connection successful!"

print_info "Step 2: Installing required packages on server..."
remote_exec "apt-get update && apt-get install -y docker.io docker-compose-plugin git curl"

print_info "Step 3: Creating deployment directory..."
remote_exec "mkdir -p $DEPLOY_DIR && mkdir -p $DEPLOY_DIR/data && mkdir -p $DEPLOY_DIR/uploads && mkdir -p $DEPLOY_DIR/ssl"

print_info "Step 4: Copying deployment files..."
# Copy docker-compose file
remote_copy "docker-compose.do.yml" "$DEPLOY_DIR/docker-compose.yml"

# Copy nginx configuration
remote_copy "nginx.do.conf" "$DEPLOY_DIR/nginx.do.conf"

# Copy LiveKit configuration
remote_copy "livekit.do.yaml" "$DEPLOY_DIR/livekit.do.yaml"

# Copy Dockerfile
remote_copy "Dockerfile" "$DEPLOY_DIR/Dockerfile"

# Copy environment file if it exists, otherwise copy example
if [ -f "env.do" ]; then
    remote_copy "env.do" "$DEPLOY_DIR/env.do"
    print_info "Using existing env.do file"
else
    if [ -f "env.do.example" ]; then
        remote_copy "env.do.example" "$DEPLOY_DIR/env.do"
        print_warn "Using env.do.example. Please update env.do on the server with your actual values!"
    else
        print_error "env.do or env.do.example not found. Please create env.do file."
        exit 1
    fi
fi

print_info "Step 5: Copying application files..."
# Create a temporary directory for files to copy
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy necessary directories and files
cp -r app "$TEMP_DIR/"
cp -r lib "$TEMP_DIR/"
cp -r prisma "$TEMP_DIR/"
cp -r public "$TEMP_DIR/"
cp -r styles "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp pnpm-lock.yaml "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp next.config.js "$TEMP_DIR/"
cp postcss.config.js "$TEMP_DIR/"
cp tailwind.config.js "$TEMP_DIR/"
cp middleware.ts "$TEMP_DIR/"

# Copy to server
remote_copy_dir "$TEMP_DIR" "$DEPLOY_DIR/app-files"

# Move files to correct location
remote_exec "cd $DEPLOY_DIR && mv app-files/* . && rmdir app-files"

print_info "Step 6: Setting up Docker and starting services..."
remote_exec "cd $DEPLOY_DIR && docker compose down || true"
remote_exec "cd $DEPLOY_DIR && docker compose build --no-cache"
remote_exec "cd $DEPLOY_DIR && docker compose up -d"

print_info "Step 7: Waiting for services to start..."
sleep 10

print_info "Step 8: Running database migrations..."
remote_exec "cd $DEPLOY_DIR && docker compose exec -T newmeet-backend npx prisma migrate deploy || docker compose exec -T newmeet-backend npx prisma db push"

print_info "Step 9: Checking service status..."
remote_exec "cd $DEPLOY_DIR && docker compose ps"

print_info ""
print_info "========================================="
print_info "Deployment completed!"
print_info "========================================="
print_info ""
print_info "Application URL: http://$SERVER_IP"
print_info "LiveKit WebSocket: ws://$SERVER_IP/rtc"
print_info ""
print_info "To check logs:"
print_info "  ssh $SERVER_USER@$SERVER_IP"
print_info "  cd $DEPLOY_DIR"
print_info "  docker compose logs -f"
print_info ""
print_warn "IMPORTANT: Update env.do file on the server with your actual configuration values!"
print_warn "IMPORTANT: Make sure to set proper firewall rules to allow ports 80, 443, 7880, 7881, 7882"
