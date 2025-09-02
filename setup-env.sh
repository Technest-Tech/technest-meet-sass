#!/bin/bash

# Setup environment variables for NewMeet video conferencing app

echo "Setting up environment variables for NewMeet..."

# Create .env.local file
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

# Show settings menu
NEXT_PUBLIC_SHOW_SETTINGS_MENU="true"

# Show debug mode
NEXT_PUBLIC_SHOW_DEBUG="true"
EOF

echo "✅ Created .env.local file with necessary environment variables"
echo ""
echo "📝 Please restart your development server for the changes to take effect:"
echo "   pnpm dev"
echo ""
echo "🔧 The following issues should now be resolved:"
echo "   - Settings menu will be visible"
echo "   - Control buttons (camera/microphone) will appear"
echo "   - Basic video conferencing controls will be available"
