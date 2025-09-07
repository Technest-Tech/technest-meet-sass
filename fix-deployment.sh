#!/bin/bash

echo "🔧 Fixing NewMeet deployment issues..."

# Stop services
echo "Stopping services..."
docker-compose -f docker-compose.prod.yml down

# Rebuild backend with OpenSSL fix
echo "Rebuilding backend with OpenSSL..."
docker-compose -f docker-compose.prod.yml build newmeet-backend

# Start services
echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 15

# Check service status
echo "Service status:"
docker-compose -f docker-compose.prod.yml ps

# Check LiveKit logs
echo ""
echo "LiveKit server logs:"
docker-compose -f docker-compose.prod.yml logs livekit-server --tail=10

# Try to initialize database
echo ""
echo "Initializing database..."
docker-compose -f docker-compose.prod.yml exec -T newmeet-backend npm run db:push

# Create admin user
echo ""
echo "Creating admin user..."
docker-compose -f docker-compose.prod.yml exec -T newmeet-backend node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@newmeet.com' },
      update: {},
      create: {
        email: 'admin@newmeet.com',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('✅ Admin user created:', admin.email);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.\$disconnect();
  }
}

createAdmin();
"

echo ""
echo "✅ Deployment fix completed!"
echo "Check the service status above."
