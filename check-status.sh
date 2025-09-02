#!/bin/bash

echo "🔍 LiveKit Meet Environment Status Check"
echo "======================================="

# Add Docker to PATH
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

echo ""
echo "🐳 LiveKit Server Status:"
echo "-------------------------"
if docker compose ps | grep -q "Up"; then
    echo "✅ LiveKit server is running"
    echo "   Ports: 7880 (HTTP/WS), 7881 (TCP), 7882 (UDP)"
    echo "   Container: $(docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' | grep livekit)"
else
    echo "❌ LiveKit server is not running"
    echo "   To start it: docker compose up -d"
fi

echo ""
echo "🌐 Frontend Status:"
echo "------------------"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running on port 3000"
    echo "   URL: http://localhost:3000"
else
    echo "❌ Frontend is not running"
    echo "   To start it: ./start-frontend.sh"
fi

echo ""
echo "🔑 Environment Configuration:"
echo "----------------------------"
if [ -f ".env.local" ]; then
    echo "✅ .env.local file exists"
    echo "   LiveKit URL: $(grep LIVEKIT_URL .env.local | cut -d'=' -f2)"
    echo "   API Key: $(grep LIVEKIT_API_KEY .env.local | cut -d'=' -f2)"
else
    echo "❌ .env.local file not found"
fi

echo ""
echo "📦 Dependencies:"
echo "---------------"
if [ -d "node_modules" ]; then
    echo "✅ Node modules installed"
else
    echo "❌ Node modules not installed"
    echo "   Run: pnpm install"
fi

echo ""
echo "🚀 Quick Actions:"
echo "----------------"
echo "   Start LiveKit: docker compose up -d"
echo "   Start Frontend: ./start-frontend.sh"
echo "   View Logs: docker compose logs -f livekit"
echo "   Stop Everything: docker compose down"
