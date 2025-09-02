#!/bin/bash

echo "🚀 Setting up LiveKit for NewMeet..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Database
DATABASE_URL="file:./dev.db"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# LiveKit Configuration
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
LIVEKIT_URL="ws://localhost:7880"

# Next.js
NEXT_PUBLIC_LIVEKIT_URL="ws://localhost:7880"
EOF
    echo "✅ .env.local file created!"
else
    echo "ℹ️  .env.local file already exists"
fi

# Check if LiveKit server is running
echo "🔍 Checking LiveKit server status..."
if curl -s "http://localhost:7880" > /dev/null 2>&1; then
    echo "✅ LiveKit server is running on localhost:7880"
else
    echo "⚠️  LiveKit server is not responding on localhost:7880"
    echo "   Make sure your Docker container is running:"
    echo "   docker-compose up -d"
fi

# Check environment variables
echo "🔧 Checking environment variables..."
if [ -f .env.local ]; then
    echo "✅ .env.local file found"
    echo "📋 Current LiveKit configuration:"
    grep -E "LIVEKIT_" .env.local || echo "   No LiveKit variables found"
else
    echo "❌ .env.local file not found"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Make sure your LiveKit Docker container is running"
echo "2. Restart your Next.js development server"
echo "3. Test a room link: http://localhost:3000/room/sample-host?type=host"
echo ""
echo "🚀 LiveKit setup complete!"
