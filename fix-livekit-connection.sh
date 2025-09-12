#!/bin/bash

echo "🔧 Fixing LiveKit connection issues on Digital Ocean server..."

# Server details
SERVER_IP="64.227.52.146"
SERVER_USER="root"
PROJECT_PATH="/opt/almajd-meet/almajd-meet-livekit"

echo "📋 This script will:"
echo "1. Update nginx configuration to proxy LiveKit WebSocket connections"
echo "2. Update docker-compose.prod.yml with correct LiveKit URL"
echo "3. Restart the services"
echo ""

# Function to run commands on the server
run_on_server() {
    ssh $SERVER_USER@$SERVER_IP "cd $PROJECT_PATH && $1"
}

echo "🚀 Starting deployment..."

# 1. Update nginx configuration
echo "📝 Updating nginx configuration..."
run_on_server "cat > nginx-simple.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server newmeet-backend:3000;
    }

    upstream livekit {
        server livekit-server:7880;
    }

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

    # Backend API Server (HTTP only for initial setup)
    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection \"1; mode=block\";

        # LiveKit WebSocket proxy
        location /rtc {
            proxy_pass http://livekit;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection \"upgrade\";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 86400;
        }

        # API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Admin login with stricter rate limiting
        location /api/admin/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        # Serve static files
        location / {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF"

# 2. Update docker-compose.prod.yml
echo "📝 Updating docker-compose.prod.yml..."
run_on_server "sed -i 's|NEXT_PUBLIC_LIVEKIT_URL=ws://64.227.52.146:7880|NEXT_PUBLIC_LIVEKIT_URL=ws://64.227.52.146/rtc|g' docker-compose.prod.yml"

# 3. Restart services
echo "🔄 Restarting services..."
run_on_server "docker compose -f docker-compose.prod.yml down"
run_on_server "docker compose -f docker-compose.prod.yml up -d"

# 4. Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# 5. Check service status
echo "🔍 Checking service status..."
run_on_server "docker compose -f docker-compose.prod.yml ps"

# 6. Test the connection
echo "🧪 Testing LiveKit connection..."
run_on_server "curl -I http://localhost/rtc" || echo "⚠️  LiveKit endpoint test failed"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Test your room now:"
echo "   http://64.227.52.146/room/room?type=host"
echo ""
echo "📋 What was fixed:"
echo "   • Added nginx proxy for LiveKit WebSocket connections (/rtc)"
echo "   • Updated NEXT_PUBLIC_LIVEKIT_URL to use nginx proxy"
echo "   • Restarted all services"
echo ""
echo "🔍 If you still have issues, check the logs:"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $PROJECT_PATH && docker compose -f docker-compose.prod.yml logs -f'"
