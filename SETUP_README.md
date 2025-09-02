# LiveKit Meet Demo - Local Setup Guide

This guide will help you set up a complete local LiveKit video conferencing environment using the LiveKit Meet demo application.

## 🚀 Quick Start

The easiest way to get started is to run the automated setup script:

```bash
./setup.sh
```

This script will:
- Check your environment requirements
- Install dependencies
- Start the LiveKit server
- Verify everything is working

## 📋 Prerequisites

Before you begin, make sure you have:

### 1. Docker
- **macOS**: Install [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)
- **Windows**: Install [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/)
- **Linux**: Install [Docker Engine](https://docs.docker.com/engine/install/)

### 2. Node.js
- Version 18 or later
- Download from [nodejs.org](https://nodejs.org/)

### 3. Package Manager
- **npm** (comes with Node.js)
- **yarn** (`npm install -g yarn`)
- **pnpm** (`npm install -g pnpm`) - *Recommended*

### 4. Port Availability
Make sure these ports are free on your machine:
- **7880** - API and WebSocket signaling
- **7881** - TCP fallback
- **7882** - UDP media traffic (optional for LAN tests)

## 🔧 Manual Setup

If you prefer to set up manually or the automated script fails:

### Step 1: Install Dependencies
```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install

# Or using yarn
yarn install
```

### Step 2: Start LiveKit Server
```bash
# Start the LiveKit server using Docker Compose
docker-compose up -d

# Check if it's running
docker-compose ps
```

### Step 3: Configure Environment
The `.env.local` file is already configured with:
- `LIVEKIT_URL=ws://localhost:7880`
- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=secret`

### Step 4: Start the Frontend
```bash
# Using pnpm (recommended)
pnpm dev

# Or using npm
npm run dev

# Or using yarn
yarn dev
```

### Step 5: Test the Application
1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Enter a room name and your name
3. Allow camera and microphone access
4. Test video conferencing!

## 🌐 Testing Across Devices

To test the video conferencing from other devices on your network:

### 1. Find Your Local IP Address
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```

### 2. Update Environment for Other Devices
On other devices, you'll need to:
- Use your computer's local IP instead of `localhost`
- Example: `ws://192.168.1.100:7880`

### 3. Configure Firewall
Make sure your firewall allows connections to ports 7880, 7881, and 7882.

## 📁 Project Structure

```
NewMeet/
├── app/                    # Next.js application
│   ├── api/               # API routes (including token generation)
│   ├── rooms/             # Room components
│   └── page.tsx           # Main page
├── lib/                    # Utility functions
├── public/                 # Static assets
├── docker-compose.yml      # LiveKit server configuration
├── livekit.yaml           # LiveKit server settings
├── .env.local             # Environment variables
└── setup.sh               # Automated setup script
```

## 🔑 LiveKit Configuration

The LiveKit server is configured with:
- **Development mode**: No database required
- **API Keys**: `devkey:secret` (for development only)
- **Ports**: 7880 (WebSocket), 7881 (TCP), 7882 (UDP)
- **Auto-room creation**: Enabled
- **Media features**: Noise suppression, echo cancellation, auto-gain control

## 🛠️ Troubleshooting

### LiveKit Server Issues
```bash
# Check server logs
docker-compose logs livekit

# Restart server
docker-compose restart livekit

# Stop and start fresh
docker-compose down
docker-compose up -d
```

### Port Conflicts
If ports are already in use:
```bash
# Find what's using the port
lsof -i :7880

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

### Frontend Issues
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

## 📚 Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit Components](https://github.com/livekit/components)
- [LiveKit Cloud](https://cloud.livekit.io/)
- [Next.js Documentation](https://nextjs.org/docs)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the LiveKit documentation
3. Check the GitHub issues for the [LiveKit Meet demo](https://github.com/livekit-examples/meet)

## 🔒 Security Note

⚠️ **Important**: The configuration in this demo uses hardcoded API keys (`devkey:secret`) which are **NOT SECURE** for production use. In production:
- Generate unique, secure API keys
- Use environment variables
- Implement proper authentication
- Use HTTPS/WSS connections

---

Happy video conferencing! 🎥✨
