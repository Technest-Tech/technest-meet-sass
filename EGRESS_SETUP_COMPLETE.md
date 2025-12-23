# Egress Recording Setup - Complete ✅

## Overview
Backend recording functionality is now fully configured with dynamic server routing. The system automatically routes recording requests to the correct LiveKit server and egress service based on consistent hashing.

## Architecture

### Two Egress Services
- **egress-server1**: Handles recordings for rooms on Server 1 (178.128.78.195)
- **egress-server2**: Handles recordings for rooms on Server 2 (167.99.107.128)

### Server Routing
- Rooms are routed to servers using consistent hashing (same room always goes to same server)
- Egress services automatically connect to the correct server's Redis instance
- Each egress service uses the correct `web_base_url` to connect to participants

## Configuration Files

### Egress Service 1 (`egress-config-server1.yaml`)
```yaml
ws_url: ws://178.128.78.195:7880
web_base_url: wss://rtc.acadmyq.com
redis:
  address: 178.128.78.195:6379
```

### Egress Service 2 (`egress-config-server2.yaml`)
```yaml
ws_url: ws://167.99.107.128:7880
web_base_url: wss://rtc2.acadmyq.com
redis:
  address: 167.99.107.128:6379
```

## Docker Services

### Running Services
```bash
docker compose ps
```

- `livekit-egress-server1`: Port 8080 (health check)
- `livekit-egress-server2`: Port 8081 (health check)
- `livekit-redis`: Port 6379 (local, not used by egress)

### Health Checks
```bash
# Egress Server 1
curl http://localhost:8080
# Returns: {"CpuLoad":10}

# Egress Server 2
curl http://localhost:8081
# Returns: {"CpuLoad":10}
```

## API Endpoints

### Start Recording
```
GET /api/record/start?roomName=<roomName>
```
- Automatically routes to correct server based on room name
- Checks for active participants and tracks
- Returns egress ID for tracking

### Check Status
```
GET /api/record/backend-status?egressId=<egressId>
```
- Polls recording status
- Returns current status (starting, active, completed, failed)

### Stop Recording
```
GET /api/record/stop?egressId=<egressId>
```
- Stops active recording
- Returns file information for download

### Download Recording
```
GET /api/record/download?egressId=<egressId>
```
- Downloads completed recording file

## How It Works

1. **Room Routing**: When a recording is requested, `getLiveKitServerForRoom()` determines which server the room is on using consistent hashing
2. **Server Selection**: The code connects to the correct LiveKit server API
3. **Egress Discovery**: The LiveKit server finds the appropriate egress service via Redis
4. **Recording Start**: The egress service connects to the room using the correct `web_base_url`
5. **File Storage**: Recordings are stored in `/recordings` directory (mounted from host)

## Key Features

✅ **Dynamic Server Routing**: Automatically routes to correct server  
✅ **Dual Egress Services**: One service per production server  
✅ **Redis Integration**: Egress services connect to production Redis instances  
✅ **Room Name Consistency**: Uses `hostLink` for all LiveKit API calls  
✅ **Error Handling**: Comprehensive error detection and user-friendly messages  
✅ **Status Polling**: Real-time recording status updates  
✅ **Download Support**: Automatic download modal after recording completes  

## Troubleshooting

### Check Egress Service Logs
```bash
# Server 1
docker logs livekit-egress-server1 --tail 50

# Server 2
docker logs livekit-egress-server2 --tail 50
```

### Verify Redis Connection
Look for:
- `connecting to redis` - Attempting connection
- `service ready` - Service started (may retry Redis in background)
- No "connection refused" or "timeout" errors

### Common Issues

1. **"No participants in room"**
   - Ensure participants have joined the room
   - Check that tracks are enabled and published
   - Verify room name is correct (uses `hostLink`)

2. **"Connection error"**
   - Verify egress services are running: `docker compose ps`
   - Check Redis connectivity from Docker containers
   - Verify production Redis is accessible (listening on 0.0.0.0:6379)

3. **"Start signal not received"**
   - Ensure participants have active tracks (camera/microphone enabled)
   - Wait a few seconds after enabling tracks before starting recording
   - Check egress service logs for connection issues

## Production Deployment Notes

### Redis Configuration
- Both production servers have Redis configured to listen on `0.0.0.0:6379`
- Redis is accessible from external networks
- Firewall rules allow access from local development machine

### Security Considerations
- Redis is currently unprotected (no password)
- Consider adding password protection for production
- Use firewall rules to restrict access to trusted IPs
- Consider using SSH tunnels for more secure access

### File Storage
- Recordings are stored locally in `/recordings` directory
- For production, consider configuring S3 or other cloud storage
- Update `output.file.path` in egress configs if needed

## Next Steps

1. ✅ Egress services configured and running
2. ✅ Redis connectivity established
3. ✅ Dynamic server routing implemented
4. ⏭️ Test recording functionality
5. ⏭️ Configure cloud storage (optional)
6. ⏭️ Add Redis password protection (recommended)

## Status: Ready for Testing 🎉

The backend recording system is now fully configured and ready to use. Try starting a recording in a meeting room to verify everything works correctly!
