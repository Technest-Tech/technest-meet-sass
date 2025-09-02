#!/bin/bash

echo "🚀 Setting up LiveKit Meet Demo Environment"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or later."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js v18 or later."
    exit 1
fi

echo "✅ Docker and Node.js are properly installed"

# Check if ports are available
echo "🔍 Checking if required ports are available..."

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port $port is already in use. Please free up this port."
        return 1
    else
        echo "✅ Port $port is available"
        return 0
    fi
}

check_port 7880 || exit 1
check_port 7881 || exit 1
check_port 7882 || exit 1

echo ""
echo "📦 Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi

echo ""
echo "🐳 Starting LiveKit server..."
docker-compose up -d

echo ""
echo "⏳ Waiting for LiveKit server to start..."
sleep 5

# Check if LiveKit server is running
if curl -s http://localhost:7880/health > /dev/null 2>&1; then
    echo "✅ LiveKit server is running successfully"
else
    echo "❌ LiveKit server failed to start. Check the logs with: docker-compose logs livekit"
    exit 1
fi

echo ""
echo "🎉 Setup complete! You can now:"
echo "1. Start the frontend: npm run dev (or pnpm dev / yarn dev)"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Join a room and test video conferencing"
echo ""
echo "📱 To test across devices, use your computer's local IP address instead of localhost"
echo "🌐 LiveKit server is running on: ws://localhost:7880"
echo ""
echo "🔧 Useful commands:"
echo "   - View LiveKit logs: docker-compose logs -f livekit"
echo "   - Stop LiveKit: docker-compose down"
echo "   - Restart LiveKit: docker-compose restart"
