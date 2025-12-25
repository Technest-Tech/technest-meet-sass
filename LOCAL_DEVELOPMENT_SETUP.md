# Local Development Setup Guide

## Problem
When running LiveKit in Docker on macOS, the WebRTC peer connection fails because:
- The server advertises an IP address that the browser cannot reach
- Docker's network isolation causes IP mismatches in ICE candidates

## Solution
Configure LiveKit to advertise your local network IP address instead of localhost or external IP.

## Configuration Steps

### 1. Find Your Local IP Address
```bash
ipconfig getifaddr en0
# Output example: 192.168.1.23
```

### 2. Update Configuration Files

#### `livekit.yaml`
- Already configured with `use_external_ip: false`
- NAT mapping is set via environment variable in `docker-compose.yml`

#### `docker-compose.yml`
- Environment variable `LIVEKIT_NAT_1TO1_IPS` maps all IPs to your local IP
- **IMPORTANT**: Update `192.168.1.23` to match YOUR local IP from step 1

#### `.env` or `.env.local`
Create or update your environment file:
```bash
# LiveKit Configuration for Local Development
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
# Use your local IP (not localhost) for Docker networking
LIVEKIT_URL="ws://192.168.1.23:7880"
NEXT_PUBLIC_LIVEKIT_URL="ws://192.168.1.23:7880"
```

**IMPORTANT**: Replace `192.168.1.23` with YOUR actual local IP address!

### 3. Restart Services
```bash
# Recreate LiveKit container to apply changes
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d livekit

# Restart your Next.js dev server to pick up new env vars
# (Ctrl+C and restart npm run dev)
```

### 4. Verify Configuration
1. Check LiveKit logs: `docker logs livekit-server --tail 20`
2. Look for the `nodeIP` - it should show your Docker internal IP (like `172.x.x.x`)
3. Try connecting to a room - ICE candidates should now use `192.168.1.23`

## Production vs Local Development

### Local Development (Current Setup)
- Uses local network IP (`192.168.1.23`)
- Works with Docker on macOS
- Configured in `livekit.yaml` and `docker-compose.yml`

### Production
- Uses production domain (`wss://acadmyq.com`)
- Configured via environment variables in `env.production`
- LiveKit server automatically detects external IP
- No manual IP configuration needed

## Troubleshooting

### Still seeing connection failures?
1. **Verify IP addresses match:**
   - Your local IP: `ipconfig getifaddr en0`
   - `docker-compose.yml`: `LIVEKIT_NAT_1TO1_IPS` value
   - `.env`: `LIVEKIT_URL` and `NEXT_PUBLIC_LIVEKIT_URL`

2. **Check LiveKit logs:**
   ```bash
   docker logs livekit-server --tail 50 | grep -i "ice\|rtc\|candidate"
   ```

3. **Verify ports are accessible:**
   ```bash
   # Check if ports are open
   lsof -i :7880
   lsof -i :7881
   lsof -i :7882
   ```

4. **Try recreating the container:**
   ```bash
   docker compose -f docker-compose.yml down
   docker compose -f docker-compose.yml up -d livekit
   ```

### IP Address Changed?
If your local IP address changes (e.g., after reconnecting to WiFi):
1. Update `docker-compose.yml` → `LIVEKIT_NAT_1TO1_IPS`
2. Update `.env` → `LIVEKIT_URL` and `NEXT_PUBLIC_LIVEKIT_URL`
3. Recreate the LiveKit container
4. Restart your Next.js dev server

## Notes
- This configuration is **only for local development**
- Production uses different settings (see `env.production`)
- The IP `192.168.1.23` in the config files is an example - use YOUR actual IP!












