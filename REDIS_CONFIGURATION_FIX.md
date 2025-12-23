# Redis Configuration Fix for Egress Service

## Problem
The egress service was timing out when trying to start recordings. The error was "no response from servers" because LiveKit server and egress service couldn't communicate.

## Root Cause
LiveKit server needs Redis configuration to communicate with the egress service. The egress service uses Redis as a message bus to communicate with LiveKit server. Without Redis configured in LiveKit server, they couldn't exchange messages.

## Solution
Added Redis configuration to `livekit.yaml`:

```yaml
# Redis configuration (required for egress service communication)
redis:
  address: redis:6379
```

## Changes Made

1. **Updated `livekit.yaml`**:
   - Added Redis configuration section
   - Points to `redis:6379` (Docker service name)

2. **Restarted LiveKit Server**:
   - Applied the new Redis configuration
   - Server now connects to Redis on startup

3. **Verified Connection**:
   - LiveKit server logs show: `connecting to redis {"simple": true, "addr": "redis:6379"}`
   - Egress service logs show: `connecting to redis {"nodeID": "...", "addr": "redis:6379"}`
   - Both services are now on the same Redis message bus

## Current Configuration

### LiveKit Server (`livekit.yaml`)
```yaml
redis:
  address: redis:6379
```

### Egress Service (`egress-config.yaml`)
```yaml
redis:
  address: redis:6379
```

### Docker Services
- Both services are on the `livekit-network` Docker network
- Redis is accessible at `redis:6379` from both services

## Verification

### Check LiveKit Server Redis Connection
```bash
docker logs livekit-server | grep -i redis
```
Should show: `connecting to redis`

### Check Egress Service Redis Connection
```bash
docker logs livekit-egress | grep -i redis
```
Should show: `connecting to redis`

### Health Check
```bash
curl http://localhost:3000/api/record/egress-health
```
Should return: `{"status": "healthy", "services": {...}}`

## Next Steps

The egress service should now be able to:
1. ✅ Connect to Redis
2. ✅ Register with LiveKit server via Redis message bus
3. ✅ Receive recording requests from LiveKit server
4. ✅ Start recordings successfully

Try starting a recording again - it should work now!


