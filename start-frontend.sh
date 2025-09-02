#!/bin/bash

echo "🚀 Starting LiveKit Meet Frontend..."
echo "=================================="

# Add Docker to PATH
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

# Check if LiveKit server is running
echo "🔍 Checking LiveKit server status..."
if docker compose ps | grep -q "Up"; then
    echo "✅ LiveKit server is running"
else
    echo "❌ LiveKit server is not running. Starting it now..."
    docker compose up -d
    sleep 5
fi

echo ""
echo "🌐 Starting Next.js frontend..."
echo "   The app will be available at: http://localhost:3000"
echo "   LiveKit server is running at: ws://localhost:7880"
echo ""
echo "Press Ctrl+C to stop the frontend"
echo ""

# Start the frontend
if command -v pnpm &> /dev/null; then
    pnpm dev
elif command -v yarn &> /dev/null; then
    yarn dev
else
    npm run dev
fi
