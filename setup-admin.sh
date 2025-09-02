#!/bin/bash

echo "🚀 Setting up NewMeet Admin Control Panel..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🗄️  Setting up database..."
pnpm run db:generate

echo "🌱 Initializing database..."
node scripts/init-db.js

echo "🎉 Setup completed successfully!"
echo ""
echo "📋 To get started:"
echo "1. Run: pnpm run dev"
echo "2. Open: http://localhost:3000/admin/login"
echo "3. Login with: admin@newmeet.com / admin123"
echo ""
echo "🔗 Admin Panel: http://localhost:3000/admin/dashboard"
echo "🏠 Home Page: http://localhost:3000"
