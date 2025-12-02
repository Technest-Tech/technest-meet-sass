#!/bin/bash

# Monitor LiveKit Server Routing and Load Distribution
# This script helps verify that traffic is balanced between Server 1 and Server 4

echo "=========================================="
echo "LiveKit Server Routing Monitor"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server configurations
SERVER1_URL="https://rtc.acadmyq.com"
SERVER2_URL="https://rtc2.acadmyq.com"
APP_SERVER="104.248.179.82"

echo -e "${BLUE}=== Server Status Check ===${NC}"
echo ""

# Check Server 1
echo -e "${YELLOW}Server 1 (rtc.acadmyq.com):${NC}"
if curl -s -o /dev/null -w "Status: %{http_code}\n" "$SERVER1_URL/rtc/validate" | grep -q "200\|401"; then
    echo -e "${GREEN}✓ Server 1 is accessible${NC}"
else
    echo -e "${RED}✗ Server 1 is not accessible${NC}"
fi
echo ""

# Check Server 4
echo -e "${YELLOW}Server 4 (rtc2.acadmyq.com):${NC}"
if curl -s -o /dev/null -w "Status: %{http_code}\n" "$SERVER2_URL/rtc/validate" | grep -q "200\|401"; then
    echo -e "${GREEN}✓ Server 4 is accessible${NC}"
else
    echo -e "${RED}✗ Server 4 is not accessible${NC}"
fi
echo ""

echo -e "${BLUE}=== App Server Routing Logs ===${NC}"
echo "Checking recent routing decisions..."
echo ""

# Check app server logs for routing decisions
ssh -o StrictHostKeyChecking=no root@$APP_SERVER "cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --tail=50 newmeet-backend 2>/dev/null | grep -i 'LiveKit routing' | tail -10" || echo "No routing logs found yet (wait for room connections)"

echo ""
echo -e "${BLUE}=== Test Room Routing ===${NC}"
echo "Testing consistent hashing with sample room names..."
echo ""

# Test function to simulate routing
test_room_routing() {
    local room_name=$1
    local hash=0
    
    # Calculate hash (same algorithm as in code)
    for ((i=0; i<${#room_name}; i++)); do
        char_code=$(printf '%d' "'${room_name:$i:1}")
        hash=$(( (hash << 5) - hash + char_code ))
        hash=$(( hash & hash ))  # 32-bit integer
    done
    
    server_index=$(( (hash < 0 ? -hash : hash) % 2 ))
    
    if [ $server_index -eq 0 ]; then
        echo -e "Room: ${YELLOW}$room_name${NC} → ${GREEN}Server 1 (rtc.acadmyq.com)${NC}"
    else
        echo -e "Room: ${YELLOW}$room_name${NC} → ${GREEN}Server 4 (rtc2.acadmyq.com)${NC}"
    fi
}

# Test with sample room names
test_room_routing "abc123"
test_room_routing "xyz789"
test_room_routing "test1"
test_room_routing "test2"
test_room_routing "room-2024"

echo ""
echo -e "${BLUE}=== Monitoring Instructions ===${NC}"
echo ""
echo "1. Check App Server logs for routing:"
echo "   ssh root@$APP_SERVER 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f newmeet-backend | grep \"LiveKit routing\"'"
echo ""
echo "2. Monitor Server 1 connections:"
echo "   ssh root@178.128.78.195 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f livekit-server'"
echo ""
echo "3. Monitor Server 4 connections:"
echo "   ssh root@167.99.107.128 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.server4.yml logs -f livekit-server'"
echo ""
echo "4. Check active rooms on both servers (requires LiveKit API):"
echo "   Use LiveKit dashboard or API to check active participants"
echo ""
echo -e "${GREEN}=== Verification Checklist ===${NC}"
echo ""
echo "✓ Both servers are accessible"
echo "✓ App server logs show routing decisions"
echo "✓ Same room name always routes to same server"
echo "✓ Different rooms may route to different servers"
echo "✓ Host and guest of same room connect to same server"
echo ""

