# Traffic Balancing Verification Guide

## Overview
This guide explains how to verify that traffic is successfully balanced between Server 1 (rtc.acadmyq.com) and Server 4 (rtc2.acadmyq.com) using consistent hashing.

## Quick Verification Methods

### 1. Check App Server Routing Logs

The app server logs every routing decision. Check for "LiveKit routing" messages:

```bash
# Real-time monitoring
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f newmeet-backend | grep "LiveKit routing"'

# View recent routing decisions
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --tail=200 newmeet-backend | grep "LiveKit routing"'
```

**Expected Output:**
```
🔧 LiveKit routing: { roomName: 'abc123', clientUrl: 'wss://rtc.acadmyq.com', serverUrl: 'http://178.128.78.195:7880' }
🔧 LiveKit routing: { roomName: 'xyz789', clientUrl: 'wss://rtc2.acadmyq.com', serverUrl: 'http://167.99.107.128:7880' }
```

### 2. Test Room Routing Consistency

Create test rooms and verify same room always routes to same server:

```bash
# Test script (run locally)
./scripts/monitor-livekit-routing.sh
```

**What to verify:**
- Same room name → Always same server
- Different room names → May route to different servers
- This proves consistent hashing works

### 3. Monitor Both LiveKit Servers

Check activity on both servers:

```bash
# Server 1 logs
ssh root@178.128.78.195 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f livekit-server | grep -i "participant\|room"'

# Server 4 logs  
ssh root@167.99.107.128 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.server4.yml logs -f livekit-server | grep -i "participant\|room"'
```

### 4. Check Server Resource Usage

Monitor CPU and memory usage on both servers:

```bash
# Run stats script
./scripts/check-livekit-stats.sh

# Or manually check
ssh root@178.128.78.195 'docker stats livekit-server --no-stream'
ssh root@167.99.107.128 'docker stats livekit-server --no-stream'
```

**What to look for:**
- Both servers should show activity
- Resource usage should be distributed (not all on one server)
- Network I/O should be present on both

### 5. Test Same Room Joining

**Manual Test:**
1. Create a room (note the room link, e.g., `abc123`)
2. Check app logs to see which server it routed to
3. Join as host → Should connect to same server
4. Join as guest → Should connect to same server
5. Create another room (e.g., `xyz789`)
6. Check logs - may route to different server (expected)

**Verify in logs:**
```bash
# Look for same roomName routing to same server
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --tail=500 newmeet-backend | grep "LiveKit routing" | grep "abc123"'
# All entries for "abc123" should show same server
```

### 6. Count Rooms Per Server

Count how many rooms are on each server (approximate):

```bash
# Count unique room names routed to Server 1
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --since 1h newmeet-backend 2>/dev/null | grep "LiveKit routing" | grep "rtc.acadmyq.com" | wc -l'

# Count unique room names routed to Server 4
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs --since 1h newmeet-backend 2>/dev/null | grep "LiveKit routing" | grep "rtc2.acadmyq.com" | wc -l'
```

**Expected:** Roughly 50/50 distribution over time (may vary based on room name hashes)

## Advanced Verification

### Using LiveKit API (if available)

If you have LiveKit API access, you can check active rooms:

```bash
# Server 1 active rooms
curl -X GET "http://178.128.78.195:7880/twirp/livekit.RoomService/ListRooms" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Server 4 active rooms  
curl -X GET "http://167.99.107.128:7880/twirp/livekit.RoomService/ListRooms" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Query (if tracking room-server mapping)

If you add room-server mapping to database:

```sql
-- Count rooms per server (if you add a server_id column)
SELECT server_id, COUNT(*) as room_count 
FROM rooms 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY server_id;
```

## Verification Checklist

- [ ] Both servers are accessible (rtc.acadmyq.com and rtc2.acadmyq.com)
- [ ] App server logs show routing decisions with "LiveKit routing" messages
- [ ] Same room name always routes to same server (consistent hashing works)
- [ ] Different rooms route to different servers (load distribution works)
- [ ] Host and guest of same room connect to same server
- [ ] Both LiveKit servers show activity in logs
- [ ] Resource usage is distributed across both servers
- [ ] No errors in app server or LiveKit server logs

## Troubleshooting

### Issue: All rooms routing to one server

**Check:**
1. Verify environment variables on Server 2:
   ```bash
   ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && cat env.production | grep LIVEKIT'
   ```
   Should show both `LIVEKIT_1_*` and `LIVEKIT_2_*` variables

2. Restart app container:
   ```bash
   ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml restart newmeet-backend'
   ```

### Issue: Same room routing to different servers

**This should NOT happen!** If it does:

1. Check app server code is updated:
   ```bash
   ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && git log --oneline -5'
   ```

2. Verify consistent hashing function is in code:
   ```bash
   ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && grep -A 20 "getLiveKitServerForRoom" app/api/connection-details/route.ts'
   ```

3. Rebuild and restart:
   ```bash
   ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml build --no-cache newmeet-backend && docker compose -f docker-compose.prod.yml up -d newmeet-backend'
   ```

### Issue: One server not receiving traffic

**Check:**
1. Server is accessible:
   ```bash
   curl -I https://rtc2.acadmyq.com/rtc/validate
   ```

2. Container is running:
   ```bash
   ssh root@167.99.107.128 'docker ps | grep livekit'
   ```

3. Check app server can reach it:
   ```bash
   ssh root@104.248.179.82 'curl -I http://167.99.107.128:7880/rtc/validate'
   ```

## Expected Behavior

✅ **Correct:**
- Room "abc123" → Always Server 1
- Room "xyz789" → Always Server 4
- Room "test1" → Always Server 4
- Room "test2" → Always Server 1
- Over 100 rooms: ~50% on Server 1, ~50% on Server 4

❌ **Incorrect:**
- Same room routing to different servers
- All rooms on one server
- Random routing (not consistent)

## Monitoring Commands Summary

```bash
# Quick check
./scripts/monitor-livekit-routing.sh

# Detailed stats
./scripts/check-livekit-stats.sh

# Real-time routing logs
ssh root@104.248.179.82 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f newmeet-backend | grep "LiveKit routing"'

# Server 1 activity
ssh root@178.128.78.195 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.prod.yml logs -f livekit-server'

# Server 4 activity
ssh root@167.99.107.128 'cd /opt/almajd-meet-livekit && docker compose -f docker-compose.server4.yml logs -f livekit-server'
```

