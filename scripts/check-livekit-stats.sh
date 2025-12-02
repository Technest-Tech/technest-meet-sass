#!/bin/bash

# Check LiveKit Server Statistics
# This script checks active connections and load on both LiveKit servers

echo "=========================================="
echo "LiveKit Server Statistics"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER1_IP="178.128.78.195"
SERVER4_IP="167.99.107.128"

echo -e "${BLUE}=== Server 1 Container Stats ===${NC}"
ssh -o StrictHostKeyChecking=no root@$SERVER1_IP "cd /opt/almajd-meet-livekit && docker stats livekit-server --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null || echo 'Container not found or not running'"

echo ""
echo -e "${BLUE}=== Server 4 Container Stats ===${NC}"
ssh -o StrictHostKeyChecking=no root@$SERVER4_IP "cd /opt/almajd-meet-livekit && docker stats livekit-server --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null || echo 'Container not found or not running'"

echo ""
echo -e "${BLUE}=== Server 1 Recent Logs (last 5 connections) ===${NC}"
ssh -o StrictHostKeyChecking=no root@$SERVER1_IP "cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --tail=20 livekit-server 2>/dev/null | grep -i 'participant\|room\|connection' | tail -5 || echo 'No recent activity'"

echo ""
echo -e "${BLUE}=== Server 4 Recent Logs (last 5 connections) ===${NC}"
ssh -o StrictHostKeyChecking=no root@$SERVER4_IP "cd /opt/almajd-meet-livekit && docker compose -f docker-compose.server4.yml logs --tail=20 livekit-server 2>/dev/null | grep -i 'participant\|room\|connection' | tail -5 || echo 'No recent activity'"

echo ""
echo -e "${YELLOW}Note:${NC} For detailed room/participant counts, use LiveKit API or dashboard"
echo ""

